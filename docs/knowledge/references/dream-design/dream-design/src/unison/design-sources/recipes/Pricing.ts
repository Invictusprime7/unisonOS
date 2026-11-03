/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/shared/editorialStyles.ts
var editorialCardStyle = (theme) => ({
  border: `1px solid ${hsl(theme.colors.border)}`,
  borderRadius: theme.radius,
  background: hsl(theme.colors.card),
  color: hsl(theme.colors.cardForeground)
});

// src/sections/variants/pricing/PricingSpotlight.tsx
import React3 from "react";

// src/sections/variants/shared/EditorialSection.tsx
import React from "react";
function EditorialSection({
  variantId,
  theme,
  headline,
  description,
  children
}) {
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      "data-ut-variant": variantId,
      className: "ut-editorial",
      style: {
        padding: theme.sectionPadding,
        background: hsl(theme.colors.background),
        color: hsl(theme.colors.foreground),
        fontFamily: theme.typography.bodyFont
      }
    },
    /* @__PURE__ */ React.createElement("style", null, `@keyframes ut-editorial-enter{from{transform:translateY(12px)}to{transform:translateY(0)}}
      @media(prefers-reduced-motion:no-preference){.ut-editorial [data-ut-reveal]{animation:ut-editorial-enter .5s ease-out both;animation-delay:var(--ut-reveal-delay,0ms)}}
      .ut-editorial :is(a,button,input,textarea,summary):focus-visible{outline:2px solid currentColor;outline-offset:4px}
      .ut-editorial summary::marker{color:inherit}`),
    /* @__PURE__ */ React.createElement("div", { className: "mx-auto min-w-0 px-5 sm:px-8", style: { maxWidth: theme.containerWidth } }, (headline || description) && /* @__PURE__ */ React.createElement("header", { className: "mb-10 max-w-3xl sm:mb-14" }, headline && /* @__PURE__ */ React.createElement(
      "h2",
      {
        "data-ut-slot": "headline",
        className: "text-3xl font-semibold tracking-tight sm:text-5xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight
        }
      },
      headline
    ), description && /* @__PURE__ */ React.createElement(
      "p",
      {
        "data-ut-slot": "description",
        className: "mt-5 max-w-2xl text-base leading-relaxed sm:text-lg",
        style: { color: hsl(theme.colors.mutedForeground) }
      },
      description
    )), children)
  );
}

// src/sections/variants/pricing/PricingFrame.tsx
import React2 from "react";
var normalizePricingTiers = (tiers, fallback) => {
  const source = Array.isArray(tiers) && tiers.length ? tiers : Array.isArray(fallback) ? fallback : [];
  return source.map((raw) => {
    const tier = raw || {};
    const name = String(tier.name ?? tier.title ?? "").trim();
    if (!name) return null;
    return {
      name,
      price: String(tier.price ?? ""),
      period: tier.period ? String(tier.period) : tier.duration ? String(tier.duration) : void 0,
      description: tier.description ? String(tier.description) : void 0,
      features: Array.isArray(tier.features) ? tier.features.map((f) => String(f)) : [],
      cta: tier.cta ? { label: String(tier.cta.label ?? tier.cta.text ?? "Get started"), href: tier.cta.href, intent: tier.cta.intent, variant: tier.cta.variant } : { label: "Get started", href: "#contact", variant: "primary" },
      highlighted: Boolean(tier.highlighted || tier.featured),
      badge: tier.badge ? String(tier.badge) : void 0
    };
  }).filter(Boolean);
};
var PricingCTA = ({ tier, theme }) => {
  const primary = Boolean(tier.highlighted || !tier.cta?.variant || tier.cta.variant === "primary");
  return /* @__PURE__ */ React2.createElement(
    "a",
    {
      href: tier.cta?.href || "#contact",
      "data-ut-intent": tier.cta?.intent || "lead.capture",
      className: "mt-6 inline-flex w-full items-center justify-center px-5 py-3 text-sm font-semibold no-underline",
      style: {
        borderRadius: theme.radius,
        fontFamily: theme.typography.bodyFont,
        background: primary ? hsl(theme.colors.primary) : "transparent",
        color: primary ? hsl(theme.colors.primaryForeground) : hsl(theme.colors.foreground),
        border: `1px solid ${primary ? hsl(theme.colors.primary) : hsl(theme.colors.border)}`
      }
    },
    tier.cta?.label || "Get started"
  );
};
var PricingFrame = ({ variantId, theme, headline, subheadline, children }) => /* @__PURE__ */ React2.createElement("section", { "data-ut-variant": variantId, style: { padding: theme.sectionPadding, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React2.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, (headline || subheadline) && /* @__PURE__ */ React2.createElement("div", { className: "mb-8 text-center md:mb-12" }, headline && /* @__PURE__ */ React2.createElement(
  "h2",
  {
    "data-ut-slot": "pricing.headline",
    className: "mb-3 text-2xl sm:text-3xl md:text-4xl",
    style: {
      fontFamily: theme.typography.headingFont,
      fontWeight: theme.typography.headingWeight,
      color: hsl(theme.colors.foreground)
    }
  },
  headline
), subheadline && /* @__PURE__ */ React2.createElement(
  "p",
  {
    "data-ut-slot": "pricing.subheadline",
    className: "mx-auto max-w-2xl text-base",
    style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
  },
  subheadline
)), children));

// src/sections/variants/pricing/PricingSpotlight.tsx
function PricingSpotlight({ section, theme }) {
  return /* @__PURE__ */ React3.createElement(
    EditorialSection,
    {
      variantId: "pricing:spotlight",
      theme,
      headline: section.props.headline,
      description: section.props.subheadline
    },
    /* @__PURE__ */ React3.createElement("div", { className: "grid gap-5 md:grid-cols-2" }, normalizePricingTiers(section.props.tiers).map((tier, index) => /* @__PURE__ */ React3.createElement(
      "article",
      {
        key: index,
        "data-ut-slot": `tier-${index}`,
        "data-ut-reveal": true,
        className: `flex min-w-0 flex-col p-7 sm:p-9 ${tier.highlighted ? "md:col-span-2 md:grid md:grid-cols-2 md:gap-10" : ""}`,
        style: {
          ...editorialCardStyle(theme),
          ...tier.highlighted ? { borderColor: hsl(theme.colors.primary), borderWidth: 2 } : {}
        }
      },
      /* @__PURE__ */ React3.createElement("div", null, tier.badge && /* @__PURE__ */ React3.createElement(
        "p",
        {
          "data-ut-slot": `pricing.badge`,
          className: "mb-4 text-xs font-semibold uppercase tracking-widest",
          style: { color: hsl(theme.colors.primary) }
        },
        tier.badge
      ), /* @__PURE__ */ React3.createElement("h3", { "data-ut-slot": `pricing.name`, className: "text-2xl", style: { fontFamily: theme.typography.headingFont } }, tier.name), /* @__PURE__ */ React3.createElement("p", { className: "mt-5" }, /* @__PURE__ */ React3.createElement("span", { "data-ut-slot": `pricing.price`, className: "text-5xl tracking-tight" }, tier.price), tier.period && /* @__PURE__ */ React3.createElement("span", { className: "ml-2 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, "/", tier.period)), tier.description && /* @__PURE__ */ React3.createElement(
        "p",
        {
          "data-ut-slot": `pricing.description`,
          className: "mt-4 text-sm leading-relaxed",
          style: { color: hsl(theme.colors.mutedForeground) }
        },
        tier.description
      )),
      /* @__PURE__ */ React3.createElement("div", { className: "flex flex-1 flex-col" }, /* @__PURE__ */ React3.createElement("ul", { className: "mt-6 flex-1 space-y-3 text-sm" }, tier.features.map((feature, i) => /* @__PURE__ */ React3.createElement("li", { key: i, className: "flex gap-3" }, /* @__PURE__ */ React3.createElement("span", { "aria-hidden": "true", style: { color: hsl(theme.colors.primary) } }, "\u2713"), feature))), /* @__PURE__ */ React3.createElement(PricingCTA, { tier, theme }))
    )))
  );
}

// src/sections/variants/pricing/PricingFeatureTable.tsx
import React4 from "react";
var Check = ({ color }) => /* @__PURE__ */ React4.createElement(
  "svg",
  {
    "aria-hidden": "true",
    viewBox: "0 0 20 20",
    className: "mt-0.5 h-4 w-4 shrink-0",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  },
  /* @__PURE__ */ React4.createElement("path", { d: "M4 10.5l4 4 8-9" })
);
var PricingFeatureTable = ({ section, theme }) => {
  const { headline, subheadline, tiers } = section.props;
  const plans = normalizePricingTiers(tiers);
  if (!plans.length) return null;
  return /* @__PURE__ */ React4.createElement(PricingFrame, { variantId: "pricing:feature-table", theme, headline, subheadline }, /* @__PURE__ */ React4.createElement(
    "div",
    {
      className: "grid gap-6",
      style: { gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))` }
    },
    plans.map((tier, i) => /* @__PURE__ */ React4.createElement(
      "div",
      {
        key: i,
        "data-ut-slot": `plan-${i + 1}`,
        className: "flex h-full flex-col p-8",
        style: {
          background: hsl(theme.colors.card),
          color: hsl(theme.colors.cardForeground),
          border: `1px solid ${tier.highlighted ? hsl(theme.colors.primary) : hsla(theme.colors.border, 0.7)}`,
          borderRadius: theme.radius,
          boxShadow: tier.highlighted ? `0 18px 40px -24px ${hsla(theme.colors.primary, 0.6)}` : "none"
        }
      },
      /* @__PURE__ */ React4.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React4.createElement(
        "h3",
        {
          "data-ut-slot": `pricing.name`,
          className: "text-lg",
          style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }
        },
        tier.name
      ), (tier.badge || tier.highlighted) && /* @__PURE__ */ React4.createElement(
        "span",
        {
          className: "rounded-full px-2.5 py-0.5 text-xs font-medium",
          style: { background: hsla(theme.colors.primary, 0.14), color: hsl(theme.colors.primary) }
        },
        tier.badge || "Most popular"
      )),
      /* @__PURE__ */ React4.createElement("div", { className: "mt-4 flex items-baseline gap-1" }, /* @__PURE__ */ React4.createElement(
        "span",
        {
          "data-ut-slot": `pricing.price`,
          className: "text-4xl",
          style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }
        },
        tier.price
      ), tier.period && /* @__PURE__ */ React4.createElement("span", { className: "text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, "/", tier.period)),
      tier.description && /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": `pricing.description`, className: "mt-3 text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, tier.description),
      /* @__PURE__ */ React4.createElement("ul", { className: "mt-6 flex flex-grow flex-col gap-3 p-0", style: { listStyle: "none" } }, tier.features.map((feature, f) => /* @__PURE__ */ React4.createElement("li", { key: f, className: "flex items-start gap-2 text-sm", style: { fontFamily: theme.typography.bodyFont } }, /* @__PURE__ */ React4.createElement(Check, { color: hsl(theme.colors.primary) }), /* @__PURE__ */ React4.createElement("span", { style: { color: hsl(theme.colors.mutedForeground) } }, feature)))),
      /* @__PURE__ */ React4.createElement(PricingCTA, { tier, theme })
    ))
  ));
};

// src/sections/variants/pricing/PricingBillingToggle.tsx
import React5 from "react";
var Check2 = ({ color }) => /* @__PURE__ */ React5.createElement(
  "svg",
  {
    "aria-hidden": "true",
    viewBox: "0 0 20 20",
    className: "mt-0.5 h-4 w-4 shrink-0",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  },
  /* @__PURE__ */ React5.createElement("path", { d: "M4 10.5l4 4 8-9" })
);
var splitPrice = (price) => {
  const match = /(-?\d[\d,.]*)/.exec(price || "");
  if (!match) return { prefix: price || "", amount: null, suffix: "" };
  const amount = Number(match[1].replace(/,/g, ""));
  return {
    prefix: price.slice(0, match.index),
    amount: Number.isFinite(amount) ? amount : null,
    suffix: price.slice(match.index + match[1].length)
  };
};
var yearlyAmount = (monthly) => Math.round(monthly * 10);
var RollingPrice = ({ value, yearly, color }) => /* @__PURE__ */ React5.createElement("span", { className: "relative inline-flex h-[1.1em] overflow-hidden align-baseline", style: { color } }, /* @__PURE__ */ React5.createElement(
  "span",
  {
    className: "flex flex-col transition-transform duration-500 ease-out motion-reduce:transition-none",
    style: { transform: yearly ? "translateY(-50%)" : "translateY(0)" }
  },
  /* @__PURE__ */ React5.createElement("span", { "data-ut-slot": "pricing.value", className: "leading-[1.1em]" }, value),
  /* @__PURE__ */ React5.createElement("span", { "aria-hidden": "true", className: "leading-[1.1em]" }, value)
));
var PlanCard = ({
  tier,
  index,
  theme,
  yearly
}) => {
  const { prefix, amount, suffix } = splitPrice(tier.price);
  const shown = amount === null ? tier.price : `${prefix}${yearly ? yearlyAmount(amount) : amount}${suffix}`;
  const period = amount === null ? tier.period : yearly ? "year" : tier.period || "month";
  return /* @__PURE__ */ React5.createElement(
    "div",
    {
      "data-ut-slot": `plan-${index + 1}`,
      className: "flex h-full flex-col p-8 transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none",
      style: {
        background: hsl(theme.colors.card),
        color: hsl(theme.colors.cardForeground),
        border: `1px solid ${tier.highlighted ? hsl(theme.colors.primary) : hsla(theme.colors.border, 0.7)}`,
        borderRadius: theme.radius,
        boxShadow: tier.highlighted ? `0 18px 40px -24px ${hsla(theme.colors.primary, 0.6)}` : "none"
      }
    },
    /* @__PURE__ */ React5.createElement("div", { className: "flex items-center justify-between gap-3" }, /* @__PURE__ */ React5.createElement(
      "h3",
      {
        "data-ut-slot": `pricing.name`,
        className: "text-2xl",
        style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }
      },
      tier.name
    ), (tier.badge || tier.highlighted) && /* @__PURE__ */ React5.createElement(
      "span",
      {
        className: "rounded-full px-3 py-1 text-xs font-medium",
        style: { background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) }
      },
      tier.badge || "Popular"
    )),
    tier.description && /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": `pricing.description`, className: "mt-3 text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, tier.description),
    /* @__PURE__ */ React5.createElement("div", { className: "mt-5 flex items-baseline gap-1" }, /* @__PURE__ */ React5.createElement(
      "span",
      {
        className: "text-4xl",
        style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }
      },
      /* @__PURE__ */ React5.createElement(RollingPrice, { value: shown, yearly, color: hsl(theme.colors.cardForeground) })
    ), period && /* @__PURE__ */ React5.createElement("span", { className: "text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, "/", period)),
    /* @__PURE__ */ React5.createElement(PricingCTA, { tier, theme }),
    /* @__PURE__ */ React5.createElement("ul", { className: "mt-6 flex flex-grow flex-col gap-3 p-0", style: { listStyle: "none" } }, tier.features.map((feature, f) => /* @__PURE__ */ React5.createElement("li", { key: f, className: "flex items-start gap-2 text-sm", style: { fontFamily: theme.typography.bodyFont } }, /* @__PURE__ */ React5.createElement(Check2, { color: hsl(theme.colors.primary) }), /* @__PURE__ */ React5.createElement("span", { style: { color: hsl(theme.colors.mutedForeground) } }, feature))))
  );
};
var PricingBillingToggle = ({ section, theme }) => {
  const { headline, subheadline, tiers } = section.props;
  const plans = normalizePricingTiers(tiers);
  const [yearly, setYearly] = React5.useState(false);
  if (!plans.length) return null;
  const pill = (active) => ({
    background: active ? hsl(theme.colors.primary) : "transparent",
    color: active ? hsl(theme.colors.primaryForeground) : hsl(theme.colors.mutedForeground),
    borderRadius: "9999px"
  });
  return /* @__PURE__ */ React5.createElement(PricingFrame, { variantId: "pricing:billing-toggle", theme, headline, subheadline }, /* @__PURE__ */ React5.createElement("div", { className: "mb-10 flex justify-center" }, /* @__PURE__ */ React5.createElement(
    "div",
    {
      role: "group",
      "aria-label": "Billing period",
      className: "inline-flex gap-1 p-1",
      style: { background: hsl(theme.colors.card), border: `1px solid ${hsla(theme.colors.border, 0.7)}`, borderRadius: "9999px" }
    },
    /* @__PURE__ */ React5.createElement(
      "button",
      {
        "data-ut-intent": "ui.toggle",
        type: "button",
        "aria-pressed": !yearly,
        onClick: () => setYearly(false),
        className: "px-6 py-2 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none",
        style: pill(!yearly)
      },
      "Monthly"
    ),
    /* @__PURE__ */ React5.createElement(
      "button",
      {
        "data-ut-intent": "ui.toggle",
        type: "button",
        "aria-pressed": yearly,
        onClick: () => setYearly(true),
        className: "flex items-center gap-2 px-6 py-2 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none",
        style: pill(yearly)
      },
      "Yearly",
      /* @__PURE__ */ React5.createElement(
        "span",
        {
          className: "rounded-full px-2 py-0.5 text-xs",
          style: { background: hsla(theme.colors.primary, 0.16), color: hsl(theme.colors.primary) }
        },
        "Save 20%"
      )
    )
  )), /* @__PURE__ */ React5.createElement(
    "div",
    {
      className: "grid gap-6",
      style: { gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))` }
    },
    plans.map((tier, i) => /* @__PURE__ */ React5.createElement(PlanCard, { key: i, tier, index: i, theme, yearly }))
  ));
};

// src/sections/variants/pricing/PricingComparisonTable.tsx
import React6 from "react";
var PricingComparisonTable = ({ section, theme }) => {
  const tiers = normalizePricingTiers(section.props.tiers);
  const feats = [...new Set(tiers.flatMap((t) => t.features))];
  const line = `1px solid ${hsl(theme.colors.border)}`;
  return /* @__PURE__ */ React6.createElement(PricingFrame, { variantId: "pricing:comparison-table", theme, headline: section.props.headline, subheadline: section.props.subheadline }, /* @__PURE__ */ React6.createElement("div", { className: "overflow-x-auto" }, /* @__PURE__ */ React6.createElement("table", { className: "w-full min-w-[36rem] border-collapse text-left text-sm", style: { color: hsl(theme.colors.foreground) } }, /* @__PURE__ */ React6.createElement("caption", { className: "sr-only" }, "Plan comparison"), /* @__PURE__ */ React6.createElement("thead", null, /* @__PURE__ */ React6.createElement("tr", null, /* @__PURE__ */ React6.createElement("th", { scope: "col", className: "p-4", style: { borderBottom: line } }, /* @__PURE__ */ React6.createElement("span", { className: "sr-only" }, "Feature")), tiers.map((t, i) => /* @__PURE__ */ React6.createElement("th", { key: i, scope: "col", className: "p-4 align-bottom", style: { borderBottom: line, background: t.highlighted ? hsl(theme.colors.background) : void 0 } }, /* @__PURE__ */ React6.createElement("span", { "data-ut-slot": `tier-${i}.name`, className: "block text-base" }, t.name), /* @__PURE__ */ React6.createElement("span", { "data-ut-slot": `tier-${i}.price`, className: "mt-1 block text-2xl md:text-3xl", style: { fontFamily: theme.typography.headingFont } }, t.price, /* @__PURE__ */ React6.createElement("small", { className: "text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, t.period)))))), /* @__PURE__ */ React6.createElement("tbody", null, feats.map((f, r) => /* @__PURE__ */ React6.createElement("tr", { key: r }, /* @__PURE__ */ React6.createElement("th", { scope: "row", className: "p-4 font-normal", style: { borderBottom: line } }, f), tiers.map((t, i) => /* @__PURE__ */ React6.createElement("td", { key: i, className: "p-4", style: { borderBottom: line, background: t.highlighted ? hsl(theme.colors.background) : void 0 } }, t.features.includes(f) ? /* @__PURE__ */ React6.createElement("span", { "aria-label": "Included" }, "\u2713") : /* @__PURE__ */ React6.createElement("span", { "aria-label": "Not included", style: { color: hsl(theme.colors.mutedForeground) } }, "\u2014"))))), /* @__PURE__ */ React6.createElement("tr", null, /* @__PURE__ */ React6.createElement("td", null), /* @__PURE__ */ React6.createElement(React6.Fragment, null, tiers.map((t, i) => /* @__PURE__ */ React6.createElement("td", { key: i, className: "p-4" }, /* @__PURE__ */ React6.createElement(PricingCTA, { tier: t, theme })))))))));
};

// src/sections/variants/pricing/PricingCreative.tsx
import React7 from "react";
var PricingCreative = ({ section, theme }) => {
  const tiers = normalizePricingTiers(section.props.tiers);
  return /* @__PURE__ */ React7.createElement(PricingFrame, { variantId: "pricing:creative", theme, headline: section.props.headline, subheadline: section.props.subheadline }, /* @__PURE__ */ React7.createElement("div", { className: "grid gap-6 md:grid-cols-3" }, tiers.map((t, i) => /* @__PURE__ */ React7.createElement("article", { key: i, className: "relative flex flex-col p-7 motion-safe:transition-transform motion-safe:hover:-translate-y-1", style: { background: hsl(t.highlighted ? theme.colors.foreground : theme.colors.background), color: hsl(t.highlighted ? theme.colors.background : theme.colors.foreground), border: `2px solid ${hsl(theme.colors.foreground)}`, boxShadow: `6px 6px 0 ${hsl(theme.colors.foreground)}`, transform: `rotate(${(i - 1) * 0.8}deg)` } }, t.badge && /* @__PURE__ */ React7.createElement("span", { "data-ut-slot": `tier-${i}.badge`, className: "absolute -top-3 left-6 px-2 text-xs uppercase", style: { background: hsl(theme.colors.accent), color: hsl(theme.colors.accentForeground) } }, t.badge), /* @__PURE__ */ React7.createElement("h3", { "data-ut-slot": `tier-${i}.name`, className: "text-xl", style: { fontFamily: theme.typography.headingFont } }, t.name), /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": `tier-${i}.price`, className: "mt-4 text-5xl", style: { fontFamily: theme.typography.headingFont } }, t.price, /* @__PURE__ */ React7.createElement("small", { className: "text-base opacity-70" }, t.period)), /* @__PURE__ */ React7.createElement("ul", { className: "mt-6 flex-1 space-y-2 text-sm" }, t.features.map((f, k) => /* @__PURE__ */ React7.createElement("li", { key: k }, "\u2192 ", f))), /* @__PURE__ */ React7.createElement(PricingCTA, { tier: t, theme })))));
};

// src/sections/variants/pricing/PricingTiers.tsx
import React8 from "react";
var PricingTiers = ({ section, theme }) => {
  const tiers = normalizePricingTiers(section.props.tiers, section.props.items);
  const cols = tiers.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : tiers.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return /* @__PURE__ */ React8.createElement(
    PricingFrame,
    {
      variantId: "pricing:tiers",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React8.createElement("div", { className: `grid items-start gap-6 ${cols}` }, tiers.map((tier, i) => /* @__PURE__ */ React8.createElement(
      "article",
      {
        key: i,
        className: "flex h-full flex-col p-8",
        style: {
          background: hsl(theme.colors.card),
          color: hsl(theme.colors.cardForeground),
          borderRadius: theme.radius,
          border: `1px solid ${tier.highlighted ? hsl(theme.colors.primary) : hsl(theme.colors.border)}`,
          boxShadow: tier.highlighted ? `0 24px 60px -32px ${hsla(theme.colors.foreground, 0.45)}` : void 0
        }
      },
      tier.badge && /* @__PURE__ */ React8.createElement(
        "span",
        {
          "data-ut-slot": `pricing.badge`,
          className: "mb-3 inline-flex w-fit px-2 py-1 text-xs font-semibold",
          style: { borderRadius: theme.radius, background: hsl(theme.colors.accent), color: hsl(theme.colors.accentForeground) }
        },
        tier.badge
      ),
      /* @__PURE__ */ React8.createElement("h3", { "data-ut-slot": `pricing.name`, className: "text-lg font-semibold", style: { fontFamily: theme.typography.headingFont } }, tier.name),
      /* @__PURE__ */ React8.createElement("p", { "data-ut-slot": `pricing.price`, className: "mt-2 text-3xl font-semibold", style: { fontFamily: theme.typography.headingFont } }, tier.price, tier.period && /* @__PURE__ */ React8.createElement("span", { className: "text-sm font-normal", style: { color: hsl(theme.colors.mutedForeground) } }, " /", tier.period)),
      tier.description && /* @__PURE__ */ React8.createElement("p", { "data-ut-slot": `pricing.description`, className: "mt-2 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, tier.description),
      /* @__PURE__ */ React8.createElement("ul", { className: "mt-6 flex-1 list-none space-y-2 p-0 text-sm" }, tier.features.map((feature, fi) => /* @__PURE__ */ React8.createElement("li", { key: fi, className: "flex gap-2" }, /* @__PURE__ */ React8.createElement("span", { "aria-hidden": "true", style: { color: hsl(theme.colors.primary) } }, "\u2713"), /* @__PURE__ */ React8.createElement("span", null, feature)))),
      /* @__PURE__ */ React8.createElement(PricingCTA, { tier, theme })
    )))
  );
};

// src/sections/variants/pricing/PricingComparison.tsx
import React9 from "react";
var PricingComparison = ({ section, theme }) => {
  const tiers = normalizePricingTiers(section.props.tiers, section.props.items);
  const rows = Array.from(new Set(tiers.flatMap((tier) => tier.features)));
  return /* @__PURE__ */ React9.createElement(
    PricingFrame,
    {
      variantId: "pricing:comparison",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React9.createElement("div", { className: "overflow-x-auto", style: { borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}`, background: hsl(theme.colors.card) } }, /* @__PURE__ */ React9.createElement("table", { className: "w-full border-collapse text-left text-sm", style: { color: hsl(theme.colors.cardForeground) } }, /* @__PURE__ */ React9.createElement("caption", { className: "sr-only" }, "Plan comparison"), /* @__PURE__ */ React9.createElement("thead", null, /* @__PURE__ */ React9.createElement("tr", null, /* @__PURE__ */ React9.createElement("th", { scope: "col", className: "p-4", style: { fontFamily: theme.typography.headingFont } }, "Features"), tiers.map((tier, i) => /* @__PURE__ */ React9.createElement("th", { key: i, scope: "col", className: "p-4", style: { fontFamily: theme.typography.headingFont } }, /* @__PURE__ */ React9.createElement("span", { "data-ut-slot": `pricing.name`, className: "block" }, tier.name), /* @__PURE__ */ React9.createElement("span", { "data-ut-slot": `pricing.price`, className: "block text-base font-semibold" }, tier.price, tier.period ? `/${tier.period}` : ""))))), /* @__PURE__ */ React9.createElement("tbody", null, rows.map((feature, ri) => /* @__PURE__ */ React9.createElement("tr", { key: ri, style: { borderTop: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React9.createElement("th", { scope: "row", className: "p-4 font-normal" }, feature), tiers.map((tier, ti) => /* @__PURE__ */ React9.createElement("td", { key: ti, className: "p-4" }, /* @__PURE__ */ React9.createElement("span", { "aria-label": tier.features.includes(feature) ? "Included" : "Not included", style: { color: tier.features.includes(feature) ? hsl(theme.colors.primary) : hsl(theme.colors.mutedForeground) } }, tier.features.includes(feature) ? "\u2713" : "\u2014"))))), /* @__PURE__ */ React9.createElement("tr", { style: { borderTop: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React9.createElement("td", { className: "p-4" }), tiers.map((tier, i) => /* @__PURE__ */ React9.createElement("td", { key: i, className: "p-4 align-top" }, /* @__PURE__ */ React9.createElement(PricingCTA, { tier, theme })))))))
  );
};

// src/sections/variants/pricing/PricingAccordion.tsx
import React10, { useState } from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Save = __LucideIcons['Save'] || __LucideFallback;
var PricingAccordion = ({ section, theme }) => {
  const tiers = normalizePricingTiers(section.props.tiers, section.props.items);
  const defaultOpen = Math.max(0, tiers.findIndex((tier) => tier.highlighted));
  const [open, setOpen] = useState(defaultOpen);
  return /* @__PURE__ */ React10.createElement(
    PricingFrame,
    {
      variantId: "pricing:accordion",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React10.createElement("div", { className: "mx-auto max-w-3xl" }, tiers.map((tier, i) => {
      const expanded = open === i;
      return /* @__PURE__ */ React10.createElement(
        "div",
        {
          key: i,
          className: "mb-3",
          style: {
            background: hsl(theme.colors.card),
            color: hsl(theme.colors.cardForeground),
            borderRadius: theme.radius,
            border: `1px solid ${expanded ? hsl(theme.colors.primary) : hsl(theme.colors.border)}`
          }
        },
        /* @__PURE__ */ React10.createElement("h3", { className: "m-0" }, /* @__PURE__ */ React10.createElement(
          "button",
          {
            "data-ut-intent": "ui.toggle",
            type: "button",
            "aria-expanded": expanded,
            onClick: () => setOpen(expanded ? -1 : i),
            className: "flex w-full items-center justify-between gap-4 bg-transparent p-5 text-left",
            style: { fontFamily: theme.typography.headingFont, color: "inherit" }
          },
          /* @__PURE__ */ React10.createElement("span", { className: "flex items-center gap-3" }, /* @__PURE__ */ React10.createElement("span", { "data-ut-slot": `pricing.name`, className: "text-base font-semibold" }, tier.name), tier.badge && /* @__PURE__ */ React10.createElement("span", { "data-ut-slot": `pricing.badge`, className: "px-2 py-0.5 text-xs", style: { borderRadius: theme.radius, background: hsl(theme.colors.accent), color: hsl(theme.colors.accentForeground) } }, tier.badge)),
          /* @__PURE__ */ React10.createElement("span", { "data-ut-slot": `pricing.price`, className: "text-base font-semibold" }, tier.price, tier.period && /* @__PURE__ */ React10.createElement("span", { className: "text-xs font-normal", style: { color: hsl(theme.colors.mutedForeground) } }, " /", tier.period))
        )),
        expanded && /* @__PURE__ */ React10.createElement("div", { className: "px-5 pb-5" }, tier.description && /* @__PURE__ */ React10.createElement("p", { "data-ut-slot": `pricing.description`, className: "mb-3 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, tier.description), /* @__PURE__ */ React10.createElement("ul", { className: "list-none space-y-2 p-0 text-sm" }, tier.features.map((feature, fi) => /* @__PURE__ */ React10.createElement("li", { key: fi, className: "flex gap-2" }, /* @__PURE__ */ React10.createElement("span", { "aria-hidden": "true", style: { color: hsl(theme.colors.primary) } }, "\u2713"), /* @__PURE__ */ React10.createElement("span", null, feature)))), /* @__PURE__ */ React10.createElement(PricingCTA, { tier, theme }))
      );
    }))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "pricing:spotlight": PricingSpotlight, "pricing:feature-table": PricingFeatureTable, "pricing:billing-toggle": PricingBillingToggle, "pricing:comparison-table": PricingComparisonTable, "pricing:creative": PricingCreative, "pricing:tiers": PricingTiers, "pricing:comparison": PricingComparison, "pricing:accordion": PricingAccordion };
export {
  REGISTERED_VARIANTS
};
