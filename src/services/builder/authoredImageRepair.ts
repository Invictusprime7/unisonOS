/**
 * Deterministic repair of dead image hosts in AI-authored source, applied
 * before candidate gates so the committed revision never stores unreachable
 * placeholder images (via.placeholder.com is offline; Shopify placeholder
 * files 404). Replacements come from the curated contextual photo library.
 */
import { CONTEXTUAL_IMAGES, PORTRAIT_IMAGES } from '@/utils/sandpackFilePrep';

const DEAD_IMAGE_URL =
  /https?:\/\/(?:via\.placeholder\.com|placeholder\.com|placehold\.(?:it|co)|dummyimage\.com|fakeimg\.pl|source\.unsplash\.com|picsum\.photos|(?:www\.)?example\.com|cdn\.shopify\.com\/s\/files\/[^"'`\s)]*placeholder)[^"'`\s)]*/gi;
const AVATAR_URL = /https?:\/\/(?:randomuser\.me|i\.pravatar\.cc|ui-avatars\.com)[^"'`\s)]*/gi;

const UNSPLASH_PHOTO = /https?:\/\/images\.unsplash\.com\/(photo-[\w-]+)[^"'`\s)]*/gi;
const photoId = (url: string): string => /photo-[\w-]+/i.exec(url)?.[0].toLowerCase() ?? '';
const VERIFIED_PHOTO_IDS = new Set(
  [...Object.values(CONTEXTUAL_IMAGES).flat(), ...PORTRAIT_IMAGES].map(photoId),
);

const INDUSTRY_HINTS: Array<[string, RegExp]> = [
  // Vertical packs first: their vocabulary overlaps generic words (menu, session, clients).
  ['weddings', /\b(wedding|bride|groom|rsvp|newlywed|engagement|bridal)\b/i],
  ['events', /\b(festival|line-?up|concert|gig|tickets?|headliner|stage times?)\b/i],
  ['music', /\b(album|single|tour dates|band|musician|tracklist|discography|record label)\b/i],
  ['sports', /\b(fixtures?|league|match ?day|scoreboard|squad|kick-?off|tournament)\b/i],
  ['travel', /\b(flights?|destinations?|itinerary|airline|boarding|getaway)\b/i],
  ['hospitality', /\b(hotel|resort|suites?|guest rooms?|check-?in|boutique stay|lodge)\b/i],
  ['photography', /\b(photographer|photo shoot|shoots|lens|film stills|cinematograph)\w*/i],
  ['real-estate', /\b(real estate|realtor|listings?|bedrooms?|property for sale|homes for sale|viewings?|lettings)\b/i],
  ['nonprofit', /\b(donat(?:e|ion)s?|volunteers?|charity|nonprofit|non-profit|ngo|congregation|church|ministry)\b/i],
  ['professional-services', /\b(law firm|lawyers?|attorneys?|solicitors?|practice areas|accountants?|accounting|bookkeeping|tax advice|financial advis[eo]r)\b/i],
  ['education', /\b(school|students?|tutor(?:ing|s)?|curriculum|enrol(?:l?ment)?|admissions|online courses?|classroom)\b/i],
  ['media', /\b(podcast|episodes?|magazine|subscribe to the newsletter|latest articles|blogger|author)\b/i],
  ['ecommerce', /\b(fashion|apparel|boutique|clothing|garment|wardrobe|streetwear|couture)\b/i],
  ['restaurant', /\b(menu|restaurant|dining|chef|cuisine|reservation|bistro|trattoria|cafe)\b/i],
  ['salon', /\b(salon|spa|stylist|hair|nail|beauty|barber)\b/i],
  ['fitness', /\b(gym|fitness|workout|trainer|yoga|pilates)\b/i],
  ['medical', /\b(clinic|patient|medical|dental|doctor|health care)\b/i],
  ['ecommerce', /\b(shop|cart|product|arrivals|collection|checkout|store)\b/i],
  ['contractor', /\b(contractor|plumb|roof|renovat|construction|hvac)\b/i],
  ['coaching', /\b(coach|coaching|mentor|session)\b/i],
  ['saas', /\b(saas|dashboard|platform|integration|api)\b/i],
  ['portfolio', /\b(portfolio|case stud|my work|designer)\b/i],
  ['agency', /\b(agency|studio|clients|campaign)\b/i],
];

function poolFor(code: string): string[] {
  for (const [key, re] of INDUSTRY_HINTS) if (re.test(code)) return CONTEXTUAL_IMAGES[key] ?? CONTEXTUAL_IMAGES.default;
  return CONTEXTUAL_IMAGES.default;
}

function knownPhotoIds(baseFiles: Record<string, string> | undefined): Set<string> {
  const known = new Set(VERIFIED_PHOTO_IDS);
  for (const content of Object.values(baseFiles ?? {})) {
    if (typeof content !== 'string') continue;
    for (const match of content.matchAll(UNSPLASH_PHOTO)) known.add(photoId(match[0]));
  }
  return known;
}

/**
 * `known` lists photo ids that may stay. An id outside it was invented by the
 * author (the composer prompt supplies no image catalog) and would 404 as a
 * blank hero or "Image unavailable" product card.
 */
// AI authors sometimes reference an image-base constant they never define
// (e.g. PLACEHELDER_IMAGE_BASE, including misspellings), which crashes the
// page with a ReferenceError at render time. Replace any such expression —
// plain reference, string concatenation, or template literal — with a real
// photo from the pool.
const UNDEFINED_IMAGE_BASE_TEMPLATE = /`[^`]*\b[A-Z][A-Z0-9_]*IMAGE[A-Z0-9_]*BASE[A-Z0-9_]*\b[^`]*`/g;
const UNDEFINED_IMAGE_BASE_EXPR =
  /\b[A-Z][A-Z0-9_]*IMAGE[A-Z0-9_]*BASE[A-Z0-9_]*\b(?:\s*\+\s*['"`][^'"`]*['"`])?/g;

export function repairAuthoredImageSource(code: string, known: ReadonlySet<string> = VERIFIED_PHOTO_IDS): string {
  const hasUnsplash = /images\.unsplash\.com\/photo-/i.test(code);
  DEAD_IMAGE_URL.lastIndex = 0;
  AVATAR_URL.lastIndex = 0;
  const dead = DEAD_IMAGE_URL.test(code) || AVATAR_URL.test(code);
  DEAD_IMAGE_URL.lastIndex = 0;
  AVATAR_URL.lastIndex = 0;
  UNDEFINED_IMAGE_BASE_TEMPLATE.lastIndex = 0;
  UNDEFINED_IMAGE_BASE_EXPR.lastIndex = 0;
  const hasUndefinedBase =
    UNDEFINED_IMAGE_BASE_TEMPLATE.test(code) || UNDEFINED_IMAGE_BASE_EXPR.test(code);
  UNDEFINED_IMAGE_BASE_TEMPLATE.lastIndex = 0;
  UNDEFINED_IMAGE_BASE_EXPR.lastIndex = 0;
  if (!dead && !hasUnsplash && !hasUndefinedBase) return code;
  const pool = poolFor(code);
  let i = 0;
  let p = 0;
  return code
    .replace(UNDEFINED_IMAGE_BASE_TEMPLATE, () => `'${pool[i++ % pool.length]}'`)
    .replace(UNDEFINED_IMAGE_BASE_EXPR, () => `'${pool[i++ % pool.length]}'`)
    .replace(DEAD_IMAGE_URL, () => pool[i++ % pool.length])
    .replace(AVATAR_URL, () => PORTRAIT_IMAGES[p++ % PORTRAIT_IMAGES.length])
    .replace(UNSPLASH_PHOTO, (url) => (known.has(photoId(url)) ? url : pool[i++ % pool.length]));
}

export function repairAuthoredImages(
  files: Record<string, string>,
  baseFiles?: Record<string, string>,
): Record<string, string> {
  const known = knownPhotoIds(baseFiles);
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    out[path] = /\.(?:[cm]?[jt]sx?|json)$/.test(path) && typeof content === 'string'
      ? repairAuthoredImageSource(content, known)
      : content;
  }
  return out;
}