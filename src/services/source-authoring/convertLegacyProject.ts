/**
 * Convert on open: a site built by the older Unison pipeline becomes a source
 * project. The files are taken from the exact preview the owner already sees
 * (the compiled preview output), so the converted site renders the same; the
 * preview-only selection markers are removed and the project gains the few
 * standalone files (start page, package list) a normal build needs. The save
 * goes through `commitMutation` with `sourceConversion`, parented on the
 * site's last Unison revision so history stays intact.
 */
import { commitMutation, type CommitMutationResult, type CommitIdentity } from '@/services/vfsCommitService';
import { intakeLooseFiles, verifyIntakeHashParity } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { IMPORTED_SOURCE_ACCEPTANCE_PROFILE, isImportedSourceVfs } from '@/services/import/importedSourceRecords';
import { planSourceBuild } from '@/services/import/sourceBuild/sourceBuildPlan';
import type { FileOp, PatchPlan } from '@/types/patchPlan';

const PREVIEW_LOCATOR_ATTR = / data-ut-source-(?:locator|ast|hash|revision)="[^"]*"/g;
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const TAILWIND_CDN = 'https://cdn.tailwindcss.com';

export interface CompiledLegacyPreview {
  sandpackFiles: Record<string, string>;
  dependencies: Record<string, string>;
}

/** Removes the preview-only selection markers the older preview compiler adds. */
export function stripPreviewLocators(source: string): string {
  return source.includes('data-ut-source-') ? source.replace(PREVIEW_LOCATOR_ATTR, '') : source;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'unison-site';
}

const DEFAULT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Site</title>
    <script src="${TAILWIND_CDN}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

/**
 * Standalone React + Vite project from the compiled older preview. Pure: the
 * same preview output always gives the same files.
 */
export function standaloneSourceFromPreview(compiled: CompiledLegacyPreview, projectName: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [rawPath, content] of Object.entries(compiled.sandpackFiles)) {
    if (typeof content !== 'string') continue;
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (path.startsWith('/.unison/') || path.startsWith('/.unison-import/') || path.startsWith('/node_modules/')) continue;
    files[path] = CODE_FILE.test(path) ? stripPreviewLocators(content) : content;
  }

  const entry = ['/index.tsx', '/index.jsx', '/index.ts', '/index.js'].find((candidate) => files[candidate]);
  if (!entry) throw new Error('This site has no start file to convert.');

  let html = files['/index.html'] ?? files['/public/index.html'] ?? DEFAULT_HTML;
  delete files['/public/index.html'];
  html = html.replace(/\s*<script\b[^>]*type=["']module["'][^>]*>\s*<\/script>/gi, '');
  if (!html.includes(TAILWIND_CDN)) html = html.replace(/<\/head>/i, `  <script src="${TAILWIND_CDN}"></script>\n</head>`);
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `  <script type="module" src="${entry}"></script>\n  </body>`)
    : `${html}\n<script type="module" src="${entry}"></script>\n`;
  html = html.replace(/<title>Preview<\/title>/i, `<title>${projectName.replace(/[<>&]/g, '')}</title>`);
  files['/index.html'] = html;

  let existing: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try { existing = files['/package.json'] ? JSON.parse(files['/package.json']) : {}; } catch { existing = {}; }
  files['/package.json'] = `${JSON.stringify({
    name: slug(projectName),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: Object.fromEntries(Object.entries({ ...(existing.dependencies ?? {}), ...compiled.dependencies }).sort(([a], [b]) => a.localeCompare(b))),
    devDependencies: { '@vitejs/plugin-react': '^4.3.4', typescript: '^5.6.3', vite: '^5.4.11', ...(existing.devDependencies ?? {}) },
  }, null, 2)}\n`;

  if (!files['/tsconfig.json']) {
    files['/tsconfig.json'] = `${JSON.stringify({
      compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', strict: false, skipLibCheck: true, isolatedModules: true, resolveJsonModule: true, baseUrl: '.', paths: { '@/*': ['./*'] } },
      include: ['.'],
    }, null, 2)}\n`;
  }
  if (!files['/vite.config.ts']) {
    files['/vite.config.ts'] = [
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import path from 'node:path';",
      '',
      'export default defineConfig({',
      '  plugins: [react()],',
      "  resolve: { alias: { '@': path.resolve(__dirname, '.') } },",
      '});',
      '',
    ].join('\n');
  }
  return files;
}

export interface ConvertLegacyProjectInput {
  identity: CommitIdentity;
  /** The draft's current files (the older site), used as the save base. */
  currentFiles: Record<string, string>;
  compiled: CompiledLegacyPreview;
  projectName: string;
  /** Optional build check, run before anything is saved. */
  buildCheck?: (files: Record<string, string>) => Promise<{ ok: boolean; errors: string[] }>;
}

export class LegacyConversionError extends Error {}

/** Saves the converted project as the site's next version. */
export async function convertLegacyProject(input: ConvertLegacyProjectInput): Promise<CommitMutationResult> {
  if (isImportedSourceVfs(input.currentFiles)) throw new LegacyConversionError('This site is already a source project.');
  if (!input.identity.revisionId) throw new LegacyConversionError('This site has no saved version to convert from.');

  const source = standaloneSourceFromPreview(input.compiled, input.projectName);
  const intake = await intakeLooseFiles(Object.entries(source).map(([path, text]) => ({ path: path.slice(1), bytes: new TextEncoder().encode(text) })), { name: input.projectName });
  const parity = await verifyIntakeHashParity(intake);
  if (!parity.ok) throw new LegacyConversionError(`Some files could not be kept unchanged: ${parity.mismatches.slice(0, 5).join(', ')}`);
  const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
  const plan = planSourceBuild(profile, source);
  if (plan.status !== 'supported') throw new LegacyConversionError(plan.reason ?? 'The converted site is not a shape the preview can build.');
  if (input.buildCheck) {
    const check = await input.buildCheck(source);
    if (!check.ok) throw new LegacyConversionError(`The converted site did not build: ${check.errors.slice(0, 3).join('; ')}`);
  }

  const { files } = buildImportedSourceVfs({
    intake,
    profile,
    assets: { version: 1, assets: [], originalArchive: null },
    importedBy: input.identity.userId,
    importedAt: new Date().toISOString(),
    origin: 'affinity-authored',
    convertedFromRevisionId: input.identity.revisionId,
  });

  const fileOps: FileOp[] = [];
  for (const [path, contents] of Object.entries(files)) {
    fileOps.push(input.currentFiles[path] === undefined
      ? { kind: 'create', path, contents }
      : { kind: 'replace', path, contents });
  }
  for (const path of Object.keys(input.currentFiles)) {
    if (files[path] === undefined) fileOps.push({ kind: 'delete', path });
  }
  const patch: PatchPlan = {
    summary: `Converted ${input.projectName} into an editable source project`,
    fileOps,
    routeOps: [],
    dataOps: [],
    backendOps: [],
    presentationOps: [],
    themeOps: [],
  } as unknown as PatchPlan;

  return commitMutation({
    source: 'system-restore',
    identity: input.identity,
    current: { vfsFiles: input.currentFiles },
    patch,
    options: { acceptanceProfile: IMPORTED_SOURCE_ACCEPTANCE_PROFILE, sourceConversion: true, businessName: input.projectName },
  });
}
