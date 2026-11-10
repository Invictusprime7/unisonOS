import { describe, expect, it } from 'vitest';
import { intakeLooseFiles } from '@/services/import/secureIntake';
import { analyzeImportedProject, resolveImportPreviewAdapter } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { buildStaticHtmlPreviewDocument, listStaticHtmlPages, resolveLocalRef } from '@/services/import/staticHtmlPreview';

const enc = (s: string) => new TextEncoder().encode(s);
const decodeDataUrl = (url: string) => new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)));

const INDEX = `<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="css/site.css" rel="stylesheet">
  <link rel="canonical" href="/">
  <style>
    .hero { background: url('img/hero.jpg') center / cover; }
  </style>
</head>
<body>
  <!-- <img src="img/commented.png"> -->
  <nav><a href="about.html">About</a> <a href="#contact">Contact</a> <a href="https://example.com">Out</a></nav>
  <img src="img/logo.png" srcset="img/logo.png 1x, img/logo@2x.png 2x" alt="Logo">
  <img src="img/missing.png" alt="">
  <div style="background-image:url(img/hero.jpg)"></div>
  <script>const card = '<img src="\${item.imageUrl}">';</script>
  <script src="js/app.js" defer></script>
</body>
</html>
`;

const FILES: Record<string, string> = {
  '/index.html': INDEX,
  '/about.html': '<!doctype html><title>About</title><a href="index.html">Home</a>',
  '/css/site.css': "@import 'base.css';\nbody { background: url(../img/hero.jpg); }\n",
  '/css/base.css': 'html { color: #111; }\n',
  '/js/app.js': "document.body.dataset.ready = 'yes';\n",
};
const ASSETS = { '/img/logo.png': 'https://cdn.test/logo.png', '/img/logo@2x.png': 'https://cdn.test/logo2.png', '/img/hero.jpg': 'https://cdn.test/hero.jpg' };

describe('static HTML preview adapter', () => {
  it('keeps every byte outside resolved local references', () => {
    const doc = buildStaticHtmlPreviewDocument({ files: FILES, entryPath: '/index.html', assetUrls: ASSETS });
    const withoutBridge = doc.html.replace(/<script data-unison-import-overlay="navigation">[\s\S]*?<\/script>/, '');
    const normalize = (s: string) => s.replace(/data:[^"')\s]+/g, 'REF').replace(/https:\/\/cdn\.test\/[^"')\s,]+/g, 'REF');
    const expected = INDEX.replace(/(href=")css\/site\.css/, '$1REF').replace(/url\('img\/hero\.jpg'\)/, "url('REF')")
      .replace('src="img/logo.png" srcset="img/logo.png 1x, img/logo@2x.png 2x"', 'src="REF" srcset="REF 1x, REF 2x"')
      .replace('url(img/hero.jpg)', 'url(REF)').replace('src="js/app.js"', 'src="REF"');
    expect(normalize(withoutBridge)).toBe(expected);
  });

  it('serves stylesheet and script bytes exactly, resolving nested CSS references', () => {
    const doc = buildStaticHtmlPreviewDocument({ files: FILES, entryPath: '/index.html', assetUrls: ASSETS });
    const css = decodeDataUrl(/href="(data:text\/css[^"]+)"/.exec(doc.html)![1]);
    expect(css).toContain('body { background: url(https://cdn.test/hero.jpg); }');
    expect(decodeDataUrl(/@import '(data:[^']+)'/.exec(css)![1])).toBe(FILES['/css/base.css']);
    expect(decodeDataUrl(/src="(data:text\/javascript[^"]+)"/.exec(doc.html)![1])).toBe(FILES['/js/app.js']);
  });

  it('leaves remote, fragment, commented and script-template references alone and reports missing files', () => {
    const doc = buildStaticHtmlPreviewDocument({ files: FILES, entryPath: '/index.html', assetUrls: ASSETS });
    expect(doc.html).toContain('href="https://fonts.googleapis.com"');
    expect(doc.html).toContain('<link rel="canonical" href="/">');
    expect(doc.html).toContain('<!-- <img src="img/commented.png"> -->');
    expect(doc.html).toContain(`const card = '<img src="\${item.imageUrl}">';`);
    expect(doc.html).toContain('href="#contact"');
    expect(doc.diagnostics).toEqual([{ from: '/index.html', ref: 'img/missing.png', reason: 'missing-file' }]);
  });

  it('routes local page links through a disclosed navigation overlay without rewriting the links', () => {
    const doc = buildStaticHtmlPreviewDocument({ files: FILES, entryPath: '/index.html', assetUrls: ASSETS });
    expect(doc.html).toContain('<a href="about.html">About</a>');
    expect(doc.pageLinks).toEqual(['/about.html']);
    expect(doc.overlays).toEqual(['page-navigation-bridge']);
    expect(listStaticHtmlPages(FILES)).toEqual(['/index.html', '/about.html']);
  });

  it('resolves relative, parent and root references', () => {
    expect(resolveLocalRef('../img/a b.png?v=1', '/css/site.css')).toBe('/img/a b.png');
    expect(resolveLocalRef('/js/app.js', '/pages/x.html')).toBe('/js/app.js');
    expect(resolveLocalRef('mailto:a@b.c', '/index.html')).toBeNull();
  });

  it('marks plain HTML imports as runnable, including imports saved before the adapter existed', async () => {
    const intake = await intakeLooseFiles([
      { path: 'site/index.html', bytes: enc(INDEX) },
      { path: 'site/js/app.js', bytes: enc(FILES['/js/app.js']) },
    ]);
    const profile = analyzeImportedProject(intake);
    expect(profile.framework).toBe('static-html');
    expect(profile.previewAdapter.status).toBe('available');
    const { files, provenance } = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' });
    expect(provenance.readiness.runtimeCompatibility).toBe('supported');
    expect(provenance.readiness.visualParity).toBe('unverified');
    expect(provenance.readiness.publishReady).toBe(false);
    const frozen = { ...profile, previewAdapter: { status: 'unavailable' as const, adapter: null, reason: 'old', requires: [] } };
    expect(resolveImportPreviewAdapter(frozen, files).status).toBe('available');
  });
});
