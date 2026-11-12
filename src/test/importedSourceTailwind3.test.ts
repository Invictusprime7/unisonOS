// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as esbuild from 'esbuild';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { planSourceBuild } from '@/services/import/sourceBuild/sourceBuildPlan';
import { buildImportedSource, tailwind3RuntimeVersion } from '@/services/import/sourceBuild/sourceBundler';

/** Tailwind 3 imports (shadcn/Lovable-style) preview with the project's own tailwind.config. */
const enc = (s: string) => new TextEncoder().encode(s);
const CONFIG = `import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { border: "hsl(var(--border))", primary: { DEFAULT: "hsl(var(--primary))" } }, fontFamily: { sans: ["Inter", ...fontFamily.sans] } } },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;`;

async function documentFor(extra: Record<string, string> = {}, tailwindVersion = '3.4.19') {
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'vite_react_shadcn_ts', dependencies: { react: '18.3.1', 'react-dom': '18.3.1', 'tailwindcss-animate': '1.0.7' }, devDependencies: { tailwindcss: tailwindVersion, vite: '5.4.1', '@tailwindcss/typography': '0.5.15' } }),
    'index.html': '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    'tailwind.config.ts': CONFIG,
    'src/main.tsx': "import { createRoot } from 'react-dom/client';\nimport './index.css';\ncreateRoot(document.getElementById('root')!).render(<h1 className=\"bg-primary\">Hi</h1>);",
    'src/index.css': "@import url('https://fonts.googleapis.com/css2?family=Inter');\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n@layer base { * { @apply border-border; } }",
    ...extra,
  };
  const intake = await intakeLooseFiles(Object.entries(files).map(([path, text]) => ({ path, bytes: enc(text) })));
  const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
  const vfs = Object.fromEntries(Object.entries(intake.textFiles).map(([p, t]) => [`/${p}`, t]));
  const plan = planSourceBuild(profile, vfs);
  return buildImportedSource({ esbuild, plan, files: vfs, assetUrls: {}, fetchText: async () => '' });
}

describe('Tailwind 3 imported projects', () => {
  it('loads a Tailwind runtime that exists for lockfile versions newer than 3.4.17', () => {
    expect(tailwind3RuntimeVersion('3.4.19')).toBe('3.4.17');
    expect(tailwind3RuntimeVersion('3.4.18')).toBe('3.4.17');
    expect(tailwind3RuntimeVersion('3.4.11')).toBe('3.4.11');
    expect(tailwind3RuntimeVersion('3.3.9')).toBe('3.3.7');
    expect(tailwind3RuntimeVersion('3.2.5')).toBe('3.2.6');
    expect(tailwind3RuntimeVersion('^3')).toBe('3.4.17');
  });

  it('runs the project tailwind.config before its stylesheets reach the runtime', async () => {
    const out = await documentFor();
    expect(out.ok).toBe(true);
    expect(out.document).toContain('https://cdn.tailwindcss.com/3.4.17?plugins=typography');
    expect(out.document).not.toContain('cdn.tailwindcss.com/3.4.19');
    expect(out.document).toContain('data-unison-source="/tailwind.config.ts"');
    expect(out.document).toContain('hsl(var(--primary))');
    expect(out.document).toContain('https://esm.sh/tailwindcss-animate@1.0.7?external=tailwindcss');
    // Stylesheets are handed over by the config module, never before it.
    expect(out.document).not.toMatch(/<style type="text\/tailwindcss">/);
    expect(out.importMap.imports['tailwindcss/plugin']).toMatch(/^data:text\/javascript,/);
    // Web fonts stay plain CSS so the browser loads them.
    expect(out.document).toMatch(/<style data-unison-source="tailwind-imports">@import url\('https:\/\/fonts\.googleapis\.com/);
  });

  it('evaluates the config to the project theme', async () => {
    const out = await documentFor();
    const source = /<script type="module" data-unison-source="\/tailwind\.config\.ts">([\s\S]*?)<\/script>/.exec(out.document)![1];
    const win = { tailwind: { config: {}, defaultTheme: { fontFamily: { sans: ['ui-sans-serif'] } }, plugin: () => null } };
    const sheets: string[] = [];
    const doc = { createElement: () => ({}), head: { appendChild: (el: { textContent: string }) => sheets.push(el.textContent) } };
    const animate = () => 'animate';
    const run = new Function('window', 'document', 'globalThis', 'imp', `return (async () => { ${source.replace(/import\(url\)/g, 'imp(url)')} })();`);
    const g: Record<string, unknown> = {};
    await run(win, doc, g, async () => ({ default: animate }));
    const config = win.tailwind.config as { theme: any; plugins: unknown[]; darkMode: unknown };
    expect(config.darkMode).toEqual(['class']);
    expect(config.theme.extend.colors.primary.DEFAULT).toBe('hsl(var(--primary))');
    expect(config.theme.extend.fontFamily.sans).toEqual(['Inter', 'ui-sans-serif']);
    expect(config.plugins[0]).toBe(animate);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toContain('@apply border-border');
    expect(sheets[0]).not.toContain('fonts.googleapis.com');
  });

  it('uses the project\'s exact Tailwind runtime when that release exists', async () => {
    const out = await documentFor({}, '3.4.11');
    expect(out.document).toContain('https://cdn.tailwindcss.com/3.4.11');
  });
});
