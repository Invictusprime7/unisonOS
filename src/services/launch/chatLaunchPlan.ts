/**
 * Chat ↔ Wizard synced launch plan.
 *
 * The home AI chat and the Wizard must feed ONE plan into App Builder. The chat's
 * confirmed brief is parsed once into a structured plan that prefills the Wizard;
 * at launch, the final Wizard selections are authoritative and the brief sent to
 * page authoring is rewritten to state them, so chat wording can never drift
 * from the selections the canonical pipeline compiles.
 */
import { classifyPromptForWizard } from "@/components/onboarding/wizard/wizardPromptClassifier";
import type { CustomerNeed, PageChoice, PrimaryGoal } from "@/components/onboarding/wizard/wizardCatalog";
import type { BusinessSystemType } from "@/data/templates/types";
import type { UniversalCreationInput } from "@/platform/core/universalCreation";

export interface ChatLaunchPlan {
  creationInput: UniversalCreationInput;
  industry: string | null;
  systemId: BusinessSystemType | null;
  businessName: string | null;
  primaryGoal: PrimaryGoal | null;
  customerNeeds: CustomerNeed[];
  selectedPages: PageChoice[];
  themePresetId: string | null;
  brief: string;
}

const PAGE_KEYWORDS: Record<PageChoice, string[]> = {
  about: ["about", "our story", "our studio", "who we are"],
  services: ["services", "treatments", "offerings", "what we do", "menu", "dishes", "food menu", "drinks menu"],
  pricing: ["pricing", "prices", "packages", "rates", "plans"],
  gallery: ["gallery", "portfolio", "lookbook", "our work"],
  faq: ["faq", "questions"],
  contact: ["contact", "get in touch", "inquiry", "enquiry"],
  booking: ["book", "booking", "appointment", "reservation", "viewing"],
  checkout: ["checkout", "cart", "online ordering", "order online", "takeout", "take-out", "pickup", "delivery"],
  blog: ["blog", "journal", "articles", "news"],
  shop: ["shop", "store", "products", "collection", "gift shop", "merch", "merchandise"],
};

const FAMILY_KEYWORDS: Record<string, string[]> = {
  modern: ["modern", "clean", "contemporary", "sleek"],
  editorial: ["editorial", "magazine", "luxury", "elegant", "serif"],
  futuristic: ["futuristic", "tech", "neon", "cyber", "sci-fi"],
  minimalist: ["minimalist", "minimal", "simple", "whitespace"],
  bold: ["bold", "loud", "vibrant", "high contrast", "punchy"],
  organic: ["organic", "natural", "earthy", "warm", "botanical", "calm"],
};

const PAGE_DETAILS: Record<PageChoice, { route: string; title: string; purpose: string; role: string }> = {
  about: { route: '/about', title: 'About', purpose: 'Tell the story and context requested by the visitor.', role: 'about' },
  services: { route: '/services', title: 'Services', purpose: 'Present the offerings requested by the visitor.', role: 'services' },
  pricing: { route: '/pricing', title: 'Pricing', purpose: 'Present pricing information requested by the visitor.', role: 'pricing' },
  gallery: { route: '/gallery', title: 'Gallery', purpose: 'Showcase the work and media requested by the visitor.', role: 'gallery' },
  faq: { route: '/faq', title: 'FAQ', purpose: 'Answer visitor questions requested by the visitor.', role: 'faq' },
  contact: { route: '/contact', title: 'Contact', purpose: 'Provide the contact information requested by the visitor.', role: 'contact' },
  booking: { route: '/booking', title: 'Booking', purpose: 'Support booking only when explicitly requested.', role: 'booking' },
  checkout: { route: '/checkout', title: 'Checkout', purpose: 'Support checkout only when explicitly requested.', role: 'checkout' },
  blog: { route: '/news', title: 'News', purpose: 'Present articles, news, and editorial coverage requested by the visitor.', role: 'blog' },
  shop: { route: '/shop', title: 'Shop', purpose: 'Present products only when explicitly requested.', role: 'shop' },
};

const hit = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

function deriveExplicitRoutePages(text: string): UniversalCreationInput['pages'] {
  const knownRoutes = new Set(['/', ...Object.values(PAGE_DETAILS).map((page) => page.route)]);
  const pages: UniversalCreationInput['pages'] = [];
  const routePattern = /\/[A-Za-z0-9._~:-]+(?:\/[A-Za-z0-9._~:-]+)*/g;
  for (const match of text.matchAll(routePattern)) {
    const route = match[0];
    const preceding = text[match.index! - 1] ?? '';
    if ((preceding && /[A-Za-z0-9_/:.-]/.test(preceding)) || route === '/' || knownRoutes.has(route.toLowerCase())) continue;
    if (pages.some((page) => page.route.toLowerCase() === route.toLowerCase())) continue;
    const staticSegments = route.split('/').filter((segment) => segment && !segment.startsWith(':'));
    const staticSegment = staticSegments[staticSegments.length - 1];
    const title = (staticSegment || 'Page').replace(/[-_.]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    pages.push({ route, title, purpose: `Custom page at ${route}, explicitly requested in the visitor's prompt.`, suggestedRole: 'custom' });
  }
  return pages;
}

function hasOperationalRequest(text: string, pattern: RegExp): boolean {
  const requestPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(requestPattern)) {
    const before = text.slice(0, match.index);
    const sentencePrefix = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'), before.lastIndexOf(';')) + 1);
    if (!/\b(?:no|not|without|avoid|exclude|omit|skip|never|don't|do not|doesn't|does not|needn't)\b(?:\s+\w+){0,3}\s*$/i.test(sentencePrefix.slice(-80))) return true;
  }
  return false;
}

export function deriveChatLaunchPlan(brief: string): ChatLaunchPlan {
  const text = String(brief || "");
  const confirmedDirection = text.match(
    /(?:^|\n)Confirmed site direction:\s*([\s\S]*?)(?=\n\s*Conversation details:|$)/i,
  )?.[1]?.trim();
  const analysis = classifyPromptForWizard(confirmedDirection || text);
  const confident = Boolean(analysis?.industryIdentityMatched && analysis.confidence > 0.55);
  const mentionedPages = (Object.keys(PAGE_KEYWORDS) as PageChoice[]).filter((p) => hit(text, PAGE_KEYWORDS[p]));
  const family = Object.keys(FAMILY_KEYWORDS).find((f) => hit(text, FAMILY_KEYWORDS[f])) ?? null;
  const defaults = confident ? analysis!.selectedPages : [];
  const focusedGoal = FOCUSED_GOALS.find(({ pattern }) => pattern.test(text))?.goal;
  const focusedNeed = focusedGoal ? GOAL_CUSTOMER_NEED[focusedGoal] : undefined;
  const creationPages = [
    ...mentionedPages.map((page) => PAGE_DETAILS[page]),
    ...deriveExplicitRoutePages(text),
  ];
  const visualRequirements = [
    ...(family ? [`Visual direction: ${family}`] : []),
    ...[...text.matchAll(/\b(?:#[0-9a-f]{3,8}|(?:red|orange|yellow|green|blue|black|white|gold|teal|pink|maroon|navy|crimson|emerald))\b/gi)].map(([color]) => `Preserve the requested color: ${color}`),
    ...( /\b(flag|flag icon|national colors)\b/i.test(text) ? ['Preserve the specifically requested flag imagery and national colors.'] : []),
    ...( /\bghana\b/i.test(text) && /\bflag\b/i.test(text) ? ['Include a recognizable Ghana flag mark: horizontal red, gold/yellow, and green stripes with a centered black five-point star; keep it accessible and proportional.'] : []),
  ];
  const requestedCapabilities = [
    ...(hasOperationalRequest(text, /\b(?:booking|appointments?|reservations?|reserve (?:a )?(?:table|spot|service)|book (?:a |an )?(?:table|spot|service|appointment|session))\b/gi) ? ['booking'] : []),
    ...(hasOperationalRequest(text, /\b(?:checkout|cart|online ordering|order online|sell products?|e-?commerce|online store|payment processing|pay online)\b/gi) ? ['commerce'] : []),
    ...(hasOperationalRequest(text, /\b(?:sign in|log in|authentication|user accounts?)\b/gi) ? ['authentication'] : []),
    ...(hasOperationalRequest(text, /\b(?:contact form|lead form|quote request|newsletter|subscribe)\b/gi) ? ['lead-capture'] : []),
    ...(hasOperationalRequest(text, /\b(?:cms|content management system|editorial dashboard|article editor|admin editor|manage (?:articles|posts|content)|create and publish (?:articles|posts))\b/gi) ? ['content-management'] : []),
  ];
  const creationInput: UniversalCreationInput = {
    mode: confident ? 'guided' : 'open-ended',
    originalPrompt: text,
    sitePurpose: /\b(news|editorial|publication|journal|articles|blog)\b/i.test(text)
      ? 'Editorial publication and content reading'
      : /\b(portfolio|showcase|gallery)\b/i.test(text)
        ? 'Creative portfolio and work showcase'
        : /\b(interactive|educational|learning|course)\b/i.test(text)
          ? 'Interactive educational experience'
          : 'Website purpose described by the visitor',
    subject: (confirmedDirection || text).trim().split(/[\n.!?]/, 1)[0].slice(0, 240),
    pages: [{ route: '/', title: 'Home', purpose: 'Introduce the subject and purpose stated in the original prompt.', suggestedRole: 'home' }, ...creationPages],
    visualRequirements,
    requestedCapabilities,
  };
  return {
    creationInput,
    industry: confident ? analysis!.industry : null,
    systemId: confident ? analysis!.systemId : null,
    businessName: analysis?.businessName ?? null,
    primaryGoal: confident ? focusedGoal ?? analysis!.primaryGoal : null,
    customerNeeds: confident ? focusedNeed ? [focusedNeed] : analysis!.customerNeeds : [],
    // Pages the chat named win; industry defaults only fill in when none were named.
    selectedPages: mentionedPages.length ? Array.from(new Set([...mentionedPages])) : defaults,
    themePresetId: family ?? (confident ? analysis!.themePresetId : null),
    brief: text,
  };
}

export interface FinalLaunchSelections {
  industry?: string | null;
  businessName: string;
  primaryGoal?: string | null;
  selectedPages: string[];
  themePresetId?: string | null;
}

export function projectUniversalCreationInput(plan: ChatLaunchPlan | null, selectedPages: readonly PageChoice[]): UniversalCreationInput | undefined {
  if (!plan) return undefined;
  const standardRoutes = new Set(['/', ...Object.values(PAGE_DETAILS).map((page) => page.route)]);
  return {
    ...plan.creationInput,
    pages: [
      { route: '/', title: 'Home', purpose: 'Introduce the subject and purpose stated in the original prompt.', suggestedRole: 'home' },
      ...selectedPages.map((page) => PAGE_DETAILS[page]),
      ...plan.creationInput.pages.filter((page) => !standardRoutes.has(page.route)),
    ],
  };
}

/**
 * The single brief App Builder receives: final selections first (authoritative),
 * explicit notes where the user changed something the chat proposed, then the
 * chat's content for wording only.
 */
export function buildSyncedVisionBrief(plan: ChatLaunchPlan | null, final: FinalLaunchSelections): string {
  if (!plan || !plan.brief.trim()) return "";
  const lines = [
    `SYNCED LAUNCH PLAN — authoritative selections: business "${final.businessName}"; industry ${final.industry ?? "unspecified"}; goal ${final.primaryGoal ?? "unspecified"}; pages ${final.selectedPages.join(", ") || "home only"}; theme family ${final.themePresetId ?? "auto"}.`,
    `CREATION SPECIFICATION — mode ${plan.creationInput.mode}; purpose: ${plan.creationInput.sitePurpose}; subject: ${plan.creationInput.subject}; requested capabilities: ${plan.creationInput.requestedCapabilities.join(", ") || "none"}. Preserve all explicit details from the original prompt.`,
  ];
  const changed: string[] = [];
  if (plan.industry && final.industry && plan.industry !== final.industry) changed.push(`industry is ${final.industry} (not ${plan.industry})`);
  if (plan.businessName && plan.businessName !== final.businessName) changed.push(`the business is named "${final.businessName}"`);
  if (plan.themePresetId && final.themePresetId && plan.themePresetId !== final.themePresetId) changed.push(`theme family is ${final.themePresetId}`);
  const dropped = plan.selectedPages.filter((p) => !final.selectedPages.includes(p));
  if (dropped.length) changed.push(`pages ${dropped.join(", ")} were removed — do not reference them`);
  if (changed.length) lines.push(`The owner changed the chat plan in the Wizard: ${changed.join("; ")}. Where the chat below disagrees, these selections win.`);
  lines.push(`Planning chat (content and wording only): ${plan.brief.trim()}`);
  return lines.join("\n");
}

const FOCUSED_GOALS: Array<{ goal: PrimaryGoal; pattern: RegExp }> = [
  { goal: "sell_offers", pattern: /\b(order online|online ordering|take[- ]?out|pickup|delivery|gift shop|gift cards?|merch|checkout|cart|sell products?)\b/i },
  { goal: "book_appointments", pattern: /\b(reserv(?:e|ation)|book (?:a )?(?:table|appointment|service)|appointments?)\b/i },
  { goal: "drive_calls", pattern: /\b(call us|phone us|directions|visit us|walk[- ]?ins?)\b/i },
  { goal: "showcase_work", pattern: /\b(showcase|portfolio|gallery|our work|lookbook)\b/i },
  { goal: "grow_email_list", pattern: /\b(newsletter|email list|subscribe)\b/i },
  { goal: "donate", pattern: /\b(donate|donation|give to (?:the )?cause)\b/i },
  { goal: "collect_leads", pattern: /\b(quote|estimate|contact us|inquiry|enquiry|lead form)\b/i },
];

const GOAL_CUSTOMER_NEED: Partial<Record<PrimaryGoal, CustomerNeed>> = {
  collect_leads: "fill_form",
  book_appointments: "book_service",
  sell_offers: "buy_offer",
  showcase_work: "explore_immersive",
};
