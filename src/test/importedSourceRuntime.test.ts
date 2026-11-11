import { describe, expect, it, vi } from 'vitest';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject, ISOLATED_SOURCE_PREVIEW_ADAPTER, resolveImportPreviewAdapter } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs, findUnresolvedImports } from '@/services/import/importedSourceAcceptance';
import { isImportedSourceVfs, readImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { startImportedPreviewSession } from '@/services/import/importedPreviewSession';
import { normalizeLauncherFiles } from '@/utils/sandpackFilePrep';
import { prepareSavedVfsRuntime } from '@/services/savedVfsRuntime';

const enc = (s: string) => new TextEncoder().encode(s);

async function ariaLike() {
  const intake = await intakeLooseFiles([
    { path: 'aria/package.json', bytes: enc(JSON.stringify({ name: 'aria-studios', scripts: { dev: 'vite --host 0.0.0.0' }, dependencies: { '@tanstack/react-start': '^1.120.0', '@tanstack/react-router': '^1.120.0', react: '^19.0.0' }, devDependencies: { '@tailwindcss/vite': '^4.1.0', tailwindcss: '^4.1.0', vite: '^6.0.0' } })) },
    { path: 'aria/bun.lock', bytes: enc('{}') },
    { path: 'aria/tsconfig.json', bytes: enc('{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } }, // comment\n}') },
    { path: 'aria/src/styles.css', bytes: enc('@import "tailwindcss";\n@theme { --font-display: "Fraunces", serif; }\n') },
    { path: 'aria/src/routes/__root.tsx', bytes: enc("import '../styles.css';\nimport { Nav } from '@/components/Nav';\n") },
    { path: 'aria/src/routes/index.tsx', bytes: enc("import { Missing } from './missing';\nexport const Route = 1;") },
    { path: 'aria/src/routes/work.$slug.tsx', bytes: enc('export const Route = 1;') },
    { path: 'aria/src/routes/api/contact.ts', bytes: enc('export const Route = createServerFileRoute("/api/contact");') },
    { path: 'aria/src/components/Nav.tsx', bytes: enc('export const Nav = () => null; const u = import.meta.env.VITE_SITE_URL;') },
    { path: 'aria/.unison/creative-brief.json', bytes: enc('{"projectName":"ARIA Studios","industry":"agency","pages":["home","work"]}') },
  ]);
  const profile = analyzeImportedProject(intake);
  const { files } = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' });
  return { intake, profile, files };
}

describe('imported-source compatibility profile', () => {
  it('detects a TanStack Start + Tailwind 4 project with its Unison brief and blocks the unsupported runtime honestly', async () => {
    const { profile, files } = await ariaLike();
    expect(profile.framework).toBe('tanstack-start');
    expect(profile.packageManager).toBe('bun');
    expect(profile.toolchain.tailwind).toBe('4');
    expect(profile.aliases['@/*']).toBe('src/*');
    expect(profile.routing.system).toBe('tanstack-file-routes');
    expect(profile.routing.routes.filter((r) => r.kind === 'page').map((r) => r.path)).toEqual(['/', '/work/:slug']);
    expect(profile.routing.routes.find((r) => r.file.endsWith('api/contact.ts'))?.kind).toBe('server');
    expect(profile.styles.fontFamilies).toContain('Fraunces');
    expect(profile.envNames).toContain('VITE_SITE_URL');
    expect(profile.unisonBrief).toMatchObject({ projectName: 'ARIA Studios', industry: 'agency', pages: ['home', 'work'] });
    expect(profile.previewAdapter.status).toBe('unavailable');
    expect(profile.previewAdapter.requires.join(' ')).toMatch(/TanStack Start/);
    expect(resolveImportPreviewAdapter(profile, files).adapter).toBe(ISOLATED_SOURCE_PREVIEW_ADAPTER);
  });

  it('reports unresolved local imports and resolves tsconfig aliases', async () => {
    const { files, profile } = await ariaLike();
    const unresolved = findUnresolvedImports({ files, binaryPaths: new Set(), checkPaths: Object.keys(files), aliases: profile.aliases });
    expect(unresolved).toEqual([{ file: '/src/routes/index.tsx', specifier: './missing' }]);
  });
});

describe('imported projects bypass Unison runtime scaffolding', () => {
  it('never synthesizes entry, CSS or platform modules over imported source', async () => {
    const { files } = await ariaLike();
    expect(isImportedSourceVfs(files)).toBe(true);
    expect(readImportedSourceRecords(files)?.provenance.readiness.publishReady).toBe(false);
    expect(normalizeLauncherFiles(files, { entryPoint: '/src/App.tsx', injectCssIfMissing: true })).toEqual(files);
    expect(prepareSavedVfsRuntime(files, { projectId: 'p' })).toBe(files);
  });

  it('still scaffolds ordinary Unison drafts', () => {
    const out = normalizeLauncherFiles({ '/src/App.tsx': 'export default function App(){return <div/>}' }, { entryPoint: '/src/App.tsx', injectCssIfMissing: true });
    expect(out['/src/main.tsx']).toBeTruthy();
  });
});

describe('isolated imported preview session', () => {
  it('sends original source bytes and runtime metadata without private import records', async () => {
    const { files } = await ariaLike();
    const records = readImportedSourceRecords(files)!;
    const filesWithEnvironment = { ...files, '/.env.local': 'PRIVATE_TOKEN=never-send' };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      session: { id: 'preview_session_1', iframeUrl: 'https://preview.example.test/session_1', status: 'running' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const session = await startImportedPreviewSession({ projectId: 'project-1', records, files: filesWithEnvironment });
      const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
        files: Record<string, string>;
        importedRuntime: Record<string, unknown>;
      };

      expect(session).toMatchObject({ id: 'preview_session_1', status: 'running' });
      expect(request.files['/vite.config.ts']).toBe(files['/vite.config.ts']);
      expect(request.files['/src/routes/index.tsx']).toBe(files['/src/routes/index.tsx']);
      expect(Object.keys(request.files).some((path) => path.startsWith('/.unison-import/'))).toBe(false);
      expect(request.importedRuntime).toMatchObject({
        protocolVersion: 1,
        framework: 'tanstack-start',
        packageManager: 'bun',
        startScript: 'dev',
      });
      expect(request.files).not.toHaveProperty('/.env.local');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a missing isolated worker instead of falling back to a rewritten preview', async () => {
    const { files } = await ariaLike();
    const records = readImportedSourceRecords(files)!;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: 'Server-side preview is not available in this environment' }), { status: 410 })));
    try {
      await expect(startImportedPreviewSession({ projectId: 'project-1', records, files }))
        .rejects.toThrow('No isolated preview worker is configured in this environment.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
