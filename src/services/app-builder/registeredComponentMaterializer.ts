import type { AppBuildContract } from './appBuilderContracts';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';
import { missingNativeFormFields, selectedNativeFormTemplate } from './nativeFormContract';
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
      const hostPath = surfacePaths.find(hasSlug) ?? surfacePaths.find(hasInstance) ?? pagePath;
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

      const rootClosePattern = /<\/(?:main|div|section|article|header|footer)\s*>/gi;
      let rootClose: RegExpExecArray | null = null;
      for (let match = rootClosePattern.exec(source); match; match = rootClosePattern.exec(source)) {
        rootClose = match;
      }
      if (!rootClose || rootClose.index === undefined) continue;
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
      files[hostPath] = `${source.slice(0, rootClose.index)}${componentHost}${source.slice(rootClose.index)}`;
      materializedInstanceIds.push(instanceId);
    }
  }

  return { files, materializedInstanceIds };
}