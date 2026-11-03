/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/cta/CTAInsetPanel.tsx
import React from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/cta/CTAInsetPanel.tsx
var CTAInsetPanel = ({ section, theme }) => /* @__PURE__ */ React.createElement("section", { "data-ut-variant": "cta:inset-panel", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col items-center gap-7 p-8 text-center md:p-16", style: { borderRadius: theme.radius, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React.createElement("h2", { "data-ut-slot": "cta.headline", className: "max-w-3xl text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, section.props.headline), section.props.description && /* @__PURE__ */ React.createElement("p", { "data-ut-slot": "cta.description", className: "max-w-2xl text-lg", style: { color: hsl(theme.colors.mutedForeground) } }, section.props.description), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap justify-center gap-4" }, (section.props.ctas || []).map((cta, i) => /* @__PURE__ */ React.createElement("a", { key: i, href: cta.href || "#", "data-ut-intent": cta.intent ?? "nav.goto", "data-ut-cta": i ? "cta.banner-secondary" : "cta.banner", className: "border px-6 py-3", style: { borderRadius: theme.radius, borderColor: hsl(theme.colors.border), background: hsl(i ? theme.colors.background : theme.colors.primary), color: hsl(i ? theme.colors.foreground : theme.colors.primaryForeground) } }, cta.label, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, " \u2192")))))));

// src/sections/variants/cta/CTASignalBanner.tsx
import React2 from "react";
var SWEEP_CSS = `
@keyframes utCtaSweep { 0%, 100% { margin-left: -10%; } 50% { margin-left: 77%; } }
[data-ut-variant="cta:signal-banner"] .ut-cta-sweep { animation: utCtaSweep 5s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="cta:signal-banner"] .ut-cta-sweep { animation: none; margin-left: 33%; }
}
`;
var CTASignalBanner = ({ section, theme }) => {
  const { headline, description, ctas = [] } = section.props;
  const corner = { borderColor: hsla(theme.colors.primary, 0.45) };
  return /* @__PURE__ */ React2.createElement(
    "section",
    {
      "data-ut-variant": "cta:signal-banner",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React2.createElement("style", null, SWEEP_CSS),
    /* @__PURE__ */ React2.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React2.createElement(
      "div",
      {
        className: "relative overflow-hidden px-6 py-12 text-center",
        style: {
          background: hsla(theme.colors.card, 0.85),
          border: `1px solid ${hsla(theme.colors.primary, 0.28)}`,
          borderRadius: theme.radius
        }
      },
      /* @__PURE__ */ React2.createElement("div", { className: "pointer-events-none absolute left-0 right-0 top-0 h-px" }, /* @__PURE__ */ React2.createElement(
        "div",
        {
          className: "ut-cta-sweep h-full w-1/3",
          style: {
            background: `linear-gradient(to right, transparent, ${hsl(theme.colors.primary)}, transparent)`
          }
        }
      )),
      /* @__PURE__ */ React2.createElement("div", { className: "relative" }, /* @__PURE__ */ React2.createElement(
        "h2",
        {
          "data-ut-slot": "cta.headline",
          className: "text-2xl md:text-3xl",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.foreground),
            letterSpacing: "0.02em"
          }
        },
        headline
      ), description && /* @__PURE__ */ React2.createElement(
        "p",
        {
          "data-ut-slot": "cta.description",
          className: "mx-auto mt-3 max-w-xl text-base",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        description
      ), ctas.length > 0 && /* @__PURE__ */ React2.createElement("div", { className: "mt-7 flex flex-wrap items-center justify-center gap-3" }, ctas.map((c, i) => {
        const primary = i === 0 || c.variant === "primary";
        return /* @__PURE__ */ React2.createElement(
          "a",
          {
            key: i,
            href: c.href || "#",
            "data-ut-intent": c.intent ?? "nav.goto",
            "data-ut-cta": i === 0 ? "cta.banner" : "cta.banner-secondary",
            className: "inline-flex items-center px-6 py-3 text-sm font-semibold uppercase tracking-widest no-underline motion-safe:transition-opacity hover:opacity-90",
            style: {
              borderRadius: theme.radius,
              fontFamily: theme.typography.bodyFont,
              background: primary ? hsla(theme.colors.primary, 0.18) : "transparent",
              color: primary ? hsl(theme.colors.primary) : hsl(theme.colors.mutedForeground),
              border: `1px solid ${hsla(theme.colors.primary, primary ? 0.8 : 0.3)}`
            }
          },
          c.label
        );
      }))),
      /* @__PURE__ */ React2.createElement("span", { className: "pointer-events-none absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2", style: corner }),
      /* @__PURE__ */ React2.createElement("span", { className: "pointer-events-none absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2", style: corner }),
      /* @__PURE__ */ React2.createElement("span", { className: "pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2", style: corner }),
      /* @__PURE__ */ React2.createElement("span", { className: "pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2", style: corner })
    ))
  );
};

// src/sections/variants/cta/CTAEditorial.tsx
import React3 from "react";
var CTAEditorial = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React3.createElement("section", { "data-ut-variant": "cta:editorial", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React3.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React3.createElement("div", { className: "grid gap-8 border-t pt-10 md:grid-cols-[2fr_1fr] md:items-end md:pt-16", style: { borderColor: hsl(theme.colors.foreground) } }, /* @__PURE__ */ React3.createElement("div", null, /* @__PURE__ */ React3.createElement("h2", { "data-ut-slot": "cta.headline", className: "text-4xl sm:text-5xl md:text-6xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.description && /* @__PURE__ */ React3.createElement("p", { "data-ut-slot": "cta.description", className: "mt-4 max-w-xl text-base md:text-lg", style: { color: hsl(theme.colors.mutedForeground) } }, p.description)), /* @__PURE__ */ React3.createElement("div", { "data-ut-slot": "cta.actions", className: "flex flex-col gap-3 md:items-end" }, (p.ctas || []).map((c, i) => /* @__PURE__ */ React3.createElement("a", { key: i, href: c.href || "#", "data-ut-intent": c.intent ?? "nav.goto", className: "inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity hover:opacity-90", style: { borderRadius: theme.radius, background: i ? "transparent" : hsl(theme.colors.primary), color: i ? hsl(theme.colors.foreground) : hsl(theme.colors.primaryForeground), border: `1px solid ${hsl(i ? theme.colors.border : theme.colors.primary)}` } }, c.label))))));
};

// src/sections/variants/cta/CTACentered.tsx
import React4 from "react";
var CTACentered = ({ section, theme }) => {
  const { headline, description, ctas = [] } = section.props;
  return /* @__PURE__ */ React4.createElement(
    "section",
    {
      "data-ut-variant": "cta:centered",
      className: "text-center",
      style: {
        padding: theme.sectionPadding,
        background: hsla(theme.colors.primary, 0.04),
        borderTop: `1px solid ${hsla(theme.colors.border, 0.4)}`,
        borderBottom: `1px solid ${hsla(theme.colors.border, 0.4)}`
      }
    },
    /* @__PURE__ */ React4.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React4.createElement(
      "h2",
      {
        "data-ut-slot": "cta.headline",
        className: "mb-4 text-2xl sm:text-3xl md:text-4xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), description && /* @__PURE__ */ React4.createElement(
      "p",
      {
        "data-ut-slot": "cta.description",
        className: "text-base max-w-lg mx-auto mb-8",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      description
    ), /* @__PURE__ */ React4.createElement("div", { "data-ut-slot": "cta.actions", className: "flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center" }, ctas.map((c, i) => /* @__PURE__ */ React4.createElement(
      "a",
      {
        key: i,
        href: c.href || "#",
        "data-ut-intent": c.intent ?? "nav.goto",
        "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
        className: "inline-block text-sm font-medium px-6 py-3 motion-safe:transition-opacity hover:opacity-90",
        style: c.variant === "outline" ? {
          background: "transparent",
          color: hsl(theme.colors.foreground),
          border: `1px solid ${hsla(theme.colors.border, 1)}`,
          borderRadius: theme.radius
        } : {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderRadius: theme.radius
        }
      },
      c.label
    ))))
  );
};

// src/sections/variants/cta/CTAGradientBanner.tsx
import React5 from "react";
var CTAGradientBanner = ({ section, theme }) => {
  const { headline, description, ctas = [] } = section.props;
  return /* @__PURE__ */ React5.createElement(
    "section",
    {
      "data-ut-variant": "cta:gradient-banner",
      className: "relative overflow-hidden text-center",
      style: {
        padding: "5rem 1rem",
        background: `linear-gradient(135deg, ${hsl(theme.colors.primary)}, ${hsl(theme.colors.secondary)})`
      }
    },
    /* @__PURE__ */ React5.createElement(
      "div",
      {
        className: "absolute inset-0 opacity-10",
        style: {
          backgroundImage: `radial-gradient(circle at 20% 50%, ${hsla(theme.colors.primaryForeground, 0.3)} 0%, transparent 50%), radial-gradient(circle at 80% 50%, ${hsla(theme.colors.primaryForeground, 0.2)} 0%, transparent 50%)`
        }
      }
    ),
    /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-6 relative", style: { maxWidth: "700px" } }, /* @__PURE__ */ React5.createElement(
      "h2",
      {
        "data-ut-slot": "cta.headline",
        className: "text-3xl md:text-4xl mb-4",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.primaryForeground),
          letterSpacing: 0
        }
      },
      headline
    ), description && /* @__PURE__ */ React5.createElement(
      "p",
      {
        "data-ut-slot": "cta.description",
        className: "text-base max-w-lg mx-auto mb-8",
        style: { fontFamily: theme.typography.bodyFont, color: hsla(theme.colors.primaryForeground, 0.85) }
      },
      description
    ), /* @__PURE__ */ React5.createElement("div", { "data-ut-slot": "cta.actions", className: "flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center" }, ctas.map((c, i) => /* @__PURE__ */ React5.createElement(
      "a",
      {
        key: i,
        href: c.href || "#",
        "data-ut-intent": c.intent ?? "nav.goto",
        "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
        className: "inline-block text-sm font-medium px-6 py-3 motion-safe:transition-opacity hover:opacity-90",
        style: c.variant === "outline" ? {
          background: "transparent",
          color: hsl(theme.colors.primaryForeground),
          border: `1px solid ${hsla(theme.colors.primaryForeground, 0.4)}`,
          borderRadius: theme.radius
        } : {
          background: hsl(theme.colors.primaryForeground),
          color: hsl(theme.colors.primary),
          borderRadius: theme.radius,
          fontWeight: "600"
        }
      },
      c.label
    ))))
  );
};

// src/sections/variants/cta/CTASplitCard.tsx
import React6 from "react";
var CTASplitCard = ({ section, theme }) => {
  const { headline, description, ctas = [] } = section.props;
  return /* @__PURE__ */ React6.createElement(
    "section",
    {
      "data-ut-variant": "cta:split-card",
      style: {
        padding: theme.sectionPadding,
        background: hsl(theme.colors.background)
      }
    },
    /* @__PURE__ */ React6.createElement(
      "div",
      {
        className: "mx-auto px-5 sm:px-6 lg:px-8",
        style: { maxWidth: theme.containerWidth }
      },
      /* @__PURE__ */ React6.createElement(
        "div",
        {
          className: "grid grid-cols-1 lg:grid-cols-2 items-center gap-8 rounded-2xl overflow-hidden shadow-sm",
          style: {
            background: hsla(theme.colors.card, 1),
            border: `1px solid ${hsla(theme.colors.border, 0.5)}`
          }
        },
        /* @__PURE__ */ React6.createElement("div", { className: "p-10" }, /* @__PURE__ */ React6.createElement(
          "h2",
          {
            "data-ut-slot": "cta.headline",
            className: "text-3xl mb-4",
            style: {
              fontFamily: theme.typography.headingFont,
              fontWeight: theme.typography.headingWeight,
              color: hsl(theme.colors.foreground)
            }
          },
          headline
        ), description && /* @__PURE__ */ React6.createElement(
          "p",
          {
            "data-ut-slot": "cta.description",
            className: "text-base mb-8",
            style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
          },
          description
        ), /* @__PURE__ */ React6.createElement("div", { "data-ut-slot": "cta.actions", className: "flex flex-col gap-3 sm:flex-row sm:flex-wrap" }, ctas.map((c, i) => /* @__PURE__ */ React6.createElement(
          "a",
          {
            key: i,
            href: c.href || "#",
            "data-ut-intent": c.intent ?? "nav.goto",
            "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
            className: "inline-block text-sm font-medium px-6 py-3 motion-safe:transition-opacity hover:opacity-90",
            style: c.variant === "outline" ? {
              background: "transparent",
              color: hsl(theme.colors.foreground),
              border: `1px solid ${hsla(theme.colors.border, 1)}`,
              borderRadius: theme.radius
            } : {
              background: hsl(theme.colors.primary),
              color: hsl(theme.colors.primaryForeground),
              borderRadius: theme.radius
            }
          },
          c.label
        )))),
        /* @__PURE__ */ React6.createElement(
          "div",
          {
            className: "h-full min-h-[var(--ut-media-block)] flex items-center justify-center",
            style: {
              background: `linear-gradient(135deg, ${hsla(theme.colors.primary, 0.08)}, ${hsla(theme.colors.accent, 0.08)})`
            }
          },
          /* @__PURE__ */ React6.createElement("div", { className: "text-center p-8" }, /* @__PURE__ */ React6.createElement(
            "div",
            {
              className: "text-5xl font-bold mb-2",
              style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.primary) }
            },
            "\u2726"
          ), /* @__PURE__ */ React6.createElement(
            "div",
            {
              className: "text-sm font-medium",
              style: { color: hsl(theme.colors.mutedForeground) }
            },
            "Ready to get started?"
          ))
        )
      )
    )
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "cta:inset-panel": CTAInsetPanel, "cta:signal-banner": CTASignalBanner, "cta:editorial": CTAEditorial, "cta:centered": CTACentered, "cta:gradient-banner": CTAGradientBanner, "cta:split-card": CTASplitCard };
export {
  REGISTERED_VARIANTS
};
