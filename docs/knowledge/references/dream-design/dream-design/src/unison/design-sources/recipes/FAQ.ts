/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;

// src/sections/variants/shared/editorialStyles.ts
var editorialCardStyle = (theme) => ({
  border: `1px solid ${hsl(theme.colors.border)}`,
  borderRadius: theme.radius,
  background: hsl(theme.colors.card),
  color: hsl(theme.colors.cardForeground)
});

// src/sections/variants/faq/FAQSearchable.tsx
import React3, { useId, useState } from "react";

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

// src/sections/variants/faq/FAQFrame.tsx
import React2 from "react";
var normalizeFaqItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw || {};
    const question = String(item.question ?? item.title ?? "").trim();
    const answer = String(item.answer ?? item.body ?? item.description ?? "").trim();
    if (!question) return null;
    return { question, answer };
  }).filter(Boolean);
};
var FAQFrame = ({ variantId, theme, headline, subheadline, surface = "background", children }) => /* @__PURE__ */ React2.createElement(
  "section",
  {
    "data-ut-variant": variantId,
    style: {
      padding: theme.sectionPadding,
      background: hsl(surface === "muted" ? theme.colors.muted : theme.colors.background)
    }
  },
  /* @__PURE__ */ React2.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, (headline || subheadline) && /* @__PURE__ */ React2.createElement("div", { className: "mb-8 text-center md:mb-12" }, headline && /* @__PURE__ */ React2.createElement(
    "h2",
    {
      "data-ut-slot": "faq.headline",
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
      "data-ut-slot": "faq.subheadline",
      className: "mx-auto max-w-2xl text-base",
      style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
    },
    subheadline
  )), children)
);

// src/sections/variants/faq/FAQSearchable.tsx
function FAQSearchable({ section, theme }) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const items = normalizeFaqItems(section.props.items);
  const term = query.trim().toLowerCase();
  const matches = items.map((item, index) => ({ ...item, index })).filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(term));
  return /* @__PURE__ */ React3.createElement(
    EditorialSection,
    {
      variantId: "faq:searchable",
      theme,
      headline: section.props.headline,
      description: section.props.subheadline
    },
    /* @__PURE__ */ React3.createElement("div", { className: "grid items-start gap-8 lg:grid-cols-[1fr_2fr]" }, /* @__PURE__ */ React3.createElement("div", { className: "p-6", style: editorialCardStyle(theme) }, /* @__PURE__ */ React3.createElement("label", { htmlFor: searchId, className: "block text-sm font-medium" }, "Search questions"), /* @__PURE__ */ React3.createElement(
      "input",
      {
        id: searchId,
        type: "search",
        value: query,
        onChange: (event) => setQuery(event.target.value),
        placeholder: "Try a topic or keyword",
        className: "mt-3 min-h-12 w-full border p-3 text-sm",
        style: { ...editorialCardStyle(theme), background: hsl(theme.colors.background) }
      }
    ), /* @__PURE__ */ React3.createElement("p", { role: "status", className: "mt-4 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, matches.length, " ", matches.length === 1 ? "answer" : "answers")), /* @__PURE__ */ React3.createElement("div", { className: "space-y-3" }, matches.length ? matches.map((item) => /* @__PURE__ */ React3.createElement(
      "details",
      {
        key: item.index,
        "data-ut-slot": `question-${item.index}`,
        className: "p-6",
        style: editorialCardStyle(theme)
      },
      /* @__PURE__ */ React3.createElement("summary", { className: "cursor-pointer text-lg font-medium" }, item.question),
      /* @__PURE__ */ React3.createElement(
        "p",
        {
          "data-ut-slot": `faq.answer`,
          className: "mt-4 whitespace-pre-line leading-relaxed",
          style: { color: hsl(theme.colors.mutedForeground) }
        },
        item.answer
      )
    )) : /* @__PURE__ */ React3.createElement("p", { className: "py-6" }, "No matching questions. Try a different search.")))
  );
}

// src/sections/variants/faq/FAQEditorial.tsx
import React4 from "react";
function FAQEditorial({ section, theme }) {
  return /* @__PURE__ */ React4.createElement(
    EditorialSection,
    {
      variantId: "faq:editorial",
      theme,
      headline: section.props.headline,
      description: section.props.subheadline
    },
    /* @__PURE__ */ React4.createElement("div", { className: "grid items-start gap-x-12 md:grid-cols-2" }, normalizeFaqItems(section.props.items).map((item, index) => /* @__PURE__ */ React4.createElement(
      "details",
      {
        key: index,
        "data-ut-slot": `question-${index}`,
        className: "border-t py-6",
        style: { borderColor: hsl(theme.colors.border) }
      },
      /* @__PURE__ */ React4.createElement("summary", { className: "cursor-pointer text-lg font-medium" }, /* @__PURE__ */ React4.createElement(
        "span",
        {
          className: "mr-4 text-xs tabular-nums",
          style: { color: hsl(theme.colors.mutedForeground) }
        },
        String(index + 1).padStart(2, "0")
      ), item.question),
      /* @__PURE__ */ React4.createElement(
        "p",
        {
          "data-ut-slot": `faq.answer`,
          className: "mt-5 whitespace-pre-line leading-relaxed",
          style: { color: hsl(theme.colors.mutedForeground) }
        },
        item.answer
      )
    )))
  );
}

// src/sections/variants/faq/FAQAccordion.tsx
import React5 from "react";
var FAQAccordion = ({ section, theme }) => {
  const items = normalizeFaqItems(section.props.items);
  return /* @__PURE__ */ React5.createElement(
    FAQFrame,
    {
      variantId: "faq:accordion",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React5.createElement("div", { className: "mx-auto max-w-3xl" }, items.map((item, i) => /* @__PURE__ */ React5.createElement(
      "details",
      {
        key: i,
        className: "mb-3 p-6",
        style: {
          background: hsl(theme.colors.card),
          color: hsl(theme.colors.cardForeground),
          border: `1px solid ${hsl(theme.colors.border)}`,
          borderRadius: theme.radius
        }
      },
      /* @__PURE__ */ React5.createElement(
        "summary",
        {
          className: "cursor-pointer list-none text-base font-semibold",
          style: { fontFamily: theme.typography.headingFont }
        },
        item.question
      ),
      /* @__PURE__ */ React5.createElement(
        "p",
        {
          "data-ut-slot": `faq.answer`,
          className: "mt-3 text-sm leading-relaxed",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        item.answer
      )
    )))
  );
};

// src/sections/variants/faq/FAQTwoColumn.tsx
import React6 from "react";
var FAQTwoColumn = ({ section, theme }) => {
  const items = normalizeFaqItems(section.props.items);
  return /* @__PURE__ */ React6.createElement(
    FAQFrame,
    {
      variantId: "faq:two-column",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline,
      surface: "muted"
    },
    /* @__PURE__ */ React6.createElement("div", { className: "grid gap-x-12 gap-y-8 md:grid-cols-2" }, items.map((item, i) => /* @__PURE__ */ React6.createElement("div", { key: i, style: { borderTop: `1px solid ${hsl(theme.colors.border)}`, paddingTop: "1.25rem" } }, /* @__PURE__ */ React6.createElement(
      "h3",
      {
        "data-ut-slot": `faq.question`,
        className: "mb-2 text-base font-semibold",
        style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
      },
      item.question
    ), /* @__PURE__ */ React6.createElement(
      "p",
      {
        "data-ut-slot": `faq.answer`,
        className: "text-sm leading-relaxed",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      item.answer
    ))))
  );
};

// src/sections/variants/faq/FAQCards.tsx
import React7 from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Search = __LucideIcons['Search'] || __LucideFallback;
var FAQCards = ({ section, theme }) => {
  const items = normalizeFaqItems(section.props.items);
  const cols = items.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return /* @__PURE__ */ React7.createElement(
    FAQFrame,
    {
      variantId: "faq:cards",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React7.createElement("div", { className: `grid gap-6 ${cols}` }, items.map((item, i) => /* @__PURE__ */ React7.createElement(
      "div",
      {
        key: i,
        className: "h-full p-8",
        style: {
          background: hsl(theme.colors.card),
          color: hsl(theme.colors.cardForeground),
          border: `1px solid ${hsl(theme.colors.border)}`,
          borderRadius: theme.radius
        }
      },
      /* @__PURE__ */ React7.createElement("h3", { "data-ut-slot": `faq.question`, className: "mb-3 text-base font-semibold", style: { fontFamily: theme.typography.headingFont } }, item.question),
      /* @__PURE__ */ React7.createElement(
        "p",
        {
          "data-ut-slot": `faq.answer`,
          className: "text-sm leading-relaxed",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        item.answer
      )
    )))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "faq:searchable": FAQSearchable, "faq:editorial": FAQEditorial, "faq:accordion": FAQAccordion, "faq:two-column": FAQTwoColumn, "faq:cards": FAQCards };
export {
  REGISTERED_VARIANTS
};
