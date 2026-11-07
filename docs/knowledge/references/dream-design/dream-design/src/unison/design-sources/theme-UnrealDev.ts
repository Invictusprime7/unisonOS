// Snapshot style adapter.
// Shared by every section component in /src/components/.
// Stage 4b /src/index.css is the sole visual-token authority.
export const THEME = {
  "colors": {
    "background": "var(--background)",
    "foreground": "var(--foreground)",
    "card": "var(--card)",
    "cardForeground": "var(--card-foreground)",
    "primary": "var(--primary)",
    "primaryForeground": "var(--primary-foreground)",
    "secondary": "var(--secondary)",
    "secondaryForeground": "var(--secondary-foreground)",
    "muted": "var(--muted)",
    "mutedForeground": "var(--muted-foreground)",
    "accent": "var(--accent)",
    "accentForeground": "var(--accent-foreground)",
    "border": "var(--border)"
  },
  "typography": {
    "headingFont": "var(--font-heading)",
    "bodyFont": "var(--font-body)",
    "headingWeight": "var(--ut-weight-display)",
    "bodyWeight": "var(--ut-weight-body)"
  },
  "radius": "var(--radius)",
  "sectionPadding": "var(--ut-section-padding, 6rem 0)",
  "containerWidth": "72rem"
} as const;

export const RESPONSIVE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  img, svg { max-width: 100%; height: auto; display: block; }
  .ut-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .ut-grid-2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
  @media (max-width: 720px) {
    .ut-nav-links { display: none !important; }
    .ut-hero-stats { gap: 1.5rem !important; }
    .ut-footer-grid { grid-template-columns: 1fr !important; gap: 2rem !important; }
    .ut-footer-bottom { flex-direction: column !important; gap: 1rem !important; text-align: center; }
  }
`;
