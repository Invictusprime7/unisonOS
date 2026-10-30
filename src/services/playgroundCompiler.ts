import { resolveTopologyPageRoleAlias, roleToPageType } from '@/platform/core/siteTopologyPlanner';
/**
 * Playground Compiler - compiles PlaygroundState into runtime artifacts.
 *
 * Wizard-registered pages are scaffolded here so the canonical router and VFS
 * are structurally complete before the launch reaches WebBuilder readiness.
 */

import type {
  PlaygroundState,
  PlaygroundCompileResult,
  PlaygroundBinding,
} from '@/types/playground';
import { generateCanonicalRouterForFiles } from '@/utils/topologyRouterGenerator';
import { generateTopologyPlaceholderFiles } from '@/utils/topologyVFSScaffolder';
import { PreviewPipelineError } from './previewPipelineError';
import { deriveFilePath } from './routeNavigationService';
import { ensureViteRootFiles } from './previewSession';
import { getCompositionById } from '@/sections/templates';
import type { LayoutCategory } from '@/data/templates/types';
import type { BuilderPage } from '@/types/pageRegistry';
import type { GeneratedSitePlan, PageRole, PageRouteNode } from '@/platform/core/siteTopologyPlanner';
import type { WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import { collectResolvedCompositions, resolvedCompositionPathFor } from '@/platform/core/resolvedComposition';
import { collectReachableFiles } from '@/utils/dependencyExtractor';
import { updateResolvedCompositionVariants } from '@/sections/compositionToFileSet';
import { materializeAppBuilderSectionModels } from '@/services/app-builder/appBuilderSectionModel';

export interface CompilePlaygroundOptions {
  /** Selected template used to generate real role-filtered page scaffolds. */
  selectedTemplateId?: string;
  /** Selected theme id retained for pipeline compatibility. */
  selectedThemeId?: string;
  /** Resolved wizard ThemePreset id used for route-level token seeding. */
  themePresetId?: string;
  /** Exact Stage 4b stylesheet supplied by the canonical pipeline. */
  stage4bCss?: string;
  /** Industry overlay used by template/page scaffolding. */
  industry?: LayoutCategory | string | null;
  /** Versioned visual recipes chosen by the canonical wizard pipeline. */
  designIntervention?: Pick<WizardDesignIntervention, 'motionRecipes' | 'sectionVariants' | 'activeVariants'> & Partial<Pick<WizardDesignIntervention, 'industry' | 'themePresetId' | 'layoutRecipe' | 'interactionRecipes' | 'seed' | 'envelope' | 'compositionPolicy'>>;
}

type WizardSeedLike = Record<string, unknown> & {
  templateId?: string;
  themePresetId?: string;
  themeId?: string;
  industry?: string;
  business?: { industry?: string };
  template?: { id?: string };
  theme?: { presetId?: string; id?: string };
  selections?: {
    templateId?: string;
    themePresetId?: string;
    themeId?: string;
    industryOverlay?: string;
    industry?: string;
  };
};

function parseWizardSeed(existingVfsFiles: Record<string, string>): WizardSeedLike | null {
  const seedRaw = existingVfsFiles['/.unison/wizard-seed.json'];
  if (!seedRaw) return null;
  try {
    return JSON.parse(seedRaw) as WizardSeedLike;
  } catch (err) {
    console.warn('[playgroundCompiler] Failed to parse /.unison/wizard-seed.json; subpages will use pipeline options only.', err);
    return null;
  }
}

function parseJsonFile<T>(existingVfsFiles: Record<string, string>, path: string): T | null {
  const raw = existingVfsFiles[path];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function firstText(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function assertWizardTopologyClosure(
  pages: BuilderPage[],
  vfsFiles: Record<string, string>,
  routerContent: string,
  selectedTemplateId?: string,
): void {
  if (!selectedTemplateId) return;

  const blockedFiles: string[] = [];
  const problems: string[] = [];

  for (const page of pages) {
    const filePath = page.filePath || deriveFilePath(page);
    const source = vfsFiles[filePath];
    const role = page.pageRole;
    const isClassified = Boolean(role && role !== 'custom' && page.pageType !== 'custom');
    const isRenderable = Boolean(source?.trim() && /export\s+default\b/.test(source));

    if (!isClassified || !page.path || !filePath || !isRenderable) {
      blockedFiles.push(filePath);
      problems.push(
        `${filePath}: ${[
          !isClassified ? 'unclassified page role' : null,
          !page.path ? 'missing route' : null,
          !isRenderable ? 'missing renderable module' : null,
        ].filter(Boolean).join(', ')}`,
      );
    }
  }

  if (!routerContent.trim()) {
    problems.push('/src/App.tsx: missing canonical router');
    blockedFiles.push('/src/App.tsx');
  }

  if (problems.length > 0) {
    throw new PreviewPipelineError(
      'vfs',
      `Wizard template "${selectedTemplateId}" did not produce a closed renderable topology: ${problems.join(' | ')}`,
      { blockedFiles, recoverableByRelaunch: true },
    );
  }
}

export function compilePlayground(
  state: PlaygroundState,
  existingVfsFiles: Record<string, string> = {},
  businessName?: string,
  options?: CompilePlaygroundOptions,
): PlaygroundCompileResult {
  const registry = state.pageRegistry;
  const pages = Object.values(registry.pages);

  // Self-heal page roles before any topology work: drafts persisted before a
  // role existed (or pages authored by an older lane) may carry pageRole
  // 'custom'/'' even when their path or type is fully classifiable (e.g.
  // /experience => immersive). Re-inferring here makes the fix retroactive
  // for every industry and every saved draft, not only new launches.
  for (const page of pages) {
    const roleUnclassified = !page.pageRole || page.pageRole === 'custom';
    const typeUnclassified = !page.pageType || page.pageType === 'custom';
    if (!roleUnclassified && !typeUnclassified) continue;
    const inferred = inferTopologyRole(page);
    if (inferred === 'custom') continue;
    if (roleUnclassified) page.pageRole = inferred as BuilderPage['pageRole'];
    if (typeUnclassified) page.pageType = roleToPageType(inferred);
  }

  const wizardSeed = parseWizardSeed(existingVfsFiles);
  const snapshotMeta = parseJsonFile<{
    meta?: { templateId?: string | null; themePresetId?: string | null; industry?: string | null };
    appContext?: { templateId?: string | null; themePresetId?: string | null; industry?: string | null };
    industry?: string | null;
  }>(existingVfsFiles, '/.unison/site-bundle-snapshot.json');
  const runtimeManifest = parseJsonFile<{
    appContext?: { templateId?: string | null; themePresetId?: string | null; industry?: string | null };
    aesthetic?: string | null;
    industry?: string | null;
  }>(existingVfsFiles, '/.unison/runtime-manifest.json');
  const appContext = parseJsonFile<{
    templateId?: string | null;
    themePresetId?: string | null;
    industry?: string | null;
  }>(existingVfsFiles, '/.unison/app-context.json');
  // Saved projects (e.g. marketplace installs) may carry a template id that is
  // not a registered composition. On recompile their saved pages are the
  // authority, so the unknown id is dropped with a warning instead of failing.
  const hasSavedPages = Object.keys(existingVfsFiles ?? {}).some((p) => p.startsWith('/src/pages/'));
  const registeredOrNull = (id: string | null | undefined) => {
    if (!id) return id;
    if (getCompositionById(id)) return id;
    if (hasSavedPages) {
      console.warn(`[playgroundCompiler] template "${id}" is not a registered composition; keeping saved pages.`);
      return null;
    }
    return id;
  };
  const resolvedTemplateId = registeredOrNull(firstText(
    options?.selectedTemplateId,
    snapshotMeta?.meta?.templateId,
    snapshotMeta?.appContext?.templateId,
    runtimeManifest?.appContext?.templateId,
    appContext?.templateId,
    wizardSeed?.templateId,
    wizardSeed?.template?.id,
    wizardSeed?.selections?.templateId,
  ));
  const resolvedThemePresetId = firstText(
    options?.themePresetId,
    options?.selectedThemeId,
    snapshotMeta?.meta?.themePresetId,
    snapshotMeta?.appContext?.themePresetId,
    runtimeManifest?.appContext?.themePresetId,
    runtimeManifest?.aesthetic,
    appContext?.themePresetId,
    wizardSeed?.themePresetId,
    wizardSeed?.theme?.presetId,
    wizardSeed?.theme?.id,
    wizardSeed?.selections?.themePresetId,
    wizardSeed?.selections?.themeId,
  );
  const resolvedIndustry = firstText(
    options?.industry,
    snapshotMeta?.meta?.industry,
    snapshotMeta?.appContext?.industry,
    snapshotMeta?.industry,
    runtimeManifest?.appContext?.industry,
    runtimeManifest?.industry,
    appContext?.industry,
    wizardSeed?.business?.industry,
    wizardSeed?.industry,
    wizardSeed?.selections?.industry,
    wizardSeed?.selections?.industryOverlay,
  );

  if (options?.selectedTemplateId && !getCompositionById(options.selectedTemplateId) && !hasSavedPages) {
    throw new PreviewPipelineError(
      'vfs',
      `Wizard selected template "${options.selectedTemplateId}" is not registered; refusing to substitute an unrelated industry composition.`,
      { recoverableByRelaunch: true },
    );
  }

  for (const page of pages) {
    if (!page.filePath) {
      page.filePath = deriveFilePath(page);
    }
  }

  const scaffoldPlan = buildScaffoldPlan(registry.homePageId, pages, businessName, {
    ...options,
    selectedTemplateId: resolvedTemplateId,
    selectedThemeId: options?.selectedThemeId,
    themePresetId: resolvedThemePresetId,
    industry: resolvedIndustry,
  });

  // ── Wizard-seed injection (page hash routes) ─────────────────────────────
  // Parse the durable WizardSeed from `/.unison/wizard-seed.json` if the
  // wizard pre-wrote it into `existingVfsFiles`, and attach it to the scaffold
  // plan. Downstream `topologyVFSScaffolder.tryComposeTopologyPageFiles` reads
  // `plan.wizardSeed` and overlays brand/contact/tagline onto every composed
  // page module — so subpages reflect the wizard selections instead of the
  // template's neutral sample copy. Without this overlay, only Lane B's
  // AI-authored Home page would carry brand context.
  if (wizardSeed) {
    (scaffoldPlan as GeneratedSitePlan & { wizardSeed?: Record<string, unknown> }).wizardSeed = wizardSeed;
  }


  // Composition-only contract: pages are ONLY emitted from the active
  // SiteBundle/template composition. Existing page files are intentionally not
  // preserved for wizard-generated routes: stale AI/Lane-B shells are the
  // source of the hardcoded minimal preview regressions. The SiteBundleSnapshot
  // + WizardSeed pipeline is authoritative for every registered hash route.
  const vfsFiles: Record<string, string> = {};
  let sectionImplementations: Record<string, { modulePath: string; sectionType: string; exportName?: string }> = {};
  try {
    sectionImplementations = JSON.parse(existingVfsFiles['/.unison/design-source-manifest.json'] ?? 'null')?.implementations ?? {};
  } catch {
    sectionImplementations = {};
  }
  const existingPageFiles = materializeAppBuilderSectionModels(
    existingVfsFiles,
    pages.flatMap((page) => page.filePath && existingVfsFiles[page.filePath]
      ? [{ id: page.pageId, filePath: page.filePath }]
      : []),
    sectionImplementations,
  );
  const activated = collectResolvedCompositions(existingPageFiles);
  const preserved: Record<string, string> = {};
  const blockedWizardPages: string[] = [];

  for (const page of pages) {
    const fp = page.filePath!;
    const node = scaffoldPlan.pages.find((p) => p.id === page.pageId);

    if (!node) {
      blockedWizardPages.push(fp);
      continue;
    }

    try {
      const previous = activated[fp];
      const previousOverrides = previous?.variantOverrides ?? {};
      const nextOverrides = options?.designIntervention?.activeVariants ?? {};
      const overridesUnchanged = [...new Set([...Object.keys(previousOverrides), ...Object.keys(nextOverrides)])]
        .every(id => previousOverrides[id] === nextOverrides[id]);
      if ((previous?.activation || previous?.compiledBy === 'app-builder') && existingPageFiles[fp]) {
        // Accepted Stage 4b and App Builder pages are durable authoring state.
        // Recompiles update resolved variants but never replace their page source.
        Object.assign(preserved, collectReachableFiles(existingPageFiles, [fp]));
        const descriptor = resolvedCompositionPathFor(fp);
        preserved[descriptor] = existingPageFiles[descriptor];
        if (!overridesUnchanged) {
          const updated = updateResolvedCompositionVariants(existingPageFiles[fp], previous, nextOverrides, existingPageFiles);
          Object.assign(preserved, updated.updatedSources);
          preserved[fp] = updated.source;
          preserved[descriptor] = JSON.stringify(updated.composition, null, 2) + '\n';
        }
        if (!node.isHome && businessName && node.title) {
          const composition = collectResolvedCompositions({ [descriptor]: preserved[descriptor] })[fp];
          preserved[descriptor] = JSON.stringify({ ...composition, templateName: `${businessName} · ${node.title}` }, null, 2) + '\n';
        }
        continue;
      }
      // Multi-file emit: page module + per-section components under
      // /src/components/*. Shared component files are idempotent across
      // pages and safe to merge by Object.assign.
      const fileSet = generateTopologyPlaceholderFiles(node, scaffoldPlan, undefined, {
        designIntervention: (previous?.activation || previous?.compiledBy === 'app-builder') && options?.designIntervention
          ? { ...options.designIntervention, compositionPolicy: 'maximum-compatible' }
          : options?.designIntervention,
      });
      Object.assign(vfsFiles, fileSet);
      // A regenerated route must carry the current PageRegistry title into its
      // resolved composition just like a preserved route. Otherwise a rename
      // leaves the VFS descriptor (and downstream preview metadata) stale.
      if (!node.isHome && businessName && node.title) {
        const descriptor = resolvedCompositionPathFor(fp);
        const composition = collectResolvedCompositions({ [descriptor]: vfsFiles[descriptor] })[fp];
        if (composition) {
          vfsFiles[descriptor] = JSON.stringify({
            ...composition,
            templateName: `${businessName} · ${node.title}`,
          }, null, 2) + '\n';
        }
      }
    } catch (err) {
      if (err instanceof PreviewPipelineError) {
        blockedWizardPages.push(fp);
        continue;
      }
      throw err;
    }
  }

  if (blockedWizardPages.length > 0) {
    throw new PreviewPipelineError(
      'vfs',
      `SiteBundleSnapshot has no composition for ${blockedWizardPages.length} wizard page(s); refusing to emit minimal scaffold.`,
      { blockedFiles: blockedWizardPages, recoverableByRelaunch: true },
    );
  }


  Object.assign(vfsFiles, preserved);
  const routerContent = generateCanonicalRouterForFiles(registry, vfsFiles, businessName);
  const routerFile = {
    path: '/src/App.tsx',
    content: routerContent,
  };

  if (routerContent) {
    vfsFiles['/src/App.tsx'] = routerContent;
  }

  assertWizardTopologyClosure(pages, vfsFiles, routerContent, options?.selectedTemplateId);

  // Inject canonical root config files (.json + tooling) so the wizard runtime
  // VFS always has package.json/tsconfig/vite/tailwind/postcss, matching what
  // canonical launch and live preview expect. Idempotent — won't overwrite
  // existing user-authored config files.
  const hydratedVfsFiles = ensureViteRootFiles(vfsFiles, {
    themePresetId: resolvedThemePresetId ?? null,
    stage4bCss: options?.stage4bCss,
  });

  for (const [p, c] of Object.entries(hydratedVfsFiles)) {
    if (!(p in vfsFiles)) vfsFiles[p] = c;
  }

  const homeRoute = pages.find((p) => p.isHome)?.path || '/';
  const routes = pages
    .filter((p) => !p.isHome)
    .filter((p) => Boolean(p.filePath && vfsFiles[p.filePath]))
    .map((p) => p.path)
    .sort();

  return {
    pageRouteRegistry: registry,
    vfsFiles,
    routerFile,
    bindingManifest: { ...state.bindings },
    previewManifest: {
      routes: ['/', ...routes],
      homeRoute,
    },
  };
}

function buildScaffoldPlan(
  homePageId: string | null | undefined,
  pages: BuilderPage[],
  businessName?: string,
  options?: CompilePlaygroundOptions,
): GeneratedSitePlan {
  const pageNodes: PageRouteNode[] = pages
    .slice()
    .sort((a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0))
    .map((page) => ({
      id: page.pageId,
      name: page.title,
      title: page.title,
      route: page.path,
      role: inferTopologyRole(page),
      filePath: page.filePath || deriveFilePath(page),
      visibleInNav: page.showInNav,
      isHome: page.isHome,
      generatedBy: page.createdBy === 'ai' ? 'ai' : page.createdBy === 'manual' ? 'manual' : 'wizard',
      funnelId: page.funnelId || null,
      seo: page.seo,
    }));

  return {
    siteId: 'playground-compile',
    industry: String(options?.industry || 'general'),
    businessName: businessName || 'Company',
    homePageId: homePageId || pageNodes.find((p) => p.isHome)?.id || pageNodes[0]?.id || 'home',
    pages: pageNodes,
    navItems: pageNodes.filter((p) => p.visibleInNav).map((p) => p.id),
    funnels: [],
    redirects: [],
    generatedAt: new Date().toISOString(),
    selectedTemplateId: options?.selectedTemplateId,
    selectedThemePresetId: options?.themePresetId || options?.selectedThemeId,
  };
}

function inferTopologyRole(page: BuilderPage): PageRole {
  // A legacy custom role must not mask an explicitly classified page type.
  for (const value of [page.pageRole, page.pageType]) {
    const role = resolveTopologyPageRoleAlias(String(value ?? ''));
    if (role && role !== 'custom') return role;
  }

  const path = page.path.toLowerCase();
  const pathRole = resolveTopologyPageRoleAlias(path);
  if (pathRole && pathRole !== 'custom') return pathRole;
  if (/(^|\/)rooms?(\/|$)/.test(path)) return 'services';
  if (path.includes('service')) return 'services';
  if (path.includes('confirmation') || path.includes('thank')) return 'thank_you';
  if (path.includes('contact')) return 'contact';
  if (path.includes('pricing')) return 'pricing';
  if (path.includes('gallery')) return 'gallery';
  if (path.includes('faq')) return 'faq';
  if (path.includes('book')) return 'booking';
  if (path.includes('checkout')) return 'checkout';
  if (path.includes('about')) return 'about';
  if (path.includes('experience') || path.includes('immersive')) return 'immersive';
  return 'custom';
}

function rebaseHomeModuleForPageFile(content: string): string {
  return content.replace(
    /(from\s+['"])\.\/([^'"]+['"])/g,
    (_match, prefix, target) => `${prefix}../${target}`,
  ).replace(
    /(import\s+['"])\.\/([^'"]+['"])/g,
    (_match, prefix, target) => `${prefix}../${target}`,
  );
}

/**
 * Resolve a button click to its binding target.
 * V2: Prefers elementKey/slot-based resolution, falls back to label matching.
 */
export function resolveBindingForButton(
  manifest: Record<string, PlaygroundBinding>,
  sourcePageId: string,
  buttonLabel: string,
  elementKey?: string,
): PlaygroundBinding | null {
  if (elementKey) {
    for (const binding of Object.values(manifest)) {
      if (
        binding.sourcePageId === sourcePageId &&
        binding.elementKey === elementKey
      ) {
        return binding;
      }
    }
  }

  const normalized = buttonLabel.toLowerCase().trim();
  for (const binding of Object.values(manifest)) {
    if (
      binding.sourcePageId === sourcePageId &&
      binding.sourceLabel.toLowerCase().trim() === normalized
    ) {
      return binding;
    }
  }
  return null;
}

/**
 * Resolve a binding by slot identity (section + slot).
 * This is the preferred V2 resolution path.
 */
export function resolveBindingBySlot(
  manifest: Record<string, PlaygroundBinding>,
  sourcePageId: string,
  section: string,
  slot: string,
): PlaygroundBinding | null {
  for (const binding of Object.values(manifest)) {
    if (
      binding.sourcePageId === sourcePageId &&
      binding.sourceSection === section &&
      binding.sourceSlot === slot
    ) {
      return binding;
    }
  }
  return null;
}

/**
 * Get all bindings for a specific page.
 */
export function getPageBindings(
  manifest: Record<string, PlaygroundBinding>,
  pageId: string,
): PlaygroundBinding[] {
  return Object.values(manifest).filter((binding) => binding.sourcePageId === pageId);
}

/**
 * Get all V2 bindings (with elementKey) for a page.
 */
export function getPageSlotBindings(
  manifest: Record<string, PlaygroundBinding>,
  pageId: string,
): PlaygroundBinding[] {
  return Object.values(manifest).filter(
    (binding) => binding.sourcePageId === pageId && !!binding.elementKey,
  );
}
