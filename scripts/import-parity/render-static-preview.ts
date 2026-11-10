/**
 * UIMP-01 Phase E helper: writes the exact document the Unison Preview serves
 * for one page of a static site folder. Binary files are linked to the same
 * reference server the original is loaded from, so both sides load identical
 * bytes.
 *
 *   bun scripts/import-parity/render-static-preview.ts <siteDir> <entry.html> <assetBaseUrl> <out.html>
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildStaticHtmlPreviewDocument } from '../../src/services/import/staticHtmlPreview';

const [siteDir, entry, assetBase, out] = process.argv.slice(2);
if (!siteDir || !entry || !assetBase || !out) throw new Error('usage: <siteDir> <entry.html> <assetBaseUrl> <out.html>');
const TEXT = /\.(html?|css|m?js|json|svg|txt|xml|webmanifest|map)$/i;
const files: Record<string, string> = {};
const assetUrls: Record<string, string> = {};
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) { walk(abs); continue; }
    const rel = `/${relative(siteDir, abs).split('\\').join('/')}`;
    if (TEXT.test(name)) files[rel] = readFileSync(abs, 'utf8');
    else assetUrls[rel] = `${assetBase.replace(/\/$/, '')}${rel.split('/').map(encodeURIComponent).join('/')}`;
  }
};
walk(siteDir);
const doc = buildStaticHtmlPreviewDocument({ files, entryPath: entry.startsWith('/') ? entry : `/${entry}`, assetUrls });
writeFileSync(out, doc.html);
console.log(JSON.stringify({ resolvedRefs: doc.resolvedRefs, overlays: doc.overlays, diagnostics: doc.diagnostics, pageLinks: doc.pageLinks }));
