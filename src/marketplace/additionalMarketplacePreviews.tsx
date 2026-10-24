/* eslint-disable react-refresh/only-export-components */

import { ArrowDown, ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import type { SectionEntry } from "@/sections/types";
import {
  MarketplaceRegisteredSection,
  MARKETPLACE_TEMPLATE_VARIANT_PROFILES,
} from "@/marketplace/MarketplaceRegisteredSection";
import {
  getMarketplaceVariantTheme,
  MarketplacePageNavigation,
  marketplaceBindingAttributes,
  RegistryBoundButton,
  RegistryBoundForm,
  RegistryBoundLink,
  type AuthoredMarketplaceTemplate,
  type MarketplacePreviewProps,
  type MarketplaceTemplateBinding,
} from "@/marketplace/marketplaceTemplatePrimitives";

const ASTER_BINDINGS = {
  home: {
    id: "aster:home",
    intent: "nav.anchor",
    label: "Aster Skin Studio",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  treatments: {
    id: "aster:treatments",
    intent: "nav.anchor",
    label: "Treatments",
    sourceSection: "navbar",
    sourceSlot: "treatments-link",
    targetSectionId: "treatments",
  },
  gallery: {
    id: "aster:gallery",
    intent: "nav.anchor",
    label: "Studio",
    sourceSection: "navbar",
    sourceSlot: "studio-link",
    targetSectionId: "gallery",
  },
  booking: {
    id: "aster:booking",
    intent: "booking.create",
    label: "Request an appointment",
    sourceSection: "booking",
    sourceSlot: "booking-submit",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const TERRA_BINDINGS = {
  home: {
    id: "terra:home",
    intent: "nav.anchor",
    label: "Terra House",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  listings: {
    id: "terra:listings",
    intent: "nav.anchor",
    label: "Properties",
    sourceSection: "navbar",
    sourceSlot: "listings-link",
    targetSectionId: "listings",
  },
  journal: {
    id: "terra:journal",
    intent: "nav.anchor",
    label: "Field journal",
    sourceSection: "navbar",
    sourceSlot: "journal-link",
    targetSectionId: "journal",
  },
  inquiry: {
    id: "terra:inquiry",
    intent: "quote.request",
    label: "Arrange a private tour",
    sourceSection: "inquiry",
    sourceSlot: "tour-request",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const POLLEN_BINDINGS = {
  home: {
    id: "pollen:home",
    intent: "nav.anchor",
    label: "Pollen Objects",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  collections: {
    id: "pollen:collections",
    intent: "nav.anchor",
    label: "Collections",
    sourceSection: "navbar",
    sourceSlot: "collections-link",
    targetSectionId: "collections",
  },
  materials: {
    id: "pollen:materials",
    intent: "nav.anchor",
    label: "Materials",
    sourceSection: "navbar",
    sourceSlot: "materials-link",
    targetSectionId: "materials",
  },
  viewBag: {
    id: "pollen:view-bag",
    intent: "cart.view",
    label: "Open shopping bag",
    sourceSection: "navbar",
    sourceSlot: "cart-action",
  },
  addCup: {
    id: "pollen:add-cup",
    intent: "cart.add",
    product: { productId: 'pollen:sunday-cup', name: 'The Sunday cup', price: 38, quantity: 1 },
    label: "Add the Sunday cup to bag",
    sourceSection: "featured-object",
    sourceSlot: "product-primary-action",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const COMMON_BINDINGS = {
  home: {
    id: "common-ground:home",
    intent: "nav.anchor",
    label: "Common Ground",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  work: {
    id: "common-ground:work",
    intent: "nav.anchor",
    label: "Our work",
    sourceSection: "navbar",
    sourceSlot: "work-link",
    targetSectionId: "work",
  },
  impact: {
    id: "common-ground:impact",
    intent: "nav.anchor",
    label: "Impact",
    sourceSection: "navbar",
    sourceSlot: "impact-link",
    targetSectionId: "impact",
  },
  volunteer: {
    id: "common-ground:volunteer",
    intent: "volunteer.signup",
    label: "Volunteer with us",
    sourceSection: "volunteer",
    sourceSlot: "signup-action",
  },
  donate: {
    id: "common-ground:donate",
    intent: "donation.start",
    label: "Fund a neighborhood garden",
    sourceSection: "giving",
    sourceSlot: "donation-action",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const NORTHLINE_BINDINGS = {
  home: {
    id: "northline:home",
    intent: "nav.anchor",
    label: "Northline Works",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  projects: {
    id: "northline:projects",
    intent: "nav.anchor",
    label: "Recent work",
    sourceSection: "navbar",
    sourceSlot: "project-link",
    targetSectionId: "projects",
  },
  process: {
    id: "northline:process",
    intent: "nav.anchor",
    label: "Our process",
    sourceSection: "navbar",
    sourceSlot: "process-link",
    targetSectionId: "process",
  },
  quote: {
    id: "northline:quote",
    intent: "quote.request",
    label: "Get a site visit",
    sourceSection: "estimate",
    sourceSlot: "quote-submit",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const TEMPO_BINDINGS = {
  home: {
    id: "tempo:home",
    intent: "nav.anchor",
    label: "Tempo Field Club",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  classes: {
    id: "tempo:classes",
    intent: "nav.anchor",
    label: "Classes",
    sourceSection: "navbar",
    sourceSlot: "classes-link",
    targetSectionId: "classes",
  },
  approach: {
    id: "tempo:approach",
    intent: "nav.anchor",
    label: "Approach",
    sourceSection: "navbar",
    sourceSlot: "approach-link",
    targetSectionId: "approach",
  },
  schedule: {
    id: "tempo:schedule",
    intent: "booking.create",
    label: "Reserve a place",
    sourceSection: "schedule",
    sourceSlot: "class-booking",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const OPENBOOK_BINDINGS = {
  home: {
    id: "openbook:home",
    intent: "nav.anchor",
    label: "Open Book Academy",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  curriculum: {
    id: "openbook:curriculum",
    intent: "nav.anchor",
    label: "Curriculum",
    sourceSection: "navbar",
    sourceSlot: "curriculum-link",
    targetSectionId: "curriculum",
  },
  reading: {
    id: "openbook:reading",
    intent: "nav.anchor",
    label: "Reading list",
    sourceSection: "navbar",
    sourceSlot: "reading-link",
    targetSectionId: "reading",
  },
  updates: {
    id: "openbook:updates",
    intent: "newsletter.subscribe",
    label: "Get the learning brief",
    sourceSection: "updates",
    sourceSlot: "newsletter-submit",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const LOWTIDE_BINDINGS = {
  home: {
    id: "lowtide:home",
    intent: "nav.anchor",
    label: "Lowtide House",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  rooms: {
    id: "lowtide:rooms",
    intent: "nav.anchor",
    label: "Rooms",
    sourceSection: "navbar",
    sourceSlot: "rooms-link",
    targetSectionId: "rooms",
  },
  shore: {
    id: "lowtide:shore",
    intent: "nav.anchor",
    label: "The shore",
    sourceSection: "navbar",
    sourceSlot: "shore-link",
    targetSectionId: "shore",
  },
  stay: {
    id: "lowtide:stay",
    intent: "booking.create",
    label: "Check stay availability",
    sourceSection: "booking",
    sourceSlot: "stay-booking",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const JUNIPER_BINDINGS = {
  home: {
    id: "juniper:home",
    intent: "nav.anchor",
    label: "Juniper Frame",
    sourceSection: "navbar",
    sourceSlot: "brand-link",
    targetSectionId: "top",
  },
  work: {
    id: "juniper:work",
    intent: "nav.anchor",
    label: "Selected work",
    sourceSection: "navbar",
    sourceSlot: "work-link",
    targetSectionId: "work",
  },
  approach: {
    id: "juniper:approach",
    intent: "nav.anchor",
    label: "Approach",
    sourceSection: "navbar",
    sourceSlot: "approach-link",
    targetSectionId: "approach",
  },
  inquiry: {
    id: "juniper:inquiry",
    intent: "contact.submit",
    label: "Ask about a session",
    sourceSection: "contact",
    sourceSlot: "contact-submit",
  },
} satisfies Record<string, MarketplaceTemplateBinding>;

const ASTER_THEME = getMarketplaceVariantTheme("organic", {
  primary: "337 31% 25%",
  primaryForeground: "0 0% 100%",
  secondary: "344 35% 83%",
  secondaryForeground: "337 31% 25%",
  accent: "20 68% 60%",
  accentForeground: "0 0% 100%",
  background: "36 26% 93%",
  foreground: "337 31% 20%",
  muted: "337 14% 88%",
  mutedForeground: "337 12% 40%",
  card: "36 26% 97%",
  cardForeground: "337 31% 20%",
  border: "337 16% 76%",
});
const TERRA_THEME = getMarketplaceVariantTheme("editorial", {
  primary: "149 33% 22%",
  primaryForeground: "0 0% 100%",
  secondary: "28 35% 78%",
  secondaryForeground: "149 33% 22%",
  accent: "17 62% 52%",
  accentForeground: "0 0% 100%",
  background: "80 14% 94%",
  foreground: "157 23% 16%",
  muted: "78 11% 87%",
  mutedForeground: "150 10% 39%",
  card: "80 14% 97%",
  cardForeground: "157 23% 16%",
  border: "150 14% 72%",
});
const POLLEN_THEME = getMarketplaceVariantTheme("modern", {
  primary: "211 74% 31%",
  primaryForeground: "0 0% 100%",
  secondary: "48 86% 67%",
  secondaryForeground: "211 74% 20%",
  accent: "9 73% 57%",
  accentForeground: "0 0% 100%",
  background: "192 22% 94%",
  foreground: "211 44% 16%",
  muted: "191 16% 87%",
  mutedForeground: "211 18% 40%",
  card: "192 22% 98%",
  cardForeground: "211 44% 16%",
  border: "211 18% 77%",
});
const COMMON_THEME = getMarketplaceVariantTheme("bold", {
  primary: "218 57% 28%",
  primaryForeground: "0 0% 100%",
  secondary: "47 95% 63%",
  secondaryForeground: "218 57% 20%",
  accent: "19 82% 53%",
  accentForeground: "0 0% 100%",
  background: "220 24% 95%",
  foreground: "218 47% 16%",
  muted: "218 18% 88%",
  mutedForeground: "218 18% 38%",
  card: "0 0% 100%",
  cardForeground: "218 47% 16%",
  border: "218 19% 75%",
});
const NORTHLINE_THEME = getMarketplaceVariantTheme("bold", {
  primary: "211 38% 18%",
  primaryForeground: "0 0% 100%",
  secondary: "47 100% 57%",
  secondaryForeground: "211 38% 18%",
  accent: "47 100% 57%",
  accentForeground: "211 38% 18%",
  background: "46 20% 94%",
  foreground: "211 38% 18%",
  muted: "46 11% 86%",
  mutedForeground: "211 12% 38%",
  card: "46 20% 98%",
  cardForeground: "211 38% 18%",
  border: "211 12% 67%",
});
const TEMPO_THEME = getMarketplaceVariantTheme("modern", {
  primary: "187 73% 42%",
  primaryForeground: "0 0% 100%",
  secondary: "351 75% 57%",
  secondaryForeground: "0 0% 100%",
  accent: "43 92% 56%",
  accentForeground: "214 43% 16%",
  background: "191 32% 95%",
  foreground: "214 43% 16%",
  muted: "190 18% 87%",
  mutedForeground: "211 15% 39%",
  card: "0 0% 100%",
  cardForeground: "214 43% 16%",
  border: "190 18% 75%",
});
const OPENBOOK_THEME = getMarketplaceVariantTheme("minimalist", {
  primary: "201 79% 41%",
  primaryForeground: "0 0% 100%",
  secondary: "37 87% 63%",
  secondaryForeground: "25 39% 16%",
  accent: "26 79% 53%",
  accentForeground: "0 0% 100%",
  background: "210 24% 94%",
  foreground: "216 36% 16%",
  muted: "210 15% 87%",
  mutedForeground: "213 13% 40%",
  card: "0 0% 100%",
  cardForeground: "216 36% 16%",
  border: "210 15% 74%",
});
const LOWTIDE_THEME = getMarketplaceVariantTheme("organic", {
  primary: "183 34% 24%",
  primaryForeground: "0 0% 100%",
  secondary: "37 47% 72%",
  secondaryForeground: "183 34% 20%",
  accent: "12 60% 56%",
  accentForeground: "0 0% 100%",
  background: "187 20% 92%",
  foreground: "183 34% 18%",
  muted: "183 17% 84%",
  mutedForeground: "183 12% 38%",
  card: "187 20% 97%",
  cardForeground: "183 34% 18%",
  border: "183 17% 70%",
});
const JUNIPER_THEME = getMarketplaceVariantTheme("editorial", {
  primary: "204 18% 14%",
  primaryForeground: "0 0% 100%",
  secondary: "10 78% 56%",
  secondaryForeground: "0 0% 100%",
  accent: "10 78% 56%",
  accentForeground: "0 0% 100%",
  background: "42 14% 95%",
  foreground: "204 18% 14%",
  muted: "40 8% 88%",
  mutedForeground: "204 9% 40%",
  card: "42 14% 98%",
  cardForeground: "204 18% 14%",
  border: "204 10% 75%",
});

const asterGallery: SectionEntry<"gallery"> = {
  id: "aster-treatment-gallery",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["aster-skin-studio"].variants.gallery,
  props: {
    headline: "Skin, in good light",
    subheadline:
      "A close study of texture, care, and the details that make a ritual personal.",
    columns: 3,
    items: [
      {
        src: "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=1000&q=82",
        alt: "Skincare treatment prepared in a quiet studio",
        caption: "The treatment room",
        category: "Studio",
      },
      {
        src: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=900&q=82",
        alt: "Relaxing spa room with natural details",
        caption: "A moment to reset",
        category: "Ritual",
      },
      {
        src: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=900&q=82",
        alt: "Facial skincare products arranged for a treatment",
        caption: "Skin essentials",
        category: "Care",
      },
    ],
  },
};
const asterServices: SectionEntry<"services"> = {
  id: "aster-treatment-menu",
  type: "services",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["aster-skin-studio"].variants.services,
  props: {
    headline: "Choose your pace",
    subheadline: "Treatments shaped around your skin and the time you have.",
    columns: 3,
    items: [
      { title: "Aster facial", description: "A considered cleanse, gentle exfoliation, and barrier care.", duration: "60 min", price: "$120" },
      { title: "Sculpt + soothe", description: "Facial massage with cooling botanicals and time to rest.", duration: "75 min", price: "$145" },
      { title: "Skin consultation", description: "A calm, practical plan built around your routine.", duration: "30 min", price: "$45" },
    ],
  },
};
const asterTeam: SectionEntry<"team"> = {
  id: "aster-practitioners",
  type: "team",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["aster-skin-studio"].variants.team,
  props: {
    headline: "People who know skin",
    members: [
      { name: "Nia Carter", role: "Esthetician", bio: "Barrier-first care and gentle facial massage.", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=700&q=82" },
      { name: "Eli Ramos", role: "Skin therapist", bio: "Practical routines for sensitive, changing skin.", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&q=82" },
    ],
  },
};
const asterTestimonials: SectionEntry<"testimonials"> = {
  id: "aster-guest-notes",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["aster-skin-studio"].variants.testimonials,
  props: {
    headline: "A visit that feels like yours",
    items: [
      { quote: "The whole appointment felt thoughtful, never rushed, and easy to understand.", author: "Mina R.", role: "Studio guest" },
      { quote: "I left with a simple plan I could actually keep up with.", author: "Alex J.", role: "Studio guest" },
    ],
  },
};
const asterFaq: SectionEntry<"faq"> = {
  id: "aster-visit-guide",
  type: "faq",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["aster-skin-studio"].variants.faq,
  props: {
    headline: "Before your appointment",
    items: [
      { question: "Should I arrive with a clean face?", answer: "Come as you are. Your practitioner will start with a gentle cleanse." },
      { question: "Can I book if my skin is sensitive?", answer: "Yes. Share what you know in the consultation so the treatment can be adjusted." },
      { question: "What should I use after a facial?", answer: "Your practitioner will suggest a simple aftercare routine based on your skin." },
    ],
  },
};

const terraGallery: SectionEntry<"gallery"> = {
  id: "terra-listing-gallery",
  type: "gallery",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["terra-house"].variants.gallery,
  props: {
    headline: "Homes with a sense of place",
    subheadline: "A considered selection across Portland and the lower valley.",
    columns: 3,
    items: [
      { src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1100&q=82", alt: "Modern home opening onto a landscaped courtyard", caption: "Willow Court", category: "Portland · 3 beds" },
      { src: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&q=82", alt: "Contemporary home surrounded by mature trees", caption: "Cedar Ridge", category: "Lake Oswego · 4 beds" },
      { src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1000&q=82", alt: "Bright living room with garden views", caption: "Garden House", category: "Milwaukie · 2 beds" },
    ],
  },
};

const terraAbout: SectionEntry<"about"> = {
  id: "terra-neighborhood-practice",
  type: "about",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["terra-house"].variants.about,
  props: {
    headline: "Know the block before you choose the front door",
    description: "Terra House is a small local practice built around neighborhood knowledge, careful comparisons, and steady support from first tour to final signature.",
  },
};
const terraTeam: SectionEntry<"team"> = {
  id: "terra-local-agents",
  type: "team",
  props: { headline: "People who know these streets", members: [{ name: "Mara Ellis", role: "Neighborhood advisor", bio: "Connects buyers with the details that make a block feel like home." }, { name: "Dev Patel", role: "Property advisor", bio: "Helps clients compare homes with patience and clear context." }] },
};
const terraStats: SectionEntry<"stats"> = {
  id: "terra-local-reach",
  type: "stats",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["terra-house"].variants.stats,
  props: { headline: "Local knowledge, made useful", items: [{ value: "22", label: "Neighborhoods explored" }, { value: "14 yrs", label: "Working in the region" }, { value: "3", label: "Connected counties" }] },
};
const terraTestimonials: SectionEntry<"testimonials"> = {
  id: "terra-client-stories",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["terra-house"].variants.testimonials,
  props: { headline: "A move with more confidence", items: [{ quote: "They helped us see how the neighborhood would feel on an ordinary day.", author: "Jamie & Lee", role: "Terra House clients" }, { quote: "Every trade-off was explained clearly. We knew why we were choosing the place.", author: "Morgan T.", role: "Terra House client" }] },
};
const terraFaq: SectionEntry<"faq"> = {
  id: "terra-buyer-guide",
  type: "faq",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["terra-house"].variants.faq,
  props: { headline: "A few helpful first answers", items: [{ question: "Can we explore before we are ready to buy?", answer: "Yes. Neighborhood conversations can begin well before an offer is in view." }, { question: "Do you work across the Portland area?", answer: "The team focuses on Portland and nearby communities throughout the lower valley." }, { question: "What happens after a private tour request?", answer: "The installed inquiry workflow will follow up to confirm timing and details." }] },
};
const pollenGallery: SectionEntry<"gallery"> = {
  id: "pollen-collection-gallery",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["pollen-objects"].variants.gallery,
  props: {
    headline: "Objects for everyday rituals",
    subheadline:
      "Useful things, chosen for the way they feel in your hands and home.",
    columns: 3,
    items: [
      {
        src: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1000&q=82",
        alt: "Compact film camera in a warm studio setting",
        caption: "Sunday Camera",
        category: "Carry",
      },
      {
        src: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=82",
        alt: "Minimal wristwatch with a clean modern face",
        caption: "Field Watch",
        category: "Wear",
      },
      {
        src: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=82",
        alt: "Brightly colored everyday sneaker",
        caption: "Studio Runner",
        category: "Move",
      },
    ],
  },
};
const pollenServices: SectionEntry<"services"> = {
  id: "pollen-product-line",
  type: "services",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["pollen-objects"].variants.services,
  props: {
    headline: "Good things for the daily ritual",
    subheadline: "Small-batch objects, made to be used and passed along.",
    columns: 3,
    items: [
      {
        title: "Sunday cup",
        description: "Hand-thrown stoneware with a soft, thumb-sized handle.",
        price: "$38",
      },
      {
        title: "Field watch",
        description: "A legible everyday watch with a brushed steel case.",
        price: "$165",
      },
      {
        title: "Studio runner",
        description: "A light, durable sneaker for long days on your feet.",
        price: "$92",
      },
    ],
  },
};
const pollenFeatures: SectionEntry<"features"> = {
  id: "pollen-shopping-notes",
  type: "features",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["pollen-objects"].variants.features,
  props: {
    headline: "Small details, considered",
    subheadline:
      "A useful guide to materials, care, and the makers behind each object.",
    columns: 3,
    items: [
      {
        title: "Made to be used",
        description:
          "Thoughtful shapes and durable finishes, not shelf-only objects.",
      },
      {
        title: "Maker-led",
        description: "We work with small workshops and independent makers.",
      },
      {
        title: "Easy returns",
        description:
          "Try it at home; send it back if it does not fit your routine.",
      },
    ],
  },
};
const pollenTestimonials: SectionEntry<"testimonials"> = {
  id: "pollen-customer-notes",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["pollen-objects"].variants.testimonials,
  props: { headline: "Objects that earn their place", items: [{ quote: "The cup has become the one I reach for every morning.", author: "Casey M.", role: "Pollen customer" }, { quote: "Thoughtful materials, useful details, and no extra fuss.", author: "Jordan R.", role: "Pollen customer" }] },
};
const pollenFaq: SectionEntry<"faq"> = {
  id: "pollen-order-help",
  type: "faq",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["pollen-objects"].variants.faq,
  props: { headline: "Good to know", items: [{ question: "How are small-batch items made?", answer: "Each product page explains the maker, material, and production run." }, { question: "Can I return an item?", answer: "The installed store policy will show eligible returns and timing before checkout." }, { question: "How do I care for my objects?", answer: "Care notes ship with the item and are included in the product details." }] },
};

const commonGallery: SectionEntry<"gallery"> = {
  id: "common-project-gallery",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["common-ground-fund"].variants
      .gallery,
  props: {
    headline: "A place to put down roots",
    subheadline:
      "Community gardens create food, shade, skills, and connection block by block.",
    columns: 2,
    items: [
      {
        src: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1100&q=82",
        alt: "Neighbors working together on a community project",
        caption: "Eastbank garden",
        category: "Food access",
      },
      {
        src: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1000&q=82",
        alt: "Volunteers sharing a meal outdoors",
        caption: "Saturday table",
        category: "Community",
      },
      {
        src: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1000&q=82",
        alt: "Community volunteers preparing supplies together",
        caption: "Tools for every block",
        category: "Learning",
      },
    ],
  },
};
const commonStats: SectionEntry<"stats"> = {
  id: "common-impact-stats",
  type: "stats",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["common-ground-fund"].variants.stats,
  props: { headline: "A little ground can do a lot", items: [{ value: "3", label: "Active garden sites" }, { value: "840", label: "Neighbors reached" }, { value: "4,200", label: "Shared volunteer hours" }] },
};
const commonTestimonials: SectionEntry<"testimonials"> = {
  id: "common-neighbor-stories",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["common-ground-fund"].variants.testimonials,
  props: { headline: "Made possible by neighbors", items: [{ quote: "The garden gave our block a place to meet, share food, and teach the kids where it comes from.", author: "Ari M.", role: "Garden neighbor" }, { quote: "It feels like something the whole community can belong to.", author: "Sam P.", role: "Volunteer" }] },
};
const commonTeam: SectionEntry<"team"> = {
  id: "common-community-team",
  type: "team",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["common-ground-fund"].variants.team,
  props: { headline: "People growing the work", members: [
    { name: "Maya Green", role: "Community organizer", bio: "Brings neighbors, growers, and local partners together.", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&q=82" },
    { name: "Jorge Ruiz", role: "Garden educator", bio: "Shares practical growing skills for every experience level.", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=700&q=82" },
    { name: "Dee Walker", role: "Volunteer lead", bio: "Makes it easy to find a useful first way to help.", image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=700&q=82" },
  ] },
};

const northlineGallery: SectionEntry<"gallery"> = {
  id: "northline-project-gallery",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["northline-works"].variants.gallery,
  props: {
    headline: "Built to work hard",
    subheadline:
      "A few recent projects, from first site visit to final handover.",
    columns: 3,
    items: [
      {
        src: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1100&q=82",
        alt: "Construction crew coordinating work at a jobsite",
        caption: "Workshop addition",
        category: "Build",
      },
      {
        src: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1000&q=82",
        alt: "Completed modern home exterior in a quiet neighborhood",
        caption: "Cedar exterior",
        category: "Renovation",
      },
      {
        src: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1000&q=82",
        alt: "Architectural plans spread out during a project review",
        caption: "On the drawing table",
        category: "Planning",
      },
    ],
  },
};
const northlineServices: SectionEntry<"services"> = {
  id: "northline-trade-services",
  type: "services",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["northline-works"].variants.services,
  props: { headline: "What the crew takes on", items: [{ title: "Repair", description: "Practical fixes, careful diagnosis, and a clear scope." }, { title: "Renovation", description: "Room-by-room upgrades with a clean sequence of work." }, { title: "Small builds", description: "Additions and outbuildings planned around the site." }] },
};
const northlineStats: SectionEntry<"stats"> = {
  id: "northline-work-facts",
  type: "stats",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["northline-works"].variants.stats,
  props: { headline: "A jobsite that stays accountable", items: [{ value: "1", label: "Written scope" }, { value: "Weekly", label: "Progress check-in" }, { value: "Final", label: "Walkthrough together" }] },
};
const northlineTestimonials: SectionEntry<"testimonials"> = {
  id: "northline-client-notes",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["northline-works"].variants.testimonials,
  props: { headline: "Good work, clearly communicated", items: [{ quote: "The scope was clear, the crew kept us updated, and the site was clean at the end of each day.", author: "Taylor H.", role: "Homeowner" }, { quote: "We knew what was happening next and who to ask when a detail changed.", author: "Jamie P.", role: "Renovation client" }] },
};
const northlineFaq: SectionEntry<"faq"> = {
  id: "northline-project-faq",
  type: "faq",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["northline-works"].variants.faq,
  props: { headline: "Before work begins", items: [{ question: "Do you provide a written estimate?", answer: "Yes. The scope and assumptions are reviewed before the work is scheduled." }, { question: "Can a project change after work starts?", answer: "Changes are documented and reviewed so timing and cost remain clear." }, { question: "What areas do you serve?", answer: "Northline works across the greater Portland region and nearby communities." }] },
};

const tempoGallery: SectionEntry<"gallery"> = {
  id: "tempo-movement-gallery",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["tempo-field-club"].variants.gallery,
  props: {
    headline: "Strength looks different on everyone",
    subheadline:
      "A training space for showing up, moving well, and building your own pace.",
    columns: 3,
    items: [
      {
        src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1100&q=82",
        alt: "Athlete practicing a strength exercise in a training studio",
        caption: "Strength session",
        category: "Train",
      },
      {
        src: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1000&q=82",
        alt: "Group fitness class moving through a floor sequence",
        caption: "Move together",
        category: "Classes",
      },
      {
        src: "https://images.unsplash.com/photo-1517963628607-235ccdd5476c?w=1000&q=82",
        alt: "Runner taking a quiet recovery break after training",
        caption: "Room to reset",
        category: "Recover",
      },
    ],
  },
};
const tempoServices: SectionEntry<"services"> = {
  id: "tempo-class-menu",
  type: "services",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["tempo-field-club"].variants.services,
  props: { headline: "Find your way into movement", items: [{ title: "Strength lab", description: "Small-group coaching with clear progressions and options.", duration: "50 min" }, { title: "Field intervals", description: "Outdoor conditioning built around effort, not competition.", duration: "40 min" }, { title: "Mobility room", description: "Guided movement to help you recover and return.", duration: "25 min" }] },
};
const tempoTestimonials: SectionEntry<"testimonials"> = {
  id: "tempo-member-notes",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["tempo-field-club"].variants.testimonials,
  props: { headline: "Show up as you are", items: [{ quote: "The coaches gave me options without making the class feel easier or harder than I needed.", author: "Rae K.", role: "Club member" }, { quote: "I found a routine I can keep, and people who notice when I come back.", author: "Drew P.", role: "Club member" }] },
};
const tempoPricing: SectionEntry<"pricing"> = {
  id: "tempo-memberships",
  type: "pricing",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["tempo-field-club"].variants.pricing,
  props: { headline: "Pick a rhythm that fits", tiers: [{ name: "Drop-in", price: "$24", period: "per class", description: "Try one coached session.", features: ["One class", "Small-group coaching", "All levels welcome"], cta: { label: "Reserve a place", href: "#schedule" } }, { name: "Field pass", price: "$129", period: "per month", description: "A regular rhythm, with room to vary.", features: ["Six classes monthly", "Open gym hours", "Recovery room access"], cta: { label: "Choose a pass", href: "#schedule" }, highlighted: true }] },
};
const tempoFaq: SectionEntry<"faq"> = {
  id: "tempo-membership-questions",
  type: "faq",
  props: { headline: "Before you join", items: [{ question: "Do I need experience?", answer: "No. Coaches offer progressions and options for every starting point." }, { question: "Can I try one class first?", answer: "Yes. A drop-in pass is available before choosing a monthly rhythm." }, { question: "What should I bring?", answer: "Wear comfortable training clothes and bring water. Equipment is provided." }] },
};
const tempoTeam: SectionEntry<"team"> = {
  id: "tempo-coaches",
  type: "team",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["tempo-field-club"].variants.team,
  props: { headline: "Coaches who meet you where you are", members: [{ name: "Talia Brooks", role: "Strength coach", bio: "Builds patient progressions for every starting point." }, { name: "Noah Kim", role: "Movement coach", bio: "Helps members find good mechanics and a pace to return to." }] },
};

const openbookJournal: SectionEntry<"blog-preview"> = {
  id: "openbook-reading-list",
  type: "blog-preview",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["openbook-academy"].variants.journal,
  props: {
    headline: "The reading list",
    posts: [
      {
        title: "Learning is a team sport",
        excerpt: "Build a habit by finding a cohort and a reason to return.",
        date: "Study note",
        author: "Open Book faculty",
        href: "#curriculum",
      },
      {
        title: "The useful question after class",
        excerpt: "A short practice for carrying ideas into the week.",
        date: "Reflection",
        author: "Open Book faculty",
        href: "#curriculum",
      },
    ],
  },
};
const openbookPricing: SectionEntry<"pricing"> = {
  id: "openbook-course-paths",
  type: "pricing",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["openbook-academy"].variants.pricing,
  props: { headline: "Choose a path into the work", tiers: [{ name: "Seminar", price: "$48", period: "per session", description: "A focused evening with a working group.", features: ["Live instructor", "Shared reading", "Take-home notes"], cta: { label: "See upcoming sessions", href: "#curriculum" } }, { name: "Field cohort", price: "$240", period: "per course", description: "A guided sequence with room to practice.", features: ["Four live sessions", "Peer cohort", "Project feedback"], cta: { label: "Explore the curriculum", href: "#curriculum" }, highlighted: true }] },
};
const openbookTeam: SectionEntry<"team"> = {
  id: "openbook-faculty",
  type: "team",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["openbook-academy"].variants.team,
  props: { headline: "Learn with working practitioners", members: [{ name: "Dr. Amara Bell", role: "Research methods", bio: "Turns careful questions into practical inquiry." }, { name: "Ravi Shah", role: "Creative practice", bio: "Helps new ideas become repeatable habits." }, { name: "Elena Costa", role: "Civic systems", bio: "Connects local institutions to everyday life." }] },
};
const openbookStats: SectionEntry<"stats"> = {
  id: "openbook-learning-model",
  type: "stats",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["openbook-academy"].variants.stats,
  props: { headline: "Learning that fits real life", items: [{ value: "4", label: "Week courses" }, { value: "12", label: "Learners per cohort" }, { value: "Live", label: "Instructor feedback" }] },
};
const openbookFaq: SectionEntry<"faq"> = {
  id: "openbook-student-guide",
  type: "faq",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["openbook-academy"].variants.faq,
  props: { headline: "Before you enroll", items: [{ question: "Do I need prior experience?", answer: "Each course describes its starting point and any useful preparation." }, { question: "Are sessions recorded?", answer: "Course details explain what materials are available after each session." }, { question: "Can I join from anywhere?", answer: "Many cohorts meet online, with local sessions listed when available." }] },
};

const lowtideGallery: SectionEntry<"gallery"> = {
  id: "lowtide-rooms-gallery",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["lowtide-house"].variants.gallery,
  props: {
    headline: "Stay close to the water",
    subheadline:
      "Quiet rooms, tidal walks, and the little rituals between check-in and morning.",
    columns: 3,
    items: [
      {
        src: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1100&q=82",
        alt: "Coastal hotel terrace framed by calm garden planting",
        caption: "The sea room",
        category: "Stay",
      },
      {
        src: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1000&q=82",
        alt: "Small coastal pool with views of the landscape",
        caption: "Tide pool",
        category: "Unwind",
      },
      {
        src: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1000&q=82",
        alt: "Hotel bedroom with warm natural materials",
        caption: "Lowtide suite",
        category: "Rest",
      },
    ],
  },
};
const lowtideAbout: SectionEntry<"about"> = {
  id: "lowtide-house-story",
  type: "about",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["lowtide-house"].variants.about,
  props: { headline: "A small house, held by the coast", description: "Lowtide is a few quiet rooms and a generous shoreline. The house keeps the details simple so the landscape has room to do its work." },
};
const lowtidePricing: SectionEntry<"pricing"> = {
  id: "lowtide-room-rates",
  type: "pricing",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["lowtide-house"].variants.pricing,
  props: { headline: "Choose your room", tiers: [{ name: "The Cove", price: "$210", period: "per night", description: "A garden room for two.", features: ["Queen bed", "Garden access", "Breakfast included"], cta: { label: "Check dates", href: "#booking" } }, { name: "The Drift", price: "$285", period: "per night", description: "An upper room facing the water.", features: ["King bed", "Sea view", "Late check-out"], cta: { label: "Check dates", href: "#booking" }, highlighted: true }, { name: "The Shoal", price: "$245", period: "per night", description: "A corner room with morning light.", features: ["King bed", "Reading nook", "Breakfast included"], cta: { label: "Check dates", href: "#booking" } }] },
};
const lowtideTestimonials: SectionEntry<"testimonials"> = {
  id: "lowtide-guest-notes",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["lowtide-house"].variants.testimonials,
  props: { headline: "A stay that lets you exhale", items: [{ quote: "We planned one night and stayed for the long breakfast and another walk.", author: "Morgan D.", role: "Guest" }, { quote: "Thoughtful, quiet, and close enough to the water to hear the weather change.", author: "Alex W.", role: "Guest" }] },
};
const lowtideTeam: SectionEntry<"team"> = {
  id: "lowtide-hosts",
  type: "team",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["lowtide-house"].variants.team,
  props: { headline: "Good hosts, local knowledge", members: [{ name: "Mara Ellis", role: "House host", bio: "Makes arrivals feel easy and the little details feel considered." }, { name: "Theo Park", role: "Local guide", bio: "Knows the walks, tide pools, and quiet breakfast spots nearby." }] },
};

const juniperGallery: SectionEntry<"gallery"> = {
  id: "juniper-selected-work",
  type: "gallery",
  variantId:
    MARKETPLACE_TEMPLATE_VARIANT_PROFILES["juniper-frame"].variants.gallery,
  props: {
    headline: "Selected frames",
    subheadline:
      "People, places, and the small gestures that make a day feel like yours.",
    columns: 3,
    items: [
      {
        src: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1100&q=82",
        alt: "Photographer working with a camera in natural light",
        caption: "Between moments",
        category: "Editorial",
      },
      {
        src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1000&q=82",
        alt: "Open landscape in late afternoon light",
        caption: "Wide open",
        category: "Places",
      },
      {
        src: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1000&q=82",
        alt: "Warm sunrise over a mountain landscape",
        caption: "First light",
        category: "Travel",
      },
    ],
  },
};
const juniperAbout: SectionEntry<"about"> = {
  id: "juniper-photographer-story",
  type: "about",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["juniper-frame"].variants.about,
  props: { headline: "A little direction. A lot of listening.", description: "Juniper Frame makes portraits and event photographs with a light touch. The best frames often happen when the plan has room to breathe.", image: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=900&q=82" },
};
const juniperTestimonials: SectionEntry<"testimonials"> = {
  id: "juniper-client-words",
  type: "testimonials",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["juniper-frame"].variants.testimonials,
  props: { headline: "How it felt to be there", items: [{ quote: "We forgot about the camera and got photographs that feel like us.", author: "Taylor & Morgan", role: "Wedding clients" }, { quote: "The portraits feel relaxed, honest, and full of the day.", author: "Rae S.", role: "Portrait client" }] },
};
const juniperPricing: SectionEntry<"pricing"> = {
  id: "juniper-investment",
  type: "pricing",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["juniper-frame"].variants.pricing,
  props: { headline: "Choose the coverage that fits", tiers: [{ name: "Portrait", price: "$420", description: "A relaxed session for one person or a small family.", features: ["Planning call", "75-minute session", "Edited image gallery"], cta: { label: "Ask about a session", href: "#contact" } }, { name: "Wedding", price: "$2,800", description: "A full story, from the first quiet moments to the last dance.", features: ["Timeline planning", "Full-day coverage", "Online story gallery"], cta: { label: "Talk through your day", href: "#contact" }, highlighted: true }] },
};
const juniperStats: SectionEntry<"stats"> = {
  id: "juniper-practice-facts",
  type: "stats",
  variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES["juniper-frame"].variants.stats,
  props: { headline: "A practice built around the frame", items: [{ value: "12 yrs", label: "Photographing people" }, { value: "4 seasons", label: "Available for travel" }, { value: "1 week", label: "Typical preview gallery" }] },
};
const juniperFaq: SectionEntry<"faq"> = {
  id: "juniper-investment-questions",
  type: "faq",
  props: { headline: "A few details before we begin", items: [{ question: "How far ahead should we book?", answer: "Reach out as soon as you have a date in mind, especially for weddings and travel." }, { question: "When will we see the photographs?", answer: "A small preview arrives first, followed by the full edited gallery." }, { question: "Can we talk through a custom plan?", answer: "Yes. Share what matters to you and Juniper Frame can shape the coverage around it." }] },
};

function AsterPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#281a24] text-[#f8eef0]"
      style={{ fontFamily: "var(--ut-font-serif, Georgia, serif)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={ASTER_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm tracking-[0.18em]"
        >
          ASTER / SKIN STUDIO
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={ASTER_BINDINGS.booking}
          href="#booking"
          onIntent={onIntent}
          className="border border-[#e1aebd] px-3 py-2 text-xs"
        >
          Reserve a visit
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section
          className={`grid ${compact ? "grid-cols-1" : "min-h-[500px] grid-cols-[1fr_1fr]"}`}
        >
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e1aebd]">
              Skin practice · Since 2018
            </p>
            <h1 className="mt-5 text-5xl leading-[0.98] sm:text-6xl">
              A softer kind of skin studio.
            </h1>
            <p className="mt-5 max-w-md font-sans text-sm leading-6 text-white/65">
              Good skin care is a conversation. We make room for your skin to
              change, and your routine to stay simple.
            </p>
            <RegistryBoundLink
              binding={ASTER_BINDINGS.treatments}
              href="#treatments"
              onIntent={onIntent}
              className="mt-8 inline-flex items-center gap-2 font-sans text-sm"
            >
              Find your ritual <ArrowRight className="h-4 w-4" />
            </RegistryBoundLink>
          </div>
          <div className={`relative min-h-64 ${compact ? "order-first" : ""}`}>
            <img
              src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=82"
              alt="Quiet beauty studio prepared for a treatment"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </section>
        <section id="treatments" className="border-t border-white/15">
          <MarketplaceRegisteredSection templateId="aster-skin-studio" section={asterServices} variantId={asterServices.variantId!} theme={ASTER_THEME} onIntent={onIntent} />
        </section>
        <section id="gallery">
          <MarketplaceRegisteredSection
            templateId="aster-skin-studio"
            section={asterGallery}
            variantId={asterGallery.variantId!}
            theme={ASTER_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="practitioners" className="bg-[#f4e9e9] text-[#281a24]">
          <MarketplaceRegisteredSection
            templateId="aster-skin-studio"
            section={asterTeam}
            variantId={asterTeam.variantId!}
            theme={ASTER_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="guest-notes">
          <MarketplaceRegisteredSection
            templateId="aster-skin-studio"
            section={asterTestimonials}
            variantId={asterTestimonials.variantId!}
            theme={ASTER_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="care-notes">
          <MarketplaceRegisteredSection templateId="aster-skin-studio" section={asterFaq} variantId={asterFaq.variantId!} theme={ASTER_THEME} onIntent={onIntent} />
        </section>
        <section
          id="booking"
          className="grid gap-8 px-7 py-12 sm:px-12 md:grid-cols-[1fr_1fr]"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e1aebd]">
              Make time for yourself
            </p>
            <h2 className="mt-3 text-4xl">Begin with a conversation.</h2>
          </div>
          <RegistryBoundForm
            binding={ASTER_BINDINGS.booking}
            onIntent={onIntent}
            className="grid gap-3"
          >
            <label className="grid gap-2 font-sans text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-white/25 bg-transparent px-3"
              />
            </label>
            <label className="grid gap-2 font-sans text-xs">
              What are you looking for?
              <textarea
                name="goal"
                rows={3}
                className="border border-white/25 bg-transparent px-3 py-2"
              />
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(ASTER_BINDINGS.booking)}
              className="min-h-11 bg-[#e1aebd] px-4 font-sans text-sm font-semibold text-[#281a24]"
            >
              Request an appointment
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between border-t border-white/15 px-7 py-6 font-mono text-[10px] uppercase tracking-[0.12em] sm:px-12">
          <span>Aster Skin Studio · Brooklyn</span>
          <span>Care, at your pace</span>
        </footer>
      </main>
    </div>
  );
}

function TerraPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#e7ece2] text-[#183b32]"
      style={{ fontFamily: "Lora, Georgia, serif" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={TERRA_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-lg tracking-[0.12em]"
        >
          TERRA <span className="font-sans">/</span> HOUSE
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={TERRA_BINDINGS.inquiry}
          href="#inquiry"
          onIntent={onIntent}
          className="bg-[#183b32] px-3 py-2 font-sans text-xs text-white"
        >
          Private tour
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section className="px-6 pb-5 pt-8 sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b1593f]">
            Real estate · Portland & the valley
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl leading-[0.98] sm:text-7xl">
            A home is more than the room count.
          </h1>
          <p className="mt-5 max-w-lg font-sans text-sm leading-6 text-[#51675d]">
            We help people find a place that fits the life they are building,
            not just the market they are navigating.
          </p>
        </section>
        <section
          id="listings"
          className={`grid gap-5 px-6 pb-10 sm:px-10 ${compact ? "grid-cols-1" : "grid-cols-[1.35fr_0.65fr]"}`}
        >
          <figure className="relative min-h-[360px] overflow-hidden bg-[#c2cec2]">
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=82"
              alt="Modern home among established trees"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <figcaption className="absolute bottom-4 left-4 bg-[#e7ece2] px-3 py-2 text-xs">
              Willow Court · Portland
            </figcaption>
          </figure>
          <aside className="flex flex-col justify-between border-y border-[#183b32]/25 py-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#b1593f]">
                Featured home · $845,000
              </p>
              <h2 className="mt-4 text-3xl">Room for a different rhythm.</h2>
              <p className="mt-4 font-sans text-sm leading-6 text-[#51675d]">
                Three bedrooms, an open garden room, and a short walk to the
                neighborhood market.
              </p>
            </div>
            <div className="mt-7 grid grid-cols-3 border-t border-[#183b32]/20 pt-4 font-mono text-[10px]">
              <span>3 beds</span>
              <span>2 baths</span>
              <span>1,840 sq ft</span>
            </div>
          </aside>
        </section>
        <section id="rooms">
          <MarketplaceRegisteredSection
            templateId="terra-house"
            section={terraGallery}
            variantId={terraGallery.variantId!}
            theme={TERRA_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="local-perspective"
          className="grid gap-8 bg-[#183b32] px-7 py-11 text-[#e7ece2] sm:px-12 md:grid-cols-2"
        >
          <p className="text-3xl">
            “The best move starts with knowing where you want to spend a
            Tuesday.”
          </p>
          <p className="self-end font-sans text-sm leading-6 text-white/65">
            We walk the blocks, learn the local patterns, and share the details
            that only become clear when you slow down.
          </p>
        </section>
        <section id="neighborhoods">
          <MarketplaceRegisteredSection templateId="terra-house" section={terraAbout} variantId={terraAbout.variantId!} theme={TERRA_THEME} onIntent={onIntent} />
        </section>
        <section id="market-facts">
          <MarketplaceRegisteredSection templateId="terra-house" section={terraStats} variantId={terraStats.variantId!} theme={TERRA_THEME} onIntent={onIntent} />
        </section>
        <section id="client-stories">
          <MarketplaceRegisteredSection templateId="terra-house" section={terraTestimonials} variantId={terraTestimonials.variantId!} theme={TERRA_THEME} onIntent={onIntent} />
        </section>
        <section id="buyer-guide">
          <MarketplaceRegisteredSection templateId="terra-house" section={terraFaq} variantId={terraFaq.variantId!} theme={TERRA_THEME} onIntent={onIntent} />
        </section>
        <section
          id="inquiry"
          className="grid gap-8 px-7 py-12 sm:px-12 md:grid-cols-2"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b1593f]">
              A good first step
            </p>
            <h2 className="mt-3 text-4xl">Tell us what home means to you.</h2>
          </div>
          <RegistryBoundForm
            binding={TERRA_BINDINGS.inquiry}
            onIntent={onIntent}
            className="grid gap-3 font-sans"
          >
            <label className="grid gap-2 text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-[#183b32]/30 bg-transparent px-3"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Neighborhood or town
              <input
                name="area"
                className="h-11 border border-[#183b32]/30 bg-transparent px-3"
              />
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(TERRA_BINDINGS.inquiry)}
              className="min-h-11 bg-[#b1593f] px-4 text-sm text-white"
            >
              Arrange a private tour
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between border-t border-[#183b32]/20 px-7 py-6 font-mono text-[10px] uppercase sm:px-12">
          <span>Terra House · Portland</span>
          <span>Local knowledge, considered moves</span>
        </footer>
      </main>
    </div>
  );
}

function PollenPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#e5eff0] text-[#14334c]"
      style={{ fontFamily: "var(--ut-font-sans, sans-serif)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#14334c]/15 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={POLLEN_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm font-bold tracking-[0.2em]"
        >
          POLLEN OBJECTS
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundButton
          binding={POLLEN_BINDINGS.viewBag}
          onIntent={onIntent}
          className="inline-flex items-center gap-2 bg-[#14334c] px-3 py-2 text-xs text-white"
        >
          Bag <Plus className="h-3.5 w-3.5" />
        </RegistryBoundButton>
      </header>
      <main id="top">
        <section
          className={`grid ${compact ? "grid-cols-1" : "min-h-[480px] grid-cols-[1fr_0.9fr]"}`}
        >
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#bc4f3e]">
              Useful things, made well
            </p>
            <h1 className="mt-5 text-5xl leading-[0.97] sm:text-6xl">
              A little color for the everyday.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#536a78]">
              Objects for slow mornings and well-used shelves. Designed to be
              reached for, not saved for later.
            </p>
            <RegistryBoundLink
              binding={POLLEN_BINDINGS.collections}
              href="#collections"
              onIntent={onIntent}
              className="mt-8 inline-flex items-center gap-2 text-sm"
            >
              Shop the collection <ArrowDown className="h-4 w-4" />
            </RegistryBoundLink>
          </div>
          <div
            className={`relative min-h-64 bg-[#f1ce6b] ${compact ? "order-first" : ""}`}
          >
            <img
              src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=82"
              alt="Colorful home objects arranged on a studio shelf"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </section>
        <section
          id="featured-product"
          className="grid gap-8 bg-[#f5f1e7] px-7 py-11 sm:px-12 md:grid-cols-[1fr_1fr]"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#bc4f3e]">
              Object 01 / Table
            </p>
            <h2 className="mt-3 text-3xl">The Sunday cup</h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#536a78]">
              Thrown in small batches, glazed by hand, and shaped to make the
              first coffee feel like a small ceremony.
            </p>
            <p className="mt-5 font-mono text-sm">$38 · stoneware</p>
            <RegistryBoundButton
              binding={POLLEN_BINDINGS.addCup}
              onIntent={onIntent}
              className="mt-6 inline-flex min-h-11 items-center gap-3 bg-[#bc4f3e] px-4 text-sm text-white"
            >
              Add to bag <Plus className="h-4 w-4" />
            </RegistryBoundButton>
          </div>
          <img
            src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=1000&q=82"
            alt="Handmade ceramic vessels arranged on a worktable"
            className="aspect-[4/3] h-full w-full object-cover"
          />
        </section>
        <section id="collections">
          <MarketplaceRegisteredSection
            templateId="pollen-objects"
            section={pollenGallery}
            variantId={pollenGallery.variantId!}
            theme={POLLEN_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="materials"
          className="grid gap-6 bg-[#14334c] px-7 py-10 text-[#e5eff0] sm:px-12 md:grid-cols-3"
        >
          {[
            ["01", "Clay", "A tactile glaze, fired for daily use."],
            ["02", "Canvas", "Hard-wearing weave with a softer hand."],
            ["03", "Steel", "Simple forms that age with a little character."],
          ].map(([number, title, detail]) => (
            <article key={number} className="border-t border-white/25 pt-4">
              <p className="font-mono text-xs text-[#f1ce6b]">{number}</p>
              <h3 className="mt-4 text-xl">{title}</h3>
              <p className="mt-2 text-sm text-white/65">{detail}</p>
            </article>
          ))}
        </section>
        <section id="product-line">
          <MarketplaceRegisteredSection
            templateId="pollen-objects"
            section={pollenServices}
            variantId={pollenServices.variantId!}
            theme={POLLEN_THEME}
            onIntent={onIntent}
          />
        </section>
        <section>
          <MarketplaceRegisteredSection
            templateId="pollen-objects"
            section={pollenFeatures}
            variantId={pollenFeatures.variantId!}
            theme={POLLEN_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="customer-notes">
          <MarketplaceRegisteredSection templateId="pollen-objects" section={pollenTestimonials} variantId={pollenTestimonials.variantId!} theme={POLLEN_THEME} onIntent={onIntent} />
        </section>
        <section id="help">
          <MarketplaceRegisteredSection templateId="pollen-objects" section={pollenFaq} variantId={pollenFaq.variantId!} theme={POLLEN_THEME} onIntent={onIntent} />
        </section>
        <footer className="flex justify-between border-t border-[#14334c]/15 px-7 py-6 font-mono text-[10px] uppercase sm:px-12">
          <span>Pollen Objects · Everyday goods</span>
          <span>Small batches, fewer things</span>
        </footer>
      </main>
    </div>
  );
}

function CommonGroundPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#f2efe5] text-[#182b49]"
      style={{ fontFamily: "Lora, Georgia, serif" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#182b49]/15 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={COMMON_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm font-semibold tracking-[0.12em]"
        >
          COMMON GROUND
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundButton
          binding={COMMON_BINDINGS.donate}
          onIntent={onIntent}
          className="bg-[#e6b845] px-3 py-2 font-sans text-xs font-semibold"
        >
          Give today
        </RegistryBoundButton>
      </header>
      <main id="top">
        <section
          className={`grid ${compact ? "grid-cols-1" : "min-h-[470px] grid-cols-[1.1fr_0.9fr]"}`}
        >
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#b54e37]">
              Community land · shared harvest
            </p>
            <h1 className="mt-5 text-5xl leading-[0.96] sm:text-7xl">
              Good ground grows more than food.
            </h1>
            <p className="mt-5 max-w-md font-sans text-sm leading-6 text-[#4f6078]">
              We help neighborhoods turn overlooked lots into places to grow,
              learn, and gather.
            </p>
            <RegistryBoundLink
              binding={COMMON_BINDINGS.work}
              href="#work"
              onIntent={onIntent}
              className="mt-8 inline-flex items-center gap-2 font-sans text-sm"
            >
              See what is growing <ArrowRight className="h-4 w-4" />
            </RegistryBoundLink>
          </div>
          <div className={`relative min-h-64 ${compact ? "order-first" : ""}`}>
            <img
              src="https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=1200&q=82"
              alt="Community volunteers tending a neighborhood garden"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </section>
        <section id="impact" className="border-y border-[#182b49]/15 bg-[#e6b845]">
          <MarketplaceRegisteredSection templateId="common-ground-fund" section={commonStats} variantId={commonStats.variantId!} theme={COMMON_THEME} onIntent={onIntent} />
        </section>
        <section id="work">
          <MarketplaceRegisteredSection
            templateId="common-ground-fund"
            section={commonGallery}
            variantId={commonGallery.variantId!}
            theme={COMMON_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="impact-story"
          className="grid gap-8 px-7 py-12 sm:px-12 md:grid-cols-[1fr_1fr]"
        >
          <h2 className="text-4xl">A neighborhood resource, grown together.</h2>
          <p className="self-end font-sans text-sm leading-6 text-[#4f6078]">
            Each site is shaped with its neighbors: shared tools, seasonal
            growing, and practical workshops that stay open to the whole block.
          </p>
        </section>
        <section id="neighbor-stories">
          <MarketplaceRegisteredSection
            templateId="common-ground-fund"
            section={commonTestimonials}
            variantId={commonTestimonials.variantId!}
            theme={COMMON_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="organizers">
          <MarketplaceRegisteredSection
            templateId="common-ground-fund"
            section={commonTeam}
            variantId={commonTeam.variantId!}
            theme={COMMON_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="volunteer"
          className="flex flex-wrap items-center justify-between gap-5 bg-[#182b49] px-7 py-8 text-[#f2efe5] sm:px-12"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#e6b845]">
              Bring your hands, or your ideas
            </p>
            <h2 className="mt-2 text-3xl">There is room at the table.</h2>
          </div>
          <RegistryBoundButton
            binding={COMMON_BINDINGS.volunteer}
            onIntent={onIntent}
            className="min-h-11 border border-white/45 px-4 font-sans text-sm"
          >
            Volunteer with us
          </RegistryBoundButton>
        </section>
        <footer className="flex justify-between px-7 py-6 font-mono text-[10px] uppercase sm:px-12">
          <span>Common Ground Fund · Community work</span>
          <RegistryBoundButton
            binding={COMMON_BINDINGS.donate}
            onIntent={onIntent}
            className="underline underline-offset-4"
          >
            Support the next site
          </RegistryBoundButton>
        </footer>
      </main>
    </div>
  );
}

function NorthlinePreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#e9e3d7] text-[#1c2d3d]"
      style={{ fontFamily: "var(--ut-font-sans, sans-serif)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-[#f3c644] bg-[#1c2d3d] px-6 py-5 text-white sm:px-10">
        <RegistryBoundLink
          binding={NORTHLINE_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="font-black tracking-[0.1em]"
        >
          NORTHLINE / WORKS
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={NORTHLINE_BINDINGS.quote}
          href="#estimate"
          onIntent={onIntent}
          className="bg-[#f3c644] px-3 py-2 text-xs font-bold text-[#1c2d3d]"
        >
          Get a site visit
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section
          className={`grid ${compact ? "grid-cols-1" : "min-h-[510px] grid-cols-[0.9fr_1.1fr]"}`}
        >
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#a44932]">
              Licensed · insured · accountable
            </p>
            <h1 className="mt-5 text-5xl font-black uppercase leading-[0.91] sm:text-7xl">
              Make the hard part feel straightforward.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#52606a]">
              Renovation, repair, and small builds delivered with a clear scope
              and a clean site.
            </p>
            <RegistryBoundLink
              binding={NORTHLINE_BINDINGS.projects}
              href="#projects"
              onIntent={onIntent}
              className="mt-8 inline-flex items-center gap-2 text-sm font-bold"
            >
              See the work <ArrowUpRight className="h-4 w-4" />
            </RegistryBoundLink>
          </div>
          <div
            className={`relative min-h-64 bg-[#263c4d] ${compact ? "order-first" : ""}`}
          >
            <img
              src="https://images.unsplash.com/photo-1505798577917-a65157d3320a?w=1200&q=82"
              alt="Tradesperson measuring and repairing a home interior"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </section>
        <section
          id="process"
          className="grid gap-5 bg-[#f3c644] px-7 py-8 sm:px-12 md:grid-cols-3"
        >
          {[
            [
              "01",
              "Walk it",
              "We inspect the site and talk through the real constraints.",
            ],
            [
              "02",
              "Scope it",
              "You get written work, options, and a clear estimate.",
            ],
            [
              "03",
              "Finish it",
              "We walk the details together before the job is closed.",
            ],
          ].map(([n, title, detail]) => (
            <article key={n} className="border-t border-[#1c2d3d]/35 pt-3">
              <p className="font-mono text-xs">{n}</p>
              <h2 className="mt-3 text-xl font-bold">{title}</h2>
              <p className="mt-2 text-xs leading-5">{detail}</p>
            </article>
          ))}
        </section>
        <section id="projects">
          <MarketplaceRegisteredSection
            templateId="northline-works"
            section={northlineGallery}
            variantId={northlineGallery.variantId!}
            theme={NORTHLINE_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="trade-services" className="border-y-4 border-[#f3c644]">
          <MarketplaceRegisteredSection
            templateId="northline-works"
            section={northlineServices}
            variantId={northlineServices.variantId!}
            theme={NORTHLINE_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="project-facts">
          <MarketplaceRegisteredSection
            templateId="northline-works"
            section={northlineStats}
            variantId={northlineStats.variantId!}
            theme={NORTHLINE_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="client-notes">
          <MarketplaceRegisteredSection templateId="northline-works" section={northlineTestimonials} variantId={northlineTestimonials.variantId!} theme={NORTHLINE_THEME} onIntent={onIntent} />
        </section>
        <section id="common-questions">
          <MarketplaceRegisteredSection templateId="northline-works" section={northlineFaq} variantId={northlineFaq.variantId!} theme={NORTHLINE_THEME} onIntent={onIntent} />
        </section>
        <section
          id="estimate"
          className="grid gap-8 bg-[#1c2d3d] px-7 py-12 text-white sm:px-12 md:grid-cols-2"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#f3c644]">
              Start with the site
            </p>
            <h2 className="mt-3 text-4xl font-bold">
              Show us what needs doing.
            </h2>
            <p className="mt-4 text-sm text-white/70">
              A configured estimate workflow will collect your project details
              after installation.
            </p>
          </div>
          <RegistryBoundForm
            binding={NORTHLINE_BINDINGS.quote}
            onIntent={onIntent}
            className="grid gap-3"
          >
            <label className="grid gap-2 text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-white/30 bg-transparent px-3"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Project type
              <select
                name="project"
                defaultValue="Repair"
                className="h-11 border border-white/30 bg-[#1c2d3d] px-3"
              >
                <option>Repair</option>
                <option>Renovation</option>
                <option>New build</option>
              </select>
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(NORTHLINE_BINDINGS.quote)}
              className="min-h-11 bg-[#f3c644] px-4 font-bold text-[#1c2d3d]"
            >
              Request a site visit
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between px-7 py-6 font-mono text-[10px] uppercase sm:px-12">
          <span>Northline Works · Pacific Northwest</span>
          <span>Good work. Clear scope.</span>
        </footer>
      </main>
    </div>
  );
}

function TempoPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#deedf0] text-[#19383d]"
      style={{ fontFamily: "var(--ut-font-sans, sans-serif)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={TEMPO_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm font-black tracking-[0.22em]"
        >
          TEMPO FIELD CLUB
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={TEMPO_BINDINGS.schedule}
          href="#schedule"
          onIntent={onIntent}
          className="bg-[#c74943] px-3 py-2 text-xs font-semibold text-white"
        >
          Find your class
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section
          className={`grid items-center gap-7 px-6 py-9 sm:px-10 ${compact ? "grid-cols-1" : "grid-cols-[1fr_1fr]"}`}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#c74943]">
              Move well · Stay curious
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.96] sm:text-7xl">
              Make room for your kind of strong.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#51666a]">
              A neighborhood training club for strength, conditioning, and the
              days you start again.
            </p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=82"
            alt="Bright neighborhood gym with training equipment"
            className="aspect-[4/3] w-full object-cover"
          />
        </section>
        <section id="classes" className="bg-[#19383d] text-[#deedf0]">
          <MarketplaceRegisteredSection templateId="tempo-field-club" section={tempoServices} variantId={tempoServices.variantId!} theme={TEMPO_THEME} onIntent={onIntent} />
        </section>
        <section id="gallery">
          <MarketplaceRegisteredSection
            templateId="tempo-field-club"
            section={tempoGallery}
            variantId={tempoGallery.variantId!}
            theme={TEMPO_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="approach"
          className="grid gap-6 px-7 py-10 sm:px-12 md:grid-cols-[1fr_1fr]"
        >
          <p className="text-3xl">Train for the life you actually live.</p>
          <p className="self-end text-sm leading-6 text-[#51666a]">
            No perfect starting point required. Coaches meet you where you are
            and help make the next session feel possible.
          </p>
        </section>
        <section id="member-stories">
          <MarketplaceRegisteredSection templateId="tempo-field-club" section={tempoTestimonials} variantId={tempoTestimonials.variantId!} theme={TEMPO_THEME} onIntent={onIntent} />
        </section>
        <section id="coaches">
          <MarketplaceRegisteredSection templateId="tempo-field-club" section={tempoTeam} variantId={tempoTeam.variantId!} theme={TEMPO_THEME} onIntent={onIntent} />
        </section>
        <section id="memberships">
          <MarketplaceRegisteredSection templateId="tempo-field-club" section={tempoPricing} variantId={tempoPricing.variantId!} theme={TEMPO_THEME} onIntent={onIntent} />
        </section>
        <section
          id="schedule"
          className="grid gap-8 border-t border-[#19383d]/20 bg-[#f1b557] px-7 py-10 sm:px-12 md:grid-cols-2"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em]">
              Try one session
            </p>
            <h2 className="mt-3 text-4xl">Come move with us.</h2>
          </div>
          <RegistryBoundForm
            binding={TEMPO_BINDINGS.schedule}
            onIntent={onIntent}
            className="grid gap-3"
          >
            <label className="grid gap-2 text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-[#19383d]/35 bg-transparent px-3"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Class
              <select
                name="class"
                defaultValue="Strength lab"
                className="h-11 border border-[#19383d]/35 bg-[#f1b557] px-3"
              >
                <option>Strength lab</option>
                <option>Field intervals</option>
                <option>Mobility room</option>
              </select>
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(TEMPO_BINDINGS.schedule)}
              className="min-h-11 bg-[#19383d] px-4 text-sm text-white"
            >
              Reserve a place
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between px-7 py-6 font-mono text-[10px] uppercase sm:px-12">
          <span>Tempo Field Club · Eastside</span>
          <span>Move at your pace</span>
        </footer>
      </main>
    </div>
  );
}

function OpenbookPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#101f2d] text-[#eef1e9]"
      style={{ fontFamily: "var(--ut-font-mono, monospace)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#94b6c5]/25 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={OPENBOOK_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm font-semibold tracking-[0.1em]"
        >
          OPEN BOOK <span className="text-[#e7a65b]">ACADEMY</span>
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={OPENBOOK_BINDINGS.updates}
          href="#updates"
          onIntent={onIntent}
          className="border border-[#94b6c5]/50 px-3 py-2 text-[10px]"
        >
          Get the brief
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section className="grid gap-8 px-6 py-12 sm:px-10 md:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#81c8c1]">
              Open learning / cohort 04
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] sm:text-6xl">
              Learn something that changes what you can do.
            </h1>
            <p className="mt-5 max-w-lg font-sans text-sm leading-6 text-[#b8c7cc]">
              Short courses, live seminars, and the tools to keep your curiosity
              moving.
            </p>
            <RegistryBoundLink
              binding={OPENBOOK_BINDINGS.curriculum}
              href="#curriculum"
              onIntent={onIntent}
              className="mt-8 inline-flex items-center gap-2 bg-[#e7a65b] px-4 py-3 text-xs font-bold text-[#101f2d]"
            >
              Browse the curriculum <ArrowRight className="h-4 w-4" />
            </RegistryBoundLink>
          </div>
          <img
            src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=82"
            alt="Instructor guiding a classroom discussion"
            className="aspect-[4/3] w-full object-cover"
          />
        </section>
        <section
          id="curriculum"
          className="grid gap-0 border-y border-[#94b6c5]/25 sm:grid-cols-3"
        >
          {[
            [
              "FIELD 01",
              "Research literacy",
              "Read evidence, ask better questions.",
            ],
            [
              "FIELD 02",
              "Creative practice",
              "Build a steady habit of making.",
            ],
            [
              "FIELD 03",
              "Civic systems",
              "Understand how local decisions work.",
            ],
          ].map(([code, title, desc]) => (
            <article
              key={code}
              className="border-b border-[#94b6c5]/25 p-6 sm:border-r"
            >
              <p className="text-[9px] text-[#81c8c1]">{code}</p>
              <h2 className="mt-5 text-lg">{title}</h2>
              <p className="mt-2 font-sans text-xs text-[#b8c7cc]">{desc}</p>
            </article>
          ))}
        </section>
        <section id="reading">
          <MarketplaceRegisteredSection
            templateId="openbook-academy"
            section={openbookJournal}
            variantId={openbookJournal.variantId!}
            theme={OPENBOOK_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="course-options">
          <MarketplaceRegisteredSection templateId="openbook-academy" section={openbookPricing} variantId={openbookPricing.variantId!} theme={OPENBOOK_THEME} onIntent={onIntent} />
        </section>
        <section id="faculty">
          <MarketplaceRegisteredSection templateId="openbook-academy" section={openbookTeam} variantId={openbookTeam.variantId!} theme={OPENBOOK_THEME} onIntent={onIntent} />
        </section>
        <section id="learning-outcomes">
          <MarketplaceRegisteredSection templateId="openbook-academy" section={openbookStats} variantId={openbookStats.variantId!} theme={OPENBOOK_THEME} onIntent={onIntent} />
        </section>
        <section id="student-guide">
          <MarketplaceRegisteredSection templateId="openbook-academy" section={openbookFaq} variantId={openbookFaq.variantId!} theme={OPENBOOK_THEME} onIntent={onIntent} />
        </section>
        <section
          id="updates"
          className="grid gap-6 bg-[#e7a65b] px-7 py-10 text-[#101f2d] sm:px-12 md:grid-cols-[1fr_0.8fr]"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em]">
              A short note, once a month
            </p>
            <h2 className="mt-3 text-3xl">Keep a page open.</h2>
            <p className="mt-3 font-sans text-sm">
              Course dates, reading lists, and ideas worth returning to.
            </p>
          </div>
          <RegistryBoundForm
            binding={OPENBOOK_BINDINGS.updates}
            onIntent={onIntent}
            className="flex flex-col justify-center gap-3"
          >
            <label className="grid gap-2 text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-[#101f2d]/35 bg-transparent px-3"
              />
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(OPENBOOK_BINDINGS.updates)}
              className="min-h-11 bg-[#101f2d] px-4 text-sm text-white"
            >
              Subscribe to the brief
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between border-t border-[#94b6c5]/25 px-7 py-6 text-[9px] uppercase tracking-[0.14em] sm:px-12">
          <span>Open Book Academy · Online & local</span>
          <span>Learn / practice / share</span>
        </footer>
      </main>
    </div>
  );
}

function LowtidePreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#172d34] text-[#e5eee8]"
      style={{ fontFamily: "Lora, Georgia, serif" }}
    >
      <header className="absolute z-10 flex w-full flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={LOWTIDE_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm tracking-[0.24em]"
        >
          LOWTIDE HOUSE
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] text-white/80 md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={LOWTIDE_BINDINGS.stay}
          href="#booking"
          onIntent={onIntent}
          className="border border-white/60 px-3 py-2 font-sans text-xs"
        >
          Plan a stay
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section className="relative grid min-h-[570px] place-items-center text-center">
          <img
            src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=82"
            alt="Quiet coastal hotel framed by evening light"
            className="absolute inset-0 h-full w-full object-cover opacity-65"
          />
          <div className="relative max-w-3xl px-6 pt-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em]">
              A small house beside the sea
            </p>
            <h1 className="mt-5 text-5xl leading-[0.98] sm:text-7xl">
              Let the tide set the schedule.
            </h1>
            <p className="mx-auto mt-5 max-w-xl font-sans text-sm leading-6 text-white/85">
              A few quiet rooms, a long shoreline, and time enough to notice
              both.
            </p>
            <RegistryBoundLink
              binding={LOWTIDE_BINDINGS.rooms}
              href="#rooms"
              onIntent={onIntent}
              className="mt-8 inline-flex items-center gap-2 border-b border-white pb-2 font-sans text-sm"
            >
              Find your room <ArrowDown className="h-4 w-4" />
            </RegistryBoundLink>
          </div>
        </section>
        <section
          id="rooms"
          className="grid gap-8 px-7 py-11 sm:px-12 md:grid-cols-[0.75fr_1.25fr]"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d5aa78]">
              Three rooms / one house
            </p>
            <h2 className="mt-3 text-4xl">Stay a little longer.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["The Cove", "Ground floor · garden"],
              ["The Drift", "Upper floor · sea"],
              ["The Shoal", "Corner room · light"],
            ].map(([name, detail]) => (
              <article key={name} className="border-t border-white/25 pt-3">
                <h3 className="text-xl">{name}</h3>
                <p className="mt-2 font-sans text-xs text-white/60">{detail}</p>
              </article>
            ))}
          </div>
        </section>
        <section>
          <MarketplaceRegisteredSection
            templateId="lowtide-house"
            section={lowtideGallery}
            variantId={lowtideGallery.variantId!}
            theme={LOWTIDE_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="shore"
          className="grid gap-8 bg-[#d4dfd8] px-7 py-10 text-[#172d34] sm:px-12 md:grid-cols-[1fr_1fr]"
        >
          <p className="text-3xl">The best plan is often no plan at all.</p>
          <p className="self-end font-sans text-sm leading-6">
            Walk the point. Read until the light changes. Come back for dinner
            when you are ready.
          </p>
        </section>
        <section id="house-story">
          <MarketplaceRegisteredSection
            templateId="lowtide-house"
            section={lowtideAbout}
            variantId={lowtideAbout.variantId!}
            theme={LOWTIDE_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="room-rates">
          <MarketplaceRegisteredSection templateId="lowtide-house" section={lowtidePricing} variantId={lowtidePricing.variantId!} theme={LOWTIDE_THEME} onIntent={onIntent} />
        </section>
        <section id="guest-notes">
          <MarketplaceRegisteredSection templateId="lowtide-house" section={lowtideTestimonials} variantId={lowtideTestimonials.variantId!} theme={LOWTIDE_THEME} onIntent={onIntent} />
        </section>
        <section id="hosts">
          <MarketplaceRegisteredSection templateId="lowtide-house" section={lowtideTeam} variantId={lowtideTeam.variantId!} theme={LOWTIDE_THEME} onIntent={onIntent} />
        </section>
        <section
          id="booking"
          className="grid gap-8 border-t border-white/20 px-7 py-10 sm:px-12 md:grid-cols-2"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d5aa78]">
              A room by the water
            </p>
            <h2 className="mt-3 text-4xl">Choose your dates.</h2>
          </div>
          <RegistryBoundForm
            binding={LOWTIDE_BINDINGS.stay}
            onIntent={onIntent}
            className="grid gap-3 font-sans"
          >
            <label className="grid gap-2 text-xs">
              Arrival
              <input
                required
                type="date"
                name="arrival"
                className="h-11 border border-white/30 bg-transparent px-3"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-white/30 bg-transparent px-3"
              />
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(LOWTIDE_BINDINGS.stay)}
              className="min-h-11 bg-[#d5aa78] px-4 text-sm text-[#172d34]"
            >
              Check stay availability
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between border-t border-white/20 px-7 py-6 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-12">
          <span>Lowtide House · North Coast</span>
          <span>Rest follows the water</span>
        </footer>
      </main>
    </div>
  );
}

function JuniperPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div
      className="min-h-full bg-[#f1eee8] text-[#202323]"
      style={{ fontFamily: "Lora, Georgia, serif" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <RegistryBoundLink
          binding={JUNIPER_BINDINGS.home}
          href="#top"
          onIntent={onIntent}
          className="text-sm font-semibold tracking-[0.18em]"
        >
          JUNIPER FRAME
        </RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink
          binding={JUNIPER_BINDINGS.inquiry}
          href="#contact"
          onIntent={onIntent}
          className="inline-flex items-center gap-2 bg-[#bf4c3a] px-3 py-2 font-sans text-xs text-white"
        >
          Ask about a session <ArrowUpRight className="h-3.5 w-3.5" />
        </RegistryBoundLink>
      </header>
      <main id="top">
        <section className="relative grid min-h-[520px] items-end overflow-hidden bg-[#252b2a] px-7 py-10 text-white sm:px-12">
          <img
            src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1500&q=82"
            alt="Photographer making portraits with a camera in natural light"
            className="absolute inset-0 h-full w-full object-cover opacity-65"
          />
          <div className="relative max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
              People / place / feeling
            </p>
            <h1 className="mt-4 text-5xl leading-[0.96] sm:text-7xl">
              Keep the feeling. Let the pose go.
            </h1>
            <p className="mt-4 max-w-md font-sans text-sm leading-6 text-white/75">
              Photographs for people who want to remember how it felt, not just
              how it looked.
            </p>
          </div>
        </section>
        <section id="work">
          <MarketplaceRegisteredSection
            templateId="juniper-frame"
            section={juniperGallery}
            variantId={juniperGallery.variantId!}
            theme={JUNIPER_THEME}
            onIntent={onIntent}
          />
        </section>
        <section
          id="approach"
          className="grid gap-8 bg-[#202323] px-7 py-10 text-[#f1eee8] sm:px-12 md:grid-cols-[1fr_1fr]"
        >
          <p className="text-3xl">
            A camera can be present without taking over.
          </p>
          <p className="self-end font-sans text-sm leading-6 text-white/65">
            We plan lightly, leave room for the day, and make portraits feel
            more like a conversation than a session.
          </p>
        </section>
        <section id="photographer-story">
          <MarketplaceRegisteredSection
            templateId="juniper-frame"
            section={juniperAbout}
            variantId={juniperAbout.variantId!}
            theme={JUNIPER_THEME}
            onIntent={onIntent}
          />
        </section>
        <section id="client-words">
          <MarketplaceRegisteredSection templateId="juniper-frame" section={juniperTestimonials} variantId={juniperTestimonials.variantId!} theme={JUNIPER_THEME} onIntent={onIntent} />
        </section>
        <section id="investment">
          <MarketplaceRegisteredSection templateId="juniper-frame" section={juniperPricing} variantId={juniperPricing.variantId!} theme={JUNIPER_THEME} onIntent={onIntent} />
        </section>
        <section id="practice-facts">
          <MarketplaceRegisteredSection templateId="juniper-frame" section={juniperStats} variantId={juniperStats.variantId!} theme={JUNIPER_THEME} onIntent={onIntent} />
        </section>
        <section
          id="contact"
          className="grid gap-8 px-7 py-12 sm:px-12 md:grid-cols-2"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#bf4c3a]">
              Tell us what you are planning
            </p>
            <h2 className="mt-3 text-4xl">We will take it from there.</h2>
          </div>
          <RegistryBoundForm
            binding={JUNIPER_BINDINGS.inquiry}
            onIntent={onIntent}
            className="grid gap-3 font-sans"
          >
            <label className="grid gap-2 text-xs">
              Email
              <input
                required
                type="email"
                name="email"
                className="h-11 border border-[#202323]/30 bg-transparent px-3"
              />
            </label>
            <label className="grid gap-2 text-xs">
              Session type
              <select
                name="session"
                defaultValue="Portrait"
                className="h-11 border border-[#202323]/30 bg-transparent px-3"
              >
                <option>Portrait</option>
                <option>Wedding</option>
                <option>Editorial</option>
              </select>
            </label>
            <button
              type="submit"
              {...marketplaceBindingAttributes(JUNIPER_BINDINGS.inquiry)}
              className="min-h-11 bg-[#bf4c3a] px-4 text-sm text-white"
            >
              Ask about a session
            </button>
          </RegistryBoundForm>
        </section>
        <footer className="flex justify-between border-t border-[#202323]/20 px-7 py-6 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-12">
          <span>Juniper Frame · Available for travel</span>
          <span>Keep the feeling</span>
        </footer>
      </main>
    </div>
  );
}

export const ADDITIONAL_MARKETPLACE_TEMPLATES: AuthoredMarketplaceTemplate[] = [
  {
    id: "aster-skin-studio",
    name: "Aster Skin Studio",
    category: "Beauty & Wellness",
    description:
      "An intimate skin practice with thoughtful treatments and a calm editorial voice.",
    artDirection: "Plum ink · rose clay · quiet luxury",
    coverImage:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1000&q=82",
    theme: ASTER_THEME,
    pages: [
      { id: "treatments", path: "/treatments", archetype: "services", label: "Treatments", title: "Care that meets you here", description: "Choose a ritual, learn about the practitioners, and prepare for a visit.", sections: [asterServices, asterGallery, asterFaq] },
      { id: "practitioners", path: "/practitioners", archetype: "custom", label: "Practitioners", title: "People who know skin", description: "Meet the studio practitioners and hear how clients describe their visits.", sections: [asterTeam, asterTestimonials] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#281a24] text-[#f8eef0]",
      border: "border-white/20",
      muted: "text-white/65",
      button: "bg-[#e1aebd] text-[#281a24]",
    },
    bindings: Object.values(ASTER_BINDINGS),
    preview: AsterPreview,
  },
  {
    id: "terra-house",
    name: "Terra House",
    category: "Real Estate",
    description:
      "A neighborhood-first property practice for people looking for a place to belong.",
    artDirection: "Garden green · clay · residential editorial",
    coverImage:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1000&q=82",
    theme: TERRA_THEME,
    pages: [
      { id: "properties", path: "/properties", archetype: "gallery", label: "Properties", title: "Homes with a sense of place", description: "Explore local listings and the neighborhood details around them.", sections: [terraGallery, terraStats, terraTestimonials] },
      { id: "buyer-guide", path: "/buyer-guide", archetype: "about", label: "Buyer guide", title: "Make a move with more confidence", description: "Learn how Terra House supports a considered search from the first conversation.", sections: [terraAbout, terraTeam, terraFaq] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#e7ece2] text-[#183b32]",
      border: "border-[#183b32]/20",
      muted: "text-[#51675d]",
      button: "bg-[#183b32] text-white",
    },
    bindings: Object.values(TERRA_BINDINGS),
    preview: TerraPreview,
  },
  {
    id: "pollen-objects",
    name: "Pollen Objects",
    category: "Retail & E-commerce",
    description:
      "A catalog-led shop for small-batch home goods, useful details, and maker stories.",
    artDirection: "Blue glass · pollen yellow · catalog editorial",
    coverImage:
      "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=1000&q=82",
    theme: POLLEN_THEME,
    pages: [
      { id: "shop", path: "/shop", archetype: "shop", label: "Shop", title: "Objects for everyday rituals", description: "Browse useful goods, product details, and a preview-only add-to-bag action.", sections: [pollenServices, pollenGallery, pollenTestimonials] },
      { id: "materials", path: "/materials", archetype: "custom", label: "Materials", title: "Small details, considered", description: "Learn how makers, materials, and care shape each collection.", sections: [pollenFeatures, pollenFaq] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#e5eff0] text-[#14334c]",
      border: "border-[#14334c]/20",
      muted: "text-[#536a78]",
      button: "bg-[#14334c] text-white",
    },
    bindings: Object.values(POLLEN_BINDINGS),
    preview: PollenPreview,
  },
  {
    id: "common-ground-fund",
    name: "Common Ground Fund",
    category: "Nonprofit",
    description:
      "A community fund sharing local projects, clear impact, and simple ways to take part.",
    artDirection: "Civic blue · harvest yellow · print poster",
    coverImage:
      "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=1000&q=82",
    theme: COMMON_THEME,
    pages: [
      { id: "impact", path: "/impact", archetype: "custom", label: "Impact", title: "A place to put down roots", description: "See how neighborhood gardens support food access, learning, and connection.", sections: [commonGallery, commonStats, commonTestimonials] },
      { id: "get-involved", path: "/get-involved", archetype: "custom", label: "Get involved", title: "There is room at the table", description: "Meet the community team and explore ways to take part.", sections: [commonTeam] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#f2efe5] text-[#182b49]",
      border: "border-[#182b49]/20",
      muted: "text-[#4f6078]",
      button: "bg-[#e6b845] text-[#182b49]",
    },
    bindings: Object.values(COMMON_BINDINGS),
    preview: CommonGroundPreview,
  },
  {
    id: "northline-works",
    name: "Northline Works",
    category: "Contractor & Trades",
    description:
      "A direct, project-forward trade business built around scope, site visits, and follow-through.",
    artDirection: "Safety yellow · slate blue · hard grid",
    coverImage:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1000&q=82",
    theme: NORTHLINE_THEME,
    pages: [
      { id: "projects", path: "/projects", archetype: "gallery", label: "Projects", title: "Built to work hard", description: "Browse case studies and see how Northline keeps projects accountable.", sections: [northlineGallery, northlineStats, northlineTestimonials] },
      { id: "services", path: "/services", archetype: "services", label: "Services", title: "Clear scope. Solid work.", description: "Understand the repair, renovation, and small-build work Northline takes on.", sections: [northlineServices, northlineFaq] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#1c2d3d] text-white",
      border: "border-[#f3c644]/50",
      muted: "text-white/70",
      button: "bg-[#f3c644] text-[#1c2d3d]",
    },
    bindings: Object.values(NORTHLINE_BINDINGS),
    preview: NorthlinePreview,
  },
  {
    id: "tempo-field-club",
    name: "Tempo Field Club",
    category: "Fitness & Movement",
    description:
      "A neighborhood training club with coaching for strength, conditioning, and recovery.",
    artDirection: "Ice blue · signal red · movement journal",
    coverImage:
      "https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=1000&q=82",
    theme: TEMPO_THEME,
    pages: [
      { id: "classes", path: "/classes", archetype: "services", label: "Classes", title: "Find your way into movement", description: "Browse coached strength, conditioning, and mobility sessions.", sections: [tempoServices, tempoTeam, tempoTestimonials] },
      { id: "memberships", path: "/memberships", archetype: "pricing", label: "Memberships", title: "Pick a rhythm that fits", description: "Compare drop-in and recurring training options.", sections: [tempoPricing, tempoTestimonials, tempoFaq] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#deedf0] text-[#19383d]",
      border: "border-[#19383d]/20",
      muted: "text-[#51666a]",
      button: "bg-[#c74943] text-white",
    },
    bindings: Object.values(TEMPO_BINDINGS),
    preview: TempoPreview,
  },
  {
    id: "openbook-academy",
    name: "Open Book Academy",
    category: "Education",
    description:
      "A modern learning community for short courses, live seminars, and independent study.",
    artDirection: "Terminal blue · copper light · mono index",
    coverImage:
      "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1000&q=82",
    theme: OPENBOOK_THEME,
    pages: [
      { id: "courses", path: "/courses", archetype: "pricing", label: "Courses", title: "Choose a path into the work", description: "Compare seminars, cohorts, and the people who teach them.", sections: [openbookPricing, openbookFaq] },
      { id: "reading", path: "/reading", archetype: "blog", label: "Reading", title: "The reading list", description: "Study notes and reflection prompts from the Open Book faculty.", sections: [openbookJournal, openbookStats] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#101f2d] text-[#eef1e9]",
      border: "border-[#94b6c5]/30",
      muted: "text-[#b8c7cc]",
      button: "bg-[#e7a65b] text-[#101f2d]",
    },
    bindings: Object.values(OPENBOOK_BINDINGS),
    preview: OpenbookPreview,
  },
  {
    id: "lowtide-house",
    name: "Lowtide House",
    category: "Boutique Lodging",
    description:
      "A small coastal stay organized around rooms, shoreline rituals, and unhurried time.",
    artDirection: "Tidal green · weathered brass · cinematic coast",
    coverImage:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000&q=82",
    theme: LOWTIDE_THEME,
    pages: [
      { id: "rooms", path: "/rooms", archetype: "custom", label: "Rooms", title: "Choose your room", description: "Explore the house, room types, and nightly rates.", sections: [lowtideGallery, lowtidePricing] },
      { id: "the-house", path: "/the-house", archetype: "about", label: "The house", title: "A small house, held by the coast", description: "Meet the hosts and hear what makes a Lowtide stay feel unhurried.", sections: [lowtideAbout, lowtideTestimonials, lowtideTeam] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#172d34] text-[#e5eee8]",
      border: "border-white/20",
      muted: "text-white/65",
      button: "bg-[#d5aa78] text-[#172d34]",
    },
    bindings: Object.values(LOWTIDE_BINDINGS),
    preview: LowtidePreview,
  },
  {
    id: "juniper-frame",
    name: "Juniper Frame",
    category: "Photography",
    description:
      "A photographer’s portfolio for people, places, and the small moments between.",
    artDirection: "Ink black · vermilion · full-bleed portraiture",
    coverImage:
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1000&q=82",
    theme: JUNIPER_THEME,
    pages: [
      { id: "work", path: "/work", archetype: "gallery", label: "Work", title: "Selected frames", description: "Browse the people, places, and stories Juniper Frame photographs.", sections: [juniperGallery, juniperTestimonials] },
      { id: "investment", path: "/investment", archetype: "pricing", label: "Investment", title: "Choose the coverage that fits", description: "Compare portrait and wedding coverage, then start a conversation.", sections: [juniperPricing, juniperAbout, juniperFaq] },
    ],
    intentPreviewTheme: {
      surface: "bg-[#202323] text-[#f1eee8]",
      border: "border-white/20",
      muted: "text-white/65",
      button: "bg-[#bf4c3a] text-white",
    },
    bindings: Object.values(JUNIPER_BINDINGS),
    preview: JuniperPreview,
  },
];
