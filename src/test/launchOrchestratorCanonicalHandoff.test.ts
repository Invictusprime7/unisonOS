import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('launch orchestrator canonical handoff', () => {
  const source = readFileSync('src/services/launch/launchOrchestrator.ts', 'utf8');

  const position = (text: string) => {
    const index = source.indexOf(text);
    expect(index, `Expected launchOrchestrator.ts to contain: ${text}`).toBeGreaterThan(-1);
    return index;
  };

  it('hands Builder the exact artifacts returned by the canonical commit', () => {
    expect(source).toContain('const committed = commit.result;');
    expect(source).toContain('vfsFiles: committed.vfsFiles');
    expect(source).toContain('siteBundleSnapshot: committed.siteBundleSnapshot');
    expect(source).toContain('runtimeManifest: committed.runtimeManifest');
    expect(source).toContain('revisionId: committed.persistedRevisionId');
    expect(source).toContain('entryPoint: committed.runtimeManifest.entryPoint');

    const handoffSource = source.slice(source.indexOf('const committed = commit.result;'));
    expect(handoffSource).toContain('compiledPlayground: null,');
    expect(handoffSource).toContain('committed.playground ?? materializedPlayground');
  });

  it('rejects an incomplete canonical result before navigation', () => {
    expect(source).toContain('if (!result.siteBundleSnapshot || !result.runtimeManifest)');
    expect(source).toContain('The canonical commit returned an incomplete launch artifact.');
  });

  it('does not compile a second Sandpack preview before committing the sealed artifact', () => {
    expect(source).not.toContain('runStrictImportContractCheck');
    expect(source).not.toContain('prepareSandpackFiles');
  });

  it('keeps submitted Wizard context authoritative over launcher defaults', () => {
    expect(source).toContain('const customerNeeds = uniqueValues<CustomerNeed>(input.customerNeeds);');
    expect(source).not.toContain('...(preselect?.customerNeeds || [])');
    expect(source).toContain('secondaryGoals: plan.selections.secondaryGoals,');
    expect(source).toContain('requestedPages: plan.requestedPages,');
  });

  it('uses the selected template as the canonical industry authority', () => {
    expect(source).toContain('const industryOverlay = resolveWizardIndustryOverlay({');
    expect(source).toContain('templateIndustry: input.template.industry,');
    expect(source).toContain('generationIndustry: industryProfile?.industry || generationCategory,');
    expect(source).toContain('industryOverlay,');
    expect(source).not.toContain('industryOverlay: SYSTEM_TO_INDUSTRY_OVERLAY[input.systemId] || "general"');
    expect(source).not.toContain('industryOverlay: plan.generationCategory');
  });

  it('threads focused launch capabilities through authoring, preflight, seeding, commit and Live Preview', () => {
    const resolvedCapabilities = position('const businessLaunchPlan = resolveBusinessLaunchPlan({');
    const appBuilderContract = position('const appBuildContract = buildAppBuildContract({');
    const canonicalPreflight = position('await buildCanonicalLaunchArtifactsAsync(');
    const catalogSeed = position('await seedLaunchAssets({');
    const commit = position('const result = await commitMutation({');
    const livePreview = position('livePreviewRuntime.hydrateFromRegistry(committed.siteBundleSnapshot.pageRegistry)');

    expect(source).toContain('capabilities: plan.launchCapabilities');
    expect(source).toContain('enabledCapabilities: plan.launchCapabilities');
    expect(source).toContain('launchCapabilities,');
    expect(source).toContain('enableProductCommerce: plan.selections.sellsProducts');
    expect(resolvedCapabilities).toBeLessThan(appBuilderContract);
    expect(appBuilderContract).toBeLessThan(canonicalPreflight);
    expect(canonicalPreflight).toBeLessThan(commit);
    expect(commit).toBeLessThan(catalogSeed);
    expect(commit).toBeLessThan(livePreview);
    expect(catalogSeed).toBeLessThan(livePreview);
  });

  it('loads the selected profile and preserves its payment provider before App Builder', () => {
    const stage4bResult = position('const appBuild = await run.stage("app-build"');
    const profileLoad = position('await loadBusinessProfile(input.existingBusinessId)');
    const appBuilderContract = position('const appBuildContract = buildAppBuildContract({');
    const dataBindings = position('planSectionDataBindings(siteBundleSnapshot)');
    const businessRuntime = position('buildBusinessRuntimeContract({');
    const nativeSetup = position('buildNativePublishSetupSnapshot({');
    const wizardAudit = position('auditWizardIntentGap({');
    const nativeReadiness = position('buildNativePublishReadinessManifest({');
    const intentBindings = position('buildIntentBindingsFile(materializedPlayground)');
    const intentSurfaces = position('buildIntentSurfacesFile(materializedPlayground)');
    const canonicalBuild = position('await buildCanonicalLaunchArtifactsAsync(');

    expect(source).toContain('const baseBusinessProfile: BusinessProfileDTO = loadedBusinessProfile || {');
    expect(source).toContain('const businessProfilePaymentProvider = getProfilePaymentProvider(loadedBusinessProfile);');
    expect(source).toContain('paymentProvider: plan.selections.businessParameters?.paymentProvider?.trim()');
    expect(source).toContain('const ownerParameters = plan.selections.businessParameters ?? {};');
    expect(source).toContain("requestedIntentSet.has('booking.create')");
    expect(source).toContain('notificationEmail: ownerParameters.notificationEmail?.trim()');
    expect(source).toContain('if (input.existingBusinessId && !loadedBusinessProfile)');
    expect(source).toContain('businessRuntime,');
    expect(source).toContain('projectId: plan.confirmed.projectId');
    expect(source).toContain('siteId: plan.confirmed.siteId');
    expect(source).toContain('requestedCapabilities: plan.businessLaunchPlan.businessCapabilities');
    expect(source).toContain("requestedIntentSet.has('booking.create')");
    expect(source).toContain('const dataBindingsReady = plannedDataBindings.length === 0;');
    expect(source).toContain('bindingsReady: dataBindingsReady');
    expect(source).toContain('const bindingPersistenceReceipt = await autoEmitSectionBindings({');
    expect(source).toContain('const intentBindingPersistenceReceipt = await persistGeneratedBindings({');
    expect(source).toContain('bindingsReady: persistedDataBindingsReady && intentBindingsReady');
    expect(source).toContain('businessRuntime: finalBusinessRuntime');
    expect(source).not.toContain('bindingsReady: true');
    expect(profileLoad).toBeLessThan(appBuilderContract);
    expect(appBuilderContract).toBeLessThan(stage4bResult);
    expect(profileLoad).toBeLessThan(dataBindings);
    expect(dataBindings).toBeLessThan(businessRuntime);
    expect(businessRuntime).toBeLessThan(nativeSetup);
    expect(nativeSetup).toBeLessThan(wizardAudit);
    expect(wizardAudit).toBeLessThan(nativeReadiness);
    expect(nativeReadiness).toBeLessThan(intentBindings);
    expect(intentBindings).toBeLessThan(intentSurfaces);
    expect(intentSurfaces).toBeLessThan(canonicalBuild);
  });

  it('persists the merged owner profile after confirmed provisioning and before the first revision', () => {
    const profileSave = position('const persistedProfile = await saveSiteProfile(confirmed.businessId, confirmed.projectId');
    const firstRevision = position('const result = await commitMutation({');

    expect(source).toContain('if (!persistedProfile) throw new Error(\'Owner information could not be saved for this site. Review the details and retry launch.\');');
    expect(profileSave).toBeLessThan(firstRevision);
  });

  it('derives the versioned App Builder contract from canonical launch objects before preflight', () => {
    const contractStage = position('await run.stage("contract"');
    const appBuilderContract = position('const appBuildContract = buildAppBuildContract({');
    const appBuilderRun = position('unisonAppBuilder.generate({');
    const canonicalBuild = position('await buildCanonicalLaunchArtifactsAsync(');

    expect(source).toContain('pageRegistry: canonicalPlan.playground.pageRegistry');
    expect(source).toContain('artDirection: canonicalPlan.artDirection,');
    expect(source).toContain('designContext,');
    expect(source).toContain('registryContext: canonicalPlan.registryContext,');
    expect(source).toContain('protectedPaths: WIZARD_LANE_B_PROTECTED_PATHS');
    expect(source).toContain('contract: appBuildContract,');
    expect(source).toContain('initialFiles: canonicalPlan.infrastructureFiles,');
    expect(source).not.toContain('"/.unison/app-build-contract.json"');
    expect(contractStage).toBeLessThan(appBuilderContract);
    expect(appBuilderContract).toBeLessThan(appBuilderRun);
    expect(appBuilderRun).toBeLessThan(canonicalBuild);
  });

  it('lets App Builder alone author pages while preserving public context', () => {
    const stage4bResult = position('const appBuild = await run.stage("app-build"');
    const publicProfile = position('buildPublicBusinessContext(businessProfile)');
    const canonicalPages = position('const canonicalPages = Object.values(siteBundleSnapshot.pageRegistry.pages)');
    const bindingGuide = position('buildWizardBindingGuide(canonicalPlan.playground');
    const deterministicEnrichment = position('run.markStage("enrich", "done")');
    const preflight = position('await buildCanonicalLaunchArtifactsAsync(');

    expect(source).toContain('generationBrief: siteBundleSnapshot.meta.generationBrief');
    expect(source).toContain('designIntervention: siteBundleSnapshot.meta.designIntervention');
    expect(source).toContain('generatedFiles: candidateFiles');
    expect(source).toContain('compileArtifact: createWizardCompileArtifact(siteBundleSnapshot)');
    expect(source).toContain('approvedExperienceCapabilities: resolveApprovedExperienceCapabilities({');
    expect(source).toContain('requiredCapabilities: [');
    expect(source).toContain('...resolveExperienceRequirement(');
    expect(source).toContain('webgl: canonicalPlan.designIntervention.envelope?.webgl');
    expect(source).not.toContain('enrichWizardPagesWithAI');
    expect(source).not.toContain('runBuilderTurn');
    expect(source).not.toContain('enrich.ai_rejected');
    expect(stage4bResult).toBeLessThan(canonicalPages);
    expect(canonicalPages).toBeLessThan(publicProfile);
    expect(bindingGuide).toBeLessThan(stage4bResult);
    expect(publicProfile).toBeLessThan(deterministicEnrichment);
    expect(deterministicEnrichment).toBeLessThan(preflight);
  });

  it('plans forms and degrades embedded published-runtime readiness without blocking launch', () => {
    const canonicalBuild = position('await buildCanonicalLaunchArtifactsAsync(');
    const formPlan = position('planLaunchFormDefinitions(artifacts.siteBundleSnapshot)');
    const readiness = position('evaluatePublishedRuntimeReadiness({');
    const degradation = position('"preflight.publish_not_ready"');

    expect(source).toContain('artifacts.files["/.unison/published-runtime.json"]');
    expect(canonicalBuild).toBeLessThan(formPlan);
    expect(formPlan).toBeLessThan(readiness);
    expect(readiness).toBeLessThan(degradation);
  });

  it('adds launch metadata only to the full commit VFS', () => {
    const canonicalBuild = position('await buildCanonicalLaunchArtifactsAsync(');
    const commitVfs = position('const vfsFiles: Record<string, string> = {');
    const commit = position('const result = await commitMutation({');

    expect(source).toContain('"/.unison/launch-readiness.json": JSON.stringify({');
    expect(source).toContain('"/.unison/native-publish-setup.json": JSON.stringify(');
    expect(source).toContain('"/.unison/setup-snapshot.json": JSON.stringify(');
    expect(source).toContain('"/.unison/intent-bindings.json": JSON.stringify(');
    expect(source).toContain('"/.unison/intent-surfaces.json": JSON.stringify(');
    expect(source).toContain('"/.unison/gate-verdicts.json": JSON.stringify(');
    expect(source).toContain('"/.unison/integrity-report.json": JSON.stringify(');
    expect(source).toContain('vfsFiles["/.unison/draft-classification.json"]');
    expect(source).toContain('wizardAudit,');
    expect(source).toContain('launchContract: plan.launchContract,');
    expect(source).toContain('publishedRuntimeReadiness,');
    expect(source).toContain('previewReady: true,');
    expect(source).toContain('generatedAt: new Date().toISOString(),');
    expect(canonicalBuild).toBeLessThan(commitVfs);
    expect(commitVfs).toBeLessThan(commit);
  });

  it('restores platform-core gates and classification through the committed handoff', () => {
    const compile = position('compileContract(blueprint, { backendInstalled: false })');
    const gates = position('evaluateAllGates(compiledContract)');
    const integrity = position('runIntegrityReport(');
    const classification = position('classifyDraft(vfsFiles)');
    const commit = position('const result = await commitMutation({');
    const routeState = position('const routeState: Record<string, unknown> = {');

    expect(source).toContain('compiledContract,');
    expect(source).toContain('_compiledContract: compiledContract,');
    expect(source).toContain('_previewGateVerdict: gateVerdicts.preview,');
    expect(source).toContain('_publishGateVerdict: gateVerdicts.publish,');
    expect(source).toContain('_draftClassification: draftClassification,');
    expect(compile).toBeLessThan(gates);
    expect(gates).toBeLessThan(integrity);
    expect(integrity).toBeLessThan(classification);
    expect(classification).toBeLessThan(commit);
    expect(commit).toBeLessThan(routeState);
  });

  it('persists planned forms after commit and degrades persistence errors', () => {
    const commit = position('const result = await commitMutation({');
    const persistedRevision = position('if (!result.persistedRevisionId)');
    const persistForms = position('await persistLaunchFormDefinitions({');
    const degradation = position('"commit.form_definitions_unavailable"');

    expect(source).toContain('businessId: commit.confirmed.businessId,');
    expect(source).toContain('projectId: commit.confirmed.projectId,');
    expect(source).toContain('siteId: commit.confirmed.siteId,');
    expect(source).toContain('definitions: plannedFormDefinitions,');
    expect(commit).toBeLessThan(persistedRevision);
    expect(persistedRevision).toBeLessThan(persistForms);
    expect(persistForms).toBeLessThan(degradation);
  });

  it('hydrates live controllers only from committed handoff artifacts', () => {
    const committed = position('const committed = commit.result;');
    const topology = position('livePageTopology.setRegistry(committed.siteBundleSnapshot.pageRegistry)');
    const preview = position('livePreviewRuntime.hydrateFromRegistry(committed.siteBundleSnapshot.pageRegistry)');
    const playground = position('livePlaygroundSync.hydrateFromVFS(committedVfsNodes, committed.vfsFiles)');

    expect(source).toContain('const committedVfsNodes: VirtualNode[] =');
    expect(committed).toBeLessThan(topology);
    expect(topology).toBeLessThan(preview);
    expect(preview).toBeLessThan(playground);
  });
  it('pauses review before provisioning or committing and propagates regeneration', () => {
    expect(source).toContain('callbacks.onReview ? requestedIds : await provision()');
    expect(position('await callbacks.onReview({ files: vfsFiles')).toBeLessThan(position('await plan.provision()'));
    expect(position('await plan.provision()')).toBeLessThan(position('const result = await commitMutation({'));
    expect(source).toContain("error.name = 'LaunchReviewCancelled'");
    expect(source).toContain('regenerationNonce: input.regenerationNonce ?? null');
    expect(source).toContain('designSelection: input.designSelection');
  });

});
