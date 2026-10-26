import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const endpoint = readFileSync(
  resolve(process.cwd(), 'supabase/functions/cms-records/index.ts'),
  'utf8',
);
const service = readFileSync(
  resolve(process.cwd(), 'src/services/cmsRecordService.ts'),
  'utf8',
);
const commandMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806203649_add_content_entry_command.sql'),
  'utf8',
);

describe('CMS record gateway contract', () => {
  it('uses a resource allowlist and never accepts client table names', () => {
    expect(endpoint).toContain('getCmsResourceContract(body.resource)');
    expect(endpoint).toContain('resource.sourceTable');
    expect(endpoint).not.toMatch(/body\.table|table:\s*body\./);
  });

  it('authorizes reads and mutations by explicit catalog permissions', () => {
    expect(endpoint).toContain('"catalog.read"');
    expect(endpoint).toContain('"catalog.write"');
    expect(endpoint).toContain('"catalog.delete"');
    expect(endpoint).toContain('business_has_permission');
  });

  it('binds an operator CMS request to the canonical site-project-business tuple', () => {
    expect(endpoint).toContain('async function resolveCmsScope');
    expect(endpoint).toContain('.from("sites")');
    expect(endpoint).toContain('.eq("site_id", input.siteId)');
    expect(endpoint).toContain('project.id !== input.projectId');
    expect(endpoint).toContain('Site, project, or business scope is invalid');
    expect(service).toContain('siteId?: string | null');
  });

  it('validates registry-defined editable and required fields before mutating', () => {
    expect(endpoint).toContain('Field "${key}" is not editable for this resource');
    expect(endpoint).toContain('resource.requiredFields');
    expect(endpoint).toContain('At least one editable value is required');
  });

  it('keeps the browser surface resource-based', () => {
    expect(service).toContain("functions.invoke('cms-records'");
    expect(service).not.toContain(".from('");
  });

  it('keeps the browser enterprise content surface command-based', () => {
    expect(service).toContain('export async function mutateContentRecord');
    expect(service).toContain("action: 'content-entry-transition'");
    expect(service).not.toContain(".rpc('");
  });

  it('exposes enterprise content through explicit server-owned commands', () => {
    expect(endpoint).toContain('"content-type-create"');
    expect(endpoint).toContain('"content-entry-transition"');
    expect(endpoint).toContain('"content-entry-revisions"');
    expect(endpoint).toContain('"cms_apply_content_entry_command_audited"');
    expect(endpoint).toContain('"cms_apply_content_entry_command_idempotent"');
    expect(endpoint).toContain('admin.rpc(command, args)');
    expect(endpoint).toContain('parseContentFields(contentType.field_schema)');
    expect(endpoint).toContain('validateContentEntryValues(body.values, parsedSchema.fields)');
  });

  it('requires publisher-level capability for non-submission workflow transitions', () => {
    expect(endpoint).toContain('return status === "review" ? "content.write" : "content.publish"');
    expect(commandMigration).toContain("WHEN 'content.publish' THEN public.is_business_admin");
    expect(endpoint).not.toMatch(/body\.table|\.rpc\(body\./);
  });
});