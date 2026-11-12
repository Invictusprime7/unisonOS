/**
 * UIMP-01 Phase E/G — verification record for one saved imported revision.
 *
 * A check runs every original page in the isolated preview and records what
 * it found; the owner then confirms the preview matches their original. Only a
 * passing, owner-confirmed check of the exact saved bytes marks that same
 * revision ready to publish (server-side, in `record_imported_source_verification`).
 * The publish artifact hash is recorded with it so publishing ships the bytes
 * that were checked, or nothing.
 */
import { supabase } from '@/integrations/supabase/client';
import { hashVfsFiles } from '@/services/vfsCommitService';

export const IMPORTED_VERIFICATION_VERSION = 'imported-source-verification-v1';

export interface RouteProbe {
  path: string;
  textLength: number;
  elementCount: number;
  imagesBroken: string[];
  errors: string[];
  title?: string;
}

export interface RouteCheck extends RouteProbe {
  ok: boolean;
  problems: string[];
}

export interface VerificationSummary {
  status: 'passed' | 'failed';
  routes: RouteCheck[];
  problems: string[];
}

/** A page passes when it rendered content, raised no runtime errors and every image loaded. */
export function evaluateRouteProbe(probe: RouteProbe): RouteCheck {
  const problems: string[] = [];
  if (probe.textLength === 0 && probe.elementCount < 3) problems.push('The page rendered nothing.');
  if (probe.errors.length > 0) problems.push(`${probe.errors.length} error${probe.errors.length === 1 ? '' : 's'} while running: ${probe.errors[0].slice(0, 160)}`);
  if (probe.imagesBroken.length > 0) problems.push(`${probe.imagesBroken.length} image${probe.imagesBroken.length === 1 ? '' : 's'} did not load.`);
  return { ...probe, ok: problems.length === 0, problems };
}

export function summarizeVerification(probes: RouteProbe[], expectedRoutes: string[]): VerificationSummary {
  const routes = probes.map(evaluateRouteProbe);
  const problems: string[] = [];
  const seen = new Set(routes.map((r) => r.path.split(/[?#]/)[0]));
  const missing = expectedRoutes.filter((r) => !seen.has(r));
  if (expectedRoutes.length === 0) problems.push('No pages were found to check.');
  if (missing.length > 0) problems.push(`Not checked: ${missing.join(', ')}`);
  for (const route of routes) for (const problem of route.problems) problems.push(`${route.path}: ${problem}`);
  return { status: problems.length === 0 ? 'passed' : 'failed', routes, problems };
}

/** The saved revision whose bytes equal what the preview is showing, if any. */
export async function findSavedImportedRevision(projectId: string, files: Record<string, string>): Promise<{ id: string; vfsHash: string; publishReady: boolean } | null> {
  const vfsHash = await hashVfsFiles(files);
  const { data, error } = await supabase
    .from('site_revisions')
    .select('id, vfs_hash, publish_ready')
    .eq('project_id', projectId)
    .eq('status', 'committed')
    .eq('vfs_hash', vfsHash)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, vfsHash, publishReady: data.publish_ready === true };
}

export interface ImportedVerificationRow {
  id: string;
  revision_id: string;
  vfs_hash: string;
  adapter: string;
  artifact_hash: string;
  status: 'passed' | 'failed';
  owner_confirmed: boolean;
  created_at: string;
}

// The verification table and RPC are newer than the generated client types.
const untyped = supabase as unknown as {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function loadLatestImportedVerification(projectId: string, revisionId: string): Promise<ImportedVerificationRow | null> {
  const { data, error } = await untyped.from('imported_source_verifications')
    .select('id, revision_id, vfs_hash, adapter, artifact_hash, status, owner_confirmed, created_at')
    .eq('project_id', projectId)
    .eq('revision_id', revisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as ImportedVerificationRow;
}

export async function recordImportedSourceVerification(input: {
  projectId: string;
  revisionId: string;
  vfsHash: string;
  adapter: string;
  artifactHash: string;
  summary: VerificationSummary;
  ownerConfirmed: boolean;
  adaptations: string[];
}): Promise<{ verificationId: string; publishReady: boolean }> {
  const { data, error } = await untyped.rpc('record_imported_source_verification', {
    p_project_id: input.projectId,
    p_revision_id: input.revisionId,
    p_vfs_hash: input.vfsHash,
    p_adapter: input.adapter,
    p_adapter_version: IMPORTED_VERIFICATION_VERSION,
    p_artifact_hash: input.artifactHash,
    p_status: input.summary.status,
    p_routes: input.summary.routes,
    p_checks: { problems: input.summary.problems, adaptations: input.adaptations },
    p_owner_confirmed: input.ownerConfirmed,
  });
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as { verification_id?: string; publish_ready?: boolean };
  return { verificationId: String(result.verification_id ?? ''), publishReady: result.publish_ready === true };
}

/**
 * Saves a check for the saved revision matching `files`, recording the hash of
 * the files publishing would ship. The server marks that same revision ready
 * only for a passing, owner-confirmed check.
 */
export async function saveImportedVerification(input: {
  projectId: string;
  files: Record<string, string>;
  records: import('@/services/import/importedSourceRecords').ImportedSourceRecords;
  adapter: string;
  summary: VerificationSummary;
  ownerConfirmed: boolean;
  adaptations: string[];
  build?: Parameters<typeof import('@/services/import/importedPublishArtifact').buildImportedPublishArtifact>[0]['build'];
}): Promise<{ publishReady: boolean }> {
  const revision = await findSavedImportedRevision(input.projectId, input.files);
  if (!revision) throw new Error('Save your latest changes first; only a saved version can be checked for publishing.');
  const { buildImportedPublishArtifact } = await import('@/services/import/importedPublishArtifact');
  const artifact = await buildImportedPublishArtifact({ adapter: input.adapter, records: input.records, files: input.files, build: input.build });
  const result = await recordImportedSourceVerification({
    projectId: input.projectId,
    revisionId: revision.id,
    vfsHash: revision.vfsHash,
    adapter: input.adapter,
    artifactHash: artifact.hash,
    summary: input.summary,
    ownerConfirmed: input.ownerConfirmed,
    adaptations: input.adaptations,
  });
  return { publishReady: result.publishReady };
}
