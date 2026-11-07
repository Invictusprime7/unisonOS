/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/stats/StatsProofGrid.tsx
import React2 from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

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

// src/sections/variants/stats/StatsProofGrid.tsx
function StatsProofGrid({ section, theme }) {
  return /* @__PURE__ */ React2.createElement(EditorialSection, { variantId: "stats:proof-grid", theme, headline: section.props.headline }, /* @__PURE__ */ React2.createElement("dl", { className: "grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-4" }, section.props.items.map((item, index) => /* @__PURE__ */ React2.createElement(
    "div",
    {
      key: index,
      "data-ut-slot": `metric-${index}`,
      "data-ut-reveal": true,
      className: "flex min-w-0 flex-col-reverse gap-4 border-t py-8",
      style: {
        borderColor: hsl(theme.colors.border),
        "--ut-reveal-delay": `${Math.min(index, 5) * 70}ms`
      }
    },
    /* @__PURE__ */ React2.createElement("dt", { "data-ut-slot": `stats.label`, className: "text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.label),
    /* @__PURE__ */ React2.createElement(
      "dd",
      {
        "data-ut-slot": `stats.value`,
        className: "break-words text-5xl tracking-tight tabular-nums",
        style: { fontFamily: theme.typography.headingFont }
      },
      item.value
    )
  ))));
}

// src/sections/variants/stats/StatsMetricCards.tsx
import React4 from "react";

// src/sections/variants/stats/StatsFrame.tsx
import React3 from "react";
var normalizeStats = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw || {};
    const value = String(item.value ?? item.number ?? "").trim();
    const label = String(item.label ?? item.title ?? "").trim();
    if (!value && !label) return null;
    return { value, label, icon: item.icon ? String(item.icon) : void 0 };
  }).filter(Boolean);
};
var StatValue = ({
  theme,
  value,
  emphasis
}) => /* @__PURE__ */ React3.createElement(
  "span",
  {
    "data-ut-slot": "stats.value",
    className: emphasis ? "block text-5xl" : "block text-4xl",
    style: {
      fontFamily: theme.typography.headingFont,
      fontWeight: theme.typography.headingWeight,
      color: hsl(theme.colors.primary)
    }
  },
  value
);
var StatsFrame = ({ variantId, theme, headline, surface = "background", children }) => /* @__PURE__ */ React3.createElement(
  "section",
  {
    "data-ut-variant": variantId,
    style: {
      padding: theme.sectionPadding,
      background: hsl(
        surface === "muted" ? theme.colors.muted : surface === "primary" ? theme.colors.secondary : theme.colors.background
      )
    }
  },
  /* @__PURE__ */ React3.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React3.createElement(
    "h2",
    {
      "data-ut-slot": "stats.headline",
      className: "mb-10 text-center text-3xl",
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground)
      }
    },
    headline
  ), children)
);

// src/sections/variants/stats/StatsMetricCards.tsx
var StatsMetricCards = ({ section, theme }) => {
  const { headline, items } = section.props;
  const stats = normalizeStats(items);
  if (!stats.length) return null;
  return /* @__PURE__ */ React4.createElement(StatsFrame, { variantId: "stats:metric-cards", theme, headline, surface: "background" }, /* @__PURE__ */ React4.createElement(
    "div",
    {
      className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
    },
    stats.map((stat, i) => /* @__PURE__ */ React4.createElement(
      "div",
      {
        key: i,
        "data-ut-slot": `stat-${i + 1}`,
        className: "relative overflow-hidden p-7 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none",
        style: {
          background: hsl(theme.colors.card),
          border: `1px solid ${hsla(theme.colors.border, 0.7)}`,
          borderRadius: theme.radius
        }
      },
      /* @__PURE__ */ React4.createElement(
        "span",
        {
          "aria-hidden": "true",
          className: "absolute left-0 top-0 h-full w-1",
          style: { background: hsla(theme.colors.primary, 0.75) }
        }
      ),
      stat.icon && /* @__PURE__ */ React4.createElement("span", { className: "mb-3 block text-xl", "aria-hidden": "true" }, stat.icon),
      /* @__PURE__ */ React4.createElement(StatValue, { theme, value: stat.value }),
      /* @__PURE__ */ React4.createElement(
        "span",
        {
          "data-ut-slot": `stats.label`,
          className: "mt-2 block text-sm",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        stat.label
      )
    ))
  ));
};

// src/sections/variants/stats/StatsBold.tsx
import React5 from "react";
var StatsBold = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React5.createElement("section", { "data-ut-variant": "stats:bold", style: { padding: theme.sectionPadding, background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) } }, /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, p.headline && /* @__PURE__ */ React5.createElement("h2", { "data-ut-slot": "stats.headline", className: "mb-10 text-sm uppercase tracking-[0.2em] opacity-80", style: { fontFamily: theme.typography.bodyFont } }, p.headline), /* @__PURE__ */ React5.createElement("dl", { className: "grid gap-10 sm:grid-cols-2 lg:grid-cols-3" }, (p.items || []).map((s, i) => /* @__PURE__ */ React5.createElement("div", { key: i, className: "border-t pt-4", style: { borderColor: hsl(theme.colors.primaryForeground) } }, /* @__PURE__ */ React5.createElement("dt", { "data-ut-slot": `stat-${i}.label`, className: "order-2 text-sm opacity-80" }, s.label), /* @__PURE__ */ React5.createElement("dd", { "data-ut-slot": `stat-${i}.value`, className: "text-6xl leading-none md:text-8xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight } }, s.value))))));
};

// src/sections/variants/stats/StatsRow.tsx
import React6 from "react";
var StatsRow = ({ section, theme }) => {
  const items = normalizeStats(section.props.items);
  return /* @__PURE__ */ React6.createElement(StatsFrame, { variantId: "stats:row", theme, headline: section.props.headline }, /* @__PURE__ */ React6.createElement("div", { className: "grid gap-8 sm:grid-cols-2 md:grid-cols-4" }, items.map((item, i) => /* @__PURE__ */ React6.createElement(
    "div",
    {
      key: i,
      className: "px-4 text-center",
      style: { borderLeft: i === 0 ? "none" : `1px solid ${hsl(theme.colors.border)}` }
    },
    /* @__PURE__ */ React6.createElement(StatValue, { theme, value: item.value }),
    /* @__PURE__ */ React6.createElement(
      "span",
      {
        "data-ut-slot": `stats.label`,
        className: "mt-2 block text-sm",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      item.label
    )
  ))));
};

// src/sections/variants/stats/StatsBandedGrid.tsx
import React7 from "react";
var StatsBandedGrid = ({ section, theme }) => {
  const items = normalizeStats(section.props.items);
  const cols = items.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  return /* @__PURE__ */ React7.createElement(StatsFrame, { variantId: "stats:banded-grid", theme, headline: section.props.headline, surface: "muted" }, /* @__PURE__ */ React7.createElement("div", { className: `grid gap-6 sm:grid-cols-2 ${cols}` }, items.map((item, i) => /* @__PURE__ */ React7.createElement(
    "div",
    {
      key: i,
      className: "p-8 text-center",
      style: {
        background: hsl(theme.colors.card),
        color: hsl(theme.colors.cardForeground),
        border: `1px solid ${hsl(theme.colors.border)}`,
        borderRadius: theme.radius
      }
    },
    /* @__PURE__ */ React7.createElement(StatValue, { theme, value: item.value }),
    /* @__PURE__ */ React7.createElement("span", { "data-ut-slot": `stats.label`, className: "mt-2 block text-sm", style: { fontFamily: theme.typography.bodyFont } }, item.label)
  ))));
};

// src/sections/variants/stats/StatsHighlight.tsx
import React8 from "react";
var StatsHighlight = ({ section, theme }) => {
  const items = normalizeStats(section.props.items);
  const [lead, ...rest] = items;
  return /* @__PURE__ */ React8.createElement(StatsFrame, { variantId: "stats:highlight", theme, headline: section.props.headline }, /* @__PURE__ */ React8.createElement("div", { className: "grid items-center gap-10 md:grid-cols-2" }, lead && /* @__PURE__ */ React8.createElement(
    "div",
    {
      className: "p-10",
      style: {
        background: hsl(theme.colors.card),
        color: hsl(theme.colors.cardForeground),
        border: `1px solid ${hsl(theme.colors.border)}`,
        borderRadius: theme.radius
      }
    },
    /* @__PURE__ */ React8.createElement(StatValue, { theme, value: lead.value, emphasis: true }),
    /* @__PURE__ */ React8.createElement("span", { "data-ut-slot": `stats.label`, className: "mt-3 block text-base", style: { fontFamily: theme.typography.bodyFont } }, lead.label)
  ), /* @__PURE__ */ React8.createElement("div", { className: "grid gap-6 sm:grid-cols-2" }, rest.map((item, i) => /* @__PURE__ */ React8.createElement("div", { key: i, style: { borderTop: `1px solid ${hsl(theme.colors.border)}`, paddingTop: "1rem" } }, /* @__PURE__ */ React8.createElement(StatValue, { theme, value: item.value }), /* @__PURE__ */ React8.createElement(
    "span",
    {
      "data-ut-slot": `stats.label`,
      className: "mt-1 block text-sm",
      style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
    },
    item.label
  ))))));
};

// <stdin>
var REGISTERED_VARIANTS = { "stats:proof-grid": StatsProofGrid, "stats:metric-cards": StatsMetricCards, "stats:bold": StatsBold, "stats:row": StatsRow, "stats:banded-grid": StatsBandedGrid, "stats:highlight": StatsHighlight };
export {
  REGISTERED_VARIANTS
};
