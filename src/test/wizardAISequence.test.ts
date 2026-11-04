import { describe, expect, it, vi } from 'vitest';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { getCompositionById } from '@/sections/templates';
import { requestAIPageComposition } from '@/services/requestAIPageComposition';
import { enrichWizardPageBatch, type WizardLaneBEnrichmentRequest } from '@/services/wizardLaneBEnrichment';
import { createLaunchRun } from '@/services/launch/launchRun';
import type { WizardSelections } from '@/types/playground';
vi.mock('@/services/builderBrainClient', () => ({ runBuilderTurn: vi.fn() }));

const compositionPlan = { version: '1.0' as const, pages: [{ role: 'home' as const, sectionOrder: ['hero' as const, 'services' as const], variants: { services: 'services:editorial-rows' }, copy: { hero: { headline: 'Care made personal' } } }] };
const selections: WizardSelections = { businessName: 'Studio', businessModel: 'appointment_service', industryOverlay: 'salon', primaryGoal: 'book', secondaryGoals: [], requestedPages: ['home'], templateId: 'salon-premium', themePresetId: 'editorial', themeTokens: getCompositionById('salon-premium')!.theme!, wizardSeedId: 'sequence-test' };

async function compileAIPlan() {
  const planner = vi.fn().mockResolvedValue({ data: { content: JSON.stringify(compositionPlan) }, error: null });
  const plan = await requestAIPageComposition(selections, new AbortController().signal, planner);
  expect(plan).not.toBeNull();
  const compiled = commitToPipeline({ selections: { ...selections, compositionPlan: plan! } }, 'wizard-launch');
  const snapshot = compiled.siteBundleSnapshot!;
  const home = Object.values(snapshot.pageRegistry.pages).find(page => page.isHome)!;
  const request = {
    version: '1.0', wizardSeedId: 'sequence-test', snapshotId: snapshot.snapshotId,
    designRegistrySignature: 'test-registry', compositionPlan: plan,
    pageRegistry: [{ id: home.pageId, filePath: home.filePath, route: '/', title: 'Home', requiredIntents: ['contact.submit'] }],
    currentPageSources: { [home.pageId]: { filePath: home.filePath, content: snapshot.vfsFiles[home.filePath!] } },
  } as WizardLaneBEnrichmentRequest;
  return { snapshot, request, homePath: home.filePath!, plan };
}

const candidate = 'import React from "react"; export default function Home(){return <main><h1>Care made personal</h1><button data-ut-intent="contact.submit">Contact the studio</button></main>}';

describe('required composition followed by independent refinement', () => {
  it.each([true, false])('keeps the AI plan and compiler ownership with refinement enabled=%s', async enabled => {
    const { snapshot, request, homePath, plan } = await compileAIPlan();
    const original = snapshot.vfsFiles[homePath];
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify({ version: '1.0', wizardSeedId: request.wizardSeedId, snapshotId: request.snapshotId, designRegistrySignature: request.designRegistrySignature, fileOps: [{ type: 'replace', path: homePath, content: candidate }] }) }, error: null });
    const result = await enrichWizardPageBatch({ request, files: snapshot.vfsFiles, uiFoundationManifest: { primitiveImports: [], requirements: [] }, signal: new AbortController().signal, enabled }, invoke);
    expect(snapshot.meta.designIntervention?.compositionPlan).toEqual(plan);
    expect(result.files[homePath]).toBe(enabled ? candidate : original);
    expect(snapshot.vfsFiles[homePath]).toBe(original);
    expect(result.files['/src/App.tsx']).toBe(snapshot.vfsFiles['/src/App.tsx']);
    expect(result.files['/src/index.css']).toBe(snapshot.vfsFiles['/src/index.css']);
    expect(invoke).toHaveBeenCalledTimes(enabled ? 1 : 0);
    if (enabled) expect(JSON.parse(invoke.mock.calls[0][0].messages[0].content).compositionPlan).toEqual(plan);
  });

  it.each(['unavailable', 'invalid', 'timeout'])('preserves the compiled AI page on %s refinement', async failure => {
    const { snapshot, request } = await compileAIPlan();
    const invoke = failure === 'timeout' ? vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')) : vi.fn().mockResolvedValue(failure === 'invalid' ? { data: { content: '{}' }, error: null } : { data: null, error: new Error('offline') });
    const onDegrade = vi.fn();
    const result = await enrichWizardPageBatch({ request, files: snapshot.vfsFiles, uiFoundationManifest: { primitiveImports: [], requirements: [] }, signal: new AbortController().signal, onDegrade }, invoke);
    expect(result.files).toBe(snapshot.vfsFiles);
    expect(result.acceptedPaths).toEqual([]);
    expect(onDegrade).toHaveBeenCalledOnce();
  });

  it('rejects one candidate page without discarding a valid sibling', async () => {
    const { snapshot, request, homePath } = await compileAIPlan();
    const contact = '/src/pages/Contact.tsx';
    const files = { ...snapshot.vfsFiles, [contact]: 'original contact' };
    request.pageRegistry.push({ id: 'contact', filePath: contact, route: '/contact', title: 'Contact', requiredIntents: ['contact.submit'] });
    const invoke = vi.fn().mockResolvedValue({ data: { content: JSON.stringify({ version: '1.0', wizardSeedId: request.wizardSeedId, snapshotId: request.snapshotId, designRegistrySignature: request.designRegistrySignature, fileOps: [{ type: 'replace', path: homePath, content: candidate }, { type: 'replace', path: contact, content: 'invalid TSX' }] }) }, error: null });
    const result = await enrichWizardPageBatch({ request, files, uiFoundationManifest: { primitiveImports: [], requirements: [] }, signal: new AbortController().signal }, invoke);
    expect(result.acceptedPaths).toEqual([homePath]);
    expect(result.files[contact]).toBe('original contact');
  });

  it('never merges a late result after cancellation', async () => {
    const { snapshot, request, homePath } = await compileAIPlan();
    const controller = new AbortController();
    let finish!: (value: unknown) => void;
    const invoke = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = enrichWizardPageBatch({ request, files: snapshot.vfsFiles, uiFoundationManifest: { primitiveImports: [], requirements: [] }, signal: controller.signal }, invoke);
    controller.abort();
    finish({ data: { content: JSON.stringify({ version: '1.0', wizardSeedId: request.wizardSeedId, snapshotId: request.snapshotId, designRegistrySignature: request.designRegistrySignature, fileOps: [{ type: 'replace', path: homePath, content: candidate }] }) }, error: null });
    await expect(pending).rejects.toThrow();
    expect(snapshot.vfsFiles[homePath]).not.toBe(candidate);
  });
  it('records refinement watchdog expiry without fatal launch state', async () => {
    const run = createLaunchRun();
    await run.stage('enrich', () => new Promise(() => {}), { timeoutMs: 5, fallback: () => undefined });
    expect(run.snapshot().fatal).toBeNull();
    expect(run.snapshot().stages.find(stage => stage.name === 'enrich')?.status).toBe('degraded');
  });
});

it('reports an enrichment HTTP failure instead of hiding it as unavailable',async()=>{
 const {snapshot,request}=await compileAIPlan();const onDegrade=vi.fn();
 const invoke=vi.fn().mockResolvedValue({data:{errorType:'enrichment_request'},error:{context:{status:400}}});
 await enrichWizardPageBatch({request,files:snapshot.vfsFiles,uiFoundationManifest:{primitiveImports:[],requirements:[]},signal:new AbortController().signal,onDegrade},invoke);
 expect(onDegrade).toHaveBeenCalledWith('enrich.request_rejected',expect.stringContaining('HTTP 400'));
 expect(invoke.mock.calls[0][1].timeoutMs).toBe(110000);
});
