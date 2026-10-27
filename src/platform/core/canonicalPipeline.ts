/**
 * Canonical Pipeline — THE single enforced pathway for all site generation.
 * 
 * Every entry point (Wizard, AI Builder, manual edits) MUST flow through this.
 * 
 * Pipeline stages:
 *   1. WizardSelections → CapabilityPack          (resolveCapabilities)
 *   2. CapabilityPack → PlaygroundState            (materializePlayground)  
 *   3. PlaygroundState → PlaygroundValidation[]    (validatePlayground)
 *   4. PlaygroundState → PlaygroundCompileResult   (compilePlayground)
 *   5. CompileResult → SiteBundleSnapshot          (projectToSiteBundle)
 *   6. SiteBundleSnapshot → RuntimeManifest        (deriveRuntimeManifest)
 *   7. SiteBundleSnapshot → VFS files              (already in CompileResult)
 * 
 * SiteBundle is the SINGLE SOURCE OF TRUTH.
 * PageRegistry and RuntimeManifest are DERIVED VIEWS — never independently constructed.
 */

import type {
  WizardSelections,
  CapabilityPack,
  PlaygroundState,
  PlaygroundMaterializationResult,
  PlaygroundValidation,
  PlaygroundCompileResult,
  PlaygroundBinding,
  PlaygroundCalendar,
  PlaygroundPopup,
} from '@/types/playground';
import type { CreatorData } from '@/types/creatorData';
import type { PageRegistry } from '@/types/pageRegistry';
import type { RuntimeAppContext, RuntimeManifest } from '@/types/runtimeManifest';
import type { SiteBundle, SiteManifest, RouteDef, NavItem } from '@/types/siteBundle';
import { validatePlayground, getValidationSummary } from '@/services/playgroundValidationService';
import { applyOverridesToCss, readThemeOverrides, THEME_OVERRIDES_PATH } from '@/services/theme/themeTokenOverrides';
import { compilePlayground } from '@/services/playgroundCompiler';
import { createRuntimeManifest } from '@/types/runtimeManifest';
import { nanoid } from 'nanoid';
import { assertWithinCommit } from './pipelineGuard';
import {
  buildThemedIndexCssFromTokens,
  SHADCN_LIBRARY_CSS_MARKER,
} from '@/components/onboarding/themePresetToIndexCss';
import type { ThemeTokens } from '@/sections/types';
import type { GeneratedSitePlan } from './siteTopologyPlanner';
import type { BusinessSystemState } from './capabilityRegistry';
import { normalizeWizardThemeTokens } from '@/utils/wizardThemeTokenNormalizer';
import type { WizardInteractionManifest } from '@/services/wizardInteractionEnrichment';
import { assertSnapshotThemeSeed, assertThemeSeed } from './themeSeedAssert';
import { GENERATED_RUNTIME_PROFILE } from './generatedRuntimeCapabilities';
import { resolveApprovedExperienceCapabilities } from '@/services/experienceCapabilityResolver';
import { runExperiencePreflight } from '@/services/experiencePreflightGate';
import { assertStage4bCompositionPreserved } from './stage4bCompositionGuard';
import {
  collectResolvedCompositions,
  refreshCompositionOwnership,
  resolvedCompositionPathFor,
} from './resolvedComposition';


import {
  buildGeneratedUiFoundation,
  ensureGeneratedUiFoundation,
  GENERATED_UI_FOUNDATION_VERSION,
  type GeneratedUiManifest,
} from './generatedUiFoundation';
import {
  buildThemeContractFiles,
  readThemeContract,
  THEME_CONTRACT_PATH,
  THEME_CONTRACT_VERSION,
} from './themeContract';
import {
  readTemplateDesignContract,
  TEMPLATE_DESIGN_CONTRACT_PATH,
} from '@/services/templateLayoutContract';
import { designRegistrySignature } from '@/services/designImplementationRegistry';
import {
  buildWizardDesignIntervention,
  readWizardDesignIntervention,
  type WizardDesignIntervention,
} from '@/services/wizardDesignIntervention';
import { designPlanSignature } from '@/utils/designVariation';
import { computeRenderHash } from '@/platform/core/generationSeed';
import { projectResolvedArtDirection } from '@/sections/variants/resolvedArtDirection';

import {
  buildWizardGenerationBrief,
  type WizardGenerationBrief,
} from '@/services/wizardGenerationBrief';
import { createWizardCompileArtifact, type WizardCompileArtifact } from './snapshotSeal';
import { isArtDirectionPackId } from '@/sections/variants/artDirectionPacks';
import { getRequiredRadixPrimitives } from '@/sections/variants';
import { resolveCanonicalLaunchContracts } from '@/services/launch/canonicalLaunchPlan';
import { WIZARD_REGISTRY_CONTEXT_PATH } from '@/services/launch/wizardRegistryAggregation';


// ============================================================================
// Pipeline Result
// ============================================================================

export interface CanonicalPipelineResult {
  /** The full pipeline ran successfully (no blocking errors) */
  success: boolean;

  // Stage outputs (all derived from the same source)
  capabilities: CapabilityPack;
  playground: PlaygroundState;
  validations: PlaygroundValidation[];
  compileResult: PlaygroundCompileResult;
  siteBundleSnapshot: SiteBundleSnapshot;
  /**
    * Frozen Stage 4b compile artifact. `sealSnapshot()` combines it with
    * canonical preflight output to produce the final sealed revision.
   */
  compileArtifact?: WizardCompileArtifact;
  runtimeManifest: RuntimeManifest;

  sitePlan: GeneratedSitePlan | null;

  /** Warnings from materialization + validation */
  warnings: string[];
  /** Blocking errors that prevent preview */
  errors: string[];
}

/**
 * SiteBundleSnapshot — A lightweight projection of SiteBundle
 * containing only what the preview pipeline needs.
 * 
 * This IS the single source of truth for a site's current state.
 * PageRegistry and RuntimeManifest are derived from this.
 */
export interface SiteBundleSnapshot {
  /** Unique snapshot ID for change detection */
  snapshotId: string;

  /** Business identity */
  businessName: string;
  industry: string;

  /** The authoritative page registry (derived view lives here) */
  pageRegistry: PageRegistry;

  /** VFS files — the code representation of the site */
  vfsFiles: Record<string, string>;

  /** Canonical router file */
  routerFile: { path: string; content: string };

  /** Navigation manifest — derived from PageRegistry */
  manifest: SiteManifest;

  /** All bindings for runtime intent resolution */
  bindings: Record<string, PlaygroundBinding>;

  /** Calendars, popups — structured business objects */
  calendars: Record<string, PlaygroundCalendar>;
  popups: Record<string, PlaygroundPopup>;
  creatorData: CreatorData;
  componentInstances: CreatorData['componentInstances'];

  /** Available routes for preview */
  routes: string[];
  homeRoute: string;

  /** Timestamp */
  createdAt: string;

  /** Shared app context propagated at launch/save time */
  appContext?: RuntimeAppContext;
  themeTokens?: ThemeTokens;
  /** Approved capability state; persisted with the revision, never inferred from prompt text. */
  businessSystem?: BusinessSystemState;

  /**
   * Durable snapshot identity — the single source of truth for downstream
   * surfaces (DeployButton, Readiness Center, publish attestation). Anything
   * derived from WizardSelections that needs to outlive the wizard MUST be
   * stamped here at compile time, not re-passed as UI props.
   */
  meta: SiteBundleSnapshotMeta;
}

export interface SiteBundleSnapshotMeta {
  /** Current source-derived composition, independent of immutable launch provenance. */
  effectiveComposition?: import('@/services/effectiveCompositionProjector').EffectiveCompositionProjection;
  /** One-way creative-authority lifecycle; commit authority never changes. */
  authorshipAuthority?: import('@/services/authorshipAuthority').AuthorshipAuthority;
  /** Source layer that produced this snapshot. */
  source: 'wizard' | 'recompile' | 'import' | 'manual' | 'clone';
  /** Canonical BusinessSystemType — drives VerticalLaunchContract resolution. */
  systemId: string | null;
  /** Resolved industry overlay (mirrors top-level `industry`). */
  industry: string;
  /** Identifier of the resolved VerticalLaunchContract (== systemId today). */
  verticalContractId: string | null;
  /** Optional contract version stamp for future immutability/versioning. */
  verticalContractVersion?: string;
  /** Wizard seed identifier when applicable. */
  wizardSeedId?: string;
  /**
   * Canonical generation seed (see `@/platform/core/generationSeed`).
   * Every controlled design variation in this site was derived from this
   * string. Persisted so refresh, recompile, preview, playground and publish
   * all reproduce the identical composition — and so an intentional
   * regeneration can be explained by a changed seed rather than by chance.
   */
  generationSeed?: string;
  /**
   * Stable signature of the normalized design plan the generation seed
   * produces (see `designPlanSignature`). Lets an audit prove the rendered
   * visual plan is exactly the seeded one — same seed in, same plan out.
   */
  designPlanSignature?: string;
  /**
   * Stable render hash — the fingerprint of every input that determines the
   * rendered site (design seed, sealed art direction, theme, template,
   * topology, resolved implementations). Two launches with the same answers
   * must carry the same hash; a different hash is proof the site changed.
   */
  renderHash?: string;
  /**
   * Sealed canonical art direction (family → pack → variants → profiles).
   * Authoritative for every downstream consumer; never re-derived.
   */
  artDirection?: import('@/sections/variants/resolvedArtDirection').ResolvedArtDirection | null;
  /**
   * Art Direction Family id (compatibility name: themePresetId) from the wizard Style-card. Persisted into the
   * snapshot so recompiles/autosaves can re-emit themed /src/index.css
   * without re-passing wizard props (chain-of-custody after compile).
   */
  themePresetId?: string | null;
  themeStyleVersion?: '2.0';
  /** Resolved template id from the wizard Template-card. */
  templateId?: string | null;
  /**
   * Sealed ArtDirectionPack id resolved at Stage 4b. Every downstream design
    * consumer (themed CSS, composition compiler, Preview, and export) reads this id
   * instead of re-deriving a pack, so the aesthetic cannot drift.
   */
  artDirectionPackId?: string | null;
  /** Wizard-selected direction, experience posture, and protected section pins. */
  designSelection?: import('@/services/wizardDesignSelection').WizardDesignSelection;
  /** Durable constrained final interaction plan. */
  interactionManifest?: WizardInteractionManifest;
  /** Explicit chain-of-custody for the Stage 4b dynamic theme stylesheet. */
  themeInjection?: {
    version: '1.0';
    stage: '4b';
    presetId: string | null;
    cssPath: '/src/index.css';
  };
  /** Snapshot-owned VFS primitive library available to generated pages. */
  uiFoundation?: {
    version: typeof GENERATED_UI_FOUNDATION_VERSION;
    manifestPath: '/.unison/ui-manifest.json';
    importRoot: '@/unison/ui';
    /** Canonical React runtime profile the generated package graph is pinned to. */
    runtimeProfile: string;
    /** Advanced runtime capabilities (e.g. experience.three-d) sealed with the site. */
    experienceCapabilities: readonly string[];
    approvedExperienceCapabilities?: readonly string[];
  };
  /**
   * Chain-of-custody for the typed theme contract sidecar. The contract itself
   * is deterministically re-derivable from `artDirectionPackId`; this stamp
   * records that Stage 4b emitted it and where consumers should re-emit it.
   */
  themeContract?: {
    version: string;
    contractPath: '/.unison/theme-contract.json';
    artDirectionPackId: string;
  };
  /**
   * Chain-of-custody for the versioned TemplateDesignContract (V2). The full
   * contract lives in the VFS sidecar; this stamp records its identity and
   * signature so recompile/autosave can prove the design plan did not drift.
   */
  templateDesignContract?: {
    version: string;
    contractPath: string;
    templateId: string;
    implementationId?: string;
    variantId?: string;
    seed?: string;
    layoutSignature: string;
    contractSignature?: string;
    /** Fingerprint of the design implementation inventory used to render. */
    registrySignature?: string;
  };
  /** Bounded connected-gateway research and route-specific generation plan. */
  generationBrief?: WizardGenerationBrief;
  /** Deterministic composition, interaction, and motion recipes for this launch. */
  designIntervention?: WizardDesignIntervention;
  /** Unified registry context aggregating sections, variants, artifacts, and catalog surfaces for this launch. */
  registryContext?: import('@/services/launch/wizardRegistryAggregation').WizardAggregatedRegistryContext;
  /** Final, non-destructive visual evaluation produced by canonical preflight. */
  visualQuality?: {
    version: string;
    compositionScore: number;
    hierarchyScore: number;
    diversityScore: number;
    mediaScore: number;
    repetitionPenalty: number;
    technicalScore: number;
    findings: unknown[];
    pages: unknown[];
    refinementDirective: string | null;
  };
  /** Experience instances and scene budget measured against the converged VFS. */
  experiencePreflight?: {
    instances: number;
    heavyInstances: number;
    violations: string[];
  };
  /** Package/import/renderer compatibility of the exact VFS that was sealed. */
  runtimeCompatibility?: {
    runtimeProfile: string;
    dependenciesResolvable: boolean;
    importsApproved: boolean;
    reactRuntimeCompatible: boolean;
    fallbackPresent: boolean;
    budgetValid: boolean;
    capabilitiesUsed: string[];
    warnings: string[];
    blockers: string[];
    ok: boolean;
  };
  /**
   * Seal stamp written by `sealSnapshot()`. Present only on the final sealed
   * revision — Stage 4b compile artifacts never carry it.
   */
  seal?: {
    version: '1.0';
    sealedAt: string;
    sealedBy: 'wizard-launch' | 'recompile' | 'builder-commit' | 'import';
    compileArtifactId: string;
    fileCount: number;
    /** Canonical Wizard ownership chain consumed from the merge proof. */
    pipeline?: 'lane-a+lane-b+stage-4b' | 'canonical-compiler+stage-4b' | 'canonical-plan+app-builder+stage-4b';
    authorityProofVersion?: '1.0' | '2.0' | '3.0';
    registeredPageBodyAuthority?: 'lane-b' | 'canonical-compiler' | 'app-builder';
    registeredPageFiles?: string[];
    /** Canonical source and metadata paths protected from launcher overrides. */
    protectedFilePatterns?: string[];
    /** Legacy v1 ownership-proof field, retained while old snapshots restore. */
    laneAProtectedFiles?: string[];
    /** Registered pages with no VFS file at seal time (report policy only). */
    missingPageFiles?: string[];
    /** Exact-byte authority ledger for the runtime files sealed in this revision. */
    fileAuthority?: Record<string, {
      sourceHash: string;
      authoringOrigin: 'wizard-launch' | 'recompile' | 'builder-commit' | 'import';
    }>;
  };

}


function readSnapshotDesignIntervention(
  files: Record<string, string>,
): WizardDesignIntervention | null {
  const rawSnapshot = files['/.unison/site-bundle-snapshot.json'];
  if (!rawSnapshot) return null;
  try {
    const snapshot = JSON.parse(rawSnapshot) as { meta?: { designIntervention?: unknown } };
    const intervention = snapshot.meta?.designIntervention;
    if (!intervention) return null;
    return readWizardDesignIntervention({
      '/.unison/design-intervention.json': JSON.stringify(intervention),
    });
  } catch {
    return null;
  }
}


// ============================================================================
// Main Pipeline Entry
// ============================================================================

/**
 * Execute the full canonical pipeline from wizard selections to preview-ready state.
 *
 * @deprecated for fresh launches. Fresh launches now use canonicalLaunchPlan +
 * UnisonAppBuilder. This function is retained for legacy project compatibility
 * and non-launch compilation paths. Do NOT use this for new Wizard launches.
 *
 * This is the ONLY way to create a valid site configuration for legacy/recompile flows.
 */
export function executeCanonicalPipeline(
  selections: WizardSelections,
  existingVfsFiles: Record<string, string> = {},
): CanonicalPipelineResult {
  assertWithinCommit('executeCanonicalPipeline');
  const resolved = resolveCanonicalLaunchContracts(selections, existingVfsFiles);
  const {
    capabilities,
    playground,
    sitePlan,
    validations,
    warnings,
    errors,
    themePresetId,
    themedCss,
    designIntervention,
    uiFoundation,
    registryContext,
  } = resolved;

  // Stage 4: Compile playground → VFS + router + bindings
  // Pass the wizard's Template + Style card selections so subpage scaffolds are
  // real role-filtered themed compositions instead of generic placeholders.
  // The design brief resolves art direction ONCE (theme-led). It must be built
  // before the stylesheet so /src/index.css can emit that pack's tokens.
  const compileResult = compilePlayground(playground, existingVfsFiles, selections.businessName, {
    selectedTemplateId: selections.templateId,
    selectedThemeId: selections.themeId,
    themePresetId,
    stage4bCss: themedCss,
    industry: selections.industryOverlay || (selections as { industry?: string }).industry || null,
    designIntervention,
  });

  const normalizedThemeFiles = normalizeWizardThemeTokens(compileResult.vfsFiles);
  compileResult.vfsFiles = refreshCompositionOwnership(compileResult.vfsFiles, normalizedThemeFiles.files);

  // Stage 4b: Lock in the wizard's Style-card tokens at the compile layer so
  // every downstream artifact (siteBundleSnapshot.vfsFiles, builder_drafts
  // persistence, AIBuilderPanel continuity, Playground rehydration) ships the
  // themed `/src/index.css` — not the un-themed default from the base scaffold.
  // Mirrors `recompileFromPlayground`'s themed CSS injection.
  //
  // INVARIANT: the selected Style card's resolved semantic HSL tokens must be
  // present. Stage 4b consumes that payload directly; theme ids are retained
  // only for traceability and downstream identity.
  compileResult.vfsFiles['/src/index.css'] = themedCss;
  Object.assign(compileResult.vfsFiles, uiFoundation.files);
  compileResult.vfsFiles = ensureGeneratedUiFoundation(compileResult.vfsFiles, {
    industry: selections.industryOverlay || (selections as { industry?: string }).industry,
    templateId: selections.templateId,
    themePresetId,
    needsBooking: selections.needsBooking,
    wantsLeadCapture: selections.wantsLeadCapture,
    sellsProducts: selections.sellsProducts,
    requiredRadixPrimitives: getRequiredRadixPrimitives(
      Object.values(designIntervention.activeVariants),
    ),
  }).files;
  compileResult.vfsFiles['/.unison/design-intervention.json'] = JSON.stringify(designIntervention, null, 2);
  compileResult.vfsFiles[WIZARD_REGISTRY_CONTEXT_PATH] = JSON.stringify(registryContext, null, 2);
  // Typed, machine-readable projection of the sealed art-direction pack. This
  // is the single theme context every AI turn reads — never raw compiled CSS.
  Object.assign(
    compileResult.vfsFiles,
    buildThemeContractFiles({
      artDirectionPackId: designIntervention.artDirectionPackId,
      themePresetId,
    }),
  );

  // Stage 5: Project to SiteBundleSnapshot (the single source of truth)
  const siteBundleSnapshot = projectToSiteBundleSnapshot(
    playground,
    compileResult,
    selections,
    'wizard',
    uiFoundation.manifest,
    designIntervention,
  );
  siteBundleSnapshot.meta.registryContext = registryContext;
  assertSnapshotThemeSeed(siteBundleSnapshot, themePresetId, 'Stage 4b -> SiteBundleSnapshot.meta');

  // Stage 6: Derive RuntimeManifest from snapshot
  const runtimeManifest = deriveRuntimeManifest(siteBundleSnapshot);

  return {
    success: errors.length === 0,
    capabilities,
    playground,
    validations,
    compileResult,
    siteBundleSnapshot,
    compileArtifact: createWizardCompileArtifact(siteBundleSnapshot),

    runtimeManifest,
    sitePlan,
    warnings,
    errors,
  };
}

// ============================================================================
// Incremental Pipeline (for in-builder updates)
// ============================================================================

/**
 * Re-derive all downstream artifacts from an updated PlaygroundState.
 * Used when the user modifies pages/bindings/funnels in the Playground UI.
 */
export function recompileFromPlayground(
  playground: PlaygroundState,
  existingVfsFiles: Record<string, string> = {},
  businessName?: string,
  industry?: string,
  options?: { selectedTemplateId?: string; selectedThemeId?: string; themePresetId?: string; themeTokens?: ThemeTokens; preservePageSources?: boolean },
): Omit<CanonicalPipelineResult, 'capabilities'> & { capabilities: null } {
  assertWithinCommit('recompileFromPlayground');
  const themePresetId = assertThemeSeed(
    options?.themePresetId,
    'Recompile input -> Stage 4b',
  );
  if (!options?.themeTokens) {
    throw new Error(
      '[canonicalPipeline] Recompile Stage 4b requires the original wizard themeTokens; CSS recovery is not allowed.',
    );
  }
  const warnings: string[] = [];
  const errors: string[] = [];

  const validations = validatePlayground(playground, existingVfsFiles);
  const summary = getValidationSummary(validations);
  if (!summary.isHealthy) {
    for (const v of validations.filter(v => v.severity === 'error')) errors.push(v.message);
    for (const v of validations.filter(v => v.severity === 'warning')) warnings.push(v.message);
  }

  // Recover wizardSeedId + sealed art direction from the existing snapshot so
  // recompiles preserve chain-of-custody back to the original wizard payload.
  let recoveredSeedId: string | undefined;
  let sealedPackId: string | undefined;
  let recoveredDesignSelection: import('@/services/wizardDesignSelection').WizardDesignSelection | undefined;
  try {
    const snapRaw = existingVfsFiles['/.unison/site-bundle-snapshot.json'];
    if (snapRaw) {
      const snap = JSON.parse(snapRaw) as {
        meta?: {
          wizardSeedId?: string;
          artDirectionPackId?: string | null;
          artDirection?: { storagePackId?: string } | null;
          designSelection?: import('@/services/wizardDesignSelection').WizardDesignSelection;
        };
      };
      recoveredSeedId = snap?.meta?.wizardSeedId;
      sealedPackId = snap?.meta?.artDirection?.storagePackId || snap?.meta?.artDirectionPackId || undefined;
      recoveredDesignSelection = snap?.meta?.designSelection;
    }
  } catch { /* ignore */ }

  const mirroredDesignIntervention = readWizardDesignIntervention(existingVfsFiles);
  const snapshotDesignIntervention = readSnapshotDesignIntervention(existingVfsFiles);
  if (
    mirroredDesignIntervention &&
    snapshotDesignIntervention &&
    JSON.stringify(mirroredDesignIntervention) !== JSON.stringify(snapshotDesignIntervention)
  ) {
    // The SiteBundleSnapshot is authoritative; a drifted mirror must not block
    // saves. Recompile re-projects the mirror from the snapshot below.
    warnings.push(
      'Design record mirror drifted from the SiteBundleSnapshot; the snapshot was used and the mirror is re-synced.',
    );
  }
  const resolvedDesignIntervention = snapshotDesignIntervention || mirroredDesignIntervention || buildWizardDesignIntervention({
    businessName: businessName || '',
    businessModel: 'general',
    industryOverlay: industry,
    templateId: options?.selectedTemplateId,
    themePresetId,
    wizardSeedId: recoveredSeedId,
    designSelection: recoveredDesignSelection,
  });
  // Art direction is read back from the sealed snapshot meta first, then the
  // sealed design intervention — never re-derived here.
  const recompileArtDirectionPackId = isArtDirectionPackId(sealedPackId)
    ? sealedPackId
    : resolvedDesignIntervention.artDirectionPackId;
  const designIntervention =
    recompileArtDirectionPackId === resolvedDesignIntervention.artDirectionPackId
      ? resolvedDesignIntervention
      : { ...resolvedDesignIntervention, artDirectionPackId: recompileArtDirectionPackId };
  const themedCss = buildThemedIndexCssFromTokens(options.themeTokens, {
    presetId: themePresetId,
    label: themePresetId,
    artDirectionPackId: recompileArtDirectionPackId,
  });
  if (!themedCss.includes('--primary:') || !themedCss.includes(SHADCN_LIBRARY_CSS_MARKER)) {
    throw new Error('[canonicalPipeline] Recompile Stage 4b did not produce the canonical shadcn stylesheet.');
  }
  const compileResult = compilePlayground(playground, existingVfsFiles, businessName, {
    selectedTemplateId: options?.selectedTemplateId,
    selectedThemeId: options?.selectedThemeId,
    themePresetId,
    stage4bCss: themedCss,
    industry: industry || null,
    designIntervention,
  });

  if (options.preservePageSources) {
    // Recompilation may rebuild the compiler projection, but an accepted VFS
    // is the source baseline for every non-launch mutation. Restore every
    // existing byte here, except page modules and sidecars whose registered
    // variants were explicitly changed by this presentation commit.
    const beforeCompositions = collectResolvedCompositions(existingVfsFiles);
    const afterCompositions = collectResolvedCompositions(compileResult.vfsFiles);
    const variantProjectionPaths = new Set<string>();
    for (const [pagePath, next] of Object.entries(afterCompositions)) {
      const previous = beforeCompositions[pagePath];
      const changedSectionSources = next.compiledBy === 'app-builder'
        ? next.sections.filter(section => section.sourcePath
          && compileResult.vfsFiles[section.sourcePath] !== existingVfsFiles[section.sourcePath])
        : [];
      const appBuilderVariantProjection = next.compiledBy === 'app-builder'
        && (compileResult.vfsFiles[pagePath] !== existingVfsFiles[pagePath] || changedSectionSources.length > 0);
      if (appBuilderVariantProjection) {
        variantProjectionPaths.add(pagePath);
        variantProjectionPaths.add(resolvedCompositionPathFor(pagePath));
        changedSectionSources.forEach(section => {
          if (section.sourcePath) variantProjectionPaths.add(section.sourcePath);
        });
        variantProjectionPaths.add('/.unison/design-intervention.json');
        continue;
      }
      if (!previous || !(previous.activation || previous.compiledBy === 'app-builder')) continue;
      const previousVariants = new Map(previous.sections.map((section) => [section.sectionId, section.variantId]));
      const changedSections = next.sections.filter((section) => previousVariants.get(section.sectionId) !== section.variantId);
      const changed = changedSections.length > 0;
      if (!changed) continue;
      variantProjectionPaths.add(pagePath);
      variantProjectionPaths.add(resolvedCompositionPathFor(pagePath));
      for (const section of changedSections) {
        const previousSection = previous.sections.find(candidate => candidate.sectionId === section.sectionId);
        if (section.sourcePath) variantProjectionPaths.add(section.sourcePath);
        if (previousSection?.sourcePath) variantProjectionPaths.add(previousSection.sourcePath);
      }
    }
    for (const [path, content] of Object.entries(existingVfsFiles)) {
      if (variantProjectionPaths.has(path)) continue;
      compileResult.vfsFiles[path] = content;
    }
  }
  const normalizedThemeFiles = normalizeWizardThemeTokens(compileResult.vfsFiles);
  compileResult.vfsFiles = refreshCompositionOwnership(compileResult.vfsFiles, normalizedThemeFiles.files);

  // Snapshot composed bodies before global theme finalization. The compiler
  // owns the baseline and accepted Lane B pages own local composition and art
  // direction; Stage 4b below owns only Wizard Style-card token values, the
  // global stylesheet, and the generated UI foundation.
  const preStage4bFiles = { ...compileResult.vfsFiles };

  // Stage 4b is mandatory and idempotent: only the token payload paired with
  // the incoming wizard seed may author the final stylesheet.
  compileResult.vfsFiles['/src/index.css'] = themedCss;
  const uiFoundation = buildGeneratedUiFoundation({
    industry,
    templateId: options?.selectedTemplateId,
    themePresetId,
    requiredRadixPrimitives: getRequiredRadixPrimitives(
      Object.values(designIntervention.activeVariants),
    ),
  });
  Object.assign(compileResult.vfsFiles, uiFoundation.files);
  compileResult.vfsFiles['/.unison/design-intervention.json'] = JSON.stringify(designIntervention, null, 2);
  Object.assign(
    compileResult.vfsFiles,
    buildThemeContractFiles({
      artDirectionPackId: recompileArtDirectionPackId,
      themePresetId,
    }),
  );

  if (existingVfsFiles[THEME_OVERRIDES_PATH]) compileResult.vfsFiles[THEME_OVERRIDES_PATH] = existingVfsFiles[THEME_OVERRIDES_PATH];
  compileResult.vfsFiles['/src/index.css'] = applyOverridesToCss(
    compileResult.vfsFiles['/src/index.css'], readThemeOverrides({ ...existingVfsFiles, ...compileResult.vfsFiles }),
  );

  // Stage 4b is an art-direction skin, never a re-composer. A flatten here is a
  // contract break, not a warning.
  assertStage4bCompositionPreserved(preStage4bFiles, compileResult.vfsFiles, 'Recompile Stage 4b');


  const siteBundleSnapshot = projectToSiteBundleSnapshot(
    playground,
    compileResult,
    {
      businessName: businessName || '',
      industry: industry || 'general',
      themePresetId,
      themeId: options?.selectedThemeId,
      templateId: options?.selectedTemplateId,
      wizardSeedId: recoveredSeedId,
      designSelection: recoveredDesignSelection,
      themeTokens: options.themeTokens,
    },
    'recompile',
    uiFoundation.manifest,
    designIntervention,
  );
  assertSnapshotThemeSeed(siteBundleSnapshot, themePresetId, 'Recompile Stage 4b -> SiteBundleSnapshot.meta');

  const runtimeManifest = deriveRuntimeManifest(siteBundleSnapshot);

  return {
    success: errors.length === 0,
    capabilities: null,
    playground,
    validations,
    compileResult,
    siteBundleSnapshot,
    compileArtifact: createWizardCompileArtifact(siteBundleSnapshot),

    runtimeManifest,
    sitePlan: null,
    warnings,
    errors,
  };
}

// ============================================================================
// Stage 5: Project PlaygroundState → SiteBundleSnapshot
// ============================================================================

function projectToSiteBundleSnapshot(
  playground: PlaygroundState,
  compileResult: PlaygroundCompileResult,
  selections: {
    businessName: string;
    industryOverlay?: string;
    industry?: string;
    systemType?: string | null;
    themePresetId?: string | null;
    themeId?: string | null;
    templateId?: string | null;
    wizardSeedId?: string | null;
    themeTokens?: ThemeTokens;
    interactionManifest?: WizardInteractionManifest;
    secondaryGoals?: string[];
    uiFoundation?: GeneratedUiManifest;
    designIntervention?: WizardDesignIntervention;
    designSelection?: import('@/services/wizardDesignSelection').WizardDesignSelection;
  },
  source: SiteBundleSnapshotMeta['source'] = 'wizard',
  uiFoundation?: GeneratedUiManifest,
  designIntervention?: WizardDesignIntervention,
): SiteBundleSnapshot {
  const registry = compileResult.pageRouteRegistry;
  const pages = Object.values(registry.pages);

  // Derive SiteManifest from PageRegistry
  const routes: RouteDef[] = pages.map(p => ({
    path: p.path,
    pageId: p.pageId,
    isHome: p.isHome,
  }));

  const nav: NavItem[] = pages
    .filter(p => p.showInNav)
    .sort((a, b) => a.navOrder - b.navOrder)
    .map(p => ({
      label: p.title,
      path: p.path,
      pageId: p.pageId,
    }));

  const homePage = pages.find(p => p.isHome);
  const homeSectionTypes = new Set(
    ((homePage as { sectionTypes?: unknown } | undefined)?.sectionTypes || []) as string[],
  );

  const manifest: SiteManifest = {
    routes,
    nav,
    layout: {
      header: homeSectionTypes.has('navbar') ? 'minimal' : 'none',
      footer: homeSectionTypes.has('footer') ? 'minimal' : 'none',
    },
    metadata: {
      title: selections.businessName || 'My Site',
      description: `${selections.businessName} — Built with Unison`,
    },
  };

  const resolvedIndustry =
    selections.industryOverlay || selections.industry || 'general';
  const resolvedSystemId = selections.systemType ?? null;
  const resolvedThemePresetId = assertThemeSeed(
    selections.themePresetId,
    'Stage 4b -> SiteBundleSnapshot.meta',
  );
  const resolvedTemplateId = selections.templateId || null;
  const generationBrief = buildWizardGenerationBrief({
    pageRegistry: registry,
    vfsFiles: compileResult.vfsFiles,
    uiFoundation,
    themePresetId: resolvedThemePresetId,
    artDirectionPackId: (designIntervention || selections.designIntervention)?.artDirectionPackId,
    industry: resolvedIndustry,
    seed: (designIntervention || selections.designIntervention)?.seed,
    customerGoals: selections.secondaryGoals,
  });

  return {
    snapshotId: `snap_${nanoid(8)}`,
    businessName: selections.businessName || '',
    industry: resolvedIndustry,
    pageRegistry: registry,
    vfsFiles: compileResult.vfsFiles,
    routerFile: compileResult.routerFile,
    manifest,
    bindings: compileResult.bindingManifest,
    calendars: playground.calendars,
    popups: playground.popups,
    creatorData: playground.creatorData,
    componentInstances: playground.creatorData.componentInstances,
    routes: compileResult.previewManifest.routes,
    homeRoute: compileResult.previewManifest.homeRoute,
    createdAt: new Date().toISOString(),
    themeTokens: selections.themeTokens,
    meta: {
      source,
      systemId: resolvedSystemId,
      industry: resolvedIndustry,
      verticalContractId: resolvedSystemId,
      themePresetId: resolvedThemePresetId,
      themeStyleVersion: '2.0',
      templateId: resolvedTemplateId,
      artDirectionPackId:
        (designIntervention || selections.designIntervention)?.artDirectionPackId ?? null,
      designSelection: selections.designSelection,
      wizardSeedId: selections.wizardSeedId ?? undefined,
      generationSeed: (designIntervention || selections.designIntervention)?.seed,
      designPlanSignature: (() => {
        const seed = (designIntervention || selections.designIntervention)?.seed;
        return seed ? designPlanSignature(seed) : undefined;
      })(),
      artDirection: (() => {
        const intervention = designIntervention || selections.designIntervention;
        return intervention
          ? projectResolvedArtDirection({ ...intervention, themePresetId: resolvedThemePresetId })
          : null;
      })(),
      renderHash: (() => {
        const intervention = designIntervention || selections.designIntervention;
        const artDirection = intervention
          ? projectResolvedArtDirection({ ...intervention, themePresetId: resolvedThemePresetId })
          : null;
        return computeRenderHash({
          artDirectionFamilyId: artDirection?.familyId ?? null,
          artDirectionQualifiedPackId: artDirection?.packId ?? null,
          seed: intervention?.seed ?? null,
          industry: resolvedIndustry,
          templateId: resolvedTemplateId ?? null,
          themePresetId: resolvedThemePresetId ?? null,
          artDirectionPackId: intervention?.artDirectionPackId ?? null,
          layoutRecipe: intervention?.layoutRecipe ?? null,
          motionRecipes: intervention?.motionRecipes ?? null,
          experienceBudget: intervention?.experienceBudget ?? null,
          activeVariants: intervention?.activeVariants ?? null,
          pages: (Array.isArray(registry)
            ? (registry as unknown[])
            : Object.values((registry ?? {}) as Record<string, unknown>)
          )
            .map((page) => {
              const entry = (page ?? {}) as Record<string, unknown>;
              return `${String(entry.id ?? '')}:${String(entry.slug ?? '')}:${String(entry.role ?? '')}`;
            })
            .sort(),
          routes: [...compileResult.previewManifest.routes].sort(),
        });
      })(),
      interactionManifest: selections.interactionManifest,
      themeInjection: {
        version: '1.0',
        stage: '4b',
        presetId: resolvedThemePresetId,
        cssPath: '/src/index.css',
      },
      uiFoundation: uiFoundation ? {
        version: uiFoundation.version,
        manifestPath: '/.unison/ui-manifest.json',
        importRoot: uiFoundation.importRoot,
        runtimeProfile: uiFoundation.runtimeProfile || GENERATED_RUNTIME_PROFILE.id,
        experienceCapabilities: [...(uiFoundation.experience?.capabilities || [])],
        approvedExperienceCapabilities: resolveApprovedExperienceCapabilities({
          webgl: (designIntervention || selections.designIntervention)?.envelope?.webgl,
          foundationCapabilities: uiFoundation.experience?.capabilities,
          reachesExperienceLayer: runExperiencePreflight(compileResult.vfsFiles).manifest.totalInstances > 0,
        }),
      } : undefined,
      themeContract: readThemeContract(compileResult.vfsFiles)
        ? {
            version: THEME_CONTRACT_VERSION,
            contractPath: THEME_CONTRACT_PATH,
            artDirectionPackId: readThemeContract(compileResult.vfsFiles)!.artDirectionPackId,
          }
        : undefined,
      templateDesignContract: (() => {
        const contract = readTemplateDesignContract(compileResult.vfsFiles);
        if (!contract) return undefined;
        return {
          version: String(contract.version),
          contractPath: TEMPLATE_DESIGN_CONTRACT_PATH,
          templateId: contract.templateId,
          implementationId: contract.implementationId,
          variantId: contract.variantId,
          seed: contract.seed,
          layoutSignature: contract.signature,
          contractSignature: contract.contractSignature,
          registrySignature: designRegistrySignature(),
        };
      })(),
      generationBrief,
      designIntervention,
    },
  };
}

// ============================================================================
// Stage 6: Derive RuntimeManifest from SiteBundleSnapshot
// ============================================================================

function deriveRuntimeManifest(snapshot: SiteBundleSnapshot): RuntimeManifest {
  // Use the existing factory but override with snapshot data
  const manifest = createRuntimeManifest(snapshot.vfsFiles, {
    brandName: snapshot.businessName,
    industry: snapshot.industry,
  });

  // Override routes with the canonical set from the snapshot
  manifest.routes = snapshot.routes;

  return manifest;
}
