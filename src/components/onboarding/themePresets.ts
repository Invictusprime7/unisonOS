// ============================================================================
// Theme Presets for prompt-first launch
// VISUAL-ONLY: These presets control colors, typography, and layout formatting.
// They must NEVER influence industry content, text copy, or business language.
// ============================================================================

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Visual-only styling directive — no industry or content language */
  styleDirective: string;
  palette: { bg: string; fg: string; accent: string; accent2?: string };
  typography: { headingFont: string; bodyFont: string; headingWeight: string };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "modern",
    label: "Modern",
    description: "Clean lines, vibrant gradients, contemporary energy",
    icon: "✦",
    styleDirective:
      "VISUAL STYLING ONLY: Clean sans-serif typography (Inter, DM Sans), bold gradients, generous whitespace, card-based layouts, subtle shadows, vibrant accent colors, contemporary feel.",
    palette: { bg: "#0F172A", fg: "#F8FAFC", accent: "#3B82F6", accent2: "#8B5CF6" },
    typography: { headingFont: "Inter", bodyFont: "DM Sans", headingWeight: "700" },
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Refined serifs, magazine layouts, quiet elegance",
    icon: "◈",
    styleDirective:
      "VISUAL STYLING ONLY: Elegant serif headings (Playfair Display, Cormorant Garamond), refined body text, asymmetric layouts, muted elegant color palette, generous typography scale.",
    palette: { bg: "#FDFCFA", fg: "#1A1A1A", accent: "#8B7355", accent2: "#C4A882" },
    typography: { headingFont: "Playfair Display", bodyFont: "Source Serif 4", headingWeight: "700" },
  },
  {
    id: "futuristic",
    label: "Futuristic",
    description: "Neon glow, dark panels, sci-fi atmosphere",
    icon: "◉",
    styleDirective:
      "VISUAL STYLING ONLY: Dark backgrounds, neon accent colors (cyan, magenta), glassmorphism effects, monospace or geometric sans-serif fonts, grid-based layouts, subtle glow effects, angular elements.",
    palette: { bg: "#0A0A14", fg: "#E0E0FF", accent: "#00F0FF", accent2: "#FF00FF" },
    typography: { headingFont: "Space Grotesk", bodyFont: "JetBrains Mono", headingWeight: "700" },
  },
  {
    id: "minimalist",
    label: "Minimalist",
    description: "Maximum whitespace, monochrome precision",
    icon: "○",
    styleDirective:
      "VISUAL STYLING ONLY: Maximum whitespace, monochromatic or two-tone color scheme, thin typography weights, minimal decoration, clean geometric shapes, subtle borders instead of shadows.",
    palette: { bg: "#FFFFFF", fg: "#111111", accent: "#555555", accent2: "#999999" },
    typography: { headingFont: "Inter", bodyFont: "Inter", headingWeight: "400" },
  },
  {
    id: "bold",
    label: "Bold",
    description: "Oversized type, high contrast, raw power",
    icon: "■",
    styleDirective:
      "VISUAL STYLING ONLY: Oversized typography with heavy weights (900, 800), high contrast black-and-white with one vivid accent color, uppercase headings, large text sizes, raw graphic energy.",
    palette: { bg: "#000000", fg: "#FFFFFF", accent: "#FF3333", accent2: "#FF6633" },
    typography: { headingFont: "Inter", bodyFont: "Inter", headingWeight: "900" },
  },
  {
    id: "organic",
    label: "Organic",
    description: "Warm earth tones, soft shapes, natural comfort",
    icon: "◠",
    styleDirective:
      "VISUAL STYLING ONLY: Warm earth tones (terracotta, sage, cream, clay), rounded corners and soft shapes, humanist fonts, gentle gradients, cozy spacing, inviting warmth.",
    palette: { bg: "#FAF5F0", fg: "#2D2418", accent: "#C4703F", accent2: "#7C9A5E" },
    typography: { headingFont: "Libre Baskerville", bodyFont: "Nunito", headingWeight: "700" },
  },
];
