/**
 * CI lint: enforce that all pipeline mutations route through commitToPipeline.
 *
 * Direct imports/usages of executeCanonicalPipeline / recompileFromPlayground
 * outside the allow-listed core module are bypasses and fail the build. It
 * also blocks new direct builder_drafts mutations outside the explicit,
 * transitional persistence owners below.
 *
 * PR4 — promotes the soft dev-mode warning installed by
 * installPipelineBypassGuard() into a hard CI failure.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

// Files that are *allowed* to call the raw pipeline entry points.
const ALLOWLIST = new Set([
  // Implementation of the canonical dispatcher itself
  'src/platform/core/canonicalPipeline.ts',
  'src/platform/core/commitToPipeline.ts',
  // Legacy re-export shim (kept until full removal)
  'src/services/canonicalPipeline.ts',
  'src/platform/core/pipelineGuard.ts',
]);

const FORBIDDEN_SYMBOLS = ['executeCanonicalPipeline', 'recompileFromPlayground'];

// Pass 1 — one seal point. Only the canonical launch assembler may convert a
// Stage 4b compile artifact into the sealed SiteBundleSnapshot.
const SEAL_SYMBOLS = ['sealSnapshot'];
const SEAL_ALLOWLIST = new Set([
  'src/platform/core/snapshotSeal.ts',
  'src/platform/core/index.ts',
  'src/services/canonicalLaunchVfs.ts',
]);

const DEPRECATED_PAGE_PRUNING_SYMBOLS = ['dropUnacceptablePages'];

export function findDeprecatedPagePruningUsages(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];
  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && DEPRECATED_PAGE_PRUNING_SYMBOLS.includes(node.expression.text)
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      usages.push({ line: position.line + 1, symbol: node.expression.text, text: node.getText(sourceFile) });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return usages;
}

export function findWizardRegistryMutationViolations(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];
  const recordsRegistryMutation = (node, target) => {
    const targetText = target.getText(sourceFile);
    if (!/\b(?:siteBundleSnapshot|generatedSiteBundleSnapshot)\.pageRegistry\.pages\b/.test(targetText)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    usages.push({ line: position.line + 1, symbol: 'Wizard pageRegistry mutation', text: node.getText(sourceFile) });
  };
  function visit(node) {
    if (ts.isBinaryExpression(node) && ts.isAssignmentOperator(node.operatorToken.kind)) {
      recordsRegistryMutation(node, node.left);
    } else if (ts.isDeleteExpression(node)) {
      recordsRegistryMutation(node, node.expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return usages;
}

export function findWizardHandoffSealViolations(text) {
  if (!text.includes('navigate("/web-builder"') && !text.includes("navigate('/web-builder'")) return [];
  if (
    (
      text.includes('isSealedSnapshot(artifacts.siteBundleSnapshot)')
      || text.includes('isSealedSnapshot(launchArtifacts.siteBundleSnapshot)')
    )
    && text.includes('isSealedSnapshot(canonicalSiteBundleSnapshot)')
  ) return [];
  return [{
    line: 1,
    symbol: 'unsealed Wizard handoff',
    text: 'Wizard navigation must verify both the launch artifact and committed snapshots are sealed.',
  }];
}

export function findSealViolations(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];
  function visit(node) {
    if (ts.isIdentifier(node) && SEAL_SYMBOLS.includes(node.text)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      usages.push({ line: position.line + 1, symbol: node.text, text: node.text });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return usages;
}


// Pass 5 — registries are COMPILER DEPENDENCIES, not co-authorities.
// Nothing outside the Stage 4b compiler surface may resolve a variant, a
// layout/motion recipe, or a section primitive. Everyone else dispatches a
// playground/presentation op and reads the sealed snapshot.
const DESIGN_RESOLUTION_SYMBOLS = [
  'getVariantById',
  'getDefaultVariant',
  'getVariantIdForLayout',
  'getLayoutForVariantId',
  'resolveVariantComponent',
  'preferredVariantForSection',
  'clampVariantToPack',
  'resolvePageComposition',
];
const DESIGN_RESOLUTION_ALLOWED_PREFIXES = [
  'src/platform/core/',
  'src/sections/',
  // Imported Loveable design-source bundle: declarative registry vocabulary
  // only. It cannot write a SiteBundleSnapshot or canonical VFS.
  'src/design-system/unison-x-loveable-design-d5be96/',
];
const DESIGN_RESOLUTION_ALLOWLIST = new Set([
  // Stage 4b compile + seal surface.
  'src/services/canonicalLaunchVfs.ts',
  'src/services/wizardDesignIntervention.ts',
  'src/services/templateLayoutContract.ts',
  'src/services/generatedSiteRuntimeManifest.ts',
  // The single legal presentation-op applier (validates ops against the seal).
  'src/services/vfsCommitService.ts',
  // Presentation-op validation is part of the canonical commit boundary.
  'src/services/builder/semanticPresentationOps.ts',
  // Read-only metadata consumers: inspect certification/states/tags and report
  // eligibility. None compiles components or writes canonical state.
  'src/services/builder/propertyInspectorModel.ts',
  'src/services/design/equivalenceLedger.ts',
  'src/services/launch/twentyFirstCoverageGate.ts',
  'src/services/requestAIPageComposition.ts',
  // Read-only launch-context projection. It filters registry metadata for the
  // composer; it cannot compile or persist a canonical artifact.
  'src/services/launch/wizardRegistryAggregation.ts',
  // Transitional: swap helper consumed by the compiler paths above.
  'src/utils/sectionSwapper.ts',
]);

function isDesignResolutionOwner(rel) {
  return (
    DESIGN_RESOLUTION_ALLOWLIST.has(rel) ||
    DESIGN_RESOLUTION_ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))
  );
}

export function findDesignResolutionViolations(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];
  function visit(node) {
    if (ts.isIdentifier(node) && DESIGN_RESOLUTION_SYMBOLS.includes(node.text)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      usages.push({ line: position.line + 1, symbol: node.text, text: node.text });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return usages;
}

// Pass 6 — no body substitution. Nothing may re-enable canonical page
// fallback, quarantine scaffolds, or preview import synthesis on a
// wizard-originated path. Resilience is allowed for regeneration, retry and
// diagnostics only — never for authoring or replacing a page body.
const BODY_SUBSTITUTION_RULES = [
  { property: 'allowCanonicalPageFallback', forbiddenValue: true },
  { property: 'allowQuarantine', forbiddenValue: true },
  { property: 'failOnMissingImport', forbiddenValue: false },
];
const BODY_SUBSTITUTION_ALLOWLIST = new Set([
  // Non-authoring importer of an already-authored external site.
  'src/services/export/importUnisonSiteZip.ts',
]);

export function findBodySubstitutionViolations(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const rule = BODY_SUBSTITUTION_RULES.find((r) => r.name === node.name.text || r.property === node.name.text);
      if (rule) {
        const literal =
          node.initializer.kind === ts.SyntaxKind.TrueKeyword
            ? true
            : node.initializer.kind === ts.SyntaxKind.FalseKeyword
              ? false
              : null;
        const isPreviewFirstFallback =
          rule.property === 'allowCanonicalPageFallback'
          && ts.isObjectLiteralExpression(node.parent)
          && node.parent.properties.some((property) =>
            ts.isPropertyAssignment(property)
            && ts.isIdentifier(property.name)
            && property.name.text === 'previewFirst'
            && property.initializer.kind === ts.SyntaxKind.TrueKeyword
          );
        if (literal === rule.forbiddenValue && !isPreviewFirstFallback) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          usages.push({
            line: position.line + 1,
            symbol: `${rule.property}: ${String(rule.forbiddenValue)}`,
            text: sourceFile.text.slice(node.getStart(sourceFile), node.getEnd()),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return usages;
}

// These modules predate the revision-backed writer migration. Keep this list
// deliberately small and shrink it as each writer moves behind commitMutation.
const BUILDER_DRAFT_MUTATION_ALLOWLIST = new Map([
  ['src/hooks/useTemplateFiles.ts', new Set(['insert', 'update', 'delete'])],
  ['src/components/onboarding/ImportUnisonSiteZipButton.tsx', new Set(['insert'])],
  // Deletes only orphaned legacy drafts as part of project lifecycle cleanup.
  ['src/components/cloud/CloudProjects.tsx', new Set(['delete'])],
  // Identity-only relink (business_id/updated_at) for drafts orphaned from
  // their owning business; content commits still go through
  // commit_canonical_site_revision (the canonical RPC), not this writer.
  ['src/services/draftBusinessLinkRepair.ts', new Set(['update'])],
  // Recovery creates the identity row and stores no VFS or revision content;
  // the reconstructed source stays in the local recovery journal until a
  // subsequent canonical commitMutation accepts it.
  ['src/services/legacyCloudProjectRecovery.ts', new Set(['insert'])],
]);
const BUILDER_DRAFT_MUTATION_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

export function findForbiddenUsages(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const usages = [];

  function visit(node) {
    if (ts.isIdentifier(node) && FORBIDDEN_SYMBOLS.includes(node.text)) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      usages.push({
        line: position.line + 1,
        symbol: node.text,
        text: sourceFile.text.slice(node.getStart(sourceFile), node.getEnd()),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

function isBuilderDraftFromCall(node) {
  return ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'from' &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === 'builder_drafts';
}

function containsBuilderDraftFrom(node) {
  let found = false;
  const visit = (current) => {
    if (found) return;
    if (isBuilderDraftFromCall(current)) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

export function findBuilderDraftMutations(text, fileName = 'source.ts') {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const mutations = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      BUILDER_DRAFT_MUTATION_METHODS.has(node.expression.name.text) &&
      containsBuilderDraftFrom(node.expression.expression)
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      mutations.push({
        line: position.line + 1,
        symbol: `builder_drafts.${node.expression.name.text}`,
        text: sourceFile.text.slice(node.getStart(sourceFile), node.getEnd()),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return mutations;
}

function collectViolations(dir) {
  const violations = [];

  function walk(currentDir) {
    for (const name of readdirSync(currentDir)) {
      const full = join(currentDir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      if (/\.test\.tsx?$|\.spec\.tsx?$/.test(name)) continue;
      const rel = relative(ROOT, full).split(sep).join('/');

      const text = readFileSync(full, 'utf8');
      for (const usage of findDeprecatedPagePruningUsages(text, full)) {
        violations.push({ file: rel, ...usage });
      }
      if (rel === 'src/components/onboarding/wizard/LauncherWizard.tsx') {
        for (const usage of findWizardRegistryMutationViolations(text, full)) {
          violations.push({ file: rel, ...usage });
        }
      }
      if (rel === 'src/components/onboarding/SystemLauncher.tsx') {
        for (const usage of findWizardRegistryMutationViolations(text, full)) {
          violations.push({ file: rel, ...usage });
        }
        for (const usage of findWizardHandoffSealViolations(text)) {
          violations.push({ file: rel, ...usage });
        }
      }
      if (!SEAL_ALLOWLIST.has(rel) && text.includes('sealSnapshot')) {
        for (const usage of findSealViolations(text, full)) {
          violations.push({ file: rel, ...usage });
        }
      }

      if (!isDesignResolutionOwner(rel) && DESIGN_RESOLUTION_SYMBOLS.some((sym) => text.includes(sym))) {
        for (const usage of findDesignResolutionViolations(text, full)) {
          violations.push({ file: rel, ...usage });
        }
      }

      if (
        !BODY_SUBSTITUTION_ALLOWLIST.has(rel) &&
        BODY_SUBSTITUTION_RULES.some((rule) => text.includes(rule.property))
      ) {
        for (const usage of findBodySubstitutionViolations(text, full)) {
          violations.push({ file: rel, ...usage });
        }
      }

      if (ALLOWLIST.has(rel)) continue;
      if (
        !FORBIDDEN_SYMBOLS.some((symbol) => text.includes(symbol)) &&
        !text.includes('builder_drafts')
      ) continue;

      for (const usage of findForbiddenUsages(text, full)) {
        violations.push({ file: rel, ...usage });
      }
      const allowedDraftMethods = BUILDER_DRAFT_MUTATION_ALLOWLIST.get(rel) ?? new Set();
      for (const mutation of findBuilderDraftMutations(text, full)) {
        const method = mutation.symbol.slice('builder_drafts.'.length);
        if (!allowedDraftMethods.has(method)) {
          violations.push({ file: rel, ...mutation });
        }
      }
    }
  }

  walk(dir);
  return violations;
}

function main() {
  const violations = collectViolations(SRC);

  if (violations.length === 0) {
    console.log('[lint-pipeline-bypass] OK — no bypasses found.');
    process.exit(0);
  }

  console.error(
    `\n[lint-pipeline-bypass] FAIL — ${violations.length} bypass(es) detected.\n` +
      `All pipeline mutations must route through commitToPipeline(input, source).\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  uses ${v.symbol}`);
    console.error(`    > ${v.text}`);
  }
  console.error(
    `\nFix: route canonical state through commitMutation; do not create a new direct builder_drafts writer.\n`,
  );
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
