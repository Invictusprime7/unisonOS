import { describe, expect, it } from 'vitest';
import { missingNativeFormFields, selectedNativeFormTemplate } from '@/services/app-builder/nativeFormContract';
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
  it.each(['field_F0EFea', 'field_lBxDTO'])('renders selected required field %s in the native form', (fieldId) => {
    const contact = component();
    contact.formFields = [{ fieldId, label: 'Selected business field', type: 'text', required: true, sortOrder: 4 }];
    const source = selectedNativeFormTemplate(contact) ?? '';
    expect(missingNativeFormFields(source, contact)).toEqual([]);
    expect(missingNativeFormFields(source.replace(`name="${fieldId}"`, 'name="other"'), contact)).toEqual([fieldId]);
  });
  it('preserves required name, email, message and the selected budget field', () => {
    const contact = component();
    const source = selectedNativeFormTemplate(contact) ?? '';
    expect(missingNativeFormFields(source, contact)).toEqual([]);
    expect(missingNativeFormFields(source.replace('name="field-budget"', 'name="other"'), contact)).toEqual(['field-budget']);
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