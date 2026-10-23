import { describe, expect, it } from 'vitest';
import { getOwnerInterviewQuestions } from '@/platform/core/ownerInterviewRegistry';

describe('industry owner interview registry', () => {
  it('classifies owner routing as private and public facts separately', () => {
    const questions = getOwnerInterviewQuestions('barber', 'book_appointments');
    const byField = new Map(questions.map((question) => [question.fieldId, question]));

    expect(byField.get('ownerEmail')).toMatchObject({ visibility: 'private', requiredAt: 'activate' });
    expect(byField.get('publicEmail')).toMatchObject({ visibility: 'public' });
    expect(byField.get('phone')).toMatchObject({ visibility: 'public', requiredAt: 'configure' });
    expect(byField.get('notificationPhone')).toMatchObject({ visibility: 'private', capabilityDependency: 'booking' });
  });

  it('only asks for address and hours for relevant local journeys', () => {
    const salonFields = getOwnerInterviewQuestions('salon', 'book_appointments').map((question) => question.fieldId);
    expect(salonFields).toContain('address');
    expect(salonFields).toContain('hours');

    const ecommerceFields = getOwnerInterviewQuestions('ecommerce', 'order_online').map((question) => question.fieldId);
    expect(ecommerceFields).not.toContain('address');
    expect(ecommerceFields).not.toContain('hours');
    expect(getOwnerInterviewQuestions('salon', 'collect_leads').map((question) => question.fieldId)).not.toContain('hours');
    expect(getOwnerInterviewQuestions('unknown-industry')).toEqual([]);
  });
});