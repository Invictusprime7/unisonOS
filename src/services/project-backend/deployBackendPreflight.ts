/**
 * Deploy backend preflight (guidebook Phase 8): runs before any provider
 * deploy. Resolves the site's backend binding, refuses to deploy against a
 * backend that is still provisioning or failed, and produces the public
 * environment contract (`unison.runtime.json` + VITE_ vars) to inject into
 * the deployed bundle. Public values only — server secrets are never emitted.
 */
import { projectBackendResolver } from './projectBackendResolver';
import { callProjectBackend } from './projectBackendClient';
import { buildRuntimeManifest, serializeRuntimeManifest, type UnisonRuntimeManifest } from './runtimeManifest';

export interface DeployBackendPreflightResult {
  ok: boolean;
  reason?: string;
  backendMode?: 'shared-legacy' | 'dedicated';
  manifest?: UnisonRuntimeManifest;
  /** Serialized unison.runtime.json to include in the deploy file map. */
  manifestJson?: string;
  /** Public env vars safe to inject into the deployed site. */
  publicEnv?: Record<string, string>;
}

export async function runDeployBackendPreflight(input: {
  projectId: string;
  resources?: string[];
  schemaVersion?: number;
}): Promise<DeployBackendPreflightResult> {
  let backend;
  try {
    backend = await projectBackendResolver.resolve(input.projectId);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Backend binding could not be resolved.' };
  }

  if (backend.status === 'provisioning') {
    return { ok: false, reason: 'This site’s backend is still being set up. Try publishing again in a moment.' };
  }
  if (backend.status === 'failed') {
    return { ok: false, reason: 'This site’s backend setup failed. Reconnect the backend before publishing.' };
  }
  if (backend.mode === 'dedicated' && (!backend.projectUrl || !backend.publishableKey)) {
    return { ok: false, reason: 'This site’s backend is missing its public connection details.' };
  }

  const resources = [...new Set(input.resources ?? [])].sort();
  if (backend.mode === 'dedicated') {
    try {
      await Promise.all(resources.map(async (resource) => {
        const result = await callProjectBackend<{ resource: string; compatible: boolean }>({
          projectId: input.projectId, action: 'check', resource,
        });
        if (result?.compatible !== true || result.resource !== resource) {
          throw new Error(`The database compatibility check did not confirm ${resource}.`);
        }
      }));
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'The site’s database structure could not be verified.' };
    }
  }

  const manifest = buildRuntimeManifest({
    backend,
    resources,
    schemaVersion: input.schemaVersion,
  });

  return {
    ok: true,
    backendMode: backend.mode,
    manifest,
    manifestJson: serializeRuntimeManifest(manifest),
    publicEnv: { ...manifest.publicEnv },
  };
}
