import { supabase } from '@/integrations/supabase/client';
import { CAPABILITY_PACKS, resolveCapabilityPacks, type BusinessCapability, type CapabilityPack } from '@/platform/core/capabilityPacks';

export type CRMView =
  | 'overview'
  | 'contacts'
  | 'activity'
  | 'automations'
  | 'leads'
  | 'bookings'
  | 'services'
  | 'products'
  | 'menu'
  | 'pipeline'
  | 'workflows'
  | 'recipes'
  | 'forms';

export interface CRMNavigationItem {
  id: CRMView;
  label: string;
  requiredCapabilities?: readonly BusinessCapability[];
}

export const CRM_NAVIGATION_ITEMS: readonly CRMNavigationItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'activity', label: 'Activity' },
  { id: 'automations', label: 'Automations' },
  { id: 'leads', label: 'Leads', requiredCapabilities: ['crm.leads'] },
  { id: 'bookings', label: 'Bookings', requiredCapabilities: ['booking.appointments'] },
  { id: 'services', label: 'Services', requiredCapabilities: ['catalog.services'] },
  { id: 'products', label: 'Products', requiredCapabilities: ['catalog.products'] },
  { id: 'menu', label: 'Menu', requiredCapabilities: ['catalog.menu'] },
  { id: 'pipeline', label: 'Pipeline', requiredCapabilities: ['crm.leads'] },
  { id: 'workflows', label: 'Workflows', requiredCapabilities: ['automation.follow_up'] },
  { id: 'recipes', label: 'Prebuilt', requiredCapabilities: ['automation.follow_up'] },
  { id: 'forms', label: 'Form Submissions', requiredCapabilities: ['forms.contact', 'forms.quote'] },
];

const INSTALLER_SOURCE = 'capability-migration-apply';
const MANIFEST_VERSION = '1.0';
const KNOWN_PACKS = new Set<string>(CAPABILITY_PACKS.map((pack) => pack.id));

export interface SiteCapabilityRow {
  capability_id: string;
  status: string;
  configuration: unknown;
}

const SYSTEM_INSTALL_CAPABILITY_PACKS: Readonly<Record<string, readonly BusinessCapability[]>> = {
  'booking-pack': ['booking.appointments'],
  'ecommerce-pack': ['commerce.checkout'],
  'leads-pack': ['crm.leads'],
  'newsletter-pack': ['crm.leads'],
};
const SYSTEM_TYPE_BACKEND_PACKS: Readonly<Record<string, readonly string[]>> = {
  booking: ['booking-pack', 'leads-pack'],
  store: ['ecommerce-pack', 'leads-pack'],
  content: ['newsletter-pack', 'leads-pack'],
  agency: ['leads-pack', 'newsletter-pack'],
  portfolio: ['leads-pack'],
  saas: ['leads-pack', 'newsletter-pack', 'auth-pack'],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function resolveSystemInstallCapabilityPacks(backendPacks: readonly string[]): CapabilityPack[] {
  const requested = new Set<BusinessCapability>();
  for (const backendPack of backendPacks) {
    for (const capability of SYSTEM_INSTALL_CAPABILITY_PACKS[backendPack] ?? []) requested.add(capability);
  }
  return resolveCapabilityPacks([...requested]).order;
}

export function resolveSystemTypeCapabilityPacks(systemType: string): CapabilityPack[] {
  return resolveSystemInstallCapabilityPacks(SYSTEM_TYPE_BACKEND_PACKS[systemType] ?? []);
}

export function resolveInstalledSiteCapabilities(rows: readonly SiteCapabilityRow[]): BusinessCapability[] {
  const installed = new Set<BusinessCapability>();
  for (const row of rows) {
    const configuration = asRecord(row.configuration);
    if (row.status !== 'enabled'
      || !KNOWN_PACKS.has(row.capability_id)
      || configuration?.source !== INSTALLER_SOURCE
      || configuration.manifestVersion !== MANIFEST_VERSION
      || configuration.packId !== row.capability_id) continue;
    installed.add(row.capability_id as BusinessCapability);
  }
  return [...installed];
}

export async function loadInstalledSiteCapabilities(scope: {
  businessId: string;
  projectId: string;
  siteId?: string;
}): Promise<BusinessCapability[]> {
  const projectResult = await supabase.from('projects')
    .select('id,business_id,site_id')
    .eq('id', scope.projectId)
    .eq('business_id', scope.businessId)
    .maybeSingle();
  if (projectResult.error) throw projectResult.error;
  if (!projectResult.data || projectResult.data.business_id !== scope.businessId) {
    throw new Error('CRM capability scope does not match the selected business, project, and site.');
  }

  const resolvedSiteId = scope.siteId ?? projectResult.data.site_id ?? undefined;
  if (scope.siteId && projectResult.data.site_id !== scope.siteId) {
    throw new Error('CRM capability scope does not match the selected business, project, and site.');
  }
  if (!resolvedSiteId) return [];

  const siteCapabilitiesResult = await supabase.from('site_capabilities')
    .select('capability_id,status,configuration')
    .eq('site_id', resolvedSiteId);
  if (siteCapabilitiesResult.error) throw siteCapabilitiesResult.error;
  const { data: site, error: siteError } = await supabase.from('sites')
    .select('id,business_id')
    .eq('id', resolvedSiteId)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site || site.business_id !== scope.businessId) {
    throw new Error('CRM capability scope does not match the selected business, project, and site.');
  }
  return resolveInstalledSiteCapabilities((siteCapabilitiesResult.data ?? []) as SiteCapabilityRow[]);
}

export function getCRMNavigationItems(installedCapabilities: readonly string[]): CRMNavigationItem[] {
  const installed = new Set(installedCapabilities);
  const { order } = resolveCapabilityPacks([...installed].filter((id): id is BusinessCapability => KNOWN_PACKS.has(id)));
  for (const pack of order) {
    installed.add(pack.id);
    for (const provided of pack.provides) installed.add(provided);
  }
  return CRM_NAVIGATION_ITEMS.filter((item) =>
    !item.requiredCapabilities || item.requiredCapabilities.some((capability) => installed.has(capability)));
}

export function isCRMViewAvailable(view: CRMView, installedCapabilities: readonly string[]): boolean {
  return getCRMNavigationItems(installedCapabilities).some((item) => item.id === view);
}

export function resolveVisibleCRMView(view: CRMView, installedCapabilities: readonly string[]): CRMView {
  return isCRMViewAvailable(view, installedCapabilities) ? view : 'overview';
}