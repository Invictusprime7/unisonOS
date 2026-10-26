/**
 * Deployment Service
 * 
 * Client-side service for deploying VFS templates to hosting providers.
 * Uses the publish-site Supabase Edge Function for actual deployments.
 */

import { supabase } from '@/integrations/supabase/client';
import { PublishGate } from '@/platform/core';
import type {
  CompiledContract,
  PublishBlocker,
  SiteBundleSnapshot,
} from '@/platform/core';
import {
  buildPublishAttestation,
  buildPublishAttestationFromSnapshot,
} from '@/services/publishAttestation';
import {
  resolveVerticalLaunchContract,
  type VerticalLaunchContract,
} from '@/services/verticalLaunchContract';
import {
  loadLatestPublishReadyRevisionForProject,
  recordRepublishEvent,
} from '@/services/vfsCommitService';
import { withPoweredByUnisonAttribution } from '@/services/export/unisonAttribution';
import { runDeployBackendPreflight } from '@/services/project-backend/deployBackendPreflight';
import { compileGeneratedSiteRuntimeManifest } from '@/services/generatedSiteRuntimeManifest';
import type { BusinessSystemType } from '@/lib/infrastructureContext';

export type DeploymentProvider = 'vercel' | 'netlify';

export interface DeploymentRequest {
  provider: DeploymentProvider;
  siteName?: string;
  customDomain?: string;
  files: Record<string, string>; // path -> content
  /**
   * The saved version the user is publishing. When set, publish refuses if the
   * newest publish-ready version differs, so an older version never ships silently.
   */
  expectedRevisionId?: string | null;
  /**
   * Optional compiled contract. When supplied, the publish gate runs before
   * any network call — preventing a half-wired site from going live.
   */
  contract?: CompiledContract | null;
  /**
   * Preferred publish path: the durable SiteBundleSnapshot produced by the
   * canonical pipeline. When supplied, `systemId` and vertical readiness
   * fixtures are derived from `snapshot.meta` — `systemId`/`rowCounts` on
   * this request act only as overrides for backwards compatibility.
   */
  snapshot?: SiteBundleSnapshot | null;
  /**
   * Track 6 — optional vertical (booking/saas/store/etc). When supplied, the
   * publish attestation includes the vertical's required capabilities, min
   * page/intent counts, and row-count assertions for server enforcement.
   *
   * @deprecated Prefer `snapshot.meta.systemId`.
   */
  systemId?: BusinessSystemType | null;
  /**
   * Observed row counts by table (e.g. `{ products: 5 }`) used to evaluate
   * the vertical contract's `rowCountAssertions` before publish.
   */
  rowCounts?: Record<string, number>;
  /**
   * Move D — when supplied, the deploy refuses to ship unless the latest
   * `publish_ready=true` revision exists for this project, and replaces
   * `files`/`snapshot` with that durable revision's payload so we never
   * publish unvetted in-memory state.
   */
  projectId?: string | null;
}

export interface DeploymentResponse {
  status: 'success' | 'error';
  url?: string;
  dashboardUrl?: string;
  provider: string;
  note?: string;
  error?: string;
  isLocalDevelopment?: boolean;
  /** Deployment succeeded, but the durable project projection needs repair. */
  synchronizationWarning?: string;
  /** Server-proven publish attestation outcome (Track 5). */
  attestation?: {
    enforced: boolean;
    evaluatedAt?: string;
    publishGateOk?: boolean;
    fingerprint?: string;
    code?: string;
    details?: unknown;
  };
}

export interface DeploymentStatus {
  isDeploying: boolean;
  progress: number; // 0-100
  message: string;
  result?: DeploymentResponse;
  /** Publish blockers when the gate rejects deployment. */
  blockers?: PublishBlocker[];
}

/**
 * Wrap raw HTML content with full document structure including Tailwind CSS
 */
export function wrapHtmlForDeployment(html: string, title: string = 'Unison Site'): string {
  const trimmed = html.trim();
  const lowerTrimmed = trimmed.toLowerCase();
  
  // If already a complete HTML document with Tailwind, return as-is
  if (lowerTrimmed.includes('<!doctype html') && lowerTrimmed.includes('tailwindcss')) {
    return trimmed;
  }
  
  // If it's a complete document but missing Tailwind, inject it
  if (lowerTrimmed.startsWith('<!doctype') || lowerTrimmed.startsWith('<html')) {
    // Inject Tailwind CDN and Lucide icons into existing document
    let result = trimmed.replace(
      /<head([^>]*)>/i,
      `<head$1>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: { extend: {} }
    }
  </script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>`
    );
    // Add lucide.createIcons() if not present
    if (result.includes('data-lucide') && !result.includes('lucide.createIcons')) {
      result = result.replace('</body>', '<script>if(typeof lucide!=="undefined"){lucide.createIcons();}</script>\n</body>');
    }
    return result;
  }
  
  // Wrap fragment with full document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          animation: {
            'fade-in': 'fadeIn 0.5s ease-out',
            'bounce-slow': 'bounce 3s infinite',
          },
          keyframes: {
            fadeIn: {
              '0%': { opacity: '0', transform: 'translateY(10px)' },
              '100%': { opacity: '1', transform: 'translateY(0)' },
            }
          }
        }
      }
    }
  </script>
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  <style>
    :root {
      color-scheme: light;
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --primary: 221.2 83.2% 53.3%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --border: 214.3 31.8% 91.4%;
      --radius: 0.75rem;
    }
    * { border-color: hsl(var(--border)); box-sizing: border-box; }
    body { 
      font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      margin: 0;
      min-height: 100vh;
      background-color: white;
      color: #1a1a2e;
    }
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; text-decoration: none; }
    /* Smooth scrolling */
    html { scroll-behavior: smooth; }
    /* Icon fallbacks */
    .icon-ArrowRight::before { content: '→'; }
    .icon-Play::before { content: '▶'; }
    .icon-Star::before { content: '★'; }
    .icon-Check::before { content: '✓'; }
    .icon-ChevronRight::before { content: '›'; }
    /* Grid and flex fixes */
    .grid { display: grid; }
    .flex { display: flex; }
  </style>
</head>
<body class="antialiased">
  ${html}
  <script>if(typeof lucide!=="undefined"){lucide.createIcons();}</script>
</body>
</html>`;
}

/**
 * Deploy files to a hosting provider (Vercel or Netlify)
 */
export async function deployToProvider(
  request: DeploymentRequest,
  onProgress?: (status: DeploymentStatus) => void
): Promise<DeploymentResponse> {
  const updateProgress = (progress: number, message: string) => {
    onProgress?.({
      isDeploying: true,
      progress,
      message,
    });
  };

  try {
    // Move D — refuse to publish unless the latest commit was marked
    // publish_ready=true in the durable revision ledger. When a projectId is
    // supplied we use the ledger as the source of truth for files and
    // snapshot, eliminating any chance of shipping un-committed live state.
    let publishedRevision: Awaited<ReturnType<typeof loadLatestPublishReadyRevisionForProject>> | null = null;
    let backendPreflight: Awaited<ReturnType<typeof runDeployBackendPreflight>> | null = null;
    if (request.projectId) {
      publishedRevision = await loadLatestPublishReadyRevisionForProject(request.projectId);
      if (!publishedRevision) {
        const errorResponse: DeploymentResponse = {
          status: 'error',
          provider: request.provider,
          error:
            'Publish blocked: no publish-ready revision exists. Resolve preview/readiness blockers and try again.',
        };
        onProgress?.({
          isDeploying: false,
          progress: 0,
          message: 'Publish blocked — no publish-ready revision in the ledger.',
          result: errorResponse,
        });
        return errorResponse;
      }
      if (request.expectedRevisionId && request.expectedRevisionId !== publishedRevision.id) {
        const errorResponse: DeploymentResponse = {
          status: 'error',
          provider: request.provider,
          error: 'Publish blocked: your latest saved version is not ready to publish yet, so an older version would go live. Fix the readiness blockers and try again.',
        };
        onProgress?.({ isDeploying: false, progress: 0, message: 'Publish blocked — latest saved version is not publish-ready.', result: errorResponse });
        return errorResponse;
      }
      // Use the durable ledger payload, not whatever the caller passed in.
      request = {
        ...request,
        files: publishedRevision.vfsFiles,
        snapshot: (publishedRevision.siteBundleSnapshot as SiteBundleSnapshot | null) ?? request.snapshot ?? null,
      };

      // Backend-free projects still require a persisted identity and revision.
      // Only an accepted runtime that requires a backend needs a binding.
      const runtimeManifest = publishedRevision.runtimeManifest;
      const backendFree = typeof runtimeManifest === 'object'
        && runtimeManifest !== null
        && 'backendRequired' in runtimeManifest
        && runtimeManifest.backendRequired === false;
      if (!backendFree) {
        // Requirements come from the accepted source and component contracts,
        // never the currently mounted Records registry or unsaved caller files.
        const resources = new Set(compileGeneratedSiteRuntimeManifest({ snapshot: request.snapshot }).reads);
        for (const source of Object.values(request.files)) {
          for (const match of source.matchAll(/data-ut-resource\s*=\s*(?:\{\s*)?["']([a-z0-9:_-]+)#/g)) resources.add(match[1]);
        }
        backendPreflight = await runDeployBackendPreflight({ projectId: request.projectId, resources: [...resources] });
        if (!backendPreflight.ok) {
          const errorResponse: DeploymentResponse = {
            status: 'error',
            provider: request.provider,
            error: `Publish blocked: ${backendPreflight.reason}`,
          };
          onProgress?.({
            isDeploying: false,
            progress: 0,
            message: 'Publish blocked — backend binding is not ready.',
            result: errorResponse,
          });
          return errorResponse;
        }
      }
    }


    // Closure B — publish gate. If a contract was supplied, enforce it BEFORE
    // any network/billing-incurring call. Stubbed business-critical capabilities
    // (commerce/auth/booking/lead-capture/quoting/donation) block publish even
    // when preview was happy.
    if (request.contract) {
      const verdict = PublishGate.evaluate(request.contract);
      if (!verdict.ok) {
        const blockers: PublishBlocker[] = verdict.reasons.map((r) => ({
          code: r.code as PublishBlocker['code'],
          message: r.message,
          capabilityId: (r.meta?.capabilityId as PublishBlocker['capabilityId']) ?? undefined,
        }));
        const summary = blockers.map((b) => `• ${b.message}`).join('\n');
        const errorMessage = `Publish blocked by ${verdict.gate}:\n${summary}`;
        const errorResponse: DeploymentResponse = {
          status: 'error',
          provider: request.provider,
          error: errorMessage,
        };
        onProgress?.({
          isDeploying: false,
          progress: 0,
          message: 'Publish blocked — fix critical capabilities before deploying.',
          result: errorResponse,
          blockers,
        });
        return errorResponse;
      }
    }

    updateProgress(10, 'Preparing files for deployment...');

    // Normalize file paths (remove leading slashes for Vercel)
    let normalizedFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(request.files)) {
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
      normalizedFiles[normalizedPath] = content;
    }

    // Ensure index.html exists
    if (!normalizedFiles['index.html']) {
      throw new Error('Missing index.html - required for deployment');
    }
    normalizedFiles = withPoweredByUnisonAttribution(normalizedFiles);
    if (backendPreflight?.manifestJson) {
      normalizedFiles['unison.runtime.json'] = backendPreflight.manifestJson;
    }

    updateProgress(30, `Connecting to ${request.provider}...`);

    // Track 5 — server-proven publish contract. When a contract is available,
    // attach an attestation so the edge function can re-verify gates + file
    // fingerprint server-side before touching the deploy provider.
    //
    // Snapshot-driven path (preferred): when a SiteBundleSnapshot is supplied,
    // systemId + vertical readiness come from `snapshot.meta` — the durable
    // canonical-pipeline output. Legacy `systemId`/`rowCounts` on the request
    // remain as overrides only.
    let publishAttestation: Awaited<ReturnType<typeof buildPublishAttestation>> | undefined;
    if (request.contract) {
      try {
        if (request.snapshot && !request.systemId) {
          publishAttestation = await buildPublishAttestationFromSnapshot(
            request.snapshot,
            request.contract,
            { rowCounts: request.rowCounts, files: normalizedFiles },
          );
        } else {
          const resolvedSystemId =
            request.systemId ??
            ((request.snapshot?.meta?.systemId as BusinessSystemType | null) ?? null);
          const verticalContract: VerticalLaunchContract | null = resolvedSystemId
            ? resolveVerticalLaunchContract(resolvedSystemId)
            : null;
          publishAttestation = await buildPublishAttestation(request.contract, normalizedFiles, {
            verticalContract,
            rowCounts: request.rowCounts,
          });
        }
      } catch (err) {
        console.warn('[deploymentService] Failed to build publish attestation', err);
      }
    }

    // Call the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('publish-site', {
      body: {
        provider: request.provider,
        siteName: request.siteName || `unison-site-${Date.now()}`,
        customDomain: request.customDomain,
        files: normalizedFiles,
        publishAttestation,
      },
    });

    if (error) {
      console.error('[deploymentService] Supabase function error:', error);
      // Track 6 — surface server-side attestation rejections (HTTP 412 with
      // codes like `vertical-capabilities-missing`, `vertical-pages-insufficient`,
      // `vertical-row-counts-insufficient`) as actionable messages instead of
      // a generic "Edge Function returned a non-2xx" toast.
      let serverBody: Record<string, unknown> | null = null;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          serverBody = await ctx.json();
        }
      } catch {
        /* ignore */
      }
      const attestation = serverBody?.attestation as
        | { enforced?: boolean; code?: string; details?: unknown }
        | undefined;
      const serverMsg = (serverBody?.error as string | undefined) || error.message || 'Deployment failed';
      const friendly = attestation?.code
        ? `${serverMsg} [${attestation.code}]`
        : serverMsg;
      const errResp: DeploymentResponse = {
        status: 'error',
        provider: request.provider,
        error: friendly,
        attestation: attestation
          ? { enforced: !!attestation.enforced, code: attestation.code, details: attestation.details }
          : undefined,
      };
      onProgress?.({
        isDeploying: false,
        progress: 0,
        message: `Deployment failed: ${friendly}`,
        result: errResp,
      });
      return errResp;
    }

    const response = data as DeploymentResponse;

    if (response.status === 'error') {
      throw new Error(response.error || 'Deployment failed');
    }

    updateProgress(100, 'Deployment complete!');

    // Project the deployed ledger revision onto the durable project owner.
    if (publishedRevision) {
      const { data: projectedProject, error: projectionError } = await supabase
        .from('projects')
        .update({
          active_published_revision_id: publishedRevision.id,
          publish_status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', publishedRevision.projectId)
        .eq('business_id', publishedRevision.businessId)
        .select('id')
        .maybeSingle();
      if (projectionError || !projectedProject) {
        const synchronizationWarning = projectionError?.message
          || 'The deployed revision could not be attached to the project.';
        console.error('[deploymentService] Published revision projection failed:', synchronizationWarning);
        response.synchronizationWarning = synchronizationWarning;
        response.note = [response.note, 'Site deployed, but project synchronization requires attention.']
          .filter(Boolean)
          .join(' ');
      }
      void recordRepublishEvent({
        revisionId: publishedRevision.id,
        projectId: publishedRevision.projectId,
        businessId: publishedRevision.businessId,
        userId: null,
        provider: request.provider,
        url: (response as { url?: string | null })?.url ?? null,
        vfsHash: publishedRevision.vfsHash,
      });
    }

    onProgress?.({
      isDeploying: false,
      progress: 100,
      message: response.synchronizationWarning
        ? 'Deployment complete — project synchronization needs attention.'
        : 'Deployment complete!',
      result: response,
    });


    return response;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorResponse: DeploymentResponse = {
      status: 'error',
      provider: request.provider,
      error: errorMessage,
    };
    
    onProgress?.({
      isDeploying: false,
      progress: 0,
      message: `Deployment failed: ${errorMessage}`,
      result: errorResponse,
    });

    return errorResponse;
  }
}

export interface ProviderDeployOptions {
  contract?: CompiledContract | null;
  /** Preferred — durable canonical snapshot. */
  snapshot?: SiteBundleSnapshot | null;
  /** @deprecated Use `snapshot.meta.systemId`. */
  systemId?: BusinessSystemType | null;
  rowCounts?: Record<string, number>;
  /** Move D — enables ledger-backed publish enforcement. */
  projectId?: string | null;
  /** Saved version being published; blocks if an older version would ship. */
  expectedRevisionId?: string | null;
}

/**
 * Deploy to Vercel specifically
 */
export async function deployToVercel(
  files: Record<string, string>,
  siteName?: string,
  onProgress?: (status: DeploymentStatus) => void,
  options?: ProviderDeployOptions,
): Promise<DeploymentResponse> {
  return deployToProvider(
    {
      provider: 'vercel',
      siteName,
      files,
      contract: options?.contract ?? null,
      snapshot: options?.snapshot ?? null,
      systemId: options?.systemId ?? null,
      rowCounts: options?.rowCounts,
      projectId: options?.projectId ?? null,
      expectedRevisionId: options?.expectedRevisionId ?? null,
    },
    onProgress
  );
}

/**
 * Deploy to Netlify specifically
 */
export async function deployToNetlify(
  files: Record<string, string>,
  siteName?: string,
  onProgress?: (status: DeploymentStatus) => void,
  options?: ProviderDeployOptions,
): Promise<DeploymentResponse> {
  return deployToProvider(
    {
      provider: 'netlify',
      siteName,
      files,
      contract: options?.contract ?? null,
      snapshot: options?.snapshot ?? null,
      systemId: options?.systemId ?? null,
      rowCounts: options?.rowCounts,
      projectId: options?.projectId ?? null,
      expectedRevisionId: options?.expectedRevisionId ?? null,
    },
    onProgress
  );
}

/**
 * Convert VFS nodes to a flat file map for deployment
 */
export function vfsNodesToFileMap(
  nodes: Array<{ name: string; type: 'file' | 'folder'; content?: string; children?: unknown[] }>,
  basePath: string = ''
): Record<string, string> {
  const files: Record<string, string> = {};

  for (const node of nodes) {
    const path = basePath ? `${basePath}/${node.name}` : node.name;
    
    if (node.type === 'file' && node.content !== undefined) {
      files[path] = node.content;
    } else if (node.type === 'folder' && node.children) {
      const childFiles = vfsNodesToFileMap(
        node.children as Array<{ name: string; type: 'file' | 'folder'; content?: string; children?: unknown[] }>,
        path
      );
      Object.assign(files, childFiles);
    }
  }

  return files;
}
