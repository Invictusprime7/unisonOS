import type { AppBuildContract, AppBuildIntentBinding } from './appBuilderContracts';

/** Provisioning readiness never changes source/intent ownership or authorizes a write. */
export function isBindingOperationallyPending(contract: AppBuildContract, binding: AppBuildIntentBinding): boolean {
  if (binding.missingCapabilities.length > 0) return true;
  const component = contract.business.registeredComponents.find(candidate =>
    candidate.runtime.instanceId === binding.componentInstanceId);
  if (!component || component.runtime.writeIntent !== binding.coreIntent) return false;
  return component.instanceStatus !== 'ready' || component.runtime.status !== 'ready';
}