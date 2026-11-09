/**
 * Deterministic mapping: ThemePreset (hex palette + font names) → ThemeTokens (HSL strings).
 * Used by prompt-first launch to apply the wizard's aesthetic card directly to a
 * Section Registry composition WITHOUT calling the AI.
 */
import type { ThemePreset } from './themePresets';
import type { ThemeTokens } from '@/sections/types';
import { getThemeGeometryContract } from '@/services/themeGeometryContract';

export function hexToHSL(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hh = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hh = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hh = ((b - r) / d + 2) / 6; break;
      case b: hh = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(hh * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function isDark(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

export function themePresetToThemeTokens(preset: ThemePreset): ThemeTokens {
  const dark = isDark(preset.palette.bg);
  const bg = hexToHSL(preset.palette.bg);
  const fg = hexToHSL(preset.palette.fg);
  const accent = hexToHSL(preset.palette.accent);
  const accent2 = hexToHSL(preset.palette.accent2 || preset.palette.accent);
  const muted = dark ? '0 0% 15%' : '0 0% 95%';
  const mutedFg = dark ? '0 0% 60%' : '0 0% 40%';
  const border = dark ? '0 0% 20%' : '0 0% 90%';
  const card = dark ? '0 0% 8%' : '0 0% 100%';

  return {
    colors: {
      primary: accent,
      primaryForeground: contrastingForeground(preset.palette.accent),
      secondary: accent2,
      secondaryForeground: contrastingForeground(preset.palette.accent2 || preset.palette.accent),
      accent: accent2,
      accentForeground: contrastingForeground(preset.palette.accent2 || preset.palette.accent),
      background: bg,
      foreground: fg,
      muted,
      mutedForeground: mutedFg,
      card,
      cardForeground: fg,
      border,
    },
    typography: {
      headingFont: `'${preset.typography.headingFont}', ui-sans-serif, system-ui, sans-serif`,
      bodyFont: `'${preset.typography.bodyFont}', ui-sans-serif, system-ui, sans-serif`,
      headingWeight: preset.typography.headingWeight,
      bodyWeight: '400',
    },
    radius: getThemeGeometryContract(preset.id).radius,
    sectionPadding: '5rem 1rem',
    containerWidth: '1200px',
  };
}

export function contrastingForeground(hex: string): string {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '0 0% 0%' : '0 0% 100%';
}
