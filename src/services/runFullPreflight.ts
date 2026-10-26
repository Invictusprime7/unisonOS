/**
 * Single end-to-end preflight pipeline shared by the System Launcher and the
 * Web Builder's AI/template apply paths.
 *
 * Order of operations (canonicalLaunchVfs delegates its converged VFS here):
 *   1. Early syntax repair  (runPreflightRepair)
 *   2. Nav-intent stamping  (preflightNavWiring)
 *   3. Industry forbidden-intent stripping
 *   4. Final syntax repair  (runPreflightRepair) — catches damage from steps 2-3
 *
 * Repair transforms are best-effort; safety and runtime violations are returned
 * to the caller so the launcher/commit boundary can enforce them before seal.
 */
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { getIndustryIntentProfile } from '@/platform/core/industryIntentProfiles';
import { runPreflightRepair } from './aiSitePreflightRepair';
import { preflightNavWiring } from './preflightNavWiring';
import { closeRequiredIndustryIntents } from './requiredIntentClosure';
import { runExperiencePreflight, stampExperienceManifest } from './experiencePreflightGate';
import {
  runRuntimeCompatibilityPreflight,
  type RuntimeCompatibilityReport,
} from './runtimeCompatibilityPreflight';
import {
  evaluateVisualQuality,
  VISUAL_QUALITY_VERSION,
  type VisualQualityReport,
} from './visualQualityEvaluation';
import { resolveSiteDependencyRuntime } from '@/utils/dependencyExtractor';
import { SANDPACK_PREVIEW_CORE_DEPENDENCIES } from '@/utils/sandpackDependencies';

export interface RunFullPreflightOptions {
  siteBundleSnapshot?: SiteBundleSnapshot | null;
  industry?: string;
  brand?: string;
  /**
   * `repair` (default) may mutate source. `acceptance` is validation-only:
   * nothing is written back, and any file the repair pipeline *would* have
   * changed is reported as a violation instead.
   */
  mode?: 'repair' | 'acceptance';
  /**
   * When false, a file that cannot be repaired keeps its authored (broken)
   * source instead of being swapped for a "could not be compiled" stub, so
   * the caller's parse gate rejects the edit rather than committing the stub.
   * Builder AI edits must pass false. Defaults to true (legacy behaviour).
   */
  allowQuarantine?: boolean;
  /**
   * When false, industry-required intent surfaces are not injected. Launch
   * keeps the default (true); user-driven Builder edits pass false so a style
   * or copy edit can never grow an unrequested form or CTA on a page.
   */
  closeRequiredIntents?: boolean;
}

export interface RunFullPreflightResult {
  files: Record<string, string>;
  /** True when this pass changed any source file (repair mode only). */
  mutated: boolean;
  mutatedFiles: string[];
  /** Acceptance mode: files that still require mutation and cannot be sealed. */
  violations: string[];
  mode: 'repair' | 'acceptance';
  stages: {
    earlyRepair: 'ok' | 'skipped' | 'failed';
    navWiring: 'ok' | 'skipped' | 'failed';
    forbiddenStrip: { stripped: number; forbidden: string[] };
    requiredIntentClosure: { injected: string[]; missing: string[] };
    experienceGate: { instances: number; heavyInstances: number; violations: string[] };
    runtimeCompatibility: RuntimeCompatibilityReport;
    finalRepair: 'ok' | 'skipped' | 'failed';
  };
  /** Compositional quality report — advisory, never blocking. */
  visualQuality: VisualQualityReport;
}

export function runFullPreflight(
  inputFiles: Record<string, string>,
  options: RunFullPreflightOptions = {},
): RunFullPreflightResult {
  const { siteBundleSnapshot = null, industry, brand, mode = 'repair', allowQuarantine, closeRequiredIntents = true } = options;
  const ctx = { industry, brand };


  // 1) Early syntax repair
  let files = inputFiles;
  let earlyRepair: 'ok' | 'skipped' | 'failed' = 'skipped';
  try {
    const r = runPreflightRepair(files, { context: ctx, allowQuarantine });
    files = r.files;
    earlyRepair = 'ok';
  } catch (e) {
    console.warn('[runFullPreflight] early repair failed', e);
    earlyRepair = 'failed';
  }

  // 2) Nav-intent stamping (requires snapshot)
  let navWiring: 'ok' | 'skipped' | 'failed' = 'skipped';
  if (siteBundleSnapshot) {
    try {
      files = preflightNavWiring(files, siteBundleSnapshot).files;
      navWiring = 'ok';
    } catch (e) {
      console.warn('[runFullPreflight] nav wiring failed', e);
      navWiring = 'failed';
    }
  }

  // 3) Forbidden-intent stripping (industry-aware)
  const resolvedIndustry = industry || siteBundleSnapshot?.industry;
  const forbidden = resolvedIndustry
    ? (getIndustryIntentProfile(resolvedIndustry)?.forbidden ?? [])
    : [];
  let stripped = 0;
  if (forbidden.length > 0) {
    const escaped = forbidden.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const attrRe = new RegExp(`\\s+data-ut-intent\\s*=\\s*["'](?:${escaped})["']`, 'g');
    const next: Record<string, string> = { ...files };
    for (const [p, src] of Object.entries(next)) {
      if (typeof src !== 'string') continue;
      const after = src.replace(attrRe, () => {
        stripped++;
        return '';
      });
      if (after !== src) next[p] = after;
    }
    files = next;
    if (stripped > 0) {
      console.warn('[runFullPreflight] stripped forbidden intents', {
        industry: resolvedIndustry,
        forbidden,
        count: stripped,
      });
    }
  }

  // 4) Required-intent closure. This is deterministic and profile-driven so
  // required CTA surfaces never depend solely on AI prompt compliance.
  const requiredIntentClosure = closeRequiredIntents
    ? closeRequiredIndustryIntents(files, resolvedIndustry)
    : { files, injected: [] as string[], missing: [] as string[] };
  files = requiredIntentClosure.files;
  if (requiredIntentClosure.injected.length > 0 || requiredIntentClosure.missing.length > 0) {
    console.info('[runFullPreflight] required intent closure', requiredIntentClosure);
  }

  // 5) Experience (WebGL) budget + safety gate. Instances are stamped onto the
  // VFS so the builder keeps them WYSIWYG-editable after the seal.
  const experience = runExperiencePreflight(files);
  files = stampExperienceManifest(files, experience.manifest);
  if (experience.violations.length > 0) {
    console.warn('[runFullPreflight] experience gate violations', experience.violations);
  }

  // 6) Technical runtime compatibility. Package graph, approved imports,
  // React/R3F renderer profile, fallback presence and scene budget. This is a
  // technical gate only — it never mixes into business provisioning readiness.
  let runtimeCompatibility: RuntimeCompatibilityReport;
  try {
    const dependencyRuntime = resolveSiteDependencyRuntime(files, SANDPACK_PREVIEW_CORE_DEPENDENCIES);
    runtimeCompatibility = runRuntimeCompatibilityPreflight({
      files,
      entryPoints: dependencyRuntime.entryPoints,
      dependencies: dependencyRuntime.dependencies,
      dependencyGraphFingerprint: dependencyRuntime.graphFingerprint,
      approvedCapabilities: siteBundleSnapshot?.meta.uiFoundation?.approvedExperienceCapabilities,
    });
  } catch (e) {
    console.warn('[runFullPreflight] runtime compatibility preflight failed', e);
    runtimeCompatibility = {
      runtimeProfile: 'unknown',
      dependenciesResolvable: false,
      importsApproved: false,
      reactRuntimeCompatible: false,
      fallbackPresent: false,
      budgetValid: false,
      capabilitiesUsed: [],
      warnings: ['runtime compatibility preflight could not run'],
      blockers: ['Runtime compatibility validation could not complete.'],
      ok: false,
    };
  }
  if (!runtimeCompatibility.ok) {
    console.warn('[runFullPreflight] runtime compatibility blockers', runtimeCompatibility.blockers);
  }

  // 7) Final syntax repair (catches damage from steps 2-4)
  let finalRepair: 'ok' | 'skipped' | 'failed' = 'skipped';
  try {
    const r = runPreflightRepair(files, { context: ctx, allowQuarantine });
    files = r.files;
    finalRepair = 'ok';
  } catch (e) {
    console.warn('[runFullPreflight] final repair failed', e);
    finalRepair = 'failed';
  }

  // 8) Visual quality evaluation — COMPOSITIONAL, non-destructive. It never
  // mutates source and never triggers a fallback; it only reports, and may
  // hand the caller ONE focused refinement directive for Lane B.
  let visualQuality: VisualQualityReport;
  try {
    visualQuality = evaluateVisualQuality(files, {
      technicalScore: runtimeCompatibility.ok && experience.violations.length === 0 ? 100 : 70,
    });
    if (mode === 'repair' && visualQuality.refinementDirective) {
      console.info('[runFullPreflight] visual quality findings', visualQuality.findings);
    }
  } catch (e) {
    console.warn('[runFullPreflight] visual quality evaluation failed', e);
    visualQuality = {
      version: VISUAL_QUALITY_VERSION,
      compositionScore: 0, hierarchyScore: 0, diversityScore: 0, mediaScore: 0,
      repetitionPenalty: 0, technicalScore: 0,
      findings: [], pages: [], refinementDirective: null,
    };
  }

  const mutatedFiles = Object.keys(files).filter((p) => files[p] !== inputFiles[p]);
  const mutated = mutatedFiles.length > 0 || Object.keys(files).length !== Object.keys(inputFiles).length;


  if (mode === 'acceptance') {
    // Validation-only: nothing this pass produced may reach the seal.
    if (mutated) {
      console.warn('[runFullPreflight] acceptance pass found unresolved defects', { mutatedFiles });
    }
    return {
      files: inputFiles,
      mutated: false,
      mutatedFiles: [],
      violations: [...mutatedFiles, ...experience.violations, ...runtimeCompatibility.blockers],
      mode,
      stages: {
        earlyRepair,
        navWiring,
        forbiddenStrip: { stripped, forbidden },
        requiredIntentClosure: {
          injected: requiredIntentClosure.injected,
          missing: requiredIntentClosure.missing,
        },
        experienceGate: {
          instances: experience.manifest.totalInstances,
          heavyInstances: experience.manifest.heavyInstances,
          violations: experience.violations,
        },
        runtimeCompatibility,
        finalRepair,
      },
      visualQuality,
    };
  }

  return {
    files,
    mutated,
    mutatedFiles,
    violations: [],
    mode,
    stages: {
      earlyRepair,
      navWiring,
      forbiddenStrip: { stripped, forbidden },
      requiredIntentClosure: {
        injected: requiredIntentClosure.injected,
        missing: requiredIntentClosure.missing,
      },
      experienceGate: {
        instances: experience.manifest.totalInstances,
        heavyInstances: experience.manifest.heavyInstances,
        violations: experience.violations,
      },
      runtimeCompatibility,
      finalRepair,
    },
    visualQuality,
  };
}
