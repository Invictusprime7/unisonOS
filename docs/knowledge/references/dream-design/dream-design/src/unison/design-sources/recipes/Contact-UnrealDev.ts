/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;
var hsla = (token, alpha) => `hsl(${token} / ${alpha})`;

// src/sections/variants/shared/editorialStyles.ts
var editorialCardStyle = (theme) => ({
  border: `1px solid ${hsl(theme.colors.border)}`,
  borderRadius: theme.radius,
  background: hsl(theme.colors.card),
  color: hsl(theme.colors.cardForeground)
});

// src/sections/variants/contact/ContactCheckoutPanel.tsx
import React3 from "react";

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

// src/sections/variants/contact/EditorialContactForm.tsx
import React2, { useId } from "react";
function EditorialContactForm({
  props,
  theme
}) {
  const prefix = useId();
  const fields = props.fields?.length ? props.fields : [
    { name: "name", type: "text", placeholder: "Your name", required: true },
    { name: "email", type: "email", placeholder: "you@example.com", required: true },
    { name: "message", type: "textarea", placeholder: "How can we help?", required: true }
  ];
  return /* @__PURE__ */ React2.createElement(
    "form",
    {
      "data-demo-form": "true",
      "data-ut-slot": "form",
      "data-ut-intent": props.submitIntent || "contact.submit",
      className: "grid gap-5 sm:grid-cols-2"
    },
    fields.map((field, index) => /* @__PURE__ */ React2.createElement("div", { key: `${field.name}-${index}`, className: field.type === "textarea" ? "sm:col-span-2" : "" }, /* @__PURE__ */ React2.createElement("label", { htmlFor: `${prefix}-${index}`, className: "mb-2 block text-sm font-medium" }, field.name.replace(/[_-]/g, " "), field.required && /* @__PURE__ */ React2.createElement("span", { "aria-hidden": "true" }, " *")), field.type === "textarea" ? /* @__PURE__ */ React2.createElement(
      "textarea",
      {
        id: `${prefix}-${index}`,
        name: field.name,
        placeholder: field.placeholder,
        required: field.required,
        rows: 5,
        className: "w-full px-4 py-3",
        style: { ...editorialCardStyle(theme), background: hsl(theme.colors.background) }
      }
    ) : /* @__PURE__ */ React2.createElement(
      "input",
      {
        id: `${prefix}-${index}`,
        name: field.name,
        type: field.type || "text",
        placeholder: field.placeholder,
        required: field.required,
        autoComplete: ["name", "email", "tel"].includes(field.name) ? field.name : void 0,
        className: "min-h-12 w-full px-4 py-3",
        style: { ...editorialCardStyle(theme), background: hsl(theme.colors.background) }
      }
    ))),
    /* @__PURE__ */ React2.createElement(
      "button",
      {
        "data-ut-intent": "contact.submit",
        type: "submit",
        className: "min-h-12 px-6 py-3 text-sm font-semibold sm:col-span-2 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5",
        style: {
          borderRadius: theme.radius,
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground)
        }
      },
      props.submitLabel || "Send message"
    )
  );
}
function EditorialContactDetails({ props }) {
  return /* @__PURE__ */ React2.createElement("address", { className: "space-y-4 break-words text-sm not-italic leading-relaxed" }, props.email && /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("span", { className: "mb-1 block text-xs uppercase tracking-widest" }, "Email"), /* @__PURE__ */ React2.createElement("a", { "data-ut-intent": "nav.goto", href: `mailto:${props.email}`, "data-ut-cta": "cta.email" }, props.email)), props.phone && /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("span", { className: "mb-1 block text-xs uppercase tracking-widest" }, "Phone"), /* @__PURE__ */ React2.createElement("a", { "data-ut-intent": "nav.goto", href: `tel:${props.phone}`, "data-ut-cta": "cta.phone" }, props.phone)), props.address && /* @__PURE__ */ React2.createElement("div", null, /* @__PURE__ */ React2.createElement("span", { className: "mb-1 block text-xs uppercase tracking-widest" }, "Visit"), /* @__PURE__ */ React2.createElement(
    "a",
    {
      "data-ut-intent": "nav.goto",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.address)}`,
      target: "_blank",
      rel: "noopener noreferrer",
      "data-ut-cta": "cta.address"
    },
    props.address,
    /* @__PURE__ */ React2.createElement("span", { className: "mt-2 block underline" }, "Get directions \u2197")
  )));
}

// src/sections/variants/contact/ContactCheckoutPanel.tsx
function ContactCheckoutPanel({ section, theme }) {
  return /* @__PURE__ */ React3.createElement(
    EditorialSection,
    {
      variantId: "contact:checkout-panel",
      theme,
      headline: section.props.headline,
      description: section.props.description
    },
    /* @__PURE__ */ React3.createElement("div", { className: "grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]" }, /* @__PURE__ */ React3.createElement("div", { className: "p-6 sm:p-9", style: editorialCardStyle(theme) }, /* @__PURE__ */ React3.createElement("h3", { className: "mb-6 text-xl", style: { fontFamily: theme.typography.headingFont } }, "Questions about your order?"), /* @__PURE__ */ React3.createElement(EditorialContactForm, { props: section.props, theme })), /* @__PURE__ */ React3.createElement("aside", { className: "p-6 sm:p-9", style: editorialCardStyle(theme) }, /* @__PURE__ */ React3.createElement("h3", { className: "text-2xl", style: { fontFamily: theme.typography.headingFont } }, "Ready to continue?"), /* @__PURE__ */ React3.createElement("p", { className: "mt-3 text-sm leading-relaxed", style: { color: hsl(theme.colors.mutedForeground) } }, "Review your cart and continue to checkout."), /* @__PURE__ */ React3.createElement(
      "button",
      {
        type: "button",
        "data-ut-intent": "cart.checkout",
        "data-ut-slot": "checkout",
        className: "mb-8 mt-6 min-h-12 w-full px-5 py-3 text-sm font-semibold",
        style: {
          background: hsl(theme.colors.primary),
          color: hsl(theme.colors.primaryForeground),
          borderRadius: theme.radius
        }
      },
      "Continue to checkout \u2197"
    ), /* @__PURE__ */ React3.createElement(EditorialContactDetails, { props: section.props })))
  );
}

// src/sections/variants/contact/ContactMapStudio.tsx
import React4 from "react";
function ContactMapStudio({ section, theme }) {
  const { address, showMap } = section.props;
  return /* @__PURE__ */ React4.createElement(
    EditorialSection,
    {
      variantId: "contact:map-studio",
      theme,
      headline: section.props.headline,
      description: section.props.description
    },
    /* @__PURE__ */ React4.createElement("div", { className: "grid gap-6 lg:grid-cols-2" }, /* @__PURE__ */ React4.createElement("div", { className: "overflow-hidden", style: editorialCardStyle(theme) }, showMap && address && /* @__PURE__ */ React4.createElement(
      "iframe",
      {
        title: `Map of ${address}`,
        src: `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`,
        loading: "lazy",
        referrerPolicy: "no-referrer",
        className: "h-72 w-full border-0"
      }
    ), /* @__PURE__ */ React4.createElement("div", { className: "p-7 sm:p-9", style: { background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React4.createElement(EditorialContactDetails, { props: section.props }))), /* @__PURE__ */ React4.createElement("div", { className: "p-6 sm:p-9", style: editorialCardStyle(theme) }, /* @__PURE__ */ React4.createElement(EditorialContactForm, { props: section.props, theme })))
  );
}

// src/sections/variants/contact/ContactEditorialForm.tsx
import React5 from "react";
function ContactEditorialForm({ section, theme }) {
  return /* @__PURE__ */ React5.createElement(
    EditorialSection,
    {
      variantId: "contact:editorial-form",
      theme,
      headline: section.props.headline,
      description: section.props.description
    },
    /* @__PURE__ */ React5.createElement("div", { className: "grid items-start gap-10 lg:grid-cols-[1fr_1.6fr]" }, /* @__PURE__ */ React5.createElement("aside", { className: "border-t pt-6", style: { borderColor: hsl(theme.colors.border) } }, /* @__PURE__ */ React5.createElement(EditorialContactDetails, { props: section.props })), /* @__PURE__ */ React5.createElement("div", { className: "p-6 sm:p-9", style: editorialCardStyle(theme) }, /* @__PURE__ */ React5.createElement(EditorialContactForm, { props: section.props, theme })))
  );
}

// src/sections/variants/contact/ContactCompactCard.tsx
import React6 from "react";
var ContactCompactCard = ({ section, theme }) => {
  const p = section.props;
  const fields = p.fields?.length ? p.fields : [{ name: "email", type: "email", placeholder: "Email", required: true }];
  const input = { borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}`, background: hsl(theme.colors.background), color: hsl(theme.colors.foreground) };
  return /* @__PURE__ */ React6.createElement("section", { "data-ut-variant": "contact:compact-card", style: { padding: theme.sectionPadding, background: hsl(theme.colors.muted) } }, /* @__PURE__ */ React6.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React6.createElement("div", { className: "mx-auto grid max-w-4xl overflow-hidden md:grid-cols-2", style: { borderRadius: theme.radius, background: hsl(theme.colors.card), border: `1px solid ${hsl(theme.colors.border)}` } }, /* @__PURE__ */ React6.createElement("div", { className: "p-8", style: { background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) } }, p.headline && /* @__PURE__ */ React6.createElement("h2", { "data-ut-slot": "contact.headline", className: "text-3xl", style: { fontFamily: theme.typography.headingFont } }, p.headline), p.description && /* @__PURE__ */ React6.createElement("p", { "data-ut-slot": "contact.description", className: "mt-3 text-sm opacity-80" }, p.description), /* @__PURE__ */ React6.createElement("dl", { className: "mt-8 space-y-3 text-sm" }, p.email && /* @__PURE__ */ React6.createElement("div", null, /* @__PURE__ */ React6.createElement("dt", { className: "opacity-70" }, "Email"), /* @__PURE__ */ React6.createElement("dd", { "data-ut-slot": "contact.email" }, p.email)), p.phone && /* @__PURE__ */ React6.createElement("div", null, /* @__PURE__ */ React6.createElement("dt", { className: "opacity-70" }, "Phone"), /* @__PURE__ */ React6.createElement("dd", { "data-ut-slot": "contact.phone" }, p.phone)), p.address && /* @__PURE__ */ React6.createElement("div", null, /* @__PURE__ */ React6.createElement("dt", { className: "opacity-70" }, "Address"), /* @__PURE__ */ React6.createElement("dd", { "data-ut-slot": "contact.address" }, p.address)))), /* @__PURE__ */ React6.createElement("form", { "data-ut-intent": p.submitIntent || "contact.submit", className: "flex flex-col gap-4 p-8", onSubmit: (e) => e.preventDefault() }, fields.map((f) => /* @__PURE__ */ React6.createElement("label", { key: f.name, className: "flex flex-col gap-1 text-sm", style: { color: hsl(theme.colors.foreground) } }, /* @__PURE__ */ React6.createElement("span", { className: "capitalize" }, f.name), f.type === "textarea" ? /* @__PURE__ */ React6.createElement("textarea", { name: f.name, required: f.required, placeholder: f.placeholder, rows: 4, className: "p-3", style: input }) : /* @__PURE__ */ React6.createElement("input", { name: f.name, type: f.type, required: f.required, placeholder: f.placeholder, className: "min-h-11 px-3", style: input }))), /* @__PURE__ */ React6.createElement("button", { type: "submit", "data-ut-intent": p.submitIntent || "contact.submit", className: "min-h-11 px-5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", style: { borderRadius: theme.radius, background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) } }, p.submitLabel || "Send")))));
};

// src/sections/variants/contact/ContactCentered.tsx
import React7 from "react";
var ContactCentered = ({ section, theme }) => {
  const { headline, description, fields, submitLabel = "Send Message", submitIntent = "contact.submit", phone, email, address } = section.props;
  const formFields = fields?.length ? fields : [
    { name: "name", type: "text", placeholder: "Your name" },
    { name: "email", type: "email", placeholder: "your@email.com" },
    { name: "message", type: "textarea", placeholder: "How can we help?" }
  ];
  const inputStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: theme.radius,
    border: `1px solid ${hsla(theme.colors.border, 0.8)}`,
    background: hsl(theme.colors.background),
    color: hsl(theme.colors.foreground),
    fontFamily: theme.typography.bodyFont,
    fontSize: "0.875rem",
    outline: "none"
  };
  return /* @__PURE__ */ React7.createElement(
    "section",
    {
      "data-ut-variant": "contact:centered",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.muted) }
    },
    /* @__PURE__ */ React7.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: "44rem" } }, headline && /* @__PURE__ */ React7.createElement("div", { className: "text-center mb-8" }, /* @__PURE__ */ React7.createElement(
      "h2",
      {
        "data-ut-slot": "contact.headline",
        className: "text-3xl sm:text-4xl mb-3 font-semibold tracking-tight",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), description && /* @__PURE__ */ React7.createElement("p", { "data-ut-slot": "contact.description", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, description)), /* @__PURE__ */ React7.createElement(
      "div",
      {
        className: "p-6 sm:p-10 shadow-sm transition-all",
        style: {
          background: hsl(theme.colors.card),
          borderRadius: theme.radius,
          border: `1px solid ${hsla(theme.colors.border, 0.6)}`
        }
      },
      /* @__PURE__ */ React7.createElement("form", { "data-demo-form": "true", "data-ut-intent": submitIntent, className: "flex flex-col gap-4" }, formFields.map((field) => field.type === "textarea" ? /* @__PURE__ */ React7.createElement("textarea", { key: field.name, name: field.name, placeholder: field.placeholder || field.name, required: field.required, rows: 4, style: inputStyle, className: "transition-all focus:ring-2 focus:ring-primary/20" }) : /* @__PURE__ */ React7.createElement("input", { key: field.name, name: field.name, type: field.type || "text", placeholder: field.placeholder || field.name, required: field.required, style: inputStyle, className: "transition-all focus:ring-2 focus:ring-primary/20" })), /* @__PURE__ */ React7.createElement(
        "button",
        {
          "data-ut-intent": "contact.submit",
          type: "submit",
          className: "w-full text-sm font-semibold py-3.5 motion-safe:transition-opacity hover:opacity-90 active:scale-[0.99] cursor-pointer shadow-sm",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius,
            border: "none",
            fontFamily: theme.typography.bodyFont
          }
        },
        submitLabel
      )),
      (phone || email || address) && /* @__PURE__ */ React7.createElement(
        "div",
        {
          className: "mt-8 pt-6 border-t flex flex-wrap gap-4 justify-center text-center text-sm",
          style: { borderColor: hsla(theme.colors.border, 0.4), color: hsl(theme.colors.mutedForeground) }
        },
        phone && /* @__PURE__ */ React7.createElement("p", null, /* @__PURE__ */ React7.createElement("a", { "data-ut-intent": "nav.goto", href: `tel:${phone}`, "data-ut-cta": "cta.phone", style: { color: "inherit", textDecoration: "none" } }, phone)),
        email && /* @__PURE__ */ React7.createElement("p", null, /* @__PURE__ */ React7.createElement("a", { "data-ut-intent": "nav.goto", href: `mailto:${email}`, "data-ut-cta": "cta.email", style: { color: "inherit", textDecoration: "none" } }, email)),
        address && /* @__PURE__ */ React7.createElement("p", null, /* @__PURE__ */ React7.createElement("a", { "data-ut-intent": "nav.goto", href: `https://maps.google.com/?q=${encodeURIComponent(address)}`, target: "_blank", rel: "noopener noreferrer", "data-ut-cta": "cta.address", style: { color: "inherit", textDecoration: "none" } }, address))
      )
    ))
  );
};

// src/sections/variants/contact/ContactSplitCard.tsx
import React8 from "react";
var ContactSplitCard = ({ section, theme }) => {
  const { headline, description, fields, submitLabel = "Send Message", submitIntent = "contact.submit", phone, email, address } = section.props;
  const formFields = fields?.length ? fields : [
    { name: "name", type: "text", placeholder: "Your name" },
    { name: "email", type: "email", placeholder: "your@email.com" },
    { name: "message", type: "textarea", placeholder: "Your message..." }
  ];
  const inputStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: theme.radius,
    border: `1px solid ${hsla(theme.colors.border, 0.8)}`,
    background: hsl(theme.colors.background),
    color: hsl(theme.colors.foreground),
    fontFamily: theme.typography.bodyFont,
    fontSize: "0.875rem",
    outline: "none"
  };
  return /* @__PURE__ */ React8.createElement(
    "section",
    {
      "data-ut-variant": "contact:split-card",
      style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) }
    },
    /* @__PURE__ */ React8.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, headline && /* @__PURE__ */ React8.createElement("div", { className: "text-center mb-12" }, /* @__PURE__ */ React8.createElement(
      "h2",
      {
        "data-ut-slot": "contact.headline",
        className: "text-3xl sm:text-4xl mb-3 font-semibold tracking-tight",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), description && /* @__PURE__ */ React8.createElement("p", { "data-ut-slot": "contact.description", className: "text-base max-w-lg mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, description)), /* @__PURE__ */ React8.createElement("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-5xl mx-auto" }, /* @__PURE__ */ React8.createElement(
      "div",
      {
        className: "p-6 sm:p-8 rounded-[var(--radius)] shadow-sm",
        style: {
          background: hsl(theme.colors.card),
          border: `1px solid ${hsla(theme.colors.border, 0.6)}`
        }
      },
      /* @__PURE__ */ React8.createElement("form", { "data-demo-form": "true", "data-ut-intent": submitIntent, className: "flex flex-col gap-4" }, formFields.map((field) => field.type === "textarea" ? /* @__PURE__ */ React8.createElement("textarea", { key: field.name, name: field.name, placeholder: field.placeholder || field.name, required: field.required, rows: 5, style: inputStyle, className: "transition-all focus:ring-2 focus:ring-primary/20" }) : /* @__PURE__ */ React8.createElement("input", { key: field.name, name: field.name, type: field.type || "text", placeholder: field.placeholder || field.name, required: field.required, style: inputStyle, className: "transition-all focus:ring-2 focus:ring-primary/20" })), /* @__PURE__ */ React8.createElement(
        "button",
        {
          "data-ut-intent": "contact.submit",
          type: "submit",
          className: "w-full text-sm font-semibold py-3.5 motion-safe:transition-opacity hover:opacity-90 active:scale-[0.99] cursor-pointer shadow-sm",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius,
            border: "none",
            fontFamily: theme.typography.bodyFont
          }
        },
        submitLabel
      ))
    ), /* @__PURE__ */ React8.createElement(
      "div",
      {
        className: "p-6 sm:p-8 flex flex-col gap-6 rounded-[var(--radius)] shadow-sm",
        style: {
          background: hsl(theme.colors.card),
          border: `1px solid ${hsla(theme.colors.border, 0.6)}`,
          borderRadius: theme.radius
        }
      },
      /* @__PURE__ */ React8.createElement(
        "h3",
        {
          className: "text-xl font-semibold",
          style: {
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.cardForeground)
          }
        },
        "Get in Touch"
      ),
      email && /* @__PURE__ */ React8.createElement("div", null, /* @__PURE__ */ React8.createElement("p", { className: "text-xs uppercase tracking-wider mb-1 font-semibold", style: { color: hsl(theme.colors.mutedForeground) } }, "Email"), /* @__PURE__ */ React8.createElement("p", { className: "text-sm font-medium", style: { color: hsl(theme.colors.cardForeground) } }, /* @__PURE__ */ React8.createElement("a", { "data-ut-intent": "nav.goto", href: `mailto:${email}`, "data-ut-cta": "cta.email", style: { color: "inherit", textDecoration: "none" } }, email))),
      phone && /* @__PURE__ */ React8.createElement("div", null, /* @__PURE__ */ React8.createElement("p", { className: "text-xs uppercase tracking-wider mb-1 font-semibold", style: { color: hsl(theme.colors.mutedForeground) } }, "Phone"), /* @__PURE__ */ React8.createElement("p", { className: "text-sm font-medium", style: { color: hsl(theme.colors.cardForeground) } }, /* @__PURE__ */ React8.createElement("a", { "data-ut-intent": "nav.goto", href: `tel:${phone}`, "data-ut-cta": "cta.phone", style: { color: "inherit", textDecoration: "none" } }, phone))),
      address && /* @__PURE__ */ React8.createElement("div", null, /* @__PURE__ */ React8.createElement("p", { className: "text-xs uppercase tracking-wider mb-1 font-semibold", style: { color: hsl(theme.colors.mutedForeground) } }, "Address"), /* @__PURE__ */ React8.createElement("p", { className: "text-sm font-medium", style: { color: hsl(theme.colors.cardForeground) } }, /* @__PURE__ */ React8.createElement("a", { "data-ut-intent": "nav.goto", href: `https://maps.google.com/?q=${encodeURIComponent(address)}`, target: "_blank", rel: "noopener noreferrer", "data-ut-cta": "cta.address", style: { color: "inherit", textDecoration: "none" } }, address)))
    )))
  );
};

// src/sections/variants/contact/ContactMinimalInline.tsx
import React9 from "react";
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Send = __LucideIcons['Send'] || __LucideFallback;
const Phone = __LucideIcons['Phone'] || __LucideFallback;
const Map = __LucideIcons['Map'] || __LucideFallback;
var ContactMinimalInline = ({ section, theme }) => {
  const { headline, description, fields, submitLabel = "Send", submitIntent = "contact.submit", phone, email, address } = section.props;
  const formFields = fields?.length ? fields.slice(0, 2) : [
    { name: "email", type: "email", placeholder: "your@email.com" },
    { name: "message", type: "text", placeholder: "Message" }
  ];
  const inputStyle = {
    flex: 1,
    padding: "0.65rem 0.85rem",
    borderRadius: theme.radius,
    border: `1px solid ${hsla(theme.colors.border, 0.8)}`,
    background: hsl(theme.colors.card),
    color: hsl(theme.colors.cardForeground),
    fontFamily: theme.typography.bodyFont,
    fontSize: "0.875rem",
    outline: "none"
  };
  return /* @__PURE__ */ React9.createElement(
    "section",
    {
      "data-ut-variant": "contact:minimal-inline",
      style: {
        padding: theme.sectionPadding,
        background: `linear-gradient(135deg, ${hsla(theme.colors.primary, 0.04)}, ${hsla(theme.colors.secondary, 0.04)})`
      }
    },
    /* @__PURE__ */ React9.createElement("div", { className: "mx-auto px-5 text-center sm:px-6", style: { maxWidth: "48rem" } }, headline && /* @__PURE__ */ React9.createElement(
      "h2",
      {
        "data-ut-slot": "contact.headline",
        className: "mb-3 text-2xl sm:text-3xl",
        style: {
          fontFamily: theme.typography.headingFont,
          fontWeight: theme.typography.headingWeight,
          color: hsl(theme.colors.foreground)
        }
      },
      headline
    ), description && /* @__PURE__ */ React9.createElement("p", { "data-ut-slot": "contact.description", className: "text-base mb-8 max-w-md mx-auto", style: { color: hsl(theme.colors.mutedForeground) } }, description), /* @__PURE__ */ React9.createElement(
      "form",
      {
        "data-demo-form": "true",
        "data-ut-intent": submitIntent,
        className: "mb-6 flex flex-col gap-3 sm:flex-row",
        style: { maxWidth: "36rem", margin: "0 auto" }
      },
      formFields.map((field) => /* @__PURE__ */ React9.createElement("input", { key: field.name, name: field.name, type: field.type || "text", placeholder: field.placeholder || field.name, required: field.required, style: inputStyle })),
      /* @__PURE__ */ React9.createElement(
        "button",
        {
          "data-ut-intent": "contact.submit",
          type: "submit",
          className: "text-sm font-medium px-6 py-2.5 motion-safe:transition-opacity hover:opacity-90 cursor-pointer flex-shrink-0",
          style: {
            background: hsl(theme.colors.primary),
            color: hsl(theme.colors.primaryForeground),
            borderRadius: theme.radius,
            border: "none",
            fontFamily: theme.typography.bodyFont
          }
        },
        submitLabel
      )
    ), (phone || email || address) && /* @__PURE__ */ React9.createElement("div", { className: "flex gap-4 justify-center flex-wrap" }, [
      email ? { value: email, href: `mailto:${email}`, cta: "cta.email" } : null,
      phone ? { value: phone, href: `tel:${phone}`, cta: "cta.phone" } : null,
      address ? { value: address, href: `https://maps.google.com/?q=${encodeURIComponent(address)}`, cta: "cta.address" } : null
    ].filter(Boolean).map((info, i) => /* @__PURE__ */ React9.createElement(
      "a",
      {
        "data-ut-intent": "nav.goto",
        key: i,
        href: info.href,
        "data-ut-cta": info.cta,
        target: info.cta === "cta.address" ? "_blank" : void 0,
        rel: info.cta === "cta.address" ? "noopener noreferrer" : void 0,
        className: "text-xs px-3 py-1.5 rounded-full",
        style: {
          background: hsl(theme.colors.card),
          color: hsl(theme.colors.mutedForeground),
          border: `1px solid ${hsla(theme.colors.border, 0.5)}`,
          textDecoration: "none"
        }
      },
      info.value
    ))))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "contact:checkout-panel": ContactCheckoutPanel, "contact:map-studio": ContactMapStudio, "contact:editorial-form": ContactEditorialForm, "contact:compact-card": ContactCompactCard, "contact:centered": ContactCentered, "contact:split-card": ContactSplitCard, "contact:minimal-inline": ContactMinimalInline };
export {
  REGISTERED_VARIANTS
};
