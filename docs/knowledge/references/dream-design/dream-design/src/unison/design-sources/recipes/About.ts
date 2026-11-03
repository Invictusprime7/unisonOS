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
  color: hsl(theme.colors.cardForeground),
});

// src/sections/variants/about/AboutImageStory.tsx
import React2 from 'react';

// src/sections/variants/shared/EditorialSection.tsx
import React from 'react';
function EditorialSection({ variantId, theme, headline, description, children }) {
  return /* @__PURE__ */ React.createElement(
    'section',
    {
      'data-ut-variant': variantId,
      className: 'ut-editorial',
      style: {
        padding: theme.sectionPadding,
        background: hsl(theme.colors.background),
        color: hsl(theme.colors.foreground),
        fontFamily: theme.typography.bodyFont,
      },
    },
    /* @__PURE__ */ React.createElement(
      'style',
      null,
      `@keyframes ut-editorial-enter{from{transform:translateY(12px)}to{transform:translateY(0)}}
      @media(prefers-reduced-motion:no-preference){.ut-editorial [data-ut-reveal]{animation:ut-editorial-enter .5s ease-out both;animation-delay:var(--ut-reveal-delay,0ms)}}
      .ut-editorial :is(a,button,input,textarea,summary):focus-visible{outline:2px solid currentColor;outline-offset:4px}
      .ut-editorial summary::marker{color:inherit}`,
    ),
    /* @__PURE__ */ React.createElement(
      'div',
      { className: 'mx-auto min-w-0 px-5 sm:px-8', style: { maxWidth: theme.containerWidth } },
      (headline || description) &&
        /* @__PURE__ */ React.createElement(
          'header',
          { className: 'mb-10 max-w-3xl sm:mb-14' },
          headline &&
            /* @__PURE__ */ React.createElement(
              'h2',
              {
                'data-ut-slot': 'headline',
                className: 'text-3xl font-semibold tracking-tight sm:text-5xl',
                style: {
                  fontFamily: theme.typography.headingFont,
                  fontWeight: theme.typography.headingWeight,
                },
              },
              headline,
            ),
          description &&
            /* @__PURE__ */ React.createElement(
              'p',
              {
                'data-ut-slot': 'description',
                className: 'mt-5 max-w-2xl text-base leading-relaxed sm:text-lg',
                style: { color: hsl(theme.colors.mutedForeground) },
              },
              description,
            ),
        ),
      children,
    ),
  );
}
function EditorialCTA({ cta, theme }) {
  if (!cta) return null;
  return /* @__PURE__ */ React.createElement(
    'a',
    {
      href: cta.href || '#contact',
      'data-ut-intent': cta.intent ?? 'nav.goto',
      'data-ut-slot': 'cta',
      className:
        'mt-6 inline-flex min-h-11 items-center justify-center gap-5 px-5 py-3 text-sm font-semibold motion-safe:transition-transform motion-safe:hover:-translate-y-0.5',
      style: {
        borderRadius: theme.radius,
        background: hsl(theme.colors.primary),
        color: hsl(theme.colors.primaryForeground),
      },
    },
    cta.label,
    /* @__PURE__ */ React.createElement('span', { 'aria-hidden': 'true' }, '\u2197'),
  );
}

// src/sections/variants/about/AboutImageStory.tsx
function AboutImageStory({ section, theme }) {
  const { headline, description, image, cta } = section.props;
  return /* @__PURE__ */ React2.createElement(
    EditorialSection,
    { variantId: 'about:image-story', theme },
    /* @__PURE__ */ React2.createElement(
      'div',
      { className: `grid gap-5 ${image ? 'lg:grid-cols-[1.4fr_1fr]' : ''}` },
      image &&
        /* @__PURE__ */ React2.createElement(
          'figure',
          {
            'data-ut-slot': 'image',
            'data-ut-reveal': true,
            className: 'min-w-0 overflow-hidden',
            style: { borderRadius: theme.radius },
          },
          /* @__PURE__ */ React2.createElement('img', {
            src: image,
            alt: headline || 'Our story',
            loading: 'lazy',
            className: 'aspect-[4/3] h-full w-full object-cover',
          }),
        ),
      /* @__PURE__ */ React2.createElement(
        'div',
        {
          'data-ut-reveal': true,
          className: 'flex flex-col items-start justify-center p-7 sm:p-12',
          style: editorialCardStyle(theme),
        },
        headline &&
          /* @__PURE__ */ React2.createElement(
            'h2',
            {
              'data-ut-slot': 'headline',
              className: 'text-3xl tracking-tight sm:text-4xl',
              style: { fontFamily: theme.typography.headingFont },
            },
            headline,
          ),
        /* @__PURE__ */ React2.createElement(
          'p',
          {
            'data-ut-slot': 'description',
            className: 'mt-6 whitespace-pre-line text-base leading-relaxed',
            style: { color: hsl(theme.colors.mutedForeground) },
          },
          description,
        ),
        /* @__PURE__ */ React2.createElement(EditorialCTA, { cta, theme }),
      ),
    ),
  );
}

// src/sections/variants/about/AboutEditorialSplit.tsx
import React4 from 'react';

// src/sections/variants/about/AboutFrame.tsx
import React3 from 'react';
var aboutParagraphs = (description) => {
  const text = typeof description === 'string' ? description.trim() : '';
  if (!text) return [];
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((part) => part.trim())
    .filter(Boolean);
};
var AboutHeading = ({ theme, headline, align = 'start' }) => {
  if (!headline) return null;
  return /* @__PURE__ */ React3.createElement(
    'h2',
    {
      'data-ut-slot': 'about.headline',
      className: `mb-5 text-3xl ${align === 'center' ? 'text-center' : ''}`,
      style: {
        fontFamily: theme.typography.headingFont,
        fontWeight: theme.typography.headingWeight,
        color: hsl(theme.colors.foreground),
      },
    },
    headline,
  );
};
var AboutBody = ({ theme, paragraphs, align = 'start' }) =>
  /* @__PURE__ */ React3.createElement(
    'div',
    { className: align === 'center' ? 'mx-auto max-w-2xl text-center' : '' },
    paragraphs.map((paragraph, i) =>
      /* @__PURE__ */ React3.createElement(
        'p',
        {
          key: i,
          className: 'mb-4 text-base leading-relaxed',
          style: {
            fontFamily: theme.typography.bodyFont,
            fontWeight: theme.typography.bodyWeight,
            color: hsl(theme.colors.mutedForeground),
          },
        },
        paragraph,
      ),
    ),
  );
var AboutCta = ({ theme, cta, className = '' }) => {
  if (!cta?.label) return null;
  return /* @__PURE__ */ React3.createElement(
    'a',
    {
      href: cta.href || '#contact',
      'data-ut-intent': cta.intent ?? 'nav.goto',
      className: `mt-4 inline-block px-6 py-3 text-sm font-semibold ${className}`,
      style: {
        background: hsl(theme.colors.primary),
        color: hsl(theme.colors.primaryForeground),
        borderRadius: theme.radius,
        fontFamily: theme.typography.bodyFont,
      },
    },
    cta.label,
  );
};
var AboutFrame = ({ variantId, theme, surface = 'background', children }) =>
  /* @__PURE__ */ React3.createElement(
    'section',
    {
      'data-ut-variant': variantId,
      style: {
        padding: theme.sectionPadding,
        background: hsl(
          surface === 'muted'
            ? theme.colors.muted
            : surface === 'card'
              ? theme.colors.card
              : theme.colors.background,
        ),
      },
    },
    /* @__PURE__ */ React3.createElement(
      'div',
      { className: 'mx-auto px-5 sm:px-6 lg:px-8', style: { maxWidth: theme.containerWidth } },
      children,
    ),
  );

// src/sections/variants/about/AboutEditorialSplit.tsx
var AboutEditorialSplit = ({ section, theme }) => {
  const paragraphs = aboutParagraphs(section.props.description);
  const mediaFirst = section.props.layout === 'text-right';
  return /* @__PURE__ */ React4.createElement(
    AboutFrame,
    { variantId: 'about:editorial-split', theme },
    /* @__PURE__ */ React4.createElement(
      'div',
      { className: 'grid items-center gap-12 md:grid-cols-2' },
      /* @__PURE__ */ React4.createElement(
        'div',
        { className: mediaFirst ? 'md:order-2' : '' },
        /* @__PURE__ */ React4.createElement(AboutHeading, {
          theme,
          headline: section.props.headline,
        }),
        /* @__PURE__ */ React4.createElement(AboutBody, { theme, paragraphs }),
        /* @__PURE__ */ React4.createElement(AboutCta, { theme, cta: section.props.cta }),
      ),
      /* @__PURE__ */ React4.createElement(
        'div',
        { className: mediaFirst ? 'md:order-1' : '' },
        section.props.image
          ? /* @__PURE__ */ React4.createElement('img', {
              src: section.props.image,
              alt: section.props.headline || 'About',
              loading: 'lazy',
              className: 'w-full object-cover',
              style: { borderRadius: theme.radius, aspectRatio: '4 / 5' },
            })
          : /* @__PURE__ */ React4.createElement('div', {
              className: 'w-full',
              style: {
                borderRadius: theme.radius,
                aspectRatio: '4 / 5',
                background: hsl(theme.colors.muted),
                border: `1px solid ${hsl(theme.colors.border)}`,
              },
            }),
      ),
    ),
  );
};

// src/sections/variants/about/AboutStatement.tsx
import React5 from 'react';
var AboutStatement = ({ section, theme }) => {
  const paragraphs = aboutParagraphs(section.props.description);
  return /* @__PURE__ */ React5.createElement(
    AboutFrame,
    { variantId: 'about:statement', theme, surface: 'muted' },
    /* @__PURE__ */ React5.createElement(
      'div',
      { className: 'mx-auto max-w-3xl text-center' },
      /* @__PURE__ */ React5.createElement(AboutHeading, {
        theme,
        headline: section.props.headline,
        align: 'center',
      }),
      /* @__PURE__ */ React5.createElement(AboutBody, { theme, paragraphs, align: 'center' }),
      /* @__PURE__ */ React5.createElement(AboutCta, { theme, cta: section.props.cta }),
    ),
  );
};

// src/sections/variants/about/AboutStoryPanel.tsx
import React6 from 'react';
var AboutStoryPanel = ({ section, theme }) => {
  const paragraphs = aboutParagraphs(section.props.description);
  return /* @__PURE__ */ React6.createElement(
    AboutFrame,
    { variantId: 'about:story-panel', theme, surface: 'muted' },
    /* @__PURE__ */ React6.createElement(
      'div',
      { className: 'grid gap-0 md:grid-cols-12' },
      /* @__PURE__ */ React6.createElement(
        'div',
        { className: 'md:col-span-7' },
        section.props.image
          ? /* @__PURE__ */ React6.createElement('img', {
              src: section.props.image,
              alt: section.props.headline || 'About',
              loading: 'lazy',
              className: 'h-full w-full object-cover',
              style: { borderRadius: theme.radius, aspectRatio: '16 / 10' },
            })
          : /* @__PURE__ */ React6.createElement('div', {
              className: 'h-full w-full',
              style: {
                borderRadius: theme.radius,
                aspectRatio: '16 / 10',
                background: hsl(theme.colors.background),
                border: `1px solid ${hsl(theme.colors.border)}`,
              },
            }),
      ),
      /* @__PURE__ */ React6.createElement(
        'div',
        { className: 'md:col-span-5 md:-ml-12 md:mt-16' },
        /* @__PURE__ */ React6.createElement(
          'div',
          {
            className: 'p-10',
            style: {
              background: hsl(theme.colors.card),
              color: hsl(theme.colors.cardForeground),
              border: `1px solid ${hsl(theme.colors.border)}`,
              borderRadius: theme.radius,
            },
          },
          /* @__PURE__ */ React6.createElement(AboutHeading, {
            theme,
            headline: section.props.headline,
          }),
          /* @__PURE__ */ React6.createElement(AboutBody, { theme, paragraphs }),
          /* @__PURE__ */ React6.createElement(AboutCta, { theme, cta: section.props.cta }),
        ),
      ),
    ),
  );
};

// <stdin>
var REGISTERED_VARIANTS = {
  'about:image-story': AboutImageStory,
  'about:editorial-split': AboutEditorialSplit,
  'about:statement': AboutStatement,
  'about:story-panel': AboutStoryPanel,
};
export { REGISTERED_VARIANTS };
