import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import type { RuntimeManifest } from '@/types/runtimeManifest';
import type { SystemType } from '@/types/launchState';
import { importSourceProjectZip } from './importSourceProjectZip';

const SYSTEM_TYPES: readonly SystemType[] = [
  'booking',
  'agency',
  'store',
  'saas',
  'portfolio',
  'content',
];

export interface ImportedUnisonSite {
  projectName: string;
  fileCount: number;
  warnings: string[];
  systemType: SystemType;
  systemName: string;
  industry: string;
  templateId?: string;
  themePresetId?: string;
  entryPoint: string;
  vfsFiles: Record<string, string>;
  runtimeManifest: RuntimeManifest;
  siteBundleSnapshot: SiteBundleSnapshot;
  canonicalPlayground?: Record<string, unknown>;
  wizardSeed?: Record<string, unknown>;
  preloadedIntents: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJsonRecord(files: Record<string, string>, path: string): Record<string, unknown> | null {
  const raw = files[path];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeVfsPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function resolveSystemType(value: unknown): SystemType {
  return typeof value === 'string' && SYSTEM_TYPES.includes(value as SystemType)
    ? value as SystemType
    : 'content';
}

function requireUnisonSnapshot(
  files: Record<string, string>,
  fallbackName: string,
): SiteBundleSnapshot {
  const parsed = readJsonRecord(files, '/.unison/site-bundle-snapshot.json');
  if (!parsed) {
    throw new Error(
      'This is not a restorable Unison export: /.unison/site-bundle-snapshot.json is missing or invalid.',
    );
  }

  const pageRegistry = isRecord(parsed.pageRegistry) ? parsed.pageRegistry : null;
  const pages = pageRegistry && isRecord(pageRegistry.pages) ? pageRegistry.pages : null;
  if (!pages || Object.keys(pages).length === 0) {
    throw new Error('The exported Unison snapshot has no registered pages to restore.');
  }

  const missingPages = Object.values(pages)
    .filter(isRecord)
    .map((page) => typeof page.filePath === 'string' ? normalizeVfsPath(page.filePath) : null)
    .filter((path): path is string => Boolean(path))
    .filter((path) => typeof files[path] !== 'string');
  if (missingPages.length > 0) {
    throw new Error(
      `The archive is incomplete: ${missingPages.slice(0, 4).join(', ')} ${
        missingPages.length > 4 ? 'and additional page files ' : ''
      }are missing.`,
    );
  }

  const appContext = isRecord(parsed.appContext) ? parsed.appContext : {};
  const rawMeta = isRecord(parsed.meta) ? parsed.meta : {};
  const industry =
    (typeof parsed.industry === 'string' && parsed.industry) ||
    (typeof rawMeta.industry === 'string' && rawMeta.industry) ||
    (typeof appContext.industry === 'string' && appContext.industry) ||
    'universal';
  const systemId = resolveSystemType(rawMeta.systemId ?? appContext.systemType);

  return {
    ...(parsed as unknown as SiteBundleSnapshot),
    businessName:
      (typeof parsed.businessName === 'string' && parsed.businessName) ||
      (typeof appContext.businessName === 'string' && appContext.businessName) ||
      fallbackName,
    industry,
    vfsFiles: {
      ...(isRecord(parsed.vfsFiles) ? parsed.vfsFiles as Record<string, string> : {}),
      ...files,
    },
    meta: {
      ...rawMeta,
      source: 'import',
      systemId,
      industry,
      verticalContractId:
        (typeof rawMeta.verticalContractId === 'string' && rawMeta.verticalContractId) ||
        systemId,
    },
  };
}

function readPreloadedIntents(snapshot: SiteBundleSnapshot): string[] {
  const intents = new Set<string>();
  for (const binding of Object.values(snapshot.bindings || {})) {
    if (isRecord(binding) && typeof binding.intent === 'string') {
      intents.add(binding.intent);
    }
  }
  return [...intents];
}

/**
 * Restore an exported Unison source archive into the exact canonical VFS
 * shape used by the Launcher and Web Builder. Unlike the generic ZIP importer,
 * this requires Unison metadata and refuses incomplete page registries.
 */
export async function importUnisonSiteZip(
  file: File | Blob,
  options?: { fallbackName?: string },
): Promise<ImportedUnisonSite> {
  const imported = await importSourceProjectZip(file, options);
  const archivedManifest = readJsonRecord(imported.vfsFiles, '/.unison/runtime-manifest.json');
  if (!archivedManifest || typeof archivedManifest.entryPoint !== 'string') {
    throw new Error(
      'This is not a restorable Unison export: /.unison/runtime-manifest.json is missing or invalid.',
    );
  }

  const snapshot = requireUnisonSnapshot(imported.vfsFiles, imported.projectName);
  const appContext = snapshot.appContext;
  const systemType = resolveSystemType(snapshot.meta.systemId ?? appContext?.systemType);
  const systemName =
    (typeof appContext?.systemName === 'string' && appContext.systemName) ||
    systemType;
  const themePresetId =
    (typeof snapshot.meta.themePresetId === 'string' && snapshot.meta.themePresetId) ||
    (typeof appContext?.themePresetId === 'string' && appContext.themePresetId) ||
    (typeof archivedManifest.themePresetId === 'string' && archivedManifest.themePresetId) ||
    undefined;
  const templateId =
    (typeof snapshot.meta.templateId === 'string' && snapshot.meta.templateId) ||
    (typeof appContext?.templateId === 'string' && appContext.templateId) ||
    undefined;
  const canonicalPlayground = readJsonRecord(imported.vfsFiles, '/.unison/canonical-playground.json') || undefined;
  const wizardSeed = readJsonRecord(imported.vfsFiles, '/.unison/wizard-seed.json') || undefined;

  // Older/partial archives carry the theme seed but not the Stage 4b injection
  // record. Rebuild it from the resolved seed so the canonical theme contract
  // stays intact across export -> import instead of hard-failing the restore.
  const restoredSnapshot: typeof snapshot = themePresetId && !snapshot.meta.themeInjection?.presetId
    ? {
        ...snapshot,
        meta: {
          ...snapshot.meta,
          themePresetId,
          themeInjection: {
            version: '1.0',
            stage: '4b',
            presetId: themePresetId,
            cssPath: '/src/index.css',
          },
        },
      }
    : snapshot;

  const artifacts = buildCanonicalLaunchArtifacts({
    generatedFiles: imported.vfsFiles,
    preferredEntryPoint: archivedManifest.entryPoint,
    siteBundleSnapshot: restoredSnapshot,
    canonicalPlayground,
    mergeWithCanonicalSnapshot: true,
    allowCanonicalPageFallback: false,
    strictPreflight: true,
    businessName: restoredSnapshot.businessName,
    industry: restoredSnapshot.industry,
    systemType,
    systemName,
    templateName: snapshot.businessName,
    templateCategory: appContext?.templateCategory || 'landing',
    templateId,
    themePresetId,
    aesthetic: themePresetId,
  });

  if (!artifacts.siteBundleSnapshot) {
    throw new Error('The imported Unison archive could not restore its canonical site snapshot.');
  }

  return {
    projectName: snapshot.businessName,
    fileCount: Object.keys(artifacts.files).length,
    warnings: imported.warnings,
    systemType,
    systemName,
    industry: snapshot.industry,
    templateId,
    themePresetId,
    entryPoint: artifacts.entryPoint,
    vfsFiles: artifacts.files,
    runtimeManifest: artifacts.runtimeManifest,
    siteBundleSnapshot: artifacts.siteBundleSnapshot,
    canonicalPlayground: artifacts.canonicalPlayground,
    wizardSeed,
    preloadedIntents: readPreloadedIntents(artifacts.siteBundleSnapshot),
  };
}

/** Read a licensed package as App Builder input, without accepting/preflighting its page bodies. */
export async function readUnisonSiteMaterial(file: File | Blob, options?: { fallbackName?: string }) {
  const imported = await importSourceProjectZip(file, options);
  const snapshot = requireUnisonSnapshot(imported.vfsFiles, imported.projectName);
  const manifest = readJsonRecord(imported.vfsFiles, '/.unison/runtime-manifest.json');
  if (!manifest || typeof manifest.entryPoint !== 'string') throw new Error('The template package has no runtime entry point.');
  return { files: imported.vfsFiles, siteBundleSnapshot: snapshot, entryPoint: manifest.entryPoint };
}