/**
 * Browser host for the UIMP-01 source build: esbuild-wasm and the Tailwind 4
 * compiler are bundled with Unison (no third-party code runs in the Unison
 * page); the built project itself only ever runs in the sandboxed
 * /import-runtime.html frame.
 */
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';
import { buildImportedSource, type EsbuildLike, type SourceBuildResult, type Tailwind4Compiler } from './sourceBundler';
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
  const [esbuild, tailwind4] = await Promise.all([loadEsbuild(), input.plan.tailwind === '4' ? loadTailwind4() : Promise.resolve(null)]);
  return buildImportedSource({ esbuild, tailwind4, fetchText, ...input });
}
