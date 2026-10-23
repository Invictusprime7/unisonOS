/**
 * Persist Generated Bindings
 *
 * After the System Launcher merges AI output with the canonical snapshot
 * (which stamps data-ut-* attributes via applyWizardBindingsToVfs), this
 * helper scans the finalized VFS, harvests every (slot, intent, target)
 * triple, and upserts them into `site_intent_bindings`.
 *
 * Runs as part of the launcher transaction — by the time we navigate to the
 * Builder, every interactive element has both an in-DOM `data-ut-intent` AND
 * a matching DB row that the runtime intentRouter can resolve.
 */
import { upsertIntentBinding } from '@/services/intentBindingService';
import { getIntentDef, resolveIntentName } from '@/platform/core';

export interface GeneratedBindingRow {
  pagePath: string;
  slot: string;
  intent: string;
  targetPageId?: string;
  label?: string;
  payload: Record<string, unknown>;
}

const SLOT_ATTR_RE = /data-ut-(?:slot|binding-key)=["']([^"']+)["']/i;
const INTENT_ATTR_RE = /data-ut-intent=["']([^"']+)["']/i;
const TARGET_ATTR_RE = /data-ut-target-page-id=["']([^"']+)["']/i;
const LABEL_ATTR_RE = /data-ut-label=["']([^"']+)["']/i;
const PATH_ATTR_RE = /data-ut-path=["']([^"']+)["']/i;

const TAG_OPEN_RE = /<[A-Za-z][^>]*?\bdata-ut-(?:slot|binding-key|intent)=[^>]*?>/g;

function pagePathFromFile(filePath: string): string {
  if (filePath === '/src/App.tsx' || filePath === 'src/App.tsx') return '/';
  const m = filePath.match(/\/pages\/(.+?)\.tsx$/i);
  if (!m) return '/';
  const slug = m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return slug === 'home' ? '/' : `/${slug}`;
}

/** Pure: extract candidate binding rows from a VFS map. */
export function extractGeneratedBindings(
  files: Record<string, string>,
): GeneratedBindingRow[] {
  const rows: GeneratedBindingRow[] = [];
  for (const [filePath, content] of Object.entries(files)) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) continue;
    if (typeof content !== 'string' || !content.includes('data-ut-')) continue;

    const pagePath = pagePathFromFile(filePath);
    const tags = content.match(TAG_OPEN_RE) || [];
    for (const tag of tags) {
      const slot =
        tag.match(SLOT_ATTR_RE)?.[1] ||
        tag.match(/data-ut-binding-key=["']([^"']+)["']/i)?.[1];
      const rawIntent = tag.match(INTENT_ATTR_RE)?.[1];
      if (!slot || !rawIntent) continue;
      const canonical = resolveIntentName(rawIntent);
      if (!canonical) continue;
      const def = getIntentDef(canonical);
      if (!def) continue;

      const row: GeneratedBindingRow = {
        pagePath,
        slot,
        intent: canonical,
        label: tag.match(LABEL_ATTR_RE)?.[1],
        targetPageId: tag.match(TARGET_ATTR_RE)?.[1],
        payload: {},
      };
      const pathAttr = tag.match(PATH_ATTR_RE)?.[1];
      if (pathAttr) row.payload.path = pathAttr;
      rows.push(row);
    }
  }
  return rows;
}

export interface PersistGeneratedBindingsResult {
  attempted: number;
  persisted: number;
  failed: number;
}

export function countExpectedGeneratedBindingReceipts(
  bindings: readonly { route: string; sourceSlot: string; missingCapabilities: readonly string[] }[],
): number {
  return new Set(bindings
    .filter((binding) => binding.missingCapabilities.length === 0)
    .map((binding) => `${binding.route}::${binding.sourceSlot}`),
  ).size;
}

/**
 * Upsert harvested bindings. Best-effort — never throws, never blocks launch.
 * Returns counts for diagnostics.
 */
export async function persistGeneratedBindings(args: {
  businessId: string;
  projectId: string;
  files: Record<string, string>;
}): Promise<PersistGeneratedBindingsResult> {
  const { businessId, projectId, files } = args;
  if (!businessId || !projectId) {
    return { attempted: 0, persisted: 0, failed: 0 };
  }

  // De-duplicate by (pagePath, slot) — last write wins, mirrors DB constraint.
  const seen = new Map<string, GeneratedBindingRow>();
  for (const row of extractGeneratedBindings(files)) {
    seen.set(`${row.pagePath}::${row.slot}`, row);
  }

  const rows = Array.from(seen.values());
  let persisted = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        const payloadSchema: Record<string, unknown> = { ...row.payload };
        if (row.targetPageId) payloadSchema.targetPageId = row.targetPageId;
        const result = await upsertIntentBinding({
          businessId,
          projectId,
          pagePath: row.pagePath,
          elementKey: row.slot,
          elementLabel: row.label ?? null,
          intent: row.intent,
          payloadSchema,
          enabled: true,
        });
        if (result) persisted += 1;
        else failed += 1;
      } catch (err) {
        console.warn('[persistGeneratedBindings] upsert failed', row.slot, err);
        failed += 1;
      }
    }),
  );

  return { attempted: rows.length, persisted, failed };
}
