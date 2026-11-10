/**
 * UIMP-01 Phase B — secure, source-preserving intake.
 *
 * One intake pipeline for every external import (ZIP archive, folder, single
 * source file or asset). It never rewrites, reformats, recompresses or themes
 * anything: it only decides which bytes are safe to keep, hashes them, and
 * describes them in an immutable import manifest.
 *
 * Rejections (whole import refused, nothing staged):
 *   path traversal, absolute paths, NUL bytes, symlinks that escape the root,
 *   zip bombs (declared or actual size/ratio), file-count/size/depth quotas,
 *   duplicate or case-colliding paths, and high-confidence secrets in source.
 * Exclusions (recorded, not imported):
 *   OS junk, dependency folders, repository metadata, generated build output
 *   (only when a real project root exists), `.env` value files (variable
 *   NAMES are kept), internal symlinks, executables and nested archives.
 */
import JSZip from 'jszip';

export type ImportInputKind = 'zip' | 'files';

export type ImportFileKind =
  | 'source'
  | 'style'
  | 'markup'
  | 'config'
  | 'document'
  | 'image'
  | 'font'
  | 'media'
  | 'data'
  | 'binary-other';

export interface ImportFileRecord {
  /** Root-relative path, forward slashes, no leading slash. */
  path: string;
  sha256: string;
  size: number;
  kind: ImportFileKind;
  /** `text` files enter the source VFS byte-for-byte; `binary` files become durable assets. */
  storage: 'text' | 'binary';
  mime: string;
}

export type ExclusionReason =
  | 'os-junk'
  | 'dependency-folder'
  | 'repository-metadata'
  | 'generated-output'
  | 'env-values'
  | 'symlink'
  | 'blocked-executable'
  | 'nested-archive';

export interface ImportExclusion {
  path: string;
  reason: ExclusionReason;
  detail?: string;
}

export type SecretKind =
  | 'private-key'
  | 'aws-access-key'
  | 'stripe-secret-key'
  | 'github-token'
  | 'slack-token'
  | 'openai-key'
  | 'anthropic-key'
  | 'service-role-jwt'
  | 'google-api-key'
  | 'generic-secret-assignment';

export interface SecretFinding {
  path: string;
  line: number;
  kind: SecretKind;
  /** Blocking findings refuse the import; advisory ones are reported only. Values are never recorded. */
  severity: 'blocking' | 'advisory';
}

export type IntakeRejectionCode =
  | 'archive-too-large'
  | 'archive-unreadable'
  | 'empty'
  | 'path-traversal'
  | 'absolute-path'
  | 'invalid-path'
  | 'symlink-escape'
  | 'too-many-files'
  | 'path-too-deep'
  | 'file-too-large'
  | 'total-too-large'
  | 'compression-ratio'
  | 'duplicate-path'
  | 'case-collision'
  | 'secret-detected';

export class ImportIntakeError extends Error {
  readonly code: IntakeRejectionCode;
  readonly paths: string[];
  readonly findings: SecretFinding[];
  constructor(code: IntakeRejectionCode, message: string, paths: string[] = [], findings: SecretFinding[] = []) {
    super(message);
    this.name = 'ImportIntakeError';
    this.code = code;
    this.paths = paths;
    this.findings = findings;
  }
}

export interface IntakeLimits {
  maxArchiveBytes: number;
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxPathDepth: number;
  maxPathLength: number;
  /** Uncompressed / compressed ratio allowed for entries above `ratioFloorBytes`. */
  maxCompressionRatio: number;
  ratioFloorBytes: number;
}

export const DEFAULT_INTAKE_LIMITS: IntakeLimits = {
  maxArchiveBytes: 150 * 1024 * 1024,
  maxFiles: 5000,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  maxPathDepth: 32,
  maxPathLength: 400,
  maxCompressionRatio: 200,
  ratioFloorBytes: 1024 * 1024,
};

export interface ImportManifest {
  version: 1;
  origin: 'external-import';
  inputKind: ImportInputKind;
  inputName: string;
  /** SHA-256 of the original archive bytes (ZIP input only). */
  archiveSha256?: string;
  /** Wrapper folder removed from every path ('' when none). Never deeper than the common prefix. */
  strippedPrefix: string;
  /** Nested folders that look like their own app roots (monorepos); informational only. */
  nestedAppRoots: string[];
  files: ImportFileRecord[];
  excluded: ImportExclusion[];
  /** Environment variable NAMES discovered in excluded `.env` files. Values are never read into the manifest. */
  envNames: string[];
  findings: SecretFinding[];
  /** Content address of the preserved source: SHA-256 over sorted `path\0sha256` lines. */
  snapshotHash: string;
}

export interface IntakeResult {
  manifest: ImportManifest;
  /** Text source keyed by root-relative path; re-encoding reproduces the original bytes exactly. */
  textFiles: Record<string, string>;
  /** Binary bytes keyed by root-relative path, for durable asset storage. */
  binaryFiles: Record<string, Uint8Array>;
}

export interface IntakeEntryInput {
  path: string;
  bytes: Uint8Array;
}

// ── helpers ────────────────────────────────────────────────────────────────

export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Copy into a fresh ArrayBuffer so SharedArrayBuffer-backed views are accepted everywhere.
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

const SOURCE_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'vue', 'svelte', 'astro', 'mdx']);
const STYLE_EXT = new Set(['css', 'scss', 'sass', 'less', 'pcss', 'styl']);
const MARKUP_EXT = new Set(['html', 'htm', 'xml']);
const CONFIG_EXT = new Set(['json', 'jsonc', 'json5', 'toml', 'yaml', 'yml', 'lock', 'lockb', 'npmrc', 'nvmrc', 'editorconfig', 'gitignore', 'prettierrc', 'eslintrc', 'browserslistrc']);
const DOCUMENT_EXT = new Set(['md', 'txt', 'rst', 'pdf']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'svg', 'tif', 'tiff', 'heic']);
const FONT_EXT = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);
const MEDIA_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'vtt']);
const DATA_EXT = new Set(['csv', 'tsv', 'geojson', 'wasm', 'glb', 'gltf', 'hdr']);
const EXECUTABLE_EXT = new Set(['exe', 'dll', 'so', 'dylib', 'msi', 'scr', 'com', 'bat', 'cmd', 'app', 'apk', 'dmg', 'deb', 'rpm', 'jar', 'node']);
const ARCHIVE_EXT = new Set(['zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'bz2', 'xz']);

const MIME_BY_EXT: Record<string, string> = {
  ts: 'text/typescript', tsx: 'text/typescript', js: 'text/javascript', jsx: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
  css: 'text/css', scss: 'text/x-scss', html: 'text/html', htm: 'text/html', json: 'application/json', md: 'text/markdown', txt: 'text/plain',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf',
  csv: 'text/csv', wasm: 'application/wasm',
};

function classifyKind(path: string): ImportFileKind {
  const ext = extensionOf(path);
  const name = baseName(path).toLowerCase();
  if (SOURCE_EXT.has(ext)) return 'source';
  if (STYLE_EXT.has(ext)) return 'style';
  if (MARKUP_EXT.has(ext)) return 'markup';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (FONT_EXT.has(ext)) return 'font';
  if (MEDIA_EXT.has(ext)) return 'media';
  if (DATA_EXT.has(ext)) return 'data';
  if (DOCUMENT_EXT.has(ext)) return 'document';
  if (CONFIG_EXT.has(ext) || name.startsWith('.') || name === 'dockerfile' || name === 'license') return 'config';
  return 'binary-other';
}

/** Magic-byte sniffing. Returns a detected MIME type or null when bytes look like plain data/text. */
export function sniffMagic(bytes: Uint8Array): string | null {
  const b = bytes;
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (b.length >= 4 && starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (b.length >= 3 && starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (b.length >= 4 && starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (b.length >= 12 && starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 4 && starts(0x77, 0x4f, 0x46, 0x32)) return 'font/woff2';
  if (b.length >= 4 && starts(0x77, 0x4f, 0x46, 0x46)) return 'font/woff';
  if (b.length >= 4 && starts(0x00, 0x01, 0x00, 0x00)) return 'font/ttf';
  if (b.length >= 4 && starts(0x4f, 0x54, 0x54, 0x4f)) return 'font/otf';
  if (b.length >= 4 && starts(0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
  if (b.length >= 4 && starts(0x50, 0x4b, 0x03, 0x04)) return 'application/zip';
  if (b.length >= 2 && starts(0x1f, 0x8b)) return 'application/gzip';
  if (b.length >= 2 && starts(0x4d, 0x5a)) return 'application/x-msdownload';
  if (b.length >= 4 && starts(0x7f, 0x45, 0x4c, 0x46)) return 'application/x-elf';
  if (b.length >= 4 && (starts(0xcf, 0xfa, 0xed, 0xfe) || starts(0xfe, 0xed, 0xfa, 0xcf) || starts(0xca, 0xfe, 0xba, 0xbe))) return 'application/x-mach-binary';
  if (b.length >= 4 && starts(0x00, 0x61, 0x73, 0x6d)) return 'application/wasm';
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4';
  if (b.length >= 4 && starts(0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm';
  return null;
}

const EXECUTABLE_MAGIC = new Set(['application/x-msdownload', 'application/x-elf', 'application/x-mach-binary']);
const TEXT_KINDS = new Set<ImportFileKind>(['source', 'style', 'markup', 'config', 'document', 'data']);

const strictUtf8 = () => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Decodes bytes as text only when re-encoding reproduces them exactly (byte parity). */
function decodeLosslessText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    const text = strictUtf8().decode(bytes);
    const round = new TextEncoder().encode(text);
    if (round.length !== bytes.length) return null;
    for (let i = 0; i < round.length; i++) if (round[i] !== bytes[i]) return null;
    return text;
  } catch {
    return null;
  }
}

// ── path safety ────────────────────────────────────────────────────────────

/** Validates and normalizes an entry path; throws an intake rejection for unsafe names. */
export function normalizeEntryPath(raw: string, limits: IntakeLimits = DEFAULT_INTAKE_LIMITS): string {
  if (raw.includes('\0')) throw new ImportIntakeError('invalid-path', `Unsafe file name in archive (NUL byte): ${JSON.stringify(raw.replace(/\0/g, '\\0'))}`, [raw]);
  const unified = raw.replace(/\\/g, '/');
  if (unified.startsWith('/') || /^[a-zA-Z]:/.test(unified) || unified.startsWith('//')) {
    throw new ImportIntakeError('absolute-path', `Archive contains an absolute path: ${raw}`, [raw]);
  }
  const segments = unified.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..')) {
    throw new ImportIntakeError('path-traversal', `Archive tries to write outside the project: ${raw}`, [raw]);
  }
  const path = segments.join('/');
  if (!path) throw new ImportIntakeError('invalid-path', `Archive contains an empty file name: ${JSON.stringify(raw)}`, [raw]);
  if (segments.length > limits.maxPathDepth) throw new ImportIntakeError('path-too-deep', `Folder nesting is deeper than ${limits.maxPathDepth} levels: ${path}`, [path]);
  if (path.length > limits.maxPathLength) throw new ImportIntakeError('invalid-path', `File path is longer than ${limits.maxPathLength} characters: ${path.slice(0, 80)}…`, [path]);
  return path;
}

/** Resolves a symlink target relative to its own folder; returns null when it escapes the root. */
export function resolveSymlinkTarget(linkPath: string, target: string): string | null {
  const unified = target.replace(/\\/g, '/');
  if (unified.startsWith('/') || /^[a-zA-Z]:/.test(unified)) return null;
  const stack = linkPath.split('/').slice(0, -1);
  for (const seg of unified.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (stack.length === 0) return null;
      stack.pop();
    } else stack.push(seg);
  }
  return stack.join('/');
}

const OS_JUNK = /(^|\/)(__MACOSX(\/|$)|\.DS_Store$|Thumbs\.db$|desktop\.ini$|\._[^/]*$)/;
const DEPENDENCY_DIRS = /(^|\/)(node_modules|bower_components|jspm_packages|\.pnpm-store|\.yarn\/cache)(\/|$)/;
const REPO_METADATA = /(^|\/)(\.git|\.hg|\.svn)(\/|$)/;
const GENERATED_DIRS = ['dist', 'build', '.next', '.output', '.vinxi', '.vercel', '.netlify', '.turbo', 'coverage', '.cache', '.tanstack', '.svelte-kit', '.nuxt', '.parcel-cache'];
const ENV_VALUE_FILE = /(^|\/)\.env(\.[^/]+)?$/;
const ENV_TEMPLATE_FILE = /(^|\/)\.env\.(example|sample|template|defaults)$/;
const ROOT_MARKERS = ['package.json', 'index.html', 'deno.json', 'bun.lock', 'bun.lockb', 'vite.config.ts', 'vite.config.js', 'app.config.ts'];

function commonDirPrefix(paths: string[]): string {
  if (paths.length === 0) return '';
  const dirs = paths.map((p) => p.split('/').slice(0, -1));
  const first = dirs[0];
  let depth = 0;
  while (depth < first.length && dirs.every((d) => d[depth] === first[depth])) depth++;
  return depth === 0 ? '' : `${first.slice(0, depth).join('/')}/`;
}

/**
 * Wrapper folders are removed only up to the shallowest folder that is itself
 * a project root (holds a root marker) and that every file shares. Without a
 * marker inside the shared prefix nothing is stripped, so `src/App.tsx` stays
 * `src/App.tsx` and monorepo package paths are never flattened.
 */
export function detectProjectRootPrefix(paths: string[]): string {
  const common = commonDirPrefix(paths);
  if (!common) return '';
  const segments = common.slice(0, -1).split('/');
  const present = new Set(paths);
  for (let depth = 1; depth <= segments.length; depth++) {
    const prefix = `${segments.slice(0, depth).join('/')}/`;
    if (ROOT_MARKERS.some((marker) => present.has(`${prefix}${marker}`))) return prefix;
  }
  return '';
}

/** Total entry count declared by the archive's end-of-central-directory record (null when absent/ZIP64). */
function declaredZipEntryCount(bytes: Uint8Array): number | null {
  const floor = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      const total = bytes[i + 10] | (bytes[i + 11] << 8);
      return total === 0xffff ? null : total;
    }
  }
  return null;
}

// ── secret scanning ────────────────────────────────────────────────────────

interface SecretRule {
  kind: SecretKind;
  pattern: RegExp;
  severity: SecretFinding['severity'];
  validate?: (match: string) => boolean;
}

function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '='));
    const role = (JSON.parse(json) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}

const SECRET_RULES: SecretRule[] = [
  { kind: 'private-key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g, severity: 'blocking' },
  { kind: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, severity: 'blocking' },
  { kind: 'stripe-secret-key', pattern: /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{16,}\b/g, severity: 'blocking' },
  { kind: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g, severity: 'blocking' },
  { kind: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, severity: 'blocking' },
  { kind: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, severity: 'blocking' },
  { kind: 'openai-key', pattern: /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/g, severity: 'blocking' },
  {
    kind: 'service-role-jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    severity: 'blocking',
    validate: (m) => jwtRole(m) === 'service_role',
  },
  { kind: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: 'advisory' },
  {
    kind: 'generic-secret-assignment',
    pattern: /\b[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)[A-Z0-9_]*\s*[:=]\s*['"][^'"\s]{12,}['"]/g,
    severity: 'advisory',
  },
];

/** Scans text for credentials. Returns locations and kinds only — never values. */
export function scanTextForSecrets(path: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text))) {
      if (rule.validate && !rule.validate(match[0])) continue;
      const line = text.slice(0, match.index).split('\n').length;
      const key = `${rule.kind}:${line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ path, line, kind: rule.kind, severity: rule.severity });
    }
  }
  return findings;
}

/** Variable names declared in a dotenv file. Values are discarded immediately. */
export function readEnvNames(text: string): string[] {
  const names = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m) names.add(m[1]);
  }
  return [...names];
}

// ── ZIP reading ────────────────────────────────────────────────────────────

interface RawZipEntry {
  name: string;
  isSymlink: boolean;
  declaredSize: number;
  compressedSize: number;
  object: JSZip.JSZipObject;
}

function isSymlinkMode(mode: number | string | null | undefined): boolean {
  if (typeof mode !== 'number') return false;
  // eslint-disable-next-line no-bitwise
  return (mode & 0o170000) === 0o120000;
}

/** Reads an entry while enforcing actual (not just declared) byte limits. */
function readEntryBounded(object: JSZip.JSZipObject, maxBytes: number, onBytes: (n: number) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const stream = (object as unknown as {
      internalStream: (type: 'uint8array') => {
        on: (event: string, cb: (...args: unknown[]) => void) => unknown;
        resume: () => void;
        pause: () => void;
      };
    }).internalStream('uint8array');
    stream.on('data', (chunk: unknown) => {
      if (settled) return;
      const c = chunk as Uint8Array;
      total += c.length;
      try {
        onBytes(c.length);
      } catch (err) {
        settled = true;
        stream.pause();
        reject(err);
        return;
      }
      if (total > maxBytes) {
        settled = true;
        stream.pause();
        reject(new ImportIntakeError('file-too-large', `${object.name} is larger than ${Math.round(maxBytes / 1024 / 1024)} MB once unpacked.`, [object.name]));
        return;
      }
      chunks.push(c);
    });
    stream.on('error', (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(new ImportIntakeError('archive-unreadable', `Couldn't read ${object.name} from the archive: ${err instanceof Error ? err.message : String(err)}`, [object.name]));
    });
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      resolve(out);
    });
    stream.resume();
  });
}

async function readZipEntries(bytes: Uint8Array, limits: IntakeLimits): Promise<{ entries: IntakeEntryInput[]; symlinks: Array<{ path: string; target: string }> }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes, { createFolders: false });
  } catch (err) {
    throw new ImportIntakeError('archive-unreadable', `This file isn't a readable ZIP archive (${err instanceof Error ? err.message : String(err)}).`);
  }
  // JSZip keys entries by name, so a repeated name silently overwrites the
  // earlier one. The central directory's own count exposes the collision.
  const declaredCount = declaredZipEntryCount(bytes);
  const parsedCount = Object.keys(zip.files).length;
  if (declaredCount !== null && declaredCount !== parsedCount) {
    throw new ImportIntakeError('duplicate-path', `The archive lists ${declaredCount} entries but only ${parsedCount} have unique names — some files would overwrite each other.`);
  }
  const raw: RawZipEntry[] = [];
  zip.forEach((_relative, object) => {
    if (object.dir) return;
    const internal = (object as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } })._data;
    raw.push({
      name: object.unsafeOriginalName ?? object.name,
      isSymlink: isSymlinkMode(object.unixPermissions),
      declaredSize: internal?.uncompressedSize ?? 0,
      compressedSize: internal?.compressedSize ?? 0,
      object,
    });
  });
  if (raw.length > limits.maxFiles) {
    throw new ImportIntakeError('too-many-files', `The archive has ${raw.length} files; the limit is ${limits.maxFiles}.`);
  }
  // Declared-size checks first: cheap zip-bomb rejection before decompressing anything.
  let declaredTotal = 0;
  for (const entry of raw) {
    declaredTotal += entry.declaredSize;
    if (entry.declaredSize > limits.maxFileBytes) {
      throw new ImportIntakeError('file-too-large', `${entry.name} is larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB once unpacked.`, [entry.name]);
    }
    if (entry.declaredSize > limits.ratioFloorBytes && entry.compressedSize > 0 && entry.declaredSize / entry.compressedSize > limits.maxCompressionRatio) {
      throw new ImportIntakeError('compression-ratio', `${entry.name} expands ${Math.round(entry.declaredSize / entry.compressedSize)}× — this looks like a ZIP bomb.`, [entry.name]);
    }
  }
  if (declaredTotal > limits.maxTotalBytes) {
    throw new ImportIntakeError('total-too-large', `The archive unpacks to more than ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB.`);
  }

  let actualTotal = 0;
  const onBytes = (n: number) => {
    actualTotal += n;
    if (actualTotal > limits.maxTotalBytes) {
      throw new ImportIntakeError('total-too-large', `The archive unpacks to more than ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB.`);
    }
  };
  const entries: IntakeEntryInput[] = [];
  const symlinks: Array<{ path: string; target: string }> = [];
  for (const entry of raw) {
    const path = normalizeEntryPath(entry.name, limits);
    const data = await readEntryBounded(entry.object, limits.maxFileBytes, onBytes);
    if (entry.compressedSize > 0 && data.length > limits.ratioFloorBytes && data.length / entry.compressedSize > limits.maxCompressionRatio) {
      throw new ImportIntakeError('compression-ratio', `${entry.name} expands ${Math.round(data.length / entry.compressedSize)}× — this looks like a ZIP bomb.`, [entry.name]);
    }
    if (entry.isSymlink) {
      symlinks.push({ path, target: new TextDecoder().decode(data) });
      continue;
    }
    entries.push({ path, bytes: data });
  }
  return { entries, symlinks };
}

// ── main pipeline ──────────────────────────────────────────────────────────

async function buildIntake(
  inputKind: ImportInputKind,
  inputName: string,
  rawEntries: IntakeEntryInput[],
  symlinks: Array<{ path: string; target: string }>,
  limits: IntakeLimits,
  archiveSha256?: string,
): Promise<IntakeResult> {
  if (rawEntries.length === 0 && symlinks.length === 0) {
    throw new ImportIntakeError('empty', 'There are no files to import.');
  }
  if (rawEntries.length > limits.maxFiles) {
    throw new ImportIntakeError('too-many-files', `There are ${rawEntries.length} files; the limit is ${limits.maxFiles}.`);
  }

  // Duplicate and case-collision detection runs on every original path.
  const exact = new Set<string>();
  const folded = new Map<string, string>();
  for (const entry of rawEntries) {
    if (exact.has(entry.path)) throw new ImportIntakeError('duplicate-path', `The archive contains ${entry.path} more than once.`, [entry.path]);
    exact.add(entry.path);
    const lower = entry.path.toLowerCase();
    const prior = folded.get(lower);
    if (prior) throw new ImportIntakeError('case-collision', `${prior} and ${entry.path} differ only by letter case and would overwrite each other.`, [prior, entry.path]);
    folded.set(lower, entry.path);
  }

  const excluded: ImportExclusion[] = [];
  const kept: IntakeEntryInput[] = [];
  for (const entry of rawEntries) {
    if (OS_JUNK.test(entry.path)) excluded.push({ path: entry.path, reason: 'os-junk' });
    else if (DEPENDENCY_DIRS.test(entry.path)) excluded.push({ path: entry.path, reason: 'dependency-folder' });
    else if (REPO_METADATA.test(entry.path)) excluded.push({ path: entry.path, reason: 'repository-metadata' });
    else kept.push(entry);
  }

  const strippedPrefix = detectProjectRootPrefix(kept.map((e) => e.path));
  const rel = (p: string) => (strippedPrefix && p.startsWith(strippedPrefix) ? p.slice(strippedPrefix.length) : p);

  for (const link of symlinks) {
    const resolved = resolveSymlinkTarget(link.path, link.target);
    const insideRoot = resolved !== null
      && (!strippedPrefix || resolved === strippedPrefix.slice(0, -1) || resolved.startsWith(strippedPrefix));
    if (!insideRoot) {
      throw new ImportIntakeError('symlink-escape', `${link.path} is a link pointing outside the project (${link.target}).`, [link.path]);
    }
    excluded.push({ path: rel(link.path), reason: 'symlink', detail: 'Links are not followed; the target file is imported on its own if present.' });
  }

  const relPaths = kept.map((e) => rel(e.path));
  const hasRootPackage = relPaths.includes('package.json');
  const nestedAppRoots = [...new Set(relPaths
    .filter((p) => p.includes('/') && ROOT_MARKERS.includes(baseName(p)) && baseName(p) === 'package.json')
    .map((p) => p.slice(0, p.lastIndexOf('/'))))].sort();

  const files: ImportFileRecord[] = [];
  const textFiles: Record<string, string> = {};
  const binaryFiles: Record<string, Uint8Array> = {};
  const envNames = new Set<string>();
  const findings: SecretFinding[] = [];

  for (const entry of kept) {
    const path = rel(entry.path);
    const top = path.split('/')[0];
    if (hasRootPackage && path.includes('/') && GENERATED_DIRS.includes(top)) {
      excluded.push({ path, reason: 'generated-output', detail: 'Build output is regenerated from source.' });
      continue;
    }
    if (ENV_VALUE_FILE.test(path) && !ENV_TEMPLATE_FILE.test(path)) {
      const text = decodeLosslessText(entry.bytes);
      if (text) readEnvNames(text).forEach((n) => envNames.add(n));
      excluded.push({ path, reason: 'env-values', detail: 'Only variable names are kept; values must be added as project secrets.' });
      continue;
    }
    const ext = extensionOf(path);
    const magic = sniffMagic(entry.bytes);
    if (EXECUTABLE_EXT.has(ext) || (magic && EXECUTABLE_MAGIC.has(magic))) {
      excluded.push({ path, reason: 'blocked-executable', detail: magic ?? ext });
      continue;
    }
    if (ARCHIVE_EXT.has(ext) || magic === 'application/zip' || magic === 'application/gzip') {
      excluded.push({ path, reason: 'nested-archive', detail: 'Nested archives are not unpacked; import them separately.' });
      continue;
    }

    const kind = classifyKind(path);
    const sha256 = await sha256Hex(entry.bytes);
    const text = (TEXT_KINDS.has(kind) || ext === 'svg' || kind === 'binary-other') && !magic ? decodeLosslessText(entry.bytes) : null;
    const storage: ImportFileRecord['storage'] = text !== null ? 'text' : 'binary';
    const resolvedKind: ImportFileKind = storage === 'text' && kind === 'binary-other' ? 'document' : kind;
    files.push({ path, sha256, size: entry.bytes.length, kind: resolvedKind, storage, mime: magic ?? MIME_BY_EXT[ext] ?? (storage === 'text' ? 'text/plain' : 'application/octet-stream') });
    if (text !== null) {
      textFiles[path] = text;
      findings.push(...scanTextForSecrets(path, text));
    } else {
      binaryFiles[path] = entry.bytes;
    }
  }

  const blocking = findings.filter((f) => f.severity === 'blocking');
  if (blocking.length > 0) {
    const where = blocking.slice(0, 5).map((f) => `${f.path}:${f.line} (${f.kind})`).join(', ');
    throw new ImportIntakeError(
      'secret-detected',
      `Import stopped: credentials were found in ${where}${blocking.length > 5 ? ' and more' : ''}. Remove them from the files and add them as project secrets instead.`,
      [...new Set(blocking.map((f) => f.path))],
      blocking,
    );
  }
  if (files.length === 0) {
    throw new ImportIntakeError('empty', 'Nothing importable was left after removing dependency folders, build output and unsafe files.');
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  excluded.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const snapshotHash = await sha256Hex(new TextEncoder().encode(files.map((f) => `${f.path}\0${f.sha256}`).join('\n')));

  const manifest: ImportManifest = {
    version: 1,
    origin: 'external-import',
    inputKind,
    inputName,
    ...(archiveSha256 ? { archiveSha256 } : {}),
    strippedPrefix,
    nestedAppRoots,
    files,
    excluded,
    envNames: [...envNames].sort(),
    findings,
    snapshotHash,
  };
  return { manifest: deepFreeze(manifest), textFiles, binaryFiles };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** Secure intake for a ZIP archive (project, folder export or asset bundle). */
export async function intakeZipArchive(
  input: Blob | ArrayBuffer | Uint8Array,
  options: { name?: string; limits?: Partial<IntakeLimits> } = {},
): Promise<IntakeResult> {
  const limits = { ...DEFAULT_INTAKE_LIMITS, ...options.limits };
  const size = input instanceof Uint8Array ? input.byteLength : input instanceof ArrayBuffer ? input.byteLength : input.size;
  if (size > limits.maxArchiveBytes) {
    throw new ImportIntakeError('archive-too-large', `The archive is larger than ${Math.round(limits.maxArchiveBytes / 1024 / 1024)} MB.`);
  }
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input instanceof ArrayBuffer ? input : await input.arrayBuffer());
  const archiveSha256 = await sha256Hex(bytes);
  const { entries, symlinks } = await readZipEntries(bytes, limits);
  return buildIntake('zip', options.name ?? 'archive.zip', entries, symlinks, limits, archiveSha256);
}

/**
 * Secure intake for loose files or a picked folder. `path` should be the
 * folder-relative path (`webkitRelativePath`) when available; single files use
 * their own name. A picked folder's top-level name is kept as part of the path
 * unless every file shares it, matching ZIP wrapper handling.
 */
export async function intakeLooseFiles(
  files: Array<{ path: string; bytes: Uint8Array }>,
  options: { name?: string; limits?: Partial<IntakeLimits> } = {},
): Promise<IntakeResult> {
  const limits = { ...DEFAULT_INTAKE_LIMITS, ...options.limits };
  let total = 0;
  const entries = files.map((f) => {
    if (f.bytes.length > limits.maxFileBytes) throw new ImportIntakeError('file-too-large', `${f.path} is larger than ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.`, [f.path]);
    total += f.bytes.length;
    if (total > limits.maxTotalBytes) throw new ImportIntakeError('total-too-large', `The selected files are larger than ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB.`);
    return { path: normalizeEntryPath(f.path, limits), bytes: f.bytes };
  });
  const name = options.name ?? (entries.length === 1 ? baseName(entries[0].path) : (entries[0]?.path.split('/')[0] || 'files'));
  return buildIntake('files', name, entries, [], limits);
}

/** Phase B gate: every text file re-encodes to its recorded SHA-256; every binary file hashes identically. */
export async function verifyIntakeHashParity(result: IntakeResult): Promise<{ ok: boolean; mismatches: string[] }> {
  const mismatches: string[] = [];
  for (const record of result.manifest.files) {
    const bytes = record.storage === 'text'
      ? new TextEncoder().encode(result.textFiles[record.path] ?? '')
      : result.binaryFiles[record.path];
    if (!bytes || (await sha256Hex(bytes)) !== record.sha256) mismatches.push(record.path);
  }
  return { ok: mismatches.length === 0, mismatches };
}
