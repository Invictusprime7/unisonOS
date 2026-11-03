/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/blogPreview/BlogPreviewFourColumns.tsx
import React2 from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;

// src/sections/variants/blogPreview/BlogPreviewFrame.tsx
import React from "react";
var normalizePosts = (posts, items) => {
  const source = Array.isArray(posts) && posts.length ? posts : Array.isArray(items) ? items : [];
  return source.map((raw) => {
    const entry = raw || {};
    const title = String(entry.title ?? entry.name ?? entry.headline ?? "").trim();
    if (!title) return null;
    return {
      title,
      excerpt: entry.excerpt ? String(entry.excerpt) : entry.description ? String(entry.description) : void 0,
      image: entry.image ? String(entry.image) : void 0,
      date: entry.date ? String(entry.date) : void 0,
      author: entry.author ? String(entry.author) : void 0,
      href: entry.href ? String(entry.href) : "#"
    };
  }).filter(Boolean);
};
var PostMeta = ({ theme, post }) => {
  const meta = [post.date, post.author].filter(Boolean).join(" \xB7 ");
  if (!meta) return null;
  return /* @__PURE__ */ React.createElement(
    "p",
    {
      className: "mb-2 text-xs uppercase",
      style: { fontFamily: theme.typography.bodyFont, letterSpacing: "0.12em", color: hsl(theme.colors.mutedForeground) }
    },
    meta
  );
};
var PostLink = ({ theme, href, label }) => /* @__PURE__ */ React.createElement(
  "a",
  {
    "data-ut-intent": "nav.goto",
    href,
    className: "mt-auto inline-block text-sm",
    style: { fontFamily: theme.typography.bodyFont, fontWeight: 600, color: hsl(theme.colors.primary), textDecoration: "none" }
  },
  label || "Read more"
);
var BlogPreviewFrame = ({ variantId, theme, headline, subheadline, surface = "background", children }) => /* @__PURE__ */ React.createElement(
  "section",
  {
    "data-ut-variant": variantId,
    style: {
      padding: theme.sectionPadding,
      background: hsl(surface === "muted" ? theme.colors.muted : theme.colors.background)
    }
  },
  /* @__PURE__ */ React.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, (headline || subheadline) && /* @__PURE__ */ React.createElement("div", { className: "mb-8 max-w-2xl md:mb-12" }, headline && /* @__PURE__ */ React.createElement(
    "h2",
    {
      "data-ut-slot": "blog-preview.headline",
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
      "data-ut-slot": "blog-preview.subheadline",
      className: "text-lg",
      style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
    },
    subheadline
  )), children)
);

// src/sections/variants/blogPreview/BlogPreviewFourColumns.tsx
var BlogPreviewFourColumns = ({ section, theme }) => /* @__PURE__ */ React2.createElement(BlogPreviewFrame, { variantId: "blog-preview:four-columns", theme, headline: section.props.headline }, /* @__PURE__ */ React2.createElement("div", { className: "grid gap-8 sm:grid-cols-2 lg:grid-cols-4" }, normalizePosts(section.props.posts, section.props.items).map((post, i) => /* @__PURE__ */ React2.createElement("article", { key: i, className: "flex flex-col gap-3" }, post.image && /* @__PURE__ */ React2.createElement("a", { "data-ut-intent": "nav.goto", href: post.href, tabIndex: -1, "aria-hidden": "true" }, /* @__PURE__ */ React2.createElement("img", { src: post.image, alt: "", loading: "lazy", className: "aspect-video w-full object-cover", style: { borderRadius: theme.radius } })), /* @__PURE__ */ React2.createElement(PostMeta, { post, theme }), /* @__PURE__ */ React2.createElement("h3", { className: "text-xl", style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) } }, /* @__PURE__ */ React2.createElement("a", { "data-ut-intent": "nav.goto", href: post.href, className: "underline-offset-4 hover:underline" }, post.title)), post.excerpt && /* @__PURE__ */ React2.createElement("p", { "data-ut-slot": `blog-preview.excerpt`, className: "text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, post.excerpt)))));

// src/sections/variants/blogPreview/BlogPreviewEditorial.tsx
import React3 from "react";
var BlogPreviewEditorial = ({ section, theme }) => {
  const posts = normalizePosts(section.props.posts, section.props.items);
  const [lead, ...rest] = posts;
  return /* @__PURE__ */ React3.createElement(
    BlogPreviewFrame,
    {
      variantId: "blog-preview:editorial",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React3.createElement("div", { className: "grid gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" }, lead && /* @__PURE__ */ React3.createElement("article", { className: "flex flex-col" }, lead.image && /* @__PURE__ */ React3.createElement(
      "img",
      {
        src: lead.image,
        alt: lead.title,
        loading: "lazy",
        style: { borderRadius: theme.radius, aspectRatio: "16 / 10", objectFit: "cover", width: "100%" }
      }
    ), /* @__PURE__ */ React3.createElement("div", { className: "mt-6 flex flex-1 flex-col" }, /* @__PURE__ */ React3.createElement(PostMeta, { theme, post: lead }), /* @__PURE__ */ React3.createElement(
      "h3",
      {
        "data-ut-slot": `blog-preview.title`,
        className: "mb-3 text-2xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      lead.title
    ), lead.excerpt && /* @__PURE__ */ React3.createElement(
      "p",
      {
        "data-ut-slot": `blog-preview.excerpt`,
        className: "mb-5 text-base leading-relaxed",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      lead.excerpt
    ), /* @__PURE__ */ React3.createElement(PostLink, { theme, href: lead.href, label: "Read the story" }))), /* @__PURE__ */ React3.createElement("div", { className: "flex flex-col" }, rest.map((post, i) => /* @__PURE__ */ React3.createElement(
      "article",
      {
        key: i,
        className: "flex flex-col py-6",
        style: { borderTop: i === 0 ? "none" : `1px solid ${hsl(theme.colors.border)}` }
      },
      /* @__PURE__ */ React3.createElement(PostMeta, { theme, post }),
      /* @__PURE__ */ React3.createElement(
        "h3",
        {
          "data-ut-slot": `blog-preview.title`,
          className: "mb-2 text-lg",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.foreground)
          }
        },
        post.title
      ),
      post.excerpt && /* @__PURE__ */ React3.createElement(
        "p",
        {
          "data-ut-slot": `blog-preview.excerpt`,
          className: "mb-3 text-sm leading-relaxed",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        post.excerpt
      ),
      /* @__PURE__ */ React3.createElement(PostLink, { theme, href: post.href })
    ))))
  );
};

// src/sections/variants/blogPreview/BlogPreviewFeaturedGrid.tsx
import React4 from "react";
var BlogPreviewFeaturedGrid = ({ section, theme }) => {
  const posts = normalizePosts(section.props.posts, section.props.items);
  return /* @__PURE__ */ React4.createElement(
    BlogPreviewFrame,
    {
      variantId: "blog-preview:featured-grid",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline,
      surface: "muted"
    },
    /* @__PURE__ */ React4.createElement("div", { className: "grid gap-8 sm:grid-cols-2 lg:grid-cols-3" }, posts.map((post, i) => /* @__PURE__ */ React4.createElement(
      "article",
      {
        key: i,
        className: "flex flex-col overflow-hidden",
        style: {
          borderRadius: theme.radius,
          border: `1px solid ${hsl(theme.colors.border)}`,
          background: hsl(theme.colors.card),
          color: hsl(theme.colors.cardForeground)
        }
      },
      post.image && /* @__PURE__ */ React4.createElement(
        "img",
        {
          src: post.image,
          alt: post.title,
          loading: "lazy",
          style: { aspectRatio: "16 / 10", objectFit: "cover", width: "100%" }
        }
      ),
      /* @__PURE__ */ React4.createElement("div", { className: "flex flex-1 flex-col p-6" }, /* @__PURE__ */ React4.createElement(PostMeta, { theme, post }), /* @__PURE__ */ React4.createElement(
        "h3",
        {
          "data-ut-slot": `blog-preview.title`,
          className: "mb-2 text-lg",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight
          }
        },
        post.title
      ), post.excerpt && /* @__PURE__ */ React4.createElement(
        "p",
        {
          "data-ut-slot": `blog-preview.excerpt`,
          className: "mb-4 text-sm leading-relaxed",
          style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
        },
        post.excerpt
      ), /* @__PURE__ */ React4.createElement(PostLink, { theme, href: post.href }))
    )))
  );
};

// src/sections/variants/blogPreview/BlogPreviewHorizontalRail.tsx
import React5 from "react";
var BlogPreviewHorizontalRail = ({ section, theme }) => {
  const posts = normalizePosts(section.props.posts, section.props.items);
  return /* @__PURE__ */ React5.createElement(
    BlogPreviewFrame,
    {
      variantId: "blog-preview:horizontal-rail",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React5.createElement(
      "div",
      {
        className: "flex gap-6 overflow-x-auto pb-4",
        style: { scrollSnapType: "x mandatory" }
      },
      posts.map((post, i) => /* @__PURE__ */ React5.createElement(
        "article",
        {
          key: i,
          className: "flex shrink-0 flex-col",
          style: {
            width: "min(20rem, 80vw)",
            scrollSnapAlign: "start",
            borderRadius: theme.radius,
            border: `1px solid ${hsl(theme.colors.border)}`,
            background: hsl(theme.colors.card),
            color: hsl(theme.colors.cardForeground),
            overflow: "hidden"
          }
        },
        post.image && /* @__PURE__ */ React5.createElement(
          "img",
          {
            src: post.image,
            alt: post.title,
            loading: "lazy",
            style: { aspectRatio: "3 / 2", objectFit: "cover", width: "100%" }
          }
        ),
        /* @__PURE__ */ React5.createElement("div", { className: "flex flex-1 flex-col p-5" }, /* @__PURE__ */ React5.createElement(PostMeta, { theme, post }), /* @__PURE__ */ React5.createElement(
          "h3",
          {
            "data-ut-slot": `blog-preview.title`,
            className: "mb-2 text-base",
            style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }
          },
          post.title
        ), post.excerpt && /* @__PURE__ */ React5.createElement(
          "p",
          {
            "data-ut-slot": `blog-preview.excerpt`,
            className: "mb-4 text-sm leading-relaxed",
            style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
          },
          post.excerpt
        ), /* @__PURE__ */ React5.createElement(PostLink, { theme, href: post.href }))
      ))
    )
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "blog-preview:four-columns": BlogPreviewFourColumns, "blog-preview:editorial": BlogPreviewEditorial, "blog-preview:featured-grid": BlogPreviewFeaturedGrid, "blog-preview:horizontal-rail": BlogPreviewHorizontalRail };
export {
  REGISTERED_VARIANTS
};
