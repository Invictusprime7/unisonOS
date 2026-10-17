/**
 * Decides whether an AI Builder request is clear enough to apply, or open-ended
 * enough that the AI should first offer concrete Unison options.
 *
 * Options name canonical Unison components / Theme Families so the chosen reply
 * is itself a clear, actionable request (and never asks again).
 */
export interface ClarifyOption {
  label: string;
  reply: string;
}

export interface Clarification {
  question: string;
  options: ClarifyOption[];
}

const VAGUE = /\b(better|nicer|premium|luxur(?:y|ious)|modern(?:ize)?|fresh(?:er)?|clean(?:er)?|pop|stand out|elevate|improve|polish(?:ed)?|professional|upgrade|redesign|revamp|spice up|more (?:interesting|engaging|exciting|appealing|unique)|look good|looks? (?:off|bland|boring|dated))\b/i;
const CONCRETE = /\b(floating|pill|sticky|transparent|centered|split|two[- ]column|three[- ]column|grid|marquee|carousel|slider|accordion|tabs?|dark|light|serif|sans|uppercase|move|above|below|before|after|swap|replace|remove|delete|add|rename|to\s+["'“‘]|\d+\s*(?:px|rem|%))\b|#[0-9a-f]{3,6}\b/i;
const COMPONENT_NAME = /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/;
const DELEGATE = /\b(your call|you decide|surprise me|just do it|whatever you think|go ahead)\b/i;

type Family = { match: RegExp; noun: string; options: ClarifyOption[] };

const FAMILIES: Family[] = [
  {
    match: /\b(nav(?:bar|igation)?|header|menu bar)\b/i, noun: 'navigation',
    options: [
      { label: 'Floating pill nav', reply: 'Turn the navigation into a floating pill bar that stays at the top while scrolling (Unison NavbarFloatingPill style).' },
      { label: 'Minimal dark nav', reply: 'Make the navigation a minimal dark bar with the logo left and links right (Unison NavbarMinimalDark style).' },
      { label: 'Centered logo nav', reply: 'Make the navigation center the logo with links split on both sides (Unison NavbarCenteredLogo style).' },
    ],
  },
  {
    match: /\b(hero|banner|top section|header section|above the fold)\b/i, noun: 'hero',
    options: [
      { label: 'Split image hero', reply: 'Rework the hero as a split layout: large headline and call to action on the left, a full-height image on the right (Unison HeroSplitImage style).' },
      { label: 'Full-bleed cinematic', reply: 'Rework the hero as a full-bleed image with the headline overlaid and a strong call to action (Unison HeroFullBleed style).' },
      { label: 'Editorial banner', reply: 'Rework the hero as an editorial banner with oversized type and a small supporting image (Unison HeroEditorialBanner style).' },
    ],
  },
  {
    match: /\b(footer)\b/i, noun: 'footer',
    options: [
      { label: 'Multi-column footer', reply: 'Make the footer a multi-column layout with grouped links, contact details and social icons (Unison FooterMultiColumn style).' },
      { label: 'Dark band footer', reply: 'Make the footer a dark full-width band with the logo, a short tagline and links (Unison FooterDarkBand style).' },
      { label: 'Centered minimal', reply: 'Make the footer centered and minimal with the logo and one row of links (Unison FooterCenteredMinimal style).' },
    ],
  },
  {
    match: /\b(testimonials?|reviews?)\b/i, noun: 'testimonials',
    options: [
      { label: 'Spotlight quote', reply: 'Show testimonials as one large spotlight quote with the customer photo and name (Unison TestimonialsSpotlight style).' },
      { label: 'Scrolling marquee', reply: 'Show testimonials as a slow horizontal scrolling marquee of review cards (Unison TestimonialsMarquee style).' },
      { label: 'Editorial columns', reply: 'Show testimonials as editorial columns with large quotation marks (Unison TestimonialsEditorial style).' },
    ],
  },
  {
    match: /\b(pricing|plans?|packages?)\b/i, noun: 'pricing',
    options: [
      { label: 'Highlighted tiers', reply: 'Show pricing as three tiers with the middle plan highlighted as recommended (Unison PricingSpotlight style).' },
      { label: 'Monthly/yearly toggle', reply: 'Add a monthly/yearly billing toggle to the pricing tiers (Unison PricingBillingToggle style).' },
      { label: 'Comparison table', reply: 'Show pricing as a feature comparison table across plans (Unison PricingComparisonTable style).' },
    ],
  },
  {
    match: /\b(gallery|portfolio|work|photos?)\b/i, noun: 'gallery',
    options: [
      { label: 'Masonry gallery', reply: 'Show the gallery as a masonry grid of mixed-height images (Unison GalleryMasonry style).' },
      { label: 'Horizontal reel', reply: 'Show the gallery as a horizontal scrolling reel of large images (Unison GalleryHorizontalReel style).' },
      { label: 'Editorial mosaic', reply: 'Show the gallery as an editorial mosaic with one feature image and smaller supporting images (Unison GalleryEditorialMosaic style).' },
    ],
  },
  {
    match: /\b(features?|services?|offerings?)\b/i, noun: 'services',
    options: [
      { label: 'Bento grid', reply: 'Show this section as a bento grid with one large feature tile and smaller tiles (Unison FeaturesBentoGrid style).' },
      { label: 'Alternating rows', reply: 'Show this section as alternating image-and-text rows (Unison ServicesAlternating style).' },
      { label: 'Editorial list', reply: 'Show this section as an editorial numbered list with generous spacing (Unison ServicesEditorialRows style).' },
    ],
  },
];

const SITE_OPTIONS: ClarifyOption[] = [
  { label: 'Editorial & refined', reply: 'Restyle the site in an editorial direction: serif headings, generous whitespace and a restrained palette.' },
  { label: 'Bold & high-contrast', reply: 'Restyle the site in a bold direction: heavy sans headings, high contrast colors and stronger calls to action.' },
  { label: 'Minimal & calm', reply: 'Restyle the site in a minimalist direction: lighter type, muted neutrals and fewer borders.' },
];

export function clarifyBuilderRequest(prompt: string, context: { hasSelection?: boolean; hasAttachments?: boolean } = {}): Clarification | null {
  const text = prompt.trim();
  if (!text || context.hasAttachments) return null;
  if (DELEGATE.test(text)) return null;
  if (text.length > 220) return null;
  if (!VAGUE.test(text)) return null;
  if (CONCRETE.test(text) || COMPONENT_NAME.test(text)) return null;

  const family = FAMILIES.find((item) => item.match.test(text));
  if (family) {
    return {
      question: `Happy to improve the ${family.noun}. Which direction fits best? You can also tell me your own idea.`,
      options: [...family.options, { label: 'Your call', reply: `${text} — your call, pick the best Unison option for this site.` }],
    };
  }
  if (context.hasSelection) return null;
  return {
    question: 'I can take the whole site in a few directions. Which feels closest? Colors and fonts change; your content stays.',
    options: [...SITE_OPTIONS, { label: 'Your call', reply: `${text} — your call, pick the best Unison direction for this site.` }],
  };
}
