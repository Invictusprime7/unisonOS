/**
 * Client runner for capability pack migrations.
 *
 * Preview is generated locally from the pack contracts so the approval UI can
 * show exactly what will run. Execution happens in the
 * `capability-migration-apply` edge function, which re-derives the same SQL
 * server-side — the client never sends SQL.
 */

import { supabase } from '@/integrations/supabase/client';
import { buildCapabilityMigration, type MigrationStatement } from '@/platform/core/capabilityMigrationSql';
import type { CapabilityPack } from '@/platform/core/capabilityPacks';
import { describeLintResult, lintMigrationSql, type MigrationLintResult } from './migrationSqlLint';

export interface CapabilityMigrationPreview {
  statements: MigrationStatement[];
  sql: string;
  tables: string[];
  lint: MigrationLintResult;
}

export interface CapabilityMigrationResult {
  success: boolean;
  status: 'applied' | 'approved' | 'failed' | 'skipped';
  tables: string[];
  packs: string[];
  siteId?: string | null;
  installedCapabilities?: string[];
  applied: number;
  failed: number;
  error?: string;
  proposalId?: string | null;
}

/** What the migration will do, derived locally for the approval card. */
export function previewCapabilityMigration(packs: CapabilityPack[]): CapabilityMigrationPreview {
  const migration = buildCapabilityMigration(packs);
  return { ...migration, lint: lintMigrationSql(migration.sql) };
}

async function describeInvocationError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'The backend migration could not be reached.';
  const context = (error as { context?: Response } | null)?.context;
  if (!context) return fallback;

  try {
    const payload = await context.clone().json() as { error?: unknown; message?: unknown };
    const detail = typeof payload.error === 'string'
      ? payload.error
      : payload.error !== undefined
        ? JSON.stringify(payload.error)
        : typeof payload.message === 'string'
          ? payload.message
          : null;
    return detail ? `${detail} (status ${context.status})` : `${fallback} (status ${context.status})`;
  } catch {
    return `${fallback} (status ${context.status})`;
  }
}

export interface ApplyCapabilityMigrationInput {
  packs: CapabilityPack[];
  businessId: string | null;
  projectId?: string | null;
  siteId?: string | null;
  /** Validate + roll back instead of committing. */
  dryRun?: boolean;
  summary?: string;
}

/** Executes the pack DDL through the gated edge function. */
export async function applyCapabilityMigration(
  input: ApplyCapabilityMigrationInput,
): Promise<CapabilityMigrationResult> {
  const packs = input.packs;
  const preview = previewCapabilityMigration(packs);

  if (packs.length === 0 || preview.statements.length === 0) {
    return { success: true, status: 'skipped', tables: [], packs: [], applied: 0, failed: 0 };
  }
  if (!input.businessId && !input.projectId) {
    return {
      success: false,
      status: 'failed',
      tables: preview.tables,
      packs: packs.map((pack) => pack.id),
      applied: 0,
      failed: preview.statements.length,
      error: 'A saved business or project is required before backend changes can be applied.',
    };
  }
  if (!preview.lint.ok) {
    return {
      success: false,
      status: 'failed',
      tables: preview.tables,
      packs: packs.map((pack) => pack.id),
      applied: 0,
      failed: preview.statements.length,
      error: describeLintResult(preview.lint),
    };
  }



  const { data, error } = await supabase.functions.invoke('capability-migration-apply', {
    body: {
      capabilities: packs.map((pack) => pack.id),
      businessId: input.businessId ?? undefined,
      projectId: input.projectId ?? undefined,
      siteId: input.siteId ?? undefined,
      dryRun: input.dryRun ?? false,
      summary: input.summary,
    },
  });

  if (error) {
    return {
      success: false,
      status: 'failed',
      tables: preview.tables,
      packs: packs.map((pack) => pack.id),
      applied: 0,
      failed: preview.statements.length,
      error: await describeInvocationError(error),
    };
  }

  const payload = (data ?? {}) as {
    status?: CapabilityMigrationResult['status'];
    tables?: string[];
    packs?: string[];
    error?: string | null;
    proposalId?: string | null;
    siteId?: string | null;
    installedCapabilities?: string[];
    results?: Array<{ status: string }>;
  };
  const results = payload.results ?? [];
  const applied = results.filter((result) => result.status === 'applied').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const status = payload.status ?? (payload.error ? 'failed' : 'applied');

  return {
    success: status !== 'failed' && !payload.error,
    status,
    tables: payload.tables ?? preview.tables,
    packs: payload.packs ?? packs.map((pack) => pack.id),
    siteId: payload.siteId,
    installedCapabilities: payload.installedCapabilities ?? [],
    applied,
    failed,
    error: payload.error ?? undefined,
    proposalId: payload.proposalId ?? null,
  };
}
