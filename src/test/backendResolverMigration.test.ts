// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { lintMigrationSql } from '@/services/migrationSqlLint';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015232037_add_project_backend_resolver_rpcs.sql'),
  'utf8',
);
const disconnectedFix = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261015233034_fail_closed_disconnected_backend_bindings.sql'),
  'utf8',
);
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';
const otherBusinessId = '44444444-4444-4444-8444-444444444444';
const projectId = '55555555-5555-4555-8555-555555555555';
const dedicatedProjectId = '66666666-6666-4666-8666-666666666666';
const draftProjectId = '77777777-7777-4777-8777-777777777777';
const siteId = '88888888-8888-4888-8888-888888888888';
const dedicatedSiteId = '99999999-9999-4999-8999-999999999999';
const draftSiteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let db: PGlite;

async function seedProject(input: {
  id: string;
  businessId?: string;
  siteId: string;
  publishStatus?: string;
  siteStatus?: string;
  memberId?: string;
}) {
  await db.query(
    'INSERT INTO public.projects(id,business_id,site_id,publish_status) VALUES ($1,$2,$3,$4)',
    [input.id, input.businessId ?? businessId, input.siteId, input.publishStatus ?? 'draft'],
  );
  await db.query('INSERT INTO public.sites(id,business_id,status) VALUES ($1,$2,$3)', [
    input.siteId, input.businessId ?? businessId, input.siteStatus ?? 'preview',
  ]);
  if (input.memberId) {
    await db.query('INSERT INTO public.project_members(project_id,user_id) VALUES ($1,$2)', [input.id, input.memberId]);
  }
}

async function setAuthUser(id: string | null) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $body$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $body$;
    CREATE TABLE public.projects (
      id uuid PRIMARY KEY,
      business_id uuid NOT NULL,
      site_id uuid,
      publish_status text NOT NULL DEFAULT 'draft',
      owner_id uuid
    );
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      business_id uuid NOT NULL,
      status text NOT NULL
    );
    CREATE TABLE public.project_members (project_id uuid NOT NULL, user_id uuid NOT NULL);
    CREATE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid) RETURNS boolean
      LANGUAGE sql STABLE
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _user_id
        ) OR EXISTS (
          SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = _user_id
        )
      $body$;
    CREATE TABLE public.connected_supabase_projects (
      id uuid PRIMARY KEY,
      business_id uuid NOT NULL,
      unison_project_id uuid,
      project_url text,
      secret_key_ciphertext text,
      schema_version integer,
      provisioning_status text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.exec(migration);
  await db.exec(disconnectedFix);
  await seedProject({ id: projectId, siteId, memberId: userId });
  await seedProject({ id: dedicatedProjectId, siteId: dedicatedSiteId, memberId: userId });
  await seedProject({
    id: draftProjectId,
    siteId: draftSiteId,
    publishStatus: 'published',
    siteStatus: 'building',
    memberId: userId,
  });
});

afterEach(async () => {
  await db.close();
});

describe('project backend resolver RPC migration', () => {
  it('passes the repository SQL safety lint', () => {
    expect(lintMigrationSql(migration).ok).toBe(true);
    expect(lintMigrationSql(disconnectedFix).ok).toBe(true);
    expect(disconnectedFix).not.toContain("AND b.provisioning_status <> 'disconnected'");
    expect(disconnectedFix).toContain("IN ('failed', 'disconnected')");
  });

  it('returns a shared descriptor only to an authenticated project member', async () => {
    await setAuthUser(userId);
    const result = await db.query<{ descriptor: Record<string, unknown> }>(
      'SELECT public.resolve_project_backend($1) AS descriptor', [projectId],
    );

    expect(result.rows[0].descriptor).toMatchObject({
      bindingId: `shared:${projectId}`,
      projectId,
      siteId,
      mode: 'shared-legacy',
      provider: 'supabase',
      status: 'ready',
    });
    await setAuthUser(otherUserId);
    await expect(db.query('SELECT public.resolve_project_backend($1)', [projectId]))
      .rejects.toThrow('Project access denied');
  });

  it('returns dedicated status and public URL without exposing encrypted secrets', async () => {
    await db.query(
      `INSERT INTO public.connected_supabase_projects
        (id,business_id,unison_project_id,project_url,secret_key_ciphertext,schema_version,provisioning_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', businessId, dedicatedProjectId,
        'https://dedicated.test', 'encrypted-secret', 1, 'ready'],
    );
    await setAuthUser(userId);

    const result = await db.query<{ descriptor: Record<string, unknown> }>(
      'SELECT public.resolve_project_backend($1) AS descriptor', [dedicatedProjectId],
    );
    expect(result.rows[0].descriptor).toMatchObject({
      projectId: dedicatedProjectId,
      siteId: dedicatedSiteId,
      mode: 'dedicated',
      status: 'ready',
      projectUrl: 'https://dedicated.test',
      publishableKey: null,
    });
    expect(JSON.stringify(result.rows[0].descriptor)).not.toContain('encrypted-secret');
  });

  it('rejects a connected binding whose business does not match its project', async () => {
    await db.query(
      `INSERT INTO public.connected_supabase_projects
        (id,business_id,unison_project_id,project_url,schema_version,provisioning_status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['cccccccc-cccc-4ccc-8ccc-cccccccccccc', otherBusinessId, dedicatedProjectId,
        'https://wrong-business.test', 1, 'ready'],
    );
    await setAuthUser(userId);

    await expect(db.query('SELECT public.resolve_project_backend($1)', [dedicatedProjectId]))
      .rejects.toThrow('Backend binding does not match project identity');
  });

  it('never maps a disconnected dedicated binding back to shared mode', async () => {
    await db.query(
      `INSERT INTO public.connected_supabase_projects
        (id,business_id,unison_project_id,project_url,schema_version,provisioning_status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', businessId, projectId,
        'https://disconnected.test', 1, 'disconnected'],
    );
    await setAuthUser(userId);

    const runtime = await db.query<{ descriptor: Record<string, unknown> }>(
      'SELECT public.resolve_project_backend($1) AS descriptor', [projectId],
    );
    expect(runtime.rows[0].descriptor).toMatchObject({
      projectId,
      mode: 'dedicated',
      status: 'failed',
      projectUrl: null,
    });

    await db.query('UPDATE public.projects SET publish_status = $2 WHERE id = $1', [projectId, 'published']);
    await expect(db.query('SELECT public.resolve_published_site_backend($1)', [projectId]))
      .rejects.toThrow('Dedicated site backend is disconnected');
  });

  it('returns only published shared-site identities and fails closed for dedicated public reads', async () => {
    await db.query('UPDATE public.projects SET publish_status = $2 WHERE id = $1', [projectId, 'published']);
    const published = await db.query<{ descriptor: Record<string, unknown> }>(
      'SELECT public.resolve_published_site_backend($1) AS descriptor', [projectId],
    );
    expect(published.rows[0].descriptor).toMatchObject({
      projectId,
      siteId,
      mode: 'shared-legacy',
      status: 'ready',
      projectUrl: null,
      publishableKey: null,
    });

    await expect(db.query('SELECT public.resolve_published_site_backend($1)', [draftProjectId]))
      .rejects.toThrow('Published site is unavailable');

    await db.query(
      `INSERT INTO public.connected_supabase_projects
        (id,business_id,unison_project_id,project_url,schema_version,provisioning_status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['dddddddd-dddd-4ddd-8ddd-dddddddddddd', businessId, projectId,
        'https://dedicated.test', 1, 'ready'],
    );
    await expect(db.query('SELECT public.resolve_published_site_backend($1)', [projectId]))
      .rejects.toThrow('Dedicated public reads are not available yet');
  });

  it('grants the project resolver to signed-in users and the published resolver to visitors', async () => {
    const result = await db.query<{ anon_project: boolean; auth_project: boolean; anon_published: boolean }>(`
      SELECT
        has_function_privilege('anon', 'public.resolve_project_backend(uuid)', 'EXECUTE') AS anon_project,
        has_function_privilege('authenticated', 'public.resolve_project_backend(uuid)', 'EXECUTE') AS auth_project,
        has_function_privilege('anon', 'public.resolve_published_site_backend(uuid)', 'EXECUTE') AS anon_published
    `);
    expect(result.rows[0]).toEqual({ anon_project: false, auth_project: true, anon_published: true });
  });
});