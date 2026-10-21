import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('CRM workspace consolidation', () => {
  it('mounts one scoped CRM projection from Cloud', () => {
    const cloud = source('src/components/cloud/CloudProjects.tsx');
    const routes = source('src/routes/routeConfig.tsx');

    expect(cloud).toContain('<CRMDashboard');
    expect(cloud).toContain('businessId={selectedBusiness.id}');
    expect(cloud).toContain('projectId={selectedScopeProject.id}');
    expect(cloud).toContain('siteId={selectedScopeProject.site_id ?? undefined}');
    expect(cloud).not.toContain('const crmTabs:');
    expect(cloud).not.toContain('renderCRMContent');
    expect(routes).not.toContain('lazy(() => import("@/pages/CRMDashboard"))');
  });

  it('keeps bookings, recipes, and automation rules inside the selected workspace', () => {
    const dashboard = source('src/pages/CRMDashboard.tsx');
    const bookings = source('src/components/crm/CRMBookings.tsx');
    const recipes = source('src/components/crm/PrebuiltWorkflows.tsx');
    const automations = source('src/components/crm/CRMAutomations.tsx');

    expect(dashboard).toContain('<CRMBookings businessId={businessId} projectId={projectId} />');
    expect(dashboard).toContain('<PrebuiltWorkflows businessId={businessId} />');
    expect(dashboard).toContain('<CRMAutomations businessId={businessId} projectId={projectId} />');
    expect(bookings).toContain(".eq('business_id', businessId)");
    expect(bookings).toContain("query.eq('site_id', siteId)");
    expect(recipes).not.toContain('.eq("owner_id", user.id)');
    expect(automations).toContain('queryResource("crm:automations"');
    expect(automations).toContain('applyResourceOp');
    expect(automations).not.toContain('.from("crm_automations")');
    const workflows = source('src/components/crm/CRMWorkflows.tsx');
    expect(workflows).toContain('queryResource("crm:workflows"');
    expect(workflows).toContain('applyResourceOp');
    expect(workflows).not.toContain('.from("crm_workflows")');
  });

  it('routes contact and lead screen CRUD through ResourceRuntime', () => {
    const contacts = source('src/components/crm/CRMContacts.tsx');
    const leads = source('src/components/crm/CRMLeads.tsx');
    const crmActions = source('src/hooks/useCRMActions.ts');
    const workflowService = source('src/services/workflowBuilderService.ts');

    expect(contacts).toContain('applyResourceOp');
    expect(contacts).toContain('<Sheet open={Boolean(selectedContact)}');
    expect(contacts).toContain('View ${contact.first_name');
    expect(leads).toContain('<Sheet open={Boolean(selectedLead)}');
    expect(leads).toContain('View ${lead.title}');
    expect(leads).toContain('Edit lead');
    expect(contacts).not.toContain('.from("crm_contacts")');
    expect(leads).toContain('applyResourceOp');
    expect(leads).not.toContain('.from("crm_leads")');
    expect(crmActions).toContain('applyResourceOp');
    expect(crmActions).not.toMatch(/\.from\(['"]crm_(contacts|leads|deals)['"]\)/);
    expect(workflowService).toContain('applyResourceOp');
    expect(workflowService).not.toMatch(/\.from\(['"]crm_workflows['"]\)/);
  });

  it('enforces tenant and project scope for CRM automation rules', () => {
    const migration = source('supabase/migrations/20260809014108_scope_crm_automations_to_workspace.sql');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS business_id');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS project_id');
    expect(migration).toContain('public.is_business_member(business_id)');
    expect(migration).toContain('projects.business_id = crm_automations.business_id');
    expect(migration).toContain('TO authenticated');
  });
  
  it('uses the selected project site identity for capability installation', () => {
    const projectSchema = source('src/services/projectSchemaCompat.ts');
    const webBuilder = source('src/components/creatives/WebBuilder.tsx');
    
    expect(projectSchema).toContain("  'site_id',");
    expect(projectSchema).toContain('site_id: (row.site_id as string | null | undefined) ?? null');
    expect(webBuilder).toContain('const installProjectId = resolvedProjectId || currentDraftId;');
    expect(webBuilder).toContain('const installSiteId = installProject');
    expect(webBuilder).toContain('businessId: installBusinessId,');
    expect(webBuilder).toContain('projectId: installProjectId,');
    expect(webBuilder).toContain('siteId: installSiteId,');
  });

  it('keeps lead creation and overview projections inside the selected business', () => {
    const leads = source('src/components/crm/CRMLeads.tsx');
    const overview = source('src/components/crm/CRMOverview.tsx');
    const pipeline = source('src/components/crm/CRMPipeline.tsx');

    expect(leads).toContain('businessId: activeBizId || ""');
    expect(overview).toContain('leadsQuery = leadsQuery.eq("business_id", businessId)');
    expect(overview).toContain('scopeColumn = "business_id"');
    expect(overview).toContain('scopeId = businessId');
    expect(overview).toContain('.or(dealScopeFilters.join(","))');
    expect(overview).toContain('.in("project_id", workflowProjectIds)');
    expect(pipeline).toContain("queryResource('crm:deals'");
    expect(pipeline).toContain("queryResource('crm:contacts'");
    expect(pipeline).toContain("queryResource('crm:leads'");
    expect(pipeline).toContain('<Sheet open={Boolean(selectedDeal)}');
    expect(pipeline).not.toContain('.from("crm_deals")');
    expect(pipeline).not.toContain('.from("crm_contacts")');
    expect(pipeline).not.toContain('.from("crm_leads")');
  });
});
