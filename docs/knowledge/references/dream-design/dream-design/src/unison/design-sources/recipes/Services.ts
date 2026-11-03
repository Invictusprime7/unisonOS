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

// src/sections/variants/services/ServicesExpandable.tsx
import React2 from "react";

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
function EditorialCTA({ cta, theme }) {
  if (!cta) return null;
  return /* @__PURE__ */ React.createElement(
    "a",
    {
      href: cta.href || "#contact",
      "data-ut-intent": cta.intent ?? "nav.goto",
      "data-ut-slot": "cta",
      className: "mt-6 inline-flex min-h-11 items-center justify-center gap-5 px-5 py-3 text-sm font-semibold motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
      style: {
        borderRadius: theme.radius,
        background: hsl(theme.colors.primary),
        color: hsl(theme.colors.primaryForeground)
      }
    },
    cta.label,
    /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, "\u2197")
  );
}

// src/sections/variants/services/ServicesExpandable.tsx
function ServicesExpandable({ section, theme }) {
  return /* @__PURE__ */ React2.createElement(
    EditorialSection,
    {
      variantId: "services:expandable",
      theme,
      headline: section.props.headline,
      description: section.props.subheadline
    },
    /* @__PURE__ */ React2.createElement("div", { className: "space-y-3" }, section.props.items.map((item, index) => /* @__PURE__ */ React2.createElement(
      "details",
      {
        key: index,
        "data-ut-slot": `service-${index}`,
        className: "group p-5 sm:p-7",
        style: editorialCardStyle(theme)
      },
      /* @__PURE__ */ React2.createElement(
        "summary",
        {
          className: "cursor-pointer text-xl sm:text-2xl",
          style: { fontFamily: theme.typography.headingFont }
        },
        item.title,
        item.price && /* @__PURE__ */ React2.createElement("span", { "data-ut-slot": `services.price`, className: "ml-4 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, item.price)
      ),
      /* @__PURE__ */ React2.createElement("div", { className: `mt-6 grid gap-6 ${item.image ? "md:grid-cols-2" : ""}` }, /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("p", { "data-ut-slot": `services.description`, className: "leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.description), item.duration && /* @__PURE__ */ React2.createElement("p", { className: "mt-4 text-sm" }, item.duration), /* @__PURE__ */ React2.createElement(EditorialCTA, { cta: item.cta, theme })), item.image && /* @__PURE__ */ React2.createElement(
        "img",
        {
          src: item.image,
          alt: item.title,
          loading: "lazy",
          className: "aspect-[16/9] w-full object-cover",
          style: { borderRadius: theme.radius }
        }
      ))
    )))
  );
}

// src/sections/variants/services/ServicesEditorialRows.tsx
import React3 from "react";
function ServicesEditorialRows({ section, theme }) {
  return /* @__PURE__ */ React3.createElement(
    EditorialSection,
    {
      variantId: "services:editorial-rows",
      theme,
      headline: section.props.headline,
      description: section.props.subheadline
    },
    section.props.items.map((item, index) => /* @__PURE__ */ React3.createElement(
      "article",
      {
        key: index,
        "data-ut-slot": `service-${index}`,
        "data-ut-reveal": true,
        className: "grid items-start gap-6 border-t py-8 md:grid-cols-[3rem_1fr_1.2fr] lg:gap-12",
        style: { borderColor: hsl(theme.colors.border) }
      },
      /* @__PURE__ */ React3.createElement("span", { className: "text-sm tabular-nums", style: { color: hsl(theme.colors.mutedForeground) } }, String(index + 1).padStart(2, "0")),
      /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("h3", { "data-ut-slot": `services.title`, className: "text-2xl sm:text-3xl", style: { fontFamily: theme.typography.headingFont } }, item.title), item.image && /* @__PURE__ */ React3.createElement(
        "img",
        {
          src: item.image,
          alt: item.title,
          loading: "lazy",
          className: "mt-6 aspect-[3/2] w-full object-cover",
          style: { borderRadius: theme.radius }
        }
      )),
      /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("p", { "data-ut-slot": `services.description`, className: "text-base leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.description), (item.price || item.duration) && /* @__PURE__ */ React3.createElement("p", { className: "mt-4 text-sm font-semibold" }, [item.price, item.duration].filter(Boolean).join(" \xB7 ")), /* @__PURE__ */ React3.createElement(EditorialCTA, { cta: item.cta, theme }))
    ))
  );
}

// src/sections/variants/services/ServicesBentoSpotlight.tsx
import React4 from "react";
function ServicesBentoSpotlight({ section, theme }) {
  const { headline, subheadline, items = [] } = section.props;
  return /* @__PURE__ */ React4.createElement(
    EditorialSection,
    {
      variantId: "services:bento-spotlight",
      theme,
      headline,
      description: subheadline
    },
    /* @__PURE__ */ React4.createElement("div", { className: "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" }, items.map((item, index) => /* @__PURE__ */ React4.createElement(
      "article",
      {
        key: index,
        "data-ut-slot": `service-${index}`,
        "data-ut-reveal": true,
        className: `group flex min-w-0 flex-col overflow-hidden ${index === 0 ? "md:col-span-2 lg:row-span-2" : ""}`,
        style: {
          ...editorialCardStyle(theme),
          "--ut-reveal-delay": `${Math.min(index, 5) * 55}ms`
        }
      },
      item.image && /* @__PURE__ */ React4.createElement("div", { className: `overflow-hidden ${index === 0 ? "aspect-[16/9]" : "aspect-[2/1]"}` }, /* @__PURE__ */ React4.createElement(
        "img",
        {
          src: item.image,
          alt: item.title,
          loading: "lazy",
          className: "h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
        }
      )),
      /* @__PURE__ */ React4.createElement("div", { className: "flex flex-1 flex-col items-start p-6 sm:p-8" }, /* @__PURE__ */ React4.createElement(
        "div",
        {
          className: "mb-6 flex w-full items-center justify-between gap-3 text-xs uppercase tracking-widest",
          style: { color: hsl(theme.colors.mutedForeground) }
        },
        /* @__PURE__ */ React4.createElement("span", null, String(index + 1).padStart(2, "0")),
        item.badge && /* @__PURE__ */ React4.createElement("span", { "data-ut-slot": `services.badge` }, item.badge)
      ), /* @__PURE__ */ React4.createElement(
        "h3",
        {
          "data-ut-slot": `services.title`,
          className: index === 0 ? "text-3xl tracking-tight" : "text-xl tracking-tight",
          style: { fontFamily: theme.typography.headingFont }
        },
        item.title
      ), /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": `services.description`, className: "mt-3 flex-1 leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.description), (item.price || item.duration) && /* @__PURE__ */ React4.createElement("p", { className: "mt-5 text-sm font-medium" }, [item.price, item.duration].filter(Boolean).join(" \xB7 ")), /* @__PURE__ */ React4.createElement(EditorialCTA, { cta: item.cta, theme }))
    )))
  );
}

// src/sections/variants/services/ServicesProductCards.tsx
import React5 from "react";
var ServicesProductCards = ({ section, theme }) => {
  const { headline, subheadline, items = [], columns = 4 } = section.props;
  const cols = Math.max(1, Math.min(columns, items.length || columns));
  return /* @__PURE__ */ React5.createElement(
    "section",
    {
      "data-ut-variant": "services:product-cards",
      "data-ut-slot": "products",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, (headline || subheadline) && /* @__PURE__ */ React5.createElement("div", { className: "mb-8 text-center md:mb-12" }, headline && /* @__PURE__ */ React5.createElement(
      "h2",
      {
        "data-ut-slot": "services.headline",
        className: "mb-3 text-2xl sm:text-3xl md:text-4xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": "services.subheadline", className: "mx-auto max-w-xl text-base", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React5.createElement(
      "div",
      {
        className: "grid gap-6",
        style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
      },
      items.map((item, i) => /* @__PURE__ */ React5.createElement(
        "article",
        {
          key: i,
          "data-ut-slot": `product-${i + 1}`,
          className: "group flex h-full flex-col overflow-hidden p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none",
          style: {
            background: hsl(theme.colors.card),
            color: hsl(theme.colors.cardForeground),
            border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
            borderRadius: theme.radius
          }
        },
        /* @__PURE__ */ React5.createElement(
          "div",
          {
            className: "mb-4 flex h-40 w-full items-center justify-center overflow-hidden",
            style: { background: hsla(theme.colors.muted, 0.6), borderRadius: theme.radius }
          },
          item.image ? /* @__PURE__ */ React5.createElement(
            "img",
            {
              src: item.image,
              alt: item.title,
              loading: "lazy",
              className: "h-full w-full object-contain transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
            }
          ) : /* @__PURE__ */ React5.createElement("span", { "aria-hidden": "true", className: "text-3xl" }, item.icon || "\u{1F6CD}\uFE0F")
        ),
        /* @__PURE__ */ React5.createElement("div", { className: "flex flex-grow flex-col items-center gap-1" }, item.badge && /* @__PURE__ */ React5.createElement(
          "span",
          {
            "data-ut-slot": `services.badge`,
            className: "mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
            style: { background: hsla(theme.colors.primary, 0.12), color: hsl(theme.colors.primary) }
          },
          item.badge
        ), /* @__PURE__ */ React5.createElement(
          "h3",
          {
            "data-ut-slot": `services.title`,
            className: "text-base",
            style: {
              fontFamily: theme.typography.headingFont,
              fontWeight: theme.typography.headingWeight
            }
          },
          item.title
        ), /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": `services.description`, className: "text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, item.description)),
        (item.price || item.duration) && /* @__PURE__ */ React5.createElement("div", { className: "mt-4 flex flex-col items-center gap-2" }, item.price && /* @__PURE__ */ React5.createElement(
          "span",
          {
            "data-ut-slot": `services.price`,
            className: "text-2xl",
            style: {
              fontFamily: theme.typography.headingFont,
              fontWeight: theme.typography.headingWeight,
              color: hsl(theme.colors.foreground)
            }
          },
          item.price
        ), item.duration && /* @__PURE__ */ React5.createElement(
          "span",
          {
            className: "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs",
            style: { background: hsla(theme.colors.secondary, 0.18), color: hsl(theme.colors.foreground) }
          },
          item.duration
        )),
        /* @__PURE__ */ React5.createElement(
          "a",
          {
            href: item.cta?.href || "#products",
            "data-ut-intent": item.cta?.intent || "cart.add",
            "data-ut-cta": "cta.product",
            className: "mt-5 inline-flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold no-underline transition-opacity hover:opacity-90",
            style: {
              background: hsl(theme.colors.primary),
              color: hsl(theme.colors.primaryForeground),
              borderRadius: theme.radius,
              fontFamily: theme.typography.bodyFont
            }
          },
          item.cta?.label || "Add to Bag"
        )
      ))
    ))
  );
};

// src/sections/variants/services/ServicesCardGrid.tsx
import React6 from "react";
var ServicesCardGrid = ({ section, theme }) => {
  const { headline, subheadline, items = [], columns = 3 } = section.props;
  return /* @__PURE__ */ React6.createElement("section", { "data-ut-variant": "services:card-grid", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React6.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React6.createElement("div", { className: "text-center mb-12" }, /* @__PURE__ */ React6.createElement(
    "h2",
    {
      "data-ut-slot": "services.headline",
      className: "text-3xl mb-3",
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground)
      }
    },
    headline
  ), subheadline && /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": "services.subheadline", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React6.createElement(
    "div",
    {
      className: "grid gap-6",
      style: { gridTemplateColumns: `repeat(${Math.min(columns, items.length)}, 1fr)` }
    },
    items.map((item, i) => /* @__PURE__ */ React6.createElement(
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
      item.badge && /* @__PURE__ */ React6.createElement(
        "span",
        {
          "data-ut-slot": `services.badge`,
          className: "inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3",
          style: { background: hsla(theme.colors.primary, 0.1), color: hsl(theme.colors.primary) }
        },
        item.badge
      ),
      /* @__PURE__ */ React6.createElement(
        "h3",
        {
          "data-ut-slot": `services.title`,
          className: "text-lg mb-2",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.cardForeground)
          }
        },
        item.title
      ),
      /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": `services.description`, className: "text-sm leading-relaxed mb-4", style: { color: hsl(theme.colors.mutedForeground) } }, item.description),
      (item.price || item.duration) && /* @__PURE__ */ React6.createElement("div", { className: "flex items-baseline gap-2" }, item.price && /* @__PURE__ */ React6.createElement("span", { "data-ut-slot": `services.price`, className: "text-xl font-semibold", style: { color: hsl(theme.colors.primary) } }, item.price), item.duration && /* @__PURE__ */ React6.createElement("span", { className: "text-xs", style: { color: hsl(theme.colors.mutedForeground) } }, item.duration)),
      item.cta && /* @__PURE__ */ React6.createElement(
        "a",
        {
          href: item.cta.href || "#",
          "data-ut-intent": item.cta.intent ?? "nav.goto",
          "data-ut-cta": "cta.card",
          className: "inline-block mt-4 text-sm font-medium px-4 py-2 motion-safe:transition-opacity hover:opacity-90",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius
          }
        },
        item.cta.label
      )
    ))
  )));
};

// src/sections/variants/services/ServicesAlternating.tsx
import React7 from "react";
var ServicesAlternating = ({ section, theme }) => {
  const { headline, subheadline, items = [] } = section.props;
  return /* @__PURE__ */ React7.createElement("section", { "data-ut-variant": "services:alternating", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React7.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React7.createElement("div", { className: "text-center mb-14" }, /* @__PURE__ */ React7.createElement(
    "h2",
    {
      "data-ut-slot": "services.headline",
      className: "text-3xl mb-3",
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground)
      }
    },
    headline
  ), subheadline && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "services.subheadline", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React7.createElement("div", { className: "flex flex-col gap-16" }, items.map((item, i) => /* @__PURE__ */ React7.createElement(
    "div",
    {
      key: i,
      className: "grid gap-8 items-center",
      style: {
        gridTemplateColumns: "1fr 1fr",
        direction: i % 2 !== 0 ? "rtl" : "ltr"
      }
    },
    /* @__PURE__ */ React7.createElement("div", { style: { direction: "ltr" } }, item.badge && /* @__PURE__ */ React7.createElement(
      "span",
      {
        "data-ut-slot": `services.badge`,
        className: "inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3",
        style: { background: hsla(theme.colors.primary, 0.1), color: hsl(theme.colors.primary) }
      },
      item.badge
    ), /* @__PURE__ */ React7.createElement(
      "h3",
      {
        "data-ut-slot": `services.title`,
        className: "text-2xl mb-3",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      item.title
    ), /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": `services.description`, className: "text-sm leading-relaxed mb-4", style: { color: hsl(theme.colors.mutedForeground) } }, item.description), (item.price || item.duration) && /* @__PURE__ */ React7.createElement("div", { className: "flex items-baseline gap-2 mb-4" }, item.price && /* @__PURE__ */ React7.createElement("span", { "data-ut-slot": `services.price`, className: "text-xl font-semibold", style: { color: hsl(theme.colors.primary) } }, item.price), item.duration && /* @__PURE__ */ React7.createElement("span", { className: "text-xs", style: { color: hsl(theme.colors.mutedForeground) } }, item.duration)), item.cta && /* @__PURE__ */ React7.createElement(
      "a",
      {
        href: item.cta.href || "#",
        "data-ut-intent": item.cta.intent ?? "nav.goto",
        "data-ut-cta": "cta.card",
        className: "inline-block text-sm font-medium px-5 py-2.5 motion-safe:transition-opacity hover:opacity-90",
        style: {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderRadius: theme.radius
        }
      },
      item.cta.label
    )),
    /* @__PURE__ */ React7.createElement(
      "div",
      {
        style: {
          direction: "ltr",
          aspectRatio: "4/3",
          borderRadius: theme.radius,
          background: item.image ? `url(${item.image}) center/cover` : `linear-gradient(135deg, ${hsla(theme.colors.primary, 0.08)}, ${hsla(theme.colors.secondary, 0.08)})`,
          border: `1px solid ${hsla(theme.colors.border, 0.4)}`
        }
      }
    )
  )))));
};

// src/sections/variants/services/ServicesCompactList.tsx
import React8 from "react";
var ServicesCompactList = ({ section, theme }) => {
  const { headline, subheadline, items = [] } = section.props;
  return /* @__PURE__ */ React8.createElement("section", { "data-ut-variant": "services:compact-list", style: { padding: theme.sectionPadding, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React8.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: "56rem" } }, headline && /* @__PURE__ */ React8.createElement("div", { className: "text-center mb-12" }, /* @__PURE__ */ React8.createElement(
    "h2",
    {
      "data-ut-slot": "services.headline",
      className: "text-3xl mb-3",
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground)
      }
    },
    headline
  ), subheadline && /* @__PURE__ */ React8.createElement("p", { "data-ut-slot": "services.subheadline", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline)), /* @__PURE__ */ React8.createElement("div", { className: "flex flex-col gap-4" }, items.map((item, i) => /* @__PURE__ */ React8.createElement(
    "div",
    {
      key: i,
      className: "flex items-center gap-5 p-5",
      style: {
        background: hsl(theme.colors.card),
        border: `1px solid ${hsla(theme.colors.border, 0.5)}`,
        borderRadius: theme.radius
      }
    },
    /* @__PURE__ */ React8.createElement(
      "div",
      {
        className: "flex-shrink-0 w-11 h-11 flex items-center justify-center text-lg rounded-lg",
        style: {
          background: hsla(theme.colors.primary, 0.1),
          color: hsl(theme.colors.primary)
        }
      },
      item.icon || "\u25CF"
    ),
    /* @__PURE__ */ React8.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React8.createElement(
      "h3",
      {
        "data-ut-slot": `services.title`,
        className: "text-base mb-0.5",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.cardForeground)
        }
      },
      item.title
    ), /* @__PURE__ */ React8.createElement("p", { "data-ut-slot": `services.description`, className: "text-sm truncate", style: { color: hsl(theme.colors.mutedForeground) } }, item.description)),
    item.price && /* @__PURE__ */ React8.createElement("span", { "data-ut-slot": `services.price`, className: "text-lg font-semibold flex-shrink-0", style: { color: hsl(theme.colors.primary) } }, item.price),
    item.cta && /* @__PURE__ */ React8.createElement(
      "a",
      {
        href: item.cta.href || "#",
        "data-ut-intent": item.cta.intent ?? "nav.goto",
        "data-ut-cta": "cta.card",
        className: "flex-shrink-0 text-sm font-medium px-4 py-2 motion-safe:transition-opacity hover:opacity-90",
        style: {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderRadius: theme.radius
        }
      },
      item.cta.label
    )
  )))));
};

// <stdin>
var REGISTERED_VARIANTS = { "services:expandable": ServicesExpandable, "services:editorial-rows": ServicesEditorialRows, "services:bento-spotlight": ServicesBentoSpotlight, "services:product-cards": ServicesProductCards, "services:card-grid": ServicesCardGrid, "services:alternating": ServicesAlternating, "services:compact-list": ServicesCompactList };
export {
  REGISTERED_VARIANTS
};
