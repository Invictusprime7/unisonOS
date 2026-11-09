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
import type { UniversalCapabilityEvidence, UniversalCreationInput } from "@/platform/core/universalCreation";
import { getIndustryProfile } from "@/platform/core/industryMatrix";
import {
  matchTopologyPageAliases,
  resolvePageSpecsForRoles,
  resolveTopologyPageRoleAlias,
} from "@/platform/core/siteTopologyPlanner";

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
  blog: { route: '/blog', title: 'Blog', purpose: 'Present articles and editorial coverage requested by the visitor.', role: 'blog' },
  shop: { route: '/shop', title: 'Shop', purpose: 'Present products only when explicitly requested.', role: 'shop' },
};

const hit = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

function pageForTopologyRole(role: string, industry: string | null): NonNullable<ReturnType<typeof resolvePageSpecsForRoles>[number]> | null {
  const profile = industry ? getIndustryProfile(industry) : undefined;
  const industryPage = profile?.defaultPages.find((page) => page.path !== '/' &&
    resolveTopologyPageRoleAlias(page.suggestedRole || page.purpose) === role,
  );
  if (industryPage) return industryPage;

  const wizardChoice = (Object.keys(PAGE_DETAILS) as PageChoice[])
    .map((choice) => PAGE_DETAILS[choice])
    .find((page) => page.role === role);
  if (wizardChoice) {
    return {
      title: wizardChoice.title,
      path: wizardChoice.route,
      purpose: 'landing',
      customPurpose: wizardChoice.purpose,
      suggestedRole: role,
      expectedSections: [],
    };
  }
  return resolvePageSpecsForRoles([role])[0] ?? null;
}

function pageDetailsForChoice(choice: PageChoice, industry: string | null) {
  const generic = PAGE_DETAILS[choice];
  const role = resolveTopologyPageRoleAlias(generic.role) ?? generic.role;
  const spec = pageForTopologyRole(role, industry);
  return spec ? { ...generic, route: spec.path, title: spec.title } : generic;
}

function explicitlyRequestsExperiencePage(text: string): boolean {
  return /\b(?:experience|immersive)\s+(?:page|route)\b/i.test(text)
    || /\bpages?\b[^.!?\n]{0,120}\b(?:experience|immersive)\b/i.test(text);
}

function topologyPagesFromPrompt(text: string, industry: string | null): UniversalCreationInput['pages'] {
  return matchTopologyPageAliases(text).flatMap(({ alias, role }) => {
    if (role === 'home') return [];
    if (role === 'immersive' && !explicitlyRequestsExperiencePage(text)) return [];
    if (role === 'custom') {
      const slug = alias.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const title = alias.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      return slug ? [{ route: `/${slug}`, title, purpose: `A dedicated ${title.toLowerCase()} page requested by the visitor.`, suggestedRole: 'custom' }] : [];
    }
    const spec = role === 'blog' && alias === 'news'
      ? { title: 'News', path: '/news' }
      : pageForTopologyRole(role, industry);
    if (!spec || spec.path === '/') return [];
    const title = spec.title;
    const details = (Object.keys(PAGE_DETAILS) as PageChoice[])
      .map((choice) => PAGE_DETAILS[choice])
      .find((page) => page.role === role);
    return [{
      route: spec.path,
      title,
      purpose: details?.purpose ?? `Present ${title.toLowerCase()} information requested by the visitor.`,
      suggestedRole: role,
    }];
  });
}

function uniquePagesByRoute(pages: UniversalCreationInput['pages']): UniversalCreationInput['pages'] {
  const seen = new Set<string>();
  return pages.filter((page) => {
    const key = page.route.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

function findOperationalRequest(text: string, pattern: RegExp): string | null {
  const requestPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (const match of text.matchAll(requestPattern)) {
    const before = text.slice(0, match.index);
    const sentencePrefix = before.slice(Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'), before.lastIndexOf(';')) + 1);
    if (!/\b(?:no|not|without|avoid|exclude|omit|skip|never|don't|do not|doesn't|does not|needn't)\b(?:\s+\w+){0,3}\s*$/i.test(sentencePrefix.slice(-80))) return match[0].trim();
  }
  return null;
}

export function deriveChatLaunchPlan(brief: string, options: { promptFirst?: boolean } = {}): ChatLaunchPlan {
  const text = String(brief || "");
  const promptFirst = options.promptFirst === true;
  const confirmedDirection = text.match(
    /(?:^|\n)Confirmed site direction:\s*([\s\S]*?)(?=\n\s*Conversation details:|$)/i,
  )?.[1]?.trim();
  const conversationDetails = text.match(/(?:^|\n)Conversation details:\s*([\s\S]*)$/i)?.[1]?.trim();
  const semanticText = conversationDetails || confirmedDirection || text;
  const analysis = classifyPromptForWizard(semanticText);
  const confident = Boolean(analysis?.industryIdentityMatched && analysis.confidence > 0.55);
  const topologyAliases = matchTopologyPageAliases(semanticText);
  const topologyRoles = new Set<string>(topologyAliases.map(({ role }) => role));
  const mentionsBlog = hit(semanticText, ['blog', 'journal', 'articles']);
  const mentionsNews = topologyAliases.some(({ alias }) => alias === 'news');
  const mentionedPages = (Object.keys(PAGE_KEYWORDS) as PageChoice[]).filter((page) => {
    if (page === 'blog' && mentionsNews && !mentionsBlog) return false;
    return hit(semanticText, PAGE_KEYWORDS[page]) || topologyRoles.has(PAGE_DETAILS[page].role);
  });
  const family = Object.keys(FAMILY_KEYWORDS).find((f) => hit(semanticText, FAMILY_KEYWORDS[f])) ?? null;
  const defaults = confident ? analysis!.selectedPages : [];
  const focusedGoal = FOCUSED_GOALS.find(({ pattern }) => pattern.test(semanticText))?.goal;
  const focusedNeed = focusedGoal ? GOAL_CUSTOMER_NEED[focusedGoal] : undefined;
  const resolvedIndustry = !promptFirst && confident ? analysis!.industry : null;
  const profileRoutes = resolvedIndustry ? getIndustryProfile(resolvedIndustry)?.defaultPages.map((page) => page.path) ?? [] : [];
  const creationPages = uniquePagesByRoute([
    ...mentionedPages.map((page) => pageDetailsForChoice(page, resolvedIndustry)),
    ...topologyPagesFromPrompt(semanticText, resolvedIndustry),
    ...deriveExplicitRoutePages(semanticText).filter((page) => !profileRoutes.some((route) => route.toLowerCase() === page.route.toLowerCase())),
  ]);
  const visualRequirements = [
    ...(family ? [`Visual direction: ${family}`] : []),
    ...[...semanticText.matchAll(/\b(?:#[0-9a-f]{3,8}|(?:red|orange|yellow|green|blue|black|white|gold|teal|pink|maroon|navy|crimson|emerald))\b/gi)].map(([color]) => `Preserve the requested color: ${color}`),
    ...( /\b(flag|flag icon|national colors)\b/i.test(semanticText) ? ['Preserve the specifically requested flag imagery and national colors.'] : []),
    ...( /\bghana\b/i.test(semanticText) && /\bflag\b/i.test(semanticText) ? ['Include a recognizable Ghana flag mark: horizontal red, gold/yellow, and green stripes with a centered black five-point star; keep it accessible and proportional.'] : []),
  ];
  const capabilityRequests = [
    ['booking', findOperationalRequest(semanticText, /\b(?:booking|appointments?|reservations?|reserve (?:a )?(?:table|spot|service)|book (?:a |an )?(?:table|spot|service|appointment|session))\b/gi)],
    ['commerce', findOperationalRequest(semanticText, /\b(?:checkout|cart|online ordering|order online|sell products?|e-?commerce|online store|payment processing|pay online)\b/gi)],
    ['authentication', findOperationalRequest(semanticText, /\b(?:sign in|log in|authentication|user accounts?)\b/gi)],
    ['lead-capture', findOperationalRequest(semanticText, /\b(?:contact form|lead form|quote request|newsletter|subscribe)\b/gi)],
    ['content-management', findOperationalRequest(semanticText, /\b(?:cms|content management system|editorial dashboard|article editor|admin editor|manage (?:articles|posts|content)|create and publish (?:articles|posts))\b/gi)],
  ] as const;
  const capabilityEvidence: UniversalCapabilityEvidence[] = capabilityRequests.flatMap(([capabilityId, phrase]) =>
    phrase ? [{ capabilityId, origin: 'explicit', reason: `Prompt phrase: ${phrase}` }] : [],
  );
  const requestedCapabilities = capabilityEvidence.map(({ capabilityId }) => capabilityId);
  const creationInput: UniversalCreationInput = {
    mode: promptFirst || !confident ? 'open-ended' : 'guided',
    originalPrompt: semanticText,
    sitePurpose: /\b(portfolio|showcase|gallery)\b/i.test(semanticText)
      ? 'Creative portfolio and work showcase'
      : /\b(news|editorial|publication|journal|articles|blog)\b/i.test(semanticText)
        ? 'Editorial publication and content reading'
        : /\b(interactive|educational|learning|course)\b/i.test(semanticText)
          ? 'Interactive educational experience'
          : 'Website purpose described by the visitor',
    subject: semanticText.trim().split(/[\n.!?]/, 1)[0].slice(0, 240),
    ...(!promptFirst && confident ? { industryHint: analysis!.industry } : {}),
    pages: [{ route: '/', title: 'Home', purpose: 'Introduce the subject and purpose stated in the original prompt.', suggestedRole: 'home' }, ...creationPages],
    visualRequirements,
    requestedCapabilities,
    capabilityEvidence,
  };
  return {
    creationInput,
    industry: !promptFirst && confident ? analysis!.industry : null,
    systemId: !promptFirst && confident ? analysis!.systemId : null,
    businessName: analysis?.businessName ?? null,
    primaryGoal: !promptFirst && confident ? focusedGoal ?? analysis!.primaryGoal : null,
    customerNeeds: !promptFirst && confident ? focusedNeed ? [focusedNeed] : analysis!.customerNeeds : [],
    // Pages the chat named win; industry defaults only fill in when none were named.
    selectedPages: promptFirst || mentionedPages.length ? Array.from(new Set(mentionedPages)) : defaults,
    themePresetId: family ?? (!promptFirst && confident ? analysis!.themePresetId : null),
    brief: semanticText,
  };
}

export interface FinalLaunchSelections {
  industry?: string | null;
  businessName: string;
  primaryGoal?: string | null;
  selectedPages: string[];
  themePresetId?: string | null;
}

export function projectUniversalCreationInput(
  plan: ChatLaunchPlan | null,
  selectedPages: readonly PageChoice[],
  options: { promptFirst?: boolean } = {},
): UniversalCreationInput | undefined {
  if (!plan) return undefined;
  if (options.promptFirst) {
    return {
      ...plan.creationInput,
      pages: uniquePagesByRoute([
        { route: '/', title: 'Home', purpose: 'Introduce the subject and purpose stated in the original prompt.', suggestedRole: 'home' },
        ...plan.creationInput.pages.filter((page) => page.route !== '/'),
      ]),
    };
  }
  const industryPages = plan.industry ? getIndustryProfile(plan.industry)?.defaultPages ?? [] : [];
  const wizardRoles = new Set(Object.values(PAGE_DETAILS).map((page) => page.role));
  const standardRoutes = new Set([
    '/',
    '/news',
    ...Object.values(PAGE_DETAILS).map((page) => page.route.toLowerCase()),
    ...industryPages
      .filter((page) => wizardRoles.has(resolveTopologyPageRoleAlias(page.suggestedRole || page.purpose) || ''))
      .map((page) => page.path.toLowerCase()),
  ]);
  return {
    ...plan.creationInput,
    pages: [
      { route: '/', title: 'Home', purpose: 'Introduce the subject and purpose stated in the original prompt.', suggestedRole: 'home' },
      ...selectedPages.map((page) => pageDetailsForChoice(page, plan.industry)),
      ...plan.creationInput.pages.filter((page) => !standardRoutes.has(page.route.toLowerCase())),
    ],
  };
}

/**
 * The single brief App Builder receives. The owner's original prompt leads as
 * the primary creative authority; inferred plan values follow as revisable
 * defaults, with explicit notes where a later refinement changed them.
 */
export function buildSyncedVisionBrief(plan: ChatLaunchPlan | null, final: FinalLaunchSelections): string {
  if (!plan || !plan.brief.trim()) return "";
  const lines = [
    `ORIGINAL PROMPT (primary creative authority; realize every explicit requirement, including layout, imagery, interactions and motion): ${plan.brief.trim()}`,
    `CREATION SPECIFICATION — mode ${plan.creationInput.mode}; purpose: ${plan.creationInput.sitePurpose}; subject: ${plan.creationInput.subject}; requested capabilities: ${plan.creationInput.requestedCapabilities.join(", ") || "none"}.`,
    `REVISABLE PLAN DEFAULTS: business "${final.businessName}"; industry ${final.industry ?? "unspecified"}; goal ${final.primaryGoal ?? "unspecified"}; pages ${final.selectedPages.join(", ") || "home only"}; theme family ${final.themePresetId ?? "auto"}. These never narrow the prompt above.`,
  ];
  const changed: string[] = [];
  if (plan.industry && final.industry && plan.industry !== final.industry) changed.push(`industry is ${final.industry} (not ${plan.industry})`);
  if (plan.businessName && plan.businessName !== final.businessName) changed.push(`the business is named "${final.businessName}"`);
  if (plan.themePresetId && final.themePresetId && plan.themePresetId !== final.themePresetId) changed.push(`theme family is ${final.themePresetId}`);
  const dropped = plan.selectedPages.filter((p) => !final.selectedPages.includes(p));
  if (dropped.length) changed.push(`pages ${dropped.join(", ")} were removed — do not reference them`);
  if (changed.length) lines.push(`CONFIRMED REFINEMENTS: ${changed.join("; ")}. These later refinements win where the prompt disagrees.`);
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
