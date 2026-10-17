/**
 * Maps the many ways a person (or model) writes a theme value onto the token
 * grammar the theme contract accepts: colors become "H S% L%", weights snap to
 * 100–900, sizes clamp into bounds. Unknown shapes are returned unchanged so
 * the contract check still decides.
 */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#dc2626', green: '#16a34a', blue: '#2563eb',
  navy: '#1e3a8a', teal: '#0d9488', emerald: '#059669', forest: '#14532d', olive: '#4d7c0f',
  yellow: '#eab308', gold: '#b8860b', orange: '#ea580c', coral: '#f97362', pink: '#db2777',
  purple: '#7c3aed', violet: '#7c3aed', indigo: '#4f46e5', burgundy: '#7f1d1d', maroon: '#7f1d1d',
  brown: '#78350f', beige: '#e7dcc8', cream: '#f5efe0', gray: '#6b7280', grey: '#6b7280',
  charcoal: '#1f2937', slate: '#475569', sand: '#d6c6a5', terracotta: '#c2410c', sage: '#84a98c',
};

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return `${round(h)} ${round(s * 100)}% ${round(l * 100)}%`;
}

export function normalizeColorValue(raw: string): string | null {
  let v = raw.trim().toLowerCase();
  const named = v.replace(/^(deep|dark|light|soft|warm|cool)\s+/, '');
  if (NAMED_COLORS[v]) v = NAMED_COLORS[v];
  else if (NAMED_COLORS[named]) v = NAMED_COLORS[named];
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return rgbToHsl(parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16));
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgb) return rgbToHsl(+rgb[1], +rgb[2], +rgb[3]);
  const hsl = v.match(/^(?:hsla?\()?\s*(\d+(?:\.\d+)?)(?:deg)?[\s,]+(\d+(?:\.\d+)?)%?[\s,]+(\d+(?:\.\d+)?)%?\s*\)?$/);
  if (hsl) return `${Math.min(360, +hsl[1])} ${Math.min(100, +hsl[2])}% ${Math.min(100, +hsl[3])}%`;
  return null;
}

export function normalizeThemeTokenValue(name: string, raw: string, isColorToken: boolean): string {
  const value = raw.trim();
  if (/var\(/.test(value)) return value;
  if (isColorToken) return normalizeColorValue(value) ?? value;
  if (name.includes('weight-')) {
    const word: Record<string, number> = { thin: 100, light: 300, normal: 400, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 };
    const n = word[value.toLowerCase()] ?? Number(value);
    if (Number.isFinite(n)) return String(Math.min(900, Math.max(100, Math.round(n / 100) * 100)));
    return value;
  }
  const size = value.match(/^(-?\d+(?:\.\d+)?)(px|rem|em)$/);
  if (size) {
    const min = name.includes('tracking') || name.includes('lift') ? -10 : 0;
    const max = size[2] === 'px' ? 200 : 12;
    return `${Math.min(max, Math.max(min, +size[1]))}${size[2]}`;
  }
  return value;
}
