/**
 * Recognises when an owner asks Affinity for a printed or graphic design
 * (flyer, poster, banner, business card, letterhead) rather than a website,
 * so the Home chat can hand the idea to Design Studio.
 */

import { defaultFormatForCategory, getGraphicFormat, type GraphicCategory, type GraphicFormat } from './graphicFormats';

export interface GraphicRequest {
  category: GraphicCategory;
  format: GraphicFormat;
  prompt: string;
}

const CATEGORY_PATTERNS: Array<[GraphicCategory, RegExp]> = [
  ['business-card', /\bbusiness[-\s]?cards?\b|\bcalling cards?\b/],
  ['letterhead', /\bletter[-\s]?heads?\b|\bstationery\b/],
  ['poster', /\bposters?\b/],
  ['flyer', /\bfl(y|i)ers?\b|\bleaflets?\b|\bhandouts?\b/],
  ['banner', /\bbanners?\b|\broll[-\s]?ups?\b|\bpull[-\s]?ups?\b/],
];

const SITE_WORDS = /\b(web\s?sites?|site|landing page|web page|webpage|online store|web app|homepage|home page)\b/;
const SECTION_AFTER = /\b(banner|flyer|poster)\s+(section|block|component|area|strip)\b/;
const WEB_BANNER = /\b(web|online|digital|header|linkedin|twitter|x\.com|youtube|facebook cover|email|newsletter)\b/;

/** Returns the graphic the owner is asking for, or null for anything else. */
const ASKS_FOR_SITE = /\b(create|build|make|design|need|want|start|launch)\s+(me\s+)?((a|an|my|our)\s+)?(new\s+|simple\s+|professional\s+)?(web\s?site|site|landing page|online store|web app)\b/;

export function detectGraphicRequest(message: string): GraphicRequest | null {
  const text = message.toLowerCase();
  if (SECTION_AFTER.test(text)) return null;
  // "Build a website for my poster shop" asks for a website.
  if (ASKS_FOR_SITE.test(text)) return null;
  const match = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text));
  if (!match) return null;
  const category = match[0];

  // "Add a banner to my website" is a website change, not a print banner.
  if (category === 'banner' && SITE_WORDS.test(text) && !/\b(roll[-\s]?up|vinyl|outdoor|print)\b/.test(text)) return null;

  let format = defaultFormatForCategory(category);
  if (category === 'banner' && WEB_BANNER.test(text)) format = getGraphicFormat('banner-web');
  if (category === 'banner' && /\b(outdoor|vinyl|fence|6\s?x\s?2)\b/.test(text)) format = getGraphicFormat('banner-vinyl-6x2');
  if (category === 'flyer' && /\ba5\b/.test(text)) format = getGraphicFormat('flyer-a5');
  if (category === 'flyer' && /\ba4\b/.test(text)) format = getGraphicFormat('flyer-a4');
  if (category === 'letterhead' && /\ba4\b/.test(text)) format = getGraphicFormat('letterhead-a4');
  if (category === 'poster' && /\b(11\s?x\s?17|tabloid)\b/.test(text)) format = getGraphicFormat('poster-11x17');
  if (category === 'business-card' && /\b(eu|europe|european|uk|85\s?x\s?55)\b/.test(text)) format = getGraphicFormat('business-card-eu');

  return { category, format, prompt: message.trim() };
}
