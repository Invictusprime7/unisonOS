import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/BusinessContent.tsx'), 'utf8');
const catalogEditor = readFileSync(resolve(process.cwd(), 'src/components/business-center/BusinessCatalogEditor.tsx'), 'utf8');
const cmsWriter = readFileSync(resolve(process.cwd(), 'supabase/functions/cms-records/index.ts'), 'utf8');
const contentCasMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261021025714_add_content_entry_compare_and_set.sql'), 'utf8');
const atomicContentAuditMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261021030528_atomic_content_mutation_audit.sql'), 'utf8');
const routes = readFileSync(resolve(process.cwd(), 'src/routes/routeConfig.tsx'), 'utf8');

describe('Business content workspace', () => {
  it('uses the command gateway for types, entries, workflow, and revisions', () => {
    expect(page).toContain('listContentTypes');
    expect(page).toContain('createContentRecord');
    expect(page).toContain('transitionContentRecord');
    expect(page).toContain('listContentRevisions');
    expect(page).not.toContain(".from('");
  });

  it('registers a protected static content route before the catalog wildcard', () => {
    expect(routes.indexOf('path: "/business/content"')).toBeLessThan(routes.indexOf('path: "/business/:catalogKey"'));
    expect(routes).toContain('id: "business-content"');
  });

  it('presents structured content with the Records and Collections vocabulary', () => {
    expect(page).toContain('Collections');
    expect(page).toContain('Select collection');
    expect(page).toContain('Records');
    expect(page).toContain('Create collection');
    expect(page).toContain('transitionContentRecord');
  });

  it('routes Business Catalog reads and mutations through ResourceRuntime', () => {
    expect(catalogEditor).toContain('queryResource(schema.resource');
    expect(catalogEditor).toContain('applyResourceOp({ op: \'create\'');
    expect(catalogEditor).toContain("op: 'update'");
    expect(catalogEditor).toContain('editingBaseline');
    expect(catalogEditor).toContain('projectId: scopeProjectId');
    expect(catalogEditor).toContain('siteId: scopeSiteId');
    expect(catalogEditor).toContain("op: 'delete'");
    expect(catalogEditor).not.toContain('createCmsRecord');
    expect(catalogEditor).not.toContain('updateCmsRecord');
    expect(catalogEditor).not.toContain('removeCmsRecord');
  });

  it('writes CMS mutation audit rows using the dedicated service-role audit schema', () => {
    expect(cmsWriter).toContain('from("resource_mutation_audit").insert');
    expect(cmsWriter).toContain('await audit(admin');
    expect(cmsWriter).not.toContain('from("ai_events").insert');
    expect(cmsWriter).toContain('project_id: args.projectId ?? null');
    expect(cmsWriter).toContain('actor_id: args.userId');
  });

  it('routes observed content versions through the locked compare-and-set RPC', () => {
    const cmsService = readFileSync(resolve(process.cwd(), 'src/services/cmsRecordService.ts'), 'utf8');
    expect(cmsService).toContain('expectedUpdatedAt?: string');
    expect(cmsWriter).toContain('cms_apply_content_entry_command_audited');
    expect(contentCasMigration).toContain('cms_apply_content_entry_command_versioned');
    expect(cmsWriter).toContain('CONTENT_ENTRY_CONFLICT');
    expect(cmsWriter).toContain('409');
  });

  it('keeps content entry audit atomic with the existing revision transaction', () => {
    expect(cmsWriter).toContain('cms_apply_content_entry_command_audited');
    expect(atomicContentAuditMigration).toContain('resource_mutation_audit');
    expect(cmsWriter).not.toContain('resource: "content-entry", action');
  });

  it('supplies idempotency keys for content mutations and routes them to the receipt-aware RPC', () => {
    const cmsService = readFileSync(resolve(process.cwd(), 'src/services/cmsRecordService.ts'), 'utf8');
    const idempotencyMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261021031411_idempotent_content_resource_commands.sql'), 'utf8');
    expect(cmsService).toContain('crypto.randomUUID()');
    expect(cmsWriter).toContain('cms_apply_content_entry_command_idempotent');
    expect(cmsWriter).toContain('IDEMPOTENCY_KEY_REUSED');
    expect(idempotencyMigration).toContain('resource_mutation_audit_business_idempotency_idx');
  });
});