export type SiteSetupStepId =
  | "owner_information"
  | "booking_calendar"
  | "notifications"
  | "payments"
  | "database"
  | "domain"
  | "seo"
  | "analytics";

export type SiteSetupCategory = "core" | "growth" | "advanced";

export interface SiteSetupPlanInput {
  industry?: string | null;
  systemType?: string | null;
  capabilities?: string[];
}

export interface SiteSetupPlanStep {
  id: SiteSetupStepId;
  title: string;
  description: string;
  category: SiteSetupCategory;
  timeEstimate: string;
  required: boolean;
}

const DEFAULT_SITE_SETUP_PLAN: readonly SiteSetupPlanStep[] = [
  {
    id: "owner_information",
    title: "Owner Information",
    description: "Review the business contact, location, and brand details shown to visitors",
    category: "core",
    timeEstimate: "~3 min",
    required: false,
  },
  {
    id: "booking_calendar",
    title: "Booking Calendar",
    description: "Configure your availability, service durations, and booking buffer times",
    category: "core",
    timeEstimate: "~5 min",
    required: false,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Set up email and SMS reminders for appointments and form submissions",
    category: "core",
    timeEstimate: "~3 min",
    required: false,
  },
  {
    id: "payments",
    title: "Payment Processing",
    description: "Accept deposits or full payments with Stripe integration",
    category: "core",
    timeEstimate: "~10 min",
    required: false,
  },
  {
    id: "database",
    title: "Database",
    description: "Store form submissions, user data, and content",
    category: "core",
    timeEstimate: "~2 min",
    required: true,
  },
  {
    id: "domain",
    title: "Custom Domain",
    description: "Connect your own domain name for a professional web presence",
    category: "growth",
    timeEstimate: "~10 min",
    required: false,
  },
  {
    id: "seo",
    title: "SEO & Meta Tags",
    description: "Optimize your site for search engines with titles, descriptions, and Open Graph",
    category: "growth",
    timeEstimate: "~5 min",
    required: false,
  },
  {
    id: "analytics",
    title: "Analytics & Tracking",
    description: "Track visitors, conversions, and site performance metrics",
    category: "advanced",
    timeEstimate: "~5 min",
    required: false,
  },
];

/**
 * Capability-aware: booking and payment steps appear only when the site
 * actually books or sells; database is provided by the platform, so it is
 * not a user task. With no capability/system info, the full plan is kept.
 */
export function buildSiteSetupPlan(input: SiteSetupPlanInput = {}): SiteSetupPlanStep[] {
  const caps = new Set((input.capabilities ?? []).map((c) => c.toLowerCase()));
  const sys = (input.systemType ?? "").toLowerCase();
  if (caps.size === 0 && !sys) return DEFAULT_SITE_SETUP_PLAN.map((step) => ({ ...step }));
  const books = caps.has("booking") || sys === "booking";
  const sells = caps.has("commerce") || caps.has("payments") || caps.has("donation") || sys === "store";
  return DEFAULT_SITE_SETUP_PLAN
    .filter((step) => {
      if (step.id === "database") return false;
      if (step.id === "booking_calendar") return books;
      if (step.id === "payments") return sells;
      return true;
    })
    .map((step) => ({ ...step, required: (step.id === "booking_calendar" && books) || (step.id === "payments" && sells) }));
}