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

export interface ChatLaunchPlan {
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

const hit = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text));

export function deriveChatLaunchPlan(brief: string): ChatLaunchPlan {
  const text = String(brief || "");
  const confirmedDirection = text.match(
    /(?:^|\n)Confirmed site direction:\s*([\s\S]*?)(?=\n\s*Conversation details:|$)/i,
  )?.[1]?.trim();
  const analysis = classifyPromptForWizard(confirmedDirection || text);
  const confident = Boolean(analysis && analysis.confidence > 0.55);
  const mentionedPages = (Object.keys(PAGE_KEYWORDS) as PageChoice[]).filter((p) => hit(text, PAGE_KEYWORDS[p]));
  const family = Object.keys(FAMILY_KEYWORDS).find((f) => hit(text, FAMILY_KEYWORDS[f])) ?? null;
  const defaults = confident ? analysis!.selectedPages : [];
  const focusedGoal = FOCUSED_GOALS.find(({ pattern }) => pattern.test(text))?.goal;
  const focusedNeed = focusedGoal ? GOAL_CUSTOMER_NEED[focusedGoal] : undefined;
  return {
    industry: confident ? analysis!.industry : null,
    systemId: confident ? analysis!.systemId : null,
    businessName: analysis?.businessName ?? null,
    primaryGoal: focusedGoal ?? (confident ? analysis!.primaryGoal : null),
    customerNeeds: focusedNeed ? [focusedNeed] : confident ? analysis!.customerNeeds : [],
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

/**
 * The single brief App Builder receives: final selections first (authoritative),
 * explicit notes where the user changed something the chat proposed, then the
 * chat's content for wording only.
 */
export function buildSyncedVisionBrief(plan: ChatLaunchPlan | null, final: FinalLaunchSelections): string {
  if (!plan || !plan.brief.trim()) return "";
  const lines = [
    `SYNCED LAUNCH PLAN — authoritative selections: business "${final.businessName}"; industry ${final.industry ?? "unspecified"}; goal ${final.primaryGoal ?? "unspecified"}; pages ${final.selectedPages.join(", ") || "home only"}; theme family ${final.themePresetId ?? "auto"}.`,
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
