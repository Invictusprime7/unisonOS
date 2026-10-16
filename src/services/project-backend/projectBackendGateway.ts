/**
 * ProjectBackendGateway (guidebook §27–29). Every resource command resolves the
 * site's backend first. `shared-legacy` runs through the existing server
 * functions (which authenticate, check membership, scope by business+project
 * and audit). `dedicated` is handed to the caller, which must use the
 * project-backend connection — never the shared database.
 */
import { projectBackendResolver } from './projectBackendResolver';
import { describeBackendStatus } from './projectBackendHealth';
import type { ProjectBackendDescriptor } from './projectBackendTypes';

export class ProjectBackendUnavailableError extends Error {}

export async function withProjectBackend<T>(
  projectId: string | null | undefined,
  run: (descriptor: ProjectBackendDescriptor | null) => Promise<T>,
  expectedSiteId?: string | null,
): Promise<T> {
  // Single-site businesses without a resolved project are resolved server-side (cms-records).
  if (!projectId) return run(null);
  const descriptor = await projectBackendResolver.resolve(projectId);
  if (expectedSiteId && descriptor.siteId !== expectedSiteId) {
    throw new ProjectBackendUnavailableError('This project is bound to another site.');
  }
  const health = describeBackendStatus(descriptor);
  if (!health.ok) throw new ProjectBackendUnavailableError(health.reason);
  return run(descriptor);
}
