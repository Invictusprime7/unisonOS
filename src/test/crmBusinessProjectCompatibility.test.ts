// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20261020232357_crm_business_project_compatibility.sql',
), 'utf8');

const userOne = '11111111-1111-4111-8111-111111111111';
const userTwo = '22222222-2222-4222-8222-222222222222';
const businessOne = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const businessTwo = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const projectOne = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const projectTwo = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

async function database(legacySchema = false) {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

    CREATE TABLE public.businesses(id uuid PRIMARY KEY, owner_id uuid NOT NULL);
    CREATE TABLE public.business_members(business_id uuid NOT NULL, user_id uuid NOT NULL);
    CREATE TABLE public.projects(id uuid PRIMARY KEY, business_id uuid, owner_id uuid NOT NULL);
    CREATE TABLE public.workspace_members(workspace_id uuid NOT NULL, user_id uuid NOT NULL);

    CREATE FUNCTION public.is_business_member(p_business_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$ SELECT EXISTS (
        SELECT 1 FROM businesses b WHERE b.id = p_business_id AND b.owner_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM business_members bm WHERE bm.business_id = p_business_id AND bm.user_id = auth.uid()
      ) $$;
    CREATE FUNCTION public.is_project_member(p_user_id uuid, p_project_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $$ SELECT EXISTS (
        SELECT 1 FROM projects p WHERE p.id = p_project_id AND p.owner_id = p_user_id
      ) $$;

    CREATE TABLE public.crm_contacts(
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, business_id uuid, project_id uuid,
      user_id uuid, email text, first_name text, last_name text, phone text,
      company text, tags text[] DEFAULT '{}', source text, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.crm_leads(
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, business_id uuid, project_id uuid,
      user_id uuid, title text NOT NULL, stage text NOT NULL, email text, name text,
      phone text, source text, intent text, notes text, value numeric, metadata jsonb DEFAULT '{}'
    );
    CREATE TABLE public.crm_activities(
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, business_id uuid, project_id uuid,
      user_id uuid, type text NOT NULL, title text NOT NULL, description text,
      metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.crm_workflows(
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, project_id uuid, user_id uuid,
      name text NOT NULL, trigger_type text NOT NULL, trigger_config jsonb DEFAULT '{}',
      actions jsonb NOT NULL, active boolean DEFAULT true, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.crm_workflow_runs(
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, workflow_id uuid, status text,
      trigger_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.crm_workflow_jobs(
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, workflow_run_id uuid,
      action_type text NOT NULL, action_config jsonb NOT NULL, context_data jsonb,
      status text DEFAULT 'pending', scheduled_for timestamptz DEFAULT now(),
      attempts integer DEFAULT 0, max_attempts integer DEFAULT 3, last_error text,
      executed_at timestamptz, created_at timestamptz DEFAULT now()
    );

    INSERT INTO businesses(id, owner_id) VALUES ('${businessOne}', '${userOne}'), ('${businessTwo}', '${userTwo}');
    INSERT INTO projects(id, business_id, owner_id) VALUES
      ('${projectOne}', '${businessOne}', '${userOne}'),
      ('${projectTwo}', '${businessTwo}', '${userTwo}');
  `);
  if (legacySchema) {
    await pg.exec(`
      ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_email_key UNIQUE(email);
      ALTER TABLE public.crm_leads DROP COLUMN stage;
      ALTER TABLE public.crm_leads ADD COLUMN status text NOT NULL DEFAULT 'new';
      ALTER TABLE public.crm_activities DROP COLUMN type;
      ALTER TABLE public.crm_activities ADD COLUMN activity_type text NOT NULL DEFAULT 'note';
      ALTER TABLE public.crm_workflows DROP COLUMN actions;
      ALTER TABLE public.crm_workflows DROP COLUMN active;
      ALTER TABLE public.crm_workflows ADD COLUMN steps jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE public.crm_workflows ADD COLUMN is_active boolean NOT NULL DEFAULT true;
      CREATE TABLE public.crm_deals(
        id uuid PRIMARY KEY,
        user_id uuid,
        contact_id uuid,
        lead_id uuid,
        title text NOT NULL,
        stage text DEFAULT 'prospecting',
        value numeric,
        expected_close_date date,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
      CREATE POLICY legacy_deals_select ON public.crm_deals
        FOR SELECT TO authenticated USING (user_id = auth.uid());
    `);
  }
  return pg;
}

describe('CRM business/project compatibility migration', () => {
  it('applies to the linked workspace-based schema and permits project-scoped CRM inserts', async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await pg.exec(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts, public.crm_leads,
          public.crm_activities, public.crm_workflows TO authenticated;
        SELECT set_config('request.jwt.claim.sub', '${userOne}', false);
        SET ROLE authenticated;
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000001', '${businessOne}', '${projectOne}', 'owner@example.test');
        INSERT INTO public.crm_leads(id, business_id, project_id, title)
          VALUES ('10000000-0000-4000-8000-000000000002', '${businessOne}', '${projectOne}', 'Qualified request');
        INSERT INTO public.crm_activities(id, business_id, project_id, type, title)
          VALUES ('10000000-0000-4000-8000-000000000003', '${businessOne}', '${projectOne}', 'lead_captured', 'New lead');
        INSERT INTO public.crm_workflows(id, business_id, project_id, name, trigger_type, steps, is_active)
          VALUES ('10000000-0000-4000-8000-000000000004', '${businessOne}', '${projectOne}', 'Follow up', 'manual', '[{"action_type":"create_task"}]', false);
        RESET ROLE;
      `);

      const lead = await pg.query<{ stage: string; workspace_id: string | null }>(
        "SELECT stage, workspace_id FROM public.crm_leads WHERE id = $1",
        ['10000000-0000-4000-8000-000000000002'],
      );
      expect(lead.rows).toEqual([{ stage: 'new', workspace_id: null }]);

      const workflow = await pg.query<{ actions: unknown; active: boolean }>(
        "SELECT actions, active FROM public.crm_workflows WHERE id = $1",
        ['10000000-0000-4000-8000-000000000004'],
      );
      expect(workflow.rows).toEqual([{ actions: [{ action_type: 'create_task' }], active: false }]);

      await pg.exec(`
        INSERT INTO public.crm_workflow_runs(id, workflow_id, status, trigger_data)
          VALUES ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 'running', '{"business_id":"${businessOne}","project_id":"${projectOne}"}');
        INSERT INTO public.crm_workflow_jobs(id, workflow_run_id, action_type, action_config, step_index, scheduled_at)
          VALUES ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000011', 'create_task', '{}', 2, '2026-10-20T12:00:00Z');
      `);
      const job = await pg.query<{ step_index: number; scheduled_for: string; scheduled_at: string }>(
        "SELECT step_index, scheduled_for, scheduled_at FROM public.crm_workflow_jobs WHERE id = $1",
        ['10000000-0000-4000-8000-000000000012'],
      );
      expect(job.rows[0].step_index).toBe(2);
      expect(new Date(job.rows[0].scheduled_for).getTime()).toBe(new Date(job.rows[0].scheduled_at).getTime());

      await pg.exec(`
        INSERT INTO public.crm_deals(id, business_id, project_id, title, contact_id)
          VALUES ('10000000-0000-4000-8000-000000000010', '${businessOne}', '${projectOne}', 'Initial deal', '10000000-0000-4000-8000-000000000001');
      `);

      await pg.exec(`
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000008', '${businessTwo}', '${projectTwo}', 'owner@example.test');
      `);
      await pg.exec(`
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000017', '${businessOne}', '${projectOne}', 'retry@example.test')
          ON CONFLICT (business_id, email_key) DO NOTHING;
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000018', '${businessOne}', '${projectOne}', 'RETRY@example.test')
          ON CONFLICT (business_id, email_key) DO NOTHING;
      `);
      const retryContacts = await pg.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM public.crm_contacts WHERE business_id = $1 AND email_key = 'retry@example.test'",
        [businessOne],
      );
      expect(retryContacts.rows[0].count).toBe('1');
      await expect(pg.exec(`
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000009', '${businessOne}', '${projectOne}', 'OWNER@example.test');
      `)).rejects.toThrow();
    } finally {
      await pg.close();
    }
  }, 30000);

  it('rejects cross-business project rows and isolates authenticated reads', async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await pg.exec(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts, public.crm_leads,
          public.crm_activities, public.crm_workflows TO authenticated;
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000005', '${businessOne}', '${projectOne}', 'one@example.test'),
                 ('10000000-0000-4000-8000-000000000006', '${businessTwo}', '${projectTwo}', 'two@example.test'),
                 ('10000000-0000-4000-8000-000000000016', '${businessOne}', null, 'shared@example.test');
        SELECT set_config('request.jwt.claim.sub', '${userOne}', false);
        SET ROLE authenticated;
      `);

      const visible = await pg.query<{ email: string }>('SELECT email FROM public.crm_contacts ORDER BY email');
      expect(visible.rows).toEqual([
        { email: 'one@example.test' },
        { email: 'shared@example.test' },
      ]);
      await expect(pg.exec(`
        INSERT INTO public.crm_contacts(id, business_id, project_id, email)
          VALUES ('10000000-0000-4000-8000-000000000007', '${businessTwo}', '${projectOne}', 'forged@example.test')
      `)).rejects.toThrow();
    } finally {
      await pg.close();
    }
  }, 30000);

  it('replays on the local status/activity_type/steps schema and replaces its deal policy', async () => {
    const pg = await database(true);
    try {
      await pg.exec(migration);
      await pg.exec(`
        INSERT INTO public.crm_leads(id, business_id, project_id, title, status)
          VALUES ('10000000-0000-4000-8000-000000000013', '${businessOne}', '${projectOne}', 'Legacy status lead', 'qualified');
        INSERT INTO public.crm_activities(id, business_id, project_id, title, activity_type)
          VALUES ('10000000-0000-4000-8000-000000000014', '${businessOne}', '${projectOne}', 'Legacy activity', 'quote_requested');
        INSERT INTO public.crm_workflows(id, business_id, project_id, name, trigger_type, steps, is_active)
          VALUES ('10000000-0000-4000-8000-000000000015', '${businessOne}', '${projectOne}', 'Legacy steps', 'manual', '[{"action_type":"send_email"}]', false);
      `);

      const lead = await pg.query<{ stage: string; status: string }>(
        'SELECT stage, status FROM public.crm_leads WHERE id = $1',
        ['10000000-0000-4000-8000-000000000013'],
      );
      expect(lead.rows).toEqual([{ stage: 'qualified', status: 'qualified' }]);
      const activity = await pg.query<{ type: string; activity_type: string }>(
        'SELECT type, activity_type FROM public.crm_activities WHERE id = $1',
        ['10000000-0000-4000-8000-000000000014'],
      );
      expect(activity.rows).toEqual([{ type: 'quote_requested', activity_type: 'quote_requested' }]);
      const oldDealPolicy = await pg.query<{ policyname: string }>(
        "SELECT policyname FROM pg_policies WHERE tablename = 'crm_deals' AND policyname = 'legacy_deals_select'",
      );
      expect(oldDealPolicy.rows).toEqual([]);
    } finally {
      await pg.close();
    }
  }, 30000);
});