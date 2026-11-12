import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = '/workspace/project';
const PORT = 4173;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 200 * 1024 * 1024;

function safePath(value) {
  if (typeof value !== 'string' || value.length > 240 || /[\x00-\x1f\x7f]/.test(value)) return null;
  const normalized = path.posix.normalize(value.replace(/\\/g, '/').replace(/^\/+/, ''));
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return null;
  if (normalized.split('/').some((part) => part === '.git' || part === 'node_modules' || part === '.unison-import')) return null;
  const basename = path.posix.basename(normalized);
  if (/^\.env(?:\.|$)/i.test(basename) && !/^\.env\.(?:example|sample|template)$/i.test(basename)) return null;
  return normalized;
}

async function downloadJson(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.amazonaws.com')) throw new Error('Invalid source archive URL.');
  const response = await fetch(parsed, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Could not download project source (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error('Project source exceeds the worker limit.');
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function downloadAsset(asset) {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || !process.env.PREVIEW_SUPABASE_STORAGE_HOST
    || url.hostname !== process.env.PREVIEW_SUPABASE_STORAGE_HOST) {
    throw new Error('Imported asset URL is not trusted.');
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Could not download imported asset (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error('Imported asset exceeds the worker limit.');
  return bytes;
}

async function materialize(payload) {
  if (!payload || payload.importedRuntime?.protocolVersion !== 1 || !payload.files || typeof payload.files !== 'object') {
    throw new Error('Invalid imported preview source bundle.');
  }
  await rm(ROOT, { recursive: true, force: true });
  await mkdir(ROOT, { recursive: true });
  let total = 0;
  for (const [rawPath, content] of Object.entries(payload.files)) {
    const relative = safePath(rawPath);
    if (!relative || typeof content !== 'string') throw new Error(`Invalid imported source file: ${rawPath}`);
    total += Buffer.byteLength(content, 'utf8');
    if (total > MAX_SOURCE_BYTES) throw new Error('Project source exceeds the worker limit.');
    const destination = path.join(ROOT, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, { encoding: 'utf8', flag: 'wx' });
  }
  let totalAssetBytes = 0;
  for (const asset of payload.assets ?? []) {
    const relative = safePath(asset.path);
    if (!relative) throw new Error(`Invalid imported asset path: ${asset.path}`);
    const destination = path.join(ROOT, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    const bytes = await downloadAsset(asset);
    totalAssetBytes += bytes.byteLength;
    if (totalAssetBytes > MAX_TOTAL_ASSET_BYTES) throw new Error('Imported media exceeds the worker limit.');
    await writeFile(destination, bytes, { flag: 'wx' });
  }
}

async function run(command, args, env, timeoutMs) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit' });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? code}.`));
    });
  });
}

function installCommand(manager, packageJson, files) {
  if (manager === 'bun') return ['bun', ['install', '--frozen-lockfile']];
  if (manager === 'pnpm') return ['corepack', ['pnpm', 'install', '--frozen-lockfile']];
  if (manager === 'yarn') {
    const yarnVersion = String(packageJson.packageManager ?? '');
    return ['corepack', ['yarn', 'install', yarnVersion.startsWith('yarn@1') ? '--frozen-lockfile' : '--immutable']];
  }
  const hasLock = Boolean(files['/package-lock.json'] || files['/npm-shrinkwrap.json']);
  return ['npm', [hasLock ? 'ci' : 'install', '--no-audit', '--no-fund']];
}

function startCommand(manager, script) {
  const args = ['run', script];
  if (manager !== 'yarn') args.push('--');
  args.push('--host', '0.0.0.0', '--port', String(PORT));
  if (manager === 'bun') return ['bun', args];
  if (manager === 'pnpm' || manager === 'yarn') return ['corepack', [manager, ...args]];
  return ['npm', args];
}

async function main() {
  const sourceUrl = process.env.PREVIEW_SOURCE_URL;
  const startScript = process.env.PREVIEW_START_SCRIPT;
  const manager = process.env.PREVIEW_PACKAGE_MANAGER;
  const ttlSeconds = Math.min(Math.max(Number(process.env.PREVIEW_TTL_SECONDS) || 1800, 60), 3600);
  if (!sourceUrl || !['dev', 'start'].includes(startScript) || !['npm', 'pnpm', 'yarn', 'bun'].includes(manager)) {
    throw new Error('Worker launch settings are invalid.');
  }

  const payload = await downloadJson(sourceUrl);
  if (!['tanstack-start', 'vite-react', 'vue-vite'].includes(payload.importedRuntime?.framework)
    || payload.importedRuntime.packageManager !== manager
    || payload.importedRuntime.startScript !== startScript) {
    throw new Error('Imported runtime does not match the isolated worker profile.');
  }
  await materialize(payload);

  const files = Object.fromEntries(Object.entries(payload.files).map(([key, value]) => [`/${key.replace(/^\/+/, '')}`, value]));
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  if (typeof packageJson.scripts?.[startScript] !== 'string') throw new Error(`Project is missing its ${startScript} script.`);

  // Never expose the source download URL or host process credentials to imported lifecycle scripts.
  delete process.env.PREVIEW_SOURCE_URL;
  const env = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: ROOT,
    NODE_ENV: 'development',
    CI: 'true',
    HOST: '0.0.0.0',
    PORT: String(PORT),
    npm_config_cache: '/tmp/npm-cache',
  };
  await run(...installCommand(manager, packageJson, files), env, 8 * 60 * 1000);

  const [command, args] = startCommand(manager, startScript);
  const app = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit' });
  const ttl = setTimeout(() => app.kill('SIGTERM'), ttlSeconds * 1000);
  const forceStop = setTimeout(() => app.kill('SIGKILL'), ttlSeconds * 1000 + 10_000);
  app.once('error', (error) => { console.error('[import-preview-worker] start failed', error); process.exitCode = 1; });
  app.once('exit', (code, signal) => {
    clearTimeout(ttl);
    clearTimeout(forceStop);
    process.exitCode = code === 0 ? 0 : 1;
  });
}

main().catch((error) => {
  console.error('[import-preview-worker] bootstrap failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});