/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/logoCloud/LogoCloudCinematic.tsx
import React2 from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;

// src/sections/variants/logoCloud/LogoCloudFrame.tsx
import React from "react";
var normalizeLogos = (logos, items) => {
  const source = Array.isArray(logos) && logos.length ? logos : Array.isArray(items) ? items : [];
  return source.map((raw) => {
    if (typeof raw === "string") return raw.trim() ? { name: raw.trim() } : null;
    const entry = raw || {};
    const name = String(entry.name ?? entry.label ?? entry.title ?? "").trim();
    const src = entry.src ? String(entry.src) : entry.image ? String(entry.image) : void 0;
    if (!name && !src) return null;
    return { name, src };
  }).filter(Boolean);
};
var LogoMark = ({
  theme,
  logo,
  height = "2rem"
}) => logo.src ? /* @__PURE__ */ React.createElement(
  "img",
  {
    src: logo.src,
    alt: logo.name || "",
    loading: "lazy",
    style: { height, width: "auto", objectFit: "contain" }
  }
) : /* @__PURE__ */ React.createElement(
  "span",
  {
    "data-ut-slot": `logo-cloud.name`,
    style: {
      fontFamily: theme.typography.headingFont,
      fontWeight: theme.typography.headingWeight,
      fontSize: "1.125rem",
      letterSpacing: "0.02em",
      color: hsl(theme.colors.mutedForeground)
    }
  },
  logo.name
);
var LogoCloudFrame = ({ variantId, theme, headline, surface = "muted", children }) => /* @__PURE__ */ React.createElement(
  "section",
  {
    "data-ut-variant": variantId,
    style: {
      padding: theme.sectionPadding,
      background: hsl(surface === "muted" ? theme.colors.muted : theme.colors.background),
      borderTop: `1px solid ${hsl(theme.colors.border)}`,
      borderBottom: `1px solid ${hsl(theme.colors.border)}`
    }
  },
  /* @__PURE__ */ React.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React.createElement(
    "p",
    {
      "data-ut-slot": "logo-cloud.headline",
      className: "mb-10 text-center text-xs uppercase",
      style: {
        fontFamily: theme.typography.bodyFont,
        letterSpacing: "0.18em",
        color: hsl(theme.colors.mutedForeground)
      }
    },
    headline
  ), children)
);

// src/sections/variants/logoCloud/LogoCloudCinematic.tsx
var LogoCloudCinematic = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos);
  return /* @__PURE__ */ React2.createElement(LogoCloudFrame, { variantId: "logo-cloud:cinematic", theme, headline: section.props.headline, surface: "background" }, /* @__PURE__ */ React2.createElement("ul", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4", style: { borderTop: `1px solid ${hsl(theme.colors.border)}`, borderLeft: `1px solid ${hsl(theme.colors.border)}` } }, logos.map((l, i) => /* @__PURE__ */ React2.createElement("li", { key: i, className: "group flex h-24 items-center justify-center md:h-32", style: { borderRight: `1px solid ${hsl(theme.colors.border)}`, borderBottom: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React2.createElement("span", { className: "opacity-50 grayscale motion-safe:transition-[opacity,filter] motion-safe:duration-500 group-hover:opacity-100 group-hover:grayscale-0" }, /* @__PURE__ */ React2.createElement(LogoMark, { theme, logo: l }))))));
};

// src/sections/variants/logoCloud/LogoCloudStaticGrid.tsx
import React3 from "react";
var LogoCloudStaticGrid = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos);
  return /* @__PURE__ */ React3.createElement(LogoCloudFrame, { variantId: "logo-cloud:static-grid", theme, headline: section.props.headline }, /* @__PURE__ */ React3.createElement("ul", { className: "grid grid-cols-2 items-center gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-6" }, logos.map((l, i) => /* @__PURE__ */ React3.createElement("li", { key: i, className: "flex justify-center" }, /* @__PURE__ */ React3.createElement(LogoMark, { theme, logo: l, height: "1.75rem" })))));
};

// src/sections/variants/logoCloud/LogoCloudRevealTiles.tsx
import React4 from "react";
var LogoCloudRevealTiles = ({ section, theme }) => /* @__PURE__ */ React4.createElement(LogoCloudFrame, { variantId: "logo-cloud:reveal-tiles", theme, headline: section.props.headline }, /* @__PURE__ */ React4.createElement("div", { className: "grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6", style: { background: hsl(theme.colors.border) } }, normalizeLogos(section.props.logos, section.props.items).map((logo, i) => /* @__PURE__ */ React4.createElement("div", { key: i, className: "flex min-h-24 items-center justify-center px-5 py-7", style: { background: hsl(theme.colors.background) } }, /* @__PURE__ */ React4.createElement("div", { className: "transition-transform hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" }, /* @__PURE__ */ React4.createElement(LogoMark, { theme, logo }))))));

// src/sections/variants/logoCloud/LogoCloudGrid.tsx
import React5 from "react";
var LogoCloudGrid = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, section.props.items);
  return /* @__PURE__ */ React5.createElement(LogoCloudFrame, { variantId: "logo-cloud:grid", theme, headline: section.props.headline }, /* @__PURE__ */ React5.createElement("div", { className: "grid grid-cols-2 items-center gap-8 sm:grid-cols-3 md:grid-cols-5" }, logos.map((logo, i) => /* @__PURE__ */ React5.createElement(
    "div",
    {
      key: i,
      className: "flex items-center justify-center py-4",
      style: { borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}` }
    },
    /* @__PURE__ */ React5.createElement(LogoMark, { theme, logo })
  ))));
};

// src/sections/variants/logoCloud/LogoCloudMarquee.tsx
import React6 from "react";
var LogoCloudMarquee = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, section.props.items);
  const track = logos.length ? [...logos, ...logos] : [];
  return /* @__PURE__ */ React6.createElement(
    LogoCloudFrame,
    {
      variantId: "logo-cloud:marquee",
      theme,
      headline: section.props.headline,
      surface: "background"
    },
    /* @__PURE__ */ React6.createElement("div", { style: { overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, hsl(var(--primary)) 8%, hsl(var(--primary)) 92%, transparent)" } }, /* @__PURE__ */ React6.createElement(
      "div",
      {
        className: "ut-logo-marquee flex w-max items-center gap-10 md:gap-16"
      },
      track.map((logo, i) => /* @__PURE__ */ React6.createElement("div", { key: i, "aria-hidden": i >= logos.length || void 0, className: `flex shrink-0 items-center${i >= logos.length ? " ut-logo-dup" : ""}`, style: { opacity: 0.75 } }, /* @__PURE__ */ React6.createElement(LogoMark, { theme, logo })))
    )),
    /* @__PURE__ */ React6.createElement("style", null, "@keyframes ut-logo-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: no-preference){.ut-logo-marquee{animation:ut-logo-marquee 28s linear infinite}}@media (prefers-reduced-motion: reduce){.ut-logo-marquee{flex-wrap:wrap;width:auto;justify-content:center}.ut-logo-dup{display:none}}")
  );
};

// src/sections/variants/logoCloud/LogoCloudBrandLockup.tsx
import React7 from "react";
var LogoCloudBrandLockup = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, section.props.items);
  return /* @__PURE__ */ React7.createElement(LogoCloudFrame, { variantId: "logo-cloud:brand-lockup", theme }, /* @__PURE__ */ React7.createElement("div", { className: "grid items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]" }, /* @__PURE__ */ React7.createElement(
    "p",
    {
      className: "text-2xl",
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground)
      }
    },
    section.props.headline || "Trusted by teams who care about the details"
  ), /* @__PURE__ */ React7.createElement("div", { className: "grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3" }, logos.map((logo, i) => /* @__PURE__ */ React7.createElement(
    "div",
    {
      key: i,
      className: "flex items-center justify-start",
      style: { paddingBottom: "0.75rem", borderBottom: `1px solid ${hsl(theme.colors.border)}` }
    },
    /* @__PURE__ */ React7.createElement(LogoMark, { theme, logo, height: "1.75rem" })
  )))));
};

// src/sections/variants/logoCloud/LogoCloudWordmarkRow.tsx
import React8 from "react";
var LogoCloudWordmarkRow = ({ section, theme }) => {
  const logos = normalizeLogos(section.props.logos, section.props.items);
  return /* @__PURE__ */ React8.createElement(LogoCloudFrame, { variantId: "logo-cloud:wordmark-row", theme, headline: section.props.headline }, /* @__PURE__ */ React8.createElement(
    "div",
    {
      className: "flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-4 pt-8 sm:pt-10",
      style: { borderTop: `1px solid ${hsl(theme.colors.border)}` }
    },
    logos.map((logo, i) => /* @__PURE__ */ React8.createElement("div", { key: i, className: "flex items-center justify-center opacity-70" }, /* @__PURE__ */ React8.createElement(LogoMark, { theme, logo, height: "1.5rem" })))
  ));
};

// <stdin>
var REGISTERED_VARIANTS = { "logo-cloud:cinematic": LogoCloudCinematic, "logo-cloud:static-grid": LogoCloudStaticGrid, "logo-cloud:reveal-tiles": LogoCloudRevealTiles, "logo-cloud:grid": LogoCloudGrid, "logo-cloud:marquee": LogoCloudMarquee, "logo-cloud:brand-lockup": LogoCloudBrandLockup, "logo-cloud:wordmark-row": LogoCloudWordmarkRow };
export {
  REGISTERED_VARIANTS
};
