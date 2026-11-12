/**
 * UIMP-01 Phase G — the exact files Unison publishes for an imported revision.
 *
 * Static HTML sites publish their original files at their original paths.
 * Build-based projects publish the same document the verified preview runs,
 * built again from the same saved bytes; stored images and media are placed
 * at stable paths instead of short-lived preview links. Binary placements are
 * listed in `_unison/publish-assets.json`; the server copies those bytes from
 * storage after checking each hash against the import record.
 *
 * The artifact hash covers every published text file, including the placement
 * list, so publishing ships what was checked or refuses.
 */
import { hashVfsFiles } from '@/services/vfsCommitService';
import { isImportRecordPath, type ImportedSourceRecords } from '@/services/import/importedSourceRecords';
import { STATIC_HTML_PREVIEW_ADAPTER } from '@/services/import/staticHtmlPreview';
import { SOURCE_BUILD_ADAPTER, planSourceBuild } from '@/services/import/sourceBuild/sourceBuildPlan';
import type { SourceBuildResult } from '@/services/import/sourceBuild/sourceBundler';

export const IMPORTED_PUBLISH_PLACEMENTS_PATH = '_unison/publish-assets.json';

export interface PublishPlacement {
  /** Published path, no leading slash. */
  path: string;
  /** Imported file path (manifest form, no leading slash). */
  source: string;
  sha256: string;
}

export interface ImportedPublishArtifact {
  adapter: string;
  files: Record<string, string>;
  placements: PublishPlacement[];
  hash: string;
  diagnostics: string[];
}

type BuildFn = (input: { files: Record<string, string>; assetUrls: Record<string, string> }) => Promise<SourceBuildResult>;

const extOf = (path: string) => /\.[a-z0-9]{1,8}$/i.exec(path)?.[0].toLowerCase() ?? '';

export async function buildImportedPublishArtifact(input: {
  adapter: string;
  records: ImportedSourceRecords;
  files: Record<string, string>;
  /** Source build runner (browser: esbuild-wasm; tests: native esbuild). */
  build?: BuildFn;
}): Promise<ImportedPublishArtifact> {
  const { adapter, records } = input;
  const stored = records.assets.assets.filter((a) => a.status === 'stored' && a.storagePath);
  const out: Record<string, string> = {};
  const placements: PublishPlacement[] = [];
  const diagnostics: string[] = [];

  if (adapter === STATIC_HTML_PREVIEW_ADAPTER) {
    for (const [path, text] of Object.entries(input.files)) if (!isImportRecordPath(path)) out[path.replace(/^\/+/, '')] = text;
    for (const asset of stored) placements.push({ path: asset.path, source: asset.path, sha256: asset.sha256 });
  } else if (adapter === SOURCE_BUILD_ADAPTER) {
    if (!input.build) throw new Error('The source build is not available for publishing.');
    const plan = planSourceBuild(records.profile, input.files);
    if (plan.status !== 'supported') throw new Error(plan.reason);
    const assetUrls: Record<string, string> = {};
    for (const asset of stored) {
      const published = asset.path.startsWith('public/') ? asset.path.slice('public/'.length) : `_unison/assets/${asset.sha256.slice(0, 32)}${extOf(asset.path)}`;
      assetUrls[`/${asset.path}`] = `/${published}`;
      placements.push({ path: published, source: asset.path, sha256: asset.sha256 });
    }
    const built = await input.build({ files: input.files, assetUrls });
    if (!built.ok) throw new Error(built.diagnostics.find((d) => d.level === 'error')?.message ?? 'The project could not be built.');
    out['index.html'] = built.document;
    for (const [path, text] of Object.entries(input.files)) {
      if (path.startsWith('/public/') && path !== '/public/index.html') out[path.slice('/public/'.length)] = text;
    }
    // Client-side routes: every unknown path serves the app document.
    out['_redirects'] ??= '/* /index.html 200\n';
    out['vercel.json'] ??= JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] });
    diagnostics.push(...built.diagnostics.filter((d) => d.level !== 'info').map((d) => d.message));
  } else {
    throw new Error('This imported project has no verified way to run outside its own toolchain yet.');
  }

  placements.sort((a, b) => a.path.localeCompare(b.path));
  if (placements.length > 0) out[IMPORTED_PUBLISH_PLACEMENTS_PATH] = JSON.stringify({ version: 1, placements });
  if (!out['index.html']) throw new Error('The imported project has no index.html to publish as its home page.');
  return { adapter, files: out, placements, hash: await hashVfsFiles(out), diagnostics };
}
