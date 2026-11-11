/**
 * UIMP-01 Phase E helper for build-based imports: runs the real intake and
 * compatibility profile over a project folder, then writes the exact document
 * the Unison source runtime boots (same bundler the browser uses, with native
 * esbuild). Binary files link to <assetBaseUrl>, the same bytes the reference
 * serves.
 *
 *   bun scripts/import-parity/render-source-preview.ts <projectDir> <assetBaseUrl> <out.json> [pointerOrigin]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as esbuild from 'esbuild';
import * as tailwind4 from 'tailwindcss-v4';
import { intakeLooseFiles } from '../../src/services/import/secureIntake';
import { analyzeImportedProject } from '../../src/services/import/importCompatibilityProfile';
import { planSourceBuild } from '../../src/services/import/sourceBuild/sourceBuildPlan';
import { buildImportedSource } from '../../src/services/import/sourceBuild/sourceBundler';

const [dir, assetBase, out, pointerOrigin] = process.argv.slice(2);
if (!dir || !assetBase || !out) throw new Error('usage: <projectDir> <assetBaseUrl> <out.json> [pointerOrigin]');
const SKIP = /^(node_modules|\.git|dist|\.output|\.vinxi|\.wrangler|\.tanstack)$/;
const entries: Array<{ path: string; bytes: Uint8Array }> = [];
const walk = (d: string) => {
  for (const name of readdirSync(d)) {
    if (SKIP.test(name)) continue;
    const abs = join(d, name);
    if (statSync(abs).isDirectory()) { walk(abs); continue; }
    entries.push({ path: relative(dir, abs).split('\\').join('/'), bytes: new Uint8Array(readFileSync(abs)) });
  }
};
walk(dir);
const intake = await intakeLooseFiles(entries, { name: 'fixture' });
const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
const files: Record<string, string> = Object.fromEntries(Object.entries(intake.textFiles).map(([p, t]) => [`/${p}`, t]));
const assetUrls: Record<string, string> = Object.fromEntries(Object.keys(intake.binaryFiles).map((p) => [`/${p}`, `${assetBase.replace(/\/$/, '')}/${p.split('/').map(encodeURIComponent).join('/')}`]));
const plan = planSourceBuild(profile, files);
if (plan.status !== 'supported') { writeFileSync(out, JSON.stringify({ plan })); console.log('unsupported:', plan.reason); process.exit(2); }
const t0 = performance.now();
const result = await buildImportedSource({
  esbuild, plan, files, assetUrls,
  tailwind4: { compile: (css, options) => tailwind4.compile(css, options as never) as never },
  fetchText: async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.text(); },
  pointerOrigin: pointerOrigin ?? null,
});
writeFileSync(out, JSON.stringify({ plan: { kind: plan.kind, entry: plan.entry }, framework: profile.framework, routes: profile.routing.routes, ...result }));
console.log(JSON.stringify({ ok: result.ok, kind: plan.kind, ms: Math.round(performance.now() - t0), bytes: result.bytes, diagnostics: result.diagnostics, adaptations: result.adaptations }, null, 1));
