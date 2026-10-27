import { describe, expect, it } from 'vitest';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { collectResolvedCompositions, resolvedCompositionPathFor, serializeResolvedComposition } from '@/platform/core/resolvedComposition';
import { getCompositionById } from '@/sections/templates';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import { prepareCompositionUpgrade } from '@/services/compositionUpgrade';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { buildThemedIndexCssFromTokens } from '@/components/onboarding/themePresetToIndexCss';
import type { SectionEntry } from '@/sections/types';
import { compilePlayground } from '@/services/playgroundCompiler';
import { getVariantsForSection } from '@/sections/variants';

describe('composition upgrade canonical integration', () => {
  it('keeps a selected App Builder hero variant through canonical source-preserving recompilation', () => {
    const template = getCompositionById('salon-premium')!;
    const preset = THEME_PRESETS.find(item => item.id === 'editorial')!;
    const launched = commitToPipeline({ selections: {
      businessName: 'Swap Studio', businessModel: 'appointment_service', industryOverlay: 'salon',
      primaryGoal: 'showcase', secondaryGoals: [], requestedPages: ['home'],
      templateId: template.id, themePresetId: preset.id, themeTokens: themePresetToThemeTokens(preset),
    } }, 'wizard-launch');
    const page = Object.values(launched.playground.pageRegistry.pages).find(candidate => candidate.isHome)!;
    const pagePath = page.filePath!;
    const heroComponentPath = '/src/project-components/ServicesHero.tsx';
    const heroId = `${page.pageId}:hero:0`;
    const initialVariant = 'hero:centered';
    const nextVariant = 'hero:prisma-cinematic';
    const sections = [
      { sectionId: 'site:navbar', semanticType: 'navbar', primitiveId: 'Navbar', variantId: 'navbar:standard', data: { links: [] } },
      { sectionId: heroId, semanticType: 'hero', primitiveId: 'Hero', sourcePath: heroComponentPath, variantId: initialVariant, data: { headline: 'Owner-authored headline' } },
      { sectionId: 'site:footer', semanticType: 'footer', primitiveId: 'Footer', variantId: 'footer:columns', data: { links: [] } },
    ];
    const designIntervention = {
      ...launched.siteBundleSnapshot.meta.designIntervention!,
      activeVariants: Object.fromEntries(sections.map(section => [section.sectionId, section.variantId])),
    };
    const sidecarPath = resolvedCompositionPathFor(pagePath);
    const sidecar = serializeResolvedComposition({
      version: '1.0', compiledBy: 'app-builder', pageFilePath: pagePath, sections,
      variantOverrides: { ...designIntervention.activeVariants },
    });
    const pageSource = `import ServicesHero from "../project-components/ServicesHero";
export default function Home(){return <>
      <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header>
      <ServicesHero />
      <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer>
    </>}`;
    const heroComponentSource = `import Hero from "@/unison/design-sources/Hero";
export default function ServicesHero(){return <section data-ut-section-id="${heroId}" data-ut-section-type="hero" data-ut-variant="${initialVariant}"><Hero data-ut-section-id="${heroId}" sectionId="${heroId}" variantId="${initialVariant}" props={{ headline: "Owner-authored headline" }} /></section>}`;
    const files = {
      ...launched.siteBundleSnapshot.vfsFiles,
      [pagePath]: pageSource,
      [heroComponentPath]: heroComponentSource,
      [sidecarPath]: sidecar,
      '/.unison/design-intervention.json': JSON.stringify(designIntervention),
      '/.unison/site-bundle-snapshot.json': JSON.stringify({
        ...launched.siteBundleSnapshot,
        meta: { ...launched.siteBundleSnapshot.meta, designIntervention },
        vfsFiles: { ...launched.siteBundleSnapshot.vfsFiles, [pagePath]: pageSource, [heroComponentPath]: heroComponentSource, [sidecarPath]: sidecar },
      }),
    };
    const changedDesign = {
      ...designIntervention,
      activeVariants: { ...designIntervention.activeVariants, [heroId]: nextVariant },
    };
    const changedSnapshot = {
      ...launched.siteBundleSnapshot,
      meta: { ...launched.siteBundleSnapshot.meta, designIntervention: changedDesign },
      vfsFiles: { ...files, '/.unison/design-intervention.json': JSON.stringify(changedDesign) },
    };
    const changedFiles = {
      ...files,
      '/.unison/design-intervention.json': JSON.stringify(changedDesign),
      '/.unison/site-bundle-snapshot.json': JSON.stringify(changedSnapshot),
    };

    const result = commitToPipeline({
      playground: launched.playground,
      existingVfsFiles: changedFiles,
      businessName: 'Swap Studio',
      industry: 'salon',
      selectedTemplateId: template.id,
      themePresetId: preset.id,
      themeTokens: themePresetToThemeTokens(preset),
      preservePageSources: true,
    }, 'playground-edit');

    expect(result.compileResult.vfsFiles[heroComponentPath]).toContain(`data-ut-variant="${nextVariant}"`);
    expect(result.compileResult.vfsFiles[heroComponentPath]).toContain(`variantId="${nextVariant}"`);
    expect(result.compileResult.vfsFiles[heroComponentPath]).toContain('headline: "Owner-authored headline"');
    expect(JSON.parse(result.compileResult.vfsFiles[sidecarPath]).sections.find((section: { sectionId: string }) => section.sectionId === heroId).variantId).toBe(nextVariant);
  });

  it('lazily migrates a missing-sidecar named hero export and renders the selected variant in the same canonical pass', () => {
    const template = getCompositionById('salon-premium')!;
    const preset = THEME_PRESETS.find(item => item.id === 'editorial')!;
    const launched = commitToPipeline({ selections: {
      businessName: 'Legacy Swap Studio', businessModel: 'appointment_service', industryOverlay: 'salon',
      primaryGoal: 'showcase', secondaryGoals: [], requestedPages: ['home'],
      templateId: template.id, themePresetId: preset.id, themeTokens: themePresetToThemeTokens(preset),
    } }, 'wizard-launch');
    const page = Object.values(launched.playground.pageRegistry.pages).find(candidate => candidate.isHome)!;
    const pagePath = page.filePath!;
    const heroId = `${page.pageId}:hero:0`;
    const initialVariant = 'hero:centered';
    const nextVariant = 'hero:prisma-cinematic';
    const stage4bCss = buildThemedIndexCssFromTokens(themePresetToThemeTokens(preset), { presetId: preset.id, industry: 'salon' });
    const designIntervention = {
      ...launched.siteBundleSnapshot.meta.designIntervention!,
      activeVariants: {
        ...launched.siteBundleSnapshot.meta.designIntervention!.activeVariants,
        'site:navbar': 'navbar:standard',
        [heroId]: initialVariant,
        'site:footer': 'footer:columns',
      },
    };
    const pageSource = `import Navbar from "@/unison/design-sources/Navbar";
import { HeroCentered } from "@/unison/design-sources/Hero";
import Footer from "@/unison/design-sources/Footer";
export default function Home(){return <>
  <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header>
  <section data-ut-section-id="${heroId}" data-ut-section-type="hero" data-ut-variant="${initialVariant}"><HeroCentered headline="Legacy owner headline" /></section>
  <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer>
</>}`;
    const manifest = { implementations: {
      'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar', exportName: 'NavbarStandard' },
      'hero:centered': { modulePath: '/src/unison/design-sources/Hero.tsx', sectionType: 'hero', exportName: 'HeroCentered' },
      'hero:prisma-cinematic': { modulePath: '/src/unison/design-sources/Hero.tsx', sectionType: 'hero', exportName: 'HeroPrismaCinematic' },
      'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer', exportName: 'FooterColumns' },
    } };
    const files = {
      ...launched.siteBundleSnapshot.vfsFiles,
      '/src/index.css': stage4bCss,
      '/.unison/design-source-manifest.json': JSON.stringify(manifest),
      '/src/unison/design-sources/Navbar.tsx': 'export default function Navbar(){return null}',
      '/src/unison/design-sources/Hero.tsx': 'export default function Hero(){return null}',
      '/src/unison/design-sources/Footer.tsx': 'export default function Footer(){return null}',
      [pagePath]: pageSource,
      '/.unison/design-intervention.json': JSON.stringify(designIntervention),
    };
    const initialSnapshot = {
      ...launched.siteBundleSnapshot,
      meta: { ...launched.siteBundleSnapshot.meta, designIntervention },
      vfsFiles: files,
    };
    const nextDesign = {
      ...designIntervention,
      activeVariants: { ...designIntervention.activeVariants, [heroId]: nextVariant },
    };
    const nextFiles = {
      ...files,
      '/.unison/design-intervention.json': JSON.stringify(nextDesign),
      '/.unison/site-bundle-snapshot.json': JSON.stringify({
        ...initialSnapshot,
        meta: { ...initialSnapshot.meta, designIntervention: nextDesign },
      }),
    };
    const result = commitToPipeline({
      playground: launched.playground,
      existingVfsFiles: nextFiles,
      businessName: 'Legacy Swap Studio',
      industry: 'salon',
      selectedTemplateId: template.id,
      themePresetId: preset.id,
      themeTokens: themePresetToThemeTokens(preset),
      preservePageSources: true,
    }, 'playground-edit');

    const compiled = result.compileResult.vfsFiles;
    const migrated = JSON.parse(compiled[resolvedCompositionPathFor(pagePath)]);
    expect(compiled[pagePath]).toContain(`data-ut-variant="${nextVariant}"`);
    expect(compiled[pagePath]).toContain(`variantId="${nextVariant}"`);
    expect(compiled[pagePath]).toContain('"headline":"Legacy owner headline"');
    expect(migrated.compiledBy).toBe('app-builder');
    expect(migrated.sections.find((section: { sectionId: string }) => section.sectionId === heroId)).toMatchObject({
      variantId: nextVariant,
      data: { headline: 'Legacy owner headline' },
    });
  });

  it('lazily migrates a named registered section export during a variant swap', () => {
    const template = getCompositionById('salon-premium')!;
    const preset = THEME_PRESETS.find(item => item.id === 'editorial')!;
    const launched = commitToPipeline({ selections: {
      businessName: 'Legacy Studio', businessModel: 'appointment_service', industryOverlay: 'salon',
      primaryGoal: 'showcase', secondaryGoals: [], requestedPages: ['gallery'],
      templateId: template.id, themePresetId: preset.id, themeTokens: themePresetToThemeTokens(preset),
    } }, 'wizard-launch');
    const page = Object.values(launched.playground.pageRegistry.pages).find(candidate => candidate.filePath)!;
    const pagePath = page.filePath!;
    const sectionIds = ['site:navbar', `${page.pageId}:services:0`, 'site:footer'];
    const source = `import Navbar from "@/unison/design-sources/Navbar";
import { ServicesEditorialRows } from "@/unison/design-sources/Services";
import Footer from "@/unison/design-sources/Footer";
export default function LegacyPage(){return <>
  <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header>
  <section data-ut-section-id="${sectionIds[1]}" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><ServicesEditorialRows headline="Legacy content" items={[{ title: "Cut", description: "Tailored" }]} /><a data-ut-intent="booking.create">Book</a></section>
  <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer>
</>}`;
    const sections = [
      { sectionId: sectionIds[0], semanticType: 'navbar', primitiveId: 'Navbar', variantId: 'navbar:standard' },
      { sectionId: sectionIds[1], semanticType: 'services', primitiveId: 'Services', variantId: 'services:editorial-rows' },
      { sectionId: sectionIds[2], semanticType: 'footer', primitiveId: 'Footer', variantId: 'footer:columns' },
    ];
    const sidecarPath = resolvedCompositionPathFor(pagePath);
    const sidecar = serializeResolvedComposition({
      version: '1.0', compiledBy: 'stage-4b', pageFilePath: pagePath, sections,
      variantOverrides: Object.fromEntries(sections.map(section => [section.sectionId, section.variantId])),
    });
    const stage4bCss = buildThemedIndexCssFromTokens(themePresetToThemeTokens(preset), { presetId: preset.id, industry: 'salon' });
    const files = {
      ...launched.siteBundleSnapshot.vfsFiles,
      '/src/index.css': stage4bCss,
      '/.unison/design-source-manifest.json': JSON.stringify({ implementations: {
        'navbar:standard': { modulePath: '/src/unison/design-sources/Navbar.tsx', sectionType: 'navbar', exportName: 'NavbarStandard' },
        'services:editorial-rows': { modulePath: '/src/unison/design-sources/Services.tsx', sectionType: 'services', exportName: 'ServicesEditorialRows' },
        'services:expandable': { modulePath: '/src/unison/design-sources/Services.tsx', sectionType: 'services', exportName: 'ServicesExpandable' },
        'footer:columns': { modulePath: '/src/unison/design-sources/Footer.tsx', sectionType: 'footer', exportName: 'FooterColumns' },
      } }),
      '/src/unison/design-sources/Navbar.tsx': 'export default function Navbar(){return null}',
      '/src/unison/design-sources/Services.tsx': 'export default function Services(){return null}',
      '/src/unison/design-sources/Footer.tsx': 'export default function Footer(){return null}',
      [pagePath]: source,
      [sidecarPath]: sidecar,
    };
    const activeVariants = {
      ...launched.siteBundleSnapshot.meta.designIntervention!.activeVariants,
      ...Object.fromEntries(sections.map(section => [section.sectionId, section.variantId])),
    };

    const result = compilePlayground(launched.playground, files, 'Legacy Studio', {
      selectedTemplateId: template.id,
      themePresetId: preset.id,
      stage4bCss,
      designIntervention: {
        ...launched.siteBundleSnapshot.meta.designIntervention!,
        activeVariants: { ...activeVariants, [sectionIds[1]]: 'services:expandable' },
      },
    });

    const migrated = collectResolvedCompositions(result.vfsFiles)[pagePath];
    expect(migrated.compiledBy).toBe('app-builder');
    expect(result.vfsFiles[pagePath]).toContain('import UnisonServices from "@/unison/design-sources/Services"');
    expect(result.vfsFiles[pagePath]).toContain('data-ut-variant="services:expandable"');
    expect(result.vfsFiles[pagePath]).toContain(`sectionId="${page.pageId}:services:0"`);
    expect(result.vfsFiles[pagePath]).toContain('"headline":"Legacy content"');
    expect(result.vfsFiles[pagePath]).toContain('data-ut-intent="booking.create"');
    expect(migrated.sections.find(section => section.sectionId === sectionIds[1])).toMatchObject({
      variantId: 'services:expandable',
      data: { headline: 'Legacy content', items: [{ title: 'Cut', description: 'Tailored' }] },
    });
    expect(migrated.sections.find(section => section.sectionId === sectionIds[1])).not.toHaveProperty('legacyRendererName');
    expect(result.bindingManifest).toEqual(launched.playground.bindings);
  });

  it('preserves App Builder section data and bindings through Playground sync and variant swaps', () => {
    const template = getCompositionById('salon-premium')!;
    const preset = THEME_PRESETS.find(item => item.id === 'editorial')!;
    const launched = commitToPipeline({ selections: {
      businessName: 'Custom Studio', businessModel: 'appointment_service', industryOverlay: 'salon',
      primaryGoal: 'showcase', secondaryGoals: [], requestedPages: ['gallery'],
      templateId: template.id, themePresetId: preset.id, themeTokens: themePresetToThemeTokens(preset),
    } }, 'wizard-launch');
    const stage4bCss = buildThemedIndexCssFromTokens(themePresetToThemeTokens(preset), { presetId: preset.id, industry: 'salon' });
    const page = Object.values(launched.playground.pageRegistry.pages).find(candidate => candidate.filePath)!;
    const pagePath = page.filePath!;
    const sectionIds = [`${page.pageId}:hero:0`, `${page.pageId}:services:0`];
    const source = `export default function Page(){return <main>
      <header data-ut-section-id="site:navbar" data-ut-section-type="navbar" data-ut-variant="navbar:standard"><Navbar sectionId="site:navbar" variantId="navbar:standard" props={{ links: [] }} /></header>
      <section data-ut-section-id="${sectionIds[0]}" data-ut-section-type="hero" data-ut-variant="hero:centered"><Hero sectionId="${sectionIds[0]}" variantId="hero:centered" props={{ headline: "Owner-authored headline" }} /></section>
      <section data-ut-section-id="${sectionIds[1]}" data-ut-section-type="services" data-ut-variant="services:editorial-rows"><Services sectionId="${sectionIds[1]}" variantId="services:editorial-rows" props={{ items: [{ title: "Cut", description: "Tailored" }] }} /><a data-ut-intent="booking.create" href="/booking">Book</a></section>
      <footer data-ut-section-id="site:footer" data-ut-section-type="footer" data-ut-variant="footer:columns"><Footer sectionId="site:footer" variantId="footer:columns" props={{ links: [] }} /></footer>
    </main>}`;
    const sections = [
      { sectionId: 'site:navbar', semanticType: 'navbar', primitiveId: 'Navbar', variantId: 'navbar:standard', data: { links: [] } },
      { sectionId: sectionIds[0], semanticType: 'hero', primitiveId: 'Hero', variantId: 'hero:centered', data: { headline: 'Owner-authored headline' } },
      { sectionId: sectionIds[1], semanticType: 'services', primitiveId: 'Services', variantId: 'services:editorial-rows', data: { items: [{ title: 'Cut', description: 'Tailored' }] } },
      { sectionId: 'site:footer', semanticType: 'footer', primitiveId: 'Footer', variantId: 'footer:columns', data: { links: [] } },
    ];
    const sidecarPath = resolvedCompositionPathFor(pagePath);
    const sidecar = serializeResolvedComposition({
      version: '1.0', compiledBy: 'app-builder', pageFilePath: pagePath, sections,
      variantOverrides: Object.fromEntries(sections.map(section => [section.sectionId, section.variantId])),
    });
    const files = { ...launched.siteBundleSnapshot.vfsFiles, '/src/index.css': stage4bCss, [pagePath]: source, [sidecarPath]: sidecar };
    const designIntervention = {
      ...launched.siteBundleSnapshot.meta.designIntervention!,
      activeVariants: {
        ...launched.siteBundleSnapshot.meta.designIntervention!.activeVariants,
        ...Object.fromEntries(sections.map(section => [section.sectionId, section.variantId])),
      },
    };
    const options = { selectedTemplateId: template.id, themePresetId: preset.id, stage4bCss, designIntervention };

    const synchronized = compilePlayground(launched.playground, files, 'Custom Studio', options);
    expect(synchronized.vfsFiles[pagePath]).toBe(source);
    expect(synchronized.bindingManifest).toEqual(launched.playground.bindings);

    const nextVariant = getVariantsForSection('services').find(variant => variant.id !== 'services:editorial-rows')!;
    const changed = compilePlayground(launched.playground, files, 'Custom Studio', {
      ...options,
      designIntervention: {
        ...designIntervention,
        activeVariants: { ...designIntervention.activeVariants, [sectionIds[1]]: nextVariant.id },
      },
    });
    const changedSidecar = JSON.parse(changed.vfsFiles[sidecarPath]);
    expect(changed.vfsFiles[pagePath]).toContain(`data-ut-variant="${nextVariant.id}"`);
    expect(changed.vfsFiles[pagePath]).toContain(`variantId="${nextVariant.id}"`);
    expect(changed.vfsFiles[pagePath]).toContain('Owner-authored headline');
    expect(changed.vfsFiles[pagePath]).toContain('data-ut-intent="booking.create"');
    expect(changed.vfsFiles[pagePath]).toContain('description: "Tailored"');
    expect(changedSidecar.sections.find((section: { sectionId: string }) => section.sectionId === sectionIds[1])).toMatchObject({
      variantId: nextVariant.id,
      data: { items: [{ title: 'Cut', description: 'Tailored' }] },
    });
    expect(changed.bindingManifest).toEqual(launched.playground.bindings);
  });

  it('validates a real legacy project upgrade without replacing custom content', async () => {
    const template = getCompositionById('salon-premium')!;
    const preset = THEME_PRESETS.find(item => item.id === 'editorial')!;
    const launched = commitToPipeline({ selections: {
      businessName: 'Custom Studio', businessModel: 'appointment_service', industryOverlay: 'salon',
      primaryGoal: 'showcase', secondaryGoals: [], requestedPages: ['gallery'],
      templateId: template.id, themePresetId: preset.id, themeTokens: themePresetToThemeTokens(preset),
    } }, 'wizard-launch');
    const snapshot = launched.siteBundleSnapshot;
    const legacyDesign = { ...snapshot.meta.designIntervention!, compositionPolicy: undefined };
    let files = { ...snapshot.vfsFiles };
    for (const composition of Object.values(collectResolvedCompositions(files))) {
      const page = files[composition.pageFilePath];
      const sections = JSON.parse(page.match(/const SECTIONS = ([\s\S]*?);\nconst HYDRATABLE/)![1]) as SectionEntry[];
      files = { ...files, ...compositionToReactFileSet({ ...template, name: composition.templateName!, sections }, composition.pageFilePath) };
    }
    const legacy = { ...snapshot, meta: { ...snapshot.meta, designIntervention: legacyDesign }, vfsFiles: files };
    files['/.unison/design-intervention.json'] = JSON.stringify(legacyDesign, null, 2);
    const identity = {
      userId: '11111111-1111-4111-8111-111111111111', businessId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333', draftId: '44444444-4444-4444-8444-444444444444',
      revisionId: '55555555-5555-4555-8555-555555555555', sessionId: 'composition-test',
    };
    const artifact = buildCanonicalLaunchArtifacts({
      generatedFiles: files, siteBundleSnapshot: legacy, canonicalPlayground: launched.playground,
      preferredEntryPoint: '/src/App.tsx', templateId: template.id, themePresetId: preset.id,
      businessId: identity.businessId, projectId: identity.projectId, industry: snapshot.industry,
      approvedExperienceCapabilities: [],
    });
    const proposal = await prepareCompositionUpgrade({
      identity, current: { vfsFiles: artifact.files, siteBundleSnapshot: artifact.siteBundleSnapshot, playground: launched.playground },
      options: { themePresetId: preset.id, themeTokens: snapshot.themeTokens },
    });
    expect(proposal.affected.length).toBeGreaterThan(0);
    expect(proposal.candidate.status).toBe('committed');
    expect(proposal.candidate.persistedRevisionId).toBeNull();
    expect(proposal.files['/src/index.css']).toBe(artifact.files['/src/index.css']);
    expect(proposal.files['/src/components/Hero.tsx']).toBe(artifact.files['/src/components/Hero.tsx']);
    const pagePath = proposal.affected[0].pagePath;
    const data = proposal.files[pagePath].match(/const SECTIONS = ([\s\S]*?);\r?\nconst HYDRATABLE/)!;
    const editedSections = JSON.parse(data[1]) as SectionEntry[];
    const hero = editedSections.find(section => section.type === 'hero')!;
    hero.props = { ...hero.props, headline: 'The owner edited this headline' };
    const edited = { ...proposal.files,
      [pagePath]: proposal.files[pagePath].replace(data[0], `const SECTIONS = ${JSON.stringify(editedSections, null, 2)};\nconst HYDRATABLE`),
      '/src/components/Hero.tsx': proposal.files['/src/components/Hero.tsx'] + '\n// Owner customization',
    };
    const options = { selectedTemplateId: template.id, themePresetId: preset.id, stage4bCss: edited['/src/index.css'], designIntervention: legacyDesign };
    const recompiled = compilePlayground(launched.playground, edited, 'Custom Studio', options);
    expect(recompiled.vfsFiles[pagePath]).toBe(edited[pagePath]);
    expect(recompiled.vfsFiles['/src/components/Hero.tsx']).toBe(edited['/src/components/Hero.tsx']);
    const nextVariant = getVariantsForSection('hero').find(variant => variant.id !== hero.variantId)!;
    const changedVariant = compilePlayground(launched.playground, edited, 'Custom Studio', {
      ...options, designIntervention: { ...legacyDesign, activeVariants: { ...legacyDesign.activeVariants, [hero.id]: nextVariant.id } },
    });
    expect(changedVariant.vfsFiles[pagePath]).toContain('The owner edited this headline');
    expect(changedVariant.vfsFiles[pagePath]).toContain(nextVariant.id);
    expect(changedVariant.vfsFiles['/src/components/Hero.tsx']).toBe(edited['/src/components/Hero.tsx']);
  }, 30000);
});
