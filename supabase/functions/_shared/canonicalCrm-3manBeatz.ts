export interface CrmScope {
  businessId?: string | null;
  projectId?: string | null;
}

export interface CrmContactInput {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface CrmLeadInput {
  title: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  intent?: string | null;
  stage?: string;
  value?: number | null;
  metadata?: Record<string, unknown>;
  contactId?: string | null;
  contact?: CrmContactInput;
}

export interface CrmActivityInput {
  type: string;
  title: string;
  description?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CrmContactUpdate {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  externalId?: string | null;
}

export interface CrmWorkflowUpdate {
  triggerConfig?: Record<string, unknown>;
  isActive?: boolean;
}

export type CrmResourceName = 'contacts' | 'leads' | 'deals' | 'workflows' | 'automations';
export type CrmMutationAction = 'create' | 'update' | 'delete';

const CRM_RESOURCE_TABLES: Record<CrmResourceName, string> = {
  contacts: 'crm_contacts',
  leads: 'crm_leads',
  deals: 'crm_deals',
  workflows: 'crm_workflows',
  automations: 'crm_automations',
};

const CRM_RESOURCE_FIELDS: Record<CrmResourceName, readonly string[]> = {
  contacts: ['email', 'first_name', 'last_name', 'phone', 'company', 'tags', 'source', 'custom_fields', 'external_id'],
  leads: ['title', 'status', 'stage', 'value', 'source', 'notes', 'intent', 'email', 'name', 'phone', 'company', 'contact_name', 'contact_id', 'pipeline_id', 'metadata', 'tags', 'custom_fields'],
  deals: ['title', 'stage', 'value', 'expected_close_date', 'contact_id', 'lead_id', 'metadata'],
  workflows: ['name', 'description', 'trigger_type', 'trigger_config', 'steps', 'is_active', 'actions', 'active', 'industry'],
  automations: ['name', 'trigger_event', 'conditions', 'actions', 'is_active'],
};

function normalizeCrmResourceValues(resource: CrmResourceName, values: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(CRM_RESOURCE_FIELDS[resource]);
  const normalized = Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
  if (resource === 'leads') {
    if ('status' in normalized) {
      normalized.stage = normalized.status;
      delete normalized.status;
    }
  }
  if (resource === 'workflows') {
    if ('steps' in normalized) {
      normalized.actions = normalized.steps;
      delete normalized.steps;
    }
    if ('is_active' in normalized) {
      normalized.active = normalized.is_active;
      delete normalized.is_active;
    }
  }
  return normalized;
}

function projectCrmResourceRow(resource: CrmResourceName, row: Record<string, unknown>): Record<string, unknown> & { id: string } {
  const projected: Record<string, unknown> & { id: string } = { ...row, id: String(row.id ?? '') };
  if (resource === 'leads') projected.status = row.stage ?? row.status ?? 'new';
  if (resource === 'workflows') {
    projected.steps = row.steps ?? row.actions ?? [];
    projected.is_active = row.is_active ?? row.active ?? true;
  }
  return projected;
}

function applyCrmResourceScope(query: any, resource: CrmResourceName, scope: CrmScope): any {
  if (scope.businessId) query = query.eq('business_id', scope.businessId);
  if (scope.projectId && resource === 'contacts' && scope.businessId) {
    query = query.or(`project_id.eq.${scope.projectId},project_id.is.null`);
  } else if (scope.projectId) {
    query = query.eq('project_id', scope.projectId);
  }
  return query;
}

export async function mutateCrmResource(
  client: CrmClient,
  scope: CrmScope,
  input: {
    resource: CrmResourceName;
    action: CrmMutationAction;
    recordId?: string;
    values?: Record<string, unknown>;
    expected?: Record<string, unknown>;
  },
): Promise<{ record?: Record<string, unknown> & { id: string }; deleted?: true }> {
  await validateCrmScope(client, scope);
  const table = CRM_RESOURCE_TABLES[input.resource];

  if (input.action === 'create') {
    const values = normalizeCrmResourceValues(input.resource, input.values ?? {});
    if (!Object.keys(values).length) throw new Error('At least one editable CRM field is required.');
    if (input.resource === 'deals') {
      if (typeof values.contact_id === 'string') await validateScopedReference(client, 'crm_contacts', values.contact_id, scope);
      if (typeof values.lead_id === 'string') await validateScopedReference(client, 'crm_leads', values.lead_id, scope);
    }
    const { data, error } = await client.from(table)
      .insert({ ...values, ...scopeValues(scope) })
      .select('*')
      .single();
    if (error) throw error;
    return { record: projectCrmResourceRow(input.resource, data) };
  }

  if (!input.recordId) throw new Error('A CRM record ID is required.');

  if (input.action === 'delete') {
    const query = applyCrmResourceScope(client.from(table).delete().eq('id', input.recordId), input.resource, scope);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('CRM record is not in the requested business/project scope.');
    return { deleted: true };
  }

  const values = normalizeCrmResourceValues(input.resource, input.values ?? {});
  if (!Object.keys(values).length) throw new Error('At least one editable CRM field is required.');
  if (input.resource === 'deals') {
    if (typeof values.contact_id === 'string') await validateScopedReference(client, 'crm_contacts', values.contact_id, scope);
    if (typeof values.lead_id === 'string') await validateScopedReference(client, 'crm_leads', values.lead_id, scope);
  }
  let update = applyCrmResourceScope(
    client.from(table).update({ ...values, updated_at: new Date().toISOString() }).eq('id', input.recordId),
    input.resource,
    scope,
  );
  if (input.expected && Object.prototype.hasOwnProperty.call(input.expected, 'updated_at')) {
    update = update.eq('updated_at', input.expected.updated_at);
  }
  const { data, error } = await update.select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('CRM record is not in the requested business/project scope or changed elsewhere.');
  return { record: projectCrmResourceRow(input.resource, data) };
}

type CrmClient = any;

async function validateCrmScope(client: CrmClient, scope: CrmScope): Promise<void> {
  const businessId = scope.businessId || null;
  if (!businessId && !scope.projectId) throw new Error('CRM command requires a business or project scope.');

  if (businessId) {
    const { data, error } = await client
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('CRM business scope is unavailable.');
  }

  if (scope.projectId) {
    const { data, error } = await client
      .from('projects')
      .select('business_id')
      .eq('id', scope.projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.business_id !== businessId) {
      throw new Error('CRM project does not belong to the requested business scope.');
    }
  }
}

async function validateScopedReference(
  client: CrmClient,
  table: 'crm_contacts' | 'crm_leads',
  recordId: string,
  scope: CrmScope,
): Promise<void> {
  let query = client.from(table).select('id').eq('id', recordId);
  if (scope.businessId) query = query.eq('business_id', scope.businessId);
  if (scope.projectId && table === 'crm_contacts' && scope.businessId) {
    query = query.or(`project_id.eq.${scope.projectId},project_id.is.null`);
  } else if (scope.projectId) {
    query = query.eq('project_id', scope.projectId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`CRM ${table === 'crm_contacts' ? 'contact' : 'lead'} is outside the requested scope.`);
}

function scopeValues(scope: CrmScope) {
  return {
    business_id: scope.businessId || null,
    project_id: scope.projectId || null,
  };
}

async function upsertContact(client: CrmClient, scope: CrmScope, input: CrmContactInput): Promise<string> {
  const email = input.email?.trim().toLowerCase() || null;
  const values = {
    ...scopeValues(scope),
    email,
    first_name: input.firstName?.trim() || null,
    last_name: input.lastName?.trim() || null,
    phone: input.phone?.trim() || null,
    company: input.company?.trim() || null,
    source: input.source || null,
    tags: input.tags ?? [],
    custom_fields: input.customFields ?? {},
  };

  if (email && scope.businessId) {
    const { data, error } = await client
      .from('crm_contacts')
      .upsert(values, { onConflict: 'business_id,email_key', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;

    const { data: existing, error: lookupError } = await client
      .from('crm_contacts')
      .select('id')
      .eq('business_id', scope.businessId)
      .eq('email_key', email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.id) return existing.id;
    throw new Error('CRM contact upsert did not return a contact.');
  }

  const { data, error } = await client
    .from('crm_contacts')
    .insert(values)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function createCrmContact(
  client: CrmClient,
  scope: CrmScope,
  input: CrmContactInput,
): Promise<{ contactId: string }> {
  await validateCrmScope(client, scope);
  return { contactId: await upsertContact(client, scope, input) };
}

export async function createCrmLead(
  client: CrmClient,
  scope: CrmScope,
  input: CrmLeadInput,
): Promise<{ leadId: string; contactId: string | null }> {
  await validateCrmScope(client, scope);
  let contactId = input.contactId ?? null;
  if (!contactId && input.contact) contactId = await upsertContact(client, scope, input.contact);
  if (contactId) await validateScopedReference(client, 'crm_contacts', contactId, scope);

  const { data, error } = await client
    .from('crm_leads')
    .insert({
      ...scopeValues(scope),
      contact_id: contactId,
      title: input.title.trim(),
      stage: input.stage || 'new',
      email: input.email?.trim().toLowerCase() || null,
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source || null,
      notes: input.notes || null,
      intent: input.intent || null,
      value: input.value ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return { leadId: data.id, contactId };
}

export async function updateCrmLead(
  client: CrmClient,
  scope: CrmScope,
  leadId: string,
  values: { stage?: string; source?: string | null; notes?: string | null; value?: number | null },
): Promise<void> {
  await validateCrmScope(client, scope);
  let query = client
    .from('crm_leads')
    .update(values)
    .eq('id', leadId);
  if (scope.businessId) query = query.eq('business_id', scope.businessId);
  if (scope.projectId) query = query.eq('project_id', scope.projectId);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('CRM lead is not in the requested business/project scope.');
}

export async function updateCrmContact(
  client: CrmClient,
  scope: CrmScope,
  contactId: string,
  values: CrmContactUpdate,
): Promise<void> {
  await validateCrmScope(client, scope);
  const updates: Record<string, unknown> = {};
  if (values.firstName !== undefined) updates.first_name = values.firstName;
  if (values.lastName !== undefined) updates.last_name = values.lastName;
  if (values.phone !== undefined) updates.phone = values.phone;
  if (values.company !== undefined) updates.company = values.company;
  if (values.tags !== undefined) updates.tags = values.tags;
  if (values.customFields !== undefined) updates.custom_fields = values.customFields;
  if (values.externalId !== undefined) updates.external_id = values.externalId;
  if (!Object.keys(updates).length) throw new Error('CRM contact update has no writable fields.');

  let query = client.from('crm_contacts').update(updates).eq('id', contactId);
  if (scope.businessId) query = query.eq('business_id', scope.businessId);
  if (scope.projectId) query = query.eq('project_id', scope.projectId);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('CRM contact is not in the requested business/project scope.');
}

export async function createCrmActivity(
  client: CrmClient,
  scope: CrmScope,
  input: CrmActivityInput,
): Promise<{ activityId: string }> {
  await validateCrmScope(client, scope);
  if (input.contactId) await validateScopedReference(client, 'crm_contacts', input.contactId, scope);
  if (input.leadId) await validateScopedReference(client, 'crm_leads', input.leadId, scope);
  const { data, error } = await client
    .from('crm_activities')
    .insert({
      ...scopeValues(scope),
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      contact_id: input.contactId ?? null,
      lead_id: input.leadId ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();
  if (error) throw error;
  return { activityId: data.id };
}

export async function updateCrmWorkflow(
  client: CrmClient,
  scope: CrmScope,
  workflowId: string,
  values: CrmWorkflowUpdate,
): Promise<void> {
  await validateCrmScope(client, scope);
  const updates: Record<string, unknown> = {};
  if (values.triggerConfig !== undefined) updates.trigger_config = values.triggerConfig;
  if (values.isActive !== undefined) updates.is_active = values.isActive;
  if (!Object.keys(updates).length) throw new Error('CRM workflow update has no writable fields.');

  let query = client.from('crm_workflows').update(updates).eq('id', workflowId);
  if (scope.businessId) query = query.eq('business_id', scope.businessId);
  if (scope.projectId) query = query.eq('project_id', scope.projectId);
  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('CRM workflow is not in the requested business/project scope.');
}