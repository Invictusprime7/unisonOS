const SUPPORTED_FRAMEWORKS = new Set(['tanstack-start', 'vite-react', 'vue-vite']);
const SUPPORTED_PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const START_SCRIPTS = new Set(['dev', 'start']);
const MAX_FILES = 400;
const MAX_ASSETS = 100;
const MAX_FILE_BYTES = 1_000_000;
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedSourcePath(value) {
  if (typeof value !== 'string' || value.length > 240 || /[\x00-\x1f\x7f]/.test(value)) return null;
  const raw = value.replace(/\\/g, '/');
  const parts = raw.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) return null;
  if (parts.length === 0) return null;
  return `/${parts.join('/')}`;
}

function validateAssets(assets, supabaseUrl) {
  if (assets === undefined) return [];
  if (!Array.isArray(assets) || assets.length > MAX_ASSETS) throw new Error('Invalid imported preview asset list.');
  const storageHost = new URL(supabaseUrl).hostname;
  return assets.map((asset) => {
    const path = normalizedSourcePath(asset?.path);
    let url;
    try { url = new URL(asset?.url); } catch { throw new Error('Invalid imported asset URL.'); }
    if (!path || url.protocol !== 'https:' || url.hostname !== storageHost || url.username || url.password) {
      throw new Error('Imported preview assets must be signed URLs from this Supabase project.');
    }
    if (typeof asset.mime !== 'string' || asset.mime.length > 128) throw new Error('Invalid imported asset MIME type.');
    return { path, url: url.toString(), mime: asset.mime };
  });
}

export function validateImportedPreviewRequest(body, { supabaseUrl }) {
  if (!body || typeof body !== 'object' || !PROJECT_ID.test(body.projectId ?? '')) {
    throw new Error('Invalid imported preview project identity.');
  }
  const runtime = body.importedRuntime;
  if (!runtime || runtime.protocolVersion !== 1 || !SUPPORTED_FRAMEWORKS.has(runtime.framework)) {
    throw new Error('Unsupported imported preview runtime.');
  }
  if (!SUPPORTED_PACKAGE_MANAGERS.has(runtime.packageManager) || !START_SCRIPTS.has(runtime.startScript)) {
    throw new Error('Unsupported imported preview package manager or script.');
  }
  if (!Array.isArray(runtime.entrypoints) || runtime.entrypoints.length > 40 || runtime.entrypoints.some((entry) => typeof entry !== 'string' || entry.length > 240)) {
    throw new Error('Invalid imported preview entrypoint list.');
  }
  if (!body.files || typeof body.files !== 'object' || Array.isArray(body.files)) throw new Error('Imported preview files are required.');

  const entries = Object.entries(body.files);
  if (entries.length === 0 || entries.length > MAX_FILES) throw new Error(`Imported preview must contain 1 to ${MAX_FILES} files.`);
  const files = {};
  let totalBytes = 0;
  for (const [rawPath, content] of entries) {
    const path = normalizedSourcePath(rawPath);
    if (!path) throw new Error('Invalid imported preview file path.');
    if (path === '/.unison-import' || path.startsWith('/.unison-import/')) continue;
    const segments = path.slice(1).split('/');
    const name = segments.at(-1) ?? '';
    if (segments.includes('.git') || segments.includes('node_modules')) continue;
    if (/^\.env(?:\.|$)/i.test(name) && !/^\.env\.(?:example|sample|template)$/i.test(name)) continue;
    if (typeof content !== 'string') throw new Error(`Imported preview file must be text: ${path}`);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_FILE_BYTES) throw new Error(`Imported preview file exceeds the per-file limit: ${path}`);
    totalBytes += bytes;
    if (totalBytes > MAX_PAYLOAD_BYTES) throw new Error('Imported preview source exceeds the size limit.');
    files[path] = content;
  }
  if (Object.keys(files).length === 0) throw new Error('Imported preview has no runnable source files.');

  let packageJson;
  try { packageJson = JSON.parse(files['/package.json'] ?? ''); } catch { throw new Error('Imported preview requires a valid package.json.'); }
  if (typeof packageJson.scripts?.[runtime.startScript] !== 'string') {
    throw new Error(`Imported package.json is missing the ${runtime.startScript} script.`);
  }
  if (typeof packageJson.name !== 'string' || packageJson.name.length > 214) {
    throw new Error('Imported package.json requires a valid package name.');
  }

  return {
    projectId: body.projectId,
    files,
    importedRuntime: {
      protocolVersion: 1,
      framework: runtime.framework,
      packageManager: runtime.packageManager,
      startScript: runtime.startScript,
      entrypoints: runtime.entrypoints,
    },
    assets: validateAssets(body.assets, supabaseUrl),
  };
}