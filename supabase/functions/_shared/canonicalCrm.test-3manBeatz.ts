import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createCrmActivity, createCrmLead, mutateCrmResource, updateCrmContact, updateCrmLead, updateCrmWorkflow } from './canonicalCrm.ts';

const businessId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const projectId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function fakeClient(projectBusinessId: string | null = businessId) {
  const calls: Array<{ table: string; operation: string; payload?: Record<string, unknown>; filters: unknown[] }> = [];
  return {
    calls,
    from(table: string) {
      const call = { table, operation: '', payload: undefined as Record<string, unknown> | undefined, filters: [] as unknown[] };
      calls.push(call);
      const builder = {
        select() { return builder; },
        eq(column: string, value: unknown) { call.filters.push([column, value]); return builder; },
        or(filter: string) { call.filters.push(['or', filter]); return builder; },
        insert(payload: Record<string, unknown>) { call.operation = 'insert'; call.payload = payload; return builder; },
        upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
          call.operation = 'upsert'; call.payload = payload; call.filters.push(['options', options]); return builder;
        },
        update(payload: Record<string, unknown>) { call.operation = 'update'; call.payload = payload; return builder; },
        async maybeSingle() {
          if (table === 'businesses') return { data: { id: businessId }, error: null };
          if (table === 'projects') return { data: { business_id: projectBusinessId }, error: null };
          return { data: { id: 'contact-1' }, error: null };
        },
        async single() {
          return {
            data: {
              id: table === 'crm_leads' ? 'lead-1' : 'activity-1',
              ...(table === 'crm_leads' ? { stage: call.payload?.stage } : {}),
            },
            error: null,
          };
        },
      };
      return builder;
    },
  };
}

Deno.test('lead creation uses canonical stage and trusted business/project scope', async () => {
  const client = fakeClient();
  const result = await createCrmLead(client, { businessId, projectId }, {
    title: 'Quote request',
    status: 'qualified',
    email: 'Customer@Example.test',
    contact: { email: 'Customer@Example.test', firstName: 'Customer' },
  } as Parameters<typeof createCrmLead>[2]);

  assertEquals(result, { leadId: 'lead-1', contactId: 'contact-1' });
  const contactWrite = client.calls.find((call) => call.table === 'crm_contacts');
  assertEquals(contactWrite?.operation, 'upsert');
  assertEquals(contactWrite?.payload?.email, 'customer@example.test');
  assertEquals(contactWrite?.payload?.business_id, businessId);
  assertEquals(contactWrite?.payload?.project_id, projectId);

  const leadWrite = client.calls.find((call) => call.table === 'crm_leads');
  assertEquals(leadWrite?.payload?.stage, 'new');
  assertEquals('status' in (leadWrite?.payload ?? {}), false);
  assertEquals('workspace_id' in (leadWrite?.payload ?? {}), false);
});

Deno.test('lead updates use stage and constrain the write to both tenant scopes', async () => {
  const client = fakeClient();
  await updateCrmLead(client, { businessId, projectId }, 'lead-1', { stage: 'won' });
  const update = client.calls.find((call) => call.table === 'crm_leads' && call.operation === 'update');
  assertEquals(update?.payload, { stage: 'won' });
  assertEquals(update?.filters.includes(['business_id', businessId]), false);
  assertEquals(update?.filters, [['id', 'lead-1'], ['business_id', businessId], ['project_id', projectId]]);
});

Deno.test('activity commands write the canonical type field', async () => {
  const client = fakeClient();
  const result = await createCrmActivity(client, { businessId, projectId }, {
    type: 'quote_requested',
    title: 'Quote request',
  });
  assertEquals(result, { activityId: 'activity-1' });
  const activity = client.calls.find((call) => call.table === 'crm_activities');
  assertEquals(activity?.payload?.type, 'quote_requested');
  assertEquals('activity_type' in (activity?.payload ?? {}), false);
});

Deno.test('CRM commands reject a project/business mismatch before writing', async () => {
  const client = fakeClient(businessId);
  await assertRejects(
    () => createCrmLead(client, { businessId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', projectId }, { title: 'Invalid scope' }),
    Error,
    'does not belong',
  );
  assertEquals(client.calls.some((call) => call.table === 'crm_leads'), false);
});

Deno.test('project-only CRM commands preserve projects without a business', async () => {
  const client = fakeClient(null);
  const result = await createCrmLead(client, { businessId: '', projectId }, { title: 'Project-only lead' });
  assertEquals(result, { leadId: 'lead-1', contactId: null });
  const lead = client.calls.find((call) => call.table === 'crm_leads');
  assertEquals(lead?.payload?.business_id, null);
  assertEquals(lead?.payload?.project_id, projectId);
});

Deno.test('contact updates use a field allowlist and both tenant scopes', async () => {
  const client = fakeClient();
  await updateCrmContact(client, { businessId, projectId }, 'contact-1', { phone: '555-0100', externalId: 'provider-1' });
  const update = client.calls.find((call) => call.table === 'crm_contacts' && call.operation === 'update');
  assertEquals(update?.payload, { phone: '555-0100', external_id: 'provider-1' });
  assertEquals(update?.filters, [['id', 'contact-1'], ['business_id', businessId], ['project_id', projectId]]);
});

Deno.test('workflow scheduling metadata updates are scoped to the owning project/business', async () => {
  const client = fakeClient();
  await updateCrmWorkflow(client, { businessId, projectId }, 'workflow-1', {
    triggerConfig: { cron: '0 9 * * 1', lastRun: '2026-10-20T12:00:00Z' },
  });
  const update = client.calls.find((call) => call.table === 'crm_workflows' && call.operation === 'update');
  assertEquals(update?.payload, { trigger_config: { cron: '0 9 * * 1', lastRun: '2026-10-20T12:00:00Z' } });
  assertEquals(update?.filters, [['id', 'workflow-1'], ['business_id', businessId], ['project_id', projectId]]);
});

Deno.test('generic resource commands write canonical fields and inject trusted scope', async () => {
  const client = fakeClient();
  const result = await mutateCrmResource(client, { businessId, projectId }, {
    resource: 'leads',
    action: 'create',
    values: { title: 'Qualified lead', status: 'qualified', business_id: 'forged' },
  });
  assertEquals(result.record?.status, 'qualified');
  const write = client.calls.find((call) => call.table === 'crm_leads');
  assertEquals(write?.payload?.stage, 'qualified');
  assertEquals('status' in (write?.payload ?? {}), false);
  assertEquals(write?.payload?.business_id, businessId);
  assertEquals(write?.payload?.project_id, projectId);
});

Deno.test('project CRM contact mutations can target same-business shared contacts', async () => {
  const client = fakeClient();
  await mutateCrmResource(client, { businessId, projectId }, {
    resource: 'contacts',
    action: 'update',
    recordId: 'contact-1',
    values: { phone: '555-0100' },
  });
  const update = client.calls.find((call) => call.table === 'crm_contacts' && call.operation === 'update');
  assertEquals(update?.filters, [
    ['id', 'contact-1'],
    ['business_id', businessId],
    ['or', `project_id.eq.${projectId},project_id.is.null`],
  ]);
});