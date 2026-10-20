/**
 * businessProfileService — the ONLY read/write path for BusinessProfileDTO.
 *
 * Load → hydrate `businesses` row into a normalised DTO.
 * Save → validate + patch → RLS enforces member-only writes.
 * Score → wraps scoreProfileCompleteness for callers.
 *
 * Downstream consumers (site runtime, Web Builder context strip, readiness
 * gate, catalog attach) MUST go through this module — no direct
 * `supabase.from('businesses')` calls in feature code.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  type BusinessProfileDTO,
  type BusinessAddress,
  type BusinessHoursEntry,
  type BusinessSocialLinks,
  type ProfileCompletenessReport,
  scoreProfileCompleteness,
} from '@/types/businessProfile';

interface BusinessRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  brand_color: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  notification_email: string | null;
  notification_phone: string | null;
  timezone: string;
  address: unknown;
  hours: unknown;
  social_links: unknown;
  settings: unknown;
  updated_at: string;
}

function asObject<T extends object>(v: unknown, fallback: T): T {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : fallback;
}
function asArray<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

export function rowToProfile(row: BusinessRow): BusinessProfileDTO {
  return {
    businessId: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    tagline: row.tagline,
    description: row.description,
    logoUrl: row.logo_url,
    brandColor: row.brand_color,
    website: row.website,
    phone: row.phone,
    email: row.email,
    notificationEmail: row.notification_email,
    notificationPhone: row.notification_phone,
    timezone: row.timezone ?? 'UTC',
    address: asObject<BusinessAddress>(row.address, {}),
    hours: asArray<BusinessHoursEntry>(row.hours, []),
    socialLinks: asObject<BusinessSocialLinks>(row.social_links, {}),
    settings: asObject<Record<string, unknown>>(row.settings, {}),
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS =
  'id, owner_id, name, slug, industry, tagline, description, logo_url, brand_color, website, phone, email, notification_email, notification_phone, timezone, address, hours, social_links, settings, updated_at';

export async function loadBusinessProfile(
  businessId: string,
): Promise<BusinessProfileDTO | null> {
  if (!businessId) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select(SELECT_COLS)
    .eq('id', businessId)
    .maybeSingle();
  if (error) {
    console.warn('[businessProfileService] load failed', error);
    return null;
  }
  if (!data) return null;
  return rowToProfile(data as unknown as BusinessRow);
}

export async function loadBusinessProfileBySlug(
  slug: string,
): Promise<BusinessProfileDTO | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('businesses')
    .select(SELECT_COLS)
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return rowToProfile(data as unknown as BusinessRow);
}

export type BusinessProfilePatch = Partial<
  Omit<BusinessProfileDTO, 'businessId' | 'ownerId' | 'updatedAt'>
>;

function profilePatchToRow(patch: BusinessProfilePatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('name' in patch) row.name = patch.name;
  if ('slug' in patch) row.slug = patch.slug;
  if ('industry' in patch) row.industry = patch.industry;
  if ('tagline' in patch) row.tagline = patch.tagline;
  if ('description' in patch) row.description = patch.description;
  if ('logoUrl' in patch) row.logo_url = patch.logoUrl;
  if ('brandColor' in patch) row.brand_color = patch.brandColor;
  if ('website' in patch) row.website = patch.website;
  if ('phone' in patch) row.phone = patch.phone;
  if ('email' in patch) row.email = patch.email;
  if ('notificationEmail' in patch) row.notification_email = patch.notificationEmail;
  if ('notificationPhone' in patch) row.notification_phone = patch.notificationPhone;
  if ('timezone' in patch) row.timezone = patch.timezone;
  if ('address' in patch) row.address = patch.address ?? {};
  if ('hours' in patch) row.hours = patch.hours ?? [];
  if ('socialLinks' in patch) row.social_links = patch.socialLinks ?? {};
  if ('settings' in patch) row.settings = patch.settings ?? {};
  return row;
}

export async function saveBusinessProfile(
  businessId: string,
  patch: BusinessProfilePatch,
): Promise<BusinessProfileDTO | null> {
  if (!businessId) return null;
  const row = profilePatchToRow(patch);
  if (Object.keys(row).length === 0) return loadBusinessProfile(businessId);
  // Writes go through the business command gateway, which enforces the
  // business.profile.write permission and the editable-field allow-list.
  const { error } = await (supabase.rpc as any)('business_apply_profile_command', {
    p_business_id: businessId,
    p_patch: row,
  });
  if (error) {
    console.warn('[businessProfileService] save failed', error);
    throw new Error(error.message || 'Your business details could not be saved.');
  }
  return loadBusinessProfile(businessId);
}

export function scoreProfile(profile: BusinessProfileDTO): ProfileCompletenessReport {
  return scoreProfileCompleteness(profile);
}

// ── Guidebook §15 / §43: account identity vs. per-site profile ──────────────
/** Fields owned by the business account; never overridden per site. */
export const ACCOUNT_IDENTITY_FIELDS = [
  'name', 'slug', 'industry', 'timezone', 'notificationEmail', 'notificationPhone', 'settings',
] as const;
/** Fields a site may present differently from the account. */
export const SITE_PROFILE_FIELDS = [
  'tagline', 'description', 'logoUrl', 'brandColor', 'website', 'phone', 'email', 'address', 'hours', 'socialLinks',
] as const;
type SiteField = typeof SITE_PROFILE_FIELDS[number];

export function splitProfilePatch(patch: BusinessProfilePatch) {
  const account: BusinessProfilePatch = {};
  const site: Partial<Pick<BusinessProfileDTO, SiteField>> = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((SITE_PROFILE_FIELDS as readonly string[]).includes(k)) (site as Record<string, unknown>)[k] = v;
    else (account as Record<string, unknown>)[k] = v;
  }
  return { account, site };
}

export function mergeSiteProfile(base: BusinessProfileDTO, overrides: unknown): BusinessProfileDTO {
  const o = asObject<Record<string, unknown>>(overrides, {});
  const merged = { ...base } as Record<string, unknown>;
  for (const f of SITE_PROFILE_FIELDS) if (f in o) merged[f] = o[f];
  return merged as unknown as BusinessProfileDTO;
}

/** Account identity merged with this site's own profile overrides. */
export async function loadSiteProfile(businessId: string, projectId?: string | null): Promise<BusinessProfileDTO | null> {
  const base = await loadBusinessProfile(businessId);
  if (!base || !projectId) return base;
  const { data } = await supabase.from('site_profiles').select('overrides').eq('project_id', projectId).maybeSingle();
  return data ? mergeSiteProfile(base, data.overrides) : base;
}

/** Account fields → permission-checked business command; site fields → this site only. */
export async function saveSiteProfile(
  businessId: string, projectId: string | null | undefined, patch: BusinessProfilePatch,
): Promise<BusinessProfileDTO | null> {
  if (!projectId) return saveBusinessProfile(businessId, patch);
  const { account, site } = splitProfilePatch(patch);
  if (Object.keys(account).length) await saveBusinessProfile(businessId, account);
  if (Object.keys(site).length) {
    const { data: cur } = await supabase.from('site_profiles').select('overrides').eq('project_id', projectId).maybeSingle();
    const overrides = { ...asObject<Record<string, unknown>>(cur?.overrides, {}), ...site };
    const { error } = await supabase.from('site_profiles')
      .upsert({ project_id: projectId, business_id: businessId, overrides: overrides as never }, { onConflict: 'project_id' });
    if (error) throw new Error(error.message || 'This site’s details could not be saved.');
  }
  return loadSiteProfile(businessId, projectId);
}
