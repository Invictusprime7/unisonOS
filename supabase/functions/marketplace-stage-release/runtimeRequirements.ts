/** A release carries requirements, never the creator's approvals, sessions or connected services. */
import { resolveDatabaseContracts } from '../_shared/capabilityPackContracts.ts';
export function extractRuntimeRequirements(snapshot: Record<string, unknown>) {
  const system = snapshot.businessSystem as { capabilities?: Array<{ id?: unknown; status?: unknown }> } | undefined;
  const bindings = snapshot.bindings && typeof snapshot.bindings === 'object'
    ? Object.values(snapshot.bindings as Record<string, unknown>) : [];
  const capabilityIds = new Set<string>();
  const provided = new Set<string>();
  for (const capability of system?.capabilities ?? []) {
    if (typeof capability.id === 'string' && ['approved', 'provisioned'].includes(String(capability.status))) {
      capabilityIds.add(capability.id);
      const provides = (capability as { provides?: unknown }).provides;
      if (Array.isArray(provides)) for (const id of provides) if (typeof id === 'string') provided.add(id);
    }
  }
  const portableBindings: Array<{ elementKey: string; intent: string; sourcePageId?: string; sourceSection?: string; sourceSlot?: string; requiredCapabilities: string[] }> = [];
  for (const value of bindings) {
    if (!value || typeof value !== 'object') continue;
    const binding = value as Record<string, unknown>;
    const required = Array.isArray(binding.requiredCapabilities) ? binding.requiredCapabilities.filter((id): id is string => typeof id === 'string') : [];
    for (const id of required) capabilityIds.add(id);
    if (typeof binding.elementKey !== 'string' || typeof binding.coreIntent !== 'string') continue;
    portableBindings.push({
      elementKey: binding.elementKey, intent: binding.coreIntent,
      ...(typeof binding.sourcePageId === 'string' ? { sourcePageId: binding.sourcePageId } : {}),
      ...(typeof binding.sourceSection === 'string' ? { sourceSection: binding.sourceSection } : {}),
      ...(typeof binding.sourceSlot === 'string' ? { sourceSlot: binding.sourceSlot } : {}),
      requiredCapabilities: [...new Set(required)].sort(),
    });
  }
  return {
    runtimeMode: capabilityIds.size ? 'requires-provisioning' as const : 'design-only' as const,
    capabilityIds: [...capabilityIds].sort(),
    requiredResourceKeys: [...new Set(resolveDatabaseContracts([...provided]).order.flatMap((pack) => pack.tables.map((table) => table.table)))].sort(),
    optionalIntegrations: [] as string[],
    bindings: portableBindings,
  };
}