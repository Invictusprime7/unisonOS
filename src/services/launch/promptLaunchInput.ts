/**
 * Prompt-first launch input (UPG-01).
 *
 * The chat is the only new-project creation surface. This adapter turns the
 * confirmed conversation into the existing `runLaunchPipeline` input with zero
 * guided selections: page topology, capabilities and visual hints are inferred
 * from the prompt, and every inferred value is a revisable default rather than
 * a creative constraint. It owns no state, writes nothing, and never authors a
 * page — the canonical launch orchestrator and App Builder do that.
 */

import { THEME_PRESETS, type ThemePreset } from '@/components/onboarding/themePresets';
import {
  buildSyncedVisionBrief,
  deriveChatLaunchPlan,
  projectUniversalCreationInput,
  type ChatLaunchPlan,
} from '@/services/launch/chatLaunchPlan';
import type { LaunchOrchestratorInput } from '@/services/launch/launchOrchestrator';
import type { AppBuildGenerationMode } from '@/services/app-builder/appBuilderContracts';
import { createWizardDesignSelection, type WizardExperiencePreference } from '@/services/wizardDesignSelection';

/** Optional saved business details that pre-fill public/contact parameters. */
export interface PromptLaunchPrefill {
  businessId?: string | null;
  businessName?: string | null;
  notificationEmail?: string | null;
  email?: string | null;
  phone?: string | null;
  socialLinks?: Record<string, string> | null;
}

export interface PromptLaunchOptions {
  generationMode?: AppBuildGenerationMode;
  demoGeneration?: boolean;
  regenerationNonce?: string | null;
  prefill?: PromptLaunchPrefill | null;
}

export interface PromptLaunchInput {
  input: LaunchOrchestratorInput;
  plan: ChatLaunchPlan;
}

const MOTION_RICH = /\b(motion|animat(?:e|ed|ion|ions)|cinematic|parallax|scroll[- ]?driven|kinetic)\b/i;
const IMMERSIVE = /\b(3d|three\.?js|webgl|immersive|interactive (?:3d|world|scene))\b/i;

/** Experience budget inferred from the prompt; a default, never a ceiling. */
export function inferPromptExperience(prompt: string): WizardExperiencePreference {
  if (IMMERSIVE.test(prompt)) return 'immersive';
  if (MOTION_RICH.test(prompt)) return 'motion-rich';
  return 'standard';
}

const LEADING_REQUEST = /^(?:hi|hello|hey)?[,!.\s]*(?:please\s+)?(?:i(?:'d| would)? (?:like|want|need)(?: to)?|help me|can you|could you|let's|lets)?\s*(?:create|build|make|design|launch|start|get)?\s*(?:me\s+)?(?:a|an|the|my)?\s*/i;

/**
 * Revisable site name: an explicitly stated name wins, then saved business
 * details, then a short title derived from the prompt's subject.
 */
export function inferPromptSiteName(plan: ChatLaunchPlan, prefillName?: string | null): string {
  const stated = plan.businessName?.trim();
  if (stated) return stated;
  const prompt = plan.creationInput.originalPrompt;
  const named = prompt.match(/\b(?:called|named|brand(?:ed)? as)\s+["“']?([A-Z0-9][\w&'’ .-]{1,48}?)["”']?(?=[,.;!?\n]|$|\s+(?:for|with|that|which|and)\b)/);
  if (named?.[1]?.trim()) return named[1].trim();
  const quoted = prompt.match(/["“]([^"”\n]{2,48})["”]/);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  if (prefillName?.trim()) return prefillName.trim();
  const subject = plan.creationInput.subject.replace(LEADING_REQUEST, '').replace(/\s+/g, ' ').trim();
  const words = subject.split(' ').filter(Boolean).slice(0, 5).join(' ').replace(/[,:;.!?]+$/, '');
  if (!words) return 'My Site';
  return words.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 48);
}

function resolveTheme(plan: ChatLaunchPlan): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === plan.themePresetId) ?? THEME_PRESETS[0];
}

/** Build the canonical launch input from the confirmed chat brief alone. */
export function buildPromptLaunchInput(prompt: string, options: PromptLaunchOptions = {}): PromptLaunchInput {
  const plan = deriveChatLaunchPlan(prompt, { promptFirst: true });
  if (!plan.creationInput.originalPrompt.trim()) {
    throw new Error('Describe the site you want to create.');
  }
  const prefill = options.prefill ?? null;
  const businessName = inferPromptSiteName(plan, prefill?.businessName);
  const theme = resolveTheme(plan);
  const socialLinks = { ...(prefill?.socialLinks ?? {}) };
  const phone = prefill?.phone?.trim() || undefined;
  const publicEmail = prefill?.email?.trim() || undefined;
  const ownerEmail = prefill?.notificationEmail?.trim() || undefined;
  const input: LaunchOrchestratorInput = {
    generationMode: options.generationMode ?? 'ai',
    demoGeneration: options.demoGeneration,
    systemId: 'content',
    industry: 'universal',
    visionPrompt: buildSyncedVisionBrief(plan, {
      industry: null,
      businessName,
      primaryGoal: null,
      selectedPages: plan.selectedPages,
      themePresetId: theme.id,
    }),
    universalCreation: projectUniversalCreationInput(plan, plan.selectedPages, { promptFirst: true }),
    theme,
    designSelection: createWizardDesignSelection({
      mode: 'auto',
      experience: inferPromptExperience(plan.creationInput.originalPrompt),
    }),
    businessName,
    businessParameters: {
      ownerEmail,
      notificationEmail: ownerEmail,
      publicEmail,
      phone,
      ctaDestinations: {
        call: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined,
        email: publicEmail ? `mailto:${publicEmail}` : undefined,
      },
      socialLinks,
    },
    primaryGoal: null,
    customerNeeds: [],
    selectedPages: plan.selectedPages,
    socialLinks,
    existingBusinessId: prefill?.businessId ?? null,
    regenerationNonce: options.regenerationNonce ?? null,
  };
  return { input, plan };
}
