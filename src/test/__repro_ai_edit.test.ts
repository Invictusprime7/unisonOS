import { it, vi, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const sent: any[] = [];
vi.mock('@/services/builderBrainClient', async (orig) => ({
  ...(await orig() as object),
  runBuilderTurn: vi.fn(async (body: any) => {
    const req = JSON.parse(body.messages[0].content); sent.push(req);
    const src = req.files['/src/routes/index.tsx'];
    return { data: { content: JSON.stringify({ summary: 'x', fileOps: [{ type: 'replace', path: '/src/routes/index.tsx', content: src.replace('>ARIA</h1>', '>ARIANN</h1>') }] }) }, error: null };
  }),
}));
import { intakeZipArchive } from '@/services/import/secureIntake';
import { analyzeImportedProject } from '@/services/import/importCompatibilityProfile';
import { buildImportedSourceVfs } from '@/services/import/importedSourceAcceptance';
import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { resolveCanonicalAuthoringPage } from '@/services/builder/canonicalAuthoringRequest';

it('ai edit imported', async () => {
  const buf = readFileSync('/tmp/user-uploads/ariastudios_2.zip');
  const intake = await intakeZipArchive(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { name: 'aria.zip' });
  const profile = analyzeImportedProject(intake);
  const { files } = buildImportedSourceVfs({ intake, profile, assets: { version: 1, assets: [], originalArchive: null }, importedBy: 'u', importedAt: '2026-11-10T00:00:00Z' });
  const page = resolveCanonicalAuthoringPage(files, '/src/routes/index.tsx', '/src/routes/index.tsx');
  console.log('page', page);
  const res = await unisonAppBuilder.edit({
    operationId: 'builder:1', page: page!, brief: 'b', instruction: 'Change the ARIA heading to ARIANN',
    currentFiles: files, baseRevisionId: 'rev-1', connectorContext: { revisionId: 'rev-1' } as any,
    sourceTargets: ['/src/routes/index.tsx'], routes: [], runtimeContext: '',
  } as any);
  console.log('status', res.candidate.status, res.stopReason, JSON.stringify(res.candidate.diagnostics).slice(0, 1500));
  console.log('sent', sent.length, sent[0] && Object.keys(sent[0].files));
});
