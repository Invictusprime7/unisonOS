import { describe, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const sent: unknown[] = [];
vi.mock('@/services/builderBrainClient', async (orig) => ({
  ...(await orig() as object),
  runBuilderTurn: vi.fn(async (body: { messages: Array<{ content: string }> }) => {
    sent.push(JSON.parse(body.messages[0].content));
    return { data: null, error: { message: 'stop' } };
  }),
}));
import { intakeZipArchive } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { resolveCanonicalAuthoringPage } from '@/services/builder/canonicalAuthoringRequest';
import { aiComposerRequestSchema } from '../../supabase/functions/_shared/aiComposerContract';

describe('repro', () => {
  it('aria composer request', async () => {
    const intake = await intakeZipArchive(new Uint8Array(readFileSync('/tmp/repro/aria.zip')));
    const profile = analyzeImportedProject(intake);
    const files = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' }).files;
    const PAGE = '/src/routes/index.tsx';
    const page = resolveCanonicalAuthoringPage(files, PAGE, PAGE)!;
    try {
      await unisonAppBuilder.edit({
        operationId: 'builder:test', page, brief: 'Edit the project.', instruction: 'Make the hero background red',
        currentFiles: files, baseRevisionId: 'rev-1', connectorContext: { revisionId: 'rev-1' },
        sourceTargets: [PAGE], routes: [], runtimeContext: '',
      } as unknown as Parameters<typeof unisonAppBuilder.edit>[0]);
    } catch (e) { console.log('edit threw', (e as Error).message); }
    console.log('sent', sent.length);
    const req = sent[0] as Record<string, unknown>;
    const r = aiComposerRequestSchema.safeParse(req);
    console.log('success', r.success);
    if (!r.success) console.log(JSON.stringify(r.error.issues.slice(0, 20), null, 1));
    console.log('targets', JSON.stringify(req.sourceTargets));
    console.log('file sizes', Object.entries(req.files as Record<string,string>).map(([k,v]) => `${k}:${v.length}`).join('\n'));
  }, 60000);
});
