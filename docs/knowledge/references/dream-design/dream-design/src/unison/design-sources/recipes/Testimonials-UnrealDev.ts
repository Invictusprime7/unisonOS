/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/testimonials/TestimonialsColumns.tsx
import React2, { useState } from "react";

// src/sections/variants/testimonials/TestimonialsFrame.tsx
import React from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;

// src/sections/variants/testimonials/TestimonialsFrame.tsx
var normalizeTestimonials = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw || {};
    const quote = String(item.quote ?? item.text ?? item.body ?? "").trim();
    if (!quote) return null;
    return {
      quote,
      author: String(item.author ?? item.name ?? "").trim(),
      role: item.role ? String(item.role) : item.title ? String(item.title) : void 0,
      avatar: item.avatar ? String(item.avatar) : void 0,
      rating: typeof item.rating === "number" ? Math.max(0, Math.min(5, Math.round(item.rating))) : void 0
    };
  }).filter(Boolean);
};
var Stars = ({ rating, theme }) => {
  if (!rating) return null;
  return /* @__PURE__ */ React.createElement("div", { "aria-label": `${rating} out of 5`, className: "mb-4 text-sm", style: { color: hsl(theme.colors.accent) } }, "\u2605".repeat(rating), /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.35 } }, "\u2605".repeat(Math.max(0, 5 - rating))));
};
var TestimonialCard = ({ item, theme, className = "", emphasis }) => /* @__PURE__ */ React.createElement(
  "figure",
  {
    className: `m-0 flex h-full flex-col justify-between p-8 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`,
    style: {
      background: hsl(theme.colors.card),
      color: hsl(theme.colors.cardForeground),
      border: `1px solid ${hsl(theme.colors.border)}`,
      borderRadius: theme.radius
    }
  },
  /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(Stars, { rating: item.rating, theme }), /* @__PURE__ */ React.createElement(
    "blockquote",
    {
      className: emphasis ? "mb-6 text-2xl leading-relaxed" : "mb-6 text-base leading-relaxed",
      style: {
        fontFamily: emphasis ? theme.typography.headingFont : theme.typography.bodyFont,
        fontWeight: emphasis ? theme.typography.headingWeight : theme.typography.bodyWeight
      }
    },
    "\u201C",
    item.quote,
    "\u201D"
  )),
  /* @__PURE__ */ React.createElement("figcaption", { className: "flex items-center gap-3" }, item.avatar && /* @__PURE__ */ React.createElement(
    "img",
    {
      src: item.avatar,
      alt: "",
      "aria-hidden": "true",
      loading: "lazy",
      className: "h-10 w-10 rounded-full object-cover"
    }
  ), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { "data-ut-slot": `testimonials.author`, className: "block text-sm font-semibold", style: { fontFamily: theme.typography.headingFont } }, item.author), item.role && /* @__PURE__ */ React.createElement("span", { "data-ut-slot": `testimonials.role`, className: "block text-xs", style: { color: hsl(theme.colors.mutedForeground) } }, item.role)))
);
var TestimonialsFrame = ({ variantId, theme, headline, subheadline, surface = "background", children }) => /* @__PURE__ */ React.createElement(
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
      "data-ut-slot": "testimonials.headline",
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
      "data-ut-slot": "testimonials.subheadline",
      className: "mx-auto max-w-2xl text-base",
      style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
    },
    subheadline
  )), children)
);

// src/sections/variants/testimonials/TestimonialsColumns.tsx
function TestimonialsColumns({ section, theme }) {
  const [playing, setPlaying] = useState(false);
  const items = normalizeTestimonials(section.props.items);
  const count = Math.min(3, Math.max(1, items.length));
  const columns = Array.from({ length: count }, (_, column) => items.filter((_2, index) => index % count === column));
  return /* @__PURE__ */ React2.createElement(TestimonialsFrame, { variantId: "testimonials:columns", theme, headline: section.props.headline, subheadline: section.props.subheadline }, /* @__PURE__ */ React2.createElement("style", null, `@keyframes ut-proof-columns{to{transform:translateY(-50%)}}.ut-proof-columns{display:grid;gap:1.5rem}.ut-proof-duplicate{display:none}@media(min-width:768px) and (prefers-reduced-motion:no-preference){[data-proof-playing=true]{max-height:42rem;overflow:hidden}[data-proof-playing=true] .ut-proof-columns{animation:ut-proof-columns 28s linear infinite}[data-proof-playing=true] .ut-proof-duplicate{display:block}[data-proof-playing=true]:hover .ut-proof-columns,[data-proof-playing=true]:focus-within .ut-proof-columns{animation-play-state:paused}}`), items.length > 3 && /* @__PURE__ */ React2.createElement("button", { "data-ut-intent": "ui.toggle", type: "button", "aria-pressed": playing, onClick: () => setPlaying((value) => !value), className: "mb-6 hidden rounded-full border px-4 py-2 text-sm md:inline-flex motion-reduce:hidden" }, playing ? "Pause testimonials" : "Animate testimonials"), /* @__PURE__ */ React2.createElement("div", { "data-proof-playing": playing, className: "grid gap-6 md:grid-cols-3" }, columns.map((column, index) => /* @__PURE__ */ React2.createElement("div", { key: index, className: "min-w-0" }, /* @__PURE__ */ React2.createElement("div", { className: "ut-proof-columns" }, column.map((item, itemIndex) => /* @__PURE__ */ React2.createElement("div", { key: itemIndex, "data-ut-slot": "testimonial-" + (itemIndex * count + index) }, /* @__PURE__ */ React2.createElement(TestimonialCard, { item, theme }))), column.map((item, itemIndex) => /* @__PURE__ */ React2.createElement("div", { key: "duplicate-" + itemIndex, "aria-hidden": "true", className: "ut-proof-duplicate" }, /* @__PURE__ */ React2.createElement(TestimonialCard, { item, theme }))))))));
}

// src/sections/variants/testimonials/TestimonialsMarquee.tsx
import React3 from "react";
var MARQUEE_CSS = `
@keyframes utMarqueeLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes utMarqueeRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
[data-ut-variant="testimonials:marquee"] .ut-marquee-a { animation: utMarqueeLeft 42s linear infinite; }
[data-ut-variant="testimonials:marquee"] .ut-marquee-b { animation: utMarqueeRight 52s linear infinite; }
[data-ut-variant="testimonials:marquee"] .ut-marquee-track:hover { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="testimonials:marquee"] .ut-marquee-track { animation: none; transform: none; }
  [data-ut-variant="testimonials:marquee"] .ut-marquee-row { overflow-x: auto; }
}
`;
var TestimonialsMarquee = ({ section, theme }) => {
  const { headline, subheadline, items } = section.props;
  const testimonials = normalizeTestimonials(items);
  if (!testimonials.length) return null;
  const half = Math.ceil(testimonials.length / 2);
  const rows = [testimonials.slice(0, half), testimonials.slice(half).length ? testimonials.slice(half) : testimonials];
  return /* @__PURE__ */ React3.createElement(
    TestimonialsFrame,
    {
      variantId: "testimonials:marquee",
      theme,
      headline,
      subheadline,
      surface: "muted"
    },
    /* @__PURE__ */ React3.createElement("style", null, MARQUEE_CSS),
    /* @__PURE__ */ React3.createElement("div", { className: "relative flex flex-col gap-6 overflow-hidden" }, rows.map((row, r) => /* @__PURE__ */ React3.createElement("div", { key: r, className: "ut-marquee-row overflow-hidden" }, /* @__PURE__ */ React3.createElement("div", { className: `ut-marquee-track flex w-max gap-6 ${r === 0 ? "ut-marquee-a" : "ut-marquee-b"}` }, [...row, ...row].map((item, i) => /* @__PURE__ */ React3.createElement("div", { key: i, className: "w-[320px] shrink-0" }, /* @__PURE__ */ React3.createElement(TestimonialCard, { item, theme })))))), /* @__PURE__ */ React3.createElement(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-y-0 left-0 w-24",
        style: { background: `linear-gradient(to right, ${hsl(theme.colors.muted)}, transparent)` }
      }
    ), /* @__PURE__ */ React3.createElement(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-y-0 right-0 w-24",
        style: { background: `linear-gradient(to left, ${hsl(theme.colors.muted)}, transparent)` }
      }
    ))
  );
};

// src/sections/variants/testimonials/TestimonialsEditorial.tsx
import React4 from "react";
var TestimonialsEditorial = ({ section, theme }) => {
  const p = section.props;
  const [lead, ...rest] = p.items || [];
  return /* @__PURE__ */ React4.createElement("section", { "data-ut-variant": "testimonials:editorial", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React4.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React4.createElement("div", { className: "mb-10 md:mb-14" }, p.headline && /* @__PURE__ */ React4.createElement("h2", { "data-ut-slot": "testimonials.headline", className: "text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.subheadline && /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": "testimonials.subheadline", className: "mt-3 max-w-2xl", style: { color: hsl(theme.colors.mutedForeground) } }, p.subheadline)), lead && /* @__PURE__ */ React4.createElement("figure", { className: "border-t pt-8 md:pt-12", style: { borderColor: hsl(theme.colors.foreground) } }, /* @__PURE__ */ React4.createElement("blockquote", { "data-ut-slot": "testimonial-0.quote", className: "max-w-4xl text-2xl leading-snug md:text-4xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, "\u201C", lead.quote, "\u201D"), /* @__PURE__ */ React4.createElement("figcaption", { className: "mt-6 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, /* @__PURE__ */ React4.createElement("span", { "data-ut-slot": "testimonial-0.author", style: { color: hsl(theme.colors.foreground) } }, lead.author), lead.role && /* @__PURE__ */ React4.createElement(React4.Fragment, null, " \u2014 ", lead.role))), /* @__PURE__ */ React4.createElement("div", { className: "mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3" }, rest.map((t, i) => /* @__PURE__ */ React4.createElement("figure", { key: i, className: "border-t pt-5", style: { borderColor: hsl(theme.colors.border) } }, /* @__PURE__ */ React4.createElement("blockquote", { "data-ut-slot": `testimonial-${i + 1}.quote`, className: "text-base", style: { color: hsl(theme.colors.foreground) } }, "\u201C", t.quote, "\u201D"), /* @__PURE__ */ React4.createElement("figcaption", { "data-ut-slot": `testimonial-${i + 1}.author`, className: "mt-3 text-xs uppercase tracking-[0.14em]", style: { color: hsl(theme.colors.mutedForeground) } }, t.author, t.role ? ` \xB7 ${t.role}` : ""))))));
};

// src/sections/variants/testimonials/TestimonialsVerticalMarquee.tsx
import React5 from "react";
var TestimonialsVerticalMarquee = ({ section, theme }) => {
  const p = section.props;
  const items = p.items || [];
  const cols = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)];
  const card = (t, k, hidden) => /* @__PURE__ */ React5.createElement("figure", { key: k, "aria-hidden": hidden || void 0, className: "p-6", style: { borderRadius: theme.radius, background: hsl(theme.colors.card), border: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React5.createElement("blockquote", { "data-ut-slot": hidden ? void 0 : `${k}.quote`, style: { color: hsl(theme.colors.cardForeground) } }, "\u201C", t.quote, "\u201D"), /* @__PURE__ */ React5.createElement("figcaption", { "data-ut-slot": hidden ? void 0 : `${k}.author`, className: "mt-4 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, t.author, t.role ? `, ${t.role}` : ""));
  return /* @__PURE__ */ React5.createElement("section", { "data-ut-variant": "testimonials:vertical-marquee", style: { padding: theme.sectionPadding, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React5.createElement("div", { className: "grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center" }, /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("div", { className: "mb-10 md:mb-14" }, p.headline && /* @__PURE__ */ React5.createElement("h2", { "data-ut-slot": "testimonials.headline", className: "text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.subheadline && /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": "testimonials.subheadline", className: "mt-3 max-w-2xl", style: { color: hsl(theme.colors.mutedForeground) } }, p.subheadline))), /* @__PURE__ */ React5.createElement("div", { className: "grid h-[28rem] gap-4 overflow-hidden sm:grid-cols-2 md:h-[36rem]", style: { maskImage: "linear-gradient(transparent,black 12%,black 88%,transparent)" } }, cols.map((col, c) => /* @__PURE__ */ React5.createElement("div", { key: c, className: `flex flex-col gap-4 motion-safe:animate-[ut-vmarquee_32s_linear_infinite] motion-reduce:animate-none ${c ? "hidden sm:flex motion-safe:[animation-direction:reverse]" : ""}` }, col.map((t, i) => card(t, `testimonial-${c}-${i}`)), /* @__PURE__ */ React5.createElement("div", { className: "flex flex-col gap-4 motion-reduce:hidden" }, col.map((t, i) => card(t, `dup-${c}-${i}`, true)))))))), /* @__PURE__ */ React5.createElement("style", null, `@keyframes ut-vmarquee{from{transform:translateY(0)}to{transform:translateY(-50%)}}`));
};

// src/sections/variants/testimonials/TestimonialsVoice.tsx
import React6 from "react";
var bars = [40, 70, 55, 90, 35, 80, 60, 45, 75, 50, 65, 30];
var TestimonialsVoice = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React6.createElement("section", { "data-ut-variant": "testimonials:voice", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React6.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React6.createElement("div", { className: "mb-10 md:mb-14" }, p.headline && /* @__PURE__ */ React6.createElement("h2", { "data-ut-slot": "testimonials.headline", className: "text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.subheadline && /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": "testimonials.subheadline", className: "mt-3 max-w-2xl", style: { color: hsl(theme.colors.mutedForeground) } }, p.subheadline)), /* @__PURE__ */ React6.createElement("div", { className: "grid gap-5 md:grid-cols-2" }, (p.items || []).map((t, i) => /* @__PURE__ */ React6.createElement("figure", { key: i, className: "flex gap-5 p-6", style: { borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React6.createElement("div", { "aria-hidden": "true", className: "flex h-14 shrink-0 items-center gap-[3px]" }, bars.map((h, b) => /* @__PURE__ */ React6.createElement("span", { key: b, className: "w-1 rounded-full", style: { height: `${h}%`, background: hsl(b % 3 ? theme.colors.border : theme.colors.accent) } }))), /* @__PURE__ */ React6.createElement("div", null, /* @__PURE__ */ React6.createElement("blockquote", { "data-ut-slot": `testimonial-${i}.quote`, style: { color: hsl(theme.colors.foreground) } }, "\u201C", t.quote, "\u201D"), /* @__PURE__ */ React6.createElement("figcaption", { "data-ut-slot": `testimonial-${i}.author`, className: "mt-3 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, t.author, t.role ? ` \xB7 ${t.role}` : "")))))));
};

// src/sections/variants/testimonials/TestimonialsGrid.tsx
import React7 from "react";
var TestimonialsGrid = ({ section, theme }) => {
  const items = normalizeTestimonials(section.props.items);
  const cols = items.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  return /* @__PURE__ */ React7.createElement(
    TestimonialsFrame,
    {
      variantId: "testimonials:grid",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React7.createElement("div", { className: `grid gap-6 ${cols}` }, items.map((item, i) => /* @__PURE__ */ React7.createElement("div", { key: i, "data-ut-slot": `testimonial-${i}` }, /* @__PURE__ */ React7.createElement(TestimonialCard, { item, theme }))))
  );
};

// src/sections/variants/testimonials/TestimonialsRail.tsx
import React8, { useRef } from "react";
var TestimonialsRail = ({ section, theme }) => {
  const items = normalizeTestimonials(section.props.items);
  const railRef = useRef(null);
  const scrollBy = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(320, rail.clientWidth * 0.8), behavior: "smooth" });
  };
  const controlStyle = {
    border: `1px solid ${hsl(theme.colors.border)}`,
    color: hsl(theme.colors.foreground),
    borderRadius: theme.radius
  };
  return /* @__PURE__ */ React8.createElement(
    TestimonialsFrame,
    {
      variantId: "testimonials:rail",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React8.createElement(
      "div",
      {
        ref: railRef,
        className: "flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4",
        role: "group",
        "aria-label": "Customer testimonials"
      },
      items.map((item, i) => /* @__PURE__ */ React8.createElement(
        TestimonialCard,
        {
          key: i,
          item,
          theme,
          className: "w-[var(--ut-carousel-card)] shrink-0 snap-start"
        }
      ))
    ),
    items.length > 1 && /* @__PURE__ */ React8.createElement("div", { className: "mt-6 flex justify-end gap-2" }, /* @__PURE__ */ React8.createElement("button", { "data-ut-intent": "ui.toggle", type: "button", onClick: () => scrollBy(-1), "aria-label": "Previous testimonials", className: "px-3 py-2 text-sm", style: controlStyle }, "\u2190"), /* @__PURE__ */ React8.createElement("button", { "data-ut-intent": "ui.toggle", type: "button", onClick: () => scrollBy(1), "aria-label": "Next testimonials", className: "px-3 py-2 text-sm", style: controlStyle }, "\u2192"))
  );
};

// src/sections/variants/testimonials/TestimonialsSpotlight.tsx
import React9 from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Pause = __LucideIcons['Pause'] || __LucideFallback;
var TestimonialsSpotlight = ({ section, theme }) => {
  const items = normalizeTestimonials(section.props.items);
  const [featured, ...rest] = items;
  if (!featured) return null;
  return /* @__PURE__ */ React9.createElement(
    TestimonialsFrame,
    {
      variantId: "testimonials:spotlight",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline,
      surface: "muted"
    },
    /* @__PURE__ */ React9.createElement(TestimonialCard, { item: featured, theme, emphasis: true, className: "mx-auto max-w-3xl text-center" }),
    rest.length > 0 && /* @__PURE__ */ React9.createElement("div", { className: "mt-8 grid gap-6 md:grid-cols-2" }, rest.slice(0, 4).map((item, i) => /* @__PURE__ */ React9.createElement(TestimonialCard, { key: i, item, theme })))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "testimonials:columns": TestimonialsColumns, "testimonials:marquee": TestimonialsMarquee, "testimonials:editorial": TestimonialsEditorial, "testimonials:vertical-marquee": TestimonialsVerticalMarquee, "testimonials:voice": TestimonialsVoice, "testimonials:grid": TestimonialsGrid, "testimonials:rail": TestimonialsRail, "testimonials:spotlight": TestimonialsSpotlight };
export {
  REGISTERED_VARIANTS
};
