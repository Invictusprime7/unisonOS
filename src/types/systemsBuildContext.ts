/**
 * SystemsBuildContext
 *
 * Mirrors the full BlueprintSchema from the `systems-build` edge function
 * (snake_case field naming throughout). Passed from prompt-first launch into
 * `ai-code-assistant` so the AI has brand identity, palette, required
 * sections, and intent wiring for generation and in-builder edits.
 *
 * When no explicit blueprint is supplied, `ai-code-assistant` auto-synthesises
 * a minimal default from `systemType` + `templateName`.
 */
export interface SystemsBuildContext {
  version?: string;
  identity?: {
    industry?: string;
    business_model?: string;
    primary_goal?: string;
    locale?: string;
  };
  brand?: {
    business_name?: string;
    tagline?: string;
    tone?: string;
    /** Keyed colour roles: primary, secondary, accent, background, foreground */
    palette?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      foreground?: string;
    };
    typography?: { heading?: string; body?: string };
    logo?: { mode?: string; text_lockup?: string };
  };
  design?: {
    layout?: {
      hero_style?: string;
      section_spacing?: string;
      max_width?: string;
      navigation_style?: string;
    };
    effects?: {
      animations?: boolean;
      scroll_animations?: boolean;
      hover_effects?: boolean;
      gradient_backgrounds?: boolean;
      glassmorphism?: boolean;
      shadows?: string;
    };
    images?: {
      style?: string;
      aspect_ratio?: string;
      overlay_style?: string;
    };
    buttons?: {
      style?: string;
      size?: string;
      hover_effect?: string;
    };
    sections?: {
      include_stats?: boolean;
      include_testimonials?: boolean;
      include_faq?: boolean;
      include_cta_banner?: boolean;
      include_newsletter?: boolean;
      include_social_proof?: boolean;
      use_counter_animations?: boolean;
    };
    content?: {
      density?: string;
      use_icons?: boolean;
      writing_style?: string;
    };
  };
  /** Intent objects to wire on CTAs */
  intents?: Array<{
    intent: string;
    target?: { kind?: string; ref?: string };
  }>;
  /** Section names extracted from a reference template (data-ut-section values) */
  template_sections?: string[];
  /** data-ut-intent values found in the reference template */
  template_intents?: string[];
}
