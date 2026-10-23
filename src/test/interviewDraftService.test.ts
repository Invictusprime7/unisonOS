import { describe, expect, it } from 'vitest';
import {
  clearLaunchInterviewDraft,
  launchInterviewDraftKey,
  readLaunchInterviewDraft,
  saveLaunchInterviewDraft,
  type LaunchInterviewDraftInput,
} from '@/services/launch/interviewDraftService';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

const draft: LaunchInterviewDraftInput = {
  selections: {
    industry: 'salon',
    systemId: 'booking',
    businessName: 'Studio Glow',
    primaryGoal: 'book_appointments',
    customerNeeds: ['book_service'],
    selectedPages: ['booking'],
    themePresetId: 'editorial',
    experience: 'standard',
    sectionPins: {},
    socialLinks: {},
  },
  publicAnswers: { publicEmail: 'hello@example.test' },
  privateAnswers: { ownerEmail: 'owner@example.test', notificationEmail: 'owner@example.test' },
};

describe('launch interview draft persistence', () => {
  it('round-trips versioned structured answers and keeps private routing separate', () => {
    const storage = createMemoryStorage();
    const saved = saveLaunchInterviewDraft('user-1', draft, storage);

    expect(saved.version).toBe(1);
    expect(saved.revision).toBe(1);
    expect(readLaunchInterviewDraft('user-1', storage)).toEqual(saved);
    expect(saved.publicAnswers).not.toHaveProperty('ownerEmail');
    expect(saved.privateAnswers.ownerEmail).toBe('owner@example.test');
  });

  it('isolates drafts by account and increments revisions when the same draft changes', () => {
    const storage = createMemoryStorage();
    const first = saveLaunchInterviewDraft('user-1', draft, storage);
    const second = saveLaunchInterviewDraft('user-1', draft, storage);

    expect(second.revision).toBe(first.revision + 1);
    expect(readLaunchInterviewDraft('user-2', storage)).toBeNull();
    expect(launchInterviewDraftKey('user-1')).not.toBe(launchInterviewDraftKey('user-2'));
  });

  it('keeps the latest scoped draft in memory when storage quota is exceeded', () => {
    const storage = createMemoryStorage();
    storage.setItem = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    };

    const first = saveLaunchInterviewDraft('user-1', draft, storage);
    const second = saveLaunchInterviewDraft('user-1', draft, storage);

    expect(second.revision).toBe(first.revision + 1);
    expect(readLaunchInterviewDraft('user-1', storage)).toEqual(second);
    expect(readLaunchInterviewDraft('user-2', storage)).toBeNull();
    clearLaunchInterviewDraft('user-1', storage);
  });

  it('ignores malformed state and can clear a completed launch draft', () => {
    const storage = createMemoryStorage();
    storage.setItem(launchInterviewDraftKey('user-1'), '{bad json');
    expect(readLaunchInterviewDraft('user-1', storage)).toBeNull();

    saveLaunchInterviewDraft('user-1', draft, storage);
    clearLaunchInterviewDraft('user-1', storage);
    expect(readLaunchInterviewDraft('user-1', storage)).toBeNull();
  });
});