// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261018203900_account_demo_generation.sql', 'utf8');
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const project = '33333333-3333-4333-8333-333333333333';
const draft = '44444444-4444-4444-8444-444444444444';
const operation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function database() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, is_anonymous boolean);
    CREATE TABLE public.projects(id uuid PRIMARY KEY, owner_id uuid);
    CREATE TABLE public.builder_drafts(id uuid PRIMARY KEY, project_id uuid, user_id uuid);
    CREATE TABLE public.site_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid,
      draft_id uuid, created_by uuid, status text, source text, parent_revision_id uuid, operation_ids text[]);
    INSERT INTO auth.users VALUES ('${user}',false),('${other}',false);
    INSERT INTO public.projects VALUES ('${project}','${user}');
    INSERT INTO public.builder_drafts VALUES ('${draft}','${project}','${user}');
    SET request.jwt.claim.sub = '${user}';
  `);
  await pg.exec(sql);
  return pg;
}
async function status(pg: PGlite) {
  return (await pg.query<{ status: { generation_count: number; remaining: number; in_progress: boolean; project_id: string | null } }>('SELECT public.account_demo_status() AS status')).rows[0].status;
}
async function reserve(pg: PGlite, id = operation) {
  return pg.query('SELECT public.reserve_account_demo_generation($1)', [id]);
}
async function commit(pg: PGlite, id = operation, state = 'committed', owner = user) {
  return pg.query(`INSERT INTO public.site_revisions(project_id,draft_id,created_by,status,source,operation_ids)
    VALUES ($1,$2,$3,$4,'wizard-launch',$5) RETURNING id`, [project,draft,owner,state,[`account-demo:${id}`]]);
}

describe('one persistent free demo generation per account', () => {
  it('counts only a saved canonical demo revision, then refuses another generation after read-back', async () => {
    const pg = await database();
    try {
      expect(await status(pg)).toEqual({ generation_count: 0, remaining: 1, in_progress: false, project_id: null });
      await reserve(pg);
      await commit(pg, operation, 'rejected');
      expect((await status(pg)).generation_count).toBe(0);
      await commit(pg);
      await pg.query('SELECT public.release_account_demo_generation($1)', [operation]);
      await pg.exec(`SET request.jwt.claim.sub = '${other}'; SET request.jwt.claim.sub = '${user}';`);
      expect(await status(pg)).toEqual({ generation_count: 1, remaining: 0, in_progress: false, project_id: project });
      await expect(reserve(pg, second)).rejects.toThrow('used your free demo generation');
    } finally { await pg.close(); }
  });
  it('reserves one slot across tabs and retries the same operation idempotently', async () => {
    const pg = await database();
    try {
      await reserve(pg);
      await reserve(pg);
      await expect(reserve(pg, second)).rejects.toThrow('already in progress');
      expect(await status(pg)).toMatchObject({ generation_count: 0, remaining: 1, in_progress: true });
    } finally { await pg.close(); }
  });
  it('releases failed or discarded runs without using the free generation', async () => {
    const pg = await database();
    try {
      await reserve(pg);
      await pg.query('SELECT public.release_account_demo_generation($1)', [operation]);
      await reserve(pg, second);
      expect((await status(pg)).generation_count).toBe(0);
      await commit(pg, second);
      expect((await status(pg)).generation_count).toBe(1);
    } finally { await pg.close(); }
  });
  it('recovers abandoned reservations and rejects their late commits', async () => {
    const pg = await database();
    try {
      await reserve(pg);
      await pg.exec("UPDATE public.account_demo_generations SET reserved_until = now() - interval '1 second'");
      await expect(commit(pg)).rejects.toThrow('reservation is unavailable');
      await reserve(pg, second);
      await expect(commit(pg)).rejects.toThrow('reservation is unavailable');
      await commit(pg, second);
      expect((await status(pg)).generation_count).toBe(1);
    } finally { await pg.close(); }
  });
  it('keeps accounts isolated and refuses another account’s project or operation', async () => {
    const pg = await database();
    try {
      await reserve(pg);
      await pg.exec(`SET request.jwt.claim.sub = '${other}'`);
      expect((await status(pg)).remaining).toBe(1);
      await pg.query('SELECT public.release_account_demo_generation($1)', [operation]);
      await reserve(pg, second);
      await expect(commit(pg, second, 'committed', other)).rejects.toThrow('own new project draft');
      await pg.exec(`SET request.jwt.claim.sub = '${user}'`);
      await commit(pg);
      expect((await status(pg)).generation_count).toBe(1);
    } finally { await pg.close(); }
  });
  it('denies anonymous access and direct client counter writes', async () => {
    const pg = await database();
    try {
      const privileges = await pg.query<{ write: boolean; read: boolean; anon: boolean }>(`SELECT
        has_table_privilege('authenticated','public.account_demo_generations','UPDATE') AS write,
        has_table_privilege('authenticated','public.account_demo_generations','SELECT') AS read,
        has_function_privilege('anon','public.reserve_account_demo_generation(uuid)','EXECUTE') AS anon`);
      expect(privileges.rows[0]).toEqual({ write: false, read: true, anon: false });
      await pg.exec(`UPDATE auth.users SET is_anonymous = true WHERE id = '${user}'`);
      await expect(reserve(pg)).rejects.toThrow('Sign in');
      await expect(status(pg)).rejects.toThrow('Sign in');
    } finally { await pg.close(); }
  });
  it('rolls back usage together with a failed save transaction', async () => {
    const pg = await database();
    try {
      await reserve(pg);
      await pg.exec('BEGIN');
      await commit(pg);
      await pg.exec('ROLLBACK');
      expect((await status(pg)).generation_count).toBe(0);
      await commit(pg);
      expect((await status(pg)).generation_count).toBe(1);
    } finally { await pg.close(); }
  });
});