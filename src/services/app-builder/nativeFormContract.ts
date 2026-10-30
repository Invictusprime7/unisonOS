import type { AppBuildRegisteredComponent } from './appBuilderContracts';

export function selectedNativeFormFields(component: AppBuildRegisteredComponent) {
  const canonical = new Set(component.requiredNativeFormFields ?? []);
  return (component.formFields ?? []).map((field) => ({ ...field,
    name: canonical.has(field.label.trim().toLowerCase()) ? field.label.trim().toLowerCase() : field.fieldId,
  }));
}

export function missingNativeFormFields(form: string, component: AppBuildRegisteredComponent): string[] {
  const fields = new Map((component.requiredNativeFormFields ?? []).map((name) => [name, true]));
  for (const field of selectedNativeFormFields(component)) fields.set(field.name, fields.get(field.name) || field.required);
  return [...fields].filter(([name, required]) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tag = new RegExp(`<(?:input|textarea|select)\\b(?=[^>]*\\bname\\s*=\\s*["']${escaped}["'])[^>]*>`, 'i').exec(form)?.[0];
    return !tag || (required && !/\brequired(?:\s|=|\/?>)/i.test(tag))
      || (name === 'email' && !/\btype\s*=\s*["']email["']/i.test(tag));
  }).map(([name]) => name);
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