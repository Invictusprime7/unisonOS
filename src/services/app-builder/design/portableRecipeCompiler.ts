/** Deterministic design-source compilation: selected recipe ids -> certified family modules. */

import { certifiedComponentForSectionType, certifiedSectionModuleFiles } from '@/sections/compositionToFileSet';
import { compilerOwnershipHash } from '@/platform/core/resolvedComposition';
import type { DesignSourceBundle } from './DesignSourceBundle';

export const DESIGN_SOURCE_ROOT = '/src/unison/design-sources';
const COMPONENTS_ROOT = '/src/components';

export interface MaterializedDesignModule {
  path: string;
  hash: string;
  component: string;
}

export interface PortableRecipeCompilation {
  files: Record<string, string>;
  modules: MaterializedDesignModule[];
  /** implementationId -> wrapper module path that renders it. */
  implementationModules: Record<string, string>;
  /** implementationId -> named export on that wrapper module. */
  exportNames: Record<string, string>;
  /** implementationId -> props the variant reads, array-typed ones suffixed with []. */
  propHints: Record<string, string>;
  unresolved: string[];
}

/** Variant component identifier the registry exposes for an id, e.g. "hero:image-stream": HeroImageStream. */
function variantIdentifier(recipeSource: string, id: string): string | undefined {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`"${escaped}"\\s*:\\s*([A-Za-z_$][\\w$]*)`).exec(recipeSource)?.[1];
}

function declarationBody(source: string, id: string): string | undefined {
  const match = new RegExp(String.raw`(?:function\s+${id}\s*\(|(?:var|const|let)\s+${id}\s*=)`).exec(source);
  if (!match) return undefined;
  const rest = source.slice(match.index + match[0].length);
  const end = rest.search(/\n(?:function |var |const |let |\/\/ src\/)/);
  return rest.slice(0, end < 0 ? 6000 : Math.min(end, 6000));
}

interface PropShape { arrays: Set<string>; scalars: Set<string>; fields: Map<string, Map<string, boolean>> }

const NORMALIZED_ITEMS: Record<string, string[]> = {
  normalizeFaqItems: ['question', 'answer'],
  normalizeTestimonials: ['quote', 'author', 'role?', 'avatar?', 'rating?'],
  normalizeGalleryItems: ['src', 'alt?', 'caption?', 'category?'],
};
const REQUIRED_ITEM_FIELDS = new Set(['title', 'name', 'label', 'value', 'question', 'answer', 'quote', 'author', 'description', 'src', 'text']);
const OPTIONAL_ARRAYS = new Set(['ctas', 'actions', 'stats', 'badges', 'logos', 'links', 'columns', 'socials', 'fields']);
const OBJECT_ITEM_FIELDS: Record<string, string> = { cta: 'cta?{label|href|intent?}' };

function collectItemFields(body: string, arrays: Set<string>, shape: PropShape): void {
  for (const match of body.matchAll(/(?:section\.props\.|props\.)?(\w+)\??\.map\(\s*\(?\s*(\w+)/g)) {
    const [, array, param] = match;
    if (!arrays.has(array)) continue;
    const fields = shape.fields.get(array) ?? new Map<string, boolean>();
    for (const field of body.matchAll(new RegExp(String.raw`(?<![\w"'$.-])${param}\.(\w+)(\s*(?:&&|\|\||\?\?|\?\.|\?))?`, 'g'))) {
      if (['map', 'length', 'filter', 'slice'].includes(field[1])) continue;
      fields.set(field[1], (fields.get(field[1]) ?? false) || Boolean(field[2]));
    }
    shape.fields.set(array, fields);
  }
  for (const match of body.matchAll(/(normalize\w+)\(\s*(?:section\.props\.|props\.)?(\w+)\s*\)/g)) {
    const normalized = NORMALIZED_ITEMS[match[1]];
    if (!normalized) continue;
    shape.arrays.add(match[2]);
    shape.scalars.delete(match[2]);
    shape.fields.set(match[2], new Map(normalized.map((field) => [field.replace('?', ''), field.endsWith('?')])));
  }
  if (/GalleryFrame/.test(body) && shape.arrays.has('items') && !shape.fields.has('items')) {
    shape.fields.set('items', new Map(NORMALIZED_ITEMS.normalizeGalleryItems.map((field) => [field.replace('?', ''), field.endsWith('?')])));
  }
}

function collectPropShape(source: string, id: string, shape: PropShape, depth = 0, itemsOnly = false): void {
  const body = declarationBody(source, id);
  if (!body || depth > 2) return;
  if (!itemsOnly) {
    const roots = ['section.props', 'props'];
    for (const alias of body.matchAll(/const\s+(\w+)\s*=\s*section\.props\s*;/g)) roots.push(alias[1]);
    for (const root of roots) {
      const escaped = root.replace('.', '\\.');
      for (const match of body.matchAll(new RegExp(String.raw`(?<![\w$.])${escaped}\.(\w+)(\??\.(?:map|length|slice|filter)\b)?`, 'g'))) {
        (match[2] ? shape.arrays : shape.scalars).add(match[1]);
      }
      for (const match of body.matchAll(new RegExp(String.raw`const\s*\{([^}]*)\}\s*=\s*${escaped}\b`, 'g'))) {
        for (const part of match[1].split(',')) {
          const name = part.trim().replace(/^\.\.\./, '').split(/[=:]/)[0].trim();
          if (!/^\w+$/.test(name)) continue;
          if (/=\s*\[\s*\]/.test(part) || new RegExp(String.raw`\b${name}\??\.(?:map|length|slice|filter)\b`).test(body)) shape.arrays.add(name);
          else shape.scalars.add(name);
        }
      }
    }
  }
  collectItemFields(body, shape.arrays, shape);
  for (const call of body.matchAll(/createElement\(\s*([A-Z]\w*)\s*,\s*(\{[^\n]{0,80})/g)) {
    if (call[1] === 'EditorialSection') continue;
    const delegatesAll = /props:\s*(?:\{\s*\.\.\.)?section\.props/.test(call[2]);
    collectPropShape(source, call[1], shape, depth + 1, itemsOnly || !delegatesAll);
  }
}

/** "headline, items[]{title|description|image?}": props a variant reads, with item fields for array props. */
function variantPropHints(recipeSource: string, identifier: string): string | undefined {
  const shape: PropShape = { arrays: new Set(), scalars: new Set(), fields: new Map() };
  collectPropShape(recipeSource, identifier, shape);
  const scalars = [...shape.scalars].filter((name) => !shape.arrays.has(name));
  const arrays = [...shape.arrays].map((name) => {
    const fields = [...(shape.fields.get(name) ?? [])]
      .map(([field, guarded]) => OBJECT_ITEM_FIELDS[field] ?? field + (guarded || !REQUIRED_ITEM_FIELDS.has(field) ? '?' : ''))
      .sort((a, b) => Number(a.includes('?')) - Number(b.includes('?')));
    return `${name}${OPTIONAL_ARRAYS.has(name) ? '?' : ''}[]${fields.length ? `{${fields.join('|')}}` : ''}`;
  });
  return [...scalars, ...arrays].join(', ') || undefined;
}

const reroot =(path: string, root: string): string => path.replace(COMPONENTS_ROOT, root);

export function compilePortableRecipes(bundle: DesignSourceBundle, root: string = DESIGN_SOURCE_ROOT): PortableRecipeCompilation {
  const components = new Set<string>();
  const componentOf = new Map<string, string>();
  const unresolved: string[] = [];
  for (const impl of bundle.implementations) {
    const component = certifiedComponentForSectionType(impl.sectionType);
    if (component) { components.add(component); componentOf.set(impl.implementationId, component); }
    else unresolved.push(impl.implementationId);
  }
  const emitted = certifiedSectionModuleFiles(components);
  const files: Record<string, string> = {};
  const moduleComponent: Record<string, string> = {};
  for (const [path, source] of Object.entries(emitted)) {
    const target = reroot(path, root);
    files[target] = source;
    moduleComponent[target] = (path.split('/').pop() ?? path).replace(/\.\w+$/, '');
  }
  const implementationModules: Record<string, string> = {};
  const exportNames: Record<string, string> = {};
  const propHints: Record<string, string> = {};
  const shims = new Map<string, string[]>();
  for (const [id, component] of [...componentOf].sort(([a], [b]) => a.localeCompare(b))) {
    const wrapper = reroot(`${COMPONENTS_ROOT}/${component}.tsx`, root);
    const recipe = reroot(`${COMPONENTS_ROOT}/recipes/${component}.ts`, root);
    const identifier = files[recipe] ? variantIdentifier(files[recipe], id) : undefined;
    if (files[wrapper] && identifier) {
      implementationModules[id] = wrapper;
      if (identifier) exportNames[id] = identifier;
      const hint = identifier ? variantPropHints(files[recipe], identifier) : undefined;
      if (hint) propHints[id] = hint;
      shims.set(wrapper, [...(shims.get(wrapper) ?? []), `export const ${identifier} = ({ sectionId, componentInstanceId, ...props }: any) => <${component} sectionId={sectionId} componentInstanceId={componentInstanceId} props={props} variantId=${JSON.stringify(id)} />;`]);
    } else unresolved.push(id);
  }
  for (const [wrapper, lines] of shims) files[wrapper] = `${files[wrapper].trimEnd()}\n\n${[...new Set(lines)].join('\n')}\n`;
  const modules = Object.keys(files).sort().map((path) => ({
    path, hash: compilerOwnershipHash(files[path]), component: moduleComponent[path],
  }));
  return { files, modules, implementationModules, exportNames, propHints, unresolved: [...new Set(unresolved)].sort() };
}
