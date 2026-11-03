/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/hero/HeroImageStream.tsx
import React from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/hero/HeroImageStream.tsx
var PATH = {
  perspective: 30,
  cardWidth: 18,
  cardHeight: 25,
  cardRadius: 0.4,
  birthHeight: 2.6,
  exitHeight: 46,
  railBirth: -11,
  railExit: 44,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 28,
  stops: 24
};
function corridorKeyframes(direction, name) {
  const steps = [];
  for (let step = 0; step <= PATH.stops; step += 1) {
    const progress = step / PATH.stops;
    const scale = PATH.birthHeight / PATH.cardHeight * Math.pow(PATH.exitHeight / PATH.birthHeight, progress);
    const depth = PATH.perspective * (1 - 1 / scale);
    const rail = PATH.railExit - (PATH.railExit - PATH.railBirth) * Math.pow(1 - progress, PATH.fan);
    const turn = PATH.turnBirth + (PATH.turnExit - PATH.turnBirth) * progress;
    steps.push(
      `${(progress * 100).toFixed(2)}%{transform:translate3d(${(direction * rail).toFixed(2)}cqw,0,${depth.toFixed(2)}cqw) rotateY(${(-direction * turn).toFixed(2)}deg)}`
    );
  }
  return `@keyframes ${name}{${steps.join("")}}`;
}
function resolveImages(images, image, backgroundImage, headline) {
  const supplied = Array.isArray(images) ? images.filter((item) => typeof item?.src === "string" && item.src.trim()) : [];
  if (supplied.length) return supplied;
  const fallback = backgroundImage || image;
  return fallback ? [{ src: fallback, alt: headline }] : [];
}
var HeroImageStream = ({ section, theme }) => {
  const { headline, subheadline, description, ctas = [], badge, image, backgroundImage, images } = section.props;
  const media = resolveImages(images, image, backgroundImage, headline);
  const right = "ut-ish-right";
  const left = "ut-ish-left";
  const card = "ut-ish-card";
  const cards = 9;
  const speed = 18;
  const axis = 56;
  const css = React.useMemo(
    () => `${corridorKeyframes(1, right)}${corridorKeyframes(-1, left)}@media(prefers-reduced-motion:reduce){.${card}{animation-play-state:paused!important}}`,
    [right, left, card]
  );
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      "data-ut-variant": "hero:image-stream",
      "data-ut-slot": "hero",
      className: "relative w-full overflow-hidden",
      style: {
        minHeight: "clamp(34rem, 82vh, 56rem)",
        containerType: "inline-size",
        background: hsl(theme.colors.background)
      }
    },
    /* @__PURE__ */ React.createElement("style", null, css),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-0",
        style: { perspective: `${PATH.perspective}cqw`, perspectiveOrigin: `50% ${axis}%` }
      },
      /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0", style: { transformStyle: "preserve-3d" } }, [right, left].map(
        (animationName) => Array.from({ length: cards }, (_, index) => {
          const item = media[index % Math.max(media.length, 1)];
          return /* @__PURE__ */ React.createElement(
            "div",
            {
              key: `${animationName}-${index}`,
              className: `${card} absolute overflow-hidden`,
              style: {
                left: "50%",
                top: `${axis}%`,
                width: `${PATH.cardWidth}cqw`,
                height: `${PATH.cardHeight}cqw`,
                marginLeft: `${-PATH.cardWidth / 2}cqw`,
                marginTop: `${-PATH.cardHeight / 2}cqw`,
                borderRadius: `max(${PATH.cardRadius}cqw, ${theme.radius})`,
                animation: `${animationName} ${speed}s linear infinite`,
                animationDelay: `${-(index * speed) / cards}s`,
                backfaceVisibility: "hidden",
                background: hsl(theme.colors.muted),
                boxShadow: `0 0 0 1px ${hsla(theme.colors.border, 0.5)}`
              }
            },
            item ? /* @__PURE__ */ React.createElement(
              "img",
              {
                src: item.src,
                alt: "",
                loading: index < 2 ? "eager" : "lazy",
                decoding: "async",
                className: "h-full w-full object-cover",
                draggable: false
              }
            ) : null
          );
        })
      ))
    ),
    /* @__PURE__ */ React.createElement(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-0",
        style: {
          background: `linear-gradient(180deg, ${hsla(theme.colors.background, 0.96)} 0%, ${hsla(theme.colors.background, 0.18)} 38%, ${hsla(theme.colors.background, 0.88)} 100%)`
        }
      }
    ),
    /* @__PURE__ */ React.createElement("div", { className: "relative z-10 mx-auto flex min-h-[inherit] flex-col items-center justify-between px-6 py-12 text-center md:py-16", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl" }, badge ? /* @__PURE__ */ React.createElement(
      "span",
      {
        "data-ut-slot": "hero.badge",
        className: "mb-5 inline-flex border px-3 py-1 text-xs font-medium uppercase",
        style: { borderColor: hsl(theme.colors.border), borderRadius: theme.radius, color: hsl(theme.colors.mutedForeground) }
      },
      badge
    ) : null, /* @__PURE__ */ React.createElement(
      "h1",
      {
        "data-ut-slot": "hero.headline",
        className: "text-balance text-5xl sm:text-6xl lg:text-8xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          letterSpacing: 0,
          lineHeight: 0.98,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    )), /* @__PURE__ */ React.createElement("div", { className: "flex max-w-xl flex-col items-center gap-5" }, subheadline || description ? /* @__PURE__ */ React.createElement(
      "p",
      {
        "data-ut-slot": "hero.subheadline",
        className: "text-balance text-sm leading-relaxed md:text-base",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      subheadline || description
    ) : null, ctas.length ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap items-center justify-center gap-3" }, ctas.map((cta, index) => /* @__PURE__ */ React.createElement(
      "a",
      {
        key: `${cta.label}-${index}`,
        href: cta.href || "#",
        "data-ut-intent": cta.intent ?? "nav.goto",
        "data-ut-cta": index === 0 ? "cta.hero" : "cta.hero-secondary",
        className: "inline-flex min-h-11 items-center justify-center border px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80",
        style: {
          borderColor: hsl(index === 0 ? theme.colors.primary : theme.colors.border),
          borderRadius: `calc(${theme.radius} * 4)`,
          background: hsl(index === 0 ? theme.colors.primary : theme.colors.background),
          color: hsl(index === 0 ? theme.colors.primaryForeground : theme.colors.foreground)
        }
      },
      cta.label
    ))) : null))
  );
};

// src/sections/variants/hero/HeroLaunchShowcase.tsx
import React2 from "react";
var HeroLaunchShowcase = ({ section, theme }) => {
  const { headline, subheadline, description, badge, ctas = [], image, backgroundImage } = section.props;
  return /* @__PURE__ */ React2.createElement("section", { "data-ut-variant": "hero:launch-showcase", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background), color: hsl(theme.colors.foreground) } }, /* @__PURE__ */ React2.createElement("div", { className: "mx-auto flex flex-col items-center gap-8 px-6 text-center", style: { maxWidth: theme.containerWidth } }, badge && /* @__PURE__ */ React2.createElement("span", { "data-ut-slot": "hero.badge", className: "rounded-full border px-4 py-1 text-sm", style: { borderColor: hsl(theme.colors.border) } }, badge), /* @__PURE__ */ React2.createElement("h1", { "data-ut-slot": "hero.headline", className: "max-w-5xl text-4xl leading-tight sm:text-6xl lg:text-7xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight } }, headline), (subheadline || description) && /* @__PURE__ */ React2.createElement("p", { "data-ut-slot": "hero.subheadline", className: "max-w-2xl text-lg", style: { color: hsl(theme.colors.mutedForeground) } }, subheadline || description), /* @__PURE__ */ React2.createElement("div", { className: "flex flex-wrap justify-center gap-4" }, ctas.map((cta, i) => /* @__PURE__ */ React2.createElement("a", { key: i, href: cta.href || "#", "data-ut-intent": cta.intent ?? "nav.goto", "data-ut-cta": i ? "cta.hero-secondary" : "cta.hero", className: "px-6 py-3 font-medium", style: { borderRadius: theme.radius, background: hsl(i ? theme.colors.muted : theme.colors.primary), color: hsl(i ? theme.colors.foreground : theme.colors.primaryForeground) } }, cta.label))), (image || backgroundImage) && /* @__PURE__ */ React2.createElement("div", { className: "mt-8 w-full overflow-hidden border p-2", style: { borderColor: hsl(theme.colors.border), borderRadius: theme.radius, boxShadow: "0 24px 80px " + hsla(theme.colors.primary, 0.16) } }, /* @__PURE__ */ React2.createElement("img", { "data-ut-slot": "hero.image", src: image || backgroundImage, alt: headline || "", className: "aspect-video w-full object-cover" }))));
};

// src/sections/variants/hero/HeroPrismaCinematic.tsx
import React3 from "react";
var revealStyles = `
@keyframes ut-prisma-rise {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: none; }
}
[data-ut-variant="hero:prisma-cinematic"] [data-ut-rise] {
  animation: ut-prisma-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="hero:prisma-cinematic"] [data-ut-rise] {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;
var HeroPrismaCinematic = ({ section, theme }) => {
  const { headline, subheadline, description, ctas = [], badge, image, backgroundImage } = section.props;
  const media = backgroundImage || image;
  const words = String(headline || "").trim().split(/\s+/).filter(Boolean);
  return /* @__PURE__ */ React3.createElement(
    "section",
    {
      "data-ut-variant": "hero:prisma-cinematic",
      "data-ut-slot": "hero",
      className: "relative w-full",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React3.createElement("style", null, revealStyles),
    /* @__PURE__ */ React3.createElement("div", { className: "mx-auto", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React3.createElement(
      "div",
      {
        className: "relative overflow-hidden min-h-[70vh] md:min-h-[82vh] flex flex-col justify-end",
        style: {
          borderRadius: `calc(${theme.radius} * 4)`,
          background: hsl(theme.colors.foreground)
        }
      },
      media && /* @__PURE__ */ React3.createElement(
        "img",
        {
          src: media,
          alt: headline ? `${headline} background` : "Hero background",
          loading: "lazy",
          className: "absolute inset-0 h-full w-full object-cover"
        }
      ),
      /* @__PURE__ */ React3.createElement(
        "div",
        {
          "aria-hidden": true,
          className: "pointer-events-none absolute inset-0",
          style: {
            backgroundImage: `linear-gradient(to bottom, ${hsla(theme.colors.foreground, 0.35)}, transparent 45%, ${hsla(theme.colors.foreground, 0.75)})`
          }
        }
      ),
      badge && /* @__PURE__ */ React3.createElement("div", { className: "absolute left-1/2 top-0 z-20 -translate-x-1/2" }, /* @__PURE__ */ React3.createElement(
        "span",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.badge",
          className: "inline-block px-5 py-2 text-[11px] uppercase tracking-[0.2em]",
          style: {
            background: hsl(theme.colors.foreground),
            color: hsl(theme.colors.background),
            borderBottomLeftRadius: `calc(${theme.radius} * 2)`,
            borderBottomRightRadius: `calc(${theme.radius} * 2)`
          }
        },
        badge
      )),
      /* @__PURE__ */ React3.createElement("div", { className: "relative z-10 grid grid-cols-12 items-end gap-6 px-5 pb-6 sm:px-8 md:px-10 md:pb-10" }, /* @__PURE__ */ React3.createElement("div", { className: "col-span-12 lg:col-span-8" }, /* @__PURE__ */ React3.createElement(
        "h1",
        {
          "data-ut-slot": "hero.headline",
          className: "flex flex-wrap font-medium",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            fontSize: "clamp(3rem, 16vw, 13rem)",
            lineHeight: 0.85,
            letterSpacing: "-0.06em",
            color: hsl(theme.colors.background)
          }
        },
        words.map((word, i) => /* @__PURE__ */ React3.createElement(
          "span",
          {
            key: `${word}-${i}`,
            "data-ut-rise": true,
            className: "inline-block",
            style: { marginRight: "0.22em", animationDelay: `${i * 0.08}s` }
          },
          word
        ))
      )), /* @__PURE__ */ React3.createElement("div", { className: "col-span-12 flex flex-col gap-5 pb-2 lg:col-span-4 lg:pb-8" }, (subheadline || description) && /* @__PURE__ */ React3.createElement(
        "p",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.subheadline",
          className: "text-sm leading-snug md:text-base",
          style: {
            fontFamily: theme.typography.bodyFont,
            color: hsla(theme.colors.background, 0.78),
            animationDelay: "0.4s"
          }
        },
        subheadline || description
      ), ctas.length > 0 && /* @__PURE__ */ React3.createElement("div", { "data-ut-rise": true, className: "flex flex-wrap items-center gap-3", style: { animationDelay: "0.55s" } }, ctas.map((c, i) => /* @__PURE__ */ React3.createElement(
        "a",
        {
          key: `${c.label}-${i}`,
          href: c.href || "#",
          "data-ut-intent": c.intent ?? "nav.goto",
          "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
          className: "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90",
          style: i === 0 && c.variant !== "outline" ? {
            background: hsl(theme.colors.background),
            color: hsl(theme.colors.foreground),
            borderRadius: `calc(${theme.radius} * 6)`
          } : {
            border: `1px solid ${hsla(theme.colors.background, 0.5)}`,
            color: hsl(theme.colors.background),
            borderRadius: `calc(${theme.radius} * 6)`
          }
        },
        c.label
      )))))
    ))
  );
};

// src/sections/variants/hero/HeroImageFan.tsx
import React4 from "react";
var HeroImageFan = ({ section, theme }) => {
  const p = section.props;
  const imgs = (p.images?.length ? p.images.map((g) => g.src) : [p.image]).filter(Boolean).slice(0, 5);
  const mid = (imgs.length - 1) / 2;
  return /* @__PURE__ */ React4.createElement("section", { "data-ut-variant": "hero:image-fan", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React4.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React4.createElement("div", { className: "text-center" }, p.badge && /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": "hero.badge", className: "mb-4 text-xs uppercase tracking-[0.18em]", style: { color: hsl(theme.colors.mutedForeground) } }, p.badge), /* @__PURE__ */ React4.createElement("h1", { "data-ut-slot": "hero.headline", className: "mx-auto max-w-4xl text-4xl sm:text-5xl md:text-7xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), (p.subheadline || p.description) && /* @__PURE__ */ React4.createElement("p", { "data-ut-slot": "hero.description", className: "mx-auto mt-5 max-w-2xl text-base md:text-lg", style: { color: hsl(theme.colors.mutedForeground), fontFamily: theme.typography.bodyFont } }, p.description || p.subheadline), /* @__PURE__ */ React4.createElement("div", { "data-ut-slot": "hero.actions", className: "mt-8 flex flex-col justify-center gap-3 sm:flex-row" }, (p.ctas || []).map((c, i) => /* @__PURE__ */ React4.createElement("a", { key: i, href: c.href || "#", "data-ut-intent": c.intent ?? "nav.goto", className: "inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity hover:opacity-90", style: { borderRadius: theme.radius, background: i ? "transparent" : hsl(theme.colors.primary), color: i ? hsl(theme.colors.foreground) : hsl(theme.colors.primaryForeground), border: `1px solid ${hsl(i ? theme.colors.border : theme.colors.primary)}` } }, c.label)))), /* @__PURE__ */ React4.createElement("div", { "data-ut-slot": "hero.media", className: "relative mx-auto mt-14 flex h-56 max-w-3xl items-end justify-center sm:h-72 md:h-96" }, imgs.map((src, i) => /* @__PURE__ */ React4.createElement("img", { key: i, src, alt: "", loading: "lazy", className: "absolute bottom-0 h-44 w-32 object-cover shadow-lg sm:h-60 sm:w-44 md:h-80 md:w-56 motion-safe:transition-transform motion-safe:duration-500", style: { borderRadius: theme.radius, transform: `translateX(${(i - mid) * 38}%) rotate(${(i - mid) * 7}deg)`, zIndex: 10 - Math.abs(i - mid) } })))));
};

// src/sections/variants/hero/HeroVariableType.tsx
import React5 from "react";
var HeroVariableType = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React5.createElement("section", { "data-ut-variant": "hero:variable-type", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background), borderBottom: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React5.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, p.badge && /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": "hero.badge", className: "mb-6 text-xs uppercase tracking-[0.2em]", style: { color: hsl(theme.colors.mutedForeground) } }, p.badge), /* @__PURE__ */ React5.createElement("h1", { "data-ut-slot": "hero.headline", "aria-label": p.headline, className: "text-5xl leading-[0.95] sm:text-7xl md:text-8xl lg:text-9xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline.split(" ").map((w, i) => /* @__PURE__ */ React5.createElement("span", { key: i, "aria-hidden": "true", className: "inline-block pr-[0.25em] motion-safe:transition-[font-weight,letter-spacing] motion-safe:duration-300 hover:tracking-tight", style: { fontWeight: 300 }, onMouseEnter: (e) => e.currentTarget.style.fontWeight = "800", onMouseLeave: (e) => e.currentTarget.style.fontWeight = "300" }, w))), /* @__PURE__ */ React5.createElement("div", { className: "mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end" }, (p.description || p.subheadline) && /* @__PURE__ */ React5.createElement("p", { "data-ut-slot": "hero.description", className: "max-w-xl text-base md:text-lg", style: { color: hsl(theme.colors.mutedForeground) } }, p.description || p.subheadline), /* @__PURE__ */ React5.createElement("div", { "data-ut-slot": "hero.actions", className: "flex flex-col gap-3 sm:flex-row" }, (p.ctas || []).map((c, i) => /* @__PURE__ */ React5.createElement("a", { key: i, href: c.href || "#", "data-ut-intent": c.intent ?? "nav.goto", className: "inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity hover:opacity-90", style: { borderRadius: theme.radius, background: i ? "transparent" : hsl(theme.colors.primary), color: i ? hsl(theme.colors.foreground) : hsl(theme.colors.primaryForeground), border: `1px solid ${hsl(i ? theme.colors.border : theme.colors.primary)}` } }, c.label))))));
};

// src/sections/variants/hero/HeroUnderline.tsx
import React6 from "react";
var HeroUnderline = ({ section, theme }) => {
  const p = section.props;
  const words = p.headline.split(" ");
  const last = words.pop();
  return /* @__PURE__ */ React6.createElement("section", { "data-ut-variant": "hero:underline", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React6.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React6.createElement("div", { className: "max-w-3xl py-8 md:py-16" }, /* @__PURE__ */ React6.createElement("h1", { "data-ut-slot": "hero.headline", className: "text-4xl sm:text-5xl md:text-6xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, words.join(" "), " ", /* @__PURE__ */ React6.createElement("span", { className: "relative inline-block" }, last, /* @__PURE__ */ React6.createElement("span", { "aria-hidden": "true", className: "absolute -bottom-1 left-0 h-[0.12em] w-full origin-left motion-safe:animate-[ut-underline_900ms_ease-out_both]", style: { background: hsl(theme.colors.accent) } }))), (p.description || p.subheadline) && /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": "hero.description", className: "mt-6 max-w-xl text-base md:text-lg", style: { color: hsl(theme.colors.mutedForeground) } }, p.description || p.subheadline), /* @__PURE__ */ React6.createElement("div", { "data-ut-slot": "hero.actions", className: "mt-8 flex flex-col gap-3 sm:flex-row" }, (p.ctas || []).map((c, i) => /* @__PURE__ */ React6.createElement("a", { key: i, href: c.href || "#", "data-ut-intent": c.intent ?? "nav.goto", className: "inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:transition-opacity hover:opacity-90", style: { borderRadius: theme.radius, background: i ? "transparent" : hsl(theme.colors.primary), color: i ? hsl(theme.colors.foreground) : hsl(theme.colors.primaryForeground), border: `1px solid ${hsl(i ? theme.colors.border : theme.colors.primary)}` } }, c.label))))), /* @__PURE__ */ React6.createElement("style", null, `@keyframes ut-underline{from{transform:scaleX(0)}to{transform:scaleX(1)}}`));
};

// src/sections/variants/hero/HeroPageIntro.tsx
import React7 from "react";
function Actions({ ctas }) {
  if (!ctas?.length) return null;
  return /* @__PURE__ */ React7.createElement("div", { className: "mt-6 flex flex-wrap gap-3" }, ctas.map((cta, index) => /* @__PURE__ */ React7.createElement(
    "a",
    {
      key: index,
      href: cta.href || "#",
      "data-ut-intent": cta.intent ?? "nav.goto",
      "data-ut-cta": index === 0 ? "cta.hero" : "cta.hero-secondary",
      className: cta.variant === "outline" ? "inline-flex items-center rounded-[var(--radius)] border border-border px-5 py-3 font-sans text-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2" : "inline-flex items-center rounded-[var(--radius)] bg-primary px-5 py-3 font-sans text-primary-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2"
    },
    cta.label
  )));
}
function HeroPageIntro({ props }) {
  const { headline, subheadline, description, badge, ctas = [], image, backgroundImage, layout } = props;
  const banner = layout === "editorial-banner";
  const media = image || backgroundImage;
  if (banner) {
    return /* @__PURE__ */ React7.createElement(
      "section",
      {
        "data-ut-variant": "hero:editorial-banner",
        "data-ut-slot": "hero",
        className: "border-b border-border bg-background text-foreground",
        style: { paddingTop: "var(--ut-nav-block, 5rem)" }
      },
      media && /* @__PURE__ */ React7.createElement(
        "img",
        {
          src: media,
          alt: "",
          loading: "lazy",
          "data-ut-slot": "hero-media",
          className: "aspect-[16/5] max-h-96 w-full object-cover motion-safe:transition-transform motion-safe:duration-700"
        }
      ),
      /* @__PURE__ */ React7.createElement("div", { className: "mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10" }, /* @__PURE__ */ React7.createElement("p", { className: "font-sans text-sm uppercase tracking-[0.18em] text-muted-foreground" }, badge || ""), /* @__PURE__ */ React7.createElement("div", { className: "lg:text-right" }, /* @__PURE__ */ React7.createElement("h1", { "data-ut-slot": "hero.headline", className: "ml-auto max-w-3xl text-balance break-words font-serif text-3xl font-[number:var(--ut-weight-display)] leading-tight tracking-tight sm:text-4xl md:text-5xl" }, headline), subheadline && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "hero.subheadline", className: "ml-auto mt-5 max-w-2xl font-sans text-lg text-muted-foreground" }, subheadline), description && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "hero.description", className: "ml-auto mt-3 max-w-2xl font-sans text-muted-foreground" }, description), /* @__PURE__ */ React7.createElement("div", { className: "lg:flex lg:justify-end" }, /* @__PURE__ */ React7.createElement(Actions, { ctas }))))
    );
  }
  return /* @__PURE__ */ React7.createElement(
    "section",
    {
      "data-ut-variant": "hero:page-title",
      "data-ut-slot": "hero",
      className: "bg-background text-foreground",
      style: { paddingTop: "var(--ut-nav-block, 5rem)" }
    },
    /* @__PURE__ */ React7.createElement("div", { className: "mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14" }, /* @__PURE__ */ React7.createElement("div", { className: "flex flex-col gap-2 rounded-[calc(var(--radius)+0.5rem)] border border-border bg-card p-6 text-card-foreground shadow-lg sm:p-8" }, /* @__PURE__ */ React7.createElement("nav", { "aria-label": "Breadcrumb", className: "flex flex-wrap items-center gap-2 font-sans text-sm text-muted-foreground" }, /* @__PURE__ */ React7.createElement("a", { "data-ut-intent": "nav.goto", href: "#/", className: "motion-safe:transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2" }, "Home"), /* @__PURE__ */ React7.createElement("span", { "aria-hidden": "true" }, "/"), /* @__PURE__ */ React7.createElement("span", { className: "text-foreground" }, badge || headline)), /* @__PURE__ */ React7.createElement("h1", { "data-ut-slot": "hero.headline", className: "max-w-4xl break-words font-serif text-3xl font-[number:var(--ut-weight-display)] leading-tight tracking-tight sm:text-4xl" }, headline), subheadline && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "hero.subheadline", className: "mt-2 max-w-2xl font-sans text-lg text-muted-foreground" }, subheadline), description && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "hero.description", className: "mt-2 max-w-2xl font-sans text-muted-foreground" }, description), /* @__PURE__ */ React7.createElement(Actions, { ctas })))
  );
}
function HeroPageTitle({ section }) {
  return /* @__PURE__ */ React7.createElement(HeroPageIntro, { props: { ...section.props, layout: "page-title" } });
}
function HeroEditorialBanner({ section }) {
  return /* @__PURE__ */ React7.createElement(HeroPageIntro, { props: { ...section.props, layout: "editorial-banner" } });
}

// src/sections/variants/hero/HeroCentered.tsx
import React8 from "react";
var HeroCentered = ({ section, theme }) => {
  const { headline, subheadline, ctas = [], badge, stats } = section.props;
  const rule = hsla(theme.colors.border, 0.65);
  return /* @__PURE__ */ React8.createElement(
    "section",
    {
      "data-ut-variant": "hero:centered",
      "data-ut-slot": "hero",
      className: "relative isolate overflow-hidden",
      style: {
        padding: theme.sectionPadding,
        paddingTop: "clamp(5.5rem, 8vw, 7rem)",
        background: hsl(theme.colors.background)
      }
    },
    /* @__PURE__ */ React8.createElement(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-x-0 -top-16 -z-10 h-80",
        style: {
          background: `radial-gradient(35% 80% at 50% 0%, ${hsla(theme.colors.primary, 0.12)}, transparent)`
        }
      }
    ),
    /* @__PURE__ */ React8.createElement("div", { className: "relative mx-auto px-6 text-center", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React8.createElement(
      "span",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-y-0 left-0 hidden w-px lg:block",
        style: { background: `linear-gradient(to bottom, transparent, ${rule} 20%, ${rule} 80%, transparent)` }
      }
    ), /* @__PURE__ */ React8.createElement(
      "span",
      {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-y-0 right-0 hidden w-px lg:block",
        style: { background: `linear-gradient(to bottom, transparent, ${rule} 20%, ${rule} 80%, transparent)` }
      }
    ), badge && /* @__PURE__ */ React8.createElement(
      "span",
      {
        "data-ut-slot": "hero.badge",
        className: "mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
        style: {
          color: hsl(theme.colors.primary),
          background: hsla(theme.colors.primary, 0.08),
          border: `1px solid ${hsla(theme.colors.primary, 0.18)}`,
          fontFamily: theme.typography.bodyFont
        }
      },
      /* @__PURE__ */ React8.createElement("span", { "aria-hidden": "true", className: "h-1.5 w-1.5 rounded-full", style: { background: hsl(theme.colors.primary) } }),
      badge
    ), /* @__PURE__ */ React8.createElement(
      "h1",
      {
        "data-ut-slot": "hero.headline",
        className: "mx-auto mb-6 max-w-3xl text-balance leading-[1.05] tracking-tight",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground),
          fontSize: "clamp(2.5rem, 5.2vw, 4rem)"
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React8.createElement(
      "p",
      {
        "data-ut-slot": "hero.subheadline",
        className: "mx-auto mb-9 max-w-xl text-lg leading-relaxed",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      subheadline
    ), ctas.length > 0 && /* @__PURE__ */ React8.createElement("div", { className: "flex flex-wrap justify-center gap-3" }, ctas.map((c, i) => /* @__PURE__ */ React8.createElement(
      "a",
      {
        key: i,
        href: c.href || "#",
        "data-ut-intent": c.intent ?? "nav.goto",
        "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
        className: "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        style: c.variant === "outline" ? {
          background: "transparent",
          color: hsl(theme.colors.foreground),
          border: `1px solid ${hsla(theme.colors.border, 1)}`,
          borderRadius: theme.radius,
          fontFamily: theme.typography.bodyFont
        } : {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderRadius: theme.radius,
          fontFamily: theme.typography.bodyFont
        }
      },
      c.label
    ))), stats && stats.length > 0 && /* @__PURE__ */ React8.createElement(
      "div",
      {
        className: "mt-14 flex flex-wrap justify-center gap-10 pt-10",
        style: { borderTop: `1px solid ${rule}` }
      },
      stats.map((s, i) => /* @__PURE__ */ React8.createElement("div", { key: i, className: "text-center" }, /* @__PURE__ */ React8.createElement(
        "div",
        {
          "data-ut-slot": `hero.value`,
          className: "text-3xl font-bold",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.primary) }
        },
        s.value
      ), /* @__PURE__ */ React8.createElement("div", { "data-ut-slot": `hero.label`, className: "mt-1 text-xs uppercase tracking-widest", style: { color: hsl(theme.colors.mutedForeground) } }, s.label)))
    ))
  );
};

// src/sections/variants/hero/HeroSplitImage.tsx
import React9 from "react";
var HeroSplitImage = ({ section, theme }) => {
  const { headline, subheadline, ctas = [], badge, stats, image } = section.props;
  return /* @__PURE__ */ React9.createElement(
    "section",
    {
      "data-ut-variant": "hero:split-image",
      "data-ut-slot": "hero",
      className: "relative overflow-hidden",
      style: {
        padding: theme.sectionPadding,
        paddingTop: "clamp(5rem, 8vw, 7rem)",
        background: hsl(theme.colors.background)
      }
    },
    /* @__PURE__ */ React9.createElement(
      "div",
      {
        className: "mx-auto grid grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16",
        style: { maxWidth: theme.containerWidth }
      },
      /* @__PURE__ */ React9.createElement("div", { className: "flex flex-col gap-6" }, badge && /* @__PURE__ */ React9.createElement(
        "span",
        {
          "data-ut-slot": "hero.badge",
          className: "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
          style: {
            color: hsl(theme.colors.foreground),
            border: `1px solid ${hsla(theme.colors.border, 1)}`,
            fontFamily: theme.typography.bodyFont
          }
        },
        badge
      ), /* @__PURE__ */ React9.createElement(
        "h1",
        {
          "data-ut-slot": "hero.headline",
          className: "max-w-xl text-left leading-[1.05] tracking-tighter",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.foreground),
            fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
          }
        },
        headline
      ), subheadline && /* @__PURE__ */ React9.createElement(
        "p",
        {
          "data-ut-slot": "hero.subheadline",
          className: "max-w-md text-left text-xl leading-relaxed tracking-tight",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        subheadline
      ), ctas.length > 0 && /* @__PURE__ */ React9.createElement("div", { className: "flex flex-wrap gap-3" }, ctas.map((c, i) => /* @__PURE__ */ React9.createElement(
        "a",
        {
          key: i,
          href: c.href || "#",
          "data-ut-intent": c.intent ?? "nav.goto",
          "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
          className: "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          style: c.variant === "outline" ? {
            background: "transparent",
            color: hsl(theme.colors.foreground),
            border: `1px solid ${hsla(theme.colors.border, 1)}`,
            borderRadius: theme.radius,
            fontFamily: theme.typography.bodyFont
          } : {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius,
            fontFamily: theme.typography.bodyFont
          }
        },
        c.label
      ))), stats && stats.length > 0 && /* @__PURE__ */ React9.createElement("div", { className: "flex flex-wrap gap-8 pt-2" }, stats.map((s, i) => /* @__PURE__ */ React9.createElement("div", { key: i }, /* @__PURE__ */ React9.createElement(
        "div",
        {
          "data-ut-slot": `hero.value`,
          className: "text-2xl font-bold",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.primary) }
        },
        s.value
      ), /* @__PURE__ */ React9.createElement("div", { "data-ut-slot": `hero.label`, className: "mt-1 text-xs uppercase tracking-widest", style: { color: hsl(theme.colors.mutedForeground) } }, s.label))))),
      /* @__PURE__ */ React9.createElement(
        "div",
        {
          "data-ut-slot": "hero-media",
          className: "relative w-full overflow-hidden",
          style: { aspectRatio: "1 / 1", borderRadius: theme.radius, background: hsla(theme.colors.muted, 1) }
        },
        image && /* @__PURE__ */ React9.createElement(
          "img",
          {
            src: image,
            alt: "",
            loading: "lazy",
            className: "h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:hover:scale-[1.02]"
          }
        )
      )
    )
  );
};

// src/sections/variants/hero/HeroFullBleed.tsx
import React10 from "react";
var AURORA_KEYFRAMES = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes ut-hero-aurora-1 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    25% { transform: translate(18%, -18%) scale(1.2); }
    50% { transform: translate(-18%, 18%) scale(0.85); }
    75% { transform: translate(9%, -9%) scale(1.1); }
  }
  @keyframes ut-hero-aurora-2 {
    0%, 100% { transform: translate(0%, 0%) scale(1); }
    25% { transform: translate(-18%, 18%) scale(1.1); }
    50% { transform: translate(18%, -18%) scale(0.9); }
    75% { transform: translate(-9%, 9%) scale(1.2); }
  }
  .ut-hero-aurora-1 { animation: ut-hero-aurora-1 20s ease-in-out infinite; }
  .ut-hero-aurora-2 { animation: ut-hero-aurora-2 20s ease-in-out infinite; }
}
`;
var HeroFullBleed = ({ section, theme }) => {
  const { headline, subheadline, ctas = [], badge, stats, backgroundImage } = section.props;
  return /* @__PURE__ */ React10.createElement(
    "section",
    {
      "data-ut-variant": "hero:full-bleed",
      "data-ut-slot": "hero",
      className: "relative isolate flex items-center justify-center overflow-hidden",
      style: {
        minHeight: "85vh",
        background: backgroundImage ? `linear-gradient(${hsla(theme.colors.foreground, 0.58)}, ${hsla(theme.colors.foreground, 0.58)}), url(${backgroundImage}) center/cover no-repeat` : `linear-gradient(135deg, ${hsl(theme.colors.primary)}, ${hsl(theme.colors.secondary)})`
      }
    },
    /* @__PURE__ */ React10.createElement("style", null, AURORA_KEYFRAMES),
    /* @__PURE__ */ React10.createElement("div", { "aria-hidden": "true", className: "pointer-events-none absolute inset-0 -z-10" }, /* @__PURE__ */ React10.createElement(
      "div",
      {
        className: "ut-hero-aurora-1 absolute -top-1/4 left-1/4 h-96 w-96 rounded-full blur-3xl",
        style: { background: hsla(theme.colors.primary, 0.35) }
      }
    ), /* @__PURE__ */ React10.createElement(
      "div",
      {
        className: "ut-hero-aurora-2 absolute -bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl",
        style: { background: hsla(theme.colors.accent, 0.3) }
      }
    )),
    /* @__PURE__ */ React10.createElement("div", { className: "relative z-10 mx-auto px-5 py-16 text-center sm:px-8 md:py-20", style: { maxWidth: "820px" } }, badge && /* @__PURE__ */ React10.createElement(
      "span",
      {
        "data-ut-slot": "hero.badge",
        className: "mb-6 inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
        style: {
          color: hsl(theme.colors.primaryForeground),
          background: hsla(theme.colors.primaryForeground, 0.15),
          border: `1px solid ${hsla(theme.colors.primaryForeground, 0.25)}`,
          backdropFilter: "blur(4px)",
          fontFamily: theme.typography.bodyFont
        }
      },
      badge
    ), /* @__PURE__ */ React10.createElement(
      "h1",
      {
        "data-ut-slot": "hero.headline",
        className: "mb-6 text-balance leading-[1.05] tracking-tight",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.primaryForeground),
          fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)",
          textShadow: `0 2px 24px ${hsla(theme.colors.foreground, 0.35)}`
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React10.createElement(
      "p",
      {
        "data-ut-slot": "hero.subheadline",
        className: "mx-auto mb-9 max-w-xl text-lg leading-relaxed",
        style: { fontFamily: theme.typography.bodyFont, color: hsla(theme.colors.primaryForeground, 0.85) }
      },
      subheadline
    ), ctas.length > 0 && /* @__PURE__ */ React10.createElement("div", { className: "flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center" }, ctas.map((c, i) => /* @__PURE__ */ React10.createElement(
      "a",
      {
        key: i,
        href: c.href || "#",
        "data-ut-intent": c.intent ?? "nav.goto",
        "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
        className: "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        style: c.variant === "outline" ? {
          background: "transparent",
          color: hsl(theme.colors.primaryForeground),
          border: `1px solid ${hsla(theme.colors.primaryForeground, 0.4)}`,
          borderRadius: theme.radius,
          fontFamily: theme.typography.bodyFont
        } : {
          background: hsl(theme.colors.primaryForeground),
          color: hsl(theme.colors.primary),
          borderRadius: theme.radius,
          fontWeight: 600,
          fontFamily: theme.typography.bodyFont
        }
      },
      c.label
    ))), stats && stats.length > 0 && /* @__PURE__ */ React10.createElement("div", { className: "mt-10 grid grid-cols-2 gap-6 sm:mt-12 sm:flex sm:flex-wrap sm:justify-center sm:gap-10" }, stats.map((s, i) => /* @__PURE__ */ React10.createElement("div", { key: i, className: "text-center" }, /* @__PURE__ */ React10.createElement(
      "div",
      {
        "data-ut-slot": `hero.value`,
        className: "text-3xl font-bold",
        style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.primaryForeground) }
      },
      s.value
    ), /* @__PURE__ */ React10.createElement("div", { "data-ut-slot": `hero.label`, className: "mt-1 text-xs uppercase tracking-widest", style: { color: hsla(theme.colors.primaryForeground, 0.7) } }, s.label)))))
  );
};

// src/sections/variants/hero/HeroCommerceGradient.tsx
import React11 from "react";
var revealStyles2 = `
@keyframes ut-commerce-hero-rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: none; }
}
[data-ut-variant="hero:commerce-gradient"] [data-ut-rise] {
  animation: ut-commerce-hero-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="hero:commerce-gradient"] [data-ut-rise] {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
`;
var HeroCommerceGradient = ({ section, theme }) => {
  const { headline, subheadline, description, ctas = [], badge } = section.props;
  return /* @__PURE__ */ React11.createElement(
    "section",
    {
      "data-ut-variant": "hero:commerce-gradient",
      "data-ut-slot": "hero",
      className: "relative overflow-hidden",
      style: {
        padding: theme.sectionPadding,
        background: hsl(theme.colors.background)
      }
    },
    /* @__PURE__ */ React11.createElement("style", null, revealStyles2),
    /* @__PURE__ */ React11.createElement("div", { className: "mx-auto", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React11.createElement(
      "div",
      {
        className: "relative overflow-hidden px-6 py-20 md:py-28 text-center",
        style: {
          borderRadius: `calc(${theme.radius} * 3)`,
          background: hsla(theme.colors.accent, 0.5),
          border: `1px solid ${hsla(theme.colors.border, 1)}`
        }
      },
      badge && /* @__PURE__ */ React11.createElement(
        "span",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.badge",
          className: "inline-block text-xs font-medium tracking-wide uppercase mb-6 px-3 py-1 rounded-full",
          style: {
            color: hsl(theme.colors.primary),
            background: hsla(theme.colors.primary, 0.1),
            border: `1px solid ${hsla(theme.colors.primary, 0.18)}`,
            animationDelay: "0.05s"
          }
        },
        badge
      ),
      /* @__PURE__ */ React11.createElement(
        "h1",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.headline",
          className: "font-bold tracking-tight leading-tight mb-6 mx-auto",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            fontSize: "clamp(2.25rem, 6vw, 4.25rem)",
            maxWidth: "18ch",
            backgroundImage: `linear-gradient(90deg, ${hsl(theme.colors.primary)}, ${hsla(theme.colors.primary, 0.7)})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            animationDelay: "0.15s"
          }
        },
        headline
      ),
      subheadline && /* @__PURE__ */ React11.createElement(
        "p",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.subheadline",
          className: "text-base md:text-lg leading-relaxed mx-auto",
          style: {
            fontFamily: theme.typography.bodyFont,
            color: hsl(theme.colors.mutedForeground),
            maxWidth: "42rem",
            animationDelay: "0.3s"
          }
        },
        subheadline
      ),
      description && /* @__PURE__ */ React11.createElement(
        "p",
        {
          "data-ut-slot": "hero.description",
          "data-ut-rise": true,
          className: "text-sm md:text-base leading-relaxed mx-auto mt-4",
          style: {
            fontFamily: theme.typography.bodyFont,
            color: hsla(theme.colors.mutedForeground, 0.85),
            maxWidth: "40rem",
            animationDelay: "0.35s"
          }
        },
        description
      ),
      ctas.length > 0 && /* @__PURE__ */ React11.createElement("div", { "data-ut-rise": true, className: "flex gap-3 flex-wrap justify-center mt-10", style: { animationDelay: "0.45s" } }, ctas.map((c, i) => /* @__PURE__ */ React11.createElement(
        "a",
        {
          key: `${c.label}-${i}`,
          href: c.href || "#",
          "data-ut-intent": c.intent ?? "nav.goto",
          "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
          className: "inline-flex items-center gap-2 text-sm font-medium px-6 py-3 motion-safe:transition-opacity hover:opacity-90",
          style: i === 0 && c.variant !== "outline" ? {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: `calc(${theme.radius} * 4)`
          } : {
            background: hsl(theme.colors.background),
            color: hsl(theme.colors.foreground),
            border: `1px solid ${hsla(theme.colors.border, 1)}`,
            borderRadius: `calc(${theme.radius} * 4)`
          }
        },
        c.label
      )))
    ))
  );
};

// src/sections/variants/hero/HeroShowcasePanel.tsx
import React12 from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Home = __LucideIcons['Home'] || __LucideFallback;
var revealStyles3 = `
@keyframes ut-showcase-panel-rise {
  from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
  to   { opacity: 1; transform: none; filter: blur(0); }
}
[data-ut-variant="hero:showcase-panel"] [data-ut-rise] {
  animation: ut-showcase-panel-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  [data-ut-variant="hero:showcase-panel"] [data-ut-rise] {
    animation: none;
    opacity: 1;
    transform: none;
    filter: none;
  }
}
`;
var HeroShowcasePanel = ({ section, theme }) => {
  const { headline, subheadline, description, ctas = [], badge, image, stats = [] } = section.props;
  return /* @__PURE__ */ React12.createElement(
    "section",
    {
      "data-ut-variant": "hero:showcase-panel",
      "data-ut-slot": "hero",
      className: "relative isolate w-full overflow-hidden",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React12.createElement("style", null, revealStyles3),
    /* @__PURE__ */ React12.createElement(
      "div",
      {
        className: "relative z-10 mx-auto flex flex-col items-center gap-10 px-6 md:gap-14",
        style: { maxWidth: theme.containerWidth }
      },
      /* @__PURE__ */ React12.createElement("div", { className: "flex w-full max-w-2xl flex-col items-center gap-5 text-center" }, badge && /* @__PURE__ */ React12.createElement(
        "span",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.badge",
          className: "inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide",
          style: {
            color: hsl(theme.colors.primary),
            background: hsla(theme.colors.primary, 0.1),
            border: `1px solid ${hsla(theme.colors.primary, 0.18)}`
          }
        },
        badge
      ), /* @__PURE__ */ React12.createElement(
        "h1",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.headline",
          className: "text-balance font-semibold tracking-tight",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            fontSize: "clamp(1.875rem, 5vw, 3rem)",
            color: hsl(theme.colors.foreground),
            animationDelay: "0.1s"
          }
        },
        headline
      ), subheadline && /* @__PURE__ */ React12.createElement(
        "p",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.subheadline",
          className: "text-balance text-sm leading-relaxed sm:text-base",
          style: {
            fontFamily: theme.typography.bodyFont,
            color: hsl(theme.colors.mutedForeground),
            maxWidth: "36rem",
            animationDelay: "0.2s"
          }
        },
        subheadline
      ), description && /* @__PURE__ */ React12.createElement(
        "p",
        {
          "data-ut-slot": "hero.description",
          "data-ut-rise": true,
          className: "text-sm leading-relaxed",
          style: {
            fontFamily: theme.typography.bodyFont,
            color: hsla(theme.colors.mutedForeground, 0.85),
            maxWidth: "34rem",
            animationDelay: "0.25s"
          }
        },
        description
      ), ctas.length > 0 && /* @__PURE__ */ React12.createElement("div", { "data-ut-rise": true, className: "flex flex-wrap items-center justify-center gap-3", style: { animationDelay: "0.3s" } }, ctas.map((c, i) => /* @__PURE__ */ React12.createElement(
        "a",
        {
          key: `${c.label}-${i}`,
          href: c.href || "#",
          "data-ut-intent": c.intent ?? "nav.goto",
          "data-ut-cta": i === 0 ? "cta.hero" : "cta.hero-secondary",
          className: "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90",
          style: i === 0 && c.variant !== "outline" ? {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: `calc(${theme.radius} * 2)`
          } : {
            background: hsl(theme.colors.background),
            color: hsl(theme.colors.foreground),
            border: `1px solid ${hsl(theme.colors.border)}`,
            borderRadius: `calc(${theme.radius} * 2)`
          }
        },
        c.label
      )))),
      image && /* @__PURE__ */ React12.createElement(
        "div",
        {
          "data-ut-rise": true,
          "data-ut-slot": "hero.media",
          className: "relative w-full overflow-hidden",
          style: {
            borderRadius: `calc(${theme.radius} * 2.5)`,
            border: `1px solid ${hsl(theme.colors.border)}`,
            animationDelay: "0.35s"
          }
        },
        /* @__PURE__ */ React12.createElement(
          "img",
          {
            src: image,
            alt: headline || "",
            loading: "lazy",
            decoding: "async",
            className: "h-[18rem] w-full object-cover sm:h-[24rem]"
          }
        ),
        /* @__PURE__ */ React12.createElement(
          "div",
          {
            "aria-hidden": true,
            className: "pointer-events-none absolute inset-0",
            style: {
              background: `linear-gradient(to top, ${hsla(theme.colors.foreground, 0.16)}, transparent 55%)`
            }
          }
        )
      ),
      stats.length > 0 && /* @__PURE__ */ React12.createElement(
        "div",
        {
          "data-ut-rise": true,
          className: "flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-4 pt-8",
          style: { borderTop: `1px solid ${hsl(theme.colors.border)}`, animationDelay: "0.45s" }
        },
        stats.map((s, i) => /* @__PURE__ */ React12.createElement("div", { key: `${s.label}-${i}`, className: "text-center" }, /* @__PURE__ */ React12.createElement(
          "div",
          {
            "data-ut-slot": `hero.value`,
            className: "text-xl font-semibold tracking-tight",
            style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
          },
          s.value
        ), /* @__PURE__ */ React12.createElement(
          "div",
          {
            "data-ut-slot": `hero.label`,
            className: "text-sm font-medium tracking-tight",
            style: { fontFamily: theme.typography.bodyFont, color: hsla(theme.colors.mutedForeground, 0.7) }
          },
          s.label
        )))
      )
    )
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "hero:image-stream": HeroImageStream, "hero:launch-showcase": HeroLaunchShowcase, "hero:prisma-cinematic": HeroPrismaCinematic, "hero:image-fan": HeroImageFan, "hero:variable-type": HeroVariableType, "hero:underline": HeroUnderline, "hero:editorial-banner": HeroEditorialBanner, "hero:centered": HeroCentered, "hero:split-image": HeroSplitImage, "hero:full-bleed": HeroFullBleed, "hero:page-title": HeroPageTitle, "hero:commerce-gradient": HeroCommerceGradient, "hero:showcase-panel": HeroShowcasePanel };
export {
  REGISTERED_VARIANTS
};
