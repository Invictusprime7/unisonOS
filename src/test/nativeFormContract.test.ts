import { describe, expect, it } from 'vitest';
import { missingContactDesignFields, missingNativeFormFields, selectedNativeFormFields, selectedNativeFormTemplate } from '@/services/app-builder/nativeFormContract';
import type { AppBuildRegisteredComponent } from '@/services/app-builder/appBuilderContracts';
import { getCanonicalComponentDefinition } from '@/services/canonicalComponentRegistry';

function component(): AppBuildRegisteredComponent {
  const definition = getCanonicalComponentDefinition('contact-form');
  if (!definition) throw new Error('Missing contact registry');
  return { runtime: { instanceId: 'cmp-contact', componentSlug: 'contact-form', writeIntent: 'contact.submit', usedOnPages: ['contact'], requiredCapabilities: ['contact'], catalogSurfaces: [], slotBindings: ['form-submit'], status: 'ready', blockers: [] },
    label: 'Contact', targetType: 'form', instanceStatus: 'ready', bindings: { formId: 'form-contact' }, requiredBindingKeys: ['formId'], requiredBusinessFields: [], requiredSetupSteps: [],
    requiredNativeFormFields: ['name', 'email', 'message'], nativeComponentTemplate: definition.htmlTemplate,
    formFields: [{ fieldId: 'field-budget', label: 'Budget', type: 'number', required: true, sortOrder: 4 }],
  };
}

describe('selected native contact form contract', () => {
  it.each([['field_F0EFea', 'Project details', 'project_details'], ['field_X1Zx1f', 'Phone', 'phone']])('submits selected field %s under its readable key', (fieldId, label, name) => {
    const contact = component();
    contact.formFields = [{ fieldId, label, type: 'text', required: true, sortOrder: 4 }];
    const source = selectedNativeFormTemplate(contact) ?? '';
    expect(source).toContain(`name="${name}" required`);
    expect(source).not.toContain(fieldId);
    expect(missingNativeFormFields(source, contact)).toEqual([]);
    expect(missingNativeFormFields(source.replace(`name="${name}"`, 'name="other"'), contact)).toEqual([name]);
  });
  it('still accepts forms saved with the generated field id', () => {
    const contact = component();
    const source = (selectedNativeFormTemplate(contact) ?? '').replace('name="budget"', 'name="field-budget"');
    expect(missingNativeFormFields(source, contact)).toEqual([]);
  });
  it('keeps the field id when two labels would share a key', () => {
    const contact = component();
    contact.formFields = [
      { fieldId: 'field_a', label: 'Budget', type: 'text', required: false, sortOrder: 4 },
      { fieldId: 'field_b', label: 'Budget!', type: 'text', required: false, sortOrder: 5 },
      { fieldId: 'field_c', label: 'Email', type: 'email', required: true, sortOrder: 6 },
    ];
    expect(selectedNativeFormFields(contact).map((field) => field.name)).toEqual(['budget', 'field_b', 'email']);
  });
  it('preserves required name, email, message and the selected budget field', () => {
    const contact = component();
    const source = selectedNativeFormTemplate(contact) ?? '';
    expect(missingNativeFormFields(source, contact)).toEqual([]);
    expect(missingNativeFormFields(source.replace('name="budget"', 'name="other"'), contact)).toEqual(['budget']);
  });
  it('counts a certified Contact design form as the native form, including its selected fields', () => {
    const contact = component();
    const page = (fields: string) => `import SectionContact from "@/unison/design-sources/Contact";\nexport default function Contact(){return <main><SectionContact variantId="contact:map-studio" props={{"fields":${fields},"submitIntent":"contact.submit"}} /></main>}`;
    const all = JSON.stringify(['name', 'email', 'message', 'budget'].map((name) => ({ name, type: 'text' })));
    expect(missingContactDesignFields(page(all), contact)).toEqual([]);
    const partial = JSON.stringify(['name', 'email'].map((name) => ({ name, type: 'text' })));
    expect(missingContactDesignFields(page(partial), contact)).toEqual(['message', 'budget']);
    expect(missingContactDesignFields('export default function Contact(){return <main /> }', contact)).toBeNull();
  });
  it('reads named Contact variants that take props directly', () => {
    const contact = component();
    const source = `import { ContactSplitCard } from "@/unison/design-sources/Contact";\nexport default function Contact(){return <main><ContactSplitCard fields={[{"name":"name"},{"name":"email"},{"name":"message"},{"name":"budget"}]} /></main>}`;
    expect(missingContactDesignFields(source, contact)).toEqual([]);
  });
  it.each(['name', 'email', 'message'])('rejects optional %s when the registered field is required', (name) => {
    const contact = component();
    const source = selectedNativeFormTemplate(contact) ?? '';
    const optional = source.replace(new RegExp(`(<(?:input|textarea)[^>]*name="${name}"[^>]*?)\\srequired`), '$1');
    expect(missingNativeFormFields(optional, contact)).toContain(name);
  });
  it('rejects a text email field', () => {
    const contact = component();
    const source = selectedNativeFormTemplate(contact) ?? '';
    expect(missingNativeFormFields(source.replace('type="email"', 'type="text"'), contact)).toEqual(['email']);
  });
});