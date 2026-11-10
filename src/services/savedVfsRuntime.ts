import { buildGeneratedUiFoundation } from '@/platform/core/generatedUiFoundation';
import { buildPublishedRuntimeConfig, buildPublishedRuntimeModule, buildGeneratedSiteRuntimeManifestModule,
  PUBLISHED_RUNTIME_MODULE_PATH, GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH } from './canonicalLaunchVfs';
import { compileGeneratedSiteRuntimeManifest } from './generatedSiteRuntimeManifest';
import { isImportedSourceVfs } from './import/importedSourceRecords';

/** Add missing platform dependencies to a legacy working set. Saved bytes win. */
export function prepareSavedVfsRuntime(files: Record<string, string>, identity: {
  projectId?: string | null; businessId?: string | null; siteId?: string | null;
  industry?: string; templateId?: string; themePresetId?: string;
} = {}): Record<string, string> {
  // Imported projects never receive Unison platform modules.
  if (!Object.keys(files).length || isImportedSourceVfs(files)) return files;
  const infrastructure = buildGeneratedUiFoundation({ ...identity, themePresetId: identity.themePresetId ?? null }).files;
  infrastructure[PUBLISHED_RUNTIME_MODULE_PATH] = buildPublishedRuntimeModule(buildPublishedRuntimeConfig(identity));
  infrastructure[GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH] = buildGeneratedSiteRuntimeManifestModule(
    compileGeneratedSiteRuntimeManifest({ siteId: identity.siteId }),
  );
  return { ...infrastructure, ...files };
}
