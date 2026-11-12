import { describe, expect, it } from 'vitest';
import { validateImportedPreviewRequest } from '../../services/import-preview-worker/contract.mjs';

const supabaseUrl = 'https://nfrdomdvyrbwuokathtw.supabase.co';
const validRequest = () => ({
  projectId: '4bf8d56e-cfa2-4c8f-a845-1e83ea74b308',
  files: {
    '/package.json': JSON.stringify({ name: 'aria-studios', scripts: { dev: 'vite --host 0.0.0.0' } }),
    '/vite.config.ts': "import plugin from './mockupPreviewPlugin'; export default { plugins: [plugin()] };",
    '/src/main.tsx': 'export default function App() { return null; }',
    '/.unison-import/provenance.json': '{"origin":"external-import"}',
    '/.env.local': 'PRIVATE_KEY=do-not-forward',
  },
  importedRuntime: {
    protocolVersion: 1,
    framework: 'tanstack-start',
    packageManager: 'bun',
    startScript: 'dev',
    entrypoints: ['src/routes/__root.tsx'],
  },
});

describe('isolated imported preview request contract', () => {
  it('preserves Vite source/config bytes while excluding secrets and import records', () => {
    const request = validateImportedPreviewRequest(validRequest(), { supabaseUrl });
    expect(request.files['/vite.config.ts']).toBe("import plugin from './mockupPreviewPlugin'; export default { plugins: [plugin()] };");
    expect(request.files).not.toHaveProperty('/.env.local');
    expect(Object.keys(request.files).some((path) => path.startsWith('/.unison-import/'))).toBe(false);
    expect(request.importedRuntime.framework).toBe('tanstack-start');
  });

  it('rejects path traversal before any worker is started', () => {
    const request = validRequest();
    request.files['/src/../../etc/passwd'] = 'nope';
    expect(() => validateImportedPreviewRequest(request, { supabaseUrl })).toThrow(/Invalid imported preview file path|Invalid imported preview/);
  });

  it('rejects shell-script selection and unsupported frameworks', () => {
    const scriptRequest = validRequest();
    scriptRequest.importedRuntime.startScript = 'dev && curl attacker';
    expect(() => validateImportedPreviewRequest(scriptRequest, { supabaseUrl })).toThrow(/package manager or script/);

    const frameworkRequest = validRequest();
    frameworkRequest.importedRuntime.framework = 'python-django';
    expect(() => validateImportedPreviewRequest(frameworkRequest, { supabaseUrl })).toThrow(/Unsupported imported preview runtime/);
  });

  it('accepts stored asset links only from the configured Supabase project', () => {
    const request = validRequest();
    request.assets = [{ path: '/public/logo.png', url: `${supabaseUrl}/storage/v1/object/sign/imports/logo.png?token=short`, mime: 'image/png' }];
    expect(validateImportedPreviewRequest(request, { supabaseUrl }).assets).toHaveLength(1);
    request.assets[0].url = 'https://attacker.example/logo.png';
    expect(() => validateImportedPreviewRequest(request, { supabaseUrl })).toThrow(/signed URLs from this Supabase project/);
  });
});