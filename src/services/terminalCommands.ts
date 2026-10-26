/**
 * VFS Terminal Command Engine
 * 
 * Provides an interactive command processor that operates on the Virtual File System.
 * Commands can be executed by users typing in the terminal or programmatically by the AI.
 * 
 * Supported commands:
 *   install <pkg[@ver]>  — Add a dependency to the Sandpack preview
 *   uninstall <pkg>      — Remove a dependency
 *   deps                 — List current dependencies
 *   ls [path]            — List files/folders at path
 *   tree                 — Show full file tree
 *   cat <file>           — Print file contents
 *   find <pattern>       — Search for files matching a glob pattern
 *   diagnose             — Run VFS diagnostics (broken imports, missing files)
 *   whoami               — Show current business system type
 *   clear                — Clear terminal output
 *   help                 — Show available commands
 */

import type { VirtualNode, VirtualFile, VirtualFolder } from '@/hooks/useVirtualFileSystem';
import { vfsToFileMap, getFilePaths } from '@/hooks/useVirtualFileSystem';
import { buildSystemGraph, renderSystemGraphForPrompt } from '@/services/agent-runtime/systemGraph';
import { resolveMutableNode } from '@/services/agent-runtime/nodeAddress';
import { runPreviewProbe, parseProbeArgs, formatProbeReport } from '@/services/agent-runtime/previewProbe';
import { removeSection, restyleSection, moveSection, swapVariant } from '@/services/agent-runtime/sectionActions';
import { matchNaturalLanguage, looksLikeNaturalLanguage } from '@/services/terminal/naturalLanguage';

// ============================================================================
// Types
// ============================================================================

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system' | 'warn';
  text: string;
  timestamp: number;
}

export interface CommandContext {
  nodes: VirtualNode[];
  currentDeps: Record<string, string>;
  businessType?: string;
  onAddDep: (pkg: string, version: string) => void;
  onRemoveDep: (pkg: string) => void;
  onRefreshPreview?: () => void;
  /**
   * Canonical write sink. Every file-changing command builds FileOps and hands
   * them here; the host commits them through commitMutation (one checkpoint per
   * call). The terminal never writes files itself.
   */
  onPatch?: (ops: TerminalFileOp[], summary: string, routeOps?: TerminalRouteOp[]) => void;
  /** Optional read-only revision info for the `revision` command. */
  getRevisionInfo?: () => { revisionId: string | null; lastSurface?: string | null; lastAt?: number | null };
}

export type TerminalFileOp =
  | { type: 'create'; path: string; contents: string }
  | { type: 'replace'; path: string; contents: string }
  | { type: 'delete'; path: string };

/** Typed page operation; the host maps `route` to the registry pageId and commits it as a routeOp. */
export type TerminalRouteOp = { type: 'rename_page'; route: string; newTitle: string; newRoute?: string };

const normRoute = (r: string) => '/' + r.replace(/^page:/, '').replace(/^\/+|\/+$/g, '');

/** Pure planner for `page rename`. Refuses a new address while any button still points at the old one. */
export function planPageRename(args: string[], files: Record<string, string>):
  { ok: true; op: TerminalRouteOp; summary: string } | { ok: false; error: string } {
  const [address, ...rest] = args;
  if (!address || !rest.length) return { ok: false, error: 'Usage: page rename page:/about "New title" [/new-address]' };
  let newRoute: string | undefined;
  if (rest.length > 1 && rest[rest.length - 1].startsWith('/')) newRoute = normRoute(rest.pop()!);
  const newTitle = rest.join(' ').replace(/^["']|["']$/g, '').trim();
  if (!newTitle) return { ok: false, error: 'Give the page a new title.' };
  const route = normRoute(address);
  if (newRoute && newRoute !== route) {
    const esc = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkRe = new RegExp(`data-ut-(?:path|target)=["']#?${esc}["']|(?:to|href)=["']#?${esc}["']`);
    const linked = Object.entries(files).filter(([p, src]) => /\.(t|j)sx$/.test(p) && p !== '/src/App.tsx' && linkRe.test(src)).map(([p]) => p);
    if (linked.length) return { ok: false, error: `Not renamed: buttons in ${linked.slice(0, 3).join(', ')} still go to ${route}. Rename the title only, or change those buttons first.` };
  }
  return { ok: true, op: { type: 'rename_page', route, newTitle, newRoute }, summary: `renamed ${route} to "${newTitle}"${newRoute && newRoute !== route ? ` at ${newRoute}` : ''}` };
}

function cmdPage(args: string[], ctx: CommandContext): CommandResult {
  if (args[0] !== 'rename') return { lines: [mkLine('error', 'Usage: page rename page:/about "New title" [/new-address]')] };
  if (stagedOps) return { lines: [mkLine('error', 'Page renames save on their own — "commit" or "abort" staged changes first.')] };
  const r = planPageRename(args.slice(1), vfsToFileMap(ctx.nodes));
  if (r.ok === false) return { lines: [mkLine('error', r.error)] };
  if (!ctx.onPatch) return { lines: [mkLine('error', 'Not saved: no site is connected to this terminal')] };
  ctx.onPatch([], `Terminal: ${r.summary}`, [r.op]);
  return { lines: [mkLine('success', `✓ ${r.summary} — saving as a checkpoint`)], mutated: true };
}

/** Staged mode buffer (begin → … → commit/abort). Null when not staging. */
let stagedOps: TerminalFileOp[] | null = null;

/** Test hook: reset staged state. */
export function __resetTerminalStaging(): void { stagedOps = null; }

function submitOps(ops: TerminalFileOp[], summary: string, ctx: CommandContext): string {
  if (stagedOps) {
    for (const op of ops) {
      stagedOps = stagedOps.filter((o) => o.path !== op.path);
      stagedOps.push(op);
    }
    return `staged (${stagedOps.length} pending — "commit" to save)`;
  }
  if (!ctx.onPatch) return 'not saved: no site is connected to this terminal';
  ctx.onPatch(ops, summary);
  return 'saving as a checkpoint';
}

function readFile(ctx: CommandContext, path: string): string | undefined {
  const map = vfsToFileMap(ctx.nodes);
  if (stagedOps) {
    const op = [...stagedOps].reverse().find((o) => o.path === path);
    if (op) return op.type === 'delete' ? undefined : op.contents;
  }
  return map[path];
}

function cmdTouch(args: string[], ctx: CommandContext): CommandResult {
  const path = normalizeWritablePath(args[0] ?? '');
  if (!path) return { lines: [mkLine('error', 'Usage: touch <filepath>')] };
  if (readFile(ctx, path) !== undefined) return { lines: [mkLine('output', `${path} already exists`)] };
  const msg = submitOps([{ type: 'create', path, contents: '' }], `Terminal: touch ${path}`, ctx);
  return { lines: [mkLine('success', `✓ ${path} — ${msg}`)], mutated: true };
}

function cmdCopyOrMove(args: string[], ctx: CommandContext, move: boolean): CommandResult {
  const verb = move ? 'mv' : 'cp';
  const from = normalizeWritablePath(args[0] ?? '');
  const to = normalizeWritablePath(args[1] ?? '');
  if (!from || !to) return { lines: [mkLine('error', `Usage: ${verb} <from> <to>`)] };
  const contents = readFile(ctx, from);
  if (contents === undefined) return { lines: [mkLine('error', `File not found: ${from}`)] };
  if (readFile(ctx, to) !== undefined) return { lines: [mkLine('error', `${to} already exists`)] };
  const ops: TerminalFileOp[] = [{ type: 'create', path: to, contents }];
  if (move) ops.push({ type: 'delete', path: from });
  const msg = submitOps(ops, `Terminal: ${verb} ${from} ${to}`, ctx);
  return { lines: [mkLine('success', `✓ ${from} → ${to} — ${msg}`)], mutated: true };
}

function cmdRm(args: string[], ctx: CommandContext): CommandResult {
  const path = normalizeWritablePath(args[0] ?? '');
  if (!path) return { lines: [mkLine('error', 'Usage: rm <filepath>')] };
  if (readFile(ctx, path) === undefined) return { lines: [mkLine('error', `File not found: ${path}`)] };
  const msg = submitOps([{ type: 'delete', path }], `Terminal: rm ${path}`, ctx);
  return { lines: [mkLine('success', `✓ removed ${path} — ${msg}`)], mutated: true };
}

function cmdBegin(): CommandResult {
  if (stagedOps) return { lines: [mkLine('output', `Already staging (${stagedOps.length} pending)`)] };
  stagedOps = [];
  return { lines: [mkLine('success', 'Staging started — file commands are held until "commit" or "abort"')] };
}

function cmdDiff(ctx: CommandContext): CommandResult {
  if (!stagedOps) return { lines: [mkLine('output', 'Not staging. Type "begin" first.')] };
  if (stagedOps.length === 0) return { lines: [mkLine('output', 'No staged changes')] };
  const map = vfsToFileMap(ctx.nodes);
  return {
    lines: stagedOps.map((op) => {
      if (op.type === 'delete') return mkLine('warn', `- ${op.path}`);
      const before = map[op.path];
      if (before === undefined) return mkLine('success', `+ ${op.path} (${op.contents.length} bytes)`);
      return mkLine('output', `~ ${op.path} (${before.length} → ${op.contents.length} bytes)`);
    }),
  };
}

function cmdCommitStaged(ctx: CommandContext): CommandResult {
  if (!stagedOps) return { lines: [mkLine('output', 'Not staging. Type "begin" first.')] };
  const ops = stagedOps;
  stagedOps = null;
  if (ops.length === 0) return { lines: [mkLine('output', 'Nothing to commit')] };
  if (!ctx.onPatch) return { lines: [mkLine('error', 'Not saved: no site is connected to this terminal')] };
  ctx.onPatch(ops, `Terminal: ${ops.length} staged change${ops.length === 1 ? '' : 's'}`);
  return { lines: [mkLine('success', `✓ Saving ${ops.length} change(s) as one checkpoint`)], mutated: true };
}

function cmdAbort(): CommandResult {
  const n = stagedOps?.length ?? 0;
  stagedOps = null;
  return { lines: [mkLine('output', `Staging cancelled (${n} change(s) discarded)`)] };
}

function cmdRevision(ctx: CommandContext): CommandResult {
  const info = ctx.getRevisionInfo?.();
  const lines = [mkLine('output', `Revision: ${info?.revisionId ?? 'none'}`)];
  if (info?.lastSurface) {
    const at = info.lastAt ? new Date(info.lastAt).toLocaleTimeString() : '';
    lines.push(mkLine('output', `Last save: ${info.lastSurface}${at ? ` at ${at}` : ''}`));
  }
  lines.push(mkLine('output', `Staged: ${stagedOps ? stagedOps.length : 'not staging'}`));
  return { lines };
}

function cmdRoutes(ctx: CommandContext): CommandResult {
  const app = vfsToFileMap(ctx.nodes)['/src/App.tsx'] ?? '';
  const routes = [...app.matchAll(/path=["']([^"']+)["'][^>]*element=\{<\s*(\w+)/g)];
  if (routes.length === 0) return { lines: [mkLine('output', 'No routes found in /src/App.tsx')] };
  return { lines: routes.map((m) => mkLine('output', `${m[1].padEnd(24)} → ${m[2]}`)) };
}

function cmdGraph(ctx: CommandContext): CommandResult {
  const text = renderSystemGraphForPrompt(buildSystemGraph(vfsToFileMap(ctx.nodes)), 6000);
  return { lines: (text || 'No pages found').split('\n').map((l) => mkLine('output', l)) };
}

function cmdNode(args: string[], ctx: CommandContext): CommandResult {
  if (!args[0]) return { lines: [mkLine('error', 'Usage: node <page:/about | section:/about#hero | button:/home#Book | component:SiteNav | file:/src/App.tsx>')] };
  const r = resolveMutableNode(args.join(' '), vfsToFileMap(ctx.nodes));
  if (r.ok === false) return { lines: [mkLine('error', r.error)] };
  return { lines: [mkLine('success', r.label), mkLine('output', `owner: ${r.ownerPath}`)] };
}

function cmdSection(args: string[], ctx: CommandContext): CommandResult {
  const [verb, address] = args;
  if (!verb || !address || !['rm', 'up', 'down', 'style', 'variant'].includes(verb)) {
    return { lines: [mkLine('error', 'Usage: section <rm|up|down> section:/page#id  |  section style section:/page#id "classes"  |  section variant section:/page#id ServicesEditorialRows')] };
  }
  const files = { ...vfsToFileMap(ctx.nodes) };
  for (const op of stagedOps ?? []) { if (op.type === 'delete') delete files[op.path]; else files[op.path] = op.contents; }
  const r = verb === 'variant'
    ? swapVariant(address, args[2] ?? '', files)
    : verb === 'style'
    ? restyleSection(address, args.slice(2).join(' ').replace(/^["']|["']$/g, ''), files)
    : verb === 'rm' ? removeSection(address, files) : moveSection(address, verb as 'up' | 'down', files);
  if (r.ok === false) return { lines: [mkLine('error', r.error)] };
  const msg = submitOps([{ type: 'replace', path: r.path, contents: r.contents }], `Terminal: ${r.summary}`, ctx);
  return { lines: [mkLine('success', `✓ ${r.summary} — ${msg}`)], mutated: true };
}

function cmdIntents(ctx: CommandContext): CommandResult {
  const map = vfsToFileMap(ctx.nodes);
  const out: TerminalLine[] = [];
  for (const [path, src] of Object.entries(map)) {
    if (!/\.(t|j)sx$/.test(path)) continue;
    for (const m of src.matchAll(/data-ut-intent=["']([^"']+)["']/g)) out.push(mkLine('output', `${path}: ${m[1]}`));
  }
  return { lines: out.length ? out.slice(0, 200) : [mkLine('output', 'No intents found')] };
}

export interface CommandResult {
  lines: TerminalLine[];
  /** If the command modified state */
  mutated?: boolean;
}

// ============================================================================
// Business system dependency presets
// ============================================================================

const BUSINESS_SYSTEM_DEPS: Record<string, Record<string, string>> = {
  salon: {
    'date-fns': 'latest',
    'react-day-picker': 'latest',
    'recharts': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-select': 'latest',
    '@radix-ui/react-tabs': 'latest',
  },
  restaurant: {
    'recharts': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-tabs': 'latest',
    '@radix-ui/react-accordion': 'latest',
    'framer-motion': 'latest',
  },
  medical: {
    'date-fns': 'latest',
    'react-day-picker': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-select': 'latest',
    '@radix-ui/react-tabs': 'latest',
    '@radix-ui/react-accordion': 'latest',
    'recharts': 'latest',
  },
  ecommerce: {
    'recharts': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-select': 'latest',
    '@radix-ui/react-tabs': 'latest',
    '@radix-ui/react-checkbox': 'latest',
    '@radix-ui/react-slider': 'latest',
    'framer-motion': 'latest',
  },
  saas: {
    'recharts': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-tabs': 'latest',
    '@radix-ui/react-switch': 'latest',
    '@radix-ui/react-tooltip': 'latest',
    '@radix-ui/react-dropdown-menu': 'latest',
    'framer-motion': 'latest',
  },
  fitness: {
    'recharts': 'latest',
    'date-fns': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-tabs': 'latest',
    '@radix-ui/react-progress': 'latest',
    'framer-motion': 'latest',
  },
  realestate: {
    'recharts': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-select': 'latest',
    '@radix-ui/react-slider': 'latest',
    '@radix-ui/react-tabs': 'latest',
    'framer-motion': 'latest',
  },
};

// ============================================================================
// ID generator
// ============================================================================

let lineId = 0;
function mkLine(type: TerminalLine['type'], text: string): TerminalLine {
  return { id: `tl_${++lineId}`, type, text, timestamp: Date.now() };
}

// ============================================================================
// Command Handlers
// ============================================================================

function cmdHelp(): CommandResult {
  return {
    lines: [
      mkLine('system', '┌─ VFS Terminal Commands ─────────────────────────────'),
      mkLine('output', '│  install <pkg[@ver]>    Add dependency to preview'),
      mkLine('output', '│  uninstall <pkg>        Remove dependency'),
      mkLine('output', '│  deps                   List current dependencies'),
      mkLine('output', '│  preset <type>          Install deps for business type'),
      mkLine('output', '│  ls [path]              List files at path'),
      mkLine('output', '│  tree                   Show full file tree'),
      mkLine('output', '│  cat <file>             Show file contents'),
      mkLine('output', '│  write <path> <text>    Write raw text content to file'),
      mkLine('output', '│  writeb64 <path> <b64>  Write base64-decoded content to file'),
    mkLine('output', '│  touch/rm <path>        Create or delete a file'),
    mkLine('output', '│  mv|rename|cp <a> <b>   Move, rename or copy a file'),
    mkLine('output', '│  begin/diff/commit/abort  Stage several changes as one checkpoint'),
    mkLine('output', '│  revision/routes/intents  Saved version, page routes, button intents'),
    mkLine('output', '│  graph / node <address>  Site map; resolve page:/x, section:/x#id, button:/x#label'),
    mkLine('output', '│  probe text "X" | selector h1 | intent id  Check what the preview shows'),
    mkLine('output', '│  section rm|up|down <section:/x#id>  Remove or reorder a section'),
      mkLine('output', '│  find <pattern>         Search files by name'),
      mkLine('output', '│  diagnose               Run VFS diagnostics'),
      mkLine('output', '│  whoami                 Show business system type'),
      mkLine('output', '│  clear                  Clear terminal'),
      mkLine('output', '│  help                   Show this help'),
      mkLine('output', '│  …or just type what you want in plain English'),
      mkLine('system', '└───────────────────────────────────────────────────────'),
    ],
  };
}

function normalizeWritablePath(rawPath: string): string | null {
  if (!rawPath || /\s/.test(rawPath)) return null;
  const normalized = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  // Block path traversal and suspicious segments.
  if (normalized.includes('..') || normalized.includes('\\')) {
    return null;
  }

  return normalized;
}

function cmdWrite(args: string[], ctx: CommandContext): CommandResult {
  if (args.length < 2) {
    return { lines: [mkLine('error', 'Usage: write <filepath> <content>')] };
  }

  const normalizedPath = normalizeWritablePath(args[0]);
  if (!normalizedPath) {
    return { lines: [mkLine('error', `Invalid filepath: ${args[0]}`)] };
  }

  const content = args.slice(1).join(' ');
  const exists = readFile(ctx, normalizedPath) !== undefined;
  const msg = submitOps([{ type: exists ? 'replace' : 'create', path: normalizedPath, contents: content }], `Terminal: write ${normalizedPath}`, ctx);

  return {
    lines: [
      mkLine('success', `✓ ${content.length} bytes to ${normalizedPath} — ${msg}`),
    ],
    mutated: true,
  };
}

function cmdWriteB64(args: string[], ctx: CommandContext): CommandResult {
  if (args.length < 2) {
    return { lines: [mkLine('error', 'Usage: writeb64 <filepath> <base64_content>')] };
  }

  const normalizedPath = normalizeWritablePath(args[0]);
  if (!normalizedPath) {
    return { lines: [mkLine('error', `Invalid filepath: ${args[0]}`)] };
  }

  const payload = args.slice(1).join('');
  try {
    const content = decodeURIComponent(escape(atob(payload)));
    const exists = readFile(ctx, normalizedPath) !== undefined;
    const msg = submitOps([{ type: exists ? 'replace' : 'create', path: normalizedPath, contents: content }], `Terminal: writeb64 ${normalizedPath}`, ctx);
    return {
      lines: [
        mkLine('success', `✓ ${content.length} bytes to ${normalizedPath} (base64) — ${msg}`),
      ],
      mutated: true,
    };
  } catch {
    return { lines: [mkLine('error', 'Invalid base64 payload for writeb64')] };
  }
}

function cmdInstall(args: string[], ctx: CommandContext): CommandResult {
  if (args.length === 0) {
    return { lines: [mkLine('error', 'Usage: install <package[@version]> [package2...]')] };
  }

  const lines: TerminalLine[] = [];
  let mutated = false;

  for (const raw of args) {
    const atIdx = raw.lastIndexOf('@');
    let pkg: string, version: string;

    if (atIdx > 0) {
      pkg = raw.slice(0, atIdx);
      version = raw.slice(atIdx + 1);
    } else {
      pkg = raw;
      version = 'latest';
    }

    if (ctx.currentDeps[pkg]) {
      lines.push(mkLine('warn', `⚠ ${pkg} already installed (${ctx.currentDeps[pkg]})`));
      continue;
    }

    ctx.onAddDep(pkg, version);
    lines.push(mkLine('success', `✓ ${pkg}@${version} added to dependencies`));
    mutated = true;
  }

  if (mutated) {
    lines.push(mkLine('system', '↻ Preview will reload with new dependencies'));
    ctx.onRefreshPreview?.();
  }

  return { lines, mutated };
}

function cmdUninstall(args: string[], ctx: CommandContext): CommandResult {
  if (args.length === 0) {
    return { lines: [mkLine('error', 'Usage: uninstall <package> [package2...]')] };
  }

  const lines: TerminalLine[] = [];
  let mutated = false;

  for (const pkg of args) {
    if (!ctx.currentDeps[pkg]) {
      lines.push(mkLine('warn', `⚠ ${pkg} is not installed`));
      continue;
    }

    // Protect core deps
    const coreDeps = ['react', 'react-dom', 'react-router-dom'];
    if (coreDeps.includes(pkg)) {
      lines.push(mkLine('error', `✗ Cannot remove core dependency: ${pkg}`));
      continue;
    }

    ctx.onRemoveDep(pkg);
    lines.push(mkLine('success', `✓ ${pkg} removed`));
    mutated = true;
  }

  if (mutated) {
    lines.push(mkLine('system', '↻ Preview will reload'));
    ctx.onRefreshPreview?.();
  }

  return { lines, mutated };
}

function cmdDeps(ctx: CommandContext): CommandResult {
  const sorted = Object.entries(ctx.currentDeps).sort(([a], [b]) => a.localeCompare(b));

  if (sorted.length === 0) {
    return { lines: [mkLine('output', 'No dependencies installed')] };
  }

  const lines: TerminalLine[] = [
    mkLine('system', `── Dependencies (${sorted.length}) ──`),
  ];

  for (const [pkg, ver] of sorted) {
    lines.push(mkLine('output', `  ${pkg} ${ver}`));
  }

  return { lines };
}

function cmdPreset(args: string[], ctx: CommandContext): CommandResult {
  const type = args[0]?.toLowerCase();
  const available = Object.keys(BUSINESS_SYSTEM_DEPS);

  if (!type || !BUSINESS_SYSTEM_DEPS[type]) {
    return {
      lines: [
        mkLine('error', `Usage: preset <type>`),
        mkLine('output', `Available: ${available.join(', ')}`),
      ],
    };
  }

  const preset = BUSINESS_SYSTEM_DEPS[type];
  const lines: TerminalLine[] = [
    mkLine('system', `Installing ${type} preset dependencies...`),
  ];
  let count = 0;

  for (const [pkg, ver] of Object.entries(preset)) {
    if (!ctx.currentDeps[pkg]) {
      ctx.onAddDep(pkg, ver);
      lines.push(mkLine('success', `  ✓ ${pkg}@${ver}`));
      count++;
    } else {
      lines.push(mkLine('output', `  ─ ${pkg} (already present)`));
    }
  }

  lines.push(mkLine('system', `${count} new dependencies added for "${type}" system`));
  if (count > 0) ctx.onRefreshPreview?.();

  return { lines, mutated: count > 0 };
}

function cmdLs(args: string[], ctx: CommandContext): CommandResult {
  const targetPath = args[0] || '/src';
  const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;

  const children = ctx.nodes.filter(n => {
    const parentPath = n.path?.replace(/\/[^/]+$/, '') || '';
    return parentPath === normalizedTarget || (normalizedTarget === '/' && !n.parentId);
  });

  if (children.length === 0) {
    return { lines: [mkLine('warn', `No entries at ${normalizedTarget}`)] };
  }

  const lines: TerminalLine[] = [mkLine('system', `── ${normalizedTarget} ──`)];

  // Folders first, then files
  const folders = children.filter((n): n is VirtualFolder => n.type === 'folder').sort((a, b) => a.name.localeCompare(b.name));
  const files = children.filter((n): n is VirtualFile => n.type === 'file').sort((a, b) => a.name.localeCompare(b.name));

  for (const f of folders) {
    lines.push(mkLine('output', `  📁 ${f.name}/`));
  }
  for (const f of files) {
    const size = f.content?.length ?? 0;
    const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}K` : `${size}B`;
    lines.push(mkLine('output', `  📄 ${f.name}  (${sizeStr})`));
  }

  lines.push(mkLine('system', `${folders.length} folders, ${files.length} files`));
  return { lines };
}

function cmdTree(ctx: CommandContext): CommandResult {
  const allPaths = getFilePaths(ctx.nodes).sort();
  if (allPaths.length === 0) {
    return { lines: [mkLine('warn', 'VFS is empty')] };
  }

  const lines: TerminalLine[] = [mkLine('system', `── File Tree (${allPaths.length} files) ──`)];

  for (const p of allPaths) {
    const depth = (p.match(/\//g) || []).length - 1;
    const indent = '  '.repeat(Math.max(0, depth));
    const name = p.split('/').pop() || p;
    lines.push(mkLine('output', `${indent}${name}`));
  }

  return { lines };
}

function cmdCat(args: string[], ctx: CommandContext): CommandResult {
  if (args.length === 0) {
    return { lines: [mkLine('error', 'Usage: cat <filepath>')] };
  }

  let filePath = args[0];
  if (!filePath.startsWith('/')) filePath = `/${filePath}`;

  const fileMap = vfsToFileMap(ctx.nodes);
  // Try exact match, then with /src prefix
  let content = fileMap[filePath] ?? fileMap[`/src${filePath}`];

  // Fuzzy match: find files ending with the given path
  if (content === undefined) {
    const match = Object.entries(fileMap).find(([p]) => p.endsWith(filePath) || p.endsWith(args[0]));
    if (match) content = match[1];
  }

  if (content === undefined) {
    return { lines: [mkLine('error', `File not found: ${filePath}`)] };
  }

  const preview = content.length > 2000
    ? content.slice(0, 2000) + `\n... (truncated, ${content.length} chars total)`
    : content;

  return {
    lines: [
      mkLine('system', `── ${filePath} ──`),
      ...preview.split('\n').map(line => mkLine('output', line)),
    ],
  };
}

function cmdFind(args: string[], ctx: CommandContext): CommandResult {
  if (args.length === 0) {
    return { lines: [mkLine('error', 'Usage: find <pattern>')] };
  }

  const pattern = args[0].toLowerCase();
  const allPaths = getFilePaths(ctx.nodes);
  const matches = allPaths.filter(p => p.toLowerCase().includes(pattern));

  if (matches.length === 0) {
    return { lines: [mkLine('warn', `No files matching "${pattern}"`)] };
  }

  return {
    lines: [
      mkLine('system', `── ${matches.length} matches for "${pattern}" ──`),
      ...matches.map(p => mkLine('output', `  ${p}`)),
    ],
  };
}

function cmdDiagnose(ctx: CommandContext): CommandResult {
  const fileMap = vfsToFileMap(ctx.nodes);
  const allPaths = new Set(Object.keys(fileMap));
  const lines: TerminalLine[] = [mkLine('system', '── VFS Diagnostics ──')];

  let issues = 0;

  // Check for broken relative imports
  const importRegex = /(?:import|from)\s+['"](\.\/.+?|\.\.\/.*?)['"];?/g;

  const executableSourceEntries = Object.entries(fileMap).filter(([filePath]) =>
    /\.(?:[cm]?[jt]sx?)$/i.test(filePath),
  );

  // Canonical /.unison/*.json files are serialized metadata. They contain
  // copies of TSX source strings, so scanning them as modules reports every
  // quoted `from "./..."` inside the JSON as an import owned by the sidecar.
  // Only executable source files participate in module resolution.
  for (const [filePath, content] of executableSourceEntries) {
    let match: RegExpExecArray | null;
    const fileDir = filePath.replace(/\/[^/]+$/, '');
    importRegex.lastIndex = 0;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Resolve relative path
      let resolved: string;
      if (importPath.startsWith('./')) {
        resolved = `${fileDir}/${importPath.slice(2)}`;
      } else if (importPath.startsWith('../')) {
        const parentDir = fileDir.replace(/\/[^/]+$/, '');
        resolved = `${parentDir}/${importPath.slice(3)}`;
      } else {
        continue;
      }

      // Check with common extensions
      const extensions = ['', '.tsx', '.ts', '.jsx', '.js', '.css', '/index.tsx', '/index.ts'];
      const found = extensions.some(ext => allPaths.has(resolved + ext));

      if (!found) {
        lines.push(mkLine('error', `  ✗ Broken import: ${importPath} in ${filePath}`));
        issues++;
      }
    }
  }

  // Check for missing entry file
  const hasEntry = allPaths.has('/src/App.tsx') || allPaths.has('/src/App.jsx') || allPaths.has('/src/main.tsx');
  if (!hasEntry) {
    lines.push(mkLine('error', '  ✗ Missing entry file (App.tsx or main.tsx)'));
    issues++;
  }

  // Check for empty files
  for (const [path, content] of Object.entries(fileMap)) {
    if (content.trim().length === 0) {
      lines.push(mkLine('warn', `  ⚠ Empty file: ${path}`));
      issues++;
    }
  }

  if (issues === 0) {
    lines.push(mkLine('success', '  ✓ No issues found'));
  } else {
    lines.push(mkLine('system', `── ${issues} issue${issues !== 1 ? 's' : ''} found ──`));
  }

  return { lines };
}

function cmdWhoami(ctx: CommandContext): CommandResult {
  return {
    lines: [
      mkLine('output', `Business type: ${ctx.businessType || 'not set'}`),
      mkLine('output', `Files: ${getFilePaths(ctx.nodes).length}`),
      mkLine('output', `Custom deps: ${Object.keys(ctx.currentDeps).length}`),
    ],
  };
}

// ============================================================================
// Main command processor
// ============================================================================

export function processCommand(input: string, ctx: CommandContext): CommandResult {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
    case '?':
      return cmdHelp();
    case 'install':
    case 'add':
    case 'i':
      return cmdInstall(args, ctx);
    case 'uninstall':
    case 'remove':
      return cmdUninstall(args, ctx);
    case 'rm':
      // Paths delete files; bare package names keep the legacy uninstall alias.
      return args[0] && (args[0].includes('/') || args[0].includes('.')) && !args[0].startsWith('@')
        ? cmdRm(args, ctx)
        : cmdUninstall(args, ctx);
    case 'touch':
      return cmdTouch(args, ctx);
    case 'mv':
    case 'rename':
      return cmdCopyOrMove(args, ctx, true);
    case 'cp':
      return cmdCopyOrMove(args, ctx, false);
    case 'begin':
      return cmdBegin();
    case 'diff':
      return cmdDiff(ctx);
    case 'commit':
      return cmdCommitStaged(ctx);
    case 'abort':
      return cmdAbort();
    case 'revision':
    case 'rev':
      return cmdRevision(ctx);
    case 'routes':
      return cmdRoutes(ctx);
    case 'intents':
      return cmdIntents(ctx);
    case 'graph':
      return cmdGraph(ctx);
    case 'node':
      return cmdNode(args, ctx);
    case 'section':
      return cmdSection(args, ctx);
    case 'page':
      return cmdPage(args, ctx);
    case 'deps':
    case 'dependencies':
    case 'packages':
      return cmdDeps(ctx);
    case 'preset':
    case 'bootstrap':
      return cmdPreset(args, ctx);
    case 'ls':
    case 'dir':
      return cmdLs(args, ctx);
    case 'tree':
      return cmdTree(ctx);
    case 'cat':
    case 'type':
    case 'show':
      return cmdCat(args, ctx);
    case 'write':
      return cmdWrite(args, ctx);
    case 'writeb64':
    case 'apply':
      return cmdWriteB64(args, ctx);
    case 'find':
    case 'search':
    case 'grep':
      return cmdFind(args, ctx);
    case 'diagnose':
    case 'diag':
    case 'doctor':
      return cmdDiagnose(ctx);
    case 'whoami':
    case 'status':
      return cmdWhoami(ctx);
    case 'clear':
    case 'cls':
      return { lines: [mkLine('system', '__CLEAR__')] };
    default: {
      // Natural-language fallback: local patterns first (instant, free).
      const nl = matchNaturalLanguage(trimmed, vfsToFileMap(ctx.nodes));
      if (nl) {
        if (nl.mutating) {
          // Changes ask before running; the UI turns __CONFIRM__ into a prompt.
          return { lines: [mkLine('system', `__CONFIRM__${nl.command}`), mkLine('output', nl.label)] };
        }
        return processCommand(nl.command, ctx);
      }
      // No local match: hand the phrase to the AI Builder (one canonical agent).
      if (looksLikeNaturalLanguage(trimmed)) {
        return { lines: [mkLine('system', `__AI__${trimmed}`)] };
      }
      return {
        lines: [
          mkLine('error', `Unknown command: ${cmd}`),
          mkLine('output', 'Type "help" for available commands'),
        ],
      };
    }
  }
}

/** Parse an AI-generated command string (may contain multiple lines) */
export function parseAICommands(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));
}

/**
 * Execute a terminal command for AI integration
 * Wrapper around processCommand that handles both strings and parsed commands
 */
export async function executeTerminalCommand(
  input: string,
  ctx: CommandContext
): Promise<CommandResult> {
  const probe = /^\s*probe\b(.*)$/.exec(input);
  if (probe) {
    const tokens = probe[1].match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const checks = parseProbeArgs(tokens);
    if (!checks.length) return { lines: [mkLine('error', 'Usage: probe text "Book now" [selector h1] [intent nav.goto]')] };
    const report = await runPreviewProbe(checks);
    return { lines: formatProbeReport(report).map((l, i) => mkLine(i === 0 ? 'system' : l.startsWith('✓') ? 'success' : l.startsWith('✗') ? 'error' : 'output', l)) };
  }
  return processCommand(input, ctx);
}

/**
 * Get structured diagnostic information for AI
 * Provides machine-readable output about VFS state, dependencies, and issues
 */
export function getDiagnosticsForAI(ctx: CommandContext): Record<string, unknown> {
  const fileMap = vfsToFileMap(ctx.nodes);
  const files = getFilePaths(ctx.nodes);

  // Analyze imports and dependencies
  const importIssues: string[] = [];
  const tsFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

  tsFiles.forEach(file => {
    const content = fileMap[file] || '';
    // Basic import validation
    const importMatches: string[] = content.match(/from ['"]([^'"]+)['"]/g) ?? [];
    importMatches.forEach(importStr => {
      const moduleName = importStr.match(/from ['"]([^'"]+)['"]/)?.[1];
      if (moduleName && !moduleName.startsWith('.') && !moduleName.startsWith('/')) {
        const packageRoot = moduleName.startsWith('@')
          ? moduleName.split('/').slice(0, 2).join('/')
          : moduleName.split('/')[0];
        if (!ctx.currentDeps[packageRoot]) {
          importIssues.push(`${file}: Missing dependency "${moduleName}"`);
        }
      }
    });
  });

  return {
    vfs: {
      fileCount: files.length,
      files: files,
      totalSize: files.reduce((sum, f) => sum + (fileMap[f]?.length || 0), 0),
    },
    dependencies: {
      count: Object.keys(ctx.currentDeps).length,
      packages: ctx.currentDeps,
    },
    issues: {
      importIssues: importIssues,
      missingFiles: [],
      count: importIssues.length,
    },
  };
}
