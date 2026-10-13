/** Single per-job derivation of everything a page turn may know, taken only from the sealed contract. */

import type { AppBuildContract } from '@/services/app-builder/appBuilderContracts';
import { resolveDesignSourceBundle, isGenericImplementationId } from './design/designSystemResolver';
import type { DesignSourceBundle } from './design/DesignSourceBundle';
import { materializeDesignSources, type DesignSourceMaterialization } from './design/designSourceMaterializer';
import { getIndustryProfile } from '@/platform/core/industryMatrix';

export interface AppBuilderGenerationContext {
  contract: AppBuildContract;
  designSources: DesignSourceBundle;
  materialization: DesignSourceMaterialization;
  runtimeContext: string;
  /** Same facts with design-source modules trimmed to what one page may use. */
  runtimeContextForPage: (pageId: string) => string;
}

export function buildIndustryAuthoringContext(industry: string, enabledCapabilities: readonly string[]): string {
  const profile = getIndustryProfile(industry);
  if (!profile) {
    return `INDUSTRY AUTHORING CONTRACT: preserve the selected business identity "${industry}". Treat focused owner requests as additive and do not reclassify the business from a page-level feature request.`;
  }

  const catalogBySeedKey: Record<string, string> = {
    menu_items: 'catalog.menu',
    products: 'catalog.products',
    services: 'catalog.services',
  };
  const industryCatalogs = [...new Set(profile.seedDataKeys.flatMap((key) => catalogBySeedKey[key] ?? []))];
  return [
    `INDUSTRY AUTHORING CONTRACT: canonical industry ${profile.industry} (${profile.name}). Keep this business identity even when the owner requests a focused feature.`,
    `Industry seed data: ${profile.seedDataKeys.join(', ')}. Generate domain-specific copy and assets for these data types rather than substituting a generic catalog.`,
    `Industry catalog targets: ${industryCatalogs.join(', ') || 'none'}. Launch capabilities: ${enabledCapabilities.join(', ') || 'none'}.`,
    'A focused user intent is additive to the selected industry: implement it with enabled capabilities and matching industry data; do not change the business category or invent unprovisioned tables, APIs, or controllers.',
  ].join('\n');
}

export function buildAppBuilderGenerationContext(contract: AppBuildContract): AppBuilderGenerationContext {
  const { business, runtime } = contract;
  const designSources = resolveDesignSourceBundle(contract);
  const materialization = materializeDesignSources(designSources);
  const industryContext = buildIndustryAuthoringContext(business.industry, business.capabilities);
  const compose = (modules: string) => [
    `Industry ${business.industry}; goals ${business.goals.join(', ') || 'none'}.`,
    industryContext,
    `Intents: ${business.intents.join(', ') || 'none'}; capabilities: ${business.capabilities.join(', ') || 'none'}.`,
    business.bindingGuide ? `Binding guide: ${business.bindingGuide}` : '',
    `Protected paths: ${runtime.protectedPaths.join(', ')}.`,
    `Approved dependencies: ${runtime.approvedDependencies.join(', ')}.`,
    modules,
    `Approved experience capabilities: ${runtime.approvedExperienceCapabilities.join(', ') || 'none'}.`,
  ].filter(Boolean).join('\n');
  return {
    contract,
    designSources,
    materialization,
    runtimeContext: compose(renderDesignSourceModules(materialization)),
    runtimeContextForPage: (pageId) => compose(renderDesignSourceModules(materialization, new Set(designSources.eligibleByPage[pageId] ?? []))),
  };
}

const MAX_IDS_PER_MODULE = 12;

function renderDesignSourceModules(materialization: DesignSourceMaterialization, only?: ReadonlySet<string>): string {
  const byModule = new Map<string, string[]>();
  const exports = new Map<string, string>();
  for (const [id, entry] of Object.entries(materialization.manifest.implementations)) {
    if (only && only.size > 0 && !only.has(id)) continue;
    if (entry.exportName) exports.set(id, entry.props ? entry.exportName + '(' + entry.props + ')' : entry.exportName);
    byModule.set(entry.modulePath, [...(byModule.get(entry.modulePath) ?? []), id]);
  }
  const lines = [...byModule].sort(([a], [b]) => a.localeCompare(b)).map(([modulePath, ids]) =>
    `- ${modulePath.replace(/^\/src\//, '@/').replace(/\.tsx$/, '')} (props, variantId): ${ids.sort().slice(0, only ? ids.length : MAX_IDS_PER_MODULE).map((id) => (exports.has(id) ? `${id}={ ${exports.get(id)} }` : id)).join(', ')}`);
  return lines.length
    ? `Certified design-source modules (read-only; import the named export and pass the listed props directly, e.g. import { Name } from '@/unison/design-sources/<Family>'; <Name headline=".." items={[..]} />; props marked [] are required, non-empty arrays (name?[] is optional and may be omitted) and {a|b|c?} lists the fields every item needs (? = optional; fill each non-? field with real business copy, never leave items empty); headline/subheadline are plain strings, never nested <h1>/<h2>; never import from recipes/ or REGISTERED_VARIANTS):\n${lines.join('\n')}`
    : '';
}

export interface DesignSourceUsageReport {
  version: '1.0';
  eligiblePerPage: Record<string, number>;
  referencedPerPage: Record<string, string[]>;
  genericFallbackIds: string[];
  primitiveOnlyPages: string[];
}

/** R0: which design sources were available and which a candidate actually references. */
export function reportDesignSourceUsage(
  contract: AppBuildContract,
  bundle: DesignSourceBundle,
  files: Readonly<Record<string, string>>,
): DesignSourceUsageReport {
  const report: DesignSourceUsageReport = { version: '1.0', eligiblePerPage: {}, referencedPerPage: {}, genericFallbackIds: [], primitiveOnlyPages: [] };
  const known = bundle.implementations.map((impl) => impl.implementationId);
  const generic = new Set<string>();
  for (const page of contract.topology.sitePlan.pages) {
    const source = files[page.filePath] ?? '';
    const referenced = known.filter((id) => source.includes(id));
    report.eligiblePerPage[page.id] = bundle.eligibleByPage[page.id]?.length ?? 0;
    report.referencedPerPage[page.id] = referenced;
    referenced.filter(isGenericImplementationId).forEach((id) => generic.add(id));
    if (referenced.length === 0 && report.eligiblePerPage[page.id] > 0) report.primitiveOnlyPages.push(page.id);
  }
  report.genericFallbackIds = [...generic].sort();
  return report;
}
