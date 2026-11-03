/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/beforeAfter/BeforeAfterRevealPanel.tsx
import React2 from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;

// src/sections/variants/beforeAfter/BeforeAfterFrame.tsx
import React from "react";
var normalizePairs = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const entry = raw || {};
    const before = String(entry.before ?? entry.beforeImage ?? "").trim();
    const after = String(entry.after ?? entry.afterImage ?? "").trim();
    if (!before || !after) return null;
    return {
      before,
      after,
      label: entry.label ? String(entry.label) : entry.title ? String(entry.title) : void 0,
      description: entry.description ? String(entry.description) : void 0
    };
  }).filter(Boolean);
};
var StageTag = ({
  theme,
  tone,
  children
}) => /* @__PURE__ */ React.createElement(
  "span",
  {
    style: {
      position: "absolute",
      top: "0.75rem",
      left: "0.75rem",
      padding: "0.25rem 0.625rem",
      borderRadius: "999px",
      fontFamily: theme.typography.bodyFont,
      fontSize: "0.6875rem",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      background: tone === "after" ? hsl(theme.colors.primary) : hsl(theme.colors.foreground),
      color: tone === "after" ? hsl(theme.colors.primaryForeground) : hsl(theme.colors.background)
    }
  },
  children
);
var BeforeAfterFrame = ({ variantId, theme, headline, subheadline, surface = "muted", children }) => /* @__PURE__ */ React.createElement(
  "section",
  {
    "data-ut-variant": variantId,
    style: {
      padding: theme.sectionPadding,
      background: hsl(surface === "muted" ? theme.colors.muted : theme.colors.background)
    }
  },
  /* @__PURE__ */ React.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, (headline || subheadline) && /* @__PURE__ */ React.createElement("div", { className: "mb-8 text-center md:mb-12" }, headline && /* @__PURE__ */ React.createElement(
    "h2",
    {
      "data-ut-slot": "before-after.headline",
      className: "mb-3 text-2xl sm:text-3xl md:text-4xl",
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground)
      }
    },
    headline
  ), subheadline && /* @__PURE__ */ React.createElement(
    "p",
    {
      "data-ut-slot": "before-after.subheadline",
      className: "mx-auto max-w-2xl text-lg",
      style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
    },
    subheadline
  )), children)
);

// src/sections/variants/beforeAfter/BeforeAfterRevealPanel.tsx
var BeforeAfterRevealPanel = ({ section, theme }) => {
  const pairs = normalizePairs(section.props.items);
  const [position, setPosition] = React2.useState(50);
  const [active, setActive] = React2.useState(0);
  const pair = pairs[Math.min(active, Math.max(0, pairs.length - 1))];
  return /* @__PURE__ */ React2.createElement(BeforeAfterFrame, { variantId: "before-after:reveal-panel", theme, headline: section.props.headline, subheadline: section.props.subheadline }, pair && /* @__PURE__ */ React2.createElement("figure", { className: "m-0" }, /* @__PURE__ */ React2.createElement("div", { className: "relative aspect-video overflow-hidden", style: { borderRadius: theme.radius, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React2.createElement("img", { src: pair.before || pair.after, alt: (pair.label || "Result") + " before", className: "absolute inset-0 h-full w-full object-cover", loading: "lazy" }), /* @__PURE__ */ React2.createElement("img", { src: pair.after || pair.before, alt: (pair.label || "Result") + " after", className: "absolute inset-0 h-full w-full object-cover", loading: "lazy", style: { clipPath: "inset(0 " + (100 - position) + "% 0 0)" } }), /* @__PURE__ */ React2.createElement("div", { "aria-hidden": "true", className: "absolute inset-y-0 w-1", style: { left: position + "%", background: hsl(theme.colors.background) } })), /* @__PURE__ */ React2.createElement("label", { className: "mt-5 block text-sm", style: { color: hsl(theme.colors.foreground) } }, "Compare before and after", /* @__PURE__ */ React2.createElement("input", { className: "mt-3 block w-full", style: { accentColor: hsl(theme.colors.primary) }, type: "range", min: 0, max: 100, value: position, onChange: (e) => setPosition(Number(e.target.value)) })), pair.label && /* @__PURE__ */ React2.createElement("figcaption", { "data-ut-slot": `before-after.label`, className: "mt-4 text-center" }, pair.label), pair.description && /* @__PURE__ */ React2.createElement("p", { "data-ut-slot": `before-after.description`, className: "mt-2 text-center" }, pair.description), pairs.length > 1 && /* @__PURE__ */ React2.createElement("div", { className: "mt-5 flex flex-wrap justify-center gap-3" }, pairs.map((item, i) => /* @__PURE__ */ React2.createElement("button", { "data-ut-intent": "ui.toggle", key: i, type: "button", "aria-pressed": i === active, onClick: () => {
    setActive(i);
    setPosition(50);
  }, className: "border px-4 py-2", style: { borderRadius: theme.radius, borderColor: hsl(theme.colors.border), color: hsl(theme.colors.foreground) } }, item.label || "Result " + (i + 1))))));
};

// src/sections/variants/beforeAfter/BeforeAfterSlider.tsx
import React3 from "react";
var BeforeAfterSlider = ({ section, theme }) => {
  const pairs = normalizePairs(section.props.items);
  const [position, setPosition] = React3.useState(50);
  const [active, setActive] = React3.useState(0);
  const pair = pairs[Math.min(active, Math.max(0, pairs.length - 1))];
  const fromPointer = (element, clientX) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width) return;
    setPosition(Math.round(Math.min(100, Math.max(0, (clientX - rect.left) / rect.width * 100))));
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    fromPointer(event.currentTarget, event.clientX);
  };
  const onPointerMove = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) fromPointer(event.currentTarget, event.clientX);
  };
  const onPointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const select = (index) => {
    setActive(index);
    setPosition(50);
  };
  return /* @__PURE__ */ React3.createElement(
    BeforeAfterFrame,
    {
      variantId: "before-after:slider",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    pair && /* @__PURE__ */ React3.createElement("figure", { className: "m-0 mx-auto", style: { maxWidth: "48rem" } }, pairs.length > 1 && /* @__PURE__ */ React3.createElement("div", { className: "mb-4 flex flex-wrap justify-center gap-2", role: "group", "aria-label": "Choose a project" }, pairs.map((item, index) => /* @__PURE__ */ React3.createElement(
      "button",
      {
        key: index,
        type: "button",
        "aria-pressed": index === active,
        onClick: () => select(index),
        className: "min-h-11 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        style: {
          fontFamily: theme.typography.bodyFont,
          borderRadius: theme.radius,
          border: `1px solid ${hsl(theme.colors.border)}`,
          background: index === active ? hsl(theme.colors.foreground) : "transparent",
          color: index === active ? hsl(theme.colors.background) : hsl(theme.colors.foreground)
        }
      },
      item.label || `Project ${index + 1}`
    ))), /* @__PURE__ */ React3.createElement(
      "div",
      {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        style: {
          touchAction: "pan-y",
          position: "relative",
          overflow: "hidden",
          borderRadius: theme.radius,
          border: `1px solid ${hsl(theme.colors.border)}`,
          aspectRatio: "4 / 3"
        }
      },
      /* @__PURE__ */ React3.createElement(
        "img",
        {
          src: pair.before,
          alt: `${pair.label || "Result"} before`,
          loading: "lazy",
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
        }
      ),
      /* @__PURE__ */ React3.createElement(
        "div",
        {
          style: {
            position: "absolute",
            inset: 0,
            clipPath: `inset(0 ${100 - position}% 0 0)`
          }
        },
        /* @__PURE__ */ React3.createElement(
          "img",
          {
            src: pair.after,
            alt: `${pair.label || "Result"} after`,
            loading: "lazy",
            style: { width: "100%", height: "100%", objectFit: "cover" }
          }
        )
      ),
      /* @__PURE__ */ React3.createElement(StageTag, { theme, tone: "after" }, "After"),
      /* @__PURE__ */ React3.createElement("span", { style: { position: "absolute", top: 0, right: 0, width: "5.5rem", height: "3rem", pointerEvents: "none" } }, /* @__PURE__ */ React3.createElement(StageTag, { theme, tone: "before" }, "Before")),
      /* @__PURE__ */ React3.createElement(
        "div",
        {
          "aria-hidden": true,
          style: {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${position}%`,
            width: "2px",
            transform: "translateX(-1px)",
            background: hsl(theme.colors.background),
            pointerEvents: "none"
          }
        },
        /* @__PURE__ */ React3.createElement(
          "span",
          {
            className: "ba-knob",
            style: {
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "2.75rem",
              height: "2.75rem",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              fontWeight: 700,
              background: hsl(theme.colors.background),
              color: hsl(theme.colors.foreground),
              border: `1px solid ${hsl(theme.colors.border)}`,
              boxShadow: `0 2px 10px ${hsl(theme.colors.foreground)}33`
            }
          },
          "\u2194"
        )
      ),
      /* @__PURE__ */ React3.createElement(
        "input",
        {
          type: "range",
          min: 0,
          max: 100,
          value: position,
          "aria-label": "Reveal the finished result",
          "aria-valuetext": `${position}% after`,
          onChange: (event) => setPosition(Number(event.target.value)),
          className: "ba-range",
          style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize", margin: 0 }
        }
      ),
      /* @__PURE__ */ React3.createElement("style", null, `.ba-range:focus-visible ~ .ba-focus{opacity:1}`),
      /* @__PURE__ */ React3.createElement(
        "span",
        {
          "aria-hidden": true,
          className: "ba-focus",
          style: { position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, outline: `2px solid ${hsl(theme.colors.primary)}`, outlineOffset: "-4px", borderRadius: theme.radius }
        }
      )
    ), /* @__PURE__ */ React3.createElement(
      "p",
      {
        className: "mt-2 text-center text-xs",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      "Drag the handle to compare"
    ), (pair.label || pair.description) && /* @__PURE__ */ React3.createElement(
      "figcaption",
      {
        className: "mt-4 text-center text-sm",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      [pair.label, pair.description].filter(Boolean).join(" \u2014 ")
    ))
  );
};

// src/sections/variants/beforeAfter/BeforeAfterGrid.tsx
import React4 from "react";
var BeforeAfterGrid = ({ section, theme }) => {
  const pairs = normalizePairs(section.props.items);
  return /* @__PURE__ */ React4.createElement(
    BeforeAfterFrame,
    {
      variantId: "before-after:grid",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React4.createElement("div", { className: "grid gap-8 sm:grid-cols-2" }, pairs.map((pair, i) => /* @__PURE__ */ React4.createElement(
      "figure",
      {
        key: i,
        className: "m-0 overflow-hidden",
        style: {
          borderRadius: theme.radius,
          border: `1px solid ${hsl(theme.colors.border)}`,
          background: hsl(theme.colors.card)
        }
      },
      /* @__PURE__ */ React4.createElement("div", { className: "grid grid-cols-2" }, /* @__PURE__ */ React4.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React4.createElement(
        "img",
        {
          src: pair.before,
          alt: `${pair.label || "Result"} before`,
          loading: "lazy",
          style: { aspectRatio: "1 / 1", width: "100%", objectFit: "cover" }
        }
      ), /* @__PURE__ */ React4.createElement(StageTag, { theme, tone: "before" }, "Before")), /* @__PURE__ */ React4.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React4.createElement(
        "img",
        {
          src: pair.after,
          alt: `${pair.label || "Result"} after`,
          loading: "lazy",
          style: { aspectRatio: "1 / 1", width: "100%", objectFit: "cover" }
        }
      ), /* @__PURE__ */ React4.createElement(StageTag, { theme, tone: "after" }, "After"))),
      (pair.label || pair.description) && /* @__PURE__ */ React4.createElement(
        "figcaption",
        {
          className: "p-4 text-sm",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        [pair.label, pair.description].filter(Boolean).join(" \u2014 ")
      )
    )))
  );
};

// src/sections/variants/beforeAfter/BeforeAfterCaseStudy.tsx
import React5 from "react";
var BeforeAfterCaseStudy = ({ section, theme }) => {
  const pairs = normalizePairs(section.props.items);
  return /* @__PURE__ */ React5.createElement(
    BeforeAfterFrame,
    {
      variantId: "before-after:case-study",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline,
      surface: "background"
    },
    /* @__PURE__ */ React5.createElement("div", { className: "flex flex-col gap-14" }, pairs.map((pair, i) => /* @__PURE__ */ React5.createElement("article", { key: i, className: "grid items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" }, /* @__PURE__ */ React5.createElement("div", { className: "grid grid-cols-2 gap-3" }, /* @__PURE__ */ React5.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React5.createElement(
      "img",
      {
        src: pair.before,
        alt: `${pair.label || "Case study"} before`,
        loading: "lazy",
        style: { aspectRatio: "3 / 4", width: "100%", objectFit: "cover", borderRadius: theme.radius }
      }
    ), /* @__PURE__ */ React5.createElement(StageTag, { theme, tone: "before" }, "Before")), /* @__PURE__ */ React5.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React5.createElement(
      "img",
      {
        src: pair.after,
        alt: `${pair.label || "Case study"} after`,
        loading: "lazy",
        style: { aspectRatio: "3 / 4", width: "100%", objectFit: "cover", borderRadius: theme.radius }
      }
    ), /* @__PURE__ */ React5.createElement(StageTag, { theme, tone: "after" }, "After"))), /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement(
      "h3",
      {
        className: "mb-3 text-2xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      pair.label || `Transformation ${i + 1}`
    ), /* @__PURE__ */ React5.createElement(
      "p",
      {
        className: "text-base leading-relaxed",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      pair.description || "A considered plan, careful execution and a finish the client can maintain."
    )))))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "before-after:reveal-panel": BeforeAfterRevealPanel, "before-after:slider": BeforeAfterSlider, "before-after:grid": BeforeAfterGrid, "before-after:case-study": BeforeAfterCaseStudy };
export {
  REGISTERED_VARIANTS
};
