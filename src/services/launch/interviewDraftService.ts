import type { BusinessSystemType } from '@/data/templates/types';
import type { BusinessAddress } from '@/types/businessProfile';
import type { CustomerNeed, PageChoice, PrimaryGoal } from '@/components/onboarding/wizard/wizardCatalog';

const DRAFT_VERSION = 1;
const memoryDrafts = new Map<string, LaunchInterviewDraft>();

export interface LaunchInterviewDraft {
  version: typeof DRAFT_VERSION;
  revision: number;
  updatedAt: string;
  selections: {
    industry: string | null;
    systemId: BusinessSystemType | null;
    businessName: string;
    primaryGoal: PrimaryGoal | null;
    customerNeeds: CustomerNeed[];
    selectedPages: PageChoice[];
    themePresetId: string | null;
    experience: 'standard' | 'motion-rich' | 'immersive';
    sectionPins: Record<string, string>;
    socialLinks: Record<string, string>;
  };
  publicAnswers: {
    publicEmail?: string;
    phone?: string;
    website?: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    brandColor?: string;
    timezone?: string;
    address?: BusinessAddress;
    hours?: Array<{ day: string; open?: string; close?: string; closed?: boolean }>;
  };
  privateAnswers: {
    ownerEmail?: string;
    notificationEmail?: string;
    notificationPhone?: string;
  };
}

export type LaunchInterviewDraftInput = Omit<LaunchInterviewDraft, 'version' | 'revision' | 'updatedAt'>;

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function launchInterviewDraftKey(scope: string): string {
  return `unison.launch-interview.v${DRAFT_VERSION}.${encodeURIComponent(scope)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isQuotaExceededError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object'
    && 'name' in error
    && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'));
}

function isDraft(value: unknown): value is LaunchInterviewDraft {
  if (!isRecord(value) || value.version !== DRAFT_VERSION || !Number.isInteger(value.revision)) return false;
  const selections = value.selections;
  return isRecord(selections)
    && (selections.industry === null || typeof selections.industry === 'string')
    && (selections.systemId === null || typeof selections.systemId === 'string')
    && typeof selections.businessName === 'string'
    && (selections.primaryGoal === null || typeof selections.primaryGoal === 'string')
    && Array.isArray(selections.customerNeeds)
    && Array.isArray(selections.selectedPages)
    && (selections.themePresetId === null || typeof selections.themePresetId === 'string')
    && isRecord(selections.sectionPins)
    && isRecord(selections.socialLinks)
    && isRecord(value.publicAnswers)
    && isRecord(value.privateAnswers)
    && typeof value.updatedAt === 'string';
}

export function readLaunchInterviewDraft(
  scope: string,
  storage: Pick<Storage, 'getItem'> | null = getStorage(),
): LaunchInterviewDraft | null {
  const memoryDraft = memoryDrafts.get(scope) ?? null;
  if (!storage) return memoryDraft;
  try {
    const raw = storage.getItem(launchInterviewDraftKey(scope));
    if (!raw) return memoryDraft;
    const parsed: unknown = JSON.parse(raw);
    const storedDraft = isDraft(parsed) ? parsed : null;
    if (memoryDraft && (!storedDraft || memoryDraft.revision > storedDraft.revision)) return memoryDraft;
    if (storedDraft) memoryDrafts.delete(scope);
    return storedDraft;
  } catch {
    return memoryDraft;
  }
}

export function saveLaunchInterviewDraft(
  scope: string,
  draft: LaunchInterviewDraftInput,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = getStorage(),
): LaunchInterviewDraft {
  const previous = readLaunchInterviewDraft(scope, storage);
  const next: LaunchInterviewDraft = {
    ...draft,
    version: DRAFT_VERSION,
    revision: (previous?.revision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  const key = launchInterviewDraftKey(scope);
  const serialized = JSON.stringify(next);
  if (!storage) {
    memoryDrafts.set(scope, next);
    return next;
  }
  try {
    storage.setItem(key, serialized);
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    try {
      storage.removeItem(key);
      storage.setItem(key, serialized);
    } catch (retryError) {
      if (!isQuotaExceededError(retryError)) throw retryError;
      memoryDrafts.set(scope, next);
      return next;
    }
  }
  memoryDrafts.delete(scope);
  return next;
}

export function clearLaunchInterviewDraft(
  scope: string,
  storage: Pick<Storage, 'removeItem'> | null = getStorage(),
): void {
  memoryDrafts.delete(scope);
  storage?.removeItem(launchInterviewDraftKey(scope));
}