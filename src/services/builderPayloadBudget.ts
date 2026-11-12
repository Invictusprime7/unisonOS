/**
 * builderPayloadBudget — hard client-side size budget for builder-brain requests.
 *
 * WHY THIS EXISTS
 * ---------------
 * The edge gateway silently DROPS the connection for large request bodies
 * (measured: ~200KB reliably OK, ~300KB+ intermittently killed with no HTTP
 * response at all). The browser surfaces that as:
 *
 *   "Failed to send a request to the Edge Function"
 *
 * …which looks like a network/wall-clock failure but is really an oversized
 * payload. Wizard Lane B turns carry the whole VFS + elements library +
 * blueprint and blow straight past the limit, so the request never reaches the
 * function handler (edge logs show the isolate booting with no request line).
 *
 * The shrinker below trims OPTIONAL context in priority order until the
 * serialized body fits the budget. It never touches the contract-critical
 * fields (messages intent, mode, wizardSeed, aesthetic, templateName,
 * systemType, source) — Lane B stays authoritative, it just gets less padding.
 */

/** Safe serialized-body budget in bytes. Empirically well below the drop threshold. */
export const BUILDER_BODY_BUDGET_BYTES = 190_000;

/** Progressively tighter budgets used across transport retries. */
export const BUILDER_BODY_RETRY_BUDGETS = [BUILDER_BODY_BUDGET_BYTES, 120_000, 70_000, 45_000];

export interface ShrinkResult<T> {
  payload: T;
  originalBytes: number;
  finalBytes: number;
  trimmed: string[];
}

function byteLength(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json ? new TextEncoder().encode(json).length : 0;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n/* …truncated for transport budget… */`;
}

/**
 * Shrink a builder-turn payload so its JSON body fits `budgetBytes`.
 * Returns a shallow clone — the caller's object is never mutated.
 */
export function shrinkBuilderTurnPayload<T extends Record<string, unknown>>(
  input: T,
  budgetBytes: number = BUILDER_BODY_BUDGET_BYTES,
): ShrinkResult<T> {
  const payload: Record<string, unknown> = { ...input };
  const originalBytes = byteLength(payload);
  const trimmed: string[] = [];
  if (originalBytes <= budgetBytes) {
    return { payload: payload as T, originalBytes, finalBytes: originalBytes, trimmed };
  }

  const fits = () => byteLength(payload) <= budgetBytes;

  // Composer messages contain a structured request, not prose. Cutting its
  // string in the generic fallback corrupts JSON as project knowledge grows.
  if (['site-page-author', 'site-page-repair', 'builder-source-edit', 'source-project-author'].includes(String(payload.mode))) {
    const messages = payload.messages as Array<{ role: string; content: unknown }> | undefined;
    const last = messages?.[messages.length - 1];
    if (last && typeof last.content === 'string') {
      try {
        const context = JSON.parse(last.content);
        if (context?.files && typeof context.files === 'object' && context.page?.filePath) {
          const sync = () => { payload.messages = [{ ...last, content: JSON.stringify(context) }]; };
          sync();
          // Read-only context goes first (largest first); files the edit may
          // write are dropped only when nothing else is left.
          const writable = new Set<string>(Array.isArray(context.sourceTargets) ? context.sourceTargets : []);
          const optional = Object.keys(context.files)
            .filter((path) => path !== context.page.filePath)
            .sort((a, b) => Number(writable.has(a)) - Number(writable.has(b))
              || String(context.files[b]).length - String(context.files[a]).length);
          for (const path of optional) {
            if (fits()) break;
            delete context.files[path];
            trimmed.push(`composer.files:${path}(dropped)`);
            sync();
          }
          for (const key of ['priorPages', 'previousResponse']) {
            if (fits()) break;
            delete context[key];
            trimmed.push(`composer.${key}(dropped)`);
            sync();
          }
          // Preserve the target source, instructions and diagnostics even if
          // they exceed a smaller retry budget; never corrupt the request.
          return done();
        }
      } catch { /* Let the server report an already-invalid request. */ }
    }
  }

  // 1. Attachments / diagnostics — pure extras.
  for (const key of ['attachments', 'previewDiagnostics', 'previewSnapshot', 'componentBehaviorContext']) {
    if (fits()) return done();
    if (payload[key] !== undefined) {
      delete payload[key];
      trimmed.push(key);
    }
  }

  // 2. Elements library / design profile / blueprint context — trim, then drop.
  if (!fits() && typeof payload.siteElementsLibraryContext === 'string') {
    payload.siteElementsLibraryContext = truncate(payload.siteElementsLibraryContext as string, 6_000);
    trimmed.push('siteElementsLibraryContext(trimmed)');
  }
  if (!fits() && payload.systemsBuildContext !== undefined) {
    const asJson = JSON.stringify(payload.systemsBuildContext ?? null) || '';
    if (asJson.length > 8_000) {
      payload.systemsBuildContext = { note: 'trimmed-for-transport', preview: asJson.slice(0, 8_000) };
      trimmed.push('systemsBuildContext(trimmed)');
    }
  }
  if (!fits() && payload.userDesignProfile !== undefined) {
    const asJson = JSON.stringify(payload.userDesignProfile ?? null) || '';
    if (asJson.length > 4_000) {
      payload.userDesignProfile = { note: 'trimmed-for-transport', preview: asJson.slice(0, 4_000) };
      trimmed.push('userDesignProfile(trimmed)');
    }
  }

  // 3. VFS files — keep the files the turn is actually about, shrink the rest,
  //    then drop the largest until we fit.
  const vfs = payload.vfsFiles as Record<string, string> | undefined;
  if (!fits() && vfs && typeof vfs === 'object') {
    const priority = new Set<string>([
      ...((payload.recentChangedFiles as string[] | undefined) || []),
      ...(typeof payload.targetFile === 'string' ? [payload.targetFile as string] : []),
    ]);
    const next: Record<string, string> = {};
    for (const [path, content] of Object.entries(vfs)) {
      if (typeof content !== 'string') continue;
      next[path] = priority.has(path) ? truncate(content, 12_000) : truncate(content, 3_000);
    }
    payload.vfsFiles = next;
    trimmed.push('vfsFiles(trimmed)');

    if (!fits()) {
      const ordered = Object.entries(next)
        .filter(([path]) => !priority.has(path))
        .sort((a, b) => b[1].length - a[1].length);
      for (const [path] of ordered) {
        if (fits()) break;
        delete next[path];
        trimmed.push(`vfsFiles:${path}(dropped)`);
      }
      if (!fits()) {
        delete payload.vfsFiles;
        trimmed.push('vfsFiles(dropped)');
      }
    }
  }

  // 4. Current code snapshot.
  if (!fits() && typeof payload.currentCode === 'string' && (payload.currentCode as string).length > 8_000) {
    payload.currentCode = truncate(payload.currentCode as string, 8_000);
    trimmed.push('currentCode(trimmed)');
  }

  // 5. Conversation history — always keep the final (current) user turn.
  const messages = payload.messages as Array<{ role: string; content: unknown }> | undefined;
  if (!fits() && Array.isArray(messages) && messages.length > 1) {
    payload.messages = messages.slice(-1);
    trimmed.push('messages(history-dropped)');
  }

  // 6. Remaining heavyweight context objects. These were previously untouched,
  //    which let large Wizard turns (9+ pages of launchBrief / unisonContext)
  //    stay above the gateway drop threshold even after every other trim —
  //    surfacing as "Failed to send a request to the Edge Function".
  for (const key of ['unisonContext', 'launchBrief', 'siteElementsLibraryContext', 'systemsBuildContext', 'userDesignProfile'] as const) {
    if (fits()) return done();
    const value = payload[key];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      payload[key] = truncate(value, 2_000);
    } else {
      const asJson = JSON.stringify(value ?? null) || '';
      payload[key] = { note: 'trimmed-for-transport', preview: asJson.slice(0, 4_000) };
    }
    trimmed.push(`${key}(trimmed)`);
    if (!fits()) {
      delete payload[key];
      trimmed.push(`${key}(dropped)`);
    }
  }

  // 7. Final clamp — the surviving message content itself can exceed the
  //    budget. Truncate string contents (newest last) rather than let the
  //    gateway silently drop the whole request.
  const finalMessages = payload.messages as Array<{ role: string; content: unknown }> | undefined;
  if (!fits() && Array.isArray(finalMessages) && finalMessages.length > 0) {
    const overhead = byteLength({ ...payload, messages: [] });
    const allowance = Math.max(8_000, budgetBytes - overhead - 2_000);
    const perMessage = Math.floor(allowance / finalMessages.length);
    payload.messages = finalMessages.map((m) =>
      typeof m?.content === 'string' && m.content.length > perMessage
        ? { ...m, content: truncate(m.content, perMessage) }
        : m,
    );
    trimmed.push('messages(content-truncated)');
  }

  function done(): ShrinkResult<T> {
    return { payload: payload as T, originalBytes, finalBytes: byteLength(payload), trimmed };
  }
  return done();
}


