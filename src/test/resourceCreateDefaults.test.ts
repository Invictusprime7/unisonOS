import { describe, expect, it } from 'vitest';
import { contentTypeToResource, resourceCreateDefaults } from '@/services/resources/resourceRegistry';
import { SEED_CONTENT_TYPES } from '@/services/resources/seedLaunchAssets';

describe('schema-derived collection creation', () => {
  it.each(Object.entries(SEED_CONTENT_TYPES))('creates %s with only that collection declared fields', (key, seed) => {
    const def = contentTypeToResource({ api_key: key, display_name: seed.displayName, field_schema: { fields: seed.fields } });
    if (!def) throw new Error('Declared collection was not projected');
    const values = resourceCreateDefaults(def);
    expect(values.title).toBeTruthy();
    expect(Object.keys(values).sort()).toEqual(def.schema.filter((field) => field.editable).map((field) => field.key).sort());
    if (key === 'team' || key === 'gallery') expect(values).not.toHaveProperty('body');
  });
  it('preserves type-specific required blank values for custom CMS schemas', () => {
    const def = contentTypeToResource({ api_key: 'programs', field_schema: { fields: [{ key: 'enabled', type: 'boolean' }, { key: 'duration', type: 'number' }, { key: 'tags', type: 'tags' }] } });
    if (!def) throw new Error('Program schema missing');
    expect(resourceCreateDefaults(def)).toEqual({ title: 'New programs', enabled: false, duration: 0, tags: [] });
  });
});