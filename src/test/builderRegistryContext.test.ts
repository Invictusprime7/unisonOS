import { describe, it, expect } from 'vitest';
import {
  resolveBuilderRegistryContext,
  boundRegistryContext,
  readPersistedRegistryContext,
} from '@/services/builderRegistryContext';
import {
  buildWizardAggregatedRegistryContext,
  WIZARD_REGISTRY_CONTEXT_PATH,
} from '@/services/launch/wizardRegistryAggregation';

const canonical = () =>
  buildWizardAggregatedRegistryContext({
    industry: 'store',
    templateId: 'store-premium',
    themePresetId: 'commerce-editorial',
  });

describe('V4 M8 — both AI layers share one canonical registry projection', () => {
  it('reads the sealed projection persisted by the launcher', () => {
    const context = canonical();
    const vfsFiles = { [WIZARD_REGISTRY_CONTEXT_PATH]: JSON.stringify(context) };
    expect(readPersistedRegistryContext(vfsFiles)?.designRegistrySignature)
      .toBe(context.designRegistrySignature);
    expect(readPersistedRegistryContext({ '/src/App.tsx': 'x' })).toBeNull();
  });

  it('bounds the projection to registry vocabulary only — never source or credentials', () => {
    const bounded = boundRegistryContext(canonical());
    const serialized = JSON.stringify(bounded);
    expect(bounded.sections.length).toBeGreaterThan(0);
    expect(bounded.sections.every(section => section.allowedVariantIds.length <= 12)).toBe(true);
    expect(bounded.implementations.length).toBeLessThanOrEqual(18);
    expect(serialized.length).toBeLessThanOrEqual(60000);
    expect(serialized).not.toContain('renderJSX');
    expect(serialized).not.toContain('supabase');
    expect(serialized).not.toMatch(/api[_-]?key/i);
  });

  it('exposes component-state contracts to the in-Builder lane', () => {
    const bounded = boundRegistryContext(canonical());
    const withStates = bounded.implementations.filter(entry => entry.componentStates?.supported?.length);
    expect(withStates.length).toBeGreaterThan(0);
    for (const entry of withStates) {
      expect(entry.componentStates!.responsive).toContain('reduced-motion');
    }
  });

  it('exposes the Wizard design vocabulary needed for Builder authorship', () => {
    const bounded = boundRegistryContext(canonical(), { pageRole: 'shop' });
    expect(bounded.artDirectionGrammar).toBeTruthy();
    expect(bounded.implementations.some(entry => entry.pageRoles.includes('shop'))).toBe(true);
    expect(bounded.implementations.some(entry => entry.vocabularyRefs.length > 0)).toBe(true);
    expect(bounded.portableRecipeIds).toEqual(bounded.implementations.map(entry => entry.id));
    expect(bounded.primitiveFamilies?.length).toBeGreaterThan(0);
    expect(bounded.motionPrimitives?.length).toBeGreaterThan(0);
    expect(bounded.artifacts?.length).toBeGreaterThan(0);
    expect(bounded.catalogSurfaces?.length).toBeGreaterThan(0);
    expect(bounded.capabilityRequirements).toBeDefined();
  });

  it('filters page-ineligible variant IDs from the scoped Composer registry', () => {
    const base = canonical();
    const ids = ['hero:launch-showcase', 'hero:blog-editorial', 'cta:split-card', 'cta:blog-subscribe'];
    const implementation = (id: string, sectionType: string, pageRoles: string[]) => ({
      id, sectionType, name: id, certification: 'approved', pageRoles, vocabularyRefs: [], radixPrimitives: [],
    });
    const context = {
      ...base,
      sections: base.sections.map((section) => section.type === 'hero' || section.type === 'cta'
        ? { ...section, allowedVariantIds: ids.filter((id) => id.startsWith(`${section.type}:`)) }
        : section),
      implementations: [
        implementation(ids[0], 'hero', ['home', 'services', 'pricing']),
        implementation(ids[1], 'hero', ['blog']),
        implementation(ids[2], 'cta', ['home', 'services', 'about', 'booking']),
        implementation(ids[3], 'cta', ['blog']),
      ],
    } as unknown as typeof base;

    const bounded = boundRegistryContext(context, { pageRole: 'blog' });

    expect(bounded.sections.find((section) => section.type === 'hero')?.allowedVariantIds).toEqual(['hero:blog-editorial']);
    expect(bounded.sections.find((section) => section.type === 'cta')?.allowedVariantIds).toEqual(['cta:blog-subscribe']);
    expect(bounded.implementations.map((entry) => entry.id)).toEqual(['hero:blog-editorial', 'cta:blog-subscribe']);
  });

  it('resolves from the draft VFS and matches the aggregated context', () => {
    const context = canonical();
    const fromVfs = resolveBuilderRegistryContext({
      vfsFiles: {
        [WIZARD_REGISTRY_CONTEXT_PATH]: JSON.stringify(context),
        '/src/pages/Home.tsx': 'export default function Home(){return <main/>}',
        '/src/project-components/Hero.tsx': 'export function Hero(){return <section/>}',
      },
      pageRole: 'home',
    });
    const rebuilt = resolveBuilderRegistryContext({
      industry: 'store',
      templateId: 'store-premium',
      themePresetId: 'commerce-editorial',
    });
    expect(fromVfs?.sections.map(s => s.type)).toEqual(rebuilt?.sections.map(s => s.type));
    expect(fromVfs?.designRegistrySignature).toBe(rebuilt?.designRegistrySignature);
    expect(fromVfs?.validImportPaths).toEqual(expect.arrayContaining([
      '@/pages/Home',
      '@/project-components/Hero',
    ]));
  });

  it('never throws for a legacy draft without registry context', () => {
    expect(resolveBuilderRegistryContext({ vfsFiles: {} })).toBeNull();
  });
});
