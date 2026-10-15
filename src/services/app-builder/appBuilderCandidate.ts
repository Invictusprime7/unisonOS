/** Candidate-only, mutation-free site-wide closure checks for App Builder. */

import { APP_BUILDER_GENERATION_PREFIXES } from '@/contracts/aiComposerContract';
import {
  findLocalJsxImportContractViolations,
  findUnresolvedLocalImports,
} from '@/services/laneBCompanionModules';
import {
  createSiteVisualMemory,
  extractCompositionSignature,
  findRedundancy,
} from '@/services/composition';
import { enforceSiteDesignContract } from '@/services/launch/homepageFirstContract';
import { assertSiteShellClosure, buildSiteShellTopology } from '@/services/siteShellTopology';
import type {
  AppBuildCandidateClosureIssue,
  AppBuildCandidateClosureReport,
  AppBuildContract,
} from './appBuilderContracts';

function stableSourceHash(files: Readonly<Record<string, string>>): string {
  let hash = 0x811c9dc5;
  for (const path of Object.keys(files).sort()) {
    const value = `${path}\0${files[path]}\0`;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
}

/** Attribute names (or '...' for a spread) on every JSX usage of a component. */
function jsxUsages(source: string, name: string): Array<{ names: string[]; raw: string }> {
  const usages: Array<{ names: string[]; raw: string }> = [];
  const opener = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const ch = source[end];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0 && source[end - 1] !== '=') break;
    }
    const attrs = source.slice(match.index + match[0].length, end);
    const names: string[] = [];
    let level = 0;
    for (let i = 0; i < attrs.length; i += 1) {
      const ch = attrs[i];
      if (ch === '{') {
        if (level === 0 && /^\{\s*\.\.\./.test(attrs.slice(i))) names.push('...');
        level += 1;
      } else if (ch === '}') level -= 1;
      else if (level === 0 && /[A-Za-z_]/.test(ch) && !/[\w$-]/.test(attrs[i - 1] ?? ' ')) {
        const ident = /^[\w-]+/.exec(attrs.slice(i))![0];
        names.push(ident);
        i += ident.length - 1;
      }
    }
    usages.push({ names, raw: attrs });
  }
  return usages;
}

function attributeValue(raw: string, prop: string): string | undefined {
  const start = new RegExp(String.raw`(?<![\w-])${prop}\s*=\s*\{`).exec(raw);
  if (!start) return undefined;
  let depth = 1;
  let i = start.index + start[0].length;
  for (; i < raw.length && depth > 0; i += 1) {
    if (raw[i] === '{') depth += 1;
    else if (raw[i] === '}') depth -= 1;
  }
  return raw.slice(start.index + start[0].length, i - 1).trim();
}

/** Design-source usage problems in one page source, checked against the materialized manifest. */
export function findDesignSourceUsageIssues(manifestSource: string | undefined, source: string | undefined): Array<{ code: string; message: string }> {
  if (!manifestSource || !source) return [];
  let implementations: Record<string, { exportName?: string; props?: string }> = {};
  try { implementations = JSON.parse(manifestSource).implementations ?? {}; } catch { return []; }
  const issues: Array<{ code: string; message: string }> = [];
  for (const entry of Object.values(implementations)) {
    if (!entry.exportName || !entry.props) continue;
    const name = entry.exportName;
    const hint = entry.props;
    if (!new RegExp(String.raw`<${name}(?=[\s/>])`).test(source)) continue;
    const arrays = hint.split(', ').flatMap((token) => {
      const parsed = /^(\w+)(\?)?\[\](?:\{(.*)\})?$/.exec(token);
      if (!parsed || parsed[2]) return [];
      const required = (parsed[3] ?? '').split('|').filter((field) => field && !field.includes('?'));
      return [{ prop: parsed[1], required }];
    });
    for (const { names, raw } of jsxUsages(source, name)) {
      const block = (code: string, message: string) => issues.push({ code, message: `<${name}>: ${message} Expected props: ${hint} (name[]{a|b?}: array of objects, ? = optional).` });
      if (/<\s*(?:h[1-6]|p|div|section)\b/.test(raw)) {
        block('design-source-nested-block', 'a text prop contains block markup (h1-h6/p/div). Pass plain strings; the section supplies the heading element.');
      }
      const missing = arrays.filter(({ prop }) => !names.includes(prop)).map(({ prop }) => prop);
      if (missing.length && !names.includes('...')) {
        block('design-source-missing-props', `missing required array props: ${missing.join(', ')}.`);
        continue;
      }
      for (const { prop, required } of arrays) {
        const value = attributeValue(raw, prop);
        if (value === undefined) continue;
        if (/^\[\s*\]$/.test(value)) {
          block('design-source-empty-array', `${prop} is empty. Provide real items with ${required.join(', ') || 'content'}.`);
        } else if (value.startsWith('[') && required.length) {
          const absent = required.filter((field) => !new RegExp(String.raw`(?:^|[\s,{])${field}\s*[:,}]`).test(value));
          if (absent.length) block('design-source-incomplete-items', `${prop} items are missing required field(s): ${absent.join(', ')}.`);
        }
      }
    }
  }
  return issues;
}

function isProtected(path: string, protectedPaths: readonly string[]): boolean {
  return protectedPaths.some((protectedPath) =>
    path === protectedPath || path.startsWith(`${protectedPath.replace(/\/$/, '')}/`));
}

/** Generation scope: App Builder can only write to these directories */
function isAllowedGenerationPath(path: string): boolean {
  return APP_BUILDER_GENERATION_PREFIXES.some((prefix) => path.startsWith(prefix));
}

interface BindingGuideRequirement {
  route: string;
  intent: string;
  markers: string[];
}

/**
 * The canonical binder owns conversion from `data-ut-cta` to `data-ut-intent`.
 * App Builder must still put every selected action on its requested source
 * surface. Read the deterministic binding guide rather than duplicating the
 * binding planner in the authoring lane.
 */
function bindingGuideRequirements(guide: string): BindingGuideRequirement[] {
  const requirements: BindingGuideRequirement[] = [];
  for (const line of guide.split(/\r?\n/)) {
    const page = /^-\s+Page\s+.+?\s+\((\/[^)]*)\),\s+slot\s+.*?:\s+label\s+.*?,\s+marker\s+(.+?),\s+intent\s+([\w.-]+)/.exec(line);
    if (!page) continue;
    const markers = [...page[2].matchAll(/data-ut-cta="([^"]+)"/g)].map((match) => match[1]);
    if (markers.length) requirements.push({ route: page[1] || '/', markers, intent: page[3] });
  }
  return requirements;
}

function hasCtaMarker(source: string, marker: string): boolean {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`data-ut-cta\\s*=\\s*(?:["']${escaped}["']|\\{\\s*["']${escaped}["']\\s*\\})`).test(source);
}

const APP_BUILDER_SOURCE_PATH = /^\/src\/(?:pages|project-components|components\/generated)\/.+\.[jt]sx?$/;
const NAV_DESCRIPTOR_KEYS = ['dataUiPath', 'href', 'intent', 'text'];

async function findInvalidReactChildIssues(
  files: Readonly<Record<string, string>>,
): Promise<AppBuildCandidateClosureIssue[]> {
  const sourceFiles = Object.entries(files).filter(([path]) => APP_BUILDER_SOURCE_PATH.test(path));
  if (sourceFiles.length === 0) return [];

  const tsModule = await import('typescript');
  const ts = tsModule.default;
  const descriptorNames = new Set<string>();
  const descriptorAliases: Array<[string, string]> = [];
  const descriptorProperties = new Set<string>();
  const unwrap = (node: import('typescript').Expression): import('typescript').Expression => {
    let current = node;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };
  const propertyName = (name: import('typescript').PropertyName | undefined): string | null => {
    if (!name) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return null;
  };
  const isDescriptorObject = (node: import('typescript').Expression): boolean => {
    const expression = unwrap(node);
    if (ts.isObjectLiteralExpression(expression)) {
      const names = new Set(expression.properties.flatMap((property) => {
        if (!ts.isPropertyAssignment(property)) return [];
        const key = propertyName(property.name);
        return key ? [key] : [];
      }));
      for (const property of expression.properties) {
        if (ts.isShorthandPropertyAssignment(property)) names.add(property.name.text);
      }
      return NAV_DESCRIPTOR_KEYS.every((key) => names.has(key));
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.some((element) => ts.isExpression(element) && isDescriptorObject(element));
    }
    return false;
  };

  for (const [vfsPath, source] of sourceFiles) {
    const sourceFile = ts.createSourceFile(vfsPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const inspectDeclarations = (node: import('typescript').Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = unwrap(node.initializer);
        if (isDescriptorObject(initializer)) {
          descriptorNames.add(node.name.text);
        } else if (ts.isIdentifier(initializer)) {
          descriptorAliases.push([node.name.text, initializer.text]);
        } else if (ts.isObjectLiteralExpression(initializer)) {
          for (const property of initializer.properties) {
            if (!ts.isPropertyAssignment(property) || !isDescriptorObject(property.initializer)) continue;
            const key = propertyName(property.name);
            if (key) descriptorProperties.add(`${node.name.text}.${key}`);
          }
        }
      }
      ts.forEachChild(node, inspectDeclarations);
    };
    inspectDeclarations(sourceFile);
  }
  let aliasesChanged = true;
  while (aliasesChanged) {
    aliasesChanged = false;
    for (const [alias, target] of descriptorAliases) {
      if (descriptorNames.has(target) && !descriptorNames.has(alias)) {
        descriptorNames.add(alias);
        aliasesChanged = true;
      }
    }
  }

  const issues: AppBuildCandidateClosureIssue[] = [];
  const addIssue = (vfsPath: string) => {
    if (issues.some((issue) => issue.path === vfsPath && issue.code === 'jsx-child-not-renderable')) return;
    issues.push({
      severity: 'blocker',
      code: 'jsx-child-not-renderable',
      path: vfsPath,
      message: `${vfsPath} renders a navigation descriptor object as JSX children. Render its text field or map links to elements instead.`,
    });
  };
  for (const [vfsPath, source] of sourceFiles) {
    const sourceFile = ts.createSourceFile(vfsPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const isDescriptorReference = (node: import('typescript').Expression, localNames: ReadonlySet<string>) => {
      const expression = unwrap(node);
      if (isDescriptorObject(expression)) return true;
      if (ts.isIdentifier(expression)) return descriptorNames.has(expression.text) || localNames.has(expression.text);
      if (ts.isPropertyAccessExpression(expression)) {
        const chain = expression.expression.getText(sourceFile) + '.' + expression.name.text;
        return descriptorProperties.has(chain);
      }
      return false;
    };
    const visit = (
      node: import('typescript').Node,
      localNames: ReadonlySet<string>,
      renderedChild = false,
    ) => {
      if (ts.isJsxExpression(node)) {
        const isChild = Boolean(
          node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)),
        );
        if (isChild && node.expression && isDescriptorReference(node.expression, localNames)) {
          addIssue(vfsPath);
        }
        if (node.expression) visit(node.expression, localNames, isChild);
        return;
      }

      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'map' && node.arguments[0]) {
        const callback = node.arguments[0];
        const sourceIsDescriptor = isDescriptorReference(node.expression.expression, localNames);
        if (sourceIsDescriptor && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const nextNames = new Set(localNames);
          const itemParameter = callback.parameters[0]?.name;
          if (itemParameter && ts.isIdentifier(itemParameter)) nextNames.add(itemParameter.text);
          const findReturnedDescriptor = (body: import('typescript').ConciseBody | import('typescript').Block) => {
            if (!ts.isBlock(body)) return isDescriptorReference(body, nextNames);
            let found = false;
            const findReturn = (child: import('typescript').Node) => {
              if (found) return;
              if (ts.isReturnStatement(child) && child.expression && isDescriptorReference(child.expression, nextNames)) {
                found = true;
                return;
              }
              ts.forEachChild(child, findReturn);
            };
            findReturn(body);
            return found;
          };
          if (renderedChild && findReturnedDescriptor(callback.body)) addIssue(vfsPath);
          if (ts.isBlock(callback.body)) {
            ts.forEachChild(callback.body, (child) => visit(child, nextNames, renderedChild));
          } else {
            visit(callback.body, nextNames, renderedChild);
          }
          return;
        }
      }
      ts.forEachChild(node, (child) => visit(child, localNames, renderedChild));
    };
    visit(sourceFile, new Set());
  }
  return issues;
}

export async function validateAppBuildCandidate(input: {
  contract: AppBuildContract;
  files: Readonly<Record<string, string>>;
  initialFiles: Readonly<Record<string, string>>;
}): Promise<AppBuildCandidateClosureReport> {
  const files = { ...input.files };
  const issues: AppBuildCandidateClosureIssue[] = [];
  const pages = input.contract.topology.sitePlan.pages;

  // Validate generation scope: App Builder can only generate in allowed directories
  const generatedFiles = Object.keys(files).filter((path) => !input.initialFiles[path]);
  for (const path of generatedFiles) {
    if (!isAllowedGenerationPath(path)) {
      issues.push({
        severity: 'blocker',
        code: 'generation-scope-violation',
        path,
        message: `App Builder generated content outside allowed scope. Only /src/pages/*, /src/project-components/*, and /src/components/generated/* are permitted. Found: ${path}`,
      });
    }
  }

  for (const page of pages) {
    if (!files[page.filePath]?.trim()) {
      issues.push({
        severity: 'blocker',
        code: 'page-body-missing',
        path: page.filePath,
        message: `${page.title} has no authored candidate source at ${page.filePath}.`,
      });
    }
  }

  for (const requirement of bindingGuideRequirements(input.contract.business.bindingGuide)) {
    const page = pages.find((candidate) => candidate.route === requirement.route);
    const source = page ? files[page.filePath] : undefined;
    if (!page || !source || !requirement.markers.some((marker) => hasCtaMarker(source, marker))) {
      issues.push({
        severity: 'blocker',
        code: 'wizard-binding-marker-missing',
        path: page?.filePath,
        message: `Wizard-selected intent ${requirement.intent} needs one of ${requirement.markers.map((marker) => `data-ut-cta="${marker}"`).join(', ')} on ${requirement.route}. The canonical binder will stamp its data-ut-intent after this candidate closes.`,
      });
    }
  }

  const allPaths = new Set([...Object.keys(input.initialFiles), ...Object.keys(files)]);
  for (const path of allPaths) {
    if (!isProtected(path, input.contract.runtime.protectedPaths)) continue;
    if (input.initialFiles[path] !== files[path]) {
      issues.push({
        severity: 'blocker',
        code: 'protected-source-changed',
        path,
        message: `${path} is canonical infrastructure and changed inside the application candidate.`,
      });
    }
  }

  for (const unresolved of findUnresolvedLocalImports(files)) {
    issues.push({
      severity: 'blocker',
      code: 'module-closure-unresolved-import',
      path: unresolved.filePath,
      message: `${unresolved.filePath} imports unresolved module "${unresolved.importPath}".`,
    });
  }
  issues.push(...await findInvalidReactChildIssues(files));
  for (const violation of findLocalJsxImportContractViolations(files)) {
    issues.push({
      severity: 'blocker',
      code: `module-closure-${violation.kind}`,
      path: violation.filePath,
      message: `${violation.filePath} imports ${violation.symbol} from ${violation.importPath}, but that export is unavailable.`,
    });
  }

  const RECIPE_IMPORT = /import\s[^;]*?from\s+['"]([^'"]*\/recipes\/[^'"]*)['"]|\bREGISTERED_VARIANTS\b/g;
  for (const [path, source] of Object.entries(files)) {
    if (!isAllowedGenerationPath(path) || !/\.(?:tsx?|jsx?)$/.test(path)) continue;
    if (RECIPE_IMPORT.test(source)) {
      issues.push({
        severity: 'blocker',
        code: 'recipe-internal-import',
        path,
        message: `${path} reaches into recipe internals. Import variant components by name from @/unison/design-sources/<Family> instead of recipes/ or REGISTERED_VARIANTS.`,
      });
    }
    RECIPE_IMPORT.lastIndex = 0;
  }

  const manifestSource = files['/.unison/design-source-manifest.json'] ?? input.initialFiles['/.unison/design-source-manifest.json'];
  for (const page of pages) {
    for (const found of findDesignSourceUsageIssues(manifestSource, files[page.filePath])) {
      issues.push({ severity: 'blocker', code: found.code, path: page.filePath, message: `${page.filePath} ${found.message}` });
    }
  }

  const registry = input.contract.topology.pageRegistry;
  if (Object.keys(registry.pages).length > 0) {
    const pageSources = Object.fromEntries(
      pages.filter((page) => files[page.filePath]).map((page) => [page.filePath, files[page.filePath]]),
    );
    const routerSource = files['/src/App.tsx'] ?? '';
    const parsedRoutes = Array.from(routerSource.matchAll(/path=["']([^"']+)["']/g)).map((match) => match[1]);
    const shellIssues = assertSiteShellClosure(buildSiteShellTopology(registry), {
      pageSources,
      routerRoutes: parsedRoutes.length ? parsedRoutes : undefined,
    });
    for (const issue of shellIssues) {
      issues.push({
        severity: issue.code === 'missing-nav-link' ? 'advisory' : 'blocker',
        code: `site-shell-${issue.code}`,
        path: issue.path,
        message: issue.message,
      });
    }
  }

  const home = pages.find((page) => page.isHome || page.id === input.contract.topology.sitePlan.homePageId);
  const affinity = enforceSiteDesignContract({ files, homePath: home?.filePath });
  for (const message of affinity.violations) {
    issues.push({ severity: 'blocker', code: 'site-design-affinity', message });
  }
  for (const message of affinity.advisories) {
    issues.push({ severity: 'advisory', code: 'site-design-advisory', message });
  }

  const memory = createSiteVisualMemory();
  for (const page of pages) {
    const signature = extractCompositionSignature(files[page.filePath]);
    const redundant = findRedundancy(page.id, signature, memory.entries());
    if (redundant) {
      issues.push({
        severity: 'blocker',
        code: 'site-composition-redundant',
        path: page.filePath,
        message: redundant.reason,
      });
    }
    memory.record(page.id, page.role, signature);
  }

  return {
    version: '1.0',
    ok: !issues.some((issue) => issue.severity === 'blocker'),
    sourceHash: stableSourceHash(files),
    issues,
  };
}
