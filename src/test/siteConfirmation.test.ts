import { describe, expect, it } from "vitest";
import type { AIMessage } from "@/components/ai/AIAssistantCore";
import { buildSyncedVisionBrief, deriveChatLaunchPlan } from "@/services/launch/chatLaunchPlan";
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
    expect(isSiteConfirmation("Looks good")).toBe(true);
    expect(isSiteConfirmation("Yes, but change the colors")).toBe(false);
    expect(isSiteConfirmation("maybe")).toBe(false);
  });

  it("only opens the wizard after an assistant explicitly requested confirmation", () => {
    expect(hasSiteConfirmationRequest(message(
      "assistant",
      `Does this direction look right?\n${SITE_CONFIRMATION_MARKER}`,
    ))).toBe(true);
    expect(hasSiteConfirmationRequest(message("assistant", "What pages do you need?"))).toBe(false);
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

  it("strips only the internal confirmation marker from the visible reply", () => {
    expect(stripSiteConfirmationMarker(`Summary\n${SITE_CONFIRMATION_MARKER}`)).toBe("Summary");
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
