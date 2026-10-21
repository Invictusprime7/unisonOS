/**
 * Runtime Manifest — the contract between Launcher/Editor and Preview Engine.
 *
 * Every preview session is driven by a RuntimeManifest that tells the preview
 * compiler what to render, how to route, and which engine to use.
 *
 * Architecture:
 *   Launcher → { sourceFiles, runtimeManifest } → compileLauncherOutputForPreview()
 *                                                      ↓
 *                                              prepareSandpackFiles()
 *                                                      ↓
 *                                                  Sandpack / Docker
 */

// ─── Core Manifest ──────────────────────────────────────────────────────────

/**
 * LauncherEngine — the preview engine used by the Launcher/Editor handoff.
 * NOT the same as siteBundle.ts PreviewEngine ("simple"|"vfs"|"worker").
 * This governs how the preview is hosted (sandpack vs docker).
 */
export type LauncherEngine = 'sandpack' | 'docker';

/** @deprecated Use LauncherEngine — kept for backward compat */
export type PreviewEngine = LauncherEngine;

export type UnisonRuntimeEnvironment = 'builder' | 'preview' | 'published';

/**
 * The tenant identity carried by every builder, preview, and published
 * runtime. Domain data is always resolved through this context, not UI props.
 */
export interface UnisonRuntimeContext {
  workspaceId: string;
  businessId: string;
  projectId: string;
  websiteId: string;
  locationId?: string | null;
  snapshotId: string;
  environment: UnisonRuntimeEnvironment;
  revisionId?: string;
  deploymentId?: string;
  permissions?: readonly string[];
  subscriptionTier?: string;
  brandProfileVersion?: string;
  /** @deprecated Read persisted manifests through normalizeUnisonRuntimeContext. */
  organizationId?: string;
  /** @deprecated Use websiteId. */
  siteId?: string;
}

export function normalizeUnisonRuntimeContext(
  context: Partial<UnisonRuntimeContext> | null | undefined,
): UnisonRuntimeContext | undefined {
  if (!context) return undefined;
  const workspaceId = context.workspaceId ?? context.organizationId;
  const websiteId = context.websiteId ?? context.siteId;
  if (
    !workspaceId ||
    !context.businessId ||
    !context.projectId ||
    !websiteId ||
    !context.snapshotId ||
    !context.environment
  ) {
    return undefined;
  }

  return {
    ...context,
    workspaceId,
    websiteId,
    organizationId: context.organizationId ?? workspaceId,
    siteId: context.siteId ?? websiteId,
  } as UnisonRuntimeContext;
}

export interface RuntimeAppContext {
  runtimeContext?: UnisonRuntimeContext;
  businessId?: string;
  projectId?: string;
  manifestId?: string;
  snapshotId?: string;
  businessName?: string;
  templateName?: string;
  templateCategory?: string;
  /** Resolved Template-card id (single source of truth for structural composition) */
  templateId?: string;
  systemType?: string;
  systemName?: string;
  industry?: string;
  entryPoint?: string;
  routes?: string[];
  wizardSelections?: Record<string, unknown>;
  businessRuntime?: import('@/platform/core/businessRuntimeContract').BusinessRuntimeContract;
  /** Resolved Style-card preset id (e.g. 'organic'); single source of truth for /src/index.css */
  themePresetId?: string;
  /** Durable semantic HSL token payload selected by the wizard Style card. */
  themeTokens?: import('@/sections/types').ThemeTokens;
  /** Durable constrained plan for the final interaction runtime. */
  interactionManifest?: import('@/services/wizardInteractionEnrichment').WizardInteractionManifest;
  /** Shared Preview capability contract for every canonical wizard launch. */
  previewRuntime?: {
    version: '1.0';
    foundation: 'token-glass';
    optionalLibraries: string[];
  };
  /** Records the canonical Stage 4b stylesheet injection. */
  themeInjection?: {
    version: '1.0';
    stage: '4b';
    presetId: string | null;
    cssPath: '/src/index.css';
  };
  generatedAt: string;
}

export interface RuntimeManifest {
  /** Canonical entry point path (e.g. "/src/App.tsx") */
  entryPoint: string;

  /** Whether the project requires backend capabilities (auth, DB, edge functions) */
  backendRequired: boolean;

  /** Which preview engine to use — determined by backendRequired + feature flags */
  previewEngine: LauncherEngine;

  /** Declared routes for the site */
  routes: string[];

  /** NPM dependencies the generated code expects */
  dependencies: Record<string, string>;

  /** Environment variables / secrets the project needs at runtime */
  envRequirements: string[];

  /** Industry vertical (for contextual component synthesis) */
  industry?: string;

  /** Business/brand name */
  brandName?: string;

  /** Aesthetic theme ID */
  aesthetic?: string;

  /** Shared app context propagated across launcher, VFS, and preview runtime */
  appContext?: RuntimeAppContext;

  /** Canonical metadata files injected into the VFS */
  metadataFiles?: string[];

  /** Stable key used to avoid duplicate preview sessions for the same app context */
  sessionKey?: string;
}

// ─── Launcher Handoff Payload ───────────────────────────────────────────────

export interface LauncherHandoff {
  /** Source VFS files in /src/ structure */
  sourceFiles: Record<string, string>;

  /** Runtime manifest describing the project shape */
  runtimeManifest: RuntimeManifest;

  /** Optional SiteBundle for structured site data */
  siteBundle?: {
    pages?: Record<string, any>;
    theme?: Record<string, any>;
    metadata?: { name?: string; industry?: string };
  };

  /** Navigation state passed to WebBuilder */
  navState: {
    templateName: string;
    aesthetic?: string;
    templateCategory?: string;
    systemType?: string;
    systemName?: string;
    startInPreview?: boolean;
    preloadedIntents?: string[];
  };
}

// ─── Manifest Factory ───────────────────────────────────────────────────────

/**
 * Create a RuntimeManifest from launcher metadata.
 * Infers routes from VFS file paths and detects backend requirements.
 */
export function createRuntimeManifest(
  sourceFiles: Record<string, string>,
  options?: {
    entryPoint?: string;
    industry?: string;
    brandName?: string;
    aesthetic?: string;
    backendRequired?: boolean;
    dependencyOverrides?: Record<string, string>;
    appContext?: Partial<Omit<RuntimeAppContext, 'generatedAt'>> & { generatedAt?: string };
    metadataFiles?: string[];
    sessionKey?: string;
  }
): RuntimeManifest {
  const filePaths = Object.keys(sourceFiles);

  // Infer routes from /src/pages/ files
  const routes = Array.from(new Set(filePaths
    .filter(p => /\/src\/pages\/[^/]+\.(tsx|jsx)$/i.test(p))
    .map(p => {
      const name = p.match(/\/pages\/([^/]+)\.(tsx|jsx)$/i)?.[1] || '';
      if (/^(home|index)$/i.test(name)) return '/';
      return '/' + name.toLowerCase();
    })));

  if (routes.length === 0) routes.push('/');

  // Detect backend requirements from code content
  const allContent = Object.values(sourceFiles).join('\n');
  const backendRequired = options?.backendRequired ??
    /supabase\.|createClient|auth\.(signIn|signUp|getSession)|\.from\(|edge.function/i.test(allContent);

  // Extract npm imports
  const dependencies: Record<string, string> = {};
  const importRegex = /import\s+.*?\s+from\s+['"]([^./][^'"]*)['"]/g;
  let match;
  while ((match = importRegex.exec(allContent)) !== null) {
    const pkg = match[1].startsWith('@')
      ? match[1].split('/').slice(0, 2).join('/')
      : match[1].split('/')[0];
    if (!dependencies[pkg] && pkg !== 'react' && pkg !== 'react-dom') {
      dependencies[pkg] = 'latest';
    }
  }

  const mergedDependencies = {
    ...dependencies,
    ...(options?.dependencyOverrides || {}),
  };

  const appContext = options?.appContext
    ? {
        ...options.appContext,
        entryPoint: options.appContext.entryPoint || options.entryPoint || '/src/App.tsx',
        industry: options.appContext.industry || options.industry,
        routes: options.appContext.routes || routes,
        generatedAt: options.appContext.generatedAt || new Date().toISOString(),
      }
    : undefined;

  return {
    entryPoint: options?.entryPoint || '/src/App.tsx',
    backendRequired,
    previewEngine: backendRequired ? 'docker' : 'sandpack',
    routes,
    dependencies: mergedDependencies,
    envRequirements: backendRequired
      ? ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
      : [],
    industry: options?.industry,
    brandName: options?.brandName,
    aesthetic: options?.aesthetic,
    appContext,
    metadataFiles: options?.metadataFiles,
    sessionKey: options?.sessionKey,
  };
}

// ─── Preview Engine Resolution ──────────────────────────────────────────────

/**
 * Resolve which preview engine to use.
 * Falls back to sandpack with a banner if docker is required but unavailable.
 */
export function resolvePreviewEngine(
  manifest: RuntimeManifest,
  capabilities: { dockerAvailable?: boolean } = {}
): { engine: LauncherEngine; frontendOnly: boolean } {
  if (manifest.previewEngine === 'docker' && !capabilities.dockerAvailable) {
    return { engine: 'sandpack', frontendOnly: true };
  }
  return {
    engine: manifest.previewEngine,
    frontendOnly: manifest.previewEngine === 'sandpack',
  };
}
