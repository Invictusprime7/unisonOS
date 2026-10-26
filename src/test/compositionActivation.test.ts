import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { transform } from '@babel/standalone';
import { ALL_COMPOSITIONS, getCompositionById } from '@/sections/templates';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { resolveCompositionEnhancements } from '@/sections/compositionEnhancements';
import { resolveExperienceEnvelope } from '@/services/experienceCapabilityResolver';
import { buildGeneratedUiFoundation } from '@/platform/core/generatedUiFoundation';
import { runExperiencePreflight } from '@/services/experiencePreflightGate';
import { collectResolvedCompositions } from '@/platform/core/resolvedComposition';
import { collectReachableFiles, getDependenciesForSandpack } from '@/utils/dependencyExtractor';
import { buildCompositionCoverage } from '@/services/compositionCoverage';
import { planCompositionUpgrade } from '@/services/compositionUpgrade';
import { findUnresolvedLocalImports, findLocalJsxImportContractViolations } from '@/services/laneBCompanionModules';
import { runRuntimeCompatibilityPreflight } from '@/services/runtimeCompatibilityPreflight';
import { EXPERIENCE_CAPABILITY_ID } from '@/platform/core/generatedRuntimeCapabilities';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import type { WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { buildPublishedRuntimeConfig, buildPublishedRuntimeModule, buildGeneratedSiteRuntimeManifestModule } from '@/services/canonicalLaunchVfs';
import { compileGeneratedSiteRuntimeManifest } from '@/services/generatedSiteRuntimeManifest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import type { BusinessModel, IndustryOverlay } from '@/platform/core/playground';
import type { TemplateComposition } from '@/sections/types';

const pagePath = '/src/pages/Home.tsx';
const envelope = resolveExperienceEnvelope({ seed: 'coverage', businessModel: 'portfolio_creator', industry: 'creative', styleIntent: 'experimental' });
const design = { sectionVariants: [], envelope, compositionPolicy: 'maximum-compatible' as const };
const foundation = {
  ...buildGeneratedUiFoundation({ themePresetId: 'editorial' }).files,
  '/src/unison/publishedRuntime.ts': buildPublishedRuntimeModule(buildPublishedRuntimeConfig({})),
  '/src/unison/generatedSiteRuntimeManifest.ts': buildGeneratedSiteRuntimeManifestModule(compileGeneratedSiteRuntimeManifest({ siteId: null })),
};

function compileIndustry(template: TemplateComposition) {
  const preset = THEME_PRESETS.find(item => item.id === 'editorial')!;
  const businessModel: BusinessModel = template.industry === 'restaurant' ? 'restaurant_hospitality'
    : template.systemType === 'store' ? 'ecommerce' : template.systemType === 'portfolio' ? 'portfolio_creator'
      : template.systemType === 'saas' ? 'saas_digital' : template.systemType === 'content' ? 'nonprofit'
        : ['local-service', 'contractor', 'agency', 'real-estate'].includes(template.industry) ? 'quote_lead' : 'appointment_service';
  const launched = commitToPipeline({ selections: {
    businessName: template.name, businessModel,
    industryOverlay: (template.industry === 'real-estate' ? 'real_estate' : template.industry) as IndustryOverlay,
    primaryGoal: 'showcase', secondaryGoals: [], requestedPages: [], templateId: template.id,
    themePresetId: preset.id, themeTokens: themePresetToThemeTokens(preset),
  } }, 'wizard-launch');
  return buildCanonicalLaunchArtifacts({ generatedFiles: launched.siteBundleSnapshot.vfsFiles,
    siteBundleSnapshot: launched.siteBundleSnapshot, canonicalPlayground: launched.playground,
    preferredEntryPoint: '/src/App.tsx', templateId: template.id, themePresetId: preset.id,
    industry: template.industry,
  });
}

describe('rich composition activation', () => {
  it.runIf(process.env.COMPOSITION_ARTIFACTS === '1')('exports the template coverage matrix and browser fixtures', () => {
    const reports = [];
    for (const template of ALL_COMPOSITIONS) {
      const compiled = compileIndustry(template);
      const files = {
        ...compiled.files,
        '/src/main.tsx': `import React from 'react'; import { createRoot } from 'react-dom/client'; import Page from './pages/Home'; import './index.css';
          if (new URLSearchParams(location.search).has('noWebgl')) {
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type: any, ...args: any[]) { return String(type).startsWith('webgl') ? null : getContext.call(this, type, ...args); } as any;
          }
          createRoot(document.getElementById('root')!).render(<Page />);`,
        '/index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="./src/main.tsx"></script></body></html>',
      };
      reports.push({ templateId: template.id, ...buildCompositionCoverage(files) });
      for (const [path, source] of Object.entries(files)) {
        const target = resolve('.artifacts/composition/browser', template.id, path.slice(1));
        mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source);
      }
    }
    writeFileSync(resolve('.artifacts/composition/coverage.json'), JSON.stringify(reports, null, 2));
    writeFileSync(resolve('.artifacts/composition/browser/index.html'), `<h1>Industry composition verification</h1>${ALL_COMPOSITIONS.map(template => `<p><a href="/${template.id}/">${template.name}</a></p>`).join('')}`);
    const fallbacks = { ...foundation,
      '/src/main.tsx': `import React from 'react'; import { createRoot } from 'react-dom/client'; import { ModelViewer } from '@/unison/ui/experience/stage';
        createRoot(document.getElementById('root')!).render(<main><h1>Model fallback verification</h1><div style={{height:400}}><ModelViewer src="/deliberately-missing.glb" alt="Unavailable model" /></div><button>Page still works</button></main>);`,
      '/index.html': '<!doctype html><html><body><div id="root"></div><script type="module" src="./src/main.tsx"></script></body></html>',
    };
    for (const [path, source] of Object.entries(fallbacks)) {
      const target = resolve('.artifacts/composition/browser/fallbacks', path.slice(1));
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, source);
    }
  });
  it.each(ALL_COMPOSITIONS)('seals $id through the canonical industry launch pipeline', template => {
    const artifact = compileIndustry(template);
    const compositions = Object.values(collectResolvedCompositions(artifact.files));
    expect(compositions.length).toBeGreaterThan(0);
    expect(compositions.every(composition => composition.activation?.policy === 'maximum-compatible')).toBe(true);
    expect(runExperiencePreflight(artifact.files).violations).toEqual([]);
    expect(artifact.siteBundleSnapshot.meta.templateId).toBe(template.id);
  }, 30000);
  it.each(ALL_COMPOSITIONS)('compiles $id with reachable, valid recipe modules', template => {
    const files = { ...foundation, ...compositionToReactFileSet(template, pagePath, { designIntervention: design }) };
    const reachable = collectReachableFiles(files, [pagePath]);
    expect(findUnresolvedLocalImports(reachable)).toEqual([]);
    expect(findLocalJsxImportContractViolations(reachable)).toEqual([]);
    expect(() => transform(files[pagePath], { filename: 'Home.tsx', presets: ['typescript', 'react'] })).not.toThrow();
    const activation = collectResolvedCompositions(files)[pagePath].activation!;
    expect(activation.canvasRoots).toBeLessThanOrEqual(2);
    expect(runExperiencePreflight(files).violations).toEqual([]);
    const { dependencies, graphFingerprint } = getDependenciesForSandpack(files, {}, { entryPoints: [pagePath] });
    const compatibility = runRuntimeCompatibilityPreflight({
      files,
      entryPoints: [pagePath],
      dependencies,
      dependencyGraphFingerprint: graphFingerprint,
      approvedCapabilities: [EXPERIENCE_CAPABILITY_ID],
    });
    expect(compatibility.blockers).toEqual([]);
    const coverage = buildCompositionCoverage(files);
    expect(coverage.pages[0].browserVerification).toBe('not-run');
    expect(coverage.pages[0].reachableModules).toContain('/src/unison/ui/motion.tsx');
    expect(coverage.pages[0].selectedImplementations.map(section => section.sectionId)).toEqual(template.sections.map(section => section.id));
  });

  it('keeps unused experience modules out of the dependency graph', () => {
    const files = { ...foundation, ...compositionToReactFileSet(ALL_COMPOSITIONS[0], pagePath) };
    const { dependencies } = getDependenciesForSandpack(files, {}, { entryPoints: [pagePath] });
    expect(dependencies.three).toBeUndefined();
    expect(dependencies['@react-three/fiber']).toBeUndefined();
    expect(buildCompositionCoverage(files).pages[0].unusedModules).toContain('/src/unison/ui/experience/media.tsx');
  });

  it('records capability, asset and budget fallbacks without changing section purpose', () => {
    const template = getCompositionById('salon-premium')!;
    const allowed = { ...envelope, webgl: 'eligible' as const, canvasBudget: 2, backgroundCandidates: ['3d-scene'], mediaCandidates: ['depth-gallery'] };
    expect(resolveCompositionEnhancements(template, { ...allowed, webgl: 'ineligible' }).decisions.some(decision => decision.reason === 'incompatible-capability')).toBe(true);
    expect(resolveCompositionEnhancements(template, allowed, 0).decisions.some(decision => decision.reason === 'performance-budget')).toBe(true);
    const noMedia = { ...template, sections: template.sections.map(section => section.type === 'gallery' ? { ...section, props: { ...section.props, items: [] } } : section) };
    expect(resolveCompositionEnhancements(noMedia, allowed).decisions.some(decision => decision.reason === 'missing-assets')).toBe(true);
  });

  it('upgrades compiler-owned pages, preserves content, and refuses custom shared components', () => {
    const template = getCompositionById('salon-premium')!;
    const files = compositionToReactFileSet(template, pagePath);
    const snapshot = { meta: { templateId: template.id, designIntervention: { ...design, compositionPolicy: undefined } as WizardDesignIntervention } } as SiteBundleSnapshot;
    const plan = planCompositionUpgrade(files, snapshot);
    expect(plan.affected).toHaveLength(1);
    const readData = (source: string) => JSON.parse(source.match(/const SECTIONS = ([\s\S]*?);\nconst HYDRATABLE/)![1]);
    expect(readData(plan.files[pagePath])).toEqual(readData(files[pagePath]));
    expect(plan.files['/src/components/Hero.tsx']).toBe(files['/src/components/Hero.tsx']);
    const custom = { ...files, '/src/components/Hero.tsx': files['/src/components/Hero.tsx'] + '\n// custom work' };
    expect(planCompositionUpgrade(custom, snapshot).affected).toHaveLength(0);
    expect(planCompositionUpgrade(custom, snapshot).skipped[0].reason).toContain('Custom renderer');
    const customPage = { ...files, [pagePath]: files[pagePath] + '\n// custom renderer' };
    expect(planCompositionUpgrade(customPage, snapshot).affected).toHaveLength(0);
  });
});
