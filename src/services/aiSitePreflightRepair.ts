/**
 * AI Site Preflight Repair
 * ------------------------
 *
 * Runs in the background during the prompt-first launch pipeline, AFTER the AI
 * returns code and BEFORE the files are committed to the VFS / handed to the
 * WebBuilder preview.
 *
 * Hard contract:
 *   "The preview must never encounter syntax or parse errors at runtime."
 *
 * Strategy:
 *   1. Parse every .tsx/.jsx/.ts/.js file with @babel/standalone in
 *      `parse`-only mode (no transform overhead, fast in the browser).
 *   2. If parse fails, apply a chain of deterministic repair passes
 *      (stray `)` before `/>`, unbalanced braces/parens at EOF, dangling
 *      commas in JSX, smart-quote → ascii, etc.) and re-parse.
 *   3. Iterate up to N passes. If a file still fails to parse, replace it
 *      with a safe placeholder component that renders a visible diagnostic
 *      panel instead of crashing the iframe.
 *
 * Returns a report so the launcher can log/telemeter which files were
 * repaired or quarantined.
 */

import * as Babel from '@babel/standalone';

/**
 * Context carried into the quarantine diagnostic. It is deliberately NOT a
 * content authority: no industry vocabulary, no scaffold sections. The old
 * `aiSiteQuarantineScaffolds` module authored full on-brand page bodies, which
 * made it a second authoring pipeline competing with Lane B. It is deleted.
 */
export interface QuarantineContext {
  industry?: string | null;
  brand?: string | null;
}


export interface PreflightFileReport {
  path: string;
  status: 'clean' | 'repaired' | 'quarantined';
  passes?: string[];
  finalError?: string;
}

export interface PreflightResult {
  files: Record<string, string>;
  reports: PreflightFileReport[];
  cleanCount: number;
  repairedCount: number;
  quarantinedCount: number;
}

export interface PreflightOptions {
  maxPasses?: number;
  /** Industry + brand context used to build on-brand quarantine fallbacks. */
  context?: QuarantineContext;
  /**
   * Soft CPU budget (ms) for the whole run. Once exceeded, remaining files are
   * still parsed (cached, cheap) but repair work is reduced to a single pass
   * with no trailing-suffix search, so the pipeline can never spin.
   */
  budgetMs?: number;
  /**
   * When false, an unparseable file is left exactly as authored and reported as
   * `quarantined` so the caller can fail the launch and run a targeted repair
   * turn. Launch paths never substitute an industry template section.
   */
  allowQuarantine?: boolean;
}

const PARSE_OPTS = {
  sourceType: 'module' as const,
  plugins: ['jsx', 'typescript', 'classProperties', 'objectRestSpread'] as string[],
  errorRecovery: false,
};

// ─────────────────────────────────────────────────────── parse memoization
//
// The launch pipeline parses the same VFS several times (early repair, post
// mutation repair, preview artifacts, launcher gate). Parsing is by far the
// most expensive step, and the inputs are usually byte-identical between
// passes. Memoizing on content makes every repeat pass essentially free and
// removes the "pipeline appears stuck re-parsing" behaviour.

const PARSE_CACHE_LIMIT = 4000;
const parseCache = new Map<string, string | null>();

function cacheKey(source: string): string {
  // FNV-1a over the source + length guard. Cheap and collision-safe enough
  // for an in-memory, same-session memo.
  let h = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${source.length}:${(h >>> 0).toString(36)}`;
}

let cachedParser: { parse: (s: string, o: unknown) => unknown } | null | undefined;

function resolveParser() {
  if (cachedParser === undefined) {
    cachedParser =
      (Babel as unknown as { packages?: { parser?: { parse: (s: string, o: unknown) => unknown } } })
        .packages?.parser ?? null;
  }
  return cachedParser;
}

export function tryParse(source: string): { ok: true } | { ok: false; error: string } {
  const key = cacheKey(source);
  const cached = parseCache.get(key);
  if (cached !== undefined) {
    return cached === null ? { ok: true } : { ok: false, error: cached };
  }

  let result: { ok: true } | { ok: false; error: string };
  try {
    // @babel/standalone exposes `packages.parser` via `Babel.packages` in newer
    // versions; fall back to `Babel.transform` parse-only otherwise.
    const parser = resolveParser();
    if (parser?.parse) {
      parser.parse(source, PARSE_OPTS);
    } else {
      Babel.transform(source, {
        presets: [
          ['react', { runtime: 'classic' }],
          ['typescript', { isTSX: true, allExtensions: true }],
        ],
        filename: 'preflight.tsx',
        ast: false,
        code: false,
      });
    }
    result = { ok: true };
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (parseCache.size >= PARSE_CACHE_LIMIT) parseCache.clear();
  parseCache.set(key, result.ok === true ? null : result.error);
  return result;
}

/** Exposed for tests / long-lived sessions that want to drop the memo. */
export function clearPreflightParseCache(): void {
  parseCache.clear();
}


// ──────────────────────────────────────────────────────────── repair passes

type RepairPass = { name: string; apply: (src: string) => string };

const REPAIR_PASSES: RepairPass[] = [
  {
    name: 'strip-stray-paren-before-self-closing',
    // <img className="..." ) />  /  <Foo prop={x} ) />
    apply: (s) => s.replace(/(["}\w\]])\s*\)\s*\/>/g, '$1 />'),
  },
  {
    name: 'strip-stray-paren-before-closing-tag',
    // <div ...> ... )</div>   (extra `)` immediately before close tag)
    apply: (s) => s.replace(/\)\s*(<\/[A-Za-z][A-Za-z0-9.]*\s*>)/g, '$1'),
  },
  {
    name: 'normalize-smart-quotes',
    apply: (s) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'),
  },
  {
    name: 'strip-trailing-comma-in-jsx-attr',
    // className="foo", />   →   className="foo" />
    apply: (s) => s.replace(/("|\}),\s*\/>/g, '$1 />'),
  },
  {
    name: 'strip-markdown-fences',
    apply: (s) =>
      s
        .replace(/^\s*```(?:tsx|jsx|ts|js|typescript|javascript)?\s*\n/gm, '')
        .replace(/\n```\s*$/gm, '')
        .replace(/^\s*```\s*\n/gm, ''),
  },
  {
    name: 'strip-html-comments-in-jsx',
    // AI sometimes emits <!-- ... --> inside JSX (HTML-style comments are invalid)
    apply: (s) => s.replace(/<!--[\s\S]*?-->/g, ''),
  },
  {
    name: 'close-unterminated-block-comment',
    // AI sometimes opens a `/* ...` block comment (often truncated mid
    // response) and never closes it, which swallows the rest of the file and
    // Babel reports as "Unterminated comment" at EOF. Close it at the end of
    // the line it was opened on so any real code that follows is preserved
    // instead of being silently absorbed into the comment.
    apply: (s) => {
      let inStr: string | null = null;
      let inLine = false;
      let inBlock = false;
      let blockStart = -1;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const n = s[i + 1];
        if (inLine) { if (c === '\n') inLine = false; continue; }
        if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '/' && n === '/') { inLine = true; i++; continue; }
        if (c === '/' && n === '*') { inBlock = true; blockStart = i; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      }
      if (!inBlock || blockStart < 0) return s;
      let closeAt = s.indexOf('\n', blockStart);
      if (closeAt === -1) closeAt = s.length;
      return `${s.slice(0, closeAt)} */${s.slice(closeAt)}`;
    },
  },
  {
    name: 'normalize-jsx-boolean-attrs',
    // class= → className= ; for= → htmlFor= (only in code, not strings)
    apply: (s) =>
      s
        .replace(/(\s)class=(["{])/g, '$1className=$2')
        .replace(/(\s)for=(["{])/g, '$1htmlFor=$2'),
  },
  {
    name: 'fix-double-jsx-attr-equals',
    // className=="foo" → className="foo"
    apply: (s) => s.replace(/([A-Za-z_][\w-]*)==(["{])/g, '$1=$2'),
  },
  {
    name: 'remove-stray-semicolon-in-jsx-attr-list',
    // <Foo a="b"; c="d" /> → <Foo a="b" c="d" />
    apply: (s) => s.replace(/("|\})\s*;\s+([A-Za-z_][\w-]*=)/g, '$1 $2'),
  },
  {
    name: 'drop-trailing-comma-after-jsx-element',
    // }, → }  when followed by ) or } at top of expression returns
    apply: (s) => s.replace(/(<\/[A-Za-z][A-Za-z0-9.]*>),(\s*[)}\]])/g, '$1$2'),
  },
  {
    name: 'truncate-incomplete-trailing-jsx',
    // If file ends mid-tag (e.g. `<img src={...` or `<div className="...`),
    // walk back to the last clearly-complete top-level boundary so the
    // balancer can close the remaining structure cleanly.
    apply: (s) => {
      const tail = s.slice(-6000);
      const lastSafe = Math.max(
        tail.lastIndexOf('\n}\n'),
        tail.lastIndexOf('\n};\n'),
        tail.lastIndexOf('\n);\n'),
        tail.lastIndexOf('\n  );\n'),
        tail.lastIndexOf('\n    );\n'),
      );
      if (lastSafe < 0) return s;
      const absolute = s.length - tail.length + lastSafe;
      const after = s.slice(absolute);
      const opens = (after.match(/[({[]/g) || []).length;
      const closes = (after.match(/[)}\]]/g) || []).length;
      if (opens > closes + 2) {
        return s.slice(0, absolute) + '\n';
      }
      return s;
    },
  },
  {
    name: 'balance-trailing-brackets',
    apply: (s) => {
      const counts = { '(': 0, ')': 0, '{': 0, '}': 0, '[': 0, ']': 0 };
      let inStr: string | null = null;
      let inLine = false;
      let inBlock = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const n = s[i + 1];
        if (inLine) { if (c === '\n') inLine = false; continue; }
        if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
        if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '/' && n === '/') { inLine = true; i++; continue; }
        if (c === '/' && n === '*') { inBlock = true; i++; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c in counts) (counts as Record<string, number>)[c]++;
      }
      let out = s;
      const missing: string[] = [];
      const close = (open: ')' | '}' | ']', delta: number) => {
        for (let i = 0; i < delta; i++) missing.push(open);
      };
      close(')', counts['('] - counts[')']);
      close('}', counts['{'] - counts['}']);
      close(']', counts['['] - counts[']']);
      // Auto-close deficits up to 24 — handles truncated AI output that
      // dropped multiple nested JSX/object closers across many lines.
      if (missing.length > 0 && missing.length <= 24) {
        out = out.replace(/\s*$/, '') + '\n' + missing.join('') + '\n';
      }
      return out;
    },
  },
];

// Quarantine is a DIAGNOSTIC, not an authoring path. A quarantined file keeps
// its identity (default export + route) but renders an explicit build-error
// panel. No industry copy, no substituted sections: only Lane B may author a
// page body, and every launch path runs with `allowQuarantine: false`.

function isCodeFile(path: string): boolean {
  return /\.(tsx|jsx|ts|js)$/.test(path) && !path.includes('/node_modules/');
}

function quarantineComponentName(path: string): string {
  const base = (path.split('/').pop() || 'Page').replace(/\.(tsx|jsx|ts|js)$/, '');
  const safe = base.replace(/[^A-Za-z0-9]/g, '');
  return /^[A-Za-z]/.test(safe) ? safe : `Page${safe || 'X'}`;
}

function deriveQuarantineComponent(path: string, error: string, _ctx: QuarantineContext): string {
  const name = quarantineComponentName(path);
  const safeError = JSON.stringify(error.slice(0, 600));
  const safePath = JSON.stringify(path);
  return `import React from 'react';

/**
 * Quarantined by aiSitePreflightRepair. The authored source for ${path} failed
 * to parse after every repair pass. This is a diagnostic surface only — it
 * never pretends to be finished content.
 */
export default function ${name}() {
  if (typeof window !== 'undefined') {
    try { console.error('[preflight] quarantined', ${safePath}, ${safeError}); } catch {}
  }
  return (
    <main role="main" className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8 text-foreground">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Build error</p>
      <h1 className="text-2xl font-semibold">This page could not be compiled</h1>
      <p className="text-sm text-muted-foreground">{${safePath}}</p>
      <pre className="overflow-auto rounded-md bg-muted p-4 text-xs text-muted-foreground">{${safeError}}</pre>
    </main>
  );
}
`;
}


/**
 * Lane B occasionally completes a valid page and then emits a small suffix
 * such as an extra JSX closing tag or parenthesis. Babel reports that at the
 * first trailing line as "Unexpected token". Keep this deliberately narrow:
 * only accept a parseable prefix that retains the default-exported page and
 * at least 80% of the repaired model response.
 *
 * The search is coarse (geometric line steps) instead of scanning every one of
 * the last 48 lines: it costs ~10 parses instead of ~48 for the same reach.
 */
const TRIM_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48];

function trimParseableTrailingSuffix(source: string): string | null {
  if (!/export\s+default\s+(?:function|class|[A-Za-z_$])/.test(source)) return null;

  const lines = source.split('\n');
  const minLength = Math.ceil(source.length * 0.8);
  for (const step of TRIM_STEPS) {
    if (step >= lines.length) break;
    const candidate = lines.slice(0, -step).join('\n').trimEnd();
    if (candidate.length < minLength) break;
    if (!/export\s+default\s+(?:function|class|[A-Za-z_$])/.test(candidate)) continue;
    if (tryParse(candidate).ok === true) return `${candidate}\n`;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────── public

/**
 * Per-file generator form of the preflight repair. Parsing/repairing a large
 * wizard VFS is CPU-heavy enough to freeze the shell when run as one blocking
 * call, so callers on an async host drive this generator and yield between
 * files to keep the UI responsive.
 */
export function* runPreflightRepairSteps(
  files: Record<string, string>,
  options: PreflightOptions = {},
): Generator<void, PreflightResult, void> {
  const maxPasses = options.maxPasses ?? 4;
  const budgetMs = options.budgetMs ?? 20_000;
  const startedAt = Date.now();

  const ctx: QuarantineContext = options.context ?? {};
  const out: Record<string, string> = { ...files };
  const reports: PreflightFileReport[] = [];
  let clean = 0;
  let repaired = 0;
  let quarantined = 0;

  for (const [path, source] of Object.entries(files)) {
    yield;
    if (typeof source !== 'string' || !isCodeFile(path)) {
      out[path] = source;
      continue;
    }


    const first = tryParse(source);
    if (first.ok === true) {
      reports.push({ path, status: 'clean' });
      clean++;
      continue;
    }

    // Once the soft budget is spent, degrade to one repair pass and skip the
    // trailing-suffix search so a pathological file can never stall the run.
    const overBudget = Date.now() - startedAt > budgetMs;
    const passBudget = overBudget ? 1 : maxPasses;

    let current = source;
    const applied: string[] = [];
    const seen = new Set<string>([cacheKey(source)]);
    let lastError: string = first.ok === false ? first.error : 'unknown parse failure';
    let success = false;
    for (let pass = 0; pass < passBudget && !success; pass++) {
      let changedThisRound = false;
      for (const repair of REPAIR_PASSES) {
        const next = repair.apply(current);
        if (next !== current) {
          current = next;
          applied.push(repair.name);
          changedThisRound = true;
        }
      }
      if (!changedThisRound) break;
      // Cycle guard: repair passes that keep flipping between two shapes would
      // otherwise burn the full pass budget on identical parses.
      const key = cacheKey(current);
      if (seen.has(key)) break;
      seen.add(key);

      const res = tryParse(current);
      if (res.ok === true) {
        success = true;
        break;
      }
      lastError = res.error;
    }

    if (!success && !overBudget) {
      const trimmed = trimParseableTrailingSuffix(current);
      if (trimmed) {
        current = trimmed;
        applied.push('trim-parseable-trailing-suffix');
        success = true;
      }
    }

    if (success) {
      out[path] = current;
      reports.push({ path, status: 'repaired', passes: applied });
      repaired++;
    } else {
      out[path] = options.allowQuarantine === false
        ? source
        : deriveQuarantineComponent(path, lastError, ctx);
      reports.push({ path, status: 'quarantined', passes: applied, finalError: lastError });
      quarantined++;
    }
  }


  return {
    files: out,
    reports,
    cleanCount: clean,
    repairedCount: repaired,
    quarantinedCount: quarantined,
  };
}

/** Blocking convenience wrapper used by callers without an async host. */
export function runPreflightRepair(
  files: Record<string, string>,
  options: PreflightOptions = {},
): PreflightResult {
  const steps = runPreflightRepairSteps(files, options);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}
