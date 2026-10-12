import type { LayoutCategory } from '@/data/templates/types';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import {
  sealSnapshot,
  WIZARD_LANE_A_PROTECTED_FILES,
  WIZARD_LAUNCH_AUTHORITY_PATH,
  type WizardCompileArtifact,
  type WizardLaunchAuthorityProof,
} from '@/platform/core/snapshotSeal';

import { ensureViteRootFiles } from '@/services/previewSession';
import type { PlaygroundCompileResult, PlaygroundState, WizardSelections } from '@/types/playground';
import {
  createRuntimeManifest,
  type RuntimeAppContext,
  type RuntimeManifest,
  type UnisonRuntimeEnvironment,
} from '@/types/runtimeManifest';
import {
  compileGeneratedSiteRuntimeManifest,
  type GeneratedSiteRuntimeManifest,
} from '@/services/generatedSiteRuntimeManifest';
import type { CapabilityId } from '@/platform/core/capabilityRegistry';
import { resolveLauncherEntryPoint } from '@/utils/launcherPayload';
import { normalizeLauncherFiles, prepareSandpackFiles } from '@/utils/sandpackFilePrep';
import { generateCanonicalRouter } from '@/utils/topologyRouterGenerator';
import { applyWizardBindingsToVfs, type WizardBindingApplicationResult } from './wizardBindingBridge';
import { preflightNavWiring } from './preflightNavWiring';
import { runPreflightRepair, runPreflightRepairSteps } from './aiSitePreflightRepair';
import { getIndustryIntentProfile } from '@/platform/core/industryIntentProfiles';
import { PreviewPipelineError } from './previewPipelineError';
import type { WizardInteractionManifest } from './wizardInteractionEnrichment';
import { WIZARD_PREVIEW_RUNTIME_DEPENDENCIES } from '@/utils/sandpackDependencies';
import { assertSnapshotThemeSeed, assertThemeSeed } from '@/platform/core/themeSeedAssert';
import { isMinimalPreviewFallbackSource } from './snapshotProjector';
import { RESOLVED_COMPOSITION_ROOT, refreshCompositionOwnership } from '@/platform/core/resolvedComposition';
import { normalizeWizardThemeTokens } from '@/utils/wizardThemeTokenNormalizer';
import {
  type VisualQualityReport,
} from './visualQualityEvaluation';
import { runFullPreflight } from './runFullPreflight';
import { runRuntimeCompatibilityPreflight, type RuntimeCompatibilityReport } from './runtimeCompatibilityPreflight';
import { getDependenciesForSandpack } from '@/utils/dependencyExtractor';
import { SANDPACK_PREVIEW_CORE_DEPENDENCIES } from '@/utils/sandpackDependencies';


import { ensureGeneratedUiFoundation, normalizeFoundationLocalImports } from '@/platform/core/generatedUiFoundation';
import type { BusinessRuntimeContract } from '@/platform/core/businessRuntimeContract';
import {
  validateRegisteredPageCompilation,
  formatPageCompilerViolations,
} from './registeredPageCompilerGate';

import {
  BUSINESS_PROFILE_HYDRATION_MODULE,
  BUSINESS_PROFILE_HYDRATION_PATH,
} from '@/sections/businessProfileHydrationModule';
import {
  FORM_RUNTIME_MODULE,
  FORM_RUNTIME_PATH,
} from '@/sections/formRuntimeModule';
import {
  PUBLISHED_ACTION_RUNTIME_MODULE,
  PUBLISHED_ACTION_RUNTIME_PATH,
} from '@/sections/publishedActionRuntimeModule';
import {
  describeUnresolvedImports,
  findLocalJsxImportContractViolations,
  findUnresolvedLocalImports,
} from '@/services/laneBCompanionModules';

export const CANONICAL_METADATA_FILE_PATHS = {
  appContext: '/.unison/app-context.json',
  runtimeManifest: '/.unison/runtime-manifest.json',
  siteBundleSnapshot: '/.unison/site-bundle-snapshot.json',
  canonicalPlayground: '/.unison/canonical-playground.json',
  wizardRuntime: '/.unison/wizard-runtime.json',
  publishedRuntime: '/.unison/published-runtime.json',
  generatedSiteRuntime: '/.unison/generated-site-runtime.json',
} as const;

export const PUBLISHED_RUNTIME_MODULE_PATH = '/src/unison/publishedRuntime.ts';
export const GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH = '/src/unison/generatedSiteRuntimeManifest.ts';

const LEGACY_REVEAL_GROUP_IMPORT = /\bimport\s+(?:type\s+)?[^;\n]+?\s+from\s+['"](\.?\.?\/(?:[^'"]*\/)?components\/RevealGroup)['"];?/g;

export interface PublishedRuntimeConfig {
  version: '1.0';
  runtimeVersion: '1.0';
  siteId: string | null;
  businessId: string | null;
  projectId: string | null;
  snapshotId: string | null;
  endpoint: string | null;
  runtimeEndpoint: string | null;
  formEndpoint: string | null;
  controllerEndpoints: Record<string, string>;
}

const DEFAULT_PUBLIC_SUPABASE_URL = 'https://nfrdomdvyrbwuokathtw.supabase.co';

export interface CanonicalLaunchArtifacts {
  files: Record<string, string>;
  entryPoint: string;
  runtimeManifest: RuntimeManifest;
  generatedSiteRuntimeManifest: GeneratedSiteRuntimeManifest;
  appContext: RuntimeAppContext;
  siteBundleSnapshot?: SiteBundleSnapshot;
  canonicalPlayground?: Record<string, unknown>;
  bindingApplication: WizardBindingApplicationResult | null;
  /** Compositional quality report for the sealed pages. Advisory only. */
  visualQuality?: VisualQualityReport;
  experiencePreflight?: {
    instances: number;
    heavyInstances: number;
    violations: string[];
  };
  runtimeCompatibility?: RuntimeCompatibilityReport;
}

export interface BuildCanonicalLaunchArtifactsInput {
  generatedFiles: Record<string, string>;
  /** Accepted Lane B pages have their own validated local visual composition. */
  acceptedLaneBPagePaths?: readonly string[];
  /** Already committed page bodies are immutable during a theme-only edit. */
  preservePageSources?: boolean;
  preferredEntryPoint?: string;
  siteBundleSnapshot?: SiteBundleSnapshot;
  compileArtifact?: WizardCompileArtifact;
  compiledPlayground?: Pick<PlaygroundCompileResult, 'vfsFiles'> | null;
  canonicalPlayground?: PlaygroundState | Record<string, unknown> | null;
  mergeWithCanonicalSnapshot?: boolean;
  businessId?: string | null;
  projectId?: string | null;
  organizationId?: string | null;
  siteId?: string | null;
  environment?: UnisonRuntimeEnvironment;
  manifestId?: string | null;
  systemType?: string | null;
  systemName?: string | null;
  templateName?: string | null;
  templateCategory?: LayoutCategory | string | null;
  /** Resolved Template-card id; persisted into appContext.templateId. */
  templateId?: string | null;
  businessName?: string | null;
  industry?: string | null;
  aesthetic?: string | null;
  /** Resolved wizard Style-card preset id (drives /src/index.css). */
  themePresetId?: string | null;
  /** Validated interaction plan persisted as canonical runtime data. */
  interactionManifest?: WizardInteractionManifest | null;
  backendRequired?: boolean;
  wizardSelections?: WizardSelections | null;
  businessRuntime?: BusinessRuntimeContract | null;
  /** Capability set that authorizes generated component runtime contracts. */
  enabledCapabilities?: readonly CapabilityId[];
  approvedExperienceCapabilities?: readonly string[];
  /**
    * OPT-IN ONLY (`true`). Allows Stage 4b page bodies to fill unusable or
    * missing generated pages. Launcher callers must pair this with previewFirst;
    * strict authoring and import paths keep generated page closure mandatory.
   */
  allowCanonicalPageFallback?: boolean;
  /**
   * Launcher-only fast path: seal the generated/canonical merge without
   * running repair, quality, compiler, experience, or runtime preflight.
   * Durable identity and snapshot sealing remain mandatory.
   */
  previewFirst?: boolean;
  /** Throw if internal preflight has to quarantine generated code. */
  strictPreflight?: boolean;
  /** Fresh App Builder launch stamps v3 page-body authority at the seal. */
  registeredPageBodyAuthority?: 'canonical-compiler' | 'app-builder';
}

const GENERATED_MODULE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'] as const;
const GENERATED_IMPORT_SPECIFIER = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function resolveGeneratedModule(
  ownerPath: string,
  specifier: string,
  files: Record<string, string>,
): string | null {
  let basePath: string;
  if (specifier.startsWith('@/')) {
    basePath = `/src/${specifier.slice(2)}`;
  } else if (specifier.startsWith('.')) {
    const ownerSegments = ownerPath.split('/').filter(Boolean);
    ownerSegments.pop();
    for (const segment of specifier.split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') ownerSegments.pop();
      else ownerSegments.push(segment);
    }
    basePath = `/${ownerSegments.join('/')}`;
  } else {
    return null;
  }

  const candidates = [
    basePath,
    ...GENERATED_MODULE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...GENERATED_MODULE_EXTENSIONS.map((extension) => `${basePath}/index${extension}`),
  ];
  return candidates.find((candidate) => typeof files[candidate] === 'string') ?? null;
}

function collectGeneratedModuleClosure(
  entryPath: string,
  files: Record<string, string>,
): string[] {
  const ordered: string[] = [];
  const visited = new Set<string>();
  const visit = (path: string) => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = files[path];
    if (typeof source !== 'string') return;
    ordered.push(path);
    GENERATED_IMPORT_SPECIFIER.lastIndex = 0;
    for (const match of source.matchAll(GENERATED_IMPORT_SPECIFIER)) {
      const target = resolveGeneratedModule(path, match[1], files);
      if (target) visit(target);
    }
  };
  visit(entryPath);
  return ordered;
}

/**
 * Normalize the legacy relative `components/RevealGroup` import emitted by
 * older page generators onto the canonical primitive kit. This rewrites an
 * import specifier only — it never synthesizes a module, so every other
 * unresolved import still fails strict VFS preflight with a diagnostic.
 */
function normalizeLegacyRevealGroupImports(files: Record<string, string>): Record<string, string> {
  const normalized = { ...files };
  for (const [filePath, source] of Object.entries(files)) {
    if (!/\.(?:tsx|jsx)$/i.test(filePath)) continue;
    if (!LEGACY_REVEAL_GROUP_IMPORT.test(source)) {
      LEGACY_REVEAL_GROUP_IMPORT.lastIndex = 0;
      continue;
    }
    LEGACY_REVEAL_GROUP_IMPORT.lastIndex = 0;
    normalized[filePath] = source.replace(
      LEGACY_REVEAL_GROUP_IMPORT,
      (statement, specifier: string) => statement.replace(specifier, '@/unison/ui/motion'),
    );
  }
  return normalized;
}

export function buildPublishedRuntimeConfig(
  input: Pick<BuildCanonicalLaunchArtifactsInput, 'siteId' | 'businessId' | 'projectId' | 'siteBundleSnapshot'>,
): PublishedRuntimeConfig {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_PUBLIC_SUPABASE_URL).trim().replace(/\/$/, '');

  return {
    version: '1.0',
    runtimeVersion: '1.0',
    siteId: input.siteId || null,
    businessId: input.businessId || null,
    projectId: input.projectId || null,
    snapshotId: input.siteBundleSnapshot?.snapshotId || null,
    endpoint: supabaseUrl ? `${supabaseUrl}/functions/v1/site-runtime-read` : null,
    runtimeEndpoint: supabaseUrl ? `${supabaseUrl}/functions/v1/site-runtime` : null,
    formEndpoint: supabaseUrl ? `${supabaseUrl}/functions/v1/form-submit` : null,
    controllerEndpoints: supabaseUrl
      ? {
          'intent-exec': `${supabaseUrl}/functions/v1/intent-exec`,
          'create-order-checkout': `${supabaseUrl}/functions/v1/create-order-checkout`,
        }
      : {},
  };
}

export function buildPublishedRuntimeModule(config: PublishedRuntimeConfig): string {
  return `export const PUBLISHED_RUNTIME_CONFIG = ${JSON.stringify(config, null, 2)} as const;\n`;
}

export function buildGeneratedSiteRuntimeManifestModule(manifest: GeneratedSiteRuntimeManifest): string {
  return `export const GENERATED_SITE_RUNTIME_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;\n`;
}

function rebaseAppModuleForHomePage(content: string): string {
  return content.replace(
    /(from\s+['"])\.\/([^'"]+['"])/g,
    (_match, prefix, target) => `${prefix}../${target}`,
  ).replace(
    /(import\s+['"])\.\/([^'"]+['"])/g,
    (_match, prefix, target) => `${prefix}../${target}`,
  );
}

function looksLikeCanonicalRouter(content: string): boolean {
  return /react-router-dom|<Routes\b|<Route\b|BrowserRouter|HashRouter|createBrowserRouter/.test(content);
}

function cloneSnapshotWithRuntimeVfs(
  siteBundleSnapshot: SiteBundleSnapshot,
  appContext: RuntimeAppContext,
  files: Record<string, string>,
  compileArtifact?: WizardCompileArtifact,
  interactionManifest?: WizardInteractionManifest | null,
  missingPageFilePolicy: 'throw' | 'report' = 'throw',
  preflight?: {
    visualQuality: VisualQualityReport;
    experiencePreflight: CanonicalLaunchArtifacts['experiencePreflight'];
    runtimeCompatibility: RuntimeCompatibilityReport;
  },
): SiteBundleSnapshot {
  // Seal point: Stage 4b artifact and canonical preflight output become the
  // single authoritative revision here. Nothing downstream may amend page
  // bodies after this returns.
  return sealSnapshot({
    artifact: compileArtifact ? { ...compileArtifact, baseline: siteBundleSnapshot } : siteBundleSnapshot,
    appContext,
    vfsFiles: files,
    interactionManifest,
    missingPageFilePolicy,
    visualQuality: preflight?.visualQuality,
    experiencePreflight: preflight?.experiencePreflight,
    runtimeCompatibility: preflight?.runtimeCompatibility,
    sealedBy: siteBundleSnapshot.meta?.source === 'recompile' ? 'recompile' : 'wizard-launch',
  });
}



function buildCanonicalPlayground(
  siteBundleSnapshot?: SiteBundleSnapshot,
  canonicalPlayground?: PlaygroundState | Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (canonicalPlayground) {
    return canonicalPlayground as Record<string, unknown>;
  }

  if (!siteBundleSnapshot) {
    return undefined;
  }

  return {
    pageRegistry: siteBundleSnapshot.pageRegistry,
    creatorData: siteBundleSnapshot.creatorData,
    bindings: siteBundleSnapshot.bindings,
    calendars: siteBundleSnapshot.calendars,
    popups: siteBundleSnapshot.popups,
  };
}

function buildSessionKey(appContext: RuntimeAppContext, entryPoint: string): string {
  return [
    appContext.projectId || 'preview',
    appContext.snapshotId || appContext.templateName || appContext.businessName || 'launch',
    entryPoint,
  ].join('::');
}

function buildRuntimeAppContext(
  input: BuildCanonicalLaunchArtifactsInput,
  entryPoint: string,
  siteBundleSnapshot?: SiteBundleSnapshot,
  themePresetId?: string,
): RuntimeAppContext {
  const businessId = input.businessId || undefined;
  const projectId = input.projectId || undefined;
  const snapshotId = siteBundleSnapshot?.snapshotId;
  const organizationId = input.organizationId || undefined;
  const siteId = input.siteId || projectId;
  return {
    runtimeContext: organizationId && businessId && projectId && siteId && snapshotId
      ? {
          workspaceId: organizationId,
          organizationId,
          businessId,
          projectId,
          websiteId: siteId,
          siteId,
          snapshotId,
          environment: input.environment ?? 'builder',
          brandProfileVersion: input.businessRuntime?.profile.version,
        }
      : undefined,
    businessId,
    projectId,
    manifestId: input.manifestId || undefined,
    snapshotId,
    businessName: input.businessName || siteBundleSnapshot?.businessName || undefined,
    templateName: input.templateName || undefined,
    templateCategory: input.templateCategory || undefined,
    templateId: input.templateId || siteBundleSnapshot?.meta?.templateId || undefined,
    systemType: input.systemType || undefined,
    systemName: input.systemName || undefined,
    industry: input.industry || siteBundleSnapshot?.industry || undefined,
    entryPoint,
    routes: siteBundleSnapshot?.routes || undefined,
    wizardSelections: input.wizardSelections
      ? (JSON.parse(JSON.stringify(input.wizardSelections)) as Record<string, unknown>)
      : undefined,
    businessRuntime: input.businessRuntime || undefined,
    themePresetId,
    themeTokens: input.wizardSelections?.themeTokens || siteBundleSnapshot?.themeTokens,
    previewRuntime: {
      version: '1.0',
      foundation: 'token-glass',
      optionalLibraries: Object.keys(WIZARD_PREVIEW_RUNTIME_DEPENDENCIES),
    },
    generatedAt: new Date().toISOString(),
  };
}

function serializeSiteBundleSnapshot(siteBundleSnapshot?: SiteBundleSnapshot) {
  if (!siteBundleSnapshot) {
    return undefined;
  }

  return {
    snapshotId: siteBundleSnapshot.snapshotId,
    businessName: siteBundleSnapshot.businessName,
    industry: siteBundleSnapshot.industry,
    pageRegistry: siteBundleSnapshot.pageRegistry,
    manifest: siteBundleSnapshot.manifest,
    bindings: siteBundleSnapshot.bindings,
    calendars: siteBundleSnapshot.calendars,
    popups: siteBundleSnapshot.popups,
    creatorData: siteBundleSnapshot.creatorData,
    componentInstances: siteBundleSnapshot.componentInstances,
    routes: siteBundleSnapshot.routes,
    homeRoute: siteBundleSnapshot.homeRoute,
    createdAt: siteBundleSnapshot.createdAt,
    appContext: siteBundleSnapshot.appContext,
    themeTokens: siteBundleSnapshot.themeTokens,
    businessSystem: siteBundleSnapshot.businessSystem,
    // CRITICAL: persist `meta` (themePresetId, templateId, systemId,
    // verticalContractId, wizardSeedId). Downstream recompile + readiness
    // surfaces read `snap.meta.themePresetId` to recover the wizard preset
    // chain-of-custody. Dropping this field is what made the tokens/seeds
    // appear "dead" in the launcher pipeline after persistence.
    meta: siteBundleSnapshot.meta,
    routerFile: siteBundleSnapshot.routerFile
      ? { path: siteBundleSnapshot.routerFile.path }
      : undefined,
    vfsFiles: siteBundleSnapshot.vfsFiles,
    vfsFilePaths: Object.keys(siteBundleSnapshot.vfsFiles || {}).sort(),
  };
}

export type MergedPageProvenance =
  | 'generated-page'
  | 'generated-app-rebase'
  | 'canonical-fallback'
  | 'missing';

export interface CanonicalMergeOptions {
  allowCanonicalPageFallback?: boolean;
  /** Allow a generated single-file App to replace canonical Home in preview-first launches. */
  preferGeneratedAppAsHome?: boolean;
  /**
   * M1 authority gate. When `true`, the merge refuses to return a VFS that is
   * missing a body for any registered page instead of deferring the failure to
   * the snapshot projector.
   */
  requireRegisteredPageClosure?: boolean;
  /** Optional sink receiving `pageFilePath -> provenance` for merge auditing. */
  provenanceSink?: Record<string, MergedPageProvenance>;
  pageBodyAuthority?: 'canonical-compiler' | 'app-builder';
}

export function mergeGeneratedVfsWithCanonicalSnapshot(
  generatedFiles: Record<string, string>,
  canonicalFiles: Record<string, string>,
  snapshot: SiteBundleSnapshot,
  options: CanonicalMergeOptions = {},
) {
  const registryPages = Object.values(snapshot.pageRegistry.pages);
  const normalizePath = (path: string) => (path.startsWith('/') ? path : `/${path}`);
  const pathVariants = (path: string): string[] => {
    const normalized = normalizePath(path);
    const flattened = normalized.replace(/^\/src\//, '/');
    return Array.from(new Set([
      path,
      normalized,
      normalized.slice(1),
      flattened,
      flattened.slice(1),
    ]));
  };
  const readCanonical = (path: string): string | undefined => {
    for (const candidate of pathVariants(path)) {
      const source = canonicalFiles[candidate];
      if (typeof source === 'string') return source;
    }
    return undefined;
  };
  const readGenerated = (path: string): string | undefined => {
    for (const candidate of pathVariants(path)) {
      const source = generatedFiles[candidate];
      if (typeof source === 'string') return source;
    }
    return undefined;
  };
  const removePathVariants = (target: Record<string, string>, path: string) => {
    for (const candidate of pathVariants(path)) {
      delete target[candidate];
    }
  };
  const registeredPagePaths = new Set(
    registryPages
      .map((page) => page.filePath)
      .filter((path): path is string => Boolean(path))
      .flatMap((path) => pathVariants(path)),
  );
  const homePage = registryPages.find((page) => page.isHome) || registryPages[0];
  const homeFilePath = homePage?.filePath || '/src/pages/Home.tsx';
  const generatedAppModule = readGenerated('/src/App.tsx');

  // SNAPSHOT-FIRST HOME AUTHORITY (theme parity guarantee).
  // The canonical SiteBundleSnapshot composes Home.tsx with semantic Tailwind
  // tokens (bg-background, text-foreground, …) so the wizard's themed
  // /src/index.css applies uniformly across every industry. If a generated
  // /src/App.tsx silently rebases into Home.tsx with hard-coded colors, the
  // hardcoded hex colors), the home route loses the theme override while every
  // other registered page keeps it — the exact regression where Home renders
  // un-themed across industries. Refuse to seed home from generated App.tsx
  // whenever the canonical snapshot already provides a real, non-fallback home.
  const canonicalHome = readCanonical(homeFilePath);
  const canonicalHomeIsAuthoritative = Boolean(
    canonicalHome && canonicalHome.trim() && !isMinimalPreviewFallbackSource(canonicalHome),
  );
  const generatedAppCanSeedHome = Boolean(
    generatedAppModule &&
    !looksLikeCanonicalRouter(generatedAppModule) &&
    (options.preferGeneratedAppAsHome === true || !isMinimalPreviewFallbackSource(generatedAppModule)) &&
    !readGenerated(homeFilePath) &&
    (!canonicalHomeIsAuthoritative || options.preferGeneratedAppAsHome === true)
  );

  // The canonical snapshot is the base for router, support modules, and every
  // page Stage 4b declared through a ResolvedPageComposition. The generated
  // input may update allowed page bodies; protected compiler output remains
  // canonical. The converged VFS is sealed back into SiteBundleSnapshot.
  const merged = { ...canonicalFiles };
  const generatedPagePaths = new Set<string>();

  // Strict callers require complete generated page coverage. Preview-first
  // callers may explicitly retain canonical Stage 4b compositions.

  for (const [path, content] of Object.entries(generatedFiles)) {
    const normalizedPath = normalizePath(path);
    // Stage 4b owns the UI foundation, the theme contract and ALL canonical
    // `/.unison/**` metadata. Generated input may read these, never replace them.
    if (
      normalizedPath.startsWith('/src/unison/ui/') ||
      normalizedPath.startsWith(`${RESOLVED_COMPOSITION_ROOT}/`) ||
      normalizedPath.startsWith('/.unison/')
    ) {
      continue;
    }

    const shouldMoveLegacyAppIntoHome =
      (normalizedPath === '/src/App.tsx' || normalizedPath === '/App.tsx') &&
      generatedAppCanSeedHome;

    if (shouldMoveLegacyAppIntoHome) {
      merged[normalizePath(homeFilePath)] = rebaseAppModuleForHomePage(content);
      generatedPagePaths.add(normalizePath(homeFilePath));
      continue;
    }

    if (registeredPagePaths.has(path) || registeredPagePaths.has(normalizedPath)) {
      if (isMinimalPreviewFallbackSource(content)) {
        if (options.allowCanonicalPageFallback === true) {
          continue;
        }
        throw new PreviewPipelineError(
          'vfs',
          `Generated compiler output contains minimal/fallback scaffold copy for registered page ${normalizedPath}; refusing to persist it into SiteBundleSnapshot.`,
          { blockedFiles: [normalizedPath], recoverableByRelaunch: true },
        );
      }
      // A valid generated page body is persisted byte-for-byte. Sanitization and
      // import healing run later in the shared prep pass; no design authority
      // reinterprets this source.
      merged[normalizedPath] = content;
      generatedPagePaths.add(normalizedPath);
      continue;
    }


    // Preserve an authored router when it is compatible with the preview runtime.
    // The selected Style-card stylesheet remains pipeline-owned.
    if (normalizedPath === '/src/App.tsx' || normalizedPath === '/App.tsx') {
      if (looksLikeCanonicalRouter(content)) merged['/src/App.tsx'] = content;
      continue;
    }

    if (normalizedPath === '/src/index.css') {
      // Preserve canonical themed CSS. Never let generated output clobber the
      // wizard-locked theme tokens from Stage 4b.
      continue;
    }

    if (isMinimalPreviewFallbackSource(content)) {
      continue;
    }

    merged[normalizedPath] = content;
  }

  const missingRegisteredPages: string[] = [];
  const recordProvenance = (pagePath: string, provenance: MergedPageProvenance) => {
    if (options.provenanceSink) options.provenanceSink[pagePath] = provenance;
  };

  for (const page of registryPages) {
    if (!page.filePath) continue;
    const normalizedPagePath = normalizePath(page.filePath);
    const generatedPage = readGenerated(page.filePath);
    const canonicalPage = readCanonical(page.filePath);
    const existingMergedPage = merged[normalizedPagePath];
    if (
      generatedPagePaths.has(normalizedPagePath) &&
      existingMergedPage &&
      (options.preferGeneratedAppAsHome === true || !isMinimalPreviewFallbackSource(existingMergedPage))
    ) {
      removePathVariants(merged, page.filePath);
      merged[normalizedPagePath] = existingMergedPage;
      recordProvenance(
        normalizedPagePath,
        readGenerated(page.filePath) ? 'generated-page' : 'generated-app-rebase',
      );
      continue;
    }

    if (generatedPage && !isMinimalPreviewFallbackSource(generatedPage)) {
      removePathVariants(merged, page.filePath);
      merged[normalizedPagePath] = generatedPage;
      recordProvenance(normalizedPagePath, 'generated-page');
      continue;
    }

    // Canonical page fallback is OPT-IN ONLY (`=== true`). Strict callers
    // surface missing generated pages; preview-first calls may use the Stage
    // 4b body to keep every registered route paintable in the builder.
    if (options.allowCanonicalPageFallback === true && canonicalPage && !isMinimalPreviewFallbackSource(canonicalPage)) {
      removePathVariants(merged, page.filePath);
      merged[normalizedPagePath] = canonicalPage;
      recordProvenance(normalizedPagePath, 'canonical-fallback');
      continue;
    }

    removePathVariants(merged, page.filePath);
    recordProvenance(normalizedPagePath, 'missing');
    missingRegisteredPages.push(normalizedPagePath);
  }

  // Exact registry-to-generated-page closure. A launch may never silently
  // omit a selected page; callers that enforce closure fail here with the
  // exact page list instead of surfacing a blank route downstream.
  if (options.requireRegisteredPageClosure === true && missingRegisteredPages.length > 0) {
    throw new PreviewPipelineError(
      'vfs',
      `Canonical compiler output is missing ${missingRegisteredPages.length} registered page(s): ${missingRegisteredPages.join(', ')}. Refusing to seal an incomplete site.`,
      { blockedFiles: missingRegisteredPages, recoverableByRelaunch: true },
    );
  }



  // ── Single chrome authority: the page body ──────────────────────────────
  // There is no platform-owned navbar/footer module and the router never
  // injects chrome, so whatever navigation a page renders is the only chrome
  // that exists. Nothing to strip, nothing to count.

  // Generate a registry router only when no compatible authored router exists.
  const generatedRouter = generateCanonicalRouter(
    snapshot.pageRegistry,
    snapshot.businessName,
  );
  if (!looksLikeCanonicalRouter(merged['/src/App.tsx'] || '') && generatedRouter) {
    merged['/src/App.tsx'] = generatedRouter;
  } else if (!looksLikeCanonicalRouter(merged['/src/App.tsx'] || '')) {
    throw new PreviewPipelineError(
      'vfs',
      'SiteBundleSnapshot did not produce a deterministic /src/App.tsx router; refusing to render a generated/minimal fallback.',
      { recoverableByRelaunch: true },
    );
  }

  if (!merged['/src/index.css']) {
    throw new PreviewPipelineError(
      'vfs',
      'SiteBundleSnapshot is missing injected /src/index.css; refusing to inject default/minimal preview CSS.',
      { recoverableByRelaunch: true },
    );
  }

  const registeredPageFiles = registryPages
    .map((page) => page.filePath)
    .filter((path): path is string => Boolean(path))
    .map(normalizePath)
    .sort();
  const authorityProof: WizardLaunchAuthorityProof | import('@/platform/core/snapshotSeal').AppBuilderLaunchAuthorityProof =
    options.pageBodyAuthority === 'app-builder'
      ? {
          version: '3.0',
          compileArtifactId: snapshot.snapshotId,
          registeredPageBodyAuthority: 'app-builder',
          registeredPageFiles,
          protectedFilePatterns: [...WIZARD_LANE_A_PROTECTED_FILES],
        }
      : {
          version: '2.0',
          compileArtifactId: snapshot.snapshotId,
          registeredPageBodyAuthority: 'canonical-compiler',
          registeredPageFiles,
          protectedFilePatterns: [...WIZARD_LANE_A_PROTECTED_FILES],
        };
  merged[WIZARD_LAUNCH_AUTHORITY_PATH] = JSON.stringify(authorityProof, null, 2);

  return merged;
}

export function upsertCanonicalMetadataFiles(
  files: Record<string, string>,
  input: {
    appContext: RuntimeAppContext;
    runtimeManifest: RuntimeManifest;
    publishedRuntime: PublishedRuntimeConfig;
    generatedSiteRuntimeManifest: GeneratedSiteRuntimeManifest;
    siteBundleSnapshot?: SiteBundleSnapshot;
    canonicalPlayground?: Record<string, unknown>;
  },
): Record<string, string> {
  const nextFiles = { ...files };

  nextFiles[CANONICAL_METADATA_FILE_PATHS.appContext] = JSON.stringify(input.appContext, null, 2);
  nextFiles[CANONICAL_METADATA_FILE_PATHS.runtimeManifest] = JSON.stringify(input.runtimeManifest, null, 2);
  nextFiles[CANONICAL_METADATA_FILE_PATHS.wizardRuntime] = JSON.stringify({
    previewRuntime: input.appContext.previewRuntime,
  }, null, 2);
  nextFiles[CANONICAL_METADATA_FILE_PATHS.publishedRuntime] = JSON.stringify(input.publishedRuntime, null, 2);
  nextFiles[CANONICAL_METADATA_FILE_PATHS.generatedSiteRuntime] = JSON.stringify(
    input.generatedSiteRuntimeManifest,
    null,
    2,
  );

  if (input.siteBundleSnapshot) {
    nextFiles[CANONICAL_METADATA_FILE_PATHS.siteBundleSnapshot] = JSON.stringify(
      serializeSiteBundleSnapshot(input.siteBundleSnapshot),
      null,
      2,
    );
  }

  if (input.canonicalPlayground) {
    nextFiles[CANONICAL_METADATA_FILE_PATHS.canonicalPlayground] = JSON.stringify(
      input.canonicalPlayground,
      null,
      2,
    );
  }

  return nextFiles;
}

function* buildCanonicalLaunchArtifactSteps(
  input: BuildCanonicalLaunchArtifactsInput,
): Generator<void, CanonicalLaunchArtifacts, void> {
  const mergeWithCanonicalSnapshot = input.mergeWithCanonicalSnapshot ?? true;
  const snapshotThemePresetId = input.siteBundleSnapshot
    ? assertSnapshotThemeSeed(
        input.siteBundleSnapshot,
        assertThemeSeed(
          input.themePresetId ?? input.siteBundleSnapshot.meta.themePresetId,
          'SiteBundleSnapshot -> canonical launch',
        ),
        'SiteBundleSnapshot -> canonical launch',
      )
    : null;
  if (input.siteBundleSnapshot && input.themePresetId) {
    assertThemeSeed(input.themePresetId, 'WizardMergeContext -> canonical launch', snapshotThemePresetId);
  }
  const resolvedThemePresetId = snapshotThemePresetId || assertThemeSeed(
    input.themePresetId,
    'WizardMergeContext -> canonical launch',
  );
  const generatedFiles = input.generatedFiles;
  yield;
  const normalizedFiles = normalizeLauncherFiles(generatedFiles, {
    entryPoint: input.preferredEntryPoint,
    themePresetId: resolvedThemePresetId,
    // Checkpoint invariant: wizard/sitebundle launches must arrive with the
    // deterministic PageRegistry router. Do not let normalizeLauncherFiles
    // derive App.tsx from an arbitrary page, because that is the minimal shell
    // path that disconnects VFS preview from SiteBundleSnapshot authority.
    allowMissingWizardArtifacts: !input.siteBundleSnapshot,
    injectCssIfMissing: false,
  });

  // Validate once after binding/nav mutations instead of parsing the complete
  // VFS here, after mutations, and again after metadata injection. The former
  // triple pass held the browser main thread during "Finalizing preview" on
  // larger generated sites. Binding and nav transforms operate on source text
  // and the post-mutation pass below remains the authoritative syntax gate.
  const repairedFiles = normalizedFiles;

  yield;
  const bindingApplication = input.siteBundleSnapshot && !input.preservePageSources
    ? applyWizardBindingsToVfs(repairedFiles, input.siteBundleSnapshot)
    : null;

  // The snapshot is the only canonical VFS source once it exists. A compile
  // result is an intermediate stage and may be stale by finalization time.
  yield;
  const canonicalFiles = input.siteBundleSnapshot
    ? ensureGeneratedUiFoundation(input.siteBundleSnapshot.vfsFiles, {
        industry: input.industry || input.siteBundleSnapshot.industry,
        templateId: input.templateId || input.siteBundleSnapshot.meta.templateId,
        themePresetId: resolvedThemePresetId,
        needsBooking: input.wizardSelections?.needsBooking,
        wantsLeadCapture: input.wizardSelections?.wantsLeadCapture,
        sellsProducts: input.wizardSelections?.sellsProducts,
      }).files
    : input.compiledPlayground?.vfsFiles || {};
  const boundFiles = bindingApplication?.files || repairedFiles;
  yield;
  const preflight = input.siteBundleSnapshot && !input.preservePageSources
    ? (() => {
        try {
          return preflightNavWiring(boundFiles, input.siteBundleSnapshot);
        } catch (error) {
          console.warn('[canonicalLaunchVfs] Preflight nav wiring failed; continuing', error);
          return null;
        }
      })()
    : null;
  const wiredFiles = preflight?.files || boundFiles;
  if (preflight && (preflight.wired > 0 || preflight.skipped.length > 0)) {
    console.info('[canonicalLaunchVfs] Preflight nav wiring:', {
      wired: preflight.wired,
      skipped: preflight.skipped.length,
    });
  }

  // ── Industry forbidden-intent strip ────────────────────────────────────
  // Remove any data-ut-intent attributes whose value is on the active
  // industry's forbidden list (e.g. checkout.start on a nonprofit).
  const industryForStrip =
    (input.industry as string | undefined) || input.siteBundleSnapshot?.industry;
  const profile = industryForStrip ? getIndustryIntentProfile(industryForStrip) : undefined;
  const forbidden = profile?.forbidden ?? [];
  const filesAfterStrip: Record<string, string> = { ...wiredFiles };
  if (forbidden.length > 0) {
    const escaped = forbidden.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const attrRe = new RegExp(`\\s+data-ut-intent\\s*=\\s*["'](?:${escaped})["']`, 'g');
    let strippedCount = 0;
    for (const [p, src] of Object.entries(filesAfterStrip)) {
      if (typeof src !== 'string') continue;
      const next = src.replace(attrRe, () => { strippedCount++; return ''; });
      if (next !== src) filesAfterStrip[p] = next;
    }
    if (strippedCount > 0) {
      console.warn('[canonicalLaunchVfs] Stripped forbidden intents for industry:', {
        industry: industryForStrip,
        forbidden,
        count: strippedCount,
      });
    }
  }



  // ── Final syntax repair ────────────────────────────────────────────────
  // Catch any syntax damage introduced by binding/nav-wiring attribute
  // injection before files reach the preview iframe.
  yield;
  let finalRepair: ReturnType<typeof runPreflightRepair> | null = null;
  try {
    finalRepair = yield* runPreflightRepairSteps(filesAfterStrip, {
      context: { industry: input.industry, brand: input.businessName },
      // Strict launch paths never accept an industry template section in place
      // of an unparseable AI file — the launch fails and a repair turn runs.
      allowQuarantine: input.strictPreflight !== true,
    });
  } catch (error) {
    console.warn('[canonicalLaunchVfs] Final preflight syntax repair failed; continuing', error);
    finalRepair = null;
  }
  const safeFiles = finalRepair?.files || filesAfterStrip;
  if (finalRepair && (finalRepair.repairedCount > 0 || finalRepair.quarantinedCount > 0)) {
    console.warn('[canonicalLaunchVfs] Final syntax repair:', {
      clean: finalRepair.cleanCount,
      repaired: finalRepair.repairedCount,
      quarantined: finalRepair.quarantinedCount,
    });
    if (input.strictPreflight && finalRepair.quarantinedCount > 0) {
      const blockedReports = finalRepair.reports
        .filter((report) => report.status === 'quarantined');
      const blockedFiles = blockedReports.map((report) => report.path);
      const diagnostics = blockedReports.map((report) => ({
        path: report.path,
        error: report.finalError || 'Unknown syntax error',
        repairPasses: report.passes || [],
      }));
      const diagnosticSummary = diagnostics
        .map(({ path, error }) => `${path}: ${error}`)
        .join(' | ');
      throw new PreviewPipelineError(
        'vfs',
        `Wizard source failed final syntax preflight for ${blockedFiles.join(', ')}; refusing to persist quarantine scaffolds. ${diagnosticSummary}`,
        { blockedFiles, diagnostics, recoverableByRelaunch: true },
      );
    }
  }

  yield;
  const mergeProvenance: Record<string, MergedPageProvenance> = {};
  const mergedFiles = input.siteBundleSnapshot && mergeWithCanonicalSnapshot
      ? mergeGeneratedVfsWithCanonicalSnapshot(safeFiles, canonicalFiles, input.siteBundleSnapshot, {
        allowCanonicalPageFallback: input.allowCanonicalPageFallback,
        // M1: a wizard launch may never seal without every registered page.
        requireRegisteredPageClosure: input.allowCanonicalPageFallback !== true,
        provenanceSink: mergeProvenance,
        pageBodyAuthority: input.registeredPageBodyAuthority,
        // Snapshot topology owns registry/router/bindings and Stage 4b owns
        // /src/index.css. The supplied page set must close the registry.
      })
    : { ...safeFiles };
  if (Object.keys(mergeProvenance).length > 0) {
    console.info('[canonicalLaunchVfs] merge provenance', mergeProvenance);
  }

  Object.assign(mergedFiles, normalizeLegacyRevealGroupImports(mergedFiles));
  Object.assign(mergedFiles, normalizeFoundationLocalImports(mergedFiles));

  // ── Stage 4b re-finalization ───────────────────────────────────────────
  // Any repair performed after Stage 4b (syntax repair, binding/nav wiring,
  // forbidden-intent stripping) can reintroduce unthemed literals. Re-apply
  // the semantic theme finalizer exactly once so the sealed artifact has
  // always passed Stage 4b *after* its last source mutation. Bounded to one
  // pass: the finalizer is idempotent.
  const sourceMutatedAfterStage4b =
    (finalRepair?.repairedCount ?? 0) > 0 ||
    (preflight?.wired ?? 0) > 0 ||
    forbidden.length > 0;
  if (sourceMutatedAfterStage4b) {
    const refinalized = normalizeWizardThemeTokens(mergedFiles, {
      excludePaths: input.acceptedLaneBPagePaths,
    });
    Object.assign(mergedFiles, refinalized.files);
    if (refinalized.changedFiles.length > 0 || refinalized.residualLiterals.length > 0) {
      console.info('[canonicalLaunchVfs] Stage 4b re-finalization after post-merge repair', {
        changedFiles: refinalized.changedFiles,
        residualLiterals: refinalized.residualLiterals.slice(0, 10),
      });
    }
  }

  mergedFiles[BUSINESS_PROFILE_HYDRATION_PATH] = BUSINESS_PROFILE_HYDRATION_MODULE;
  mergedFiles[FORM_RUNTIME_PATH] = FORM_RUNTIME_MODULE;
  mergedFiles[PUBLISHED_ACTION_RUNTIME_PATH] = PUBLISHED_ACTION_RUNTIME_MODULE;

  // Runtime companion modules must exist before convergence preflight. The
  // hydration/action modules above import these canonical facades, so adding
  // them only after preflight makes an otherwise complete launch look like it
  // has unresolved imports and aborts the Wizard midway through finalization.
  // They are rebuilt below with the finalized app context before sealing.
  const preflightPublishedRuntime = buildPublishedRuntimeConfig(input);
  mergedFiles[PUBLISHED_RUNTIME_MODULE_PATH] = buildPublishedRuntimeModule(
    preflightPublishedRuntime,
  );
  const preflightRuntimeSnapshot = input.siteBundleSnapshot
    ? { ...input.siteBundleSnapshot }
    : undefined;
  const preflightGeneratedRuntimeManifest = compileGeneratedSiteRuntimeManifest({
    siteId: input.siteId,
    snapshot: preflightRuntimeSnapshot,
    enabledCapabilities: input.enabledCapabilities,
  });
  mergedFiles[GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH] =
    buildGeneratedSiteRuntimeManifestModule(preflightGeneratedRuntimeManifest);

  // ── Canonical convergence preflight ────────────────────────────────────
  // This is the shared launcher/builder authority. It runs against the exact
  // merged VFS that will be sealed, including companion modules and runtime
  // facades, and stamps the experience manifest before snapshot sealing.
  let convergedPreflight = runFullPreflight(mergedFiles, {
    siteBundleSnapshot: input.siteBundleSnapshot,
    industry: input.industry || input.siteBundleSnapshot?.industry,
    brand: input.businessName || undefined,
    mode: 'repair',
  });
  for (const path of Object.keys(mergedFiles)) delete mergedFiles[path];
  Object.assign(mergedFiles, convergedPreflight.files);

  // Preflight repair is the final source-writing stage. Re-apply Stage 4b's
  // token contract if it touched source, then prove a validation-only pass
  // would make no further edits before the snapshot can be sealed.
  if (convergedPreflight.mutated) {
    const refinalized = normalizeWizardThemeTokens(mergedFiles, {
      excludePaths: input.acceptedLaneBPagePaths,
    });
    for (const path of Object.keys(mergedFiles)) delete mergedFiles[path];
    Object.assign(mergedFiles, refinalized.files);
    const acceptance = runFullPreflight(mergedFiles, {
      siteBundleSnapshot: input.siteBundleSnapshot,
      industry: input.industry || input.siteBundleSnapshot?.industry,
      brand: input.businessName || undefined,
      mode: 'acceptance',
    });
    const unresolvedAcceptance = [
      ...acceptance.mutatedFiles,
      ...acceptance.stages.experienceGate.violations,
    ];
    if (unresolvedAcceptance.length > 0) {
      throw new PreviewPipelineError(
        'vfs',
        `Generated site still requires mutation after Stage 4b finalization: ${unresolvedAcceptance.join(' | ')}`,
        { blockedFiles: acceptance.mutatedFiles, recoverableByRelaunch: true },
      );
    }
    convergedPreflight = acceptance;
  }

  if (convergedPreflight.stages.experienceGate.violations.length > 0) {
    throw new PreviewPipelineError(
      'vfs',
      `Generated experience failed preflight: ${convergedPreflight.stages.experienceGate.violations.join(' | ')}`,
      { recoverableByRelaunch: true },
    );
  }

  // ── M4 compiler gate ───────────────────────────────────────────────────
  // Mutation-free structural assertion: every registered page must compile in
  // the supported Sandpack runtime (default export, supported UI facade
  // symbols, legal hook placement). Structural failures block the seal;
  // presentation quality is scored separately.
  if (input.siteBundleSnapshot && mergeWithCanonicalSnapshot && input.allowCanonicalPageFallback !== true) {
    const gate = validateRegisteredPageCompilation(mergedFiles, input.siteBundleSnapshot);
    if (!gate.ok) {
      throw new PreviewPipelineError(
        'vfs',
        `Registered pages failed the generated-page compiler gate: ${formatPageCompilerViolations(gate.violations)}`,
        {
          blockedFiles: Array.from(new Set(gate.violations.map((violation) => violation.filePath))),
          recoverableByRelaunch: true,
        },
      );
    }

    const unresolvedImports = findUnresolvedLocalImports(mergedFiles);
    const incompatibleImports = findLocalJsxImportContractViolations(mergedFiles);
    if (unresolvedImports.length > 0 || incompatibleImports.length > 0) {
      const details = [
        unresolvedImports.length > 0
          ? `unresolved modules: ${describeUnresolvedImports(unresolvedImports)}`
          : '',
        ...incompatibleImports.slice(0, 5).map((violation) =>
          `${violation.filePath} imports ${violation.symbol} from "${violation.importPath}" (${violation.kind}; available: ${violation.available.join(', ') || 'none'})`,
        ),
      ].filter(Boolean);
      throw new PreviewPipelineError(
        'vfs',
        `Generated pages failed the local import contract: ${details.join(' | ')}`,
        {
          blockedFiles: Array.from(new Set([
            ...unresolvedImports.map((item) => item.filePath),
            ...incompatibleImports.map((item) => item.filePath),
          ])),
          recoverableByRelaunch: true,
        },
      );
    }
  }

  // ── Visual quality evaluation (advisory, never blocking) ───────────────
  // Compositional scoring runs on the sealed page bodies. It never mutates
  // source and never triggers a fallback; the report travels with the
  // artifact so the launcher can record ONE focused refinement directive.
  const visualQuality = convergedPreflight?.visualQuality;
  if (visualQuality) {
    mergedFiles['/.unison/visual-quality.json'] = JSON.stringify(visualQuality, null, 2);
  }






  const entryPoint = resolveLauncherEntryPoint(mergedFiles, input.preferredEntryPoint);
  const appContext = buildRuntimeAppContext(
    input,
    entryPoint,
    input.siteBundleSnapshot,
    resolvedThemePresetId || undefined,
  );
  appContext.interactionManifest = input.interactionManifest
    ?? input.siteBundleSnapshot?.meta?.interactionManifest;
  appContext.themeInjection = {
    version: '1.0',
    stage: '4b',
    presetId: appContext.themePresetId || resolvedThemePresetId,
    cssPath: '/src/index.css',
  };
  const publishedRuntime = buildPublishedRuntimeConfig(input);
  mergedFiles[PUBLISHED_RUNTIME_MODULE_PATH] = buildPublishedRuntimeModule(publishedRuntime);
  const approvedExperienceCapabilities = input.approvedExperienceCapabilities
    ?? input.siteBundleSnapshot?.meta.uiFoundation?.approvedExperienceCapabilities;
  const runtimeSnapshotSeed = input.siteBundleSnapshot
    ? {
        ...input.siteBundleSnapshot,
        appContext,
        meta: {
          ...input.siteBundleSnapshot.meta,
          ...(input.siteBundleSnapshot.meta.uiFoundation && approvedExperienceCapabilities !== undefined
            ? { uiFoundation: { ...input.siteBundleSnapshot.meta.uiFoundation, approvedExperienceCapabilities: [...approvedExperienceCapabilities] } }
            : {}),
        },
      }
    : undefined;
  const generatedSiteRuntimeManifest = compileGeneratedSiteRuntimeManifest({
    siteId: input.siteId,
    snapshot: runtimeSnapshotSeed,
    enabledCapabilities: input.enabledCapabilities,
  });
  mergedFiles[GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH] = buildGeneratedSiteRuntimeManifestModule(
    generatedSiteRuntimeManifest,
  );
  const canonicalPlayground = buildCanonicalPlayground(runtimeSnapshotSeed, input.canonicalPlayground);
  const metadataFiles = Object.values(CANONICAL_METADATA_FILE_PATHS);
  const sessionKey = buildSessionKey(appContext, entryPoint);
  const runtimeManifest = createRuntimeManifest(mergedFiles, {
    entryPoint,
    industry: input.industry || runtimeSnapshotSeed?.industry,
    brandName: input.businessName || runtimeSnapshotSeed?.businessName,
    aesthetic: input.aesthetic || undefined,
    backendRequired: input.backendRequired,
    appContext,
    metadataFiles,
    sessionKey,
  });
  const viteReadyFiles = ensureViteRootFiles(mergedFiles, {
    extraDependencies: runtimeManifest.dependencies,
    themePresetId: appContext.themePresetId || (input.aesthetic as string | undefined) || null,
  });
  const finalRuntimeCompatibility = runRuntimeCompatibilityPreflight({
    files: viteReadyFiles,
    dependencies: getDependenciesForSandpack(
      viteReadyFiles,
      SANDPACK_PREVIEW_CORE_DEPENDENCIES,
    ).dependencies,
    approvedCapabilities: approvedExperienceCapabilities,
  });
  if (!finalRuntimeCompatibility.ok) {
    throw new PreviewPipelineError(
      'vfs',
      `Generated site is incompatible with the canonical preview runtime: ${finalRuntimeCompatibility.blockers.join(' | ')}`,
      { recoverableByRelaunch: true },
    );
  }
  // `safeFiles` already passed the full post-mutation syntax gate. Everything
  // added between that gate and `viteReadyFiles` is deterministic platform
  // runtime code, so reparsing every generated page here only duplicates CPU
  // work and can freeze the launcher shell.
  const verifiedViteFiles = refreshCompositionOwnership(input.generatedFiles, viteReadyFiles);
  // Launch assembly reports missing page files instead of throwing: the wizard
  // deliberately drops minimal canonical stubs, and the launcher's
  // `enrich.pages_missing_baseline` gate (Pass 4) is the layer that decides to
  // re-compile or block. Strict throwing stays the default for builder-commit
  // and import seals.
  const missingPageFilePolicy: 'throw' | 'report' = 'report';

  const siteBundleSnapshot = runtimeSnapshotSeed
    ? cloneSnapshotWithRuntimeVfs(
        runtimeSnapshotSeed,
        appContext,
        verifiedViteFiles,
        input.compileArtifact,
        input.interactionManifest,
        missingPageFilePolicy,
        visualQuality && convergedPreflight && finalRuntimeCompatibility
          ? {
              visualQuality,
              experiencePreflight: convergedPreflight.stages.experienceGate,
              runtimeCompatibility: finalRuntimeCompatibility,
            }
          : undefined,
      )
    : undefined;

  if (siteBundleSnapshot && resolvedThemePresetId) {
    assertSnapshotThemeSeed(siteBundleSnapshot, resolvedThemePresetId, 'canonical launch -> SiteBundleSnapshot');
  }
  const runtimeFilesAfterSeal = { ...verifiedViteFiles };
  delete runtimeFilesAfterSeal[WIZARD_LAUNCH_AUTHORITY_PATH];
  const files = upsertCanonicalMetadataFiles(runtimeFilesAfterSeal, {
    appContext,
    runtimeManifest,
    publishedRuntime,
    generatedSiteRuntimeManifest,
    siteBundleSnapshot,
    canonicalPlayground,
  });

  // Run the exact strict VFS compiler that Preview uses before this Wizard
  // artifact is persisted or opened in Playground. Syntax repair protects
  // source shape above; this final pass catches unresolved JSX named/default
  // imports after every canonical merge and generated-runtime transformation.
  // Callers on the hot launch path (launchOrchestrator) already wrap this step in
  // a timeout + non-strict fallback, so this can never freeze the UI forever.
  if (input.strictPreflight) {
    yield;
    try {
      prepareSandpackFiles(files, {
        entryPoint,
        themePresetId: appContext.themePresetId || resolvedThemePresetId,
        strict: true,
      });
    } catch (error) {
      if (error instanceof PreviewPipelineError) {
        throw new PreviewPipelineError(
          'vfs',
          `Wizard runtime preflight failed before persistence: ${error.summary}`,
          {
            ...error.details,
            cause: error,
            recoverableByRelaunch: true,
          },
        );
      }
      throw new PreviewPipelineError(
        'vfs',
        `Wizard runtime preflight failed before persistence: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error, recoverableByRelaunch: true },
      );
    }
  }

  return {
    files,
    entryPoint,
    runtimeManifest,
    generatedSiteRuntimeManifest,
    appContext,
    siteBundleSnapshot,
    canonicalPlayground,
    bindingApplication,
    visualQuality,
    experiencePreflight: convergedPreflight?.stages.experienceGate,
    runtimeCompatibility: finalRuntimeCompatibility,
  };
}

export function buildCanonicalLaunchArtifacts(
  input: BuildCanonicalLaunchArtifactsInput,
): CanonicalLaunchArtifacts {
  const steps = buildCanonicalLaunchArtifactSteps(input);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

export async function buildCanonicalLaunchArtifactsAsync(
  input: BuildCanonicalLaunchArtifactsInput,
  options: { yieldToHost: () => Promise<void>; signal?: AbortSignal },
): Promise<CanonicalLaunchArtifacts> {
  const steps = buildCanonicalLaunchArtifactSteps(input);
  let result = steps.next();
  while (!result.done) {
    await options.yieldToHost();
    // A caller-side watchdog (e.g. LaunchRun's stage timeout) may have given
    // up on this attempt already. Stop advancing the generator instead of
    // letting an abandoned attempt keep consuming the main thread alongside
    // whatever fallback the caller starts next.
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new Error('Canonical launch artifact generation was cancelled.');
    }
    result = steps.next();
  }
  return result.value;
}
