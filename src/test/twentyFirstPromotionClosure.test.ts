import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { recoverPromotion } from '../../scripts/promotion-transaction.mjs';
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerVariants, validateRegistrySpec } from '../../scripts/unison-variant-register.mjs';

const roots: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unison-promotion-'));
  roots.push(root);
  const write = (file: string, value: unknown) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const spec = JSON.parse(fs.readFileSync('src/design/21st-intake/promotions/metric-cards.json', 'utf8'));
  spec.source.license = 'MIT';
  const record = { sourceId: spec.source.sourceId, sourceUrl: spec.source.sourceUrl, name: 'Fixture', license: 'MIT',
    licenseReview: { status: 'verified', license: 'MIT', source: 'fixture:LICENSE', verifiedAt: '2026-09-17' },
    adaptation: { tokensNormalized: true, importsNormalized: true, reducedMotionSupported: true, responsiveVerified: true, canonicalSlotsAdded: true, intentReady: true, portableRecipeCertified: true }, step: 8 };
  const recordPath = 'src/design/21st-intake/imported/stats-band/record.json';
  write('src/design/21st-intake/promotions/metric-cards.json', spec);
  write(recordPath, record);
  write('src/sections/variants/stats/StatsMetricCards.tsx', 'export const StatsMetricCards = () => null;');
  write('src/sections/variants/portableRecipeOnly.ts', 'export function portableRecipeOnly() { throw new Error("Use canonical compilation"); }');
  write('src/sections/variants/jsxTemplates.ts', 'export function statsMetricCardsJSX() { return "<section />"; }');
  write('src/sections/variants/registry.ts', "import {\n} from './jsxTemplates';\nconst registry = {\n  stats: [\n  ],\n};\nconst VARIANT_LAYOUT_ALIASES: Partial<Record<VariantId, readonly string[]>> = {\n};\n");
  return { root, write, spec, record, recordPath };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
describe('21st promotion registration boundary', () => {
  it('rejects uncertified input before changing registry or lifecycle', () => {
    const f = fixture();
    f.record.licenseReview.status = 'unverified'; f.write(f.recordPath, f.record);
    const registry = fs.readFileSync(path.join(f.root, 'src/sections/variants/registry.ts'), 'utf8');
    expect(() => registerVariants(f.root)).toThrow('license review');
    expect(fs.readFileSync(path.join(f.root, 'src/sections/variants/registry.ts'), 'utf8')).toBe(registry);
    expect(JSON.parse(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8')).step).toBe(8);
    expect(fs.existsSync(path.join(f.root, 'public/variants/stats-metric-cards.svg'))).toBe(false);
  });
  it('checks without writes, registers matching identity, and is idempotent', () => {
    const f = fixture();
    expect(registerVariants(f.root, { checkOnly: true }).pending).toBeGreaterThan(0);
    expect(JSON.parse(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8')).step).toBe(8);
    registerVariants(f.root);
    expect(JSON.parse(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8'))).toMatchObject({ step: 9, implementationId: f.spec.id, status: 'promoted' });
    expect(registerVariants(f.root).pending).toBe(0);
  });
  it('restores earlier writes when a later write fails', () => {
    const f = fixture();
    const before = fs.readFileSync(path.join(f.root, f.recordPath), 'utf8');
    expect(() => registerVariants(f.root, { fileSystem: { ...fs, writeFileSync(file: string, content: string) {
      if (file.endsWith('registry.ts')) throw new Error('injected disk failure');
      fs.writeFileSync(file, content);
    } } })).toThrow('injected disk failure');
    expect(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(f.root, 'public/variants/stats-metric-cards.svg'))).toBe(false);
  });
  it('refuses paths outside the expected promotion directories', () => {
    const f = fixture(); f.spec.thumbnail = '/../../outside.svg';
    f.write('src/design/21st-intake/promotions/metric-cards.json', f.spec);
    expect(() => registerVariants(f.root)).toThrow('invalid thumbnail path');
  });
});

describe('promotion manifest and registry agreement', () => {
  it.each([
    ["sourceId: '21st:1195'", "sourceId: '21st:wrong'"],
    ['component: StatsMetricCards', 'component: WrongComponent'],
    ['renderJSX: portableRecipeOnly', 'renderJSX: missingRecipe'],
    ["certification: 'approved'", "certification: 'pending'"],
    ["'metric-cards', 'cards'", "'unrelated'"],
    ["from './stats/StatsMetricCards'", "from './stats/WrongComponent'"],
  ])('rejects existing registry drift without lifecycle mutation: %s', (before, after) => {
    const f = fixture(); registerVariants(f.root);
    const registryPath = path.join(f.root, 'src/sections/variants/registry.ts');
    const registry = fs.readFileSync(registryPath, 'utf8');
    expect(registry).toContain(before);
    const changed = registry.replace(before, after);
    fs.writeFileSync(registryPath, changed);
    f.record.step = 8; f.write(f.recordPath, f.record);
    expect(() => registerVariants(f.root)).toThrow('Promotion blocked before writes');
    expect(fs.readFileSync(registryPath, 'utf8')).toBe(changed);
    expect(JSON.parse(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8')).step).toBe(8);
  });
  it('does not accept a commented registry entry', () => {
    const f = fixture();
    expect(validateRegistrySpec('// id: \'stats:metric-cards\'', f.spec)).toContain(f.spec.id + ': expected exactly one registered entry; found 0');
  });
  it('rejects duplicate specs before any mutation', () => {
    const f = fixture();
    f.write('src/design/21st-intake/promotions/duplicate.json', f.spec);
    expect(() => registerVariants(f.root)).toThrow('Duplicate promotion id');
    expect(JSON.parse(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8')).step).toBe(8);
  });
});

it('audit reports evidence and registry gaps together without writes', () => {
  const f = fixture(); f.record.licenseReview.status = 'unverified'; f.write(f.recordPath, f.record);
  const result = registerVariants(f.root, { auditOnly: true });
  expect(result.valid).toBe(false);
  expect(result.issues.some((issue: string) => issue.includes('license review'))).toBe(true);
  expect(result.issues.some((issue: string) => issue.includes('exactly one registered entry'))).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(f.root, f.recordPath), 'utf8')).step).toBe(8);
  expect(fs.existsSync(path.join(f.root, 'public/variants/stats-metric-cards.svg'))).toBe(false);
});

describe('interrupted promotion recovery', () => {
 function interrupt(root: string) {
  const moduleUrl = pathToFileURL(path.resolve('scripts/unison-variant-register.mjs')).href;
  const code = 'import fs from "node:fs"; import { registerVariants } from '+JSON.stringify(moduleUrl)+'; registerVariants('+JSON.stringify(root)+', {fileSystem: {...fs, writeFileSync(file,content){ fs.writeFileSync(file,content); if(file.endsWith("record.json")) process.exit(86); }}});';
  expect(spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'}).status).toBe(86);
 }
 it('recovers a terminated process and permits a clean retry', () => {
  const f=fixture(); const original=fs.readFileSync(path.join(f.root,f.recordPath),'utf8');
  interrupt(f.root);
  expect(()=>registerVariants(f.root)).toThrow('Interrupted promotion');
  expect(recoverPromotion(f.root)).toBe(true);
  expect(fs.readFileSync(path.join(f.root,f.recordPath),'utf8')).toBe(original);
  expect(fs.existsSync(path.join(f.root,'public/variants/stats-metric-cards.svg'))).toBe(false);
  expect(registerVariants(f.root).pending).toBeGreaterThan(0);
 });
 it('preserves edits made after interruption instead of overwriting them', () => {
  const f=fixture(); interrupt(f.root); f.write(f.recordPath,'user edit');
  expect(()=>recoverPromotion(f.root)).toThrow('recovery conflict');
  expect(fs.readFileSync(path.join(f.root,f.recordPath),'utf8')).toBe('user edit');
  expect(fs.existsSync(path.join(f.root,'.unison-promotion-transaction.json'))).toBe(true);
 });
});
