/**
 * Tailwind 3 projects keep their own design in tailwind.config: theme colours
 * (`bg-primary`, `border-border`), fonts, container, keyframes and plugins.
 * The preview generates Tailwind 3 styles with Tailwind's browser runtime, so
 * the project's config is bundled here into a small module the frame runs
 * before the project's stylesheets are handed to that runtime. Without it every
 * custom class is missing and an `@apply` of one fails the whole stylesheet.
 */
import type { EsbuildLike, SourceBuildDiagnostic } from './sourceBundler';

/** Plugins Tailwind's browser runtime ships itself (`?plugins=`). */
const FIRST_PARTY: Record<string, string> = {
  '@tailwindcss/forms': 'forms',
  '@tailwindcss/typography': 'typography',
  '@tailwindcss/aspect-ratio': 'aspect-ratio',
  '@tailwindcss/line-clamp': 'line-clamp',
  '@tailwindcss/container-queries': 'container-queries',
};
/** `tailwindcss/*` modules the browser runtime exposes on `window.tailwind`. */
const RUNTIME_EXPORTS: Record<string, string> = {
  plugin: 'plugin', colors: 'colors', defaultTheme: 'defaultTheme', defaultConfig: 'defaultConfig', resolveConfig: 'resolveConfig',
};
const CONFIG_NAMES = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs', 'tailwind.config.mts', 'tailwind.config.cts'];
const NODE_STUBS: Record<string, string> = {
  path: 'const j = (...p) => p.filter(Boolean).join("/").replace(/\\/+/g, "/"); module.exports = { join: j, resolve: j, dirname: (p) => String(p).replace(/\\/[^/]*$/, ""), basename: (p) => String(p).split("/").pop(), sep: "/" };',
  url: 'module.exports = { fileURLToPath: (u) => String(u).replace(/^file:\\/\\//, ""), pathToFileURL: (p) => ({ href: "file://" + p }) };',
};

function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export interface Tailwind3ConfigInput {
  esbuild: EsbuildLike;
  files: Record<string, string>;
  root: string;
  /** Stylesheets that name their config with `@config`, in build order. */
  stylesheets: Array<{ path: string; source: string }>;
  resolveLocal: (specifier: string, importer: string) => string | null;
  versionOf: (name: string) => string | null;
  cdn: string;
}

export interface Tailwind3Config {
  configPath: string;
  /** Script body for a `<script type="module">`; sets `tailwind.config` and then adds the stylesheets. */
  moduleSource: (sheets: string[]) => string;
  /** Import-map entries that hand plugins Tailwind's own runtime helpers. */
  importMap: Record<string, string>;
  /** First-party plugins for the runtime's `?plugins=` list. */
  firstPartyPlugins: string[];
  diagnostics: SourceBuildDiagnostic[];
}

export function findTailwind3ConfigPath(files: Record<string, string>, root: string, stylesheets: Array<{ path: string; source: string }>, resolveLocal: Tailwind3ConfigInput['resolveLocal']): string | null {
  for (const sheet of stylesheets) {
    const ref = /@config\s+["']([^"']+)["']/.exec(sheet.source)?.[1];
    if (!ref) continue;
    const hit = resolveLocal(ref.startsWith('.') || ref.startsWith('/') ? ref : `./${ref}`, sheet.path);
    if (hit && files[hit] !== undefined) return hit;
  }
  for (const name of CONFIG_NAMES) if (files[`${root}/${name}`] !== undefined) return `${root}/${name}`;
  return null;
}

export async function buildTailwind3Config(input: Tailwind3ConfigInput): Promise<Tailwind3Config | null> {
  const { esbuild, files, root, resolveLocal, versionOf, cdn } = input;
  const configPath = findTailwind3ConfigPath(files, root, input.stylesheets, resolveLocal);
  if (!configPath) return null;
  const diagnostics: SourceBuildDiagnostic[] = [];
  const deps = new Map<string, string>();
  const firstParty = new Set<string>();
  const dirname = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/';

  const plugin = {
    name: 'unison-tailwind3-config',
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: any) => {
        const specifier: string = args.path;
        if (args.kind === 'entry-point') return { path: specifier, namespace: 'vfs' };
        const importer = args.namespace === 'vfs' ? args.importer : configPath;
        const local = resolveLocal(specifier, importer);
        if (local) return { path: local, namespace: 'vfs' };
        if (specifier.startsWith('.') || specifier.startsWith('/')) return { path: specifier, namespace: 'tw-empty' };
        const bare = specifier.replace(/^node:/, '');
        if (NODE_STUBS[bare] !== undefined) return { path: bare, namespace: 'tw-node' };
        if (/^(fs|fs\/promises|os|module|process|child_process|crypto|util)$/.test(bare)) return { path: bare, namespace: 'tw-empty' };
        if (specifier === 'tailwindcss' || specifier.startsWith('tailwindcss/')) return { path: specifier, namespace: 'tw-runtime' };
        const name = packageNameOf(specifier);
        if (FIRST_PARTY[name]) { firstParty.add(FIRST_PARTY[name]); return { path: name, namespace: 'tw-first-party' }; }
        const version = versionOf(name);
        if (!version) diagnostics.push({ level: 'warning', code: 'tailwind-plugin-undeclared', message: `tailwind.config uses ${name}, which is not in package.json; its latest version was used.`, path: configPath });
        deps.set(specifier, `${cdn}/${name}${version ? `@${version}` : ''}${specifier.slice(name.length)}?external=tailwindcss&target=es2022`);
        return { path: specifier, namespace: 'tw-dep' };
      });
      build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args: any) => {
        const ext = args.path.split('.').pop() ?? 'js';
        if (ext === 'json') return { contents: files[args.path] ?? '{}', loader: 'json' };
        return { contents: files[args.path] ?? '', loader: /^(ts|mts|cts)$/.test(ext) ? 'ts' : 'js', resolveDir: dirname(args.path) };
      });
      build.onLoad({ filter: /.*/, namespace: 'tw-runtime' }, (args: any) => {
        const sub = String(args.path).slice('tailwindcss/'.length).replace(/\.js$/, '');
        const key = RUNTIME_EXPORTS[sub];
        return { contents: key ? `module.exports = window.tailwind.${key};` : 'module.exports = {};', loader: 'js' };
      });
      build.onLoad({ filter: /.*/, namespace: 'tw-first-party' }, () => ({
        // Used directly or called with options, it stays a no-op: the runtime's own copy applies.
        contents: 'function p() { return p; } module.exports = p;', loader: 'js',
      }));
      build.onLoad({ filter: /.*/, namespace: 'tw-node' }, (args: any) => ({ contents: NODE_STUBS[args.path], loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'tw-empty' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
      build.onLoad({ filter: /.*/, namespace: 'tw-dep' }, (args: any) => ({ contents: `module.exports = globalThis.__unisonTailwindDeps[${JSON.stringify(args.path)}];`, loader: 'js' }));
    },
  };

  let bundled = '';
  try {
    const result = await esbuild.build({
      entryPoints: [configPath],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: '__unisonTailwindConfig',
      platform: 'browser',
      target: 'es2022',
      logLevel: 'silent',
      outdir: '/tw-config',
      define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}', __dirname: JSON.stringify(root || '/'), __filename: JSON.stringify(configPath), 'import.meta.url': JSON.stringify(`file://${configPath}`) },
      plugins: [plugin],
    });
    bundled = result.outputFiles?.find((f) => f.path.endsWith('.js'))?.text ?? '';
  } catch (error) {
    const first = (error as { errors?: Array<{ text: string }> }).errors?.[0]?.text ?? (error instanceof Error ? error.message : String(error));
    return {
      configPath, moduleSource: (sheets) => appendSheets(sheets), importMap: {}, firstPartyPlugins: [],
      diagnostics: [{ level: 'warning', code: 'tailwind3-config-unreadable', message: `${configPath.slice(1)} could not be read (${first}); Tailwind's default theme is used, so custom colours and fonts are missing.`, path: configPath }],
    };
  }

  const importMap: Record<string, string> = {};
  if (deps.size) {
    // Plugins from the package CDN reach Tailwind's helpers through the page's import map.
    for (const [sub, key] of Object.entries(RUNTIME_EXPORTS)) {
      const url = `data:text/javascript,${encodeURIComponent(`export default window.tailwind.${key};`)}`;
      importMap[`tailwindcss/${sub}`] = url;
      importMap[`tailwindcss/${sub}.js`] = url;
    }
  }
  const depList = [...deps.entries()];
  const moduleSource = (sheets: string[]) => [
    `const __pick = (m) => (m && typeof m === 'object' && 'default' in m ? m.default : m);`,
    `const __noop = () => {};`,
    `globalThis.__unisonTailwindDeps = Object.fromEntries(await Promise.all(${JSON.stringify(depList)}.map(([spec, url]) => import(url).then(__pick, (error) => { console.error('[unison] Tailwind plugin ' + spec + ' could not load: ' + (error && error.message || error)); return __noop; }).then((m) => [spec, m]))));`,
    `try {`,
    bundled,
    `  const raw = __unisonTailwindConfig;`,
    `  const config = raw && typeof raw === 'object' && 'default' in raw ? raw.default : raw;`,
    `  window.tailwind.config = config && typeof config === 'object' ? config : {};`,
    `} catch (error) { console.error('[unison] ${configPath.slice(1)} could not run in the preview: ' + (error && error.message || error)); }`,
    appendSheets(sheets),
  ].join('\n');
  return { configPath, moduleSource, importMap, firstPartyPlugins: [...firstParty].sort(), diagnostics };
}

function appendSheets(sheets: string[]): string {
  return `for (const css of ${JSON.stringify(sheets)}) { const el = document.createElement('style'); el.type = 'text/tailwindcss'; el.textContent = css; document.head.appendChild(el); }`;
}
