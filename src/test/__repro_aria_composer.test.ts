import { describe, it, vi, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const sent: Array<Record<string, unknown>> = [];
let mode: 'old' | 'new' = 'old';
vi.mock('@/services/builderBrainClient', async (orig) => ({
  ...(await orig() as object),
  runBuilderTurn: vi.fn(async (body: { messages: Array<{ content: string }> }) => {
    const req = JSON.parse(body.messages[body.messages.length - 1].content);
    sent.push(req);
    const schema = mode === 'old' ? (await import('./__tmp/oldContract')).aiComposerRequestSchema : (await import('../../supabase/functions/_shared/aiComposerContract')).aiComposerRequestSchema;
    const conform = mode === 'new' ? (await import('../../supabase/functions/_shared/aiComposerContract')).conformComposerRequest : (x: unknown) => ({ request: x });
    const r = schema.safeParse(conform(req).request);
    if (!r.success) {
      const e = Object.assign(new Error('Invalid composer request'), { context: { status: 400, body: JSON.stringify({ error: 'Invalid composer request', errorType: 'composer_request' }) } });
      return { data: null, error: e };
    }
    const path = req.page.filePath;
    const page = req.files[path] as string;
    return { data: { content: JSON.stringify({ summary: 'ok', fileOps: [{ type: 'replace', path, content: page.replace('</h1>', ' Studio</h1>') }] }) }, error: null };
  }),
}));
import { intakeZipArchive } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { resolveCanonicalAuthoringPage } from '@/services/builder/canonicalAuthoringRequest';

describe('repro', () => {
  for (const m of ['old', 'new'] as const) for (const PAGE of ['/src/routes/index.tsx', '/src/routes/process.$slug.tsx']) it(`${m} ${PAGE}`, async () => {
    mode = m; sent.length = 0;
    const intake = await intakeZipArchive(new Uint8Array(readFileSync('/tmp/repro/aria.zip')));
    const profile = analyzeImportedProject(intake);
    const files = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' }).files;
    const page = resolveCanonicalAuthoringPage(files, PAGE, PAGE)!;
    const result = await unisonAppBuilder.edit({
      operationId: 'builder:test', page, brief: 'Edit the project.', instruction: 'Add Studio to the heading',
      currentFiles: files, baseRevisionId: 'rev-1', connectorContext: { revisionId: 'rev-1' },
      sourceTargets: [PAGE], routes: [], runtimeContext: '',
    } as unknown as Parameters<typeof unisonAppBuilder.edit>[0]);
    console.log(m, PAGE, 'sent', sent.length, result.candidate.status, JSON.stringify(result.candidate.diagnostics).slice(0, 400), result.changeSet?.fileOps.map(o => o.path));
  }, 60000);
});
