import type { AppBuildRegisteredComponent } from './appBuilderContracts';
import { parse } from '@babel/parser';

/** JSX attributes may contain arrow functions with >; HTML tag regexes truncate them. */
export function nativeFormSources(source: string, intent: string): string[] {
  const forms: string[] = [];
  try {
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const value = node as Record<string, unknown>;
      const opening = value.openingElement as { name?: { name?: string }; attributes?: Array<{ name?: { name?: string }; value?: { type?: string; value?: string } }> } | undefined;
      if (value.type === 'JSXElement' && opening?.name?.name === 'form'
        && opening.attributes?.some(attribute => attribute.name?.name === 'data-intent-form' && attribute.value?.value === intent)
        && typeof value.start === 'number' && typeof value.end === 'number') {
        forms.push(source.slice(value.start, value.end));
        return;
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(ast.program);
  } catch {
    const escaped = intent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    forms.push(...[...source.matchAll(new RegExp(`<form\\b(?=[^>]*data-intent-form\\s*=\\s*["']${escaped}["'])[^>]*>[\\s\\S]*?<\\/form>`, 'gi'))].map(match => match[0]));
  }
  return forms;
}

const RESERVED_FIELD_NAMES = new Set(['businessId', 'formId', 'intent', 'submit', 'site', 'page']);

function readableFieldName(label: string): string {
  return label.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

/**
 * Submitted keys come from the visible label (`Phone` → `phone`) so designs that
 * caption a field by its key never show generated IDs; collisions keep the fieldId.
 */
export function selectedNativeFormFields(component: AppBuildRegisteredComponent) {
  const canonical = new Set(component.requiredNativeFormFields ?? []);
  const used = new Set<string>(canonical);
  return (component.formFields ?? []).map((field) => {
    const lowered = field.label.trim().toLowerCase();
    if (canonical.has(lowered)) return { ...field, name: lowered };
    const readable = readableFieldName(field.label);
    const name = readable && /^[a-z]/.test(readable) && !used.has(readable) && !RESERVED_FIELD_NAMES.has(readable)
      ? readable : field.fieldId;
    used.add(name);
    return { ...field, name };
  });
}

function hasNamedControl(form: string, name: string): RegExpExecArray | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<(?:input|textarea|select)\\b(?=[^>]*\\bname\\s*=\\s*["']${escaped}["'])[^>]*>`, 'i').exec(form);
}

export function missingNativeFormFields(form: string, component: AppBuildRegisteredComponent): string[] {
  const fields = new Map<string, { required: boolean; aliases: string[] }>(
    (component.requiredNativeFormFields ?? []).map((name) => [name, { required: true, aliases: [] }]),
  );
  for (const field of selectedNativeFormFields(component)) {
    fields.set(field.name, {
      required: fields.get(field.name)?.required || Boolean(field.required),
      // Forms saved before readable keys used the generated fieldId.
      aliases: field.name === field.fieldId ? [] : [field.fieldId],
    });
  }
  return [...fields].filter(([name, { required, aliases }]) => {
    const tag = [name, ...aliases].map((candidate) => hasNamedControl(form, candidate)?.[0]).find(Boolean);
    const contact = component.runtime.writeIntent === 'contact.submit';
    return !tag || (required && contact && !/\brequired(?:\s|=|\/?>)/i.test(tag))
      || (contact && name === 'email' && !/\btype\s*=\s*["']email["']/i.test(tag));
  }).map(([name]) => name);
}

/** Identifiers imported from the certified Contact family (default dispatcher or named variants). */
export function contactDesignIdentifiers(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s+([^;]+?)\s+from\s+['"]@\/unison\/design-sources\/Contact['"]/g)) {
    const clause = match[1];
    const defaultName = /^([A-Z][\w$]*)/.exec(clause.trim())?.[1];
    if (defaultName) names.push(defaultName);
    const named = /\{([^}]*)\}/.exec(clause)?.[1];
    for (const part of named?.split(',') ?? []) {
      const local = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (local && /^[A-Z]/.test(local)) names.push(local);
    }
  }
  return [...new Set(names)];
}

export interface ContactDesignForm {
  fieldNames: string[];
  submitIntent: string;
}

/** Variant defaults when a certified Contact design receives no fields. */
const CONTACT_DESIGN_DEFAULT_FIELDS = ['name', 'email', 'message'];

/**
 * A certified Contact design renders its own native form from props. Returns the
 * submitted keys and intent of every rendered Contact design on the page.
 */
export function contactDesignForms(source: string): ContactDesignForm[] {
  const identifiers = new Set(contactDesignIdentifiers(source));
  if (identifiers.size === 0) return [];
  const forms: ContactDesignForm[] = [];
  try {
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    const stringOf = (node: any): string | undefined => node?.type === 'StringLiteral' ? node.value
      : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0]?.value?.cooked : undefined;
    const keyOf = (property: any) => property?.key?.name ?? property?.key?.value;
    const read = (fieldsNode: any, intentNode: any) => {
      const fieldNames = fieldsNode?.type === 'ArrayExpression'
        ? fieldsNode.elements.map((element: any) => stringOf(element?.properties?.find((property: any) => keyOf(property) === 'name')?.value)).filter(Boolean)
        : CONTACT_DESIGN_DEFAULT_FIELDS;
      forms.push({ fieldNames, submitIntent: stringOf(intentNode) ?? 'contact.submit' });
    };
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const value = node as Record<string, any>;
      if (value.type === 'JSXOpeningElement' && identifiers.has(value.name?.name)) {
        const attributes = value.attributes ?? [];
        const attribute = (name: string) => attributes.find((entry: any) => entry.name?.name === name);
        const props = attribute('props')?.value?.expression;
        if (props?.type === 'ObjectExpression') {
          const property = (name: string) => props.properties.find((entry: any) => keyOf(entry) === name)?.value;
          read(property('fields'), property('submitIntent'));
        } else {
          const intent = attribute('submitIntent')?.value;
          read(attribute('fields')?.value?.expression, intent?.type === 'JSXExpressionContainer' ? intent.expression : intent);
        }
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(ast.program);
  } catch {
    return [];
  }
  return forms;
}

/** Missing keys when a Contact design is the registered form host; null when none renders. */
export function missingContactDesignFields(source: string, component: AppBuildRegisteredComponent): string[] | null {
  const intent = component.runtime.writeIntent;
  const form = contactDesignForms(source).find((candidate) => candidate.submitIntent === intent);
  if (!form) return null;
  const present = new Set(form.fieldNames);
  const missing = (component.requiredNativeFormFields ?? []).filter((name) => !present.has(name));
  for (const field of selectedNativeFormFields(component)) {
    if (field.required && !present.has(field.name) && !present.has(field.fieldId) && !missing.includes(field.name)) missing.push(field.name);
  }
  return missing;
}

export function selectedNativeFormTemplate(component: AppBuildRegisteredComponent): string | undefined {
  let template = component.nativeComponentTemplate;
  if (!template) return undefined;
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  const extras = selectedNativeFormFields(component).filter((field) => !new RegExp(`\\bname=["']${field.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(template ?? ''));
  const markup = extras.map((field) => {
    const attributes = `name="${escape(field.name)}"${field.required ? ' required' : ''}`;
    const control = field.type === 'textarea' ? `<textarea ${attributes}></textarea>`
      : field.type === 'select' ? `<select ${attributes}><option value=""></option>${(field.options ?? []).map((option) => `<option value="${escape(option)}">${escape(option)}</option>`).join('')}</select>`
        : `<input type="${field.type === 'phone' ? 'tel' : field.type}" ${attributes} />`;
    return `<label><span>${escape(field.label)}</span>${control}</label>`;
  }).join('\n');
  if (markup) template = template.replace(/<button\b/, `${markup}\n<button`);
  return template;
}