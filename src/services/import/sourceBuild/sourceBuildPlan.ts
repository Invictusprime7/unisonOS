/**
 * UIMP-01 source-build plan. Decides, from the imported files alone, whether
 * the in-browser source build can run this project unchanged, and pins every
 * package to the exact version recorded in the project's lockfile.
 *
 * Pure: no network, no DOM. The plan never edits or rewrites source; it only
 * says which entry the original project boots from and which packages it uses.
 */
import { isImportRecordPath } from '@/services/import/importedSourceRecords';
import type { ImportCompatibilityProfile } from '@/services/import/importCompatibilityProfile';

export const SOURCE_BUILD_ADAPTER = 'browser-source-build-v1';

export type SourceBuildKind = 'vite-html' | 'tanstack-start';

export interface SourceBuildPlan {
  status: 'supported' | 'unsupported';
  reason: string;
  kind: SourceBuildKind | null;
  /** VFS path of index.html (vite-html). */
  htmlTemplate: string | null;
  /** VFS path of the browser entry (vite-html) or router module (tanstack-start). */
  entry: string | null;
  /** Exported router factory in the router module (tanstack-start). */
  routerExport: string | null;
  /** Package name -> exact version (lockfile) or the declared range. */
  packages: Record<string, string>;
  /** Packages whose version came from the declared range, not a lockfile. */
  unpinned: string[];
  tailwind: '3' | '4' | null;
  /** Import alias prefix ('@/') -> VFS directory ('/src/'). */
  aliases: Array<{ find: string; replacement: string }>;
  jsxImportSource: string;
  tsconfigRaw: Record<string, unknown>;
  routesDir: string | null;
}

const TOOLING = /^(@types\/|typescript$|vite$|@vitejs\/|eslint|@eslint\/|typescript-eslint$|globals$|prettier|lovable-tagger$|vitest|@vitest\/|postcss$|autoprefixer$|@tailwindcss\/(vite|postcss)$|vite-tsconfig-paths$|@cloudflare\/vite-plugin$|wrangler$|@tanstack\/router-plugin$|tailwindcss$)/;

function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += text[i + 1] ?? ''; i += 1; } else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i += 1; out += '\n'; continue; }
    if (ch === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1; i += 1; continue; }
    out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonc<T>(text: string | undefined): T | null {
  if (!text) return null;
  try { return JSON.parse(stripJsonComments(text)) as T; } catch { return null; }
}

/** Exact versions from bun.lock, package-lock.json, pnpm-lock.yaml or yarn.lock. */
export function readLockedVersions(files: Record<string, string>, names: string[]): Record<string, string> {
  const locked: Record<string, string> = {};
  const bun = files['/bun.lock'];
  const npm = parseJsonc<{ packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> }>(files['/package-lock.json']);
  const pnpm = files['/pnpm-lock.yaml'];
  const yarn = files['/yarn.lock'];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    let version: string | undefined;
    if (bun) version = new RegExp(`\\n\\s*"${escaped}":\\s*\\["${escaped}@([^"]+)"`).exec(bun)?.[1];
    if (!version && npm) version = npm.packages?.[`node_modules/${name}`]?.version ?? npm.dependencies?.[name]?.version;
    if (!version && pnpm) version = new RegExp(`\\n\\s+'?${escaped}'?:\\s*\\n\\s+specifier:[^\\n]*\\n\\s+version:\\s*([0-9][^\\s(]*)`).exec(pnpm)?.[1];
    if (!version && yarn) version = new RegExp(`\\n"?${escaped}@[^\\n]*:\\n\\s+version:? "?([0-9][^"\\n]*)`).exec(yarn)?.[1];
    if (version && /^\d/.test(version)) locked[name] = version;
  }
  return locked;
}

const unsupported = (reason: string): SourceBuildPlan => ({
  status: 'unsupported', reason, kind: null, htmlTemplate: null, entry: null, routerExport: null,
  packages: {}, unpinned: [], tailwind: null, aliases: [], jsxImportSource: 'react', tsconfigRaw: {}, routesDir: null,
});

export function planSourceBuild(profile: ImportCompatibilityProfile, files: Record<string, string>): SourceBuildPlan {
  const sourceFiles = Object.fromEntries(Object.entries(files).filter(([p]) => !isImportRecordPath(p)));
  const has = (p: string) => Object.prototype.hasOwnProperty.call(sourceFiles, p);
  const declared = { ...profile.devDependencies, ...profile.dependencies };
  if (!has('/package.json')) return unsupported('The project has no package.json, so its packages cannot be resolved.');

  const tsconfigText = sourceFiles['/tsconfig.app.json'] ?? sourceFiles['/tsconfig.json'] ?? sourceFiles['/jsconfig.json'];
  const tsconfig = parseJsonc<{ compilerOptions?: Record<string, unknown> }>(tsconfigText) ?? {};
  const compilerOptions = tsconfig.compilerOptions ?? {};
  const jsxImportSource = typeof compilerOptions.jsxImportSource === 'string' ? compilerOptions.jsxImportSource : 'react';

  const aliases: SourceBuildPlan['aliases'] = [];
  for (const [alias, target] of Object.entries(profile.aliases)) {
    aliases.push({ find: alias.replace(/\*$/, ''), replacement: `/${target.replace(/\*$/, '').replace(/^\/+/, '')}` });
  }
  const viteConfig = Object.entries(sourceFiles).find(([p]) => /^\/vite\.config\.(c|m)?(t|j)s$/.test(p))?.[1] ?? '';
  for (const m of viteConfig.matchAll(/["']([@~#][\w-]*)["']\s*:\s*(?:path\.)?resolve\([^,]*,\s*["']\.?\/?([^"']+)["']\)/g)) {
    const find = `${m[1]}/`;
    if (!aliases.some((a) => a.find === find)) aliases.push({ find, replacement: `/${m[2].replace(/\/$/, '')}/` });
  }
  aliases.sort((a, b) => b.find.length - a.find.length);

  const runtimeNames = Object.keys(declared).filter((name) => !TOOLING.test(name));
  const locked = readLockedVersions(sourceFiles, runtimeNames);
  const packages: Record<string, string> = {};
  const unpinned: string[] = [];
  for (const name of runtimeNames) {
    const range = declared[name];
    if (locked[name]) packages[name] = locked[name];
    else if (/^(workspace:|file:|link:|git|https?:)/.test(range)) return unsupported(`Package ${name} comes from "${range}", which only the project's own install can provide.`);
    else { packages[name] = range.replace(/^[~^]/, ''); unpinned.push(name); }
  }
  if (!packages.react && !packages['react-dom']) return unsupported('Only React projects can run in the source build.');

  const base = {
    packages, unpinned, tailwind: profile.toolchain.tailwind, aliases, jsxImportSource,
    tsconfigRaw: { compilerOptions: { ...compilerOptions, jsx: 'react-jsx', jsxImportSource } },
  };

  if (profile.framework === 'tanstack-start') {
    const routerPath = ['/src/router.tsx', '/src/router.ts', '/app/router.tsx', '/app/router.ts'].find(has) ?? null;
    if (!routerPath) return unsupported('No router module (src/router.tsx) was found for this TanStack Start project.');
    const routerSource = sourceFiles[routerPath];
    const routerExport = /export\s+(?:const|function|async function)\s+(getRouter|createRouter)\b/.exec(routerSource)?.[1]
      ?? (/export\s+(?:const|let)\s+router\b/.test(routerSource) ? 'router' : null);
    if (!routerExport) return unsupported(`${routerPath.slice(1)} does not export getRouter, createRouter or router.`);
    const routesDir = ['/src/routes', '/app/routes'].find((dir) => Object.keys(sourceFiles).some((p) => p.startsWith(`${dir}/`))) ?? null;
    if (!Object.keys(sourceFiles).some((p) => /routeTree\.gen\.(t|j)s$/.test(p))) return unsupported('The generated route tree (routeTree.gen.ts) is missing, so the original page list cannot be loaded.');
    return { ...base, status: 'supported', reason: 'TanStack Start pages run in the browser from the original source; server-only routes and functions stay off.', kind: 'tanstack-start', htmlTemplate: null, entry: routerPath, routerExport, routesDir };
  }

  if (profile.framework === 'vite-react' || profile.framework === 'react-source-only') {
    const htmlTemplate = has('/index.html') ? '/index.html' : null;
    if (!htmlTemplate) return unsupported('The project has no index.html, so there is no page for the app to start from.');
    const entrySrc = /<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i.exec(sourceFiles[htmlTemplate])?.[1];
    if (!entrySrc) return unsupported('index.html has no module script, so the app entry is unknown.');
    const entry = `/${entrySrc.replace(/^\.?\/+/, '')}`;
    if (!has(entry)) return unsupported(`index.html starts ${entry.slice(1)}, which is not in the imported files.`);
    return { ...base, status: 'supported', reason: 'Runs the original Vite + React source in the browser, unchanged, with the exact package versions from the lockfile.', kind: 'vite-html', htmlTemplate, entry, routerExport: null, routesDir: null };
  }

  return unsupported(`${profile.framework} projects need their own server to build and cannot run in the browser source build.`);
}
