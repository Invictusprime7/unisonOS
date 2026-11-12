/**
 * Browser host for the UIMP-01 source build: esbuild-wasm and the Tailwind 4
 * compiler are bundled with Unison (no third-party code runs in the Unison
 * page). Component compilers fetched at the project's own versions (Vue,
 * Svelte, Solid, Sass, Less) run only in the sandboxed /import-compiler.html
 * frame, and the built project itself only ever runs in the sandboxed
 * /import-runtime.html frame.
 */
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import { buildImportedSource, type ComponentCompiler, type ComponentCompileRequest, type ComponentCompileResult, type EsbuildLike, type SourceBuildResult, type Tailwind4Compiler } from './sourceBundler';
import type { SourceBuildPlan } from './sourceBuildPlan';

let esbuildReady: Promise<EsbuildLike> | null = null;
let tailwindReady: Promise<Tailwind4Compiler> | null = null;

function loadEsbuild(): Promise<EsbuildLike> {
  esbuildReady ??= (async () => {
    const esbuild = await import('esbuild-wasm');
    await esbuild.initialize({ wasmURL: esbuildWasmUrl, worker: true });
    return esbuild as unknown as EsbuildLike;
  })().catch((error) => { esbuildReady = null; throw error; });
  return esbuildReady;
}

function loadTailwind4(): Promise<Tailwind4Compiler> {
  tailwindReady ??= import('tailwindcss-v4')
    .then((mod) => ({ compile: (css, options) => mod.compile(css, options as never) as never }) as Tailwind4Compiler)
    .catch((error) => { tailwindReady = null; throw error; });
  return tailwindReady;
}

let compilerReady: Promise<ComponentCompiler> | null = null;
const COMPILE_TIMEOUT_MS = 90_000;

/** One sealed compiler frame per Unison tab; requests are matched by id. */
function loadCompilerFrame(): Promise<ComponentCompiler> {
  compilerReady ??= new Promise<ComponentCompiler>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.title = 'Imported project compiler';
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none';
    const pending = new Map<number, (result: ComponentCompileResult) => void>();
    let seq = 0;
    const timer = window.setTimeout(() => { compilerReady = null; frame.remove(); reject(new Error('The component compiler did not start.')); }, 30_000);
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow || !event.data) return;
      if (event.data.type === 'unison-compiler-ready') {
        window.clearTimeout(timer);
        resolve({
          compile: (request: ComponentCompileRequest) => new Promise<ComponentCompileResult>((done) => {
            seq += 1;
            const id = seq;
            const timeout = window.setTimeout(() => { pending.delete(id); done({ error: `Compiling ${request.path} took too long.` }); }, COMPILE_TIMEOUT_MS);
            pending.set(id, (result) => { window.clearTimeout(timeout); done(result); });
            frame.contentWindow?.postMessage({ type: 'unison-compile', id, ...request }, '*');
          }),
        });
      } else if (event.data.type === 'unison-compile-result') {
        const done = pending.get(event.data.id);
        if (done) { pending.delete(event.data.id); done(event.data as ComponentCompileResult); }
      }
    });
    frame.src = '/import-compiler.html';
    document.body.appendChild(frame);
  });
  return compilerReady;
}

const textCache = new Map<string, Promise<string>>();
function fetchText(url: string): Promise<string> {
  if (!textCache.has(url)) {
    textCache.set(url, fetch(url, { credentials: 'omit' }).then(async (res) => {
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.text();
    }).catch((error) => { textCache.delete(url); throw error; }));
  }
  return textCache.get(url)!;
}

export async function buildImportedSourceInBrowser(input: {
  plan: SourceBuildPlan;
  files: Record<string, string>;
  assetUrls: Record<string, string>;
  pointerOrigin?: string | null;
}): Promise<SourceBuildResult> {
  const c = input.plan.compilers;
  const needsCompiler = Boolean(c && (c.vue || c.svelte || c.solid || c.sass || c.less));
  const [esbuild, tailwind4, compiler] = await Promise.all([
    loadEsbuild(),
    input.plan.tailwind === '4' ? loadTailwind4() : Promise.resolve(null),
    needsCompiler ? loadCompilerFrame() : Promise.resolve(null),
  ]);
  return buildImportedSource({ esbuild, tailwind4, compiler, fetchText, ...input });
}
