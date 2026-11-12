/**
 * UIMP-01 Phases C/F — adoption VFS and the `imported-source` acceptance
 * profile used by the canonical writer (`commitMutation`).
 *
 * The profile accepts a revision only when it keeps the imported project's own
 * structure: no Unison router, theme, section, recipe or snapshot stage runs;
 * the import records stay byte-identical; the first revision matches the
 * intake manifest hash-for-hash; later revisions may change source files only,
 * and are scanned for credentials. Runtime/preview/publish readiness is read
 * from the provenance record and never upgraded by acceptance.
 */
import { normalizeEntryPath, scanTextForSecrets, sha256Hex, type IntakeResult, type SecretFinding } from './secureIntake';
import type { ImportCompatibilityProfile } from './importCompatibilityProfile';
import {
  IMPORT_ASSETS_PATH,
  IMPORT_MANIFEST_PATH,
  IMPORT_PROFILE_PATH,
  IMPORT_PROVENANCE_PATH,
  IMPORT_RECORD_ROOT,
  isImportRecordPath,
  readImportedSourceRecords,
  stableJson,
  toVfsPath,
  type ImportProvenanceRecord,
  type ImportReadiness,
  type ImportedAssetsRecord,
  type SourceProjectOrigin,
} from './importedSourceRecords';

export const RECORD_PATHS = [IMPORT_PROVENANCE_PATH, IMPORT_MANIFEST_PATH, IMPORT_PROFILE_PATH, IMPORT_ASSETS_PATH];

export class ImportedSourceAdoptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportedSourceAdoptionError';
  }
}

/** Readiness at import time. Never claims preview, parity or publish without evidence. */
export function deriveImportReadiness(
  profile: ImportCompatibilityProfile,
  assets: ImportedAssetsRecord,
  origin: SourceProjectOrigin = 'external-import',
): ImportReadiness {
  const blockers: ImportReadiness['blockers'] = [];
  const failedAssets = assets.assets.filter((a) => a.status !== 'stored');
  const assetsPreserved = assets.assets.length === 0 ? 'not-applicable' : failedAssets.length === 0 ? 'verified' : failedAssets.length === assets.assets.length ? 'failed' : 'partial';
  if (failedAssets.length > 0) {
    blockers.push({ code: 'imported-assets-not-stored', message: `${failedAssets.length} of ${assets.assets.length} images, fonts or media files could not be stored yet: ${failedAssets.slice(0, 3).map((a) => a.path).join(', ')}${failedAssets.length > 3 ? '…' : ''}` });
  }
  if (profile.previewAdapter.status !== 'available') {
    blockers.push({ code: 'imported-runtime-unsupported', message: `Preview is off: no source-compatible runtime for this ${profile.framework} project yet (needs ${profile.previewAdapter.requires.join('; ')}).` });
  }
  blockers.push(origin === 'affinity-authored'
    ? { code: 'imported-visual-parity-unverified', message: 'Run the page check in the preview and confirm the site looks right before publishing.' }
    : { code: 'imported-visual-parity-unverified', message: 'The imported design has not been compared against its original build, so it cannot be published from Unison yet.' });
  return {
    sourcePreserved: 'verified',
    assetsPreserved,
    runtimeCompatibility: profile.previewAdapter.status === 'available' ? 'supported' : 'blocked',
    previewRendered: profile.previewAdapter.status === 'available' ? 'unverified' : 'blocked',
    visualParity: profile.previewAdapter.status === 'available' ? 'unverified' : 'blocked',
    affinityEditable: 'source-edits',
    publishReady: false,
    blockers,
  };
}

/** Builds the exact VFS for the first imported revision. Source bytes are never touched. */
export function buildImportedSourceVfs(input: {
  intake: IntakeResult;
  profile: ImportCompatibilityProfile;
  assets: ImportedAssetsRecord;
  importedBy: string;
  importedAt: string;
  /** Defaults to an external import; Affinity-written projects pass `affinity-authored`. */
  origin?: SourceProjectOrigin;
  /** Convert on open: the older Unison revision these files were taken from. */
  convertedFromRevisionId?: string;
}): { files: Record<string, string>; provenance: ImportProvenanceRecord } {
  const { intake, profile, assets } = input;
  const files: Record<string, string> = {};
  for (const record of intake.manifest.files) {
    const vfsPath = toVfsPath(record.path);
    if (isImportRecordPath(vfsPath)) {
      throw new ImportedSourceAdoptionError(`The project already contains ${IMPORT_RECORD_ROOT.slice(1)}/, which Unison reserves for import records. Rename that folder and import again.`);
    }
    if (record.storage === 'text') files[vfsPath] = intake.textFiles[record.path];
  }
  const provenance: ImportProvenanceRecord = {
    version: 1,
    origin: input.origin ?? 'external-import',
    acceptanceProfile: 'imported-source',
    importedAt: input.importedAt,
    importedBy: input.importedBy,
    inputKind: intake.manifest.inputKind,
    inputName: intake.manifest.inputName,
    originalSnapshotHash: intake.manifest.snapshotHash,
    ...(intake.manifest.archiveSha256 ? { archiveSha256: intake.manifest.archiveSha256 } : {}),
    framework: profile.framework,
    readiness: deriveImportReadiness(profile, assets, input.origin ?? 'external-import'),
    ...(input.convertedFromRevisionId ? { convertedFromRevisionId: input.convertedFromRevisionId } : {}),
  };
  files[IMPORT_MANIFEST_PATH] = stableJson(intake.manifest);
  files[IMPORT_PROFILE_PATH] = stableJson(profile);
  files[IMPORT_ASSETS_PATH] = stableJson(assets);
  files[IMPORT_PROVENANCE_PATH] = stableJson(provenance);
  return { files, provenance };
}

// ── import resolution (advisory diagnostics) ───────────────────────────────

const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.astro', '.json', '.css', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
const IMPORT_SPECIFIER = /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;
const CSS_IMPORT = /@import\s+(?:url\()?["']([^"')]+)["']\)?/g;

export interface UnresolvedImport {
  file: string;
  specifier: string;
}

export function findUnresolvedImports(input: {
  files: Record<string, string>;
  binaryPaths: Set<string>;
  checkPaths: string[];
  aliases: Record<string, string>;
}): UnresolvedImport[] {
  const exists = (p: string) => p in input.files || input.binaryPaths.has(p);
  const aliasEntries = Object.entries(input.aliases).map(([alias, target]) => [alias.replace(/\*$/, ''), toVfsPath(target.replace(/\*$/, ''))] as const);
  const out: UnresolvedImport[] = [];
  for (const file of input.checkPaths) {
    const text = input.files[file];
    if (typeof text !== 'string') continue;
    const isCss = /\.(css|scss|sass|less|pcss)$/.test(file);
    const isSource = /\.(tsx?|jsx?|mjs|cjs|mts|cts|vue|svelte|astro)$/.test(file);
    if (!isCss && !isSource) continue;
    const pattern = isCss ? CSS_IMPORT : IMPORT_SPECIFIER;
    pattern.lastIndex = 0;
    const dir = file.slice(0, file.lastIndexOf('/'));
    for (const m of text.matchAll(pattern)) {
      const raw = (m[1] ?? m[2] ?? m[3] ?? '').split('?')[0].split('#')[0];
      if (!raw || /^(https?:|data:|\/\/)/.test(raw)) continue;
      let base: string | null = null;
      if (raw.startsWith('./') || raw.startsWith('../')) {
        const stack = dir.split('/');
        for (const seg of raw.split('/')) {
          if (seg === '.' || seg === '') continue;
          if (seg === '..') stack.pop();
          else stack.push(seg);
        }
        base = stack.join('/') || '/';
      } else if (raw.startsWith('/')) {
        // Root-absolute specifiers usually point at the public folder.
        base = exists(raw) ? raw : `/public${raw}`;
      } else {
        const alias = aliasEntries.find(([prefix]) => prefix && raw.startsWith(prefix));
        if (alias) base = `${alias[1].replace(/\/$/, '')}/${raw.slice(alias[0].length)}`.replace(/\/+/g, '/');
      }
      if (base === null) continue; // bare package specifier — dependency resolution, not source
      if (!RESOLVE_EXTENSIONS.some((ext) => exists(`${base}${ext}`))) out.push({ file, specifier: raw });
    }
  }
  return out;
}

// ── acceptance ─────────────────────────────────────────────────────────────

export interface ImportedSourceEvaluation {
  ok: boolean;
  rejection?: { code: 'SOURCE_PROJECTION_REWRITE' | 'PROTECTED_INFRASTRUCTURE' | 'SCOPE_ESCAPE'; message: string; detail?: unknown };
  initial: boolean;
  changedPaths: string[];
  deletedPaths: string[];
  unresolvedImports: UnresolvedImport[];
  secretFindings: SecretFinding[];
  readiness: ImportReadiness | null;
  /** Manifest text files whose bytes still equal the original import. */
  unchangedOriginalFiles: number;
  originalTextFiles: number;
}

const textHash = (text: string) => sha256Hex(new TextEncoder().encode(text));

export async function evaluateImportedSourceCandidate(input: {
  before: Record<string, string>;
  after: Record<string, string>;
}): Promise<ImportedSourceEvaluation> {
  const { before, after } = input;
  const records = readImportedSourceRecords(after);
  const priorRecords = readImportedSourceRecords(before);
  const initial = !priorRecords;
  const changedPaths = Object.keys(after).filter((p) => before[p] !== after[p]).sort();
  const deletedPaths = Object.keys(before).filter((p) => !(p in after)).sort();
  const base: ImportedSourceEvaluation = {
    ok: false, initial, changedPaths, deletedPaths, unresolvedImports: [], secretFindings: [],
    readiness: records?.provenance.readiness ?? null, unchangedOriginalFiles: 0, originalTextFiles: 0,
  };
  const reject = (code: NonNullable<ImportedSourceEvaluation['rejection']>['code'], message: string, detail?: unknown): ImportedSourceEvaluation => ({ ...base, rejection: { code, message, detail } });

  if (!records) return reject('PROTECTED_INFRASTRUCTURE', 'Imported project records are missing or damaged; the change would detach this project from its original source.', { paths: RECORD_PATHS });
  if (!initial) {
    const touched = [...changedPaths, ...deletedPaths].filter(isImportRecordPath);
    if (touched.length > 0) return reject('PROTECTED_INFRASTRUCTURE', 'Import records are read-only after the import is accepted.', { paths: touched });
    if (Object.keys(before).length > 0 && !hasValidImportRecords(before)) {
      return reject('SCOPE_ESCAPE', 'An existing Unison project cannot be converted into an imported project.');
    }
  } else if (Object.keys(before).some((p) => !isImportRecordPath(p))) {
    return reject('SCOPE_ESCAPE', 'An import must start from an empty project so nothing from another site mixes into the original source.', { existing: Object.keys(before).slice(0, 10) });
  }

  for (const path of Object.keys(after)) {
    try {
      normalizeEntryPath(path.replace(/^\//, ''));
    } catch (error) {
      return reject('SCOPE_ESCAPE', `Unsafe file path in imported project: ${path}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  const binaryPaths = new Set(records.manifest.files.filter((f) => f.storage === 'binary').map((f) => toVfsPath(f.path)));
  const textRecords = records.manifest.files.filter((f) => f.storage === 'text');
  base.originalTextFiles = textRecords.length;

  if (initial) {
    const expected = new Set([...textRecords.map((f) => toVfsPath(f.path)), ...RECORD_PATHS]);
    const extra = Object.keys(after).filter((p) => !expected.has(p));
    if (extra.length > 0) return reject('SOURCE_PROJECTION_REWRITE', 'The first imported revision contains files that are not in the original source.', { extra: extra.slice(0, 20) });
    const mismatched: string[] = [];
    for (const record of textRecords) {
      const text = after[toVfsPath(record.path)];
      if (typeof text !== 'string' || (await textHash(text)) !== record.sha256) mismatched.push(record.path);
    }
    if (mismatched.length > 0) return reject('SOURCE_PROJECTION_REWRITE', 'Imported source no longer matches the original bytes.', { mismatched: mismatched.slice(0, 20) });
    const assetByPath = new Map(records.assets.assets.map((a) => [a.path, a]));
    const missing = records.manifest.files.filter((f) => f.storage === 'binary' && assetByPath.get(f.path)?.sha256 !== f.sha256).map((f) => f.path);
    if (missing.length > 0) return reject('SOURCE_PROJECTION_REWRITE', 'Some original images, fonts or media files are not accounted for.', { missing: missing.slice(0, 20) });
    base.unchangedOriginalFiles = textRecords.length;
  } else {
    let unchanged = 0;
    for (const record of textRecords) {
      const text = after[toVfsPath(record.path)];
      if (typeof text === 'string' && (await textHash(text)) === record.sha256) unchanged++;
    }
    base.unchangedOriginalFiles = unchanged;
    for (const path of changedPaths) {
      const findings = scanTextForSecrets(path, after[path]);
      base.secretFindings.push(...findings);
    }
    const blocking = base.secretFindings.filter((f) => f.severity === 'blocking');
    if (blocking.length > 0) {
      return reject('SCOPE_ESCAPE', `This change adds credentials to ${blocking.map((f) => `${f.path}:${f.line}`).join(', ')}. Store them as project secrets instead.`, { findings: blocking });
    }
  }

  base.unresolvedImports = findUnresolvedImports({
    files: after,
    binaryPaths,
    checkPaths: initial ? Object.keys(after).filter((p) => !isImportRecordPath(p)) : changedPaths,
    aliases: records.profile.aliases ?? {},
  });
  return { ...base, ok: true };
}

function hasValidImportRecords(files: Record<string, string>): boolean {
  return readImportedSourceRecords(files) !== null;
}
