import type { AppBuildContract } from './appBuilderContracts';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';
import { missingNativeFormFields, nativeFormSources, selectedNativeFormFields, selectedNativeFormTemplate } from './nativeFormContract';
import { parse } from '@babel/parser';

const APP_BUILDER_SOURCE_PATH = /^\/src\/(?:pages|project-components|components\/generated)\/.+\.[jt]sx?$/;

export interface RegisteredComponentMaterializationResult {
  files: Record<string, string>;
  materializedInstanceIds: string[];
}

function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hasAttributeValue(tag: string, name: string, value: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedName}\\s*=\\s*(["'])${escapedValue}\\1`).test(tag);
}

function attachInstanceIdToRegisteredHost(source: string, slug: string, instanceId: string): string | null {
  const tagPattern = /<[A-Za-z][\w:.-]*\b[^>]*>/gs;
  let attached = false;
  const updated = source.replace(tagPattern, (tag) => {
    if (attached || !hasAttributeValue(tag, 'data-ut-component-slug', slug)) return tag;
    if (hasAttributeValue(tag, 'data-ut-component-instance-id', instanceId)) {
      attached = true;
      return tag;
    }
    if (/\bdata-ut-component-instance-id\s*=/.test(tag)) return tag;
    attached = true;
    const insertion = ` data-ut-component-instance-id="${escapeAttributeValue(instanceId)}"`;
    return tag.replace(/\s*\/?>$/, (closing) => `${insertion}${closing}`);
  });
  return attached ? updated : null;
}

function componentPageIds(contract: AppBuildContract, instanceId: string, usedOnPages: readonly string[]): string[] {
  if (usedOnPages.length > 0) return [...new Set(usedOnPages)];
  return [...new Set(contract.business.intentBindings
    .filter((binding) => binding.componentInstanceId === instanceId)
    .map((binding) => binding.pageId))];
}

function stampComponentInstance(template: string, slug: string, instanceId: string): string {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const host = new RegExp(`(<[A-Za-z][\\w:.-]*\\b(?=[^>]*data-ut-component-slug\\s*=\\s*["']${escapedSlug}["'])[^>]*)(>)`, 'i');
  return template.replace(host, (_match, opening: string, close: string) => {
    return `${opening} data-ut-component-instance-id="${escapeAttributeValue(instanceId)}"${close}`;
  });
}

function stampIntentMarkers(
  template: string,
  instanceId: string,
  bindings: AppBuildContract['business']['intentBindings'],
): string {
  return bindings.filter((binding) => binding.componentInstanceId === instanceId).reduce((source, binding) => {
    const marker = binding.ctaMarkers[0];
    if (!marker) return source;
    const escapedIntent = binding.coreIntent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trigger = new RegExp(`(<[A-Za-z][\\w:.-]*\\b(?=[^>]*data-intent-trigger\\s*=\\s*["']${escapedIntent}["'])[^>]*)(>)`, 'i');
    return source.replace(trigger, (_match, opening: string, close: string) => {
      if (/\bdata-ut-cta\s*=/.test(opening)) return `${opening}${close}`;
      return `${opening} data-ut-cta="${escapeAttributeValue(marker)}"${close}`;
    });
  }, template);
}

function nativeFormSatisfiesContract(form: string, component: AppBuildContract['business']['registeredComponents'][number]): boolean {
  const intent = component.runtime.writeIntent;
  if (!intent) return true;
  const escapedIntent = intent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`<form\\b(?=[^>]*data-intent-form\\s*=\\s*["']${escapedIntent}["'])`, 'i').test(form)
    || /\bonSubmit\s*=/.test(form)) return false;
  return missingNativeFormFields(form, component).length === 0;
}

/** Adopt an authored native form instead of adding a second generic form. */
function adoptNativeForm(source: string, component: AppBuildContract['business']['registeredComponents'][number]): string | null {
  const intent = component.runtime.writeIntent;
  if (!intent) return null;
  const escaped = intent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = [...source.matchAll(new RegExp(`<form\\b(?=[^>]*data-intent-form\\s*=\\s*["']${escaped}["'])[^>]*>[\\s\\S]*?<\\/form>`, 'gi'))];
  if (forms.length !== 1) return null;
  const form = forms[0];
  if (form.index === undefined) return null;
  const host = `<div data-ut-component-slug="${escapeAttributeValue(component.runtime.componentSlug)}" data-ut-component-instance-id="${escapeAttributeValue(component.runtime.instanceId)}">${form[0]}</div>`;
  return source.slice(0, form.index) + host + source.slice(form.index + form[0].length);
}

const CONTACT_DISPATCHER_IMPORT = /import\s+([A-Z][\w$]*)\s+from\s+['"]@\/unison\/design-sources\/Contact['"]/;

/**
 * Certified Contact variants render their own form. When the page renders one,
 * that section is the registered host; appending a platform form duplicated it.
 */
export function adoptContactSectionHost(
  source: string,
  component: AppBuildContract['business']['registeredComponents'][number],
): string | null {
  const intent = component.runtime.writeIntent;
  if (!intent || component.targetType !== 'form') return null;
  const dispatcher = CONTACT_DISPATCHER_IMPORT.exec(source)?.[1];
  if (!dispatcher || !new RegExp(`<${dispatcher}\\b`).test(source)) return null;
  // The variant form submits its submitIntent prop (default contact.submit).
  const escapedIntent = intent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (intent !== 'contact.submit' && !new RegExp(`submitIntent["']?\\s*:\\s*["']${escapedIntent}["']`).test(source)) return null;
  const wrapper = /<section\b[^>]*\bdata-ut-section-type\s*=\s*["']contact["'][^>]*>/.exec(source);
  if (!wrapper) return null;
  let tag = wrapper[0];
  if (!/\bdata-ut-component-slug\s*=/.test(tag)) {
    tag = tag.replace(/\s*>$/, ` data-ut-component-slug="${escapeAttributeValue(component.runtime.componentSlug)}">`);
  } else if (!hasAttributeValue(tag, 'data-ut-component-slug', component.runtime.componentSlug)) return null;
  if (!/\bdata-ut-component-instance-id\s*=/.test(tag)) {
    tag = tag.replace(/\s*>$/, ` data-ut-component-instance-id="${escapeAttributeValue(component.runtime.instanceId)}">`);
  } else if (!hasAttributeValue(tag, 'data-ut-component-instance-id', component.runtime.instanceId)) return null;
  const hosted = source.slice(0, wrapper.index) + tag + source.slice(wrapper.index + wrapper[0].length);
  return withContactFormFields(hosted, dispatcher, component) ?? hosted;
}

/** The variant form renders props.fields; project the site's selected fields there (one form, real names). */
function withContactFormFields(
  source: string,
  dispatcher: string,
  component: AppBuildContract['business']['registeredComponents'][number],
): string | null {
  const defaults: Record<string, { type: string; placeholder: string }> = {
    name: { type: 'text', placeholder: 'Your name' },
    email: { type: 'email', placeholder: 'you@example.com' },
    message: { type: 'textarea', placeholder: 'How can we help?' },
  };
  const fields = new Map<string, { name: string; type: string; placeholder: string; label: string; required: boolean }>();
  for (const name of component.requiredNativeFormFields ?? []) {
    const known = defaults[name] ?? { type: 'text', placeholder: name };
    fields.set(name, { name, type: known.type, placeholder: known.placeholder, label: name.charAt(0).toUpperCase() + name.slice(1), required: true });
  }
  for (const field of selectedNativeFormFields(component)) {
    const type = field.type === 'phone' ? 'tel' : field.type === 'select' ? 'text' : field.type;
    fields.set(field.name, { name: field.name, type, placeholder: field.label, label: field.label, required: Boolean(field.required) || fields.get(field.name)?.required === true });
  }
  if (!fields.size) return null;
  try {
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    let span: { objectStart: number; fieldsStart?: number; fieldsEnd?: number; hasIntent: boolean } | null = null;
    const visit = (node: unknown): void => {
      if (span || !node || typeof node !== 'object') return;
      const value = node as Record<string, any>;
      if (value.type === 'JSXOpeningElement' && value.name?.name === dispatcher) {
        const props = (value.attributes ?? []).find((attribute: any) => attribute.name?.name === 'props');
        const object = props?.value?.expression;
        if (object?.type === 'ObjectExpression' && typeof object.start === 'number') {
          const keyOf = (property: any) => property.key?.name ?? property.key?.value;
          const existing = object.properties.find((property: any) => keyOf(property) === 'fields');
          span = { objectStart: object.start, fieldsStart: existing?.start, fieldsEnd: existing?.end,
            hasIntent: object.properties.some((property: any) => keyOf(property) === 'submitIntent') };
        }
        return;
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(ast.program);
    if (!span) return null;
    const found = span as { objectStart: number; fieldsStart?: number; fieldsEnd?: number; hasIntent: boolean };
    const literal = `"fields":${JSON.stringify([...fields.values()])}`;
    const intent = !found.hasIntent && component.runtime.writeIntent ? `,"submitIntent":${JSON.stringify(component.runtime.writeIntent)}` : '';
    if (typeof found.fieldsStart === 'number' && typeof found.fieldsEnd === 'number') {
      return source.slice(0, found.fieldsStart) + literal + intent + source.slice(found.fieldsEnd);
    }
    const body = source.slice(found.objectStart + 1).trimStart();
    const separator = body.startsWith('}') ? '' : ',';
    return `${source.slice(0, found.objectStart + 1)}${literal}${intent}${separator}${body}`;
  } catch {
    return null;
  }
}

/** Business content belongs in <main>, before the shared footer — never after it. */
export function bodyInsertionIndex(source: string): number | null {
  let mainClose: RegExpExecArray | null = null;
  const mainPattern = /<\/main\s*>/gi;
  for (let match = mainPattern.exec(source); match; match = mainPattern.exec(source)) mainClose = match;
  if (mainClose) return mainClose.index;
  const footer = /<(?:SiteFooter|footer)\b/.exec(source);
  if (footer) return footer.index;
  let rootClose: RegExpExecArray | null = null;
  const rootPattern = /<\/(?:div|section|article)\s*>/gi;
  for (let match = rootPattern.exec(source); match; match = rootPattern.exec(source)) rootClose = match;
  return rootClose ? rootClose.index : null;
}

function repairNativeFormWithinHost(
  source: string,
  component: AppBuildContract['business']['registeredComponents'][number],
  contract: AppBuildContract,
): string | null {
  const templateForm = selectedNativeFormTemplate(component)?.match(/<form\b[\s\S]*?<\/form>/i)?.[0];
  if (!templateForm) return null;
  // JSX handlers can contain > characters and paired tags; source spans,
  // rather than HTML regexes, own replacement in an authored React module.
  try {
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
    let repaired: string | null = null;
    const visit = (node: unknown): void => {
      if (repaired !== null || !node || typeof node !== 'object') return;
      const value = node as Record<string, unknown>;
      if (value.type === 'JSXElement') {
        const opening = value.openingElement as { start?: number; end?: number; selfClosing?: boolean };
        const closing = value.closingElement as { start?: number } | null;
        if (typeof opening.start === 'number' && typeof opening.end === 'number') {
          const tag = source.slice(opening.start, opening.end);
          if (hasAttributeValue(tag, 'data-ut-component-slug', component.runtime.componentSlug)
            || hasAttributeValue(tag, 'data-ut-component-instance-id', component.runtime.instanceId)) {
            const forms: Array<{ start: number; end: number }> = [];
            const collect = (child: unknown): void => {
              if (!child || typeof child !== 'object') return;
              const item = child as Record<string, unknown>;
              const opener = item.openingElement as { name?: { name?: string } } | undefined;
              if (item.type === 'JSXElement' && opener?.name?.name === 'form'
                && typeof item.start === 'number' && typeof item.end === 'number') {
                forms.push({ start: item.start, end: item.end });
                return;
              }
              for (const next of Object.values(item)) {
                if (Array.isArray(next)) next.forEach(collect);
                else if (next && typeof next === 'object') collect(next);
              }
            };
            collect(value.children);
            const canonical = stampIntentMarkers(templateForm, component.runtime.instanceId, contract.business.intentBindings);
            const form = forms[0];
            if (form) {
              const existing = source.slice(form.start, form.end);
              repaired = nativeFormSatisfiesContract(existing, component) ? source
                : source.slice(0, form.start) + canonical + source.slice(form.end);
            } else if (closing && typeof closing.start === 'number') {
              repaired = source.slice(0, closing.start) + canonical + source.slice(closing.start);
            }
            if (repaired !== null) return;
          }
        }
      }
      for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(ast.program);
    if (repaired !== null) return repaired;
  } catch { /* Legacy source fragments use the bounded host fallback below. */ }
  const tags = /<([A-Za-z][\w:.-]*)\b[^>]*>/gs;
  for (let match = tags.exec(source); match; match = tags.exec(source)) {
    const tag = match[0];
    const componentHost = hasAttributeValue(tag, 'data-ut-component-slug', component.runtime.componentSlug)
      || hasAttributeValue(tag, 'data-ut-component-instance-id', component.runtime.instanceId);
    if (!componentHost || /\/\s*>$/.test(tag)) continue;

    const tagName = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingTags = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
    matchingTags.lastIndex = tags.lastIndex;
    let depth = 1;
    for (let nested = matchingTags.exec(source); nested; nested = matchingTags.exec(source)) {
      if (/^<\//.test(nested[0])) depth -= 1;
      else if (!/\/\s*>$/.test(nested[0])) depth += 1;
      if (depth === 0) {
        const openingEnd = match.index + tag.length;
        const hostBody = source.slice(openingEnd, nested.index);
        const forms = [...hostBody.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)];
        const exactForm = forms.find((candidate) => nativeFormSatisfiesContract(candidate[0], component));
        if (exactForm) return source;

        const canonicalForm = stampIntentMarkers(templateForm, component.runtime.instanceId, contract.business.intentBindings);
        const existingForm = forms[0]?.[0];
        const repairedBody = existingForm
          ? hostBody.replace(existingForm, canonicalForm)
          : `${hostBody}\n${canonicalForm}\n`;
        return `${source.slice(0, openingEnd)}${repairedBody}${source.slice(nested.index)}`;
      }
    }
  }
  return null;
}

export function materializeRegisteredComponents(
  contract: AppBuildContract,
  candidateFiles: Readonly<Record<string, string>>,
): RegisteredComponentMaterializationResult {
  const files = { ...candidateFiles };
  const materializedInstanceIds: string[] = [];

  for (const component of contract.business.registeredComponents) {
    const activeIntents = contract.business.intents;
    const writeIntent = component.runtime.writeIntent;
    const explicitlyDisabledIntent = Boolean(
      writeIntent && activeIntents?.length && !activeIntents.includes(writeIntent),
    );
    if (component.instanceStatus === 'stubbed'
      || explicitlyDisabledIntent
      || component.runtime.requiredCapabilities.some((capability) => !contract.business.capabilities.includes(capability))) {
      continue;
    }
    const instanceId = component.runtime.instanceId;
    const template = selectedNativeFormTemplate(component);
    if (!template) continue;

    for (const pageId of componentPageIds(contract, instanceId, component.runtime.usedOnPages)) {
      const page = contract.topology.sitePlan.pages.find((candidate) => candidate.id === pageId);
      const pagePath = page?.filePath;
      if (!pagePath || !files[pagePath]) continue;
      const surfacePaths = collectLocalImportClosure(files, pagePath, (path) => APP_BUILDER_SOURCE_PATH.test(path));
      const escapedSlug = component.runtime.componentSlug.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const hasSlug = (path: string) => new RegExp(`data-ut-component-slug\\s*=\\s*["']${escapedSlug}["']`).test(files[path] ?? '');
      const hasInstance = (path: string) => {
        const source = files[path] ?? '';
        return source.includes(`data-ut-component-instance-id="${instanceId}"`)
          || source.includes(`data-ut-component-instance-id='${instanceId}'`)
      };
      const nativePath = surfacePaths.find(path => adoptNativeForm(files[path] ?? '', component) !== null);
      const hasNativeForm = (path: string) => nativeFormSources(files[path] ?? '', component.runtime.writeIntent ?? '').length > 0;
      if (!surfacePaths.some(hasNativeForm)) {
        const contactPath = surfacePaths.find(path => adoptContactSectionHost(files[path] ?? '', component) !== null);
        if (contactPath) {
          files[contactPath] = adoptContactSectionHost(files[contactPath], component)!;
          materializedInstanceIds.push(instanceId);
          continue;
        }
      }
      const hostPath = surfacePaths.find(hasSlug) ?? surfacePaths.find(hasInstance) ?? nativePath ?? pagePath;
      if (!hasSlug(hostPath) && !hasInstance(hostPath)) {
        const adopted = adoptNativeForm(files[hostPath], component);
        if (adopted) files[hostPath] = adopted;
      }
      const source = files[hostPath];
      if (!source) continue;
      const hostHasInstance = hasInstance(hostPath);
      const hostHasSlug = hasSlug(hostPath);
      if (hostHasInstance || hostHasSlug) {
        const hostWithIdentity = hostHasSlug
          ? attachInstanceIdToRegisteredHost(source, component.runtime.componentSlug, instanceId) ?? source
          : source;
        const repaired = component.targetType === 'form' || component.targetType === 'calendar'
          ? repairNativeFormWithinHost(hostWithIdentity, component, contract)
          : hostWithIdentity;
        const finalSource = repaired ?? hostWithIdentity;
        if (component.targetType !== 'form' && component.targetType !== 'calendar') {
          files[hostPath] = finalSource;
          materializedInstanceIds.push(instanceId);
          continue;
        }
        const intent = component.runtime.writeIntent;
        const escapedIntent = intent?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const completedForm = intent
          ? new RegExp(`<form\\b(?=[^>]*data-intent-form\\s*=\\s*["']${escapedIntent}["'])[^>]*>[\\s\\S]*?<\\/form>`, 'i').exec(finalSource)?.[0]
          : undefined;
        if (completedForm && nativeFormSatisfiesContract(completedForm, component)) {
          files[hostPath] = finalSource;
          materializedInstanceIds.push(instanceId);
          continue;
        }
      }

      if (hostHasInstance && !hostHasSlug && component.targetType !== 'form' && component.targetType !== 'calendar') {
        materializedInstanceIds.push(instanceId);
        continue;
      }

      const updatedHost = attachInstanceIdToRegisteredHost(source, component.runtime.componentSlug, instanceId);
      if (updatedHost && component.targetType !== 'form' && component.targetType !== 'calendar') {
        files[hostPath] = updatedHost;
        materializedInstanceIds.push(instanceId);
        continue;
      }

      // Main owns page content. Never append business forms inside/after site footer.
      const insertAt = bodyInsertionIndex(source);
      if (insertAt === null) continue;
      const registeredTemplate = stampIntentMarkers(
        stampComponentInstance(
          template.replace(/\{\{businessId\}\}/g, escapeAttributeValue(contract.identity.businessId)),
          component.runtime.componentSlug,
          instanceId,
        ),
        instanceId,
        contract.business.intentBindings,
      );
      const componentHost = `${registeredTemplate}\n`;
      files[hostPath] = `${source.slice(0, insertAt)}${componentHost}${source.slice(insertAt)}`;
      materializedInstanceIds.push(instanceId);
    }
  }

  return { files, materializedInstanceIds };
}