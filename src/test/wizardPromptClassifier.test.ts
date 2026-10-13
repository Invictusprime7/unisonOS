import { describe, it, expect } from "vitest";
import { classifyPromptForWizard } from "@/components/onboarding/wizard/wizardPromptClassifier";

describe("wizardPromptClassifier", () => {
  it("classifies a SaaS vision prompt with high confidence", () => {
    const analysis = classifyPromptForWizard(
      "Build a developer platform for cloud infrastructure named Apex Cloud with API docs and pricing plans",
    );
    expect(analysis).not.toBeNull();
    expect(analysis?.industry).toBe("saas");
    expect(analysis?.systemId).toBe("saas");
    expect(analysis?.businessName).toBe("Apex Cloud");
    expect(analysis?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(analysis?.selectedPages).toContain("pricing");
  });

  it("classifies a Salon vision prompt", () => {
    const analysis = classifyPromptForWizard(
      "Luxury hair and nail spa named Studio Glow with online booking and lookbook gallery",
    );
    expect(analysis).not.toBeNull();
    expect(analysis?.industry).toBe("salon");
    expect(analysis?.systemId).toBe("booking");
    expect(analysis?.businessName).toBe("Studio Glow");
    expect(analysis?.selectedPages).toContain("booking");
  });

  it("classifies an artisanal restaurant vision prompt", () => {
    const analysis = classifyPromptForWizard(
      "Italian bistro called Bella Tavola with seasonal dinner menu and reservations",
    );
    expect(analysis).not.toBeNull();
    expect(analysis?.industry).toBe("restaurant");
    expect(analysis?.systemId).toBe("booking");
    expect(analysis?.businessName).toBe("Bella Tavola");
  });

  it("handles short or empty prompts gracefully", () => {
    expect(classifyPromptForWizard("")).toBeNull();
    expect(classifyPromptForWizard("hi")).toBeNull();
  });

  it("keeps a restaurant identity when the focused request adds commerce language", () => {
    const analysis = classifyPromptForWizard(
      "Bistro restaurant website with online ordering, checkout, a gift shop, and menu dishes",
    );

    expect(analysis?.industry).toBe("restaurant");
    expect(analysis?.systemId).toBe("booking");
  });
});
