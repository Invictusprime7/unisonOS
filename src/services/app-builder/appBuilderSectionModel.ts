
const SECTION_ROOT_TAGS = new Set(['section', 'nav', 'header', 'footer']);
import * as ts from 'typescript';
import {
  resolvedCompositionPathFor,
  serializeResolvedComposition,
  type ResolvedPageComposition,
} from '@/platform/core/resolvedComposition';
import type { ResolvedSection } from '@/platform/core/resolvedComposition';
import { getSectionTypesWithVariants } from '@/sections/variants/registry';
import { collectLocalImportClosure, resolveRelativeModule } from '@/services/laneBCompanionModules';

export interface AppBuilderSectionRecord extends ResolvedSection {
  data: Record<string, unknown>;
}

export interface AppBuilderSectionInspection {
  sections: AppBuilderSectionRecord[];
  issues: string[];
}

export interface AppBuilderPageTarget {
  id: string;
  filePath: string;
  route?: string;
}

interface EligibleImplementation {
  modulePath: string;
  sectionType: string;
  exportName?: string;
}

const CUSTOM_VARIANT_ID = /^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CUSTOM_COMPONENT_PATH = /^\/src\/(?:project-components|components\/generated)\/.+\.[jt]sx?$/i;

function findCustomSectionImplementations(
  pagePath: string,
  files: Readonly<Record<string, string>>,
  registered: Readonly<Record<string, EligibleImplementation>>,
): Record<string, EligibleImplementation> {
  const paths = collectLocalImportClosure(files, pagePath, (path) =>
    /^\/src\/(?:pages|project-components|components\/generated)\/.+\.[jt]sx?$/i.test(path),
  );
  const existingPaths = new Set(Object.keys(files));
  const families = new Set<string>(getSectionTypesWithVariants().filter((family) => family !== 'navbar' && family !== 'footer'));
  const discovered: Record<string, EligibleImplementation> = {};
  const ambiguous = new Set<string>();

  for (const path of paths) {
    const sourceFile = ts.createSourceFile(path, files[path] ?? '', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imports = moduleImports(sourceFile);
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && tagName(node.tagName) === 'section') {
        const variantId = readStringAttribute(node, 'data-ut-variant', sourceFile);
        const sectionType = readStringAttribute(node, 'data-ut-section-type', sourceFile);
        const registeredEntry = variantId ? registered[variantId] : undefined;
        if (variantId && CUSTOM_VARIANT_ID.test(variantId) && !registeredEntry
          && sectionType && families.has(sectionType)) {
          const root = ts.isJsxSelfClosingElement(node)
            ? node
            : ts.isJsxElement(node.parent) ? node.parent : undefined;
          const customModules = new Set<string>();
          if (root) {
            const rootOpening = ts.isJsxElement(root) ? root.openingElement : root;
            const inspectRenderer = (child: ts.Node) => {
              if (child !== rootOpening && (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child))
                && SECTION_ROOT_TAGS.has(tagName(child.tagName) ?? '')) return;
              if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) {
                const component = tagName(child.tagName);
                const imported = component ? imports.get(component) : undefined;
                const rawPath = imported?.modulePath;
                if (imported?.importedName === null && rawPath?.startsWith('@/')) {
                  const modulePath = resolveRelativeModule(path, `/src/${rawPath.slice(2)}`, existingPaths);
                  if (modulePath && CUSTOM_COMPONENT_PATH.test(modulePath)) customModules.add(modulePath);
                }
              }
              ts.forEachChild(child, inspectRenderer);
            };
            inspectRenderer(root);
          }
          if (customModules.size === 1) {
            const [modulePath] = customModules;
            if (discovered[variantId] && (discovered[variantId].modulePath !== modulePath
              || discovered[variantId].sectionType !== sectionType)) ambiguous.add(variantId);
            else discovered[variantId] = { modulePath, sectionType };
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  for (const variantId of ambiguous) delete discovered[variantId];
  return discovered;
}

interface StaticResult {
  ok: boolean;
  value?: unknown;
}

interface SourceEdit {
  position: number;
  end?: number;
  text: string;
}

function staticValue(
  expression: ts.Expression,
  sourceFile?: ts.SourceFile,
  resolving: ReadonlySet<string> = new Set(),
): StaticResult {
  if (ts.isParenthesizedExpression(expression)
    || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression)
    || ts.isSatisfiesExpression(expression)) return staticValue(expression.expression, sourceFile, resolving);
  if (ts.isIdentifier(expression) && sourceFile) {
    const name = expression.text;
    if (resolving.has(name)) return { ok: false };
    const declarations: ts.Expression[] = [];
    const findDeclaration = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name
        && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0
        && node.initializer) declarations.push(node.initializer);
      ts.forEachChild(node, findDeclaration);
    };
    findDeclaration(sourceFile);
    if (declarations.length !== 1) return { ok: false };
    return staticValue(declarations[0], sourceFile, new Set([...resolving, name]));
  }
  if (ts.isStringLiteralLike(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return { ok: true, value: expression.text };
  if (ts.isNumericLiteral(expression)) return { ok: true, value: Number(expression.text) };
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return { ok: true, value: true };
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return { ok: true, value: false };
  if (expression.kind === ts.SyntaxKind.NullKeyword) return { ok: true, value: null };
  if (ts.isArrayLiteralExpression(expression)) {
    const values: unknown[] = [];
    for (const entry of expression.elements) {
      const spread = ts.isSpreadElement(entry);
      const parsed = staticValue(spread ? entry.expression : entry, sourceFile, resolving);
      if (!parsed.ok || (spread && !Array.isArray(parsed.value))) return { ok: false };
      if (spread) values.push(...parsed.value as unknown[]);
      else values.push(parsed.value);
    }
    return { ok: true, value: values };
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const value: Record<string, unknown> = {};
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        const parsed = staticValue(property.expression, sourceFile, resolving);
        if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) return { ok: false };
        Object.assign(value, parsed.value);
        continue;
      }
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) return { ok: false };
      const key = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name) || ts.isNumericLiteral(property.name)
        ? property.name.text
        : null;
      if (key === null) return { ok: false };
      const parsed = staticValue(property.initializer, sourceFile, resolving);
      if (!parsed.ok) return { ok: false };
      value[key] = parsed.value;
    }
    return { ok: true, value };
  }
  return { ok: false };
}

function tagName(tag: ts.JsxTagNameExpression): string | null {
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return `${tagName(tag.expression as ts.JsxTagNameExpression)}.${tag.name.text}`;
  return null;
}

function findAttribute(element: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return element.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function readStringAttribute(element: ts.JsxOpeningLikeElement, name: string, sourceFile?: ts.SourceFile): string | undefined {
  const initializer = findAttribute(element, name)?.initializer;
  if (!initializer) return undefined;
  if (ts.isStringLiteralLike(initializer)) return initializer.text;
  if (!ts.isJsxExpression(initializer) || !initializer.expression) return undefined;
  const parsed = staticValue(initializer.expression, sourceFile);
  return parsed.ok && typeof parsed.value === 'string' ? parsed.value : undefined;
}

interface ImportedBinding {
  modulePath: string;
  importedName: string | null;
}

function importsRegisteredImplementation(
  imported: ImportedBinding | undefined,
  expectedImport: string,
  implementation: EligibleImplementation,
): boolean {
  return imported?.modulePath === expectedImport
    && (imported.importedName === null || imported.importedName === implementation.exportName);
}

function moduleImports(sourceFile: ts.SourceFile): Map<string, ImportedBinding> {
  const imports = new Map<string, ImportedBinding>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const binding = statement.importClause?.name;
    if (binding) imports.set(binding.text, { modulePath: statement.moduleSpecifier.text, importedName: null });
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        imports.set(element.name.text, {
          modulePath: statement.moduleSpecifier.text,
          importedName: (element.propertyName ?? element.name).text,
        });
      }
    }
  }
  return imports;
}

interface RootVariantIdentity {
  sectionId?: string;
  sectionType?: string;
  variantId?: string;
}

function findRootVariantIdentity(
  root: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  implementations: Readonly<Record<string, EligibleImplementation>>,
): RootVariantIdentity {
  const imports = moduleImports(sourceFile);
  let match: RootVariantIdentity = {};
  let matches = 0;
  const visit = (node: ts.Node) => {
    if (node !== root && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '')) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = tagName(node.tagName);
      const variantId = readStringAttribute(node, 'variantId', sourceFile) ?? readStringAttribute(node, 'data-ut-variant', sourceFile);
      const sectionId = readStringAttribute(node, 'sectionId', sourceFile) ?? readStringAttribute(node, 'data-ut-section-id', sourceFile);
      const implementation = variantId ? implementations[variantId] : undefined;
      const imported = component ? imports.get(component) : undefined;
      const expectedImport = implementation?.modulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, '');
      if (implementation && expectedImport && importsRegisteredImplementation(imported, expectedImport, implementation)) {
        matches += 1;
        match = { sectionId, sectionType: implementation.sectionType, variantId };
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches === 1 ? match : {};
}

function findRootSectionTypeFromModule(
  root: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  implementations: Readonly<Record<string, EligibleImplementation>>,
): string | undefined {
  const imports = moduleImports(sourceFile);
  const sectionTypes = new Set<string>();
  const moduleTypes = new Map<string, string>();
  for (const implementation of Object.values(implementations)) {
    moduleTypes.set(
      implementation.modulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, ''),
      implementation.sectionType,
    );
  }
  const visit = (node: ts.Node) => {
    if (node !== root && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '')) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = tagName(node.tagName);
      const imported = component ? imports.get(component) : undefined;
      const sectionType = imported ? moduleTypes.get(imported.modulePath) : undefined;
      if (sectionType) sectionTypes.add(sectionType);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return sectionTypes.size === 1 ? [...sectionTypes][0] : undefined;
}

function staticDispatcherProps(element: ts.JsxOpeningLikeElement, sourceFile: ts.SourceFile): Record<string, unknown> | null {
  const props: Record<string, unknown> = {};
  for (const property of element.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) return null;
    if (!ts.isJsxAttribute(property)) return null;
    const name = property.name.getText();
    if (name === 'key' || name === 'sectionId' || name === 'variantId' || name === 'props'
      || name.startsWith('data-ut-') || name === 'data-intent-form' || name === 'data-intent-trigger') continue;
    if (!property.initializer) {
      props[name] = true;
      continue;
    }
    if (ts.isStringLiteralLike(property.initializer)) {
      props[name] = property.initializer.text;
      continue;
    }
    if (!ts.isJsxExpression(property.initializer) || !property.initializer.expression) return null;
    const parsed = staticValue(property.initializer.expression, sourceFile);
    if (!parsed.ok) return null;
    props[name] = parsed.value;
  }
  return props;
}

function dispatcherProps(element: ts.JsxOpeningLikeElement, sourceFile: ts.SourceFile): Record<string, unknown> | null {
  const attribute = findAttribute(element, 'props');
  if (attribute?.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    const parsed = staticValue(attribute.initializer.expression, sourceFile);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
      return parsed.value as Record<string, unknown>;
    }
    return null;
  }
  if (attribute) return null;
  return staticDispatcherProps(element, sourceFile);
}

function insertOpeningAttributes(
  source: string,
  element: ts.JsxOpeningLikeElement,
  attributes: string[],
  edits: SourceEdit[],
): void {
  if (!attributes.length) return;
  const tagEnd = element.getEnd();
  const closingIndex = source[tagEnd - 2] === '/' ? tagEnd - 2 : tagEnd - 1;
  edits.push({ position: closingIndex, text: ` ${attributes.join(' ')}` });
}

function normalizeRegisteredDispatcher(
  root: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  implementation: EligibleImplementation,
  sectionId: string,
  variantId: string,
  source: string,
  edits: SourceEdit[],
): void {
  const expectedImport = implementation.modulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, '');
  const imports = moduleImports(sourceFile);
  const dispatchers: ts.JsxOpeningLikeElement[] = [];
  const rootOpening = ts.isJsxElement(root) ? root.openingElement : root;
  const visit = (node: ts.Node) => {
    if (node !== rootOpening && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '')) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = tagName(node.tagName);
      const imported = component ? imports.get(component) : undefined;
      if (importsRegisteredImplementation(imported, expectedImport, implementation)) dispatchers.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  if (dispatchers.length !== 1) return;

  const dispatcher = dispatchers[0];
  const attributes: string[] = [];
  for (const [name, value] of [['sectionId', sectionId], ['variantId', variantId]] as const) {
    const existing = readStringAttribute(dispatcher, name, sourceFile);
    if (existing === value) continue;
    const attribute = findAttribute(dispatcher, name);
    if (attribute?.initializer) {
      edits.push({
        position: attribute.initializer.getStart(sourceFile),
        end: attribute.initializer.getEnd(),
        text: JSON.stringify(value),
      });
    } else if (attribute) {
      edits.push({ position: attribute.name.getEnd(), text: `=${JSON.stringify(value)}` });
    } else {
      attributes.push(`${name}=${JSON.stringify(value)}`);
    }
  }
  if (!findAttribute(dispatcher, 'props')) {
    const props = staticDispatcherProps(dispatcher, sourceFile);
    if (!props) return;
    attributes.push(`props={${JSON.stringify(props)}}`);
  } else if (!dispatcherProps(dispatcher, sourceFile)) {
    return;
  }
  insertOpeningAttributes(source, dispatcher, attributes, edits);
}

function materializeSectionRootIdentity(
  filePath: string,
  source: string,
  implementations: Readonly<Record<string, EligibleImplementation>>,
  eligibleImplementations: Readonly<Record<string, EligibleImplementation>>,
  pageId?: string,
  pageRoute?: string,
): string {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: SourceEdit[] = [];
  const identityCounts = new Map<string, number>();
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '')) {
      const parent = node.parent;
      const nested = (() => {
        let current = parent;
        while (current && !ts.isSourceFile(current)) {
          if (current !== parent && (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current))) {
            const name = ts.isJsxElement(current) ? tagName(current.openingElement.tagName) : tagName(current.tagName);
            if (SECTION_ROOT_TAGS.has(name ?? '')) return true;
          }
          current = current.parent;
        }
        return false;
      })();
      if (!nested) {
        const opening = ts.isJsxOpeningElement(node) ? node : node;
        const rootName = tagName(opening.tagName) ?? '';
        const rootElement = ts.isJsxSelfClosingElement(opening)
          ? opening
          : ts.isJsxElement(opening.parent) ? opening.parent : undefined;
        const inferred = rootElement
          ? findRootVariantIdentity(rootElement, sourceFile, implementations)
          : {};
        const requestedVariantId = readStringAttribute(opening, 'data-ut-variant', sourceFile);
        const inferredSectionType = rootElement
          ? findRootSectionTypeFromModule(rootElement, sourceFile, implementations)
          : undefined;
        const sectionType = readStringAttribute(opening, 'data-ut-section-type', sourceFile)
          ?? (rootName === 'header' || rootName === 'nav' ? 'navbar'
            : rootName === 'footer' ? 'footer'
              : inferred.sectionType ?? inferredSectionType
                ?? (requestedVariantId ? implementations[requestedVariantId]?.sectionType : undefined));
        const eligibleVariant = (variantId: string | undefined) => {
          const implementation = variantId ? eligibleImplementations[variantId] : undefined;
          return implementation?.sectionType === sectionType ? variantId : undefined;
        };
        const variantId = eligibleVariant(inferred.variantId)
          ?? eligibleVariant(requestedVariantId)
          ?? Object.keys(eligibleImplementations).find((candidate) => eligibleImplementations[candidate].sectionType === sectionType);
        const existingId = readStringAttribute(opening, 'data-ut-section-id', sourceFile);
        const implementation = variantId ? implementations[variantId] : undefined;
        if (sectionType && variantId && implementation?.sectionType === sectionType) {
          const sharedId = sectionType === 'navbar' ? 'site:navbar' : sectionType === 'footer' ? 'site:footer' : undefined;
          const count = identityCounts.get(sectionType) ?? 0;
          identityCounts.set(sectionType, count + 1);
          const pageIdentity = pageId ?? filePath.split('/').pop()?.replace(/\.(?:tsx?|jsx?)$/i, '').toLowerCase() ?? 'page';
          const sectionId = existingId ?? inferred.sectionId ?? sharedId ?? `${pageIdentity}:${sectionType}:${count}`;
          const entityId = readStringAttribute(opening, 'data-ut-entity-id', sourceFile)
            ?? `section:${pageIdentity}:${sectionId}`;
          const attributes: Array<[string, string | undefined]> = [
            ['data-ut-section-id', existingId ?? sectionId],
            ['data-ut-section-type', readStringAttribute(opening, 'data-ut-section-type', sourceFile) ?? sectionType],
            ['data-ut-variant', variantId],
            ['data-ut-entity-id', entityId],
            ...(pageId ? [['data-ut-page-id', pageId] as [string, string]] : []),
            ...(pageRoute ? [['data-ut-page-path', pageRoute] as [string, string]] : []),
          ];
          const missing = attributes
            .filter(([name]) => !findAttribute(opening, name))
            .map(([name, value]) => ` ${name}=${JSON.stringify(value)}`)
            .join('');
          if (missing) edits.push({ position: opening.end - 1, text: missing });
          const variantAttribute = findAttribute(opening, 'data-ut-variant');
          if (variantAttribute && readStringAttribute(opening, 'data-ut-variant', sourceFile) !== variantId) {
            if (!variantAttribute.initializer) {
              edits.push({ position: variantAttribute.name.getEnd(), text: `=${JSON.stringify(variantId)}` });
            } else {
              const valueNode = ts.isJsxExpression(variantAttribute.initializer)
                ? variantAttribute.initializer.expression
                : variantAttribute.initializer;
              if (valueNode) edits.push({
                position: valueNode.getStart(sourceFile),
                end: valueNode.getEnd(),
                text: JSON.stringify(variantId),
              });
            }
          }
          if (rootElement) {
            normalizeRegisteredDispatcher(rootElement, sourceFile, implementation, sectionId, variantId, source, edits);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  let next = source;
  for (const edit of edits.sort((a, b) => b.position - a.position)) {
    next = `${next.slice(0, edit.position)}${edit.text}${next.slice(edit.end ?? edit.position)}`;
  }
  return next;
}

function findSectionRenderer(
  element: ts.JsxOpeningElement,
  sourceFile: ts.SourceFile,
  expectedImport: string,
  variantId: string,
  sectionId: string,
): { name: string | null; props: Record<string, unknown> | null; matches: number } {
  const imports = moduleImports(sourceFile);
  let name: string | null = null;
  let props: Record<string, unknown> | null = null;
  let matches = 0;
  const sectionRoot = element.parent && ts.isJsxElement(element.parent) ? element.parent : element;
  const visit = (node: ts.Node) => {
    if (node !== element && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '')) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = tagName(node.tagName);
      const propsAttribute = findAttribute(node, 'props')?.initializer;
      const imported = component ? imports.get(component) : undefined;
      if (component && imported?.modulePath === expectedImport && imported.importedName === null
        && readStringAttribute(node, 'variantId', sourceFile) === variantId
        && readStringAttribute(node, 'sectionId', sourceFile) === sectionId
        && propsAttribute && ts.isJsxExpression(propsAttribute) && propsAttribute.expression) {
        const parsed = staticValue(propsAttribute.expression, sourceFile);
        matches += 1;
        if (parsed.ok && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
          name = component;
          props = parsed.value as Record<string, unknown>;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sectionRoot);
  return { name, props, matches };
}

function findLegacyNamedRenderer(
  element: ts.JsxOpeningElement,
  sourceFile: ts.SourceFile,
  expectedImport: string,
  exportName: string | undefined,
): { primitiveId: string | null; legacyRendererName: string | null; props: Record<string, unknown> | null; matches: number } {
  if (!exportName) return { primitiveId: null, legacyRendererName: null, props: null, matches: 0 };
  const localNames = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || statement.moduleSpecifier.text !== expectedImport) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const specifier of named.elements) {
      if ((specifier.propertyName ?? specifier.name).text === exportName) localNames.add(specifier.name.text);
    }
  }
  const sectionRoot = element.parent && ts.isJsxElement(element.parent) ? element.parent : element;
  const rendererNames: string[] = [];
  let props: Record<string, unknown> | null = null;
  let matches = 0;
  const visit = (node: ts.Node) => {
    if (node !== element && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '')) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && localNames.has(tagName(node.tagName) ?? '')) {
      matches += 1;
      rendererNames.push(tagName(node.tagName)!);
      const parsed = staticNamedVariantProps(node, sourceFile);
      if (parsed) props = parsed;
    }
    ts.forEachChild(node, visit);
  };
  visit(sectionRoot);
  const existingDispatcher = sourceFile.statements.find((statement) =>
    ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text === expectedImport && statement.importClause?.name,
  );
  let dispatcherName = existingDispatcher && ts.isImportDeclaration(existingDispatcher)
    ? existingDispatcher.importClause?.name?.text ?? null
    : null;
  if (!dispatcherName) {
    const familyName = expectedImport.split('/').pop() ?? 'Section';
    const baseName = `Unison${familyName}`;
    dispatcherName = baseName;
    let suffix = 2;
    while (new RegExp(`\\b${dispatcherName}\\b`).test(sourceFile.text)) dispatcherName = `${baseName}${suffix++}`;
  }
  return {
    primitiveId: matches === 1 ? dispatcherName : null,
    legacyRendererName: matches === 1 ? rendererNames[0] : null,
    props,
    matches,
  };
}

/** Validate every authored page section and extract its durable content data. */
export function inspectAppBuilderPageSections(
  pagePath: string,
  source: string,
  implementations: Readonly<Record<string, EligibleImplementation>>,
  options: {
    allowNamedExports?: boolean;
    requireChromeRoots?: boolean;
    allowEmpty?: boolean;
    customImplementations?: Readonly<Record<string, EligibleImplementation>>;
  } = {},
): AppBuilderSectionInspection {
  const pageImplementations = { ...implementations, ...options.customImplementations };
  const sourceFile = ts.createSourceFile(pagePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sections: AppBuilderSectionRecord[] = [];
  const issues: string[] = [];
  const ids = new Set<string>();
  const isNestedRoot = (node: ts.Node): boolean => {
    let parent = node.parent;
    if (ts.isJsxElement(parent) && parent.openingElement === node) parent = parent.parent;
    while (parent && !ts.isSourceFile(parent)) {
      if (ts.isJsxElement(parent) && SECTION_ROOT_TAGS.has(tagName(parent.openingElement.tagName) ?? '')) return true;
      if (ts.isJsxSelfClosingElement(parent) && SECTION_ROOT_TAGS.has(tagName(parent.tagName) ?? '')) return true;
      parent = parent.parent;
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && SECTION_ROOT_TAGS.has(tagName(node.tagName) ?? '') && !isNestedRoot(node)) {
      const sectionId = readStringAttribute(node, 'data-ut-section-id', sourceFile);
      const sectionType = readStringAttribute(node, 'data-ut-section-type', sourceFile);
      const variantId = readStringAttribute(node, 'data-ut-variant', sourceFile);
      if (!sectionId || !sectionType || !variantId) {
        issues.push(`${pagePath}: every section requires literal data-ut-section-id, data-ut-section-type, and data-ut-variant attributes.`);
      } else if (ids.has(sectionId)) {
        issues.push(`${pagePath}: duplicate section id "${sectionId}".`);
      } else {
        ids.add(sectionId);
        const implementation = pageImplementations[variantId];
        if (!implementation || implementation.sectionType !== sectionType) {
          issues.push(`${pagePath}: section "${sectionId}" uses unavailable ${sectionType} variant "${variantId}".`);
        } else {
          const expectedImport = implementation.modulePath.replace(/^\/src\//, '@/').replace(/\.(?:tsx?|jsx?)$/i, '');
          let legacyRendererName: string | null = null;
          let renderer = ts.isJsxOpeningElement(node)
            ? findSectionRenderer(node, sourceFile, expectedImport, variantId, sectionId)
            : { name: null, props: null, matches: 0 };
          if (options.allowNamedExports && renderer.matches === 0 && ts.isJsxOpeningElement(node)) {
            const legacy = findLegacyNamedRenderer(node, sourceFile, expectedImport, implementation.exportName);
            renderer = { name: legacy.primitiveId, props: legacy.props, matches: legacy.matches };
            legacyRendererName = legacy.legacyRendererName;
          }
          if (renderer.matches !== 1 || !renderer.name || !renderer.props) {
            issues.push(`${pagePath}: section "${sectionId}" must use its registered family dispatcher and literal serializable props.`);
          } else {
            sections.push({
              sectionId,
              semanticType: sectionType,
              primitiveId: renderer.name,
              sourceModulePath: implementation.modulePath,
              sourcePath: pagePath,
              ...(legacyRendererName ? { legacyRendererName } : {}),
              variantId,
              data: renderer.props,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!options.allowEmpty && sections.length === 0 && issues.length === 0) {
    issues.push(`${pagePath}: no registered, identified sections were found.`);
  }
  if (sections.length > 0 && options.requireChromeRoots !== false) {
    if (!sections.some((section) => section.semanticType === 'navbar')) {
      issues.push(`${pagePath}: shared navigation must have a stable section identity and registered variant.`);
    }
    if (!sections.some((section) => section.semanticType === 'footer')) {
      issues.push(`${pagePath}: shared footer must have a stable section identity and registered variant.`);
    }
  }
  return { sections, issues };
}

/** Inspect page source and its reachable App Builder-owned component closure. */
export function inspectAppBuilderPageSectionClosure(
  pagePath: string,
  files: Readonly<Record<string, string>>,
  implementations: Readonly<Record<string, EligibleImplementation>>,
  options: { allowNamedExports?: boolean } = {},
): AppBuilderSectionInspection {
  const pageImplementations = {
    ...implementations,
    ...findCustomSectionImplementations(pagePath, files, implementations),
  };
  const paths = collectLocalImportClosure(files, pagePath, (path) =>
    /^\/src\/(?:pages|project-components|components\/generated)\/.+\.[jt]sx?$/i.test(path),
  );
  const sections: AppBuilderSectionRecord[] = [];
  const issues: string[] = [];
  const seenIds = new Set<string>();
  for (const path of paths) {
    const inspection = inspectAppBuilderPageSections(path, files[path] ?? '', pageImplementations, {
      ...options,
      requireChromeRoots: false,
      allowEmpty: true,
    });
    issues.push(...inspection.issues);
    for (const section of inspection.sections) {
      if (seenIds.has(section.sectionId)) {
        issues.push(`${pagePath}: duplicate section id "${section.sectionId}" across the page source closure.`);
        continue;
      }
      seenIds.add(section.sectionId);
      sections.push(section);
    }
  }
  if (sections.length > 0) {
    if (!sections.some((section) => section.semanticType === 'navbar')) {
      issues.push(`${pagePath}: shared navigation must have a stable section identity and registered variant.`);
    }
    if (!sections.some((section) => section.semanticType === 'footer')) {
      issues.push(`${pagePath}: shared footer must have a stable section identity and registered variant.`);
    }
  }
  return { sections, issues };
}

/** Add system-authored section sidecars; no page source or business data is rewritten. */
export function materializeAppBuilderSectionModels(
  files: Readonly<Record<string, string>>,
  pages: readonly AppBuilderPageTarget[],
  implementations: Readonly<Record<string, EligibleImplementation>>,
  eligibleByPage?: Readonly<Record<string, readonly string[]>>,
): Record<string, string> {
  const result = { ...files };
  for (const page of pages) {
    const eligibleIds = eligibleByPage?.[page.id];
    const customImplementations = findCustomSectionImplementations(page.filePath, result, implementations);
    const pageImplementations = { ...implementations, ...customImplementations };
    const eligibleImplementations = eligibleIds
      ? Object.fromEntries(eligibleIds.flatMap((id) => implementations[id] ? [[id, implementations[id]]] : []))
      : pageImplementations;
    for (const [id, implementation] of Object.entries(customImplementations)) {
      eligibleImplementations[id] = implementation;
    }
    const sidecarPath = resolvedCompositionPathFor(page.filePath);
    const sourcePaths = collectLocalImportClosure(result, page.filePath, (path) =>
      /^\/src\/(?:pages|project-components|components\/generated)\/.+\.[jt]sx?$/i.test(path),
    );
    for (const path of sourcePaths) {
      result[path] = materializeSectionRootIdentity(
        path,
        result[path] ?? '',
        pageImplementations,
        eligibleImplementations,
        path === page.filePath ? page.id : undefined,
        path === page.filePath ? page.route : undefined,
      );
    }
    const inspection = inspectAppBuilderPageSectionClosure(page.filePath, result, pageImplementations, { allowNamedExports: true });
    if (inspection.issues.length || !inspection.sections.length) continue;
    const variantOverrides = Object.fromEntries(inspection.sections.map((section) => [section.sectionId, section.variantId!]));
    const composition: ResolvedPageComposition = {
      version: '1.0',
      compiledBy: 'app-builder',
      pageFilePath: page.filePath,
      sections: inspection.sections,
      variantOverrides,
    };
    result[sidecarPath] = serializeResolvedComposition(composition);
  }
  return result;
}

function staticNamedVariantProps(element: ts.JsxOpeningLikeElement, sourceFile?: ts.SourceFile): Record<string, unknown> | null {
  const props: Record<string, unknown> = {};
  for (const property of element.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) return null;
    if (!ts.isJsxAttribute(property)) return null;
    const name = property.name.getText();
    if (name.startsWith('data-ut-') || name === 'data-intent-form' || name === 'data-intent-trigger') return null;
    if (name === 'key' || name === 'sectionId' || name === 'variantId') continue;
    if (!property.initializer) {
      props[name] = true;
      continue;
    }
    if (ts.isStringLiteralLike(property.initializer)) {
      props[name] = property.initializer.text;
      continue;
    }
    if (!ts.isJsxExpression(property.initializer) || !property.initializer.expression) return null;
    const parsed = staticValue(property.initializer.expression, sourceFile);
    if (!parsed.ok) return null;
    props[name] = parsed.value;
  }
  return props;
}