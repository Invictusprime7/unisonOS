import * as ts from 'typescript';
import { analyzeImportGraph } from '@/services/importGraphAnalyzer';
import { fileProvenanceMatchesContent, type FileProvenanceRecord } from '@/services/fileProvenance';
import { getDesignImplementation } from '@/services/designImplementationRegistry';
import { getAllSections } from '@/sections/registry';
import { getCanonicalComponentDefinition } from '@/services/canonicalComponentRegistry';

export type EffectiveComponentOrigin =
  | 'compiler-generated'
  | 'ai-authored'
  | 'user-authored'
  | 'wizard-generated'
  | 'system-generated'
  | 'legacy-authored'
  | 'imported'
  | 'unverified';

export interface EffectiveCompositionSection {
  sectionId: string;
  semanticType: string | null;
  variantId: string | null;
  layout: string | null;
  parentSectionId: string | null;
}

export interface EffectiveCompositionMediaUse {
  tag: string;
  src: string;
  alt: string | null;
  sectionId: string | null;
}

export interface EffectiveCompositionImport {
  importerPath: string;
  specifier: string;
  resolvedPath: string | null;
  sourceDirectory: string | null;
  importedSymbols: string[];
  owner: EffectiveComponentOrigin;
  typeOnly: boolean;
}

export interface EffectiveCompositionComponentUse {
  name: string;
  importerPath: string;
  moduleSpecifier: string | null;
  sourcePath: string | null;
  sourceDirectory: string | null;
  origin: EffectiveComponentOrigin;
}

export interface EffectiveCompositionBinding {
  bindingId: string;
  elementKey: string | null;
  sourceSection: string | null;
  sourceSlot: string | null;
  intent: string;
  targetId: string;
  targetType: string;
  source: string;
  valid: boolean;
}

export interface EffectiveRegistryEvidence {
  registry: 'section-type' | 'design-implementation' | 'canonical-component';
  id: string | null;
  status: 'registered' | 'unregistered' | 'unverified';
  reason?: string;
  sourcePath: string;
  sourceDirectory: string;
  sourceOffset: number;
}

export interface EffectiveCompositionPage {
  pageId: string;
  sourcePath: string;
  sourceHash: string;
  sections: EffectiveCompositionSection[];
  mediaUses: EffectiveCompositionMediaUse[];
  imports: EffectiveCompositionImport[];
  componentUses: EffectiveCompositionComponentUse[];
  bindings: EffectiveCompositionBinding[];
  registryEvidence: EffectiveRegistryEvidence[];
  uncertain: string[];
}

export interface EffectiveCompositionProjection {
  schemaVersion: '1.0';
  revisionId?: string;
  baseRevisionId: string | null;
  vfsHash: string;
  compositionHash: string;
  pages: Record<string, EffectiveCompositionPage>;
}

type SourceHash = (path: string, source: string) => Promise<string>;

function staticAttributeValue(attribute: ts.JsxAttribute | undefined): string | null {
  const initializer = attribute?.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression && ts.isStringLiteral(initializer.expression)) {
    return initializer.expression.text;
  }
  return null;
}

function attribute(properties: ts.JsxAttributes['properties'], name: string): ts.JsxAttribute | undefined {
  return properties.find((property): property is ts.JsxAttribute => (
    ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name
  ));
}

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function originFromProvenance(
  provenance: Pick<FileProvenanceRecord, 'ownership' | 'creatorOrigin' | 'lastEditorOrigin'> | undefined,
): EffectiveComponentOrigin | null {
  if (!provenance) return null;
  if (provenance.ownership === 'compiler') return 'compiler-generated';
  const editor = provenance.lastEditorOrigin === 'system-restore'
    ? provenance.creatorOrigin
    : provenance.lastEditorOrigin;
  if (editor === 'ai-builder') return 'ai-authored';
  if (editor === 'playground-edit' || editor === 'preview-toolbar' || editor === 'layout-fast-path') return 'user-authored';
  if (editor === 'wizard-launch') return 'wizard-generated';
  if (editor === 'legacy') return 'legacy-authored';
  if (editor) return 'system-generated';
  return null;
}

function locallyDeclaredComponents(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of sourceFile.statements) {
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name && /^[A-Z]/.test(statement.name.text)) {
      names.add(statement.name.text);
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && /^[A-Z]/.test(declaration.name.text)) names.add(declaration.name.text);
    }
  }
  return names;
}

export async function projectEffectiveComposition(input: {
  pages: Record<string, { filePath?: string | null }>;
  files: Record<string, string>;
  fileProvenance?: Record<string, FileProvenanceRecord>;
  bindings?: Record<string, {
    bindingId: string;
    sourcePageId: string;
    elementKey?: string;
    sourceSection?: string;
    sourceSlot?: string;
    intent: string;
    coreIntent?: string;
    targetId: string;
    targetType: string;
    source: string;
    isValid: boolean;
  }>;
  baseRevisionId: string | null;
  vfsHash: string;
  hashSource: SourceHash;
}): Promise<EffectiveCompositionProjection> {
  const pages: Record<string, EffectiveCompositionPage> = {};
  const importGraph = analyzeImportGraph(input.files);
  const provenanceCache = new Map<string, { record: FileProvenanceRecord | null; reason?: string }>();

  for (const [pageId, page] of Object.entries(input.pages)) {
    const sourcePath = page.filePath?.startsWith('/') ? page.filePath : `/${page.filePath ?? ''}`;
    const source = input.files[sourcePath];
    if (typeof source !== 'string' || !source) continue;

    const scriptKind = /\.jsx$/i.test(sourcePath) ? ts.ScriptKind.JSX : ts.ScriptKind.TSX;
    const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, scriptKind);
    const sections: EffectiveCompositionSection[] = [];
    const mediaUses: EffectiveCompositionMediaUse[] = [];
    const imports: EffectiveCompositionImport[] = [];
    const importedComponents = new Map<string, EffectiveCompositionComponentUse>();
    const componentUses = new Map<string, EffectiveCompositionComponentUse>();
    const registryEvidence: EffectiveRegistryEvidence[] = [];
    const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
    const uncertain = parseDiagnostics.length > 0 ? ['source-has-parse-diagnostics'] : [];
    const localComponents = locallyDeclaredComponents(sourceFile);
    const provenanceForPath = async (path: string, contents: string): Promise<FileProvenanceRecord | undefined> => {
      if (!provenanceCache.has(path)) {
        const record = input.fileProvenance?.[path];
        if (!record) {
          provenanceCache.set(path, { record: null, reason: `provenance-missing:${path}` });
        } else if (!await fileProvenanceMatchesContent(contents, record)) {
          provenanceCache.set(path, { record: null, reason: `provenance-hash-mismatch:${path}` });
        } else {
          provenanceCache.set(path, { record });
        }
      }
      const cached = provenanceCache.get(path)!;
      if (cached.reason) uncertain.push(cached.reason);
      return cached.record ?? undefined;
    };
    const sourceProvenance = await provenanceForPath(sourcePath, source);
    const sourceOrigin = originFromProvenance(sourceProvenance);

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      const edge = importGraph.edges.find((candidate) => candidate.from === sourcePath && candidate.raw === specifier);
      const resolvedPath = edge?.to.startsWith('/') ? edge.to : null;
      const importedSource = resolvedPath ? input.files[resolvedPath] : undefined;
      const provenance = resolvedPath && typeof importedSource === 'string'
        ? await provenanceForPath(resolvedPath, importedSource)
        : undefined;
      const owner = originFromProvenance(provenance)
        ?? (resolvedPath || specifier.startsWith('@/') || specifier.startsWith('.') || specifier.startsWith('/')
          ? 'unverified'
          : 'imported');
      const importedSymbols: string[] = [];
      const clause = statement.importClause;
      const registerComponent = (name: string) => importedComponents.set(name, {
        name,
        importerPath: sourcePath,
        moduleSpecifier: specifier,
        sourcePath: resolvedPath,
        sourceDirectory: resolvedPath?.slice(0, resolvedPath.lastIndexOf('/')) || null,
        origin: owner,
      });
      if (clause?.name) {
        importedSymbols.push('default');
        registerComponent(clause.name.text);
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          importedSymbols.push(element.propertyName?.text ?? element.name.text);
          registerComponent(element.name.text);
        }
      } else if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        importedSymbols.push('*');
        registerComponent(clause.namedBindings.name.text);
      }
      imports.push({
        importerPath: sourcePath,
        specifier,
        resolvedPath,
        sourceDirectory: resolvedPath?.slice(0, resolvedPath.lastIndexOf('/')) || null,
        importedSymbols,
        owner,
        typeOnly: clause?.isTypeOnly ?? false,
      });
      if (owner === 'unverified') uncertain.push(`import-owner-unverified:${specifier}`);
    }

    const visit = (node: ts.Node, parentSectionId: string | null): void => {
      let currentSectionId = parentSectionId;
      let opening: ts.JsxOpeningLikeElement | null = null;
      if (ts.isJsxElement(node)) opening = node.openingElement;
      else if (ts.isJsxSelfClosingElement(node)) opening = node;

      if (opening) {
        if (ts.isIdentifier(opening.tagName) && /^[A-Z]/.test(opening.tagName.text)) {
          const name = opening.tagName.text;
          const imported = importedComponents.get(name);
          if (imported) {
            componentUses.set(`${name}@${node.getStart(sourceFile)}`, imported);
          } else if (localComponents.has(name)) {
            componentUses.set(`${name}@${node.getStart(sourceFile)}`, {
              name,
              importerPath: sourcePath,
              moduleSpecifier: null,
              sourcePath,
              sourceDirectory: sourcePath.slice(0, sourcePath.lastIndexOf('/')) || null,
              origin: sourceOrigin ?? 'unverified',
            });
            if (!sourceOrigin) uncertain.push(`component-origin-unverified:${sourcePath}:${name}`);
          } else {
            uncertain.push(`component-origin-unverified:${sourcePath}:${name}@${node.getStart(sourceFile)}`);
          }
        }
        const properties = opening.attributes.properties;
        const sectionAttribute = attribute(properties, 'data-ut-section-id');
        const sectionAlias = attribute(properties, 'data-ut-section');
        const sectionId = staticAttributeValue(sectionAttribute) ?? staticAttributeValue(sectionAlias);
        const sectionType = staticAttributeValue(attribute(properties, 'data-ut-section-type'));
        const variantAttribute = attribute(properties, 'data-ut-variant');
        const variantId = staticAttributeValue(variantAttribute);
        const layout = staticAttributeValue(attribute(properties, 'data-ut-layout'));

        if (sectionAttribute || sectionAlias || sectionType || variantAttribute) {
          const sourceDirectory = sourcePath.slice(0, sourcePath.lastIndexOf('/'));
          if (sectionType) {
            registryEvidence.push({
              registry: 'section-type',
              id: sectionType,
              status: Object.prototype.hasOwnProperty.call(getAllSections(), sectionType) ? 'registered' : 'unregistered',
              sourcePath,
              sourceDirectory,
              sourceOffset: node.getStart(sourceFile),
            });
          } else if (attribute(properties, 'data-ut-section-type')) {
            registryEvidence.push({
              registry: 'section-type', id: null, status: 'unverified', reason: 'section-type-is-dynamic',
              sourcePath, sourceDirectory, sourceOffset: node.getStart(sourceFile),
            });
          }

          if (variantId) {
            const implementation = getDesignImplementation(variantId);
            const familyMatches = !sectionType || implementation?.sectionType === sectionType;
            registryEvidence.push({
              registry: 'design-implementation',
              id: variantId,
              status: implementation && familyMatches ? 'registered' : 'unregistered',
              reason: implementation && !familyMatches
                ? `variant-family-mismatch:${implementation.sectionType}`
                : undefined,
              sourcePath,
              sourceDirectory,
              sourceOffset: node.getStart(sourceFile),
            });
          } else if (variantAttribute) {
            registryEvidence.push({
              registry: 'design-implementation', id: null, status: 'unverified', reason: 'variant-id-is-dynamic',
              sourcePath, sourceDirectory, sourceOffset: node.getStart(sourceFile),
            });
          }
        }

        const componentSlugAttribute = attribute(properties, 'data-ut-component-slug');
        if (componentSlugAttribute) {
          const componentSlug = staticAttributeValue(componentSlugAttribute);
          registryEvidence.push({
            registry: 'canonical-component',
            id: componentSlug,
            status: componentSlug
              ? getCanonicalComponentDefinition(componentSlug) ? 'registered' : 'unregistered'
              : 'unverified',
            reason: componentSlug ? undefined : 'component-slug-is-dynamic',
            sourcePath,
            sourceDirectory: sourcePath.slice(0, sourcePath.lastIndexOf('/')),
            sourceOffset: node.getStart(sourceFile),
          });
        }

        if (sectionId) {
          currentSectionId = sectionId;
          sections.push({ sectionId, semanticType: sectionType, variantId, layout, parentSectionId });
        } else if (sectionAttribute || sectionAlias || tagName(opening).toLowerCase() === 'section') {
          uncertain.push(`section-identity-not-static@${node.getStart(sourceFile)}`);
        }

        const tag = tagName(opening);
        if (/^(img|source|video)$/i.test(tag)) {
          const srcAttribute = attribute(properties, 'src');
          const src = staticAttributeValue(srcAttribute);
          if (src) {
            mediaUses.push({
              tag: tag.toLowerCase(),
              src,
              alt: staticAttributeValue(attribute(properties, 'alt')),
              sectionId: currentSectionId,
            });
          } else if (srcAttribute) {
            uncertain.push(`dynamic-media-source@${node.getStart(sourceFile)}`);
          }
        }
        if (attribute(properties, 'style')) uncertain.push(`dynamic-inline-style@${node.getStart(sourceFile)}`);
      }

      ts.forEachChild(node, (child) => visit(child, currentSectionId));
    };

    visit(sourceFile, null);
    pages[pageId] = {
      pageId,
      sourcePath,
      sourceHash: await input.hashSource(sourcePath, source),
      sections,
      mediaUses,
      imports,
      componentUses: [...new Map(
        [...componentUses.values()].map((component) => [
          `${component.name}|${component.moduleSpecifier}|${component.sourcePath}`,
          component,
        ]),
      ).values()],
      bindings: Object.values(input.bindings ?? {})
        .filter((binding) => binding.sourcePageId === pageId)
        .map((binding) => ({
          bindingId: binding.bindingId,
          elementKey: binding.elementKey ?? null,
          sourceSection: binding.sourceSection ?? null,
          sourceSlot: binding.sourceSlot ?? null,
          intent: binding.coreIntent ?? binding.intent,
          targetId: binding.targetId,
          targetType: binding.targetType,
          source: binding.source,
          valid: binding.isValid,
        })),
      registryEvidence,
      uncertain: [...new Set(uncertain)],
    };
  }

  const compositionHash = await input.hashSource('/.unison/effective-composition.json', JSON.stringify(pages));
  return {
    schemaVersion: '1.0',
    baseRevisionId: input.baseRevisionId,
    vfsHash: input.vfsHash,
    compositionHash,
    pages,
  };
}