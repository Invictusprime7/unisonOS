/**
 * Unison Variant Auto-Registration
 *
 * Every certified 21st.dev component is promoted through a declarative spec so
 * that it is written into ALL related Unison registries automatically:
 *
 *   1. src/sections/variants/registry.ts  — component import, jsxTemplates
 *      import, family entry (with 21st provenance) and layout alias
 *   2. public/variants/<thumb>.svg        — placeholder thumbnail if missing
 *   3. src/design/21st-intake/imported/<slug>/record.json — step 9 / promoted
 *   4. src/sections/variants/artDirectionPacks.ts — declared generation packs
 *
 * Specs live in src/design/21st-intake/promotions/*.json and re-running is
 * idempotent: anything already present is left untouched. All inputs are gated
 * before writes, and caught write errors restore prior file bytes. An interrupted process leaves a recovery journal; subsequent writes are blocked
 * until recovery. Individual files are not committed simultaneously. Step 9 records registration; archival is separate.
 *
 * Usage: node scripts/unison-variant-register.mjs [--check | --audit | --recover]
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { assertNoPendingPromotion, commitPromotion, recoverPromotion } from './promotion-transaction.mjs';
import { fileURLToPath } from 'node:url';
import { validateSourceProvenance } from '../src/design/21st-intake/provenanceValidation.mjs';


/** Check the actual TypeScript entry, never comments or string fragments. */
export function validateRegistrySpec(text, spec) {
  const file = ts.createSourceFile('registry.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const issues = file.parseDiagnostics.map(d => 'registry syntax: ' + ts.flattenDiagnosticMessageText(d.messageText, ' '));
  const property = (node, key) => node && ts.isObjectLiteralExpression(node)
    ? node.properties.find(p => ts.isPropertyAssignment(p) && p.name?.text === key)?.initializer : undefined;
  const literal = node => node && ts.isStringLiteral(node) ? node.text : undefined;
  const entries = [];
  const imports = new Map();
  let aliases;
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        imports.set(binding.name.text, { path: node.moduleSpecifier.text, name: (binding.propertyName ?? binding.name).text });
      }
    }
    if (ts.isObjectLiteralExpression(node) && literal(property(node, 'id')) === spec.id) entries.push(node);
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'VARIANT_LAYOUT_ALIASES') aliases = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (entries.length !== 1) issues.push('expected exactly one registered entry; found ' + entries.length);
  const entry = entries[0];
  if (entry) {
    for (const [key, value] of Object.entries({ sectionType: spec.sectionType, slug: spec.slug, generationStatus: spec.generationStatus ?? 'preferred', thumbnail: spec.thumbnail })) {
      if (literal(property(entry, key)) !== value) issues.push('registry ' + key + ' differs from promotion spec');
    }
    for (const [key, name, source] of [['component', spec.componentName, spec.componentPath], ['renderJSX', spec.jsxFn, spec.jsxFn === 'portableRecipeOnly' ? './portableRecipeOnly' : './jsxTemplates']]) {
      const expression = property(entry, key);
      if (!expression || !ts.isIdentifier(expression) || expression.text !== name) issues.push('registry ' + key + ' differs from promotion spec');
      const binding = imports.get(name);
      if (binding?.path !== source || binding?.name !== name) issues.push('registry ' + key + ' import does not resolve to the declared implementation');
    }
    const vfs = property(entry, 'vfs');
    if (literal(property(vfs, 'mode')) !== 'portable-recipe' || (!spec.retirement && literal(property(vfs, 'certification')) !== 'approved')) issues.push('registry portable recipe is not approved');
    const source = property(entry, 'source');
    for (const [key, value] of Object.entries(spec.source)) {
      if (value !== undefined && literal(property(source, key)) !== value) issues.push('registry source.' + key + ' differs from promotion spec');
    }
    const registeredAliases = property(aliases, spec.id);
    if (!registeredAliases || !ts.isArrayLiteralExpression(registeredAliases) || (spec.aliases ?? [spec.slug]).some(alias => !registeredAliases.elements.some(element => literal(element) === alias))) issues.push('registry layout aliases differ from promotion spec');
  }
  return issues.map(issue => spec.id + ': ' + issue);
}

export function registerVariants(ROOT, { checkOnly = false, auditOnly = false, fileSystem = fs } = {}) {
assertNoPendingPromotion(ROOT);
const writes = new Map();
const SPEC_DIR = path.join(ROOT, 'src/design/21st-intake/promotions');
const REGISTRY = path.join(ROOT, 'src/sections/variants/registry.ts');
const ART_DIRECTION_PACKS = path.join(ROOT, 'src/sections/variants/artDirectionPacks.ts');
const IMPORTED_DIR = path.join(ROOT, 'src/design/21st-intake/imported');


const changes = [];

function familyKey(sectionType) {
  return /^[a-zA-Z][a-zA-Z0-9]*$/.test(sectionType) ? sectionType : `'${sectionType}'`;
}

function entrySource(spec) {
  const src = spec.source;
  const tags = spec.tags.map((t) => `'${t}'`).join(', ');
  const roles = (spec.pageRoles || []).map((r) => `'${r}'`).join(', ');
  return `    {
      id: '${spec.id}',
      sectionType: '${spec.sectionType}',
      slug: '${spec.slug}',
      name: '${spec.name}',
      description: '${spec.description.replace(/'/g, "\\'")}',
      component: ${spec.componentName},
      vfs: { mode: 'portable-recipe', certification: 'approved' },
      source: {
        origin: '${src.origin}',
        derivation: '${src.derivation ?? 'source-adaptation'}',
        sourceId: '${src.sourceId}',
        sourceUrl: '${src.sourceUrl}',
        author: '${src.author}',
        license: '${src.license}',
        adaptationVersion: '${src.adaptationVersion}',
      },
      generationStatus: '${spec.generationStatus || 'preferred'}',
      thumbnail: '${spec.thumbnail}',
      tags: [${tags}],${roles ? `\n      pageRoles: [${roles}],` : ''}${spec.radixPrimitives ? `\n      radixPrimitives: [${spec.radixPrimitives.map((r) => `'${r}'`).join(', ')}],` : ''}
      renderJSX: ${spec.jsxFn},
    },
`;
}

function registerInRegistry(spec, text) {
  let out = text;

  // 1. Renderer import (canonical portable recipes or legacy JSX).
  if (spec.jsxFn === 'portableRecipeOnly' && !/import \{ portableRecipeOnly \} from '\.\/portableRecipeOnly'/.test(out)) out = `import { portableRecipeOnly } from './portableRecipeOnly';\n` + out;
  if (!new RegExp(`\\b${spec.jsxFn}\\b`).test(out)) {
    out = out.replace(
      /\n\} from '\.\/jsxTemplates';/,
      `\n  ${spec.jsxFn},\n} from './jsxTemplates';`,
    );
    changes.push(`${spec.id}: jsxTemplates import`);
  }

  // 2. component import
  const importLine = `import { ${spec.componentName} } from '${spec.componentPath}';`;
  if (!out.includes(importLine)) {
    out = out.replace(
      /\n\} from '\.\/jsxTemplates';\n/,
      `\n} from './jsxTemplates';\n\n// 21st.dev certified variant: ${spec.id}\n${importLine}\n`,
    );
    changes.push(`${spec.id}: component import`);
  }

  // 3. family entry. Existing entries are validated below rather than silently
  // rewritten, preserving the compatibility-review boundary against drift.
  if (!out.includes(`id: '${spec.id}'`)) {
    const key = familyKey(spec.sectionType);
    const marker = new RegExp(`\\n  ${key.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&')}: \\[\\n`);
    if (!marker.test(out)) throw new Error(`Family array not found for ${spec.sectionType}`);
    out = out.replace(marker, (m) => `${m}${entrySource(spec)}`);
    changes.push(`${spec.id}: registry entry`);
  }

  // 4. layout alias
  if (!out.includes(`'${spec.id}': [`)) {
    const aliases = (spec.aliases || [spec.slug]).map((a) => `'${a}'`).join(', ');
    out = out.replace(
      /const VARIANT_LAYOUT_ALIASES: Partial<Record<VariantId, readonly string\[\]>> = \{\n/,
      (m) => `${m}  '${spec.id}': [${aliases}],\n`,
    );
    changes.push(`${spec.id}: layout alias`);
  }

  return out;
}

function registerInArtDirectionPacks(spec, text) {
  if (!spec.artDirection?.all) return text;
  let touched = 0;
  if (spec.sectionType === 'navbar') {
    const out = text.replace(/(\n\s+)navbarFamily: \[([^\]]*)\]/g, (match, indent, body) => {
      touched += 1;
      if (body.includes(`'${spec.id}'`)) return match;
      const next = spec.artDirection.position === 'first'
        ? `'${spec.id}',${body}`
        : `${body.trimEnd()}, '${spec.id}'`;
      return `${indent}navbarFamily: [${next}]`;
    });
    if (!touched) throw new Error('No art-direction families found for navbar');
    if (out !== text) changes.push(`${spec.id}: ${touched} art-direction packs`);
    return out;
  }
  const out = text.replace(/(\n\s+)([a-zA-Z'-]+): \[([^\]]*)\]/g, (match, indent, family, body) => {
    const normalizedFamily = family.replaceAll("'", '');
    if (normalizedFamily !== spec.sectionType) return match;
    touched += 1;
    if (body.includes(`'${spec.id}'`)) return match;
    const next = spec.artDirection.position === 'first'
      ? `'${spec.id}',${body}`
      : `${body.trimEnd()}, '${spec.id}'`;
    return `${indent}${family}: [${next}]`;
  });
  if (!touched) throw new Error(`No art-direction families found for ${spec.sectionType}`);
  const expected = (out.match(new RegExp(`'${spec.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) || []).length;
  if (expected < touched) throw new Error(`${spec.id}: art-direction registration incomplete`);
  if (out !== text) changes.push(`${spec.id}: ${touched} art-direction packs`);
  return out;
}

function writeThumbnail(spec) {
  const file = path.join(ROOT, 'public', spec.thumbnail.replace(/^\//, ''));
  if (fs.existsSync(file)) return;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" role="img" aria-label="${spec.name}">
  <rect width="320" height="200" fill="#f4f4f5"/>
  <rect x="20" y="24" width="140" height="14" rx="7" fill="#d4d4d8"/>
  <rect x="20" y="48" width="220" height="10" rx="5" fill="#e4e4e7"/>
  <rect x="20" y="82" width="86" height="94" rx="10" fill="#e4e4e7"/>
  <rect x="117" y="82" width="86" height="94" rx="10" fill="#d4d4d8"/>
  <rect x="214" y="82" width="86" height="94" rx="10" fill="#e4e4e7"/>
</svg>
`;
  writes.set(file, svg);
  changes.push(`${spec.id}: thumbnail`);
}

function updateRecord(spec) {
  if (!spec.recordSlug) return;
  const file = path.join(IMPORTED_DIR, spec.recordSlug, 'record.json');
  if (!fs.existsSync(file)) return;
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const promoted = new Set(record.promotedVariants || []);
  if ((record.step === 9 || record.step === 10) && record.status === 'promoted' && record.implementationId === spec.id && promoted.has(spec.id)) return;
  promoted.add(spec.id);
  record.step = 9;
  record.implementationId = spec.id;
  record.status = 'promoted';
  record.promotedVariants = [...promoted];
  writes.set(file, `${JSON.stringify(record, null, 2)}\n`);
  changes.push(`${spec.id}: intake record`);
}

function main() {
  if (!fs.existsSync(SPEC_DIR)) {
    console.log('No promotion specs found.');
    return;
  }
  const specs = fs
    .readdirSync(SPEC_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8')));

  const issues = [];
  for (const key of ['id', 'recordSlug']) {
    const seen = new Set();
    for (const spec of specs) {
      if (seen.has(spec[key])) issues.push('Duplicate promotion ' + key + ': ' + spec[key]);
      seen.add(spec[key]);
    }
  }
  for (const spec of specs) {
    if (!/^[a-z0-9-]+$/.test(spec.recordSlug ?? '')) { issues.push(spec.id + ': invalid or missing recordSlug'); continue; }
    const recordFile = path.join(IMPORTED_DIR, spec.recordSlug, 'record.json');
    if (!fs.existsSync(recordFile)) { issues.push(spec.id + ': missing intake record'); continue; }
    const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
    if (spec.retirement) {
      if (spec.generationStatus !== 'legacy' || record.status !== 'retired' || !spec.retirement.reason || !spec.retirement.evidence) issues.push(spec.id + ': retirement disposition is incomplete');
      if (record.sourceId !== spec.source?.sourceId || record.sourceUrl !== spec.source?.sourceUrl) issues.push(spec.id + ': retired source identity differs');
      continue;
    }
    issues.push(...validateSourceProvenance(record).map(issue => spec.id + ': ' + issue));
    if (record.sourceId !== spec.source?.sourceId || record.sourceUrl !== spec.source?.sourceUrl || record.license !== spec.source?.license) issues.push(spec.id + ': source provenance differs from intake record');
    if (record.adaptation?.portableRecipeCertified !== true || !['tokensNormalized', 'importsNormalized', 'reducedMotionSupported', 'responsiveVerified', 'canonicalSlotsAdded', 'intentReady'].every(key => record.adaptation?.[key] === true)) issues.push(spec.id + ': canonical adaptation is not certified');
    if (record.implementationId && record.implementationId !== spec.id) issues.push(spec.id + ': intake record belongs to another implementation');
    if (spec.id !== spec.sectionType + ':' + spec.slug || !/^[a-z0-9-]+:[a-z0-9-]+$/.test(spec.id)) issues.push(spec.id + ': invalid implementation identity');
    if (!/^\.\/[a-z0-9-]+\/[A-Za-z0-9]+$/.test(spec.componentPath ?? '') || !fs.existsSync(path.join(ROOT, 'src/sections/variants', spec.componentPath + '.tsx'))) issues.push(spec.id + ': canonical component missing or invalid');
    const recipes = fs.readFileSync(path.join(ROOT, spec.jsxFn === 'portableRecipeOnly' ? 'src/sections/variants/portableRecipeOnly.ts' : 'src/sections/variants/jsxTemplates.ts'), 'utf8');
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(spec.jsxFn ?? '') || !recipes.includes('function ' + spec.jsxFn + '(')) issues.push(spec.id + ': portable recipe missing');
    if (!/^\/variants\/[a-z0-9-]+\.svg$/.test(spec.thumbnail ?? '')) issues.push(spec.id + ': invalid thumbnail path');
  }
  let registry = fs.readFileSync(REGISTRY, 'utf8');
  const hasArtDirections = fs.existsSync(ART_DIRECTION_PACKS);
  let artDirections = hasArtDirections ? fs.readFileSync(ART_DIRECTION_PACKS, 'utf8') : '';
  if (auditOnly) {
    for (const spec of specs) {
      issues.push(...validateRegistrySpec(registry, spec));
      if (spec.artDirection?.all && hasArtDirections) {
        const familyPattern = spec.sectionType === 'navbar' ? 'navbarFamily: \\[' : `\\b${spec.sectionType}: \\[`;
        const familyCount = (artDirections.match(new RegExp(familyPattern, 'g')) || []).length;
        const variantCount = (artDirections.match(new RegExp(`'${spec.id}'`, 'g')) || []).length;
        if (!familyCount || variantCount < familyCount) issues.push(`${spec.id}: missing from one or more art-direction packs`);
      }
    }
    return { valid: issues.length === 0, specCount: specs.length, retiredCount: specs.filter(spec => spec.retirement).length, issues, pending: 0, changes: [] };
  }
  if (issues.length) throw new Error('Promotion blocked before writes:\n' + issues.join('\n'));
  for (const spec of specs) {
    registry = registerInRegistry(spec, registry);
    if (hasArtDirections) artDirections = registerInArtDirectionPacks(spec, artDirections);
    if (!registry.includes("id: '" + spec.id + "'") || !registry.includes("import { " + spec.componentName + " } from '" + spec.componentPath + "';") || !registry.includes("'" + spec.id + "': [")) throw new Error(spec.id + ': registry insertion failed before writes');
    const registryIssues = validateRegistrySpec(registry, spec);
    if (registryIssues.length) throw new Error('Promotion blocked before writes:\n' + registryIssues.join('\n'));
    if (!spec.retirement) { writeThumbnail(spec); updateRecord(spec); }
  }
  if (registry !== fs.readFileSync(REGISTRY, 'utf8')) writes.set(REGISTRY, registry);
  if (hasArtDirections && artDirections !== fs.readFileSync(ART_DIRECTION_PACKS, 'utf8')) writes.set(ART_DIRECTION_PACKS, artDirections);
  if (!checkOnly) commitPromotion(ROOT, writes, fileSystem);

  if (!changes.length) {
    console.log(`✓ ${specs.length} variant spec(s) already registered.`);
    return;
  }
  console.log(`${checkOnly ? 'Pending' : 'Applied'} registrations:`);
  for (const c of changes) console.log(`  - ${c}`);
  return { pending: changes.length, changes };
}

return main() ?? { pending: 0, changes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    if (process.argv.includes('--recover')) { console.log(recoverPromotion(root) ? 'Interrupted promotion restored.' : 'No interrupted promotion.'); process.exit(0); }
    const result = registerVariants(root, { checkOnly: process.argv.includes('--check'), auditOnly: process.argv.includes('--audit') });
    if (process.argv.includes('--audit')) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
    }
    if (process.argv.includes('--check') && result.pending) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
