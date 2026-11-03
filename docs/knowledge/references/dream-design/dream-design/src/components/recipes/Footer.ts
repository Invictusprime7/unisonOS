/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/footer/FooterBrandSocial.tsx
import React from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/footer/FooterBrandSocial.tsx
var FooterBrandSocial = ({ section, theme }) => {
  const { brand, columns = [], socials = [], copyright } = section.props;
  return /* @__PURE__ */ React.createElement(
    "footer",
    {
      "data-ut-variant": "footer:brand-social",
      style: { background: hsl(theme.colors.card), borderTop: `1px solid ${hsla(theme.colors.border, 0.6)}` }
    },
    /* @__PURE__ */ React.createElement("div", { className: "mx-auto px-6 py-16", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React.createElement("div", { className: "grid gap-12 md:grid-cols-[1.4fr_2fr]" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "block text-xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      brand
    ), socials.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "mt-5 flex flex-wrap items-center gap-2" }, socials.map((social, i) => /* @__PURE__ */ React.createElement(
      "a",
      {
        "data-ut-intent": "nav.goto",
        key: i,
        href: social.url,
        "aria-label": social.platform,
        "data-ut-slot": `social-${social.platform}`,
        className: "inline-flex h-9 items-center justify-center px-3 text-xs font-medium no-underline transition-opacity hover:opacity-80",
        style: {
          borderRadius: "9999px",
          border: `1px solid ${hsla(theme.colors.border, 0.7)}`,
          color: hsl(theme.colors.mutedForeground),
          fontFamily: theme.typography.bodyFont
        }
      },
      social.platform
    )))), /* @__PURE__ */ React.createElement("div", { className: "grid gap-8 sm:grid-cols-2 lg:grid-cols-3" }, columns.map((column, i) => /* @__PURE__ */ React.createElement("div", { key: i }, /* @__PURE__ */ React.createElement(
      "span",
      {
        "data-ut-slot": `footer.title`,
        className: "mb-3 block text-sm font-semibold",
        style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
      },
      column.title
    ), /* @__PURE__ */ React.createElement("ul", { className: "m-0 flex flex-col gap-2 p-0", style: { listStyle: "none" } }, column.links.map((link, j) => /* @__PURE__ */ React.createElement("li", { key: j }, /* @__PURE__ */ React.createElement(
      "a",
      {
        href: link.href,
        "data-ut-intent": link.intent ?? "nav.goto",
        className: "text-sm no-underline transition-opacity hover:opacity-80",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      link.label
    )))))))), /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "mt-12 flex flex-col gap-2 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between",
        style: { borderTop: `1px solid ${hsla(theme.colors.border, 0.5)}`, color: hsl(theme.colors.mutedForeground) }
      },
      /* @__PURE__ */ React.createElement("span", null, copyright || `\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${brand}. All rights reserved.`),
      /* @__PURE__ */ React.createElement("span", { style: { fontFamily: theme.typography.bodyFont } }, "Crafted with care.")
    ))
  );
};

// src/sections/variants/footer/FooterMultiColumn.tsx
import React2 from "react";
var FooterMultiColumn = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React2.createElement("footer", { "data-ut-variant": "footer:multi-column", style: { padding: "4rem 0 2rem", background: hsl(theme.colors.muted), borderTop: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React2.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React2.createElement("div", { className: "grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)]" }, /* @__PURE__ */ React2.createElement("div", { "data-ut-slot": "footer.brand" }, /* @__PURE__ */ React2.createElement("p", { className: "text-xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.brand), !!p.socials?.length && /* @__PURE__ */ React2.createElement("ul", { className: "mt-4 flex gap-4" }, p.socials.map((s, i) => /* @__PURE__ */ React2.createElement("li", { key: i }, /* @__PURE__ */ React2.createElement("a", { href: s.url, "data-ut-intent": "nav.goto", className: "text-sm capitalize underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2", style: { color: hsl(theme.colors.mutedForeground) } }, s.platform))))), (p.columns || []).map((col, i) => /* @__PURE__ */ React2.createElement("nav", { key: i, "aria-label": col.title, "data-ut-slot": "footer.links" }, /* @__PURE__ */ React2.createElement("p", { className: "mb-3 text-xs uppercase tracking-[0.14em]", style: { color: hsl(theme.colors.mutedForeground) } }, col.title), /* @__PURE__ */ React2.createElement("ul", { className: "space-y-2" }, col.links.map((l, k) => /* @__PURE__ */ React2.createElement("li", { key: k }, /* @__PURE__ */ React2.createElement("a", { href: l.href, "data-ut-intent": "nav.goto", className: "text-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2", style: { color: hsl(theme.colors.foreground) } }, l.label))))))), p.copyright && /* @__PURE__ */ React2.createElement("p", { "data-ut-slot": "footer.copyright", className: "mt-12 border-t pt-6 text-xs", style: { borderColor: hsl(theme.colors.border), color: hsl(theme.colors.mutedForeground) } }, p.copyright)));
};

// src/sections/variants/footer/FooterColumns.tsx
import React4 from "react";

// src/sections/components/SocialIcon.tsx
import React3 from "react";
import {
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  Github,
  Twitch,
  Dribbble,
  Figma,
  Globe
} from "../../unison/ui/icons";
var TikTokSvg = ({ size, color }) => /* @__PURE__ */ React3.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, "aria-hidden": "true" }, /* @__PURE__ */ React3.createElement("path", { d: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52V6.94a4.85 4.85 0 0 1-1.84-.25z" }));
var PinterestSvg = ({ size, color }) => /* @__PURE__ */ React3.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, "aria-hidden": "true" }, /* @__PURE__ */ React3.createElement("path", { d: "M12 0a12 12 0 0 0-4.37 23.17c-.06-.94-.11-2.38.02-3.4.12-.93 1.27-5.93 1.27-5.93s-.32-.65-.32-1.6c0-1.5.87-2.62 1.95-2.62.92 0 1.36.69 1.36 1.51 0 .92-.59 2.3-.89 3.58-.25 1.07.54 1.95 1.6 1.95 1.92 0 3.4-2.03 3.4-4.95 0-2.59-1.86-4.4-4.52-4.4-3.08 0-4.89 2.31-4.89 4.7 0 .93.36 1.93.81 2.47.09.11.1.2.07.32-.08.34-.27 1.07-.31 1.22-.05.2-.16.24-.37.15-1.38-.64-2.25-2.66-2.25-4.28 0-3.49 2.53-6.69 7.3-6.69 3.83 0 6.81 2.73 6.81 6.38 0 3.81-2.4 6.87-5.74 6.87-1.12 0-2.18-.58-2.54-1.27 0 0-.55 2.11-.69 2.62-.25.96-.93 2.17-1.39 2.9A12 12 0 1 0 12 0z" }));
var XSvg = ({ size, color }) => /* @__PURE__ */ React3.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: color, "aria-hidden": "true" }, /* @__PURE__ */ React3.createElement("path", { d: "M18.244 2H21l-6.52 7.45L22 22h-6.83l-4.79-6.27L4.8 22H2l6.97-7.97L2 2h6.91l4.34 5.75L18.24 2zm-1.2 18h1.66L7.05 4H5.27l11.77 16z" }));
var isComponent = (comp) => typeof comp === "function" || typeof comp === "object" && comp !== null;
var SocialIcon = ({
  platform,
  size = 18,
  className,
  color = "currentColor"
}) => {
  const key = (platform || "").toLowerCase().trim();
  const props = { size, className, color, "aria-hidden": true };
  const fallbackGlobe = /* @__PURE__ */ React3.createElement(Globe, { ...props });
  const fallbackX = /* @__PURE__ */ React3.createElement("span", { className }, /* @__PURE__ */ React3.createElement(XSvg, { size, color }));
  const fallbackTikTok = /* @__PURE__ */ React3.createElement("span", { className }, /* @__PURE__ */ React3.createElement(TikTokSvg, { size, color }));
  const fallbackPinterest = /* @__PURE__ */ React3.createElement("span", { className }, /* @__PURE__ */ React3.createElement(PinterestSvg, { size, color }));
  switch (key) {
    case "instagram":
    case "ig":
      return isComponent(Instagram) ? /* @__PURE__ */ React3.createElement(Instagram, { ...props }) : fallbackGlobe;
    case "facebook":
    case "fb":
    case "meta":
      return isComponent(Facebook) ? /* @__PURE__ */ React3.createElement(Facebook, { ...props }) : fallbackGlobe;
    case "twitter":
      return isComponent(Twitter) ? /* @__PURE__ */ React3.createElement(Twitter, { ...props }) : fallbackGlobe;
    case "x":
    case "x.com":
      return fallbackX;
    case "linkedin":
    case "in":
      return isComponent(Linkedin) ? /* @__PURE__ */ React3.createElement(Linkedin, { ...props }) : fallbackGlobe;
    case "youtube":
    case "yt":
      return isComponent(Youtube) ? /* @__PURE__ */ React3.createElement(Youtube, { ...props }) : fallbackGlobe;
    case "github":
    case "gh":
      return isComponent(Github) ? /* @__PURE__ */ React3.createElement(Github, { ...props }) : fallbackGlobe;
    case "twitch":
      return isComponent(Twitch) ? /* @__PURE__ */ React3.createElement(Twitch, { ...props }) : fallbackGlobe;
    case "dribbble":
      return isComponent(Dribbble) ? /* @__PURE__ */ React3.createElement(Dribbble, { ...props }) : fallbackGlobe;
    case "figma":
      return isComponent(Figma) ? /* @__PURE__ */ React3.createElement(Figma, { ...props }) : fallbackGlobe;
    case "tiktok":
      return fallbackTikTok;
    case "pinterest":
      return fallbackPinterest;
    default:
      return isComponent(Globe) ? /* @__PURE__ */ React3.createElement(Globe, { ...props }) : fallbackGlobe;
  }
};
var socialAriaLabel = (platform) => {
  const key = (platform || "").toLowerCase().trim();
  if (!key) return "Social link";
  return `Visit our ${key.charAt(0).toUpperCase()}${key.slice(1)} page`;
};

// src/sections/variants/footer/FooterColumns.tsx
var FooterColumns = ({ section, theme }) => {
  const { brand, columns = [], socials = [], copyright, newsletter } = section.props;
  const resolveHref = (rawHref, label) => {
    const href = (rawHref || "").trim();
    if (/^(https?:|mailto:|tel:|#\/)/i.test(href)) return href;
    if (href === "#" || href === "") {
      const slug = (label || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return slug ? `#/${slug}` : "#/";
    }
    if (href.startsWith("/")) return `#${href}`;
    if (href.startsWith("#")) return `#/${href.replace(/^#+/, "")}`;
    return `#/${href.replace(/^\/+/, "")}`;
  };
  return /* @__PURE__ */ React4.createElement(
    "footer",
    {
      "data-ut-variant": "footer:columns",
      className: "px-6",
      style: {
        overflowWrap: "anywhere",
        paddingTop: "3rem",
        paddingBottom: "1.5rem",
        background: hsl(theme.colors.card),
        borderTop: `1px solid ${hsla(theme.colors.border, 0.5)}`
      }
    },
    /* @__PURE__ */ React4.createElement("div", { className: "mx-auto", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React4.createElement(
      "div",
      {
        className: "grid grid-cols-1 gap-8 mb-8 sm:grid-cols-2 lg:grid-cols-[var(--ut-footer-columns)]",
        style: { "--ut-footer-columns": `repeat(${columns.length + 1}, minmax(0, 1fr))` }
      },
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement(
        "h3",
        {
          className: "text-lg mb-3",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.cardForeground)
          }
        },
        brand
      ), newsletter && /* @__PURE__ */ React4.createElement("form", { "data-demo-form": "true", "data-ut-intent": "newsletter.subscribe", className: "flex gap-2 mt-3" }, /* @__PURE__ */ React4.createElement(
        "input",
        {
          type: "email",
          "aria-label": "Email for newsletter",
          name: "email",
          required: true,
          placeholder: "your@email.com",
          className: "min-w-0 flex-1 text-sm px-3 py-2",
          style: {
            borderRadius: theme.radius,
            border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
            background: hsl(theme.colors.background),
            color: hsl(theme.colors.foreground),
            outline: "none"
          }
        }
      ), /* @__PURE__ */ React4.createElement(
        "button",
        {
          "data-ut-intent": "lead.capture",
          type: "submit",
          "data-ut-cta": "cta.newsletter-submit",
          className: "text-sm px-3 py-2 cursor-pointer hover:opacity-90",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius,
            border: "none"
          }
        },
        "Subscribe"
      ))),
      columns.map((col, i) => /* @__PURE__ */ React4.createElement("div", { key: i }, /* @__PURE__ */ React4.createElement(
        "h4",
        {
          "data-ut-slot": `footer.title`,
          className: "text-xs uppercase tracking-widest mb-3 font-semibold",
          style: { color: hsl(theme.colors.cardForeground) }
        },
        col.title
      ), /* @__PURE__ */ React4.createElement("ul", { className: "space-y-2" }, col.links.map((l, j) => /* @__PURE__ */ React4.createElement("li", { key: j }, /* @__PURE__ */ React4.createElement(
        "a",
        {
          href: resolveHref(l.href, l.label),
          "data-ut-intent": "nav.goto",
          "data-ut-nav-target": resolveHref(l.href, l.label),
          className: "text-sm hover:opacity-80 transition-opacity",
          style: { color: hsl(theme.colors.mutedForeground), textDecoration: "none" }
        },
        l.label
      ))))))
    ), /* @__PURE__ */ React4.createElement(
      "div",
      {
        className: "flex justify-between items-center pt-4",
        style: { borderTop: `1px solid ${hsla(theme.colors.border, 0.3)}` }
      },
      /* @__PURE__ */ React4.createElement("p", { className: "text-xs", style: { color: hsl(theme.colors.mutedForeground) } }, copyright || `\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${brand}. All rights reserved.`),
      socials.length > 0 && /* @__PURE__ */ React4.createElement("div", { className: "flex gap-3 items-center" }, socials.map((s, i) => {
        const hasUrl = s.url && s.url !== "#";
        return /* @__PURE__ */ React4.createElement(
          "a",
          {
            "data-ut-intent": "nav.goto",
            key: i,
            href: hasUrl ? s.url : void 0,
            target: hasUrl ? "_blank" : void 0,
            rel: hasUrl ? "noopener noreferrer" : void 0,
            "aria-label": socialAriaLabel(s.platform),
            className: "inline-flex items-center justify-center w-8 h-8 rounded-full hover:opacity-80 transition-opacity",
            style: { color: hsl(theme.colors.mutedForeground), textDecoration: "none" }
          },
          /* @__PURE__ */ React4.createElement(SocialIcon, { platform: s.platform, size: 16 })
        );
      }))
    ))
  );
};

// src/sections/variants/footer/FooterCenteredMinimal.tsx
import React5 from "react";
var FooterCenteredMinimal = ({ section, theme }) => {
  const { brand, columns = [], socials = [], copyright } = section.props;
  const allLinks = columns.flatMap((c) => c.links);
  return /* @__PURE__ */ React5.createElement(
    "footer",
    {
      "data-ut-variant": "footer:centered-minimal",
      style: {
        padding: "2.5rem 1rem",
        background: hsl(theme.colors.background),
        borderTop: `1px solid ${hsla(theme.colors.border, 0.4)}`,
        textAlign: "center"
      }
    },
    /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-5 sm:px-6", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React5.createElement(
      "h3",
      {
        "data-ut-slot": "footer.brand",
        className: "mb-4 text-lg md:text-xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      brand
    ), allLinks.length > 0 && /* @__PURE__ */ React5.createElement("nav", { "aria-label": "Footer", "data-ut-slot": "footer.links", className: "mb-5 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-5" }, allLinks.map((l, i) => /* @__PURE__ */ React5.createElement(
      "a",
      {
        "data-ut-intent": "nav.goto",
        key: i,
        href: l.href,
        className: "text-sm hover:opacity-80 transition-opacity",
        style: { color: hsl(theme.colors.mutedForeground), textDecoration: "none" }
      },
      l.label
    ))), socials.length > 0 && /* @__PURE__ */ React5.createElement("div", { className: "flex gap-4 justify-center mb-5 items-center" }, socials.map((s, i) => {
      const hasUrl = s.url && s.url !== "#";
      return /* @__PURE__ */ React5.createElement(
        "a",
        {
          "data-ut-intent": "nav.goto",
          key: i,
          href: hasUrl ? s.url : void 0,
          target: hasUrl ? "_blank" : void 0,
          rel: hasUrl ? "noopener noreferrer" : void 0,
          "aria-label": socialAriaLabel(s.platform),
          className: "inline-flex items-center justify-center w-8 h-8 rounded-full hover:opacity-80",
          style: { color: hsl(theme.colors.mutedForeground), textDecoration: "none" }
        },
        /* @__PURE__ */ React5.createElement(SocialIcon, { platform: s.platform, size: 18 })
      );
    })), /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": "footer.copyright", className: "text-xs", style: { color: hsl(theme.colors.mutedForeground) } }, copyright || `\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${brand}. All rights reserved.`))
  );
};

// src/sections/variants/footer/FooterDarkBand.tsx
import React6 from "react";
var FooterDarkBand = ({ section, theme }) => {
  const { brand, columns = [], socials = [], copyright, newsletter } = section.props;
  return /* @__PURE__ */ React6.createElement(
    "footer",
    {
      "data-ut-variant": "footer:dark-band",
      className: "px-6",
      style: {
        overflowWrap: "anywhere",
        paddingTop: "3.5rem",
        paddingBottom: "1.5rem",
        background: hsl(theme.colors.foreground),
        color: hsl(theme.colors.background)
      }
    },
    /* @__PURE__ */ React6.createElement("div", { className: "mx-auto", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React6.createElement("div", { className: "grid grid-cols-1 gap-8 mb-10 sm:grid-cols-2 lg:grid-cols-[var(--ut-footer-columns)]", style: { "--ut-footer-columns": `minmax(0, 2fr) ${columns.map(() => "minmax(0, 1fr)").join(" ")}` } }, /* @__PURE__ */ React6.createElement("div", null, /* @__PURE__ */ React6.createElement(
      "h3",
      {
        className: "text-xl mb-2",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight
        }
      },
      brand
    ), newsletter && /* @__PURE__ */ React6.createElement("form", { "data-demo-form": "true", "data-ut-intent": "newsletter.subscribe", className: "flex gap-2 mt-4", style: { maxWidth: "20rem" } }, /* @__PURE__ */ React6.createElement(
      "input",
      {
        type: "email",
        "aria-label": "Email for newsletter",
        name: "email",
        required: true,
        placeholder: "your@email.com",
        className: "min-w-0 flex-1 text-sm px-3 py-2",
        style: {
          borderRadius: theme.radius,
          border: `1px solid ${hsla(theme.colors.background, 0.15)}`,
          background: hsla(theme.colors.background, 0.08),
          color: hsl(theme.colors.background),
          outline: "none"
        }
      }
    ), /* @__PURE__ */ React6.createElement(
      "button",
      {
        "data-ut-intent": "lead.capture",
        type: "submit",
        className: "text-sm px-4 py-2 cursor-pointer hover:opacity-90",
        style: {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderRadius: theme.radius,
          border: "none"
        }
      },
      "Subscribe"
    )), socials.length > 0 && /* @__PURE__ */ React6.createElement("div", { className: "flex flex-wrap gap-3 mt-5 items-center" }, socials.map((s, i) => {
      const hasUrl = s.url && s.url !== "#";
      return /* @__PURE__ */ React6.createElement(
        "a",
        {
          "data-ut-intent": "nav.goto",
          key: i,
          href: hasUrl ? s.url : void 0,
          target: hasUrl ? "_blank" : void 0,
          rel: hasUrl ? "noopener noreferrer" : void 0,
          "aria-label": socialAriaLabel(s.platform),
          className: "inline-flex items-center justify-center w-8 h-8 rounded-full hover:opacity-80",
          style: { color: hsla(theme.colors.background, 0.75), textDecoration: "none" }
        },
        /* @__PURE__ */ React6.createElement(SocialIcon, { platform: s.platform, size: 16 })
      );
    }))), columns.map((col, i) => /* @__PURE__ */ React6.createElement("div", { key: i }, /* @__PURE__ */ React6.createElement("h4", { "data-ut-slot": `footer.title`, className: "text-xs uppercase tracking-widest mb-3 font-semibold", style: { color: hsla(theme.colors.background, 0.7) } }, col.title), /* @__PURE__ */ React6.createElement("ul", { className: "space-y-2" }, col.links.map((l, j) => /* @__PURE__ */ React6.createElement("li", { key: j }, /* @__PURE__ */ React6.createElement(
      "a",
      {
        "data-ut-intent": "nav.goto",
        href: l.href,
        className: "text-sm hover:opacity-80 transition-opacity",
        style: { color: hsla(theme.colors.background, 0.5), textDecoration: "none" }
      },
      l.label
    ))))))), /* @__PURE__ */ React6.createElement(
      "div",
      {
        className: "flex justify-between items-center pt-4",
        style: { borderTop: `1px solid ${hsla(theme.colors.background, 0.1)}` }
      },
      /* @__PURE__ */ React6.createElement("p", { className: "text-xs", style: { color: hsla(theme.colors.background, 0.4) } }, copyright || `\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${brand}. All rights reserved.`)
    ))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "footer:brand-social": FooterBrandSocial, "footer:multi-column": FooterMultiColumn, "footer:columns": FooterColumns, "footer:centered-minimal": FooterCenteredMinimal, "footer:dark-band": FooterDarkBand };
export {
  REGISTERED_VARIANTS
};
