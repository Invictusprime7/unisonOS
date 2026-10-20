import { describe, expect, it } from 'vitest';
import { buildThemeContractFiles, THEME_CONTRACT_PATH, readThemeContract } from '@/platform/core/themeContract';
import {
  isLegalThemeTokenValue,
  validateThemeTypography,
  INDEX_CSS_PATH,
  THEME_OVERRIDES_PATH,
  applyOverridesToCss,
  buildThemeOverrideFileOps,
  readCompiledTokenValues,
  readThemeOverrides,
  sanitizeThemeOverrides,
  stripOverrideBlock,
} from '@/services/theme/themeTokenOverrides';

const contractFiles = buildThemeContractFiles({ artDirectionPackId: null, themePresetId: null });
const contract = readThemeContract(contractFiles)!;
const someToken = contract.tokenNames.find((n) => n.startsWith('--ut-radius')) ?? contract.tokenNames[0];

const baseCss = `:root {\n  --ut-radius-base: 0.5rem;\n  --ut-grid-gap: 1rem;\n}\n`;
const files = { ...contractFiles, [INDEX_CSS_PATH]: baseCss };

describe('themeTokenOverrides', () => {
  it('only accepts tokens the sealed contract declares', () => {
    const clean = sanitizeThemeOverrides(
      { [someToken]: '1rem', '--not-a-token': '4px' },
      contract,
    );
    expect(clean).toEqual({ [someToken]: '1rem' });
  });

  it('rejects values that smuggle raw CSS', () => {
    expect(sanitizeThemeOverrides({ [someToken]: '1rem; } body { display:none' }, contract)).toEqual({});
    expect(sanitizeThemeOverrides({ [someToken]: '@import url(x)' }, contract)).toEqual({});
  });

  it('appends an idempotent override block', () => {
    const once = applyOverridesToCss(baseCss, { [someToken]: '2rem' });
    const twice = applyOverridesToCss(once, { [someToken]: '2rem' });
    expect(twice).toBe(once);
    expect(once).toContain(`${someToken}: 2rem;`);
    expect(stripOverrideBlock(once).trim()).toBe(baseCss.trim());
  });

  it('produces file ops for css and the override record, and round-trips', () => {
    const ops = buildThemeOverrideFileOps({ files, overrides: { [someToken]: '2rem' } });
    expect(ops.map((o) => o.path).sort()).toEqual([INDEX_CSS_PATH, THEME_OVERRIDES_PATH].sort());

    const next = { ...files };
    for (const op of ops) if (op.type !== 'delete') next[op.path] = op.contents;
    expect(readThemeOverrides(next)).toEqual({ [someToken]: '2rem' });
    expect(next[THEME_CONTRACT_PATH]).toBe(files[THEME_CONTRACT_PATH]);
  });

  it('is a no-op when nothing changes', () => {
    expect(buildThemeOverrideFileOps({ files, overrides: {} })).toEqual([]);
  });

  it('reads compiled token values without the override block', () => {
    const withOverride = applyOverridesToCss(baseCss, { '--ut-grid-gap': '3rem' });
    expect(readCompiledTokenValues(withOverride)['--ut-grid-gap']).toBe('1rem');
  });
});

describe('typed theme values', () => {
  it('rejects invalid HSL, cross-type references, layout tokens, and incorrect time units', () => {
    for (const value of ['#fff', '0 101% 10%', '361 20% 10%', 'var(--ut-weight-display)', 'var(--primary)', 'hsl(var(--foreground))']) {
      expect(isLegalThemeTokenValue('--primary', value, contract), value).toBe(false);
    }
    expect(isLegalThemeTokenValue('--primary', 'var(--accent)', contract)).toBe(true);
    expect(isLegalThemeTokenValue('--ut-motion-duration', '2rem', contract)).toBe(false);
    expect(isLegalThemeTokenValue('--ut-motion-duration', '2001ms', contract)).toBe(false);
    expect(isLegalThemeTokenValue('--ut-hero-columns', '2', contract)).toBe(false);
  });
  it('rejects unsupported font weights with an actionable explanation', () => {
    expect(() => validateThemeTypography({ '--font-heading': 'Space Grotesk', '--ut-weight-display': '900' })).toThrow('does not support weight 900');
    expect(() => validateThemeTypography({ '--font-heading': 'Inter', '--ut-weight-display': '900' })).not.toThrow();
  });
  it('requests the override font faces', () => {
    const css = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');\n:root { --font-heading: Inter; --font-body: Inter; }";
    const once = applyOverridesToCss(css, { '--font-heading': 'Space Grotesk' });
    const twice = applyOverridesToCss(once, { '--font-heading': 'Space Grotesk' });
    expect(once).toContain('family=Space+Grotesk:wght@300;400;500;600;700');
    expect(twice).toBe(once);
    expect(twice.split('\n')[0]).toBe("@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap');");
    expect(twice.split('\n')[0]).not.toMatch(/\);\d/);
  });
});

it('derives accent contrast while preserving explicit foreground overrides', () => {
  expect(applyOverridesToCss(':root {}', { '--accent': '60 100% 50%' })).toContain('--accent-foreground: 0 0% 0%');
  expect(applyOverridesToCss(':root {}', { '--accent': '240 100% 10%' })).toContain('--accent-foreground: 0 0% 100%');
  expect(applyOverridesToCss(':root {}', { '--accent': '60 100% 50%', '--accent-foreground': '0 0% 15%' })).toContain('--accent-foreground: 0 0% 15%');
});
