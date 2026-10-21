/**
 * capabilityProvisioner — Step 5 of the capability plan: one transaction
 * orchestrator behind a single user approval.
 *
 * Sequence (each step reports its own status; the run stops at the first
 * hard failure and unwinds what can be unwound):
 *
 *   approve → lint → dry-run migration → apply migration → verify tables
 *     → install backend ops → seed fixtures → commit VFS | rollback
 *
 * Honest limits:
 *   - Capability DDL is additive only (GRANT / ENABLE RLS / guarded CREATE
 *     POLICY). There is nothing destructive to undo, so "rollback" after a
 *     successful migration means: stop, do not commit the VFS half, and report.
 *   - The VFS half is committed through `vfsCommitService`, which is itself
 *     transactional — so either both halves land or the site files stay
 *     untouched.
 *   - Edge functions are never deployed from here; they stay proposal-only.
 */

import type { BuilderIdentity } from '@/types/builderIdentity';
import type { PatchPlan } from '@/types/patchPlan';
import type { CapabilityPack } from '@/platform/core/capabilityPacks';
import { supabase } from '@/integrations/supabase/client';
import { executeBackendOps } from './backendOpExecutor';
import {
  applyCapabilityMigration,
  previewCapabilityMigration,
  type CapabilityMigrationResult,
} from './capabilityMigrationRunner';
import { describeLintResult } from './migrationSqlLint';
import { commitMutation, type CommitMutationInput, type CommitMutationResult } from './vfsCommitService';

export type ProvisionStepId =
  | 'lint'
  | 'dry-run'
  | 'apply-migration'
  | 'verify-schema'
  | 'backend-ops'
  | 'commit-vfs';

export type ProvisionStepStatus = 'ok' | 'skipped' | 'failed';

export interface ProvisionStepResult {
  id: ProvisionStepId;
  status: ProvisionStepStatus;
  message: string;
  detail?: unknown;
}

export interface ProvisionCapabilitiesInput {
  identity: BuilderIdentity;
  siteId?: string | null;
  packs: CapabilityPack[];
  /** Explicit user approval is mandatory — the caller passes the record. */
  approval: { approvedBy: string; approvedAt: string };
  /** Optional VFS half committed atomically with the backend half. */
  vfs?: Omit<CommitMutationInput, 'identity'>;
  /** Backend ops (requireCapability / seedCapability) run after the schema. */
  backendOps?: PatchPlan['backendOps'];
  summary?: string;
}

export interface ProvisionCapabilitiesResult {
  status: 'provisioned' | 'rolled-back';
  steps: ProvisionStepResult[];
  migration: CapabilityMigrationResult | null;
  commit: CommitMutationResult | null;
  /** Tables the run asserts exist afterwards. */
  tables: string[];
  error?: string;
}

/** Read-only existence probe — a 0-row select proves table + grant + policy path. */
async function verifyTables(tables: string[]): Promise<{ missing: string[]; blocked: string[] }> {
  const missing: string[] = [];
  const blocked: string[] = [];
  for (const table of tables) {
    const client = supabase as unknown as {
      from: (t: string) => { select: (c: string) => { limit: (n: number) => Promise<{ error: { message: string; code?: string } | null }> } };
    };
    const { error } = await client.from(table).select('*').limit(0);
    if (!error) continue;
    const message = error.message ?? '';
    if (/does not exist|could not find the table|schema cache/i.test(message)) missing.push(table);
    else blocked.push(`${table}: ${message}`);
  }
  return { missing, blocked };
}

export async function provisionCapabilities(
  input: ProvisionCapabilitiesInput,
): Promise<ProvisionCapabilitiesResult> {
  const steps: ProvisionStepResult[] = [];
  const push = (step: ProvisionStepResult) => {
    steps.push(step);
    return step;
  };

  const finish = (
    status: ProvisionCapabilitiesResult['status'],
    partial: Partial<ProvisionCapabilitiesResult> = {},
  ): ProvisionCapabilitiesResult => ({
    status,
    steps,
    migration: partial.migration ?? null,
    commit: partial.commit ?? null,
    tables: partial.tables ?? [],
    error: partial.error,
  });

  if (!input.approval?.approvedBy) {
    push({ id: 'lint', status: 'failed', message: 'Provisioning requires an explicit approval record.' });
    return finish('rolled-back', { error: 'Missing approval.' });
  }

  const preview = previewCapabilityMigration(input.packs);

  // 1. Lint --------------------------------------------------------------
  if (!preview.lint.ok) {
    push({ id: 'lint', status: 'failed', message: describeLintResult(preview.lint), detail: preview.lint });
    return finish('rolled-back', { error: describeLintResult(preview.lint), tables: preview.tables });
  }
  push({ id: 'lint', status: 'ok', message: describeLintResult(preview.lint), detail: preview.lint.warnings });

  const businessId = input.identity.businessId ?? null;
  const projectId = input.identity.projectId ?? null;

  // 2. Dry run -----------------------------------------------------------
  if (preview.statements.length === 0) {
    push({ id: 'dry-run', status: 'skipped', message: 'No schema changes required.' });
    push({ id: 'apply-migration', status: 'skipped', message: 'No schema changes required.' });
  } else {
    const dry = await applyCapabilityMigration({
      packs: input.packs,
      businessId,
      projectId,
      siteId: input.siteId,
      dryRun: true,
      summary: input.summary,
    });
    if (!dry.success) {
      push({ id: 'dry-run', status: 'failed', message: dry.error ?? 'Dry run failed.', detail: dry });
      return finish('rolled-back', { migration: dry, error: dry.error, tables: preview.tables });
    }
    push({ id: 'dry-run', status: 'ok', message: `Validated ${preview.statements.length} statement(s).` });
  }

  // 3. Apply -------------------------------------------------------------
  let migration: CapabilityMigrationResult | null = null;
  if (preview.statements.length > 0) {
    migration = await applyCapabilityMigration({
      packs: input.packs,
      businessId,
      projectId,
      siteId: input.siteId,
      dryRun: false,
      summary: input.summary,
    });
    if (!migration.success) {
      push({ id: 'apply-migration', status: 'failed', message: migration.error ?? 'Migration failed.', detail: migration });
      return finish('rolled-back', { migration, error: migration.error, tables: preview.tables });
    }
    push({
      id: 'apply-migration',
      status: 'ok',
      message: `Applied ${migration.applied} statement(s) across ${migration.tables.length} table(s).`,
    });
  }

  // 4. Verify ------------------------------------------------------------
  const tables = migration?.tables ?? preview.tables;
  if (tables.length === 0) {
    push({ id: 'verify-schema', status: 'skipped', message: 'Nothing to verify.' });
  } else {
    const { missing, blocked } = await verifyTables(tables);
    if (missing.length > 0) {
      const message = `Missing after migration: ${missing.join(', ')}.`;
      push({ id: 'verify-schema', status: 'failed', message, detail: { missing, blocked } });
      return finish('rolled-back', { migration, error: message, tables });
    }
    push({
      id: 'verify-schema',
      status: 'ok',
      message: blocked.length > 0
        ? `All tables exist; ${blocked.length} are RLS-restricted for this session (expected).`
        : `Verified ${tables.length} table(s).`,
      detail: { blocked },
    });
  }

  // 5. Backend ops -------------------------------------------------------
  const ops = input.backendOps ?? [];
  if (ops.length === 0) {
    push({ id: 'backend-ops', status: 'skipped', message: 'No backend ops requested.' });
  } else {
    const report = await executeBackendOps(ops, input.identity);
    if (report.failedCount > 0) {
      const message = `${report.failedCount} backend op(s) failed.`;
      push({ id: 'backend-ops', status: 'failed', message, detail: report });
      return finish('rolled-back', { migration, error: message, tables });
    }
    push({ id: 'backend-ops', status: 'ok', message: `Ran ${report.results.length} backend op(s).`, detail: report });
  }

  // 6. VFS commit --------------------------------------------------------
  if (!input.vfs) {
    push({ id: 'commit-vfs', status: 'skipped', message: 'No site file changes in this provision.' });
    return finish('provisioned', { migration, tables });
  }

  try {
    const commit = await commitMutation({ ...input.vfs, identity: input.identity });
    if (commit.status !== 'committed') {
      const message = commit.publishBlockers[0]?.message ?? 'The site commit was rejected.';
      push({ id: 'commit-vfs', status: 'failed', message, detail: commit.diagnostics });
      return finish('rolled-back', { migration, commit, error: message, tables });
    }
    push({ id: 'commit-vfs', status: 'ok', message: `Committed revision ${commit.persistedRevisionId ?? '(dry-run)'}.` });
    return finish('provisioned', { migration, commit, tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    push({ id: 'commit-vfs', status: 'failed', message });
    return finish('rolled-back', { migration, error: message, tables });
  }
}
