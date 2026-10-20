// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migrations = [
  '20261018051537_guest_demo_credit_ledger.sql',
  '20261018124819_guest_demo_provider_usage.sql',
].map((name) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8'));

const guestId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
const draftId = '44444444-4444-4444-8444-444444444444';
const operations = [
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
];

async function createDatabase() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA private;
    CREATE FUNCTION private.existing_project_access_helper() RETURNS boolean
      LANGUAGE sql AS $$ SELECT true $$;
    GRANT USAGE ON SCHEMA private TO authenticated;
    GRANT EXECUTE ON FUNCTION private.existing_project_access_helper() TO authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, is_anonymous boolean NOT NULL);
    CREATE TABLE public.projects (id uuid PRIMARY KEY, owner_id uuid NOT NULL);
    CREATE TABLE public.builder_drafts (
      id uuid PRIMARY KEY,
      project_id uuid NOT NULL,
      user_id uuid NOT NULL
    );
    CREATE TABLE public.site_revisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL,
      draft_id uuid NOT NULL,
      status text NOT NULL,
      created_by uuid NOT NULL,
      operation_ids text[] NOT NULL
    );
  `);
  for (const migration of migrations) await pg.exec(migration);
  return pg;
}

async function createGuestSession(pg: PGlite) {
  await pg.query('INSERT INTO auth.users (id, is_anonymous) VALUES ($1, true)', [guestId]);
  await pg.query('SELECT private.ensure_guest_demo_session($1)', [guestId]);
}

async function createGuestProject(pg: PGlite) {
  await createGuestSession(pg);
  await pg.query('INSERT INTO public.projects (id, owner_id) VALUES ($1, $2)', [projectId, guestId]);
  await pg.query('INSERT INTO public.builder_drafts (id, project_id, user_id) VALUES ($1, $2, $3)', [draftId, projectId, guestId]);
  await pg.query('SELECT private.bind_guest_demo_project($1, $2, $3)', [guestId, projectId, draftId]);
}

async function reserve(
  pg: PGlite,
  operationId: string,
  boundProjectId: string | null = projectId,
  boundDraftId: string | null = draftId,
) {
  return pg.query(
    'SELECT private.reserve_guest_demo_ai_action($1, $2, $3, $4) AS reservation',
    [guestId, boundProjectId, boundDraftId, operationId],
  );
}

describe('guest demo credit ledger migration', () => {
  it('keeps the policy server-owned and defaults beta allowance to three actions', async () => {
    const pg = await createDatabase();
    try {
      const policy = await pg.query<{ action_allowance: number }>(
        "SELECT action_allowance FROM private.guest_demo_policy WHERE policy_key = 'beta'",
      );
      expect(policy.rows[0]?.action_allowance).toBe(3);

      const privileges = await pg.query<{
        can_read: boolean;
        can_reserve: boolean;
        can_use_private: boolean;
        can_call_existing_helper: boolean;
      }>(`
        SELECT
          has_table_privilege('authenticated', 'private.guest_demo_sessions', 'SELECT') AS can_read,
          has_function_privilege('authenticated', 'private.reserve_guest_demo_ai_action(uuid,uuid,uuid,uuid)', 'EXECUTE') AS can_reserve,
          has_schema_privilege('authenticated', 'private', 'USAGE') AS can_use_private,
          has_function_privilege('authenticated', 'private.existing_project_access_helper()', 'EXECUTE') AS can_call_existing_helper
      `);
      expect(privileges.rows[0]).toEqual({
        can_read: false,
        can_reserve: false,
        can_use_private: true,
        can_call_existing_helper: true,
      });
    } finally {
      await pg.close();
    }
  }, 15_000);

  it('settles only a matching committed revision and rejects a fourth reserved action', async () => {
    const pg = await createDatabase();
    try {
      await createGuestSession(pg);
      await reserve(pg, operations[0], null, null);

      await pg.query(
        'INSERT INTO public.site_revisions (project_id, draft_id, status, created_by, operation_ids) VALUES ($1, $2, $3, $4, $5)',
        [projectId, draftId, 'rejected', guestId, [`guest-demo:${operations[0]}`]],
      );
      const afterRejected = await pg.query<{ status: string }>(
        'SELECT status FROM private.guest_demo_ai_operations WHERE operation_id = $1',
        [operations[0]],
      );
      expect(afterRejected.rows[0]?.status).toBe('reserved');

      await pg.query('INSERT INTO public.projects (id, owner_id) VALUES ($1, $2)', [projectId, guestId]);
      await pg.query('INSERT INTO public.builder_drafts (id, project_id, user_id) VALUES ($1, $2, $3)', [draftId, projectId, guestId]);
      await pg.query(
        'INSERT INTO public.site_revisions (project_id, draft_id, status, created_by, operation_ids) VALUES ($1, $2, $3, $4, $5)',
        [projectId, draftId, 'committed', guestId, [`guest-demo:${operations[0]}`]],
      );
      const afterCommit = await pg.query<{ status: string; settled_revision_id: string | null }>(
        'SELECT status, settled_revision_id FROM private.guest_demo_ai_operations WHERE operation_id = $1',
        [operations[0]],
      );
      expect(afterCommit.rows[0]?.status).toBe('settled');
      expect(afterCommit.rows[0]?.settled_revision_id).toBeTruthy();

      await reserve(pg, operations[1]);
      await reserve(pg, operations[2]);
      await expect(reserve(pg, operations[3])).rejects.toThrow('Insufficient guest demo AI actions');
    } finally {
      await pg.close();
    }
  });

  it('treats retries with the same operation ID as one action reservation', async () => {
    const pg = await createDatabase();
    try {
      await createGuestProject(pg);
      await reserve(pg, operations[0]);
      await reserve(pg, operations[0]);

      const rows = await pg.query<{ count: number; ai_request_count: number; status: string }>(`
        SELECT count(*)::integer AS count, max(ai_request_count)::integer AS ai_request_count,
          max(status) AS status
        FROM private.guest_demo_ai_operations
        WHERE guest_user_id = $1 AND operation_id = $2
      `, [guestId, operations[0]]);
      expect(rows.rows[0]).toEqual({ count: 1, ai_request_count: 2, status: 'reserved' });
    } finally {
      await pg.close();
    }
  });

  it('rolls back a committed revision that tries to settle another identity’s operation', async () => {
    const pg = await createDatabase();
    try {
      await createGuestProject(pg);
      await reserve(pg, operations[0]);

      await expect(pg.query(
        'INSERT INTO public.site_revisions (project_id, draft_id, status, created_by, operation_ids) VALUES ($1, $2, $3, $4, $5)',
        [projectId, draftId, 'committed', otherUserId, [`guest-demo:${operations[0]}`]],
      )).rejects.toThrow('Guest AI operation cannot be settled by this revision');

      const operation = await pg.query<{ status: string }>(
        'SELECT status FROM private.guest_demo_ai_operations WHERE operation_id = $1',
        [operations[0]],
      );
      expect(operation.rows[0]?.status).toBe('reserved');
    } finally {
      await pg.close();
    }
  });

  it('reserves provider cost before generation and requires settled usage before revision commit', async () => {
    const pg = await createDatabase();
    try {
      await createGuestProject(pg);
      await reserve(pg, operations[0]);

      const providerCallId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const reserved = await pg.query<{ usage: { reserved_cost_microusd: number } }>(
        'SELECT private.reserve_guest_demo_provider_call($1, $2, $3, $4, $5, $6) AS usage',
        [guestId, operations[0], providerCallId, 'gemini-3.8-flash', 1000, 1000],
      );
      expect(reserved.rows[0]?.usage.reserved_cost_microusd).toBe(9000);

      await expect(pg.query(
        'INSERT INTO public.site_revisions (project_id, draft_id, status, created_by, operation_ids) VALUES ($1, $2, $3, $4, $5)',
        [projectId, draftId, 'committed', guestId, [`guest-demo:${operations[0]}`]],
      )).rejects.toThrow('Guest AI provider usage is not settled');

      const settled = await pg.query<{ usage: { actual_cost_microusd: number; operation_cost_microusd: number } }>(
        'SELECT private.settle_guest_demo_provider_call($1, $2, $3, $4, $5) AS usage',
        [guestId, operations[0], providerCallId, 500, 250],
      );
      expect(settled.rows[0]?.usage).toMatchObject({ actual_cost_microusd: 2625, operation_cost_microusd: 2625 });

      await pg.query('UPDATE private.guest_demo_ai_operations SET max_cost_microusd = 10000 WHERE operation_id = $1', [operations[0]]);
      await expect(pg.query(
        'SELECT private.reserve_guest_demo_provider_call($1, $2, $3, $4, $5, $6)',
        [guestId, operations[0], 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'gemini-3.8-flash', 1000, 1000],
      )).rejects.toThrow('Guest demo action cost limit reached');

      await pg.query(
        'INSERT INTO public.site_revisions (project_id, draft_id, status, created_by, operation_ids) VALUES ($1, $2, $3, $4, $5)',
        [projectId, draftId, 'committed', guestId, [`guest-demo:${operations[0]}`]],
      );

      await reserve(pg, operations[1]);
      await pg.query("UPDATE private.guest_demo_policy SET max_session_cost_microusd = 10000 WHERE policy_key = 'beta'");
      await expect(pg.query(
        'SELECT private.reserve_guest_demo_provider_call($1, $2, $3, $4, $5, $6)',
        [guestId, operations[1], 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'gemini-3.8-flash', 1000, 1000],
      )).rejects.toThrow('Guest demo session cost limit reached');
    } finally {
      await pg.close();
    }
  });
});