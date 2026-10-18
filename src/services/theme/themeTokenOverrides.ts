import { normalizeThemeTokenValue } from './themeValueNormalize';
import { primaryFont, replaceThemeFontImport, THEME_FONT_WEIGHTS } from '@/components/onboarding/themeFonts';
/**
 * THEME TOKEN OVERRIDES — the builder-side, persisted form of a token edit.
 *
 * Stage 4b seals the art-direction pack and compiles it into `/src/index.css`.
 * A builder user may still want to nudge individual tokens (a tighter radius, a
 * warmer accent) WITHOUT breaking the contract: overrides may only re-value
 * tokens the sealed contract already declares. They never introduce new names,
 * never inject raw CSS, and never touch page bodies.
 *
 * Persistence shape:
 *   /.unison/theme-overrides.json  — the authored override map (source of truth)
 *   /src/index.css                 — a trailing `:root` block re-derived from it
 *
 * Both are emitted as FileOps so the change travels through VFSCommitService
 * (`theme-change`) like every other canonical mutation.
 */

import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import type { FileOp } from '@/types/patchPlan';
import {
  readThemeContract,
  THEME_COLOR_TOKENS,
  type ThemeContract,
} from '@/platform/core/themeContract';

export const THEME_OVERRIDES_PATH = '/.unison/theme-overrides.json';
export const INDEX_CSS_PATH = '/src/index.css';

const BLOCK_START = '/* THEME TOKEN OVERRIDES — builder-authored, contract-scoped. Do not hand-edit. */';
const BLOCK_END = '/* END THEME TOKEN OVERRIDES */';

export type ThemeTokenOverrides = Record<string, string>;

/** Values that would smuggle arbitrary CSS in through a token slot. */
const ILLEGAL_VALUE = /[;{}]|@import|expression\s*\(|javascript:|<\/?script/i;

export function isLegalTokenValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return false;
  return !ILLEGAL_VALUE.test(trimmed);
}

/**
 * Only tokens the sealed contract declares are overridable. Everything else is
 * dropped — an override can restyle the site, never re-architect the contract.
 */
export function sanitizeThemeOverrides(
  overrides: ThemeTokenOverrides | null | undefined,
  contract: ThemeContract | null,
): ThemeTokenOverrides {
  if (!overrides || !contract) return {};
  const legal = new Set(contract.tokenNames);
  const out: ThemeTokenOverrides = {};
  for (const [name, value] of Object.entries(overrides)) {
    if (typeof value !== 'string') continue;
    if (!legal.has(name)) continue;
    if (!isLegalThemeTokenValue(name, value, contract)) continue;
    out[name] = value.trim();
  }
  return out;
}

export function readThemeOverrides(
  files: Record<string, string> | null | undefined,
): ThemeTokenOverrides {
  const raw = files?.[THEME_OVERRIDES_PATH];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { tokens?: unknown };
    const tokens = (parsed && typeof parsed === 'object' ? parsed.tokens : null) as
      | ThemeTokenOverrides
      | undefined;
    if (!tokens || typeof tokens !== 'object') return {};
    return sanitizeThemeOverrides(tokens, readThemeContract(files));
  } catch {
    return {};
  }
}

export function serializeThemeOverrides(overrides: ThemeTokenOverrides): string {
  return `${JSON.stringify({ version: '1.0', tokens: overrides }, null, 2)}\n`;
}

/** Remove any previously injected override block so writes stay idempotent. */
export function stripOverrideBlock(css: string): string {
  const start = css.indexOf(BLOCK_START);
  if (start < 0) return css;
  const end = css.indexOf(BLOCK_END, start);
  if (end < 0) return css.slice(0, start).trimEnd() + '\n';
  return (css.slice(0, start) + css.slice(end + BLOCK_END.length)).trimEnd() + '\n';
}

/**
 * Re-derive the trailing override block. Cascade order does the work: the block
 * is the last `:root` rule in the stylesheet, so it wins over the Stage 4b
 * declarations without mutating them.
 */
export function applyOverridesToCss(css: string, overrides: ThemeTokenOverrides): string {
  let base = stripOverrideBlock(css || '');
  const values = { ...readCompiledTokenValues(base), ...overrides };
  if (values['--font-heading'] && values['--font-body']) {
    base = replaceThemeFontImport(base, [values['--font-heading'], values['--font-body']]);
  }
  const effective = { ...overrides };
  for (const color of ['primary', 'secondary', 'accent']) {
    const value = overrides['--' + color];
    const foreground = '--' + color + '-foreground';
    if (!value || overrides[foreground]) continue;
    const hsl = value.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
    if (!hsl) continue;
    const h = Number(hsl[1]) / 30, saturation = Number(hsl[2]) / 100, lightness = Number(hsl[3]) / 100;
    const amplitude = saturation * Math.min(lightness, 1 - lightness);
    const channels = [0, 8, 4].map(offset => {
      const k = (offset + h) % 12;
      const channel = lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    effective[foreground] = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '0 0% 0%' : '0 0% 100%';
  }
  const entries = Object.entries(effective);
  if (entries.length === 0) return base;
  const declarations = entries
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${base.trimEnd()}\n\n${BLOCK_START}\n:root {\n${declarations}\n}\n${BLOCK_END}\n`;
}

export interface ThemeOverrideCommitInput {
  files: Record<string, string>;
  overrides: ThemeTokenOverrides;
}

/**
 * Turn an authored override map into the FileOps a `theme-change` PatchPlan
 * carries. Returns an empty list when nothing actually changes.
 */
export function buildThemeOverrideFileOps(input: ThemeOverrideCommitInput): FileOp[] {
  const contract = readThemeContract(input.files);
  const normalized: ThemeTokenOverrides = {};
  for (const [name, raw] of Object.entries(input.overrides)) {
    const value = normalizeThemeTokenValue(name, raw, (THEME_COLOR_TOKENS as readonly string[]).includes(name));
    if (!contract || !contract.tokenNames.includes(name) || !isLegalThemeTokenValue(name, value, contract)) throw new Error('Invalid theme value for ' + name + '. Use its supported type and bounds.');
    normalized[name] = value;
  }
  const clean = sanitizeThemeOverrides(normalized, contract);
  validateThemeTypography({ ...readCompiledTokenValues(input.files[INDEX_CSS_PATH] ?? ''), ...clean });
  const currentCss = input.files[INDEX_CSS_PATH] ?? '';
  if (!currentCss) return [];

  const nextCss = applyOverridesToCss(currentCss, clean);
  const nextOverrides = serializeThemeOverrides(clean);

  const ops: FileOp[] = [];
  if (nextCss !== currentCss) {
    ops.push({ type: 'replace', path: INDEX_CSS_PATH, contents: nextCss });
  }
  const hasRecord = typeof input.files[THEME_OVERRIDES_PATH] === 'string';
  const needsRecord = hasRecord || Object.keys(clean).length > 0;
  if (needsRecord && (input.files[THEME_OVERRIDES_PATH] ?? '') !== nextOverrides) {
    ops.push({
      type: input.files[THEME_OVERRIDES_PATH] ? 'replace' : 'create',
      path: THEME_OVERRIDES_PATH,
      contents: nextOverrides,
    });
  }
  return ops;
}

/**
 * Effective value of a token as the preview currently renders it: the override
 * when present, otherwise whatever Stage 4b compiled into `:root`.
 */
export function readCompiledTokenValues(css: string, includeOverrides = false): Record<string, string> {
  const out: Record<string, string> = {};
  const withoutOverrides = includeOverrides ? css : stripOverrideBlock(css || '');
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutOverrides))) {
    out[match[1]] = match[2].trim();
  }
  return out;
}

/** Theme edits can change styling, but cannot change grid/hero composition. */
export function isEditableThemeToken(name: string): boolean {
  return name === '--font-heading' || name === '--font-body' || (THEME_COLOR_TOKENS as readonly string[]).includes(name)
    || /^--ut-(?:type-(?:display|title|lead)|weight-(?:display|body)|heading-(?:tracking|transform)|display-leading|radius-(?:base|lg|pill)|border-weight|rhythm-space|grid-gap|block-gap|card-padding|inline-gutter|stack-gap|motion-(?:duration|distance|stagger)|hover-(?:lift|scale)|surface-(?:fill|stroke|elevation|elevation-hover)|media-(?:frame-radius|filter))$/.test(name);
}

/** Parse shadow layers without splitting commas inside color functions. */
function isLegalSurfaceShadow(name: string, value: string, contract: ThemeContract): boolean {
  if (value === 'none' || value === '0') return true;
  if (/^var\(--[a-z0-9-]+\)$/.test(value)) {
    const reference = value.slice(4, -1);
    return reference !== name && contract.tokenNames.includes(reference)
      && /^--ut-surface-elevation(?:-hover)?$/.test(reference);
  }
  const layers = value.split(/,(?![^()]*\))/);
  return layers.every(layer => {
    const parts = layer.trim().match(/(?:hsla?|rgba?|var)\([^()]*?(?:var\(--[a-z0-9-]+\)[^()]*)?\)|[^\s]+/g) ?? [];
    let inset = false;
    let color = false;
    const lengths: number[] = [];
    for (const part of parts) {
      if (part === 'inset' && !inset) { inset = true; continue; }
      const length = part.match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/);
      if (length && (length[2] || Number(length[1]) === 0)) {
        const number = Number(length[1]);
        if (Math.abs(number) > (length[2] === 'px' ? 200 : 12)) return false;
        lengths.push(number);
        continue;
      }
      if (color || !isLegalSurfaceColor(part, contract)) return false;
      color = true;
    }
    return lengths.length >= 2 && lengths.length <= 4 && (lengths.length < 3 || lengths[2] >= 0);
  });
}

function isLegalSurfaceColor(value: string, contract: ThemeContract): boolean {
  if (/^(transparent|currentColor)$/.test(value) || /^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) return true;
  const reference = value.match(/^hsl\(var\((--[a-z0-9-]+)\)(?: \/ (0(?:\.\d+)?|1))?\)$/);
  if (reference) return contract.tokenNames.includes(reference[1]) && themeTokenKind(reference[1]) === 'hsl';
  const hsl = value.match(/^hsla?\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%(?:\s*\/\s*(0(?:\.\d+)?|1))?\)$/);
  if (hsl) return +hsl[1] <= 360 && +hsl[2] <= 100 && +hsl[3] <= 100;
  const rgb = value.match(/^rgba?\((\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[/,]\s*(0(?:\.\d+)?|1))?\)$/);
  return !!rgb && +rgb[1] <= 255 && +rgb[2] <= 255 && +rgb[3] <= 255;
}

export function isLegalThemeTokenValue(name: string, value: string, contract: ThemeContract): boolean {
  if (!isEditableThemeToken(name) || !isLegalTokenValue(value)) return false;
  const v = value.trim();
  if (/url\s*\(|!important|\\/i.test(v)) return false;
  if (/^--ut-surface-elevation(?:-hover)?$/.test(name)) return isLegalSurfaceShadow(name, v, contract);
  const refs = [...v.matchAll(/var\((--[a-z0-9-]+)\)/g)];
  if (refs.length) {
    if (refs.some(r => r[1] === name || !contract.tokenNames.includes(r[1]))) return false;
    if (name.includes('surface-') && /^hsl\(var\(--[a-z0-9-]+\)(?: \/ (?:0(?:\.\d+)?|1))?\)$/.test(v)) return refs.every(r => themeTokenKind(r[1]) === 'hsl');
    return /^var\(--[a-z0-9-]+\)$/.test(v) && refs.every(r => themeTokenKind(name) === themeTokenKind(r[1]));
  }
  if ((THEME_COLOR_TOKENS as readonly string[]).includes(name)) {
    const parts = v.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
    return !!parts && +parts[1] <= 360 && +parts[2] <= 100 && +parts[3] <= 100;
  }
  if (name === '--font-heading' || name === '--font-body') return THEME_PRESETS.some(p => [p.typography.headingFont, p.typography.bodyFont].includes(v.replace(/^['"]|['"]$/g, '')));
  if (name.includes('weight-')) return /^(?:[1-9]00)$/.test(v);
  if (name.endsWith('transform')) return /^(none|uppercase|lowercase|capitalize)$/.test(v);
  if (name === '--ut-display-leading') return Number(v) >= 0.8 && Number(v) <= 2;
  if (name === '--ut-hover-scale') return Number(v) >= 0.9 && Number(v) <= 1.1;
  if (name.includes('surface-')) return /^(none|transparent|0)$/.test(v) || isLegalSurfaceColor(v, contract);
  if (name === '--ut-media-filter') return /^(none|grayscale\((?:0|1|0\.\d+)\)|sepia\((?:0|1|0\.\d+)\))$/.test(v);
  const size = v.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|ms|s)$/);
  if (!size) return v === '0';
  const n = +size[1];
  if (/duration|stagger/.test(name) && size[2] !== 'ms' && size[2] !== 's') return false;
  if (size[2] === 'ms' || size[2] === 's') return /duration|stagger/.test(name) && n >= 0 && n <= (size[2] === 's' ? 2 : 2000);
  return n >= (name.includes('tracking') || name.includes('lift') ? -10 : 0) && n <= (size[2] === 'px' ? 200 : 12);
}

export function validateThemeTypography(values: Record<string, string>): void {
  const visited = new Set<string>();
  const visit = (name: string, path = new Set<string>()) => {
    if (path.has(name)) throw new Error('Cyclic theme reference: ' + name + '. Reference a base token instead.');
    if (visited.has(name)) return;
    const next = new Set(path).add(name);
    for (const ref of (values[name] ?? '').matchAll(/var\((--[a-z0-9-]+)\)/g)) visit(ref[1], next);
    visited.add(name);
  };
  Object.keys(values).forEach(name => visit(name));
  for (const [fontToken, weightToken] of [['--font-heading', '--ut-weight-display'], ['--font-body', '--ut-weight-body']]) {
    const resolve = (name: string, seen = new Set<string>()): string | undefined => {
      if (seen.has(name)) throw new Error('Cyclic theme reference: ' + name);
      seen.add(name);
      const value = values[name];
      const ref = value?.match(/^var\((--[a-z0-9-]+)\)$/);
      return ref ? resolve(ref[1], seen) : value;
    };
    const font = primaryFont(resolve(fontToken) ?? '');
    const weight = Number(resolve(weightToken));
    if (font && weight && !THEME_FONT_WEIGHTS[font]?.includes(weight)) throw new Error(font + ' does not support weight ' + weight + '. Supported weights: ' + (THEME_FONT_WEIGHTS[font]?.join(', ') ?? 'select a registered font') + '.');
  }
}

function themeTokenKind(name: string): string {
  if ((THEME_COLOR_TOKENS as readonly string[]).includes(name)) return 'hsl';
  if (name.startsWith('--font-')) return 'font';
  if (name.includes('weight-')) return 'weight';
  if (/duration|stagger/.test(name)) return 'time';
  if (/transform|leading|scale|filter|surface-/.test(name)) return name;
  return 'length';
}
