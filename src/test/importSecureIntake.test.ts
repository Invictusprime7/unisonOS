import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  ImportIntakeError,
  intakeLooseFiles,
  intakeZipArchive,
  sha256Hex,
  verifyIntakeHashParity,
} from '@/services/import/secureIntake';

const enc = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 1, 2, 3, 255, 254]);

async function zipOf(entries: Record<string, string | Uint8Array>, options: { compression?: 'STORE' | 'DEFLATE' } = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array', compression: options.compression ?? 'DEFLATE' });
}

async function rejection(promise: Promise<unknown>): Promise<ImportIntakeError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ImportIntakeError);
    return error as ImportIntakeError;
  }
  throw new Error('expected the import to be refused');
}

describe('secure import intake', () => {
  it('keeps every source and asset byte identical and strips only the project wrapper folder', async () => {
    const css = '\uFEFF@import "tailwindcss";\r\n:root { --brand: oklch(0.7 0.1 30); }\r\n';
    const bytes = await zipOf({
      'aria/package.json': '{"name":"aria"}\n',
      'aria/src/styles.css': css,
      'aria/public/hero.png': PNG,
      'aria/src/routes/index.tsx': 'export default function Index() { return <h1>ARIA</h1>; }',
    });
    const result = await intakeZipArchive(bytes, { name: 'aria.zip' });
    expect(result.manifest.strippedPrefix).toBe('aria/');
    expect(result.manifest.files.map((f) => f.path)).toEqual(['package.json', 'public/hero.png', 'src/routes/index.tsx', 'src/styles.css']);
    expect(result.textFiles['src/styles.css']).toBe(css);
    expect(result.binaryFiles['public/hero.png']).toEqual(PNG);
    const png = result.manifest.files.find((f) => f.path === 'public/hero.png')!;
    expect(png).toMatchObject({ storage: 'binary', kind: 'image', mime: 'image/png', sha256: await sha256Hex(PNG) });
    expect(result.manifest.archiveSha256).toBe(await sha256Hex(bytes));
    expect(await verifyIntakeHashParity(result)).toEqual({ ok: true, mismatches: [] });
    expect(Object.isFrozen(result.manifest.files)).toBe(true);
  });

  it('never strips meaningful folders when no project root marker is shared', async () => {
    const result = await intakeZipArchive(await zipOf({ 'src/App.tsx': 'export default 1;', 'src/main.tsx': 'import "./App";' }));
    expect(result.manifest.strippedPrefix).toBe('');
    expect(Object.keys(result.textFiles).sort()).toEqual(['src/App.tsx', 'src/main.tsx']);
  });

  it('refuses archives that write outside the project', async () => {
    const traversal = await rejection(intakeZipArchive(await zipOf({ '../escape.txt': 'x', 'ok.txt': 'y' })));
    expect(traversal.code).toBe('path-traversal');
    const absolute = await rejection(intakeZipArchive(await zipOf({ '/etc/passwd': 'x' })));
    expect(['absolute-path', 'path-traversal']).toContain(absolute.code);
  });

  it('refuses links pointing outside the project root', async () => {
    const zip = new JSZip();
    zip.file('site/package.json', '{}');
    zip.file('site/link', '../../etc/passwd', { unixPermissions: 0o120777 });
    const bytes = await zip.generateAsync({ type: 'uint8array', platform: 'UNIX' });
    expect((await rejection(intakeZipArchive(bytes))).code).toBe('symlink-escape');
  });

  it('refuses repeated and case-colliding paths', async () => {
    const base = await zipOf({ 'a.txt': 'first', 'b.txt': 'second' }, { compression: 'STORE' });
    // Rename every occurrence of b.txt to a.txt in both local and central headers.
    const dup = base.slice();
    const needle = enc('b.txt');
    for (let i = 0; i <= dup.length - needle.length; i++) {
      if (needle.every((v, j) => dup[i + j] === v)) dup[i] = 'a'.charCodeAt(0);
    }
    expect((await rejection(intakeZipArchive(dup))).code).toBe('duplicate-path');
    const cased = await zipOf({ 'README.md': 'a', 'Readme.md': 'b' });
    expect((await rejection(intakeZipArchive(cased))).code).toBe('case-collision');
  });

  it('stops on credentials without echoing their value', async () => {
    const key = `sk_live_${'4'.repeat(28)}`;
    const error = await rejection(intakeZipArchive(await zipOf({ 'package.json': '{}', 'src/pay.ts': `const k = "${key}";` })));
    expect(error.code).toBe('secret-detected');
    expect(error.message).toContain('src/pay.ts:1');
    expect(error.message).not.toContain(key);
    expect(JSON.stringify(error.findings)).not.toContain(key);
  });

  it('keeps variable names from .env files but never their values', async () => {
    const result = await intakeZipArchive(await zipOf({
      'package.json': '{}',
      '.env': 'VITE_SITE_URL=https://example.test\nexport SECRET_TOKEN=abc\n',
      '.env.example': 'VITE_SITE_URL=\n',
      'node_modules/react/index.js': 'module.exports = {}',
      '.git/HEAD': 'ref: refs/heads/main',
      'dist/index.html': '<html></html>',
      '.DS_Store': 'junk',
      'tools/run.exe': new Uint8Array([0x4d, 0x5a, 0x90, 0]),
    }));
    expect(result.manifest.envNames).toEqual(['SECRET_TOKEN', 'VITE_SITE_URL']);
    expect(JSON.stringify(result.manifest)).not.toContain('example.test');
    expect(Object.keys(result.textFiles).sort()).toEqual(['.env.example', 'package.json']);
    const reasons = Object.fromEntries(result.manifest.excluded.map((e) => [e.path, e.reason]));
    expect(reasons).toMatchObject({
      '.env': 'env-values',
      'node_modules/react/index.js': 'dependency-folder',
      '.git/HEAD': 'repository-metadata',
      'dist/index.html': 'generated-output',
      '.DS_Store': 'os-junk',
      'tools/run.exe': 'blocked-executable',
    });
  });

  it('accepts a project zipped together with its node_modules: dependency files never count toward the file limit', async () => {
    const entries: Record<string, string> = {
      'site/package.json': '{"name":"site","dependencies":{"react":"19.0.0"}}',
      'site/index.html': '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
      'site/src/main.tsx': 'export {};',
    };
    for (let i = 0; i < 260; i += 1) entries[`site/node_modules/pkg-${i}/index.js`] = `module.exports = ${i};`;
    const result = await intakeZipArchive(await zipOf(entries), { limits: { maxFiles: 10 } });
    expect(Object.keys(result.textFiles).sort()).toEqual(['index.html', 'package.json', 'src/main.tsx']);
    const deps = result.manifest.excluded.filter((e) => e.reason === 'dependency-folder');
    expect(deps).toHaveLength(101);
    expect(deps.filter((e) => e.detail)).toEqual([{ path: 'site/node_modules/', reason: 'dependency-folder', detail: '160 more files in this folder not imported.' }]);
    const tooMany = await rejection(intakeZipArchive(await zipOf(entries), { limits: { maxFiles: 2 } }));
    expect(tooMany.code).toBe('too-many-files');
    const listed = await rejection(intakeZipArchive(await zipOf(entries), { limits: { maxArchiveEntries: 100 } }));
    expect(listed.code).toBe('too-many-files');
  });

  it('refuses an archive holding only dependency folders', async () => {
    const error = await rejection(intakeZipArchive(await zipOf({ 'node_modules/react/index.js': 'x' })));
    expect(error.code).toBe('empty');
  });

  it('refuses archives that expand far beyond their compressed size', async () => {
    const bomb = await zipOf({ 'zeros.txt': new Uint8Array(2 * 1024 * 1024) });
    const error = await rejection(intakeZipArchive(bomb, { limits: { ratioFloorBytes: 1024, maxCompressionRatio: 50 } }));
    expect(error.code).toBe('compression-ratio');
    const big = await rejection(intakeZipArchive(await zipOf({ 'a.txt': 'x'.repeat(100) }), { limits: { maxFileBytes: 10 } }));
    expect(big.code).toBe('file-too-large');
  });

  it('treats a picked folder like an archive with the same wrapper rule', async () => {
    const result = await intakeLooseFiles([
      { path: 'site/package.json', bytes: enc('{}') },
      { path: 'site/src/main.tsx', bytes: enc('console.log(1)') },
      { path: 'site/src/logo.png', bytes: PNG },
    ]);
    expect(result.manifest.inputKind).toBe('files');
    expect(result.manifest.strippedPrefix).toBe('site/');
    expect(result.manifest.files.map((f) => f.path)).toEqual(['package.json', 'src/logo.png', 'src/main.tsx']);
    const single = await intakeLooseFiles([{ path: 'src/Hero.tsx', bytes: enc('export const Hero = 1;') }]);
    expect(single.manifest.files.map((f) => f.path)).toEqual(['src/Hero.tsx']);
  });
});
