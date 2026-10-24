import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const endpointPath = resolve(process.cwd(), 'supabase/functions/cms-records/index.ts');
const source = ts.createSourceFile(endpointPath, readFileSync(endpointPath, 'utf8'), ts.ScriptTarget.Latest, true);
const withoutImports = ts.factory.updateSourceFile(source, source.statements.filter(statement => !ts.isImportDeclaration(statement)));
const executable = ts.transpileModule(ts.createPrinter().printFile(withoutImports), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const businessId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';
const typeId = '44444444-4444-4444-8444-444444444444';
const entryId = '55555555-5555-4555-8555-555555555555';

describe('CMS content command execution', () => {
  it.each([true, false])('creates content with every required RPC argument (idempotent=%s)', async idempotent => {
    let handler: ((request: Request) => Promise<Response>) | undefined;
    const record = { id: entryId, project_id: projectId, title: 'When can I check in?' };
    const signaturePath = resolve(process.cwd(), idempotent
      ? 'supabase/migrations/20261021031605_make_resource_idempotency_receipts_read_only.sql'
      : 'supabase/migrations/20261021030528_atomic_content_mutation_audit.sql');
    const signature = readFileSync(signaturePath, 'utf8').split('RETURNS')[0];
    const requiredArgs = [...signature.matchAll(/\b(p_\w+)\s+(?:text|uuid|jsonb|timestamptz)\b/g)].map(match => match[1]);
    const rpc = vi.fn((_name: string, args: Record<string, unknown>) => ({
      maybeSingle: async () => {
        const missing = requiredArgs.filter(key => !(key in args));
        return missing.length
          ? { data: null, error: { code: 'PGRST202', message: `Missing arguments: ${missing.join(', ')}` } }
          : { data: record, error: null };
      },
    }));
    const admin = {
      rpc,
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: table === 'projects'
            ? { business_id: businessId }
            : { id: typeId, business_id: businessId, field_schema: { fields: [{ key: 'answer', type: 'textarea' }] } }, error: null }),
        };
        return query;
      },
    };
    const caller = {
      auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) },
      rpc: async () => ({ data: true, error: null }),
    };
    const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });
    const dependencies = {
      serve: (callback: typeof handler) => { handler = callback; },
      createClient: (_url: string, key: string) => key === 'test-service' ? admin : caller,
      Deno: { env: { get: (key: string) => ({ SUPABASE_URL: 'https://cms.example.test', SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' })[key] } },
      getCorsHeaders: () => ({}),
      handleCorsPreflightRequest: () => null,
      errorResponse: (message: string, status: number) => json({ error: message }, status),
      secureJsonResponse: json,
      safeParseBody: async (request: Request) => ({ data: await request.json(), error: null }),
      isValidUUID: (value: unknown) => typeof value === 'string' && /^[\da-f-]{36}$/i.test(value),
    };
    new Function(...Object.keys(dependencies), executable)(...Object.values(dependencies));
    if (!handler) throw new Error('CMS handler was not registered');
    const response = await handler(new Request('https://cms.example.test', {
      method: 'POST', headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'content-entry-create', businessId, projectId, contentTypeId: typeId,
        ...(idempotent ? { idempotencyKey: '66666666-6666-4666-8666-666666666666' } : {}),
        values: { title: record.title, data: { answer: 'After three.' } } }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, record });
    expect(rpc).toHaveBeenCalledWith(idempotent ? 'cms_apply_content_entry_command_idempotent' : 'cms_apply_content_entry_command_audited', expect.objectContaining({
      p_actor_id: actorId, p_project_id: projectId, p_target_status: null,
    }));
    expect(requiredArgs.length).toBe(idempotent ? 15 : 14);
  });
});