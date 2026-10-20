import { describe, expect, it } from 'vitest';
import { naturalLanguageEventLabel, naturalLanguageRecordLabel } from '@/services/resources/recordIdentity';

describe('natural-language record identity labels', () => {
  it('prefers names over external identifiers', () => {
    expect(naturalLanguageRecordLabel({ contactId: 'loc_9k3m2', firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('reads a nested contact name without exposing opaque IDs', () => {
    expect(naturalLanguageRecordLabel({ id: '01f4a9e8-4afe-4a77-8d06-9d3afc01e973', contact: { contact_id: 'ghl_123', name: 'Grace Hopper' } })).toBe('Grace Hopper');
  });

  it('uses a readable fallback when the record has no human label', () => {
    expect(naturalLanguageRecordLabel({ id: 'ghl_123' }, 'Contact')).toBe('Contact');
  });

  it('normalizes provider event tokens for display', () => {
    expect(naturalLanguageEventLabel('contact.test_webhook')).toBe('Test webhook received');
    expect(naturalLanguageEventLabel('OpportunityStageChange')).toBe('Opportunity stage changed');
    expect(naturalLanguageEventLabel('invoice.payment_failed')).toBe('Invoice payment failed');
  });
});