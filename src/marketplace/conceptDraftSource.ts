import { parse } from '@babel/parser';
import authoredSource from './authoredTemplatePreviews.tsx?raw';
import additionalSource from './additionalMarketplacePreviews.tsx?raw';
import { createBuilderPage, createEmptyPageRegistry } from '@/types/pageRegistry';
import { generateCanonicalRouter } from '@/utils/topologyRouterGenerator';
import { buildCanonicalLaunchPlan, projectCanonicalLaunchCandidateSnapshot } from '@/services/launch/canonicalLaunchPlan';
import { buildCanonicalLaunchArtifacts } from '@/services/canonicalLaunchVfs';
import { createWizardDesignSelection } from '@/services/wizardDesignSelection';
import { ART_DIRECTION_PACKS, type ArtDirectionPackId } from '@/sections/variants';
import { MARKETPLACE_TEMPLATE_VARIANT_PROFILES } from './MarketplaceRegisteredSection';
import { buildMarketplaceRhythmTokens } from './marketplaceGeometricRhythm';
import { ART_DIRECTION_FAMILY_REGISTRY } from '@/sections/variants/themeFamily';
import actionsCss from './marketplaceActions.css?raw';
import type { AuthoredMarketplaceTemplate } from './marketplaceTemplatePrimitives';
import type { IndustryOverlay, WizardSelections } from '@/types/playground';

const vendorSources = import.meta.glob('/src/design-system/unison-x-loveable-design-d5be96/design-system/unison/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const vendorSupport = import.meta.glob('/src/design-system/unison-x-loveable-design-d5be96/design-system/unison/{types,themeUtils}.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const vendorHelpers = import.meta.glob('/src/design-system/unison-x-loveable-design-d5be96/design-system/unison/components/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const pageFile = (id: string) => `/src/pages/${id.replace(/[^a-zA-Z0-9]/g, '_')}.tsx`;

const industries: Record<string, IndustryOverlay> = {
  Hospitality: 'restaurant', Architecture: 'agency', Software: 'saas', 'Beauty & Wellness': 'wellness',
  'Real Estate': 'real_estate', 'Objects & Retail': 'ecommerce', 'Retail & Objects': 'ecommerce',
  'Nonprofit & Community': 'nonprofit', 'Local Services': 'local-service', 'Fitness & Movement': 'fitness',
  Education: 'coaching', 'Boutique Lodging': 'restaurant', Photography: 'photographer',
};

/** Select real authored declarations, not rendered HTML or a newly generated design. */
function selectAuthoredSource(templateId: string) {
  for (const source of [authoredSource, additionalSource]) {
    const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    const declarations = new Map<string, typeof ast.program.body[number]>();
    let previewName = '';
    const walk = (value: unknown, visit: (node: Record<string, unknown>) => void) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(child => walk(child, visit)); return; }
      const node = value as Record<string, unknown>;
      visit(node);
      Object.entries(node).filter(([key]) => !['loc', 'start', 'end', 'comments'].includes(key)).forEach(([, child]) => walk(child, visit));
    };
    for (const statement of ast.program.body) {
      if (statement.type === 'FunctionDeclaration' && statement.id) declarations.set(statement.id.name, statement);
      if (statement.type === 'VariableDeclaration') for (const d of statement.declarations) if (d.id.type === 'Identifier') declarations.set(d.id.name, statement);
      if (statement.type === 'ExportNamedDeclaration') walk(statement, node => {
        if (node.type !== 'ObjectExpression' || !Array.isArray(node.properties)) return;
        const fields = node.properties as Array<{ key?: { name?: string }; value?: { value?: string; name?: string } }>;
        if (fields.find(p => p.key?.name === 'id')?.value?.value === templateId) previewName = fields.find(p => p.key?.name === 'preview')?.value?.name ?? '';
      });
    }
    if (!previewName) continue;
    const selected = new Set<typeof ast.program.body[number]>();
    const include = (name: string) => {
      const statement = declarations.get(name);
      if (!statement || selected.has(statement)) return;
      selected.add(statement);
      walk(statement, node => { if (node.type === 'Identifier' && typeof node.name === 'string') include(node.name); });
    };
    include(previewName);
    const used = new Set<string>();
    for (const statement of selected) walk(statement, node => { if (node.type === 'Identifier' && typeof node.name === 'string') used.add(node.name); });
    const imports = ast.program.body.filter(s => s.type === 'ImportDeclaration' && s.importKind !== 'type' && s.specifiers.some(spec => used.has(spec.local.name))).map(s => source.slice(s.start ?? 0, s.end ?? 0));
    return `${imports.join('\n')}\n${ast.program.body.filter(s => selected.has(s)).map(s => source.slice(s.start ?? 0, s.end ?? 0)).join('\n')}\nexport default ${previewName};`;
  }
  throw new Error('This template has no authored source to install.');
}

export function buildConceptDraftSource(template: AuthoredMarketplaceTemplate) {
  const profile = MARKETPLACE_TEMPLATE_VARIANT_PROFILES[template.id as keyof typeof MARKETPLACE_TEMPLATE_VARIANT_PROFILES];
  if (!profile) throw new Error('Template design direction is unavailable.');
  const packId = profile.artDirectionPackId as ArtDirectionPackId;
  const family = ART_DIRECTION_FAMILY_REGISTRY[packId].primaryFamily;
  const selections: WizardSelections = {
    businessName: template.name, businessModel: 'general', industryOverlay: industries[template.category] ?? 'agency',
    systemType: 'agency', primaryGoal: 'lead_capture', secondaryGoals: [], requestedPages: ['home'],
    scaffoldMode: 'selected-pages', templateId: template.id, themePresetId: family, themeId: family,
    themeTokens: template.theme, designSelection: createWizardDesignSelection({ artDirectionPackId: packId }),
  };
  const plan = buildCanonicalLaunchPlan(selections);
  const registry = createEmptyPageRegistry();
  const destinations = [{ id: 'home', path: '/', title: template.name, archetype: 'home' }, ...template.pages];
  for (const [index, page] of destinations.entries()) registry.pages[page.id] = createBuilderPage(page.id, page.title, page.path, page.archetype as never, {
    filePath: pageFile(page.id), isHome: index === 0, navOrder: index, routeState: 'generated',
  });
  registry.homePageId = 'home';
  plan.playground.pageRegistry = registry;
  plan.sitePlan.pages = destinations.map(page => ({ id: page.id, route: page.path, role: page.archetype, title: page.title, isHome: page.id === 'home', filePath: pageFile(page.id) })) as typeof plan.sitePlan.pages;
  const files = { ...plan.infrastructureFiles };
  files['/src/App.tsx'] = generateCanonicalRouter(registry, template.name);
  const tokens = buildMarketplaceRhythmTokens(packId, 'home');
  files['/src/index.css'] += `\n:root {${Object.entries(tokens).map(([k, v]) => `${k}:${v};`).join('')}}\n${actionsCss}`;
  files['/src/marketplace/selectedPreview.tsx'] = selectAuthoredSource(template.id);
  files['/src/marketplace/template.json'] = JSON.stringify({ ...template, preview: undefined, themePresetId: family, packTokens: tokens });
  // Ship unchanged managed source; the adapter maps canonical ids to these real exports.
  const vendorRoot = '/src/design-system/unison-x-loveable-design-d5be96/design-system/unison/';
  const vendorImports: string[] = [];
  const vendorMap: string[] = [];
  const sourcePool = { ...vendorSources, ...vendorSupport, ...vendorHelpers };
  const includeVendor = (path: string) => {
    if (files[path]) return;
    const source = sourcePool[path];
    if (!source) throw new Error(`Missing Unison source dependency: ${path}`);
    files[path] = source;
    for (const match of source.matchAll(/from\s*['"](\.[^'"]+)['"]/g)) {
      const parts = path.split('/'); parts.pop();
      for (const part of match[1].split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); }
      const base = parts.join('/');
      const dependency = [base, base + '.tsx', base + '.ts'].find(p => sourcePool[p]);
      if (!dependency) throw new Error(`Missing Unison source dependency: ${base}`);
      includeVendor(dependency);
    }
  };
  for (const [path, source] of Object.entries(sourcePool)) {
    const id = source.match(/(?:data-ut-variant(?:-id)?|variantId)=["']([^"']+)["']/)?.[1];
    const name = source.match(/export (?:const|function) (\w+)/)?.[1];
    if (id && name) { includeVendor(path); vendorImports.push(`import { ${name} } from ${JSON.stringify(path.replace('/src/', '@/').replace(/\.tsx$/, ''))};`); vendorMap.push(`${JSON.stringify(id)}: ${name}`); }
  }
  if (!Object.keys(files).some(p => p.startsWith(vendorRoot))) throw new Error('Unison layout source is unavailable.');
  files['/src/marketplace/MarketplaceRegisteredSection.tsx'] = `${vendorImports.join('\n')}
import React from 'react';
import template from './template.json';
const variants: any = {${vendorMap.join(',')}};
export const MARKETPLACE_TEMPLATE_VARIANT_PROFILES: any = ${JSON.stringify({ [template.id]: profile })};
export function MarketplaceRegisteredSection({ section, variantId, theme }: any) {
 const slot = section.type === 'blog-preview' ? 'journal' : section.type;
 const id = MARKETPLACE_TEMPLATE_VARIANT_PROFILES[template.id].variants[slot] || variantId;
 const C = variants[id];
 if (!C) throw new Error('Template section unavailable: ' + id);
 return <div data-ut-marketplace-geometry style={{'--ut-marketplace-radius': template.packTokens['--ut-radius-base']} as any}><C section={section} theme={{...theme, radius: template.packTokens['--ut-radius-base'], sectionPadding: 'var(--ut-rhythm-space) var(--ut-inline-gutter)'}} /></div>;
}`;
  files['/src/marketplace/marketplaceImagePlaceholders.ts'] = `export const MARKETPLACE_SAMPLE_IMAGES = { objects: '/assets/marketplace-placeholder.svg' };`;
  files['/assets/marketplace-placeholder.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><text x="400" y="300" text-anchor="middle">Add your own image</text></svg>';
  files['/src/marketplace/marketplaceTemplatePrimitives.tsx'] = `import React from 'react';
import template from './template.json';
export type AuthoredMarketplaceTemplate = any; export type MarketplacePreviewProps = any; export type MarketplaceTemplateBinding = any;
export const getMarketplaceVariantTheme = () => template.theme;
export const marketplaceBindingAttributes = (b: any) => ({'data-ut-intent': b.intent, 'data-ut-binding-id': b.id, 'data-ut-slot': b.sourceSlot, 'data-ut-params': b.product ? JSON.stringify(b.product) : undefined});
export const RegistryBoundLink = ({binding, onIntent, ...props}: any) => <a {...props} {...marketplaceBindingAttributes(binding)} />;
export const RegistryBoundButton = ({binding, onIntent, ...props}: any) => <button {...props} {...marketplaceBindingAttributes(binding)} />;
export const RegistryBoundForm = ({binding, onIntent, ...props}: any) => <form {...props} {...marketplaceBindingAttributes(binding)} />;
export const MarketplacePageNavigation = ({pages, currentPagePath, className}: any) => <nav className={className}>{[{id:'home',path:'/',label:'Home'},...pages].map((p: any) => <a key={p.id} href={'#'+p.path} aria-current={p.path===currentPagePath?'page':undefined}>{p.label}</a>)}</nav>;`;
  files['/src/sections/types.ts'] = `export type SectionEntry<T = string> = any;`;
  for (const page of destinations) files[pageFile(page.id)] = `import React from 'react';
import Preview from '@/marketplace/selectedPreview';
import template from '@/marketplace/template.json';
import { MarketplaceRegisteredSection } from '@/marketplace/MarketplaceRegisteredSection';
export default function Page() { return <main data-marketplace-preview-surface>${page.id === 'home' ? `<Preview compact={false} templateId={template.id} templateName={template.name} pages={template.pages} currentPagePath="/" onNavigate={(path: string) => {location.hash = path;}} onIntent={() => {}} />` : `<header><h1>${page.title.replace(/</g, '&lt;')}</h1><nav><a href="#/">Home</a>{template.pages.map(p => <a key={p.id} href={'#'+p.path}>{p.label}</a>)}</nav></header>{template.pages.find(p => p.id === ${JSON.stringify(page.id)})?.sections.map(s => <MarketplaceRegisteredSection key={s.id} section={s} variantId={s.variantId} theme={template.theme} />)}<footer>{template.name}</footer>`}</main>; }`;
  // Unverified stock references stay buyer supplied; never bundle their bytes or grant rights.
  for (const path of Object.keys(files).filter(p => p.startsWith('/src/marketplace/'))) files[path] = files[path].replace(/https:\/\/images\.unsplash\.com\/[^'"\s)]+/g, '/assets/marketplace-placeholder.svg');
  const snapshot = projectCanonicalLaunchCandidateSnapshot(plan, selections, files);
  return buildCanonicalLaunchArtifacts({ generatedFiles: files, siteBundleSnapshot: snapshot, canonicalPlayground: plan.playground, preferredEntryPoint: '/src/App.tsx', mergeWithCanonicalSnapshot: true, allowCanonicalPageFallback: false, strictPreflight: true, themePresetId: family, businessName: template.name, industry: selections.industryOverlay });
}