/**
 * UIMP-01 — the single entry point for importing an external project.
 *
 *   secure intake → compatibility profile → owner draft → durable assets
 *   → adoption VFS → commitMutation (imported-source profile) → accepted revision
 *
 * Nothing in this path generates, rewrites, themes or substitutes source.
 */
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { commitMutation } from '@/services/vfsCommitService';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import { canEditBusiness, createBusinessInline, loadBusinessMemberships } from '@/services/businessMembership';
import { intakeLooseFiles, intakeZipArchive, verifyIntakeHashParity, type IntakeResult } from './secureIntake';
import { analyzeImportedProject, type ImportCompatibilityProfile } from './importCompatibilityProfile';
import { buildImportedSourceVfs } from './importedSourceAcceptance';
import { storeImportedAssets } from './importAssetStorage';
import { IMPORTED_SOURCE_ACCEPTANCE_PROFILE, type ImportProvenanceRecord } from './importedSourceRecords';

export type ExternalImportInput =
  | { kind: 'zip'; file: File }
  | { kind: 'files'; files: File[]; /** Folder-relative paths, parallel to `files` (drag-and-drop folders). */ relativePaths?: string[] };

export interface ExternalImportResult {
  projectId: string;
  draftId: string;
  businessId: string;
  revisionId: string;
  projectName: string;
  vfsFiles: Record<string, string>;
  profile: ImportCompatibilityProfile;
  provenance: ImportProvenanceRecord;
  fileCount: number;
  assetCount: number;
  excludedCount: number;
}

export type ExternalImportStage = 'reading' | 'checking' | 'saving-assets' | 'saving-version';

function projectNameFrom(intake: IntakeResult, profile: ImportCompatibilityProfile): string {
  const fromBrief = profile.unisonBrief?.projectName;
  const fromPackage = profile.packageName && !/^(vite|my-app|app|project|template)(-project)?$/i.test(profile.packageName) ? profile.packageName : null;
  const fromInput = intake.manifest.inputName.replace(/\.zip$/i, '');
  const raw = fromBrief || fromPackage || intake.manifest.strippedPrefix.replace(/\/$/, '').split('/').pop() || fromInput || 'Imported project';
  return raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Imported project';
}

async function resolveBusinessId(userId: string, preferred: string | null | undefined, name: string): Promise<string> {
  if (preferred) return preferred;
  const memberships = await loadBusinessMemberships(userId);
  const editable = memberships.find((m) => m.role === 'owner') ?? memberships.find((m) => canEditBusiness(m.role));
  if (editable) return editable.businessId;
  const created = await createBusinessInline({ userId, name });
  if (!created) throw new Error('A business profile is needed to hold the imported project.');
  return created.id;
}

async function readFiles(files: File[], relativePaths?: string[]): Promise<Array<{ path: string; bytes: Uint8Array }>> {
  return Promise.all(files.map(async (file, index) => ({
    path: relativePaths?.[index] || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  })));
}

export async function importExternalProject(
  input: ExternalImportInput,
  options: { businessId?: string | null; onStage?: (stage: ExternalImportStage, detail?: string) => void } = {},
): Promise<ExternalImportResult> {
  const stage = options.onStage ?? (() => undefined);
  stage('reading');
  const archiveBytes = input.kind === 'zip' ? new Uint8Array(await input.file.arrayBuffer()) : null;
  const intake = input.kind === 'zip'
    ? await intakeZipArchive(archiveBytes!, { name: input.file.name })
    : await intakeLooseFiles(await readFiles(input.files, input.relativePaths));

  stage('checking');
  const parity = await verifyIntakeHashParity(intake);
  if (!parity.ok) throw new Error(`Some files could not be read without changes: ${parity.mismatches.slice(0, 5).join(', ')}`);
  const profile = analyzeImportedProject(intake);
  const projectName = projectNameFrom(intake, profile);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Sign in before importing a project.');
  const businessId = await resolveBusinessId(user.id, options.businessId, projectName);

  const { data: draft, error: draftError } = await supabase
    .from('builder_drafts')
    .insert({
      user_id: user.id,
      business_id: businessId,
      name: projectName,
      code: '',
      editor_code: '',
      vfs_files: {} as Json,
      metadata: {
        name: projectName,
        projectName,
        description: `Imported ${profile.framework} project`,
        source: 'external-import',
        acceptanceProfile: IMPORTED_SOURCE_ACCEPTANCE_PROFILE,
        importSnapshotHash: intake.manifest.snapshotHash,
        importFramework: profile.framework,
        importedAt: new Date().toISOString(),
      } as unknown as Json,
    })
    .select('id, project_id')
    .single();
  if (draftError) throw draftError;
  if (!draft?.project_id) throw new Error('The imported project could not be linked to a Cloud project.');

  stage('saving-assets', `${intake.manifest.files.filter((f) => f.storage === 'binary').length} files`);
  const assets = await storeImportedAssets({
    intake,
    userId: user.id,
    projectId: draft.project_id,
    originalArchive: archiveBytes,
    onProgress: (done, total) => stage('saving-assets', `${done} of ${total}`),
  });

  stage('saving-version');
  const { files, provenance } = buildImportedSourceVfs({
    intake,
    profile,
    assets,
    importedBy: user.id,
    importedAt: new Date().toISOString(),
  });
  const commit = await commitMutation({
    source: 'system-restore',
    identity: {
      userId: user.id,
      businessId,
      projectId: draft.project_id,
      draftId: draft.id,
      revisionId: '',
      sessionId: `external-import:${draft.id}`,
    },
    current: { vfsFiles: {} },
    patch: legacyFilesToPatchPlan(files, `Import ${projectName} (${profile.framework}) unchanged`),
    options: { acceptanceProfile: IMPORTED_SOURCE_ACCEPTANCE_PROFILE, businessName: projectName },
  });
  if (!commit.persistedRevisionId) throw new Error('The imported project could not be saved as a version.');

  return {
    projectId: draft.project_id,
    draftId: draft.id,
    businessId,
    revisionId: commit.persistedRevisionId,
    projectName,
    vfsFiles: commit.vfsFiles,
    profile,
    provenance,
    fileCount: intake.manifest.files.length,
    assetCount: assets.assets.length,
    excludedCount: intake.manifest.excluded.length,
  };
}
