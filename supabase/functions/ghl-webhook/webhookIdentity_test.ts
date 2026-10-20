import { isUnresolvedGhlIdentifier } from './webhookIdentity.ts';

Deno.test('rejects unresolved GoHighLevel merge fields and template placeholders', () => {
  for (const value of ['{contact.email}', '{{contact.id}}', 'REPLACE_WITH_CONTACT_ID']) {
    if (!isUnresolvedGhlIdentifier(value)) {
      throw new Error(`Expected unresolved identifier to be rejected: ${value}`);
    }
  }
});

Deno.test('accepts resolved provider identifiers', () => {
  for (const value of ['contact_abc123', 'loc_12345', '9d7ce7f2-9a2b-4d5f-8a5c-8b1179a83f44']) {
    if (isUnresolvedGhlIdentifier(value)) {
      throw new Error(`Expected resolved identifier to be accepted: ${value}`);
    }
  }
});