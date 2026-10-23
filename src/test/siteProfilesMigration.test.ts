// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { lintMigrationSql } from '@/services/migrationSqlLint';

const firstUser = '11111111-1111-4111-8111-111111111111';
const secondUser = '22222222-2222-4222-8222-222222222222';
const firstBusiness = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondBusiness = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const firstProject = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const secondProject = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

async function createDatabase() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, owner_id uuid NOT NULL);
    CREATE TABLE public.projects (id uuid PRIMARY KEY, business_id uuid NOT NULL);
    CREATE TABLE public.project_members (project_id uuid NOT NULL, user_id uuid NOT NULL);
    CREATE TABLE public.business_members (business_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL);
    CREATE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.project_members
          WHERE user_id = _user_id AND project_id = _project_id
        )
      $$;
    CREATE FUNCTION public.is_business_admin(_user_id uuid, _business_id uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.businesses
          WHERE owner_id = _user_id AND id = _business_id
        ) OR EXISTS (
          SELECT 1 FROM public.business_members
          WHERE user_id = _user_id AND business_id = _business_id AND role IN ('owner', 'admin')
        )
      $$;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
      LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $$;
    GRANT USAGE ON SCHEMA public TO authenticated;
  `);

  const migration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20261022225127_site_profiles.sql'),
    'utf8',
  );
  await pg.exec(migration);
  await pg.exec(`
    INSERT INTO public.businesses (id, owner_id) VALUES
      ('${firstBusiness}', '${firstUser}'), ('${secondBusiness}', '${secondUser}');
    INSERT INTO public.projects (id, business_id) VALUES
      ('${firstProject}', '${firstBusiness}'), ('${secondProject}', '${secondBusiness}');
    INSERT INTO public.project_members (project_id, user_id) VALUES
      ('${firstProject}', '${firstUser}'), ('${secondProject}', '${secondUser}');
    INSERT INTO public.site_profiles (project_id, business_id, overrides) VALUES
      ('${firstProject}', '${firstBusiness}', '{"tagline":"First"}'),
      ('${secondProject}', '${secondBusiness}', '{"tagline":"Second"}');
  `);
  return pg;
}

describe('site_profiles migration', () => {
  let pg: PGlite | undefined;

  afterEach(async () => {
    await pg?.close();
    pg = undefined;
  });

  it('creates the RLS-protected table and limits reads to the current project member', async () => {
    pg = await createDatabase();
    await pg.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [firstUser]);
    await pg.exec('SET ROLE authenticated');

    const visible = await pg.query<{ project_id: string; overrides: { tagline: string } }>(
      'SELECT project_id, overrides FROM public.site_profiles ORDER BY project_id',
    );
    expect(visible.rows).toEqual([{ project_id: firstProject, overrides: { tagline: 'First' } }]);

    const policies = await pg.query<{ policyname: string }>(
      "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_profiles' ORDER BY policyname",
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual([
      'Business admins delete site profile',
      'Business admins insert site profile',
      'Business admins update site profile',
      'Site members read site profile',
    ]);
  });

  it('can be applied twice without duplicating policies or triggers', async () => {
    pg = new PGlite();
    await pg.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
      CREATE TABLE public.businesses (id uuid PRIMARY KEY, owner_id uuid NOT NULL);
      CREATE TABLE public.projects (id uuid PRIMARY KEY, business_id uuid NOT NULL);
      CREATE TABLE public.project_members (project_id uuid NOT NULL, user_id uuid NOT NULL);
      CREATE TABLE public.business_members (business_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL);
      CREATE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;
      CREATE FUNCTION public.is_business_admin(_user_id uuid, _business_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;
      CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
    `);
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261022225127_site_profiles.sql'),
      'utf8',
    );
    await pg.exec(migration);
    await pg.exec(migration);

    const count = await pg.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_profiles'",
    );
    expect(count.rows[0].count).toBe('4');
  });

  it('scopes site_intent_bindings.business_id to businesses instead of auth users', async () => {
    pg = new PGlite();
    await pg.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      CREATE TABLE public.businesses (id uuid PRIMARY KEY);
      CREATE TABLE public.site_intent_bindings (
        id uuid PRIMARY KEY,
        business_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
      );
      INSERT INTO auth.users VALUES ('${firstUser}');
      INSERT INTO public.businesses VALUES ('${firstBusiness}');
    `);
    const migration = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261022230742_site_intent_bindings_business_fk.sql'),
      'utf8',
    );
    expect(lintMigrationSql(migration).ok).toBe(true);
    await pg.exec(migration);
    await pg.exec(migration);

    const foreignKey = await pg.query<{ referenced_table: string }>(
      `SELECT confrelid::regclass::text AS referenced_table
       FROM pg_constraint
       WHERE conrelid = 'public.site_intent_bindings'::regclass
         AND conname = 'site_intent_bindings_business_id_businesses_fkey'`,
    );
    expect(foreignKey.rows).toEqual([{ referenced_table: 'businesses' }]);

    await pg.query('INSERT INTO public.site_intent_bindings (id, business_id) VALUES ($1, $2)', [
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', firstBusiness,
    ]);
    await expect(pg.query(
      'INSERT INTO public.site_intent_bindings (id, business_id) VALUES ($1, $2)',
      ['ffffffff-ffff-4fff-8fff-ffffffffffff', firstUser],
    )).rejects.toThrow();
  });
});
