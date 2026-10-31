import { unsupportedIntentResult } from './unsupportedIntent.ts';

for (const intent of ['demo.request', 'consultation.request', 'proposal.request', 'coupon.claim', 'volunteer.signup', 'unknown.action']) {
  Deno.test(`${intent} without a configured writer cannot claim success`, () => {
    const result = unsupportedIntentResult(intent);
    if (result.ok !== false || result.result.intentId !== intent || result.clientActions.some(action => action.level !== 'error')) {
      throw new Error('Unconfigured intent was acknowledged as successful');
    }
  });
}