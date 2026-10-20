type LabelRecord = Record<string, unknown>;

function objectRecord(value: unknown): LabelRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LabelRecord
    : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 120) : null;
}

/** Produces a user-facing label without exposing opaque row or provider IDs. */
export function naturalLanguageRecordLabel(value: unknown, fallback = 'Unnamed record'): string {
  const record = objectRecord(value);
  if (!record) return fallback;

  const sources = [record, objectRecord(record.contact)].filter((source): source is LabelRecord => Boolean(source));
  for (const source of sources) {
    const firstName = text(source.firstName ?? source.first_name);
    const lastName = text(source.lastName ?? source.last_name);
    const personName = [firstName, lastName].filter(Boolean).join(' ');
    if (personName) return personName;
  }

  for (const source of sources) {
    for (const key of ['fullName', 'full_name', 'contactName', 'contact_name', 'name', 'title', 'question', 'label', 'slug']) {
      const label = text(source[key]);
      if (label) return label;
    }
  }

  return fallback;
}

/** Converts provider event tokens to readable labels while preserving their meaning. */
export function naturalLanguageEventLabel(value: string): string {
  const knownLabels: Record<string, string> = {
    'contact.test_webhook': 'Test webhook received',
    ContactCreate: 'Contact created',
    'contact.create': 'Contact created',
    OpportunityStageChange: 'Opportunity stage changed',
    'opportunity.stage.change': 'Opportunity stage changed',
    WorkflowFire: 'Workflow started',
    'workflow.fire': 'Workflow started',
  };
  const known = knownLabels[value];
  if (known) return known;

  const readable = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return readable ? readable[0].toUpperCase() + readable.slice(1) : 'Activity';
}