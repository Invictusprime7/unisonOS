import { getIndustryProfile } from './industryMatrix';

export type OwnerInterviewFieldId =
  | 'ownerEmail'
  | 'publicEmail'
  | 'phone'
  | 'website'
  | 'address'
  | 'hours'
  | 'notificationPhone';

export interface OwnerInterviewQuestion {
  fieldId: OwnerInterviewFieldId;
  visibility: 'public' | 'private';
  requiredAt?: 'design' | 'configure' | 'activate';
  capabilityDependency?: 'notifications.email' | 'booking';
}

const SHARED_QUESTIONS: OwnerInterviewQuestion[] = [
  { fieldId: 'ownerEmail', visibility: 'private', requiredAt: 'activate', capabilityDependency: 'notifications.email' },
  { fieldId: 'publicEmail', visibility: 'public' },
  { fieldId: 'website', visibility: 'public' },
];

const INDUSTRY_QUESTIONS: Record<string, OwnerInterviewQuestion[]> = {
  salon: [
    { fieldId: 'phone', visibility: 'public', requiredAt: 'configure' },
    { fieldId: 'address', visibility: 'public', requiredAt: 'configure' },
    { fieldId: 'hours', visibility: 'public', requiredAt: 'activate', capabilityDependency: 'booking' },
    { fieldId: 'notificationPhone', visibility: 'private', capabilityDependency: 'booking' },
  ],
  restaurant: [
    { fieldId: 'phone', visibility: 'public', requiredAt: 'configure' },
    { fieldId: 'address', visibility: 'public', requiredAt: 'configure' },
    { fieldId: 'hours', visibility: 'public', requiredAt: 'activate', capabilityDependency: 'booking' },
    { fieldId: 'notificationPhone', visibility: 'private', capabilityDependency: 'booking' },
  ],
  'local-service': [
    { fieldId: 'phone', visibility: 'public', requiredAt: 'activate' },
    { fieldId: 'notificationPhone', visibility: 'private', capabilityDependency: 'booking' },
  ],
  coaching: [{ fieldId: 'phone', visibility: 'public' }],
  'real-estate': [{ fieldId: 'phone', visibility: 'public' }],
  ecommerce: [],
  portfolio: [],
  agency: [],
  saas: [],
  nonprofit: [],
};

const BOOKING_GOALS = new Set(['book_appointments', 'reserve_table', 'order_online']);

export function getOwnerInterviewQuestions(
  industry: string,
  primaryGoal?: string | null,
): OwnerInterviewQuestion[] {
  const canonicalIndustry = getIndustryProfile(industry)?.industry;
  if (!canonicalIndustry) return [];

  const questions = [...SHARED_QUESTIONS, ...(INDUSTRY_QUESTIONS[canonicalIndustry] ?? [])];
  if (!BOOKING_GOALS.has(primaryGoal ?? '')) {
    return questions.filter((question) => question.capabilityDependency !== 'booking');
  }
  return questions;
}