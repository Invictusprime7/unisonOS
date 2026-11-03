/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/navbar/NavbarCatalogBar.tsx
import React2 from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/navbar/MobileNavbarNavigation.tsx
import React, { useEffect, useState } from "react";
import * as Dialog from "../../unison/ui/radix/dialog";
import { Menu, X } from "../../unison/ui/icons";
function MobileNavbarNavigation({ brand, links, cta, tone = "light" }) {
  const [open, setOpen] = useState(false);
  const isDark = tone === "dark";
  const shellClass = isDark ? "bg-foreground text-background" : "bg-background text-foreground";
  const buttonClass = isDark ? "border-background/30 bg-foreground text-background" : "border-border bg-background text-foreground";
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);
  return /* @__PURE__ */ React.createElement("div", { "data-ut-mobile-navigation": "radix", className: `flex min-h-[var(--ut-nav-block)] items-center gap-4 px-6 lg:hidden ${shellClass}` }, /* @__PURE__ */ React.createElement("a", { "data-ut-intent": "nav.goto", href: "#/", className: "min-w-0 flex-1 overflow-wrap-anywhere font-serif text-xl font-[number:var(--ut-weight-display)] no-underline" }, brand), /* @__PURE__ */ React.createElement(Dialog.Root, { open, onOpenChange: setOpen }, /* @__PURE__ */ React.createElement(Dialog.Trigger, { asChild: true }, /* @__PURE__ */ React.createElement("button", { "data-ut-intent": "ui.toggle", type: "button", "aria-label": "Open navigation", className: `inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] border ${buttonClass}` }, /* @__PURE__ */ React.createElement(Menu, { "aria-hidden": "true", size: 20 }))), /* @__PURE__ */ React.createElement(Dialog.Portal, null, /* @__PURE__ */ React.createElement(Dialog.Overlay, { className: "fixed inset-0 z-[100] bg-foreground/45" }), /* @__PURE__ */ React.createElement(Dialog.Content, { "aria-describedby": void 0, className: "fixed inset-y-0 right-0 z-[101] w-full max-w-sm overflow-y-auto bg-background p-6 text-foreground" }, /* @__PURE__ */ React.createElement("div", { className: "mb-8 flex items-center justify-between gap-4" }, /* @__PURE__ */ React.createElement(Dialog.Title, { className: "min-w-0 overflow-wrap-anywhere font-serif text-2xl font-[number:var(--ut-weight-display)]" }, "Navigation"), /* @__PURE__ */ React.createElement(Dialog.Close, { asChild: true }, /* @__PURE__ */ React.createElement("button", { "data-ut-intent": "ui.toggle", type: "button", "aria-label": "Close navigation", className: "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-border bg-background text-foreground" }, /* @__PURE__ */ React.createElement(X, { "aria-hidden": "true", size: 20 })))), /* @__PURE__ */ React.createElement("nav", { "aria-label": "Mobile navigation", className: "flex flex-col gap-2" }, links.map((link, index) => /* @__PURE__ */ React.createElement(Dialog.Close, { asChild: true, key: index }, /* @__PURE__ */ React.createElement("a", { href: link.href || "#", "data-ut-intent": link.intent ?? "nav.goto", className: "min-h-11 rounded-[var(--radius)] px-3 py-3 font-sans text-foreground no-underline hover:bg-muted" }, link.label))), cta && /* @__PURE__ */ React.createElement(Dialog.Close, { asChild: true }, /* @__PURE__ */ React.createElement("a", { href: cta.href || "#", "data-ut-intent": cta.intent ?? "nav.goto", "data-ut-cta": "cta.nav", className: "mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-primary px-4 py-2 font-sans font-semibold text-primary-foreground no-underline" }, cta.label)))))));
}

// src/sections/variants/navbar/NavbarCatalogBar.tsx
var NavbarCatalogBar = ({ section, theme }) => {
  const { brand, links = [], cta } = section.props;
  return /* @__PURE__ */ React2.createElement("header", { "data-ut-variant": "navbar:catalog-bar", className: "border-b", style: { background: hsl(theme.colors.background), borderColor: hsl(theme.colors.border) } }, /* @__PURE__ */ React2.createElement(MobileNavbarNavigation, { brand, links, cta }), /* @__PURE__ */ React2.createElement("div", { className: "mx-auto hidden items-center justify-between gap-8 px-6 py-5 lg:flex", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React2.createElement("a", { "data-ut-intent": "nav.goto", "data-ut-slot": "navbar.brand", href: "#/", className: "text-xl font-semibold", style: { color: hsl(theme.colors.foreground), fontFamily: theme.typography.headingFont } }, brand), /* @__PURE__ */ React2.createElement("nav", { "aria-label": "Main navigation", "data-ut-slot": "navbar.links", className: "flex flex-wrap gap-6" }, links.map((link, i) => /* @__PURE__ */ React2.createElement("a", { key: i, href: link.href, "data-ut-intent": link.intent ?? "nav.goto", className: "text-sm underline-offset-4 hover:underline", style: { color: hsl(theme.colors.mutedForeground) } }, link.label))), cta && /* @__PURE__ */ React2.createElement("a", { href: cta.href || "#", "data-ut-intent": cta.intent ?? "nav.goto", "data-ut-cta": "cta.nav", "data-ut-slot": "navbar.cta", className: "px-5 py-2 text-sm font-medium", style: { borderRadius: theme.radius, background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) } }, cta.label)));
};

// src/sections/variants/navbar/NavbarFloatingPill.tsx
import React3 from "react";
var NavbarFloatingPill = ({ section, theme }) => {
  const { brand, links = [], cta } = section.props;
  const [scrolled, setScrolled] = React3.useState(false);
  React3.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return /* @__PURE__ */ React3.createElement(
    "header",
    {
      "data-ut-variant": "navbar:floating-pill",
      className: "fixed left-0 right-0 top-0 z-50 backdrop-blur-md lg:bg-transparent",
      style: { background: hsla(theme.colors.background, 0.92) }
    },
    /* @__PURE__ */ React3.createElement(MobileNavbarNavigation, { brand, links, cta }),
    /* @__PURE__ */ React3.createElement("div", { className: `mx-auto hidden px-6 transition-all duration-300 lg:block ${scrolled ? "pt-3" : "pt-6"} motion-reduce:transition-none` }, /* @__PURE__ */ React3.createElement(
      "div",
      {
        className: "mx-auto flex h-14 items-center justify-between px-6 transition-all duration-300 motion-reduce:transition-none",
        style: {
          maxWidth: theme.containerWidth,
          borderRadius: "9999px",
          background: hsla(theme.colors.background, scrolled ? 0.95 : 0.7),
          border: `1px solid ${hsla(theme.colors.border, scrolled ? 0.7 : 0.35)}`,
          boxShadow: scrolled ? `0 16px 40px -28px ${hsla(theme.colors.foreground, 0.7)}` : "none"
        }
      },
      /* @__PURE__ */ React3.createElement(
        "a",
        {
          "data-ut-intent": "nav.goto",
          "data-ut-slot": "navbar.brand",
          href: "#/",
          className: "text-base font-semibold tracking-tight no-underline",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
        },
        brand
      ),
      /* @__PURE__ */ React3.createElement("nav", { "aria-label": "Main navigation", "data-ut-slot": "navbar.links", className: "flex items-center gap-7" }, links.map((link, i) => /* @__PURE__ */ React3.createElement(
        "a",
        {
          key: i,
          href: link.href,
          "data-ut-intent": link.intent ?? "nav.goto",
          className: "text-sm no-underline transition-opacity hover:opacity-80",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        link.label
      ))),
      cta && /* @__PURE__ */ React3.createElement(
        "a",
        {
          href: cta.href || "#",
          "data-ut-intent": cta.intent ?? "nav.goto",
          "data-ut-cta": "cta.nav",
          "data-ut-slot": "navbar.cta",
          className: "px-4 py-2 text-sm font-medium no-underline transition-opacity hover:opacity-90",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: "9999px",
            fontFamily: theme.typography.bodyFont
          }
        },
        cta.label
      )
    ))
  );
};

// src/sections/variants/navbar/NavbarStandard.tsx
import React4 from "react";
var NavbarStandard = ({ section, theme }) => {
  const { brand, links = [], cta } = section.props;
  const rule = `1px solid ${hsla(theme.colors.border, 0.6)}`;
  return /* @__PURE__ */ React4.createElement(
    "header",
    {
      "data-ut-variant": "navbar:standard",
      "data-ut-slot": "navigation",
      className: "sticky top-0 z-50 backdrop-blur-md",
      style: { background: hsla(theme.colors.background, 0.92) }
    },
    /* @__PURE__ */ React4.createElement(MobileNavbarNavigation, { brand, links, cta }),
    /* @__PURE__ */ React4.createElement("div", { className: "mx-auto hidden px-6 lg:block", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React4.createElement(
      "div",
      {
        className: "relative flex items-stretch justify-between",
        style: { borderTop: rule, borderBottom: rule }
      },
      /* @__PURE__ */ React4.createElement("span", { "aria-hidden": "true", className: "absolute -left-px -top-px h-2 w-2", style: { borderLeft: rule, borderTop: rule } }),
      /* @__PURE__ */ React4.createElement("span", { "aria-hidden": "true", className: "absolute -right-px -top-px h-2 w-2", style: { borderRight: rule, borderTop: rule } }),
      /* @__PURE__ */ React4.createElement(
        "a",
        {
          "data-ut-intent": "nav.goto",
          href: "#/",
          "data-ut-slot": "brand",
          className: "flex items-center py-4 text-lg font-semibold tracking-tight",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
        },
        brand
      ),
      /* @__PURE__ */ React4.createElement("nav", { "aria-label": "Main navigation", className: "flex items-stretch" }, links.map((link, i) => /* @__PURE__ */ React4.createElement(
        "a",
        {
          key: i,
          href: link.href,
          "data-ut-intent": link.intent ?? "nav.goto",
          className: "flex items-center px-4 text-sm font-medium motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.foreground), borderLeft: rule }
        },
        link.label
      )), cta && /* @__PURE__ */ React4.createElement("span", { className: "flex items-center pl-4", style: { borderLeft: rule } }, /* @__PURE__ */ React4.createElement(
        "a",
        {
          href: cta.href || "#",
          "data-ut-intent": cta.intent ?? "nav.goto",
          "data-ut-cta": "cta.nav",
          className: "px-4 py-2 text-sm font-medium motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius,
            fontFamily: theme.typography.bodyFont
          }
        },
        cta.label
      )))
    ))
  );
};

// src/sections/variants/navbar/NavbarCenteredLogo.tsx
import React5 from "react";
var NavbarCenteredLogo = ({ section, theme }) => {
  const { brand, links = [], cta } = section.props;
  const [condensed, setCondensed] = React5.useState(false);
  React5.useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return /* @__PURE__ */ React5.createElement(
    "header",
    {
      "data-ut-variant": "navbar:centered-logo",
      "data-ut-slot": "navigation",
      "data-state": condensed ? "condensed" : "top",
      className: "sticky top-0 z-50 w-full px-2 pt-2"
    },
    /* @__PURE__ */ React5.createElement(MobileNavbarNavigation, { brand, links, cta }),
    /* @__PURE__ */ React5.createElement(
      "div",
      {
        className: "mx-auto hidden px-6 motion-safe:transition-all motion-safe:duration-300 lg:block",
        style: {
          maxWidth: condensed ? `calc(${theme.containerWidth} * 0.82)` : theme.containerWidth,
          background: condensed ? hsla(theme.colors.background, 0.72) : "transparent",
          border: condensed ? `1px solid ${hsla(theme.colors.border, 0.6)}` : "1px solid transparent",
          borderRadius: condensed ? "1rem" : theme.radius,
          backdropFilter: condensed ? "blur(14px)" : void 0
        }
      },
      /* @__PURE__ */ React5.createElement("div", { className: "relative flex items-center justify-between py-3" }, /* @__PURE__ */ React5.createElement(
        "a",
        {
          "data-ut-intent": "nav.goto",
          href: "#/",
          "data-ut-slot": "brand",
          "aria-label": "Home",
          className: "text-xl font-semibold tracking-tight",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
        },
        brand
      ), /* @__PURE__ */ React5.createElement("nav", { "aria-label": "Main navigation", className: "absolute inset-0 m-auto hidden size-fit lg:block" }, /* @__PURE__ */ React5.createElement("ul", { className: "flex gap-8 text-sm" }, links.map((link, i) => /* @__PURE__ */ React5.createElement("li", { key: i }, /* @__PURE__ */ React5.createElement(
        "a",
        {
          href: link.href,
          "data-ut-intent": link.intent ?? "nav.goto",
          className: "block motion-safe:duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        link.label
      ))))), cta && /* @__PURE__ */ React5.createElement(
        "a",
        {
          href: cta.href || "#",
          "data-ut-intent": cta.intent ?? "nav.goto",
          "data-ut-cta": "cta.nav",
          className: "px-5 py-2 text-sm font-medium motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: "999px",
            fontFamily: theme.typography.bodyFont
          }
        },
        cta.label
      ))
    )
  );
};

// src/sections/variants/navbar/NavbarMinimalDark.tsx
import React6 from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Navigation = __LucideIcons['Navigation'] || __LucideFallback;
const Home = __LucideIcons['Home'] || __LucideFallback;
var NavbarMinimalDark = ({ section, theme }) => {
  const { brand, links = [], cta } = section.props;
  return /* @__PURE__ */ React6.createElement(
    "header",
    {
      "data-ut-variant": "navbar:minimal-dark",
      "data-ut-slot": "navigation",
      className: "sticky top-0 z-50",
      style: {
        background: hsla(theme.colors.foreground, 0.95),
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${hsla(theme.colors.background, 0.08)}`
      }
    },
    /* @__PURE__ */ React6.createElement(MobileNavbarNavigation, { brand, links, cta, tone: "dark" }),
    /* @__PURE__ */ React6.createElement(
      "div",
      {
        className: "mx-auto hidden min-h-16 grid-cols-3 items-center gap-4 px-6 lg:grid",
        style: { maxWidth: theme.containerWidth }
      },
      /* @__PURE__ */ React6.createElement("nav", { "aria-label": "Main navigation", className: "flex items-center justify-start gap-6" }, links.map((link, i) => /* @__PURE__ */ React6.createElement(
        "a",
        {
          key: i,
          href: link.href,
          "data-ut-intent": link.intent ?? "nav.goto",
          className: "text-sm motion-safe:transition-colors hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2",
          style: { fontFamily: theme.typography.bodyFont, color: hsla(theme.colors.background, 0.66) }
        },
        link.label
      ))),
      /* @__PURE__ */ React6.createElement(
        "a",
        {
          "data-ut-intent": "nav.goto",
          href: "#/",
          "data-ut-slot": "brand",
          className: "justify-self-center text-base font-semibold tracking-tight",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.background) }
        },
        brand
      ),
      /* @__PURE__ */ React6.createElement(
        "div",
        {
          className: "flex items-center justify-end gap-4 py-3 pl-6",
          style: { borderLeft: `1px solid ${hsla(theme.colors.background, 0.12)}` }
        },
        cta && /* @__PURE__ */ React6.createElement(
          "a",
          {
            href: cta.href || "#",
            "data-ut-intent": cta.intent ?? "nav.goto",
            "data-ut-cta": "cta.nav",
            className: "px-5 py-1.5 text-sm font-medium motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
            style: {
              background: hsl(theme.colors.primary),
              color: hsl(theme.colors.primaryForeground),
              borderRadius: theme.radius,
              fontFamily: theme.typography.bodyFont
            }
          },
          cta.label
        )
      )
    )
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "navbar:catalog-bar": NavbarCatalogBar, "navbar:floating-pill": NavbarFloatingPill, "navbar:standard": NavbarStandard, "navbar:centered-logo": NavbarCenteredLogo, "navbar:minimal-dark": NavbarMinimalDark };
export {
  REGISTERED_VARIANTS
};
