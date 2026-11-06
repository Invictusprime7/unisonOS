/**
 * BusinessBlueprint — The full capability-aware business operating contract
 * 
 * This is the structured output from SystemsAI.
 * It replaces loose prompt text with a deterministic object that drives
 * the entire provisioning pipeline:
 * 
 *   SystemAI → BusinessBlueprint → ContractCompiler → SiteBundle
 * 
 * The blueprint is the "what" (capabilities, pages, intents).
 * The SiteBundle is the "how" (sections, code, bindings, runtime).
 */

import type { CapabilityId } from './capabilityRegistry';
import type { CoreIntent } from './coreIntents';
import type { BusinessSystemType } from '@/data/templates/types';
import type { UniversalCreationInput } from './universalCreation';

// ============================================================================
// Blueprint
// ============================================================================

export interface BusinessBlueprint {
  /** Schema version for safe migrations */
  version: '1.0.0';

  /** Origin metadata */
  origin: {
    /** How was this blueprint created? */
    mode: 'systems_ai' | 'template_select' | 'manual' | 'open-ended';
    /** Original user prompt (if AI-generated) */
    prompt?: string;
    /** Timestamp of creation */
    createdAt: string;
  };

  /** Business identity */
  identity: {
    businessName: string;
    industry: string;
    /** Canonical system type for backend provisioning */
    systemType: BusinessSystemType;
    locale?: string;
    tagline?: string;
  };

  /** Capability set — drives provisioning */
  capabilities: {
    /** Capabilities enabled for this business */
    enabled: CapabilityId[];
    /** Primary goal drives CTA defaults and hero messaging */
    primaryGoal: 'none' | 'leads' | 'bookings' | 'sales' | 'newsletter' | 'donations';
  };

  /** Intent contract — canonical intents this site is allowed to emit */
  intents: {
    /** All allowed intents (derived from capabilities) */
    allowed: CoreIntent[];
    /** Primary CTA intent (used for hero, navbar CTA) */
    primaryCta: CoreIntent;
    /** Secondary CTA intent (used for secondary buttons) */
    secondaryCta?: CoreIntent;
  };

  /** Page map — deterministic page structure */
  pages: BlueprintPage[];

  /** Brand direction (can be AI-generated or user-provided) */
  brand: {
    tone?: 'luxury' | 'minimal' | 'bold' | 'playful' | 'corporate' | 'editorial' | 'tech';
    colorPreference?: string;
    typographyPreference?: string;
  };

  /** CRM pipeline configuration */
  crm: {
    pipelineName: string;
    stages: string[];
    defaultStage: string;
  };

  /** Automation pack to install */
  automationPack: string;

  /** Contact/business information for seed data */
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
    socials?: Record<string, string>;
  };

  /** Seed data for template generation */
  seedData?: Record<string, unknown>;
}

export interface BlueprintPage {
  title: string;
  path: string;
  purpose: 'landing' | 'services' | 'portfolio' | 'contact' | 'about' | 'blog' | 'shop' | 'checkout' | 'booking' | 'pricing' | 'faq' | 'immersive';
  isHome?: boolean;
  /** Expected section types (for validation) */
  expectedSections: string[];
}

// ============================================================================
// Blueprint Builder — Creates blueprint from industry profile + user input
// ============================================================================

import { getIndustryProfile, type IndustryProfile } from './industryMatrix';
import { getAllowedIntents } from './capabilityRegistry';

/**
 * Generate a BusinessBlueprint from an industry selection.
 * This is the deterministic path — no AI needed.
 */
export function createBlueprintFromIndustry(
  industry: string,
  businessName: string,
  options?: {
    prompt?: string;
    email?: string;
    phone?: string;
    additionalCapabilities?: CapabilityId[];
    tone?: BusinessBlueprint['brand']['tone'];
  }
): BusinessBlueprint {
  const profile = getIndustryProfile(industry);
  if (!profile) {
    throw new Error(`Unknown industry: "${industry}"`);
  }

  const capabilities = [
    ...profile.defaultCapabilities,
    ...(options?.additionalCapabilities || []),
  ].filter((v, i, a) => a.indexOf(v) === i) as CapabilityId[];

  const allowedIntents = getAllowedIntents(capabilities);

  return {
    version: '1.0.0',
    origin: {
      mode: options?.prompt ? 'systems_ai' : 'template_select',
      prompt: options?.prompt,
      createdAt: new Date().toISOString(),
    },
    identity: {
      businessName,
      industry: profile.industry,
      systemType: profile.systemType,
      tagline: undefined,
    },
    capabilities: {
      enabled: capabilities,
      primaryGoal: inferPrimaryGoal(profile),
    },
    intents: {
      allowed: allowedIntents,
      primaryCta: profile.primaryIntent,
      secondaryCta: allowedIntents.find(i => i !== profile.primaryIntent && i !== 'newsletter.subscribe'),
    },
    pages: profile.defaultPages.map(p => ({
      ...p,
      isHome: p.path === '/',
    })),
    brand: {
      tone: options?.tone,
    },
    crm: {
      pipelineName: profile.crmPipeline.name,
      stages: profile.crmPipeline.stages,
      defaultStage: profile.crmPipeline.defaultStage,
    },
    automationPack: profile.automationPack,
    contact: {
      email: options?.email,
      phone: options?.phone,
    },
  };
}

export function createBlueprintFromUniversalCreation(input: {
  creation: UniversalCreationInput;
  businessName: string;
  systemType: BusinessSystemType;
  email?: string;
}): BusinessBlueprint {
  const purposeByRole: Record<string, BlueprintPage['purpose']> = {
    home: 'landing', about: 'about', services: 'services', pricing: 'pricing',
    gallery: 'portfolio', faq: 'faq', contact: 'contact', booking: 'booking',
    checkout: 'checkout', blog: 'blog', shop: 'shop', immersive: 'immersive',
  };
  const pages = input.creation.pages.map((page) => ({
    title: page.title,
    path: page.route,
    purpose: purposeByRole[page.suggestedRole ?? ''] ?? 'landing',
    isHome: page.route === '/',
    expectedSections: [],
  }));
  if (!pages.some((page) => page.path === '/')) {
    pages.unshift({ title: 'Home', path: '/', purpose: 'landing', isHome: true, expectedSections: [] });
  }
  return {
    version: '1.0.0',
    origin: { mode: 'open-ended', prompt: input.creation.originalPrompt, createdAt: new Date().toISOString() },
    identity: { businessName: input.businessName, industry: 'general', systemType: input.systemType },
    capabilities: { enabled: [], primaryGoal: 'none' },
    intents: { allowed: ['nav.goto'], primaryCta: 'nav.goto' },
    pages,
    brand: { colorPreference: input.creation.visualRequirements.join('; ') || undefined },
    crm: { pipelineName: '', stages: [], defaultStage: '' },
    automationPack: '',
    contact: { email: input.email },
  };
}

function inferPrimaryGoal(profile: IndustryProfile): BusinessBlueprint['capabilities']['primaryGoal'] {
  if (profile.defaultCapabilities.includes('booking')) return 'bookings';
  if (profile.defaultCapabilities.includes('commerce')) return 'sales';
  if (profile.defaultCapabilities.includes('donation')) return 'donations';
  if (profile.defaultCapabilities.includes('quoting') || profile.defaultCapabilities.includes('lead-capture')) return 'leads';
  return 'newsletter';
}
