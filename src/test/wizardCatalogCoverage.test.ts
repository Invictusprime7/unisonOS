import { describe, expect, it } from 'vitest';
import { getCompositionById } from '@/sections/templates';
import {
  buildCompositionCards,
  getIndustryPrimaryGoal,
  getDefaultTemplateCardFor,
  INDUSTRY_CARDS,
  PRIMARY_GOALS,
} from '@/components/onboarding/wizard/wizardCatalog';
import { resolveLaunchBusinessCapabilities, resolveLaunchCapabilities } from '@/services/launch/launchCapabilities';

describe('Wizard catalog coverage', () => {
  it('backs every visible business system with registered compositions', () => {
    for (const industry of INDUSTRY_CARDS) {
      const cards = buildCompositionCards(industry.systemId);
      const defaultCard = getDefaultTemplateCardFor(industry.systemId);

      expect(cards.length, industry.systemId).toBeGreaterThan(0);
      expect(defaultCard, industry.systemId).not.toBeNull();
      expect(getCompositionById(defaultCard!.id), industry.systemId).toBeTruthy();
    }
  });

  it('provides Content & Media with newsletter and contact actions', () => {
    const content = getDefaultTemplateCardFor('content');
    const composition = content ? getCompositionById(content.id) : undefined;
    const serialized = JSON.stringify(composition?.sections ?? []);

    expect(content?.id).toBe('nonprofit-premium');
    expect(serialized).toContain('newsletter.subscribe');
    expect(serialized).toContain('contact.submit');
  });

  it('keeps nonprofit donations distinct from newsletter signup', () => {
    expect(getIndustryPrimaryGoal('nonprofit')).toBe('donate');
    expect(PRIMARY_GOALS.some((goal) => goal.id === 'donate')).toBe(true);
    expect(resolveLaunchCapabilities([], 'nonprofit', { primaryGoal: 'donate' })).toContain('donation');
    expect(resolveLaunchBusinessCapabilities({ primaryGoal: 'donate' })).toEqual(
      expect.arrayContaining(['commerce.checkout', 'crm.contacts', 'notifications.email']),
    );
  });
});