/**
 * Builder handoff for a saved import. Shared by the Import button and the
 * Affinity chat drop zone so both open the same accepted revision the same way.
 */
import { persistLauncherHandoff } from '@/services/launcherHandoffPersistence';
import { createLaunchState } from '@/types/launchState';
import type { ExternalImportResult, ExternalImportStage } from './externalProjectImport';

export const IMPORT_STAGE_LABEL: Record<ExternalImportStage, string> = {
  reading: 'Reading files…',
  checking: 'Checking files…',
  'saving-assets': 'Saving images and fonts…',
  'saving-version': 'Saving the first version…',
  'resolving-imports': 'Affinity is resolving imports…',
};

function pickEntryPoint(files: Record<string, string>, entrypoints: string[]): string {
  const preferred = entrypoints.map((p) => `/${p}`).find((p) => /\.(tsx|jsx|ts|js|html?)$/.test(p) && p in files);
  return preferred
    ?? Object.keys(files).find((p) => /^\/src\/.+\.(tsx|jsx)$/.test(p))
    ?? Object.keys(files).find((p) => !p.startsWith('/.unison-import/'))
    ?? '/index.html';
}

export function prepareImportedProjectHandoff(result: ExternalImportResult) {
  const entryPoint = pickEntryPoint(result.vfsFiles, result.profile.entrypoints);
  const launchState = createLaunchState({
    systemType: 'content',
    systemName: result.projectName,
    businessName: result.projectName,
    templateName: result.projectName,
    templateCategory: 'landing',
    aesthetic: 'imported',
    vfsFiles: result.vfsFiles,
    preloadedIntents: [],
    entryPoint,
    startInPreview: true,
    businessId: result.businessId,
    projectId: result.projectId,
  });
  const routeState = {
    fromLauncher: true,
    fromImportedSource: true,
    templateName: result.projectName,
    projectName: result.projectName,
    templateCategory: 'landing' as const,
    systemType: 'content',
    systemName: result.projectName,
    startInPreview: true,
    businessId: result.businessId,
    projectId: result.projectId,
    draftId: result.draftId,
    revisionId: result.revisionId,
    vfsFiles: result.vfsFiles,
    entryPoint,
    importToolchainConfigFiles: result.profile.toolchain.configFiles,
    launchReliabilityMode: 'imported-source',
  };
  persistLauncherHandoff({ routeState, launchState });
  return routeState;
}

export function importedToastDescription(result: ExternalImportResult): string {
  if (result.repair?.error) {
    return `Saved unchanged. Affinity could not finish import repair: ${result.repair.error}`;
  }
  if (result.repair?.resolvedImports) {
    return result.repair.unresolvedImports > 0
      ? `Affinity resolved ${result.repair.resolvedImports} local imports in a new version. ${result.repair.unresolvedImports} still need attention.`
      : `Affinity resolved ${result.repair.resolvedImports} local imports in a new version.`;
  }
  if (result.repair?.unresolvedImports) {
    return `Saved unchanged. Affinity could not resolve ${result.repair.unresolvedImports} local imports, so the source remains available to edit.`;
  }
  return result.provenance.readiness.runtimeCompatibility === 'blocked'
    ? 'Saved as your first version. Preview is off for this project type, so a different design is never shown.'
    : 'Saved as your first version. The preview shows your original files.';
}
