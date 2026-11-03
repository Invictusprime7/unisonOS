/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/gallery/GalleryCaseStudy.tsx
import React4 from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/gallery/GalleryFrame.tsx
import React3, { useMemo, useState as useState2 } from "react";

// src/sections/variants/gallery/GalleryLightbox.tsx
import React2, { useRef } from "react";
import * as Dialog from "../../ui/radix/dialog";
import { ChevronLeft, ChevronRight, X } from "../../ui/icons";

// src/sections/variants/gallery/GalleryImage.tsx
import React, { useState } from "react";
import { ImageOff } from "../../ui/icons";
var GalleryImageSource = ({ src, alt, theme, className, style, loading }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        role: "img",
        "aria-label": alt ? `${alt}: image unavailable` : "Image unavailable",
        className: "flex h-full min-h-48 w-full min-w-0 flex-col items-center justify-center gap-3 p-6 text-center",
        style: { ...style, background: hsl(theme.colors.muted), color: hsl(theme.colors.mutedForeground) }
      },
      /* @__PURE__ */ React.createElement(ImageOff, { "aria-hidden": "true", size: 28 }),
      /* @__PURE__ */ React.createElement("span", { className: "text-sm" }, "Image unavailable")
    );
  }
  return /* @__PURE__ */ React.createElement("img", { src, alt, loading, className, style, onError: () => setFailed(true) });
};
var GalleryImage = (props) => /* @__PURE__ */ React.createElement(GalleryImageSource, { key: props.src, ...props });

// src/sections/variants/gallery/GalleryLightbox.tsx
var GalleryLightbox = ({ items, index, theme, onClose, onNavigate }) => {
  const returnFocus = useRef(null);
  const reducedMotion = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  const item = index === null ? void 0 : items[index];
  return /* @__PURE__ */ React2.createElement(Dialog.Root, { open: Boolean(item), onOpenChange: (open) => {
    if (!open) onClose();
  } }, /* @__PURE__ */ React2.createElement(Dialog.Portal, null, /* @__PURE__ */ React2.createElement(Dialog.Overlay, { className: "fixed inset-0 z-50" }), item && /* @__PURE__ */ React2.createElement(
    Dialog.Content,
    {
      "aria-describedby": void 0,
      onOpenAutoFocus: () => {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      },
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        if (returnFocus.current?.isConnected) returnFocus.current.focus();
      },
      onKeyDown: (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        event.stopPropagation();
        onNavigate(((index ?? 0) + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length);
      },
      onClick: (event) => {
        if (event.target === event.currentTarget) onClose();
      },
      className: "fixed inset-0 z-50 flex items-center justify-center p-6",
      style: {
        background: hsla(theme.colors.foreground, 0.92),
        transition: reducedMotion ? "none" : "opacity 200ms ease"
      }
    },
    /* @__PURE__ */ React2.createElement(Dialog.Title, { className: "sr-only" }, item.alt || item.caption || "Gallery image"),
    /* @__PURE__ */ React2.createElement(Dialog.Close, { asChild: true }, /* @__PURE__ */ React2.createElement(
      "button",
      {
        "data-ut-intent": "ui.toggle",
        type: "button",
        "aria-label": "Close gallery",
        className: "absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        style: { background: hsla(theme.colors.background, 0.14), color: hsl(theme.colors.background) }
      },
      /* @__PURE__ */ React2.createElement(X, { "aria-hidden": "true", size: 20 })
    )),
    items.length > 1 && /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement(
      "button",
      {
        "data-ut-intent": "ui.toggle",
        type: "button",
        "aria-label": "Previous image",
        onClick: () => onNavigate(((index ?? 0) - 1 + items.length) % items.length),
        className: "absolute left-4 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        style: { background: hsla(theme.colors.background, 0.14), color: hsl(theme.colors.background) }
      },
      /* @__PURE__ */ React2.createElement(ChevronLeft, { "aria-hidden": "true", size: 20 })
    ), /* @__PURE__ */ React2.createElement(
      "button",
      {
        "data-ut-intent": "ui.toggle",
        type: "button",
        "aria-label": "Next image",
        onClick: () => onNavigate(((index ?? 0) + 1) % items.length),
        className: "absolute right-4 inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        style: { background: hsla(theme.colors.background, 0.14), color: hsl(theme.colors.background) }
      },
      /* @__PURE__ */ React2.createElement(ChevronRight, { "aria-hidden": "true", size: 20 })
    )),
    /* @__PURE__ */ React2.createElement("figure", { className: "m-0 max-h-full max-w-5xl", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React2.createElement(
      GalleryImage,
      {
        src: item.src,
        alt: item.alt || item.caption || "",
        theme,
        className: "max-h-[var(--ut-overlay-block)] w-auto object-contain",
        style: { borderRadius: theme.radius }
      }
    ), /* @__PURE__ */ React2.createElement("p", { role: "status", "aria-live": "polite", className: "sr-only" }, `Image ${(index ?? 0) + 1} of ${items.length}: ${item.alt || item.caption || "Gallery image"}`), item.category && /* @__PURE__ */ React2.createElement(
      "p",
      {
        className: "mt-3 text-center text-xs uppercase tracking-widest",
        style: { fontFamily: theme.typography.bodyFont, color: hsla(theme.colors.background, 0.72) }
      },
      item.category
    ), item.caption && /* @__PURE__ */ React2.createElement(
      "figcaption",
      {
        className: "mt-3 text-center text-sm",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.background) }
      },
      item.caption
    ))
  )));
};

// src/sections/variants/gallery/galleryUtils.ts
function normalizeGalleryItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw || {};
    const src = item.src || item.image || item.url || item.photo;
    if (!src) return null;
    return {
      src,
      alt: item.alt || item.title || item.caption || "",
      caption: item.caption || item.title || "",
      category: item.category || item.tag || ""
    };
  }).filter(Boolean);
}
function galleryCategories(items) {
  return Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
}

// src/sections/variants/gallery/GalleryFrame.tsx
var GalleryFrame = ({
  variantId,
  theme,
  headline,
  subheadline,
  items,
  filterable,
  children
}) => {
  const media = useMemo(() => normalizeGalleryItems(items), [items]);
  const categories = useMemo(() => galleryCategories(media), [media]);
  const [selected, setActive] = useState2("all");
  const active = filterable !== false && categories.length > 1 && categories.includes(selected) ? selected : "all";
  const [lightboxIndex, setLightboxIndex] = useState2(null);
  const visible = active === "all" ? media : media.filter((item) => item.category === active);
  return /* @__PURE__ */ React3.createElement(
    "section",
    {
      "data-ut-variant": variantId,
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React3.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, (headline || subheadline) && /* @__PURE__ */ React3.createElement("div", { className: "mb-8 text-center md:mb-12" }, headline && /* @__PURE__ */ React3.createElement(
      "h2",
      {
        "data-ut-slot": "gallery.headline",
        className: "mb-3 text-2xl sm:text-3xl md:text-4xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), subheadline && /* @__PURE__ */ React3.createElement(
      "p",
      {
        "data-ut-slot": "gallery.subheadline",
        className: "mx-auto max-w-xl text-base",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      subheadline
    )), filterable !== false && categories.length > 1 && /* @__PURE__ */ React3.createElement("div", { className: "mb-10 flex flex-wrap justify-center gap-2" }, ["all", ...categories].map((category) => /* @__PURE__ */ React3.createElement(
      "button",
      {
        "data-ut-intent": "ui.toggle",
        key: category,
        type: "button",
        "aria-pressed": active === category,
        onClick: () => setActive(category),
        className: "rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-colors",
        style: active === category ? {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderColor: hsl(theme.colors.primary)
        } : {
          background: "transparent",
          color: hsl(theme.colors.mutedForeground),
          borderColor: hsla(theme.colors.border, 0.7)
        }
      },
      category
    ))), children({ items: visible, open: setLightboxIndex })),
    /* @__PURE__ */ React3.createElement(
      GalleryLightbox,
      {
        items: visible,
        index: lightboxIndex,
        theme,
        onClose: () => setLightboxIndex(null),
        onNavigate: setLightboxIndex
      }
    )
  );
};
var GalleryFigure = ({ item, theme, className = "", aspect, onOpen }) => /* @__PURE__ */ React3.createElement(
  "figure",
  {
    className: `group relative m-0 overflow-hidden ${className}`,
    style: {
      borderRadius: theme.radius,
      border: `1px solid ${hsla(theme.colors.border, 0.4)}`,
      background: hsl(theme.colors.muted),
      aspectRatio: aspect
    }
  },
  /* @__PURE__ */ React3.createElement(
    "button",
    {
      "data-ut-intent": "ui.toggle",
      type: "button",
      onClick: onOpen,
      "aria-label": item.alt || item.caption || "Open image",
      className: "block h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
    },
    /* @__PURE__ */ React3.createElement(
      GalleryImage,
      {
        src: item.src,
        alt: item.alt || "",
        theme,
        loading: "lazy",
        className: "h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105"
      }
    )
  ),
  item.caption && /* @__PURE__ */ React3.createElement(
    "figcaption",
    {
      className: "pointer-events-none absolute inset-x-0 bottom-0 p-4 text-sm opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100",
      style: {
        background: `linear-gradient(to top, ${hsla(theme.colors.foreground, 0.82)}, transparent)`,
        color: hsl(theme.colors.background),
        fontFamily: theme.typography.bodyFont
      }
    },
    item.caption,
    item.category && /* @__PURE__ */ React3.createElement("span", { className: "ml-2 text-xs uppercase tracking-widest opacity-80" }, item.category)
  )
);

// src/sections/variants/gallery/GalleryCaseStudy.tsx
function GalleryCaseStudy({ section, theme }) {
  const { headline, subheadline, items, filterable } = section.props;
  return /* @__PURE__ */ React4.createElement(
    GalleryFrame,
    {
      variantId: "gallery:case-study",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React4.createElement("div", { className: "space-y-10" }, media.map((item, index) => /* @__PURE__ */ React4.createElement(
      "article",
      {
        key: index,
        "data-ut-slot": `project-${index}`,
        className: "grid items-center gap-6 border-t pt-8 md:grid-cols-[2fr_1fr] md:gap-10",
        style: { borderColor: hsl(theme.colors.border) }
      },
      /* @__PURE__ */ React4.createElement(GalleryFigure, { item, theme, aspect: "16 / 10", onOpen: () => open(index) }),
      /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement(
        "p",
        {
          className: "mb-4 text-xs uppercase tracking-widest",
          style: { color: hsl(theme.colors.mutedForeground) }
        },
        item.category || `Project ${String(index + 1).padStart(2, "0")}`
      ), /* @__PURE__ */ React4.createElement(
        "h3",
        {
          className: "text-2xl sm:text-3xl",
          style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
        },
        item.caption || item.alt
      ), /* @__PURE__ */ React4.createElement(
        "button",
        {
          "data-ut-intent": "ui.toggle",
          type: "button",
          onClick: () => open(index),
          className: "mt-6 min-h-11 text-sm underline underline-offset-4",
          style: { color: hsl(theme.colors.foreground) }
        },
        "View image",
        /* @__PURE__ */ React4.createElement("span", { className: "sr-only" }, ": ", item.alt),
        " \u2197"
      ))
    )))
  );
}

// src/sections/variants/gallery/GalleryEditorialMosaic.tsx
import React5 from "react";
var GalleryEditorialMosaic = ({ section, theme }) => {
  const { headline, subheadline, items, filterable } = section.props;
  return /* @__PURE__ */ React5.createElement(
    GalleryFrame,
    {
      variantId: "gallery:editorial-mosaic",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React5.createElement("div", { className: "grid auto-rows-[var(--ut-tile-block)] grid-cols-2 gap-4 lg:grid-cols-4" }, media.map((item, i) => /* @__PURE__ */ React5.createElement(
      GalleryFigure,
      {
        key: i,
        item,
        theme,
        onOpen: () => open(i),
        className: i % 5 === 0 ? "col-span-2 row-span-2" : i % 7 === 3 ? "col-span-2" : ""
      }
    )))
  );
};

// src/sections/variants/gallery/GalleryMasonry.tsx
import React6 from "react";
var GalleryMasonry = ({ section, theme }) => {
  const { headline, subheadline, items, filterable, columns = 3 } = section.props;
  const desktopColumns = columns === 2 ? "lg:columns-2" : columns === 4 ? "lg:columns-4" : "lg:columns-3";
  return /* @__PURE__ */ React6.createElement(
    GalleryFrame,
    {
      variantId: "gallery:masonry",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React6.createElement(
      "div",
      {
        className: `columns-1 sm:columns-2 ${desktopColumns} [column-fill:_balance] gap-4`
      },
      media.map((item, i) => /* @__PURE__ */ React6.createElement("div", { key: i, className: "mb-4 break-inside-avoid" }, /* @__PURE__ */ React6.createElement(
        GalleryFigure,
        {
          item,
          theme,
          onOpen: () => open(i),
          aspect: i % 3 === 0 ? "3 / 4" : i % 3 === 1 ? "1 / 1" : "4 / 5"
        }
      )))
    )
  );
};

// src/sections/variants/gallery/GalleryCinematicGrid.tsx
import React7 from "react";
var GalleryCinematicGrid = ({ section, theme }) => {
  const { headline, subheadline, items, filterable, columns = 3 } = section.props;
  const desktopColumns = columns === 2 ? "lg:grid-cols-2" : columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return /* @__PURE__ */ React7.createElement(
    GalleryFrame,
    {
      variantId: "gallery:cinematic-grid",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React7.createElement("div", { className: `grid grid-cols-1 sm:grid-cols-2 ${desktopColumns} gap-5` }, media.map((item, i) => /* @__PURE__ */ React7.createElement(GalleryFigure, { key: i, item, theme, aspect: "16 / 9", onOpen: () => open(i) })))
  );
};

// src/sections/variants/gallery/GalleryLightboxGrid.tsx
import React8 from "react";
var GalleryLightboxGrid = ({ section, theme }) => {
  const { headline, subheadline, items, filterable, columns = 3 } = section.props;
  const desktopColumns = columns === 2 ? "lg:grid-cols-2" : columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return /* @__PURE__ */ React8.createElement(
    GalleryFrame,
    {
      variantId: "gallery:lightbox-grid",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React8.createElement("div", { className: `grid grid-cols-1 sm:grid-cols-2 ${desktopColumns} gap-3` }, media.map((item, i) => /* @__PURE__ */ React8.createElement(GalleryFigure, { key: i, item, theme, aspect: "1 / 1", onOpen: () => open(i) })))
  );
};

// src/sections/variants/gallery/GalleryFeatureSplit.tsx
import React9 from "react";
var GalleryFeatureSplit = ({ section, theme }) => {
  const { headline, subheadline, items, filterable } = section.props;
  return /* @__PURE__ */ React9.createElement(
    GalleryFrame,
    {
      variantId: "gallery:feature-split",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => {
      const [feature, ...rest] = media;
      if (!feature) return null;
      return /* @__PURE__ */ React9.createElement("div", { className: "grid gap-4 lg:grid-cols-2" }, /* @__PURE__ */ React9.createElement(GalleryFigure, { item: feature, theme, aspect: "4 / 5", onOpen: () => open(0) }), /* @__PURE__ */ React9.createElement("div", { className: "grid grid-cols-2 gap-4 self-start" }, rest.map((item, i) => /* @__PURE__ */ React9.createElement(GalleryFigure, { key: i, item, theme, aspect: "1 / 1", onOpen: () => open(i + 1) }))));
    }
  );
};

// src/sections/variants/gallery/GalleryHorizontalReel.tsx
import React10 from "react";
var GalleryHorizontalReel = ({ section, theme }) => {
  const { headline, subheadline, items, filterable } = section.props;
  return /* @__PURE__ */ React10.createElement(
    GalleryFrame,
    {
      variantId: "gallery:horizontal-reel",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React10.createElement("div", { className: "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" }, media.map((item, i) => /* @__PURE__ */ React10.createElement("div", { key: i, className: "w-[78%] flex-none snap-start sm:w-[46%] lg:w-[32%]" }, /* @__PURE__ */ React10.createElement(GalleryFigure, { item, theme, aspect: "4 / 5", onOpen: () => open(i) }))))
  );
};

// src/sections/variants/gallery/GalleryCollectionTiles.tsx
import React11 from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideFallback;
const ArrowLeft = __LucideIcons['ArrowLeft'] || __LucideFallback;
var ArrowUpRight = () => /* @__PURE__ */ React11.createElement(
  "svg",
  {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  },
  /* @__PURE__ */ React11.createElement("path", { d: "M7 17 17 7" }),
  /* @__PURE__ */ React11.createElement("path", { d: "M7 7h10v10" })
);
var GalleryCollectionTiles = ({ section, theme }) => {
  const { headline, subheadline, items, filterable, columns = 4 } = section.props;
  const desktopColumns = columns === 2 ? "lg:grid-cols-2" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return /* @__PURE__ */ React11.createElement(
    GalleryFrame,
    {
      variantId: "gallery:collection-tiles",
      theme,
      headline,
      subheadline,
      items,
      filterable
    },
    ({ items: media, open }) => /* @__PURE__ */ React11.createElement("div", { className: `grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 ${desktopColumns}` }, media.map((item, i) => /* @__PURE__ */ React11.createElement(
      "div",
      {
        key: i,
        className: "group relative overflow-hidden",
        style: {
          borderRadius: `calc(${theme.radius} * 3)`,
          background: hsla(theme.colors.muted, 0.5),
          border: `1px solid ${hsla(theme.colors.border, 0.4)}`,
          minHeight: "18rem"
        }
      },
      /* @__PURE__ */ React11.createElement(
        "button",
        {
          "data-ut-intent": "ui.toggle",
          type: "button",
          onClick: () => open(i),
          "aria-label": item.alt || item.caption || "Open image",
          className: "block h-full w-full cursor-pointer border-0 bg-transparent p-6 text-center"
        },
        /* @__PURE__ */ React11.createElement(
          "span",
          {
            className: "relative z-10 block text-2xl font-bold sm:text-3xl",
            style: {
              fontFamily: theme.typography.headingFont,
              fontWeight: theme.typography.headingWeight,
              color: hsl(theme.colors.primary)
            }
          },
          item.caption || item.category || item.alt
        ),
        /* @__PURE__ */ React11.createElement("span", { className: "absolute inset-0 flex items-center justify-center p-6" }, /* @__PURE__ */ React11.createElement(
          GalleryImage,
          {
            src: item.src,
            alt: item.alt || "",
            theme,
            loading: "lazy",
            className: "h-auto w-full max-w-[45%] object-contain opacity-90 transition-transform duration-500 motion-reduce:transition-none group-hover:scale-110"
          }
        ))
      ),
      /* @__PURE__ */ React11.createElement(
        "span",
        {
          "aria-hidden": "true",
          className: "pointer-events-none absolute bottom-0 right-0 z-10 flex h-16 w-16 items-center justify-center md:h-20 md:w-20",
          style: {
            background: hsl(theme.colors.background),
            borderTopLeftRadius: `calc(${theme.radius} * 2)`,
            borderLeft: `1px solid ${hsla(theme.colors.border, 0.4)}`,
            borderTop: `1px solid ${hsla(theme.colors.border, 0.4)}`
          }
        },
        /* @__PURE__ */ React11.createElement(
          "span",
          {
            className: "flex h-10 w-10 items-center justify-center transition-transform duration-300 motion-reduce:transition-none group-hover:scale-110 md:h-12 md:w-12",
            style: {
              borderRadius: "9999px",
              background: hsl(theme.colors.secondary),
              color: hsl(theme.colors.secondaryForeground)
            }
          },
          /* @__PURE__ */ React11.createElement(ArrowUpRight, null)
        )
      )
    )))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "gallery:case-study": GalleryCaseStudy, "gallery:editorial-mosaic": GalleryEditorialMosaic, "gallery:masonry": GalleryMasonry, "gallery:cinematic-grid": GalleryCinematicGrid, "gallery:lightbox-grid": GalleryLightboxGrid, "gallery:feature-split": GalleryFeatureSplit, "gallery:horizontal-reel": GalleryHorizontalReel, "gallery:collection-tiles": GalleryCollectionTiles };
export {
  REGISTERED_VARIANTS
};
