/**
 * @platform/core — the Unison brainstem.
 *
 * Single canonical entry point for the platform's core contracts.
 * Every layer (Wizard, AI Builder, Playground, Preview, Publish) consumes
 * this surface; nothing else may construct these types independently.
 *
 * Pipeline:
 *   BusinessBlueprint
 *     → PlaygroundState
 *     → SiteBundleSnapshot
 *     → RuntimeManifest
 *     → VFS/Preview → IntentRuntime
 *
 * Gates: PreviewGate (isPreviewReady) and PublishGate (isPublishReady).
 */

// Identity / intent surface
export * from './coreIntents';
export * from './intentSurfaceRegistry';
export * from './actionAffinity';

// Blueprint & capabilities
export * from './blueprintSchema';
export * from './capabilityRegistry';
export * from '@/services/businessCapabilityPlanner';
export * from './routePolicy';
export * from './provisioningValidator';
export * from './intentNormalizer';
export * from './slotBindingPolicy';
export * from './industryMatrix';
export * from './industryIntentProfiles';
export * from './integrityReport';
export * from './iconIntentRegistry';
export * from './siteTopologyPlanner';

// Artifact registry (Phase 3) — canonical artifact ↔ data ↔ intent ↔ capability map.
export * from './artifactRegistry';

// Compilation + gates (PreviewGate / PublishGate live here as isPreviewReady / isPublishReady)
export * from './contractCompiler';
// First-class Gate objects (PR5). Re-export AFTER contractCompiler so the
// Gate object versions of isPreviewReady/isPublishReady win the slot —
// they're back-compat re-exports of the same underlying functions.
export {
  PreviewGate,
  PublishGate,
  GATES,
  evaluateAllGates,
  GateFailedError,
  type Gate,
  type GateVerdict,
  type GateReason,
  type GateKey,
} from './gates';

// Runtime artifacts
export * from './runtimeManifest';
export * from './canonicalPipeline';

// Generated runtime profile + advanced runtime capability registry (one source).
export * from './generatedRuntimeCapabilities';

// Playground state model
export * from './playground';

// Single legal mutation entry — Wizard, AI Builder, Playground edits, Republish.
export * from './commitToPipeline';

// Contract Guard — silent-retry-then-surface enforcement for AI patches.
export * from './contractGuard';

// Pass 1 — named revisions: Stage 4b compile artifact + the single seal point.
export * from './snapshotSeal';
