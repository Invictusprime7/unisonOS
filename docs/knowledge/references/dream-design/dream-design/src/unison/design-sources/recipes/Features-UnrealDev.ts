/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/features/FeaturesSpotlightCards.tsx
import React2, { useRef } from "react";

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

// src/sections/variants/features/FeaturesSpotlightCards.tsx
function FeaturesSpotlightCards({ section, theme }) {
  const root = useRef(null);
  return /* @__PURE__ */ React2.createElement(EditorialSection, { variantId: "features:spotlight-cards", theme, headline: section.props.headline, description: section.props.subheadline }, /* @__PURE__ */ React2.createElement("style", null, `.ut-spotlight-card{position:relative;overflow:hidden}.ut-spotlight-card::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(350px circle at var(--spot-x,50%) var(--spot-y,50%),var(--spot-color),transparent 80%)}.ut-spotlight-card:hover::before,.ut-spotlight-card:focus-within::before{opacity:1}@media(prefers-reduced-motion:reduce){.ut-spotlight-card::before{display:none}}`), /* @__PURE__ */ React2.createElement("div", { ref: root, className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", onPointerMove: (event) => {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = event.target.closest("[data-spotlight-card]");
    if (!card || !root.current?.contains(card)) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", event.clientX - rect.left + "px");
    card.style.setProperty("--spot-y", event.clientY - rect.top + "px");
  } }, (section.props.items ?? []).map((item, index) => /* @__PURE__ */ React2.createElement("article", { key: index, "data-spotlight-card": true, "data-ut-slot": "feature-" + index, className: "ut-spotlight-card min-w-0 border p-7 sm:p-9", style: { "--spot-color": hsla(theme.colors.primary, 0.16), borderColor: hsl(theme.colors.border), background: hsl(theme.colors.card), borderRadius: theme.radius, overflowWrap: "anywhere" } }, /* @__PURE__ */ React2.createElement("div", { className: "relative" }, /* @__PURE__ */ React2.createElement("span", { "aria-hidden": "true", className: "mb-6 block text-3xl" }, item.icon), /* @__PURE__ */ React2.createElement("h3", { "data-ut-slot": `features.title`, className: "text-xl font-semibold", style: { fontFamily: theme.typography.headingFont } }, item.title), /* @__PURE__ */ React2.createElement("p", { "data-ut-slot": `features.description`, className: "mt-3 text-sm leading-7", style: { color: hsl(theme.colors.mutedForeground) } }, item.description))))));
}

// src/sections/variants/features/FeaturesIntegrations.tsx
import React3 from "react";
var FeaturesIntegrations = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React3.createElement("section", { "data-ut-variant": "features:integrations", style: { padding: theme.sectionPadding, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React3.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React3.createElement("div", { className: "grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-center" }, /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("div", { className: "mb-10 md:mb-14" }, p.headline && /* @__PURE__ */ React3.createElement("h2", { "data-ut-slot": "features.headline", className: "text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.subheadline && /* @__PURE__ */ React3.createElement("p", { "data-ut-slot": "features.subheadline", className: "mt-3 max-w-2xl", style: { color: hsl(theme.colors.mutedForeground) } }, p.subheadline))), /* @__PURE__ */ React3.createElement("ul", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3" }, (p.items || []).map((f, i) => /* @__PURE__ */ React3.createElement("li", { key: i, className: "flex flex-col gap-2 p-5", style: { borderRadius: theme.radius, background: hsl(theme.colors.card), border: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React3.createElement("span", { "aria-hidden": "true", className: "flex h-10 w-10 items-center justify-center text-sm font-semibold", style: { borderRadius: theme.radius, background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) } }, f.title.slice(0, 2).toUpperCase()), /* @__PURE__ */ React3.createElement("h3", { "data-ut-slot": `feature-${i}.title`, className: "text-sm font-semibold", style: { color: hsl(theme.colors.cardForeground) } }, f.title), /* @__PURE__ */ React3.createElement("p", { "data-ut-slot": `feature-${i}.description`, className: "text-xs", style: { color: hsl(theme.colors.mutedForeground) } }, f.description)))))));
};

// src/sections/variants/features/FeaturesBentoMosaic.tsx
import React4 from "react";
var span = ["md:col-span-2 md:row-span-2", "md:col-span-1", "md:col-span-1", "md:col-span-2"];
var FeaturesBentoMosaic = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React4.createElement("section", { "data-ut-variant": "features:bento-mosaic", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React4.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React4.createElement("div", { className: "mb-10 md:mb-14" }, p.headline && /* @__PURE__ */ React4.createElement("h2", { "data-ut-slot": "features.headline", className: "text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.subheadline && /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": "features.subheadline", className: "mt-3 max-w-2xl", style: { color: hsl(theme.colors.mutedForeground) } }, p.subheadline)), /* @__PURE__ */ React4.createElement("div", { className: "grid auto-rows-[minmax(10rem,auto)] gap-4 md:grid-cols-4" }, (p.items || []).slice(0, 6).map((f, i) => /* @__PURE__ */ React4.createElement("article", { key: i, className: `relative flex flex-col justify-end overflow-hidden p-6 ${span[i % 4]}`, style: { borderRadius: theme.radius, background: hsl(i === 0 ? theme.colors.primary : theme.colors.muted), color: hsl(i === 0 ? theme.colors.primaryForeground : theme.colors.foreground) } }, f.image && i === 0 && /* @__PURE__ */ React4.createElement("img", { src: f.image, alt: "", loading: "lazy", className: "absolute inset-0 h-full w-full object-cover opacity-30" }), /* @__PURE__ */ React4.createElement("h3", { "data-ut-slot": `feature-${i}.title`, className: `relative ${i === 0 ? "text-2xl md:text-4xl" : "text-lg"}`, style: { fontFamily: theme.typography.headingFont } }, f.title), /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": `feature-${i}.description`, className: "relative mt-2 text-sm opacity-80" }, f.description))))));
};

// src/sections/variants/features/FeaturesGrid.tsx
import React5 from "react";
var FeaturesGrid = ({ section, theme }) => {
  const { headline, subheadline, items = [], columns = 3 } = section.props;
  return /* @__PURE__ */ React5.createElement(
    "section",
    {
      "data-ut-variant": "features:grid",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React5.createElement("div", { className: "text-center mb-12" }, /* @__PURE__ */ React5.createElement(
      "h2",
      {
        "data-ut-slot": "features.headline",
        className: "text-3xl mb-3",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": "features.subheadline", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React5.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[var(--ut-feature-columns)] gap-6", style: { "--ut-feature-columns": `repeat(${columns}, minmax(0, 1fr))`, overflowWrap: "anywhere" } }, items.map((item, i) => /* @__PURE__ */ React5.createElement(
      "div",
      {
        key: i,
        className: "p-6",
        style: {
          background: hsl(theme.colors.card),
          border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
          borderRadius: theme.radius
        }
      },
      item.icon && /* @__PURE__ */ React5.createElement("span", { className: "text-2xl mb-3 block" }, item.icon),
      /* @__PURE__ */ React5.createElement(
        "h3",
        {
          "data-ut-slot": `features.title`,
          className: "text-lg mb-2",
          style: {
            fontFamily: theme.typography.headingFont,
            color: hsl(theme.colors.cardForeground)
          }
        },
        item.title
      ),
      /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": `features.description`, className: "text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.description)
    ))))
  );
};

// src/sections/variants/features/FeaturesIconLeft.tsx
import React6 from "react";
var FeaturesIconLeft = ({ section, theme }) => {
  const { headline, subheadline, items = [] } = section.props;
  return /* @__PURE__ */ React6.createElement(
    "section",
    {
      "data-ut-variant": "features:icon-left",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React6.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React6.createElement("div", { className: "text-center mb-12" }, /* @__PURE__ */ React6.createElement(
      "h2",
      {
        "data-ut-slot": "features.headline",
        className: "text-3xl mb-3",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": "features.subheadline", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React6.createElement("div", { className: "grid gap-8", style: { maxWidth: "48rem", margin: "0 auto" } }, items.map((item, i) => /* @__PURE__ */ React6.createElement("div", { key: i, className: "flex gap-5 items-start" }, /* @__PURE__ */ React6.createElement(
      "div",
      {
        className: "flex-shrink-0 w-12 h-12 flex items-center justify-center text-xl rounded-xl",
        style: {
          background: hsla(theme.colors.primary, 0.1),
          color: hsl(theme.colors.primary)
        }
      },
      item.icon || "\u2726"
    ), /* @__PURE__ */ React6.createElement("div", null, /* @__PURE__ */ React6.createElement(
      "h3",
      {
        "data-ut-slot": `features.title`,
        className: "text-lg mb-1",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      item.title
    ), /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": `features.description`, className: "text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.description))))))
  );
};

// src/sections/variants/features/FeaturesMinimalCentered.tsx
import React7 from "react";
var FeaturesMinimalCentered = ({ section, theme }) => {
  const { headline, subheadline, items = [], columns = 3 } = section.props;
  return /* @__PURE__ */ React7.createElement(
    "section",
    {
      "data-ut-variant": "features:minimal-centered",
      style: {
        padding: theme.sectionPadding,
        background: hsl(theme.colors.muted)
      }
    },
    /* @__PURE__ */ React7.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React7.createElement("div", { className: "text-center mb-14" }, /* @__PURE__ */ React7.createElement(
      "h2",
      {
        "data-ut-slot": "features.headline",
        className: "text-3xl mb-3",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "features.subheadline", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React7.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[var(--ut-feature-columns)] gap-10 text-center", style: { "--ut-feature-columns": `repeat(${columns}, minmax(0, 1fr))`, overflowWrap: "anywhere" } }, items.map((item, i) => /* @__PURE__ */ React7.createElement("div", { key: i }, item.icon && /* @__PURE__ */ React7.createElement(
      "div",
      {
        className: "mx-auto w-14 h-14 flex items-center justify-center text-2xl rounded-full mb-4",
        style: {
          background: hsla(theme.colors.primary, 0.08),
          color: hsl(theme.colors.primary)
        }
      },
      item.icon
    ), /* @__PURE__ */ React7.createElement(
      "h3",
      {
        "data-ut-slot": `features.title`,
        className: "text-lg mb-2",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      item.title
    ), /* @__PURE__ */ React7.createElement(
      "p",
      {
        "data-ut-slot": `features.description`,
        className: "text-sm leading-relaxed max-w-xs mx-auto",
        style: { color: hsl(theme.colors.mutedForeground) }
      },
      item.description
    )))))
  );
};

// src/sections/variants/features/FeaturesBentoGrid.tsx
import React8 from "react";
var revealStyles = `
@keyframes ut-bento-rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: none; }
}
[data-ut-variant="features:bento-grid"] [data-ut-rise] {
  animation: ut-bento-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="features:bento-grid"] [data-ut-rise] {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;
var SPANS = [
  "md:col-span-1 md:row-span-3",
  "md:col-span-1 md:row-span-1",
  "md:col-span-1 md:row-span-1",
  "md:col-span-1 md:row-span-1",
  "md:col-span-1 md:row-span-1",
  "md:col-span-2 md:row-span-1"
];
var FeaturesBentoGrid = ({ section, theme }) => {
  const { headline, subheadline, items = [] } = section.props;
  return /* @__PURE__ */ React8.createElement(
    "section",
    {
      "data-ut-variant": "features:bento-grid",
      "data-ut-slot": "features",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React8.createElement("style", null, revealStyles),
    /* @__PURE__ */ React8.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React8.createElement("div", { className: "mb-8 text-center md:mb-12" }, /* @__PURE__ */ React8.createElement(
      "h2",
      {
        "data-ut-slot": "features.headline",
        className: "mb-3 text-2xl sm:text-3xl md:text-4xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React8.createElement(
      "p",
      {
        "data-ut-slot": "features.subheadline",
        className: "mx-auto max-w-lg text-base",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      subheadline
    )), /* @__PURE__ */ React8.createElement("div", { className: "grid w-full auto-rows-[minmax(180px,auto)] grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-3" }, items.map((item, i) => /* @__PURE__ */ React8.createElement(
      "div",
      {
        key: i,
        "data-ut-rise": true,
        "data-ut-slot": "features.item",
        className: `flex flex-col justify-end p-6 ${SPANS[i % SPANS.length]}`,
        style: {
          background: hsl(theme.colors.card),
          border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
          borderRadius: `calc(${theme.radius} * 1.5)`,
          animationDelay: `${0.05 * i}s`
        }
      },
      item.icon && /* @__PURE__ */ React8.createElement("span", { className: "mb-3 block text-2xl" }, item.icon),
      /* @__PURE__ */ React8.createElement(
        "h3",
        {
          "data-ut-slot": `features.title`,
          className: "mb-2 text-lg",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.cardForeground) }
        },
        item.title
      ),
      item.description && /* @__PURE__ */ React8.createElement(
        "p",
        {
          "data-ut-slot": `features.description`,
          className: "text-sm leading-relaxed",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        item.description
      )
    ))))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "features:spotlight-cards": FeaturesSpotlightCards, "features:integrations": FeaturesIntegrations, "features:bento-mosaic": FeaturesBentoMosaic, "features:grid": FeaturesGrid, "features:icon-left": FeaturesIconLeft, "features:minimal-centered": FeaturesMinimalCentered, "features:bento-grid": FeaturesBentoGrid };
export {
  REGISTERED_VARIANTS
};
