import { describe, expect, it } from "vitest";
import type { AIMessage } from "@/components/ai/AIAssistantCore";
import { buildSyncedVisionBrief, deriveChatLaunchPlan, projectUniversalCreationInput } from "@/services/launch/chatLaunchPlan";
import { resolveLaunchCapabilities } from "@/services/launch/launchCapabilities";
import { buildIndustryAuthoringContext } from "@/services/app-builder/appBuilderGenerationContext";
import {
  buildConfirmedSiteBrief,
  describeAssistantFailure,
  isSiteDiscoveryResponse,
  hasSiteConfirmationRequest,
  isSiteConfirmation,
  SITE_CONFIRMATION_MARKER,
  stripSiteConfirmationMarker,
} from "@/components/ai/siteConfirmation";

const message = (
  role: AIMessage["role"],
  content: string,
): AIMessage => ({ role, content, timestamp: new Date(0) });

describe("homepage site confirmation", () => {
  it("recognizes clear affirmative confirmations but not change requests", () => {
    expect(isSiteConfirmation("Yes, please!")).toBe(true);
    expect(isSiteConfirmation("ya")).toBe(true);
    expect(isSiteConfirmation("Yes, that's accurate")).toBe(true);
    expect(isSiteConfirmation("Sounds good!")).toBe(true);
    expect(isSiteConfirmation("Looks good")).toBe(true);
    expect(isSiteConfirmation("Yes, but change the colors")).toBe(false);
    expect(isSiteConfirmation("ya, but make the site blue")).toBe(false);
    expect(isSiteConfirmation("maybe")).toBe(false);
  });

  it("only opens the wizard after the assistant marks the final confirmation", () => {
    expect(hasSiteConfirmationRequest(message(
      "assistant",
      `Does this direction look right?\n${SITE_CONFIRMATION_MARKER}`,
    ))).toBe(true);
    expect(hasSiteConfirmationRequest(message(
      "assistant",
      `Does this direction look right? ${SITE_CONFIRMATION_MARKER}\nWhat pages do you need?`,
    ))).toBe(false);
    expect(hasSiteConfirmationRequest(message(
      "assistant",
      "Great! Is that a complete and accurate summary of the website you want to build?",
    ))).toBe(false);
    expect(hasSiteConfirmationRequest(message(
      "assistant",
      "Does that sound like the right direction for your website?",
    ))).toBe(false);
    expect(hasSiteConfirmationRequest(message(
      "assistant",
      "Excellent! We have a clear direction. You're all set to build your portfolio. Unison is ready to help you configure this!",
    ))).toBe(false);
    expect(hasSiteConfirmationRequest(message("assistant", "What pages do you need?"))).toBe(false);
    expect(hasSiteConfirmationRequest(message("assistant", "What kind of visual style do you envision?"))).toBe(false);
    expect(hasSiteConfirmationRequest(message("user", SITE_CONFIRMATION_MARKER))).toBe(false);
  });

  it("passes a clean confirmed brief without the marker or yes response", () => {
    const brief = buildConfirmedSiteBrief([
      message("user", "I run a bakery and need online orders."),
      message("assistant", `A bakery site with online ordering and a warm visual style.\n${SITE_CONFIRMATION_MARKER}`),
      message("user", "Yes, please."),
    ]);

    expect(brief).toContain("A bakery site with online ordering");
    expect(brief).toContain("I run a bakery and need online orders.");
    expect(brief).not.toContain(SITE_CONFIRMATION_MARKER);
    expect(brief).not.toContain("Yes, please.");
  });

  it("builds the brief from the AI summary and filters short affirmative replies", () => {
    const brief = buildConfirmedSiteBrief([
      message("user", "I need a UI/UX designer portfolio with case studies and booking."),
      message("assistant", "A UI/UX designer portfolio with case studies and meeting booking. Does that sound like the right direction for your website?"),
      message("user", "ya"),
    ]);

    expect(brief).toContain("portfolio with case studies and meeting booking");
    expect(brief).toContain("UI/UX designer portfolio");
    expect(brief).not.toContain("Does that sound like");
    expect(brief).not.toContain("\nya");
  });

  it("strips only the internal confirmation marker from the visible reply", () => {
    expect(stripSiteConfirmationMarker(`Summary\n${SITE_CONFIRMATION_MARKER}`)).toBe("Summary");
  });
});

describe('chat-to-wizard plan coherence', () => {
  it('keeps portfolio purpose and selected pages when a visitor asks for an interactive experience', () => {
    const brief = buildConfirmedSiteBrief([
      message('user', 'Help me create a professional art portfolio website for my business.'),
      message('assistant', 'What type of art do you specialize in, and who is your primary audience?'),
      message('user', 'My selection: Showcase Work'),
      message('assistant', 'What is the main action visitors should take?'),
      message('user', 'My selection: Explore an interactive experience'),
      message('assistant', 'Which pages would you like to include, such as Home, Gallery, FAQ, and Blog?'),
      message('user', 'My selection: Home, Gallery, FAQ, Blog'),
      message('assistant', 'What visual style best represents your artwork?'),
      message('user', 'My selection: Bold · Auto-matched art direction · motion-rich'),
      message('assistant', 'What is your brand or artist name?'),
      message('user', 'My selection: ARIA'),
      message('assistant', 'Brand ARIA. Purpose: showcase work through an interactive experience. Pages: Home, Gallery, FAQ, and Blog. Is this right?'),
      message('user', 'Yes, please.'),
    ]);

    const plan = deriveChatLaunchPlan(brief, { promptFirst: true });
    const projected = projectUniversalCreationInput(plan, plan.selectedPages, { promptFirst: true });

    expect(plan.creationInput.sitePurpose).toBe('Creative portfolio and work showcase');
    expect(plan.selectedPages).toEqual(expect.arrayContaining(['gallery', 'faq', 'blog']));
    expect(projected?.pages.map((page) => page.route)).toEqual(expect.arrayContaining(['/gallery', '/faq', '/blog']));
    expect(projected?.pages.map((page) => page.route)).not.toContain('/experience');
    expect(plan.creationInput.requestedCapabilities).toEqual([]);
    expect(plan.creationInput.visualRequirements).toContain('Visual direction: bold');
  });
});

describe("open-ended page resolution", () => {
  it('preserves Ghana publication intent without adding unrelated business capabilities', () => {
    const prompt = 'Create a Ghana Black Stars football publication with latest articles, match coverage, team stories, an About page, Ghana flag imagery, and Ghanaian red, gold, and green colors.';
    const plan = deriveChatLaunchPlan(prompt, { promptFirst: true });

    expect(plan.creationInput.originalPrompt).toBe(prompt);
    expect(plan.creationInput.pages.some((page) => page.route === '/about')).toBe(true);
    expect(plan.creationInput.visualRequirements).toContain('Preserve the specifically requested flag imagery and national colors.');
    expect(plan.creationInput.visualRequirements).toEqual(expect.arrayContaining([
      expect.stringContaining('Ghana flag mark'),
    ]));
    expect(plan.creationInput.requestedCapabilities).toEqual([]);
    expect(plan.industry).toBeNull();
  });

  it('does not attach classifier industry or industry-default pages to a prompt-first custom route', () => {
    const plan = deriveChatLaunchPlan(
      'Create a football results board with a custom /matches route and Ghana identity.',
      { promptFirst: true },
    );

    expect(plan.creationInput.mode).toBe('open-ended');
    expect(plan.creationInput.industryHint).toBeUndefined();
    expect(plan.industry).toBeNull();
    expect(plan.systemId).toBeNull();
    expect(plan.creationInput.pages.map((page) => page.route)).toContain('/matches');
    expect(plan.creationInput.pages.map((page) => page.route)).not.toContain('/services');
    expect(plan.creationInput.pages.map((page) => page.route)).not.toContain('/booking');
  });

  it('keeps a classifier-confident salon prompt industry-neutral in prompt-first mode', () => {
    const brief = 'Create a salon website with appointment bookings and a custom /matches route.';
    expect(deriveChatLaunchPlan(brief).industry).toBe('salon');
    const plan = deriveChatLaunchPlan(brief, { promptFirst: true });

    expect(plan.creationInput.industryHint).toBeUndefined();
    expect(plan.industry).toBeNull();
    expect(plan.systemId).toBeNull();
    expect(plan.creationInput.requestedCapabilities).toContain('booking');
    expect(plan.creationInput.pages.map((page) => page.route)).toContain('/matches');
    expect(plan.creationInput.pages.map((page) => page.route)).not.toContain('/services');
  });

  it("uses industry topology routes and preserves additional aliased pages", () => {
    const plan = deriveChatLaunchPlan(
      "I run a restaurant. Please include a menu page, a reservations page, a news page, a careers page, and a privacy policy.",
    );
    const plannedRoutes = plan.creationInput.pages.map((page) => page.route);

    expect(plan.industry).toBe("restaurant");
    expect(plannedRoutes).toEqual(expect.arrayContaining([
      "/menu",
      "/booking",
      "/news",
      "/careers",
      "/privacy-policy",
    ]));
    expect(new Set(plannedRoutes).size).toBe(plannedRoutes.length);
    expect(plannedRoutes).not.toContain("/privacy");

    const projectedRoutes = projectUniversalCreationInput(plan, ["services"])
      ?.pages.map((page) => page.route);
    expect(projectedRoutes).toEqual(expect.arrayContaining(["/", "/menu", "/careers", "/privacy-policy"]));
    expect(projectedRoutes).not.toContain("/booking");
    expect(projectedRoutes).not.toContain("/news");
  });
});

describe("homepage assistant failures", () => {
  it("explains expired sessions and stale backends instead of a generic failure", () => {
    expect(describeAssistantFailure(Object.assign(new Error("x"), { context: { status: 401 } })))
      .toMatch(/sign in again/);
    expect(describeAssistantFailure(new Error("Site planning is unavailable"))).toBe("Site planning is unavailable");
    expect(describeAssistantFailure("boom")).toBe("Failed to get AI response");
    expect(isSiteDiscoveryResponse({ mode: "site-discovery" })).toBe(true);
    expect(isSiteDiscoveryResponse({ choices: [] })).toBe(false);
  });

  it("keeps confirmed restaurant identity while honoring focused ordering intent", () => {
    const plan = deriveChatLaunchPlan([
      "Confirmed site direction: A local restaurant website is a great project! What specific type of cuisine or dining style best describes your restaurant, and who is your primary audience?",
      "Conversation details: Restaurant website for local business. Add online ordering, checkout, and a gift shop.",
    ].join("\n\n"));

    expect(plan.industry).toBe("restaurant");
    expect(plan.systemId).toBe("booking");
    expect(plan.primaryGoal).toBe("sell_offers");
    expect(plan.customerNeeds).toContain("buy_offer");
    expect(plan.selectedPages).toEqual(expect.arrayContaining(["checkout", "shop"]));

    const capabilities = resolveLaunchCapabilities(['booking', 'contact', 'newsletter'], plan.industry!, {
      primaryGoal: plan.primaryGoal,
      customerNeeds: plan.customerNeeds,
    });
    const syncedBrief = buildSyncedVisionBrief(plan, {
      businessName: 'Table & Hearth',
      industry: plan.industry,
      primaryGoal: plan.primaryGoal,
      selectedPages: ['home', 'services', 'checkout', 'shop'],
      themePresetId: plan.themePresetId,
    });
    const authoringContext = buildIndustryAuthoringContext(plan.industry!, capabilities);

    expect(syncedBrief).toContain('industry restaurant; goal sell_offers');
    expect(syncedBrief).toContain('pages home, services, checkout, shop');
    expect(capabilities).toEqual(['booking', 'contact', 'newsletter', 'commerce']);
    expect(authoringContext).toContain('Industry catalog targets: menu');
    expect(authoringContext).toContain('Launch capabilities: booking, contact, newsletter, commerce');
    expect(authoringContext).toContain('commerce');
  });
});
