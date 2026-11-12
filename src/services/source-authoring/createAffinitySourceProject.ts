/**
 * Saves an Affinity-written project as a source project and returns the same
 * handoff an imported project gets: identical acceptance, preview, edit and
 * publish paths. The account's free demo settles inside the same revision
 * insert, so a failed or abandoned creation never uses it up.
 */
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { commitMutation } from '@/services/vfsCommitService';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import { withAccountDemoGeneration } from '@/services/accountDemoGeneration';
import { intakeLooseFiles, verifyIntakeHashParity } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { IMPORTED_SOURCE_ACCEPTANCE_PROFILE } from '@/services/import/importedSourceRecords';
import { resolveImportBusinessId, type ExternalImportResult } from '@/services/import/externalProjectImport';
import { planSourceBuild } from '@/services/import/sourceBuild/sourceBuildPlan';
import { getVerticalPack, resolveIndustryVertical } from '@/services/composition/verticals';
import { verifiedPhotosFor } from '@/services/app-builder/design/pageStructureGate';
import { authorSourceProject, type AuthoredSourceProject, type SourceBuildCheck } from './affinitySourceAuthor';

export interface CreateAffinitySourceProjectInput {
  prompt: string;
  projectName: string;
  businessId?: string | null;
  demoGeneration?: boolean;
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}

export interface CreatedAffinitySourceProject extends ExternalImportResult {
  authored: AuthoredSourceProject;
}

/** Trade knowledge from the owner's words, as advice Affinity may use or ignore. */
export function sourceProjectAdvice(prompt: string): { advice: string; photos: string[] } {
  const vertical = resolveIndustryVertical(prompt);
  const pack = getVerticalPack(vertical?.packId);
  const photos = verifiedPhotosFor(undefined, 10, [vertical?.packId, vertical?.blendPackId]);
  if (!pack) return { advice: '', photos: vertical ? photos : [] };
  const variant = pack.variants.find((entry) => entry.id === vertical?.variantId) ?? pack.variants[0];
  const advice = [
    `This reads like a ${pack.label.toLowerCase()} site (matched: ${vertical?.evidence.join(', ') || 'n/a'}).`,
    `Trade vocabulary: ${[...pack.vocabulary, ...(variant?.vocabulary ?? [])].join(', ')}.`,
    `Content visitors look for: ${pack.contentObjects.map((object) => `${object.label} (${object.fields.join(', ')})`).join('; ')}.`,
    `Proof visitors trust: ${pack.proofMechanisms.join('; ')}.`,
    variant ? `Main visitor action: ${variant.primaryAction}.` : '',
    `Experiences common in this trade (build only those the prompt asks for or clearly benefits from): ${pack.interactions.map((interaction) => `${interaction.label} — ${interaction.brief}`).join(' | ')}`,
    `Imagery: ${pack.imagery.join('; ')}. Motion: ${pack.motion.join('; ')}.`,
    `Honesty: ${pack.honesty.join(' ')}`,
  ].filter(Boolean).join('\n');
  return { advice, photos };
}

/** Builds the files exactly as the preview will, in this browser. */
async function browserBuildCheck(files: Record<string, string>): Promise<SourceBuildCheck> {
  const intake = await intakeLooseFiles(Object.entries(files).map(([path, text]) => ({ path: path.slice(1), bytes: new TextEncoder().encode(text) })));
  const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
  const plan = planSourceBuild(profile, files);
  if (plan.status !== 'supported') return { ok: false, errors: [{ message: plan.reason ?? 'The project shape is not one the preview can build.', path: '/package.json' }] };
  const { buildImportedSourceInBrowser } = await import('@/services/import/sourceBuild/browserSourceBuild');
  const result = await buildImportedSourceInBrowser({ plan, files, assetUrls: {} });
  return {
    ok: result.ok,
    errors: result.diagnostics.filter((d) => d.level === 'error').map((d) => ({ message: d.message, path: d.path ? (d.path.startsWith('/') ? d.path : `/${d.path}`) : undefined })),
  };
}

export async function createAffinitySourceProject(input: CreateAffinitySourceProjectInput): Promise<CreatedAffinitySourceProject> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Sign in before creating a site.');
  const run = (demoOperationId?: string) => createAndSave(input, user.id, demoOperationId);
  return input.demoGeneration ? withAccountDemoGeneration(run) : run();
}

async function createAndSave(input: CreateAffinitySourceProjectInput, userId: string, demoOperationId?: string): Promise<CreatedAffinitySourceProject> {
  const { advice, photos } = sourceProjectAdvice(input.prompt);
  const authored = await authorSourceProject({
    prompt: input.prompt,
    projectName: input.projectName,
    advice,
    photos,
    signal: input.signal,
    onStatus: input.onStatus,
    buildCheck: typeof window === 'undefined' ? undefined : browserBuildCheck,
  });

  input.onStatus?.('Saving your site');
  const intake = await intakeLooseFiles(Object.entries(authored.files).map(([path, text]) => ({ path: path.slice(1), bytes: new TextEncoder().encode(text) })), { name: input.projectName });
  const parity = await verifyIntakeHashParity(intake);
  if (!parity.ok) throw new Error(`Some written files could not be saved without changes: ${parity.mismatches.slice(0, 5).join(', ')}`);
  const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
  const businessId = await resolveImportBusinessId(userId, input.businessId, input.projectName);

  const { data: draft, error: draftError } = await supabase
    .from('builder_drafts')
    .insert({
      user_id: userId,
      business_id: businessId,
      name: input.projectName,
      code: '',
      editor_code: '',
      vfs_files: {} as Json,
      metadata: {
        name: input.projectName,
        projectName: input.projectName,
        description: authored.summary.slice(0, 300),
        source: 'affinity-authored',
        acceptanceProfile: IMPORTED_SOURCE_ACCEPTANCE_PROFILE,
        importSnapshotHash: intake.manifest.snapshotHash,
        importFramework: profile.framework,
        importedAt: new Date().toISOString(),
      } as unknown as Json,
    })
    .select('id, project_id')
    .single();
  if (draftError) throw draftError;
  if (!draft?.project_id) throw new Error('The new site could not be linked to a Cloud project.');

  const { files, provenance } = buildImportedSourceVfs({
    intake,
    profile,
    assets: { version: 1, assets: [], originalArchive: null },
    importedBy: userId,
    importedAt: new Date().toISOString(),
    origin: 'affinity-authored',
  });
  const patch = legacyFilesToPatchPlan(files, `Affinity wrote ${input.projectName} (${authored.pages.length} pages)`);
  const commit = await commitMutation({
    source: 'wizard-launch',
    identity: {
      userId,
      businessId,
      projectId: draft.project_id,
      draftId: draft.id,
      revisionId: '',
      sessionId: `affinity-authored:${draft.id}`,
    },
    current: { vfsFiles: {} },
    patch: demoOperationId ? { ...patch, operationIds: [`account-demo:${demoOperationId}`] } : patch,
    options: { acceptanceProfile: IMPORTED_SOURCE_ACCEPTANCE_PROFILE, businessName: input.projectName },
  });
  if (!commit.persistedRevisionId) throw new Error('The new site could not be saved as a version.');
  return {
    projectId: draft.project_id,
    draftId: draft.id,
    businessId,
    revisionId: commit.persistedRevisionId,
    projectName: input.projectName,
    vfsFiles: commit.vfsFiles,
    profile,
    provenance,
    fileCount: intake.manifest.files.length,
    assetCount: 0,
    excludedCount: intake.manifest.excluded.length,
    authored,
  };
}
