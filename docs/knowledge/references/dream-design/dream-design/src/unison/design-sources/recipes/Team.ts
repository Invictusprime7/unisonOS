/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// src/sections/variants/team/TeamEditorial.tsx
import React from "react";

// src/sections/themeUtils.ts
var hsl = (token) => `hsl(${token})`;

// src/sections/variants/team/TeamEditorial.tsx
var TeamEditorial = ({ section, theme }) => {
  const p = section.props;
  return /* @__PURE__ */ React.createElement("section", { "data-ut-variant": "team:editorial", style: { padding: theme.sectionPadding, background: hsl(theme.colors.background) } }, /* @__PURE__ */ React.createElement("div", { className: "mx-auto px-5 sm:px-6 lg:px-8", style: { maxWidth: theme.containerWidth } }, /* @__PURE__ */ React.createElement("div", { className: "mb-10 md:mb-14" }, p.headline && /* @__PURE__ */ React.createElement("h2", { "data-ut-slot": "team.headline", className: "text-3xl md:text-5xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, p.headline), p.subheadline && /* @__PURE__ */ React.createElement("p", { "data-ut-slot": "team.subheadline", className: "mt-3 max-w-2xl", style: { color: hsl(theme.colors.mutedForeground) } }, p.subheadline)), /* @__PURE__ */ React.createElement("ul", { className: "border-t", style: { borderColor: hsl(theme.colors.border) } }, (p.members || []).map((m, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "grid items-center gap-4 border-b py-5 sm:grid-cols-[4rem_1fr_1fr] md:grid-cols-[5rem_1fr_1fr_2fr]", style: { borderColor: hsl(theme.colors.border) } }, m.image ? /* @__PURE__ */ React.createElement("img", { src: m.image, alt: m.name, loading: "lazy", className: "h-16 w-16 object-cover md:h-20 md:w-20", style: { borderRadius: theme.radius } }) : /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("h3", { "data-ut-slot": `member-${i}.name`, className: "text-xl", style: { fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) } }, m.name), /* @__PURE__ */ React.createElement("p", { "data-ut-slot": `member-${i}.role`, className: "text-sm uppercase tracking-[0.12em]", style: { color: hsl(theme.colors.mutedForeground) } }, m.role), m.bio && /* @__PURE__ */ React.createElement("p", { "data-ut-slot": `member-${i}.bio`, className: "hidden text-sm md:block", style: { color: hsl(theme.colors.mutedForeground) } }, m.bio))))));
};

// src/sections/variants/team/TeamProfileCards.tsx
import React3 from "react";

// src/sections/variants/team/TeamFrame.tsx
import React2 from "react";
var normalizeMembers = (members) => {
  if (!Array.isArray(members)) return [];
  return members.map((raw) => {
    const item = raw || {};
    const name = String(item.name ?? "").trim();
    if (!name) return null;
    return {
      name,
      role: String(item.role ?? item.title ?? "").trim(),
      bio: item.bio ? String(item.bio) : void 0,
      image: item.image ? String(item.image) : item.avatar ? String(item.avatar) : void 0
    };
  }).filter(Boolean);
};
var MemberPortrait = ({ member, theme, ratio = "3 / 4", rounded }) => member.image ? /* @__PURE__ */ React2.createElement(
  "img",
  {
    src: member.image,
    alt: member.name,
    loading: "lazy",
    className: "w-full object-cover",
    style: { aspectRatio: ratio, borderRadius: rounded ? "9999px" : theme.radius }
  }
) : /* @__PURE__ */ React2.createElement(
  "div",
  {
    className: "w-full",
    style: {
      aspectRatio: ratio,
      borderRadius: rounded ? "9999px" : theme.radius,
      background: hsl(theme.colors.muted),
      border: `1px solid ${hsl(theme.colors.border)}`
    }
  }
);
var MemberIdentity = ({
  member,
  theme,
  align = "start"
}) => /* @__PURE__ */ React2.createElement("div", { className: align === "center" ? "text-center" : "" }, /* @__PURE__ */ React2.createElement(
  "span",
  {
    "data-ut-slot": `team.name`,
    className: "mt-4 block text-base font-semibold",
    style: { fontFamily: theme.typography.headingFont, color: hsl(theme.colors.foreground) }
  },
  member.name
), member.role && /* @__PURE__ */ React2.createElement(
  "span",
  {
    "data-ut-slot": `team.role`,
    className: "mt-1 block text-sm",
    style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
  },
  member.role
));
var TeamFrame = ({ variantId, theme, headline, subheadline, surface = "background", children }) => /* @__PURE__ */ React2.createElement(
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
      "data-ut-slot": "team.headline",
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
      "data-ut-slot": "team.subheadline",
      className: "mx-auto max-w-2xl text-base",
      style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
    },
    subheadline
  )), children)
);

// src/sections/variants/team/TeamProfileCards.tsx
var TeamProfileCards = ({ section, theme }) => /* @__PURE__ */ React3.createElement(TeamFrame, { variantId: "team:profile-cards", theme, headline: section.props.headline, subheadline: section.props.subheadline }, /* @__PURE__ */ React3.createElement("div", { className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-4" }, normalizeMembers(section.props.members).map((member, i) => /* @__PURE__ */ React3.createElement("article", { key: i, className: "group overflow-hidden border p-3", style: { borderRadius: theme.radius, borderColor: hsl(theme.colors.border), background: hsl(theme.colors.card) } }, /* @__PURE__ */ React3.createElement("div", { className: "overflow-hidden", style: { borderRadius: theme.radius } }, /* @__PURE__ */ React3.createElement("div", { className: "transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" }, /* @__PURE__ */ React3.createElement(MemberPortrait, { member, theme, ratio: "4 / 5" }))), /* @__PURE__ */ React3.createElement("div", { className: "px-2 pb-3" }, /* @__PURE__ */ React3.createElement(MemberIdentity, { member, theme }), member.bio && /* @__PURE__ */ React3.createElement("p", { "data-ut-slot": `team.bio`, className: "mt-3 text-sm", style: { color: hsl(theme.colors.mutedForeground) } }, member.bio))))));

// src/sections/variants/team/TeamPortraitGrid.tsx
import React4 from "react";
var TeamPortraitGrid = ({ section, theme }) => {
  const members = normalizeMembers(section.props.members);
  const cols = (section.props.columns ?? (members.length >= 4 ? 4 : 3)) >= 4 ? "md:grid-cols-4" : "md:grid-cols-3";
  return /* @__PURE__ */ React4.createElement(
    TeamFrame,
    {
      variantId: "team:portrait-grid",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    /* @__PURE__ */ React4.createElement("div", { className: `grid gap-8 sm:grid-cols-2 ${cols}` }, members.map((member, i) => /* @__PURE__ */ React4.createElement("div", { key: i }, /* @__PURE__ */ React4.createElement(MemberPortrait, { member, theme }), /* @__PURE__ */ React4.createElement(MemberIdentity, { member, theme }))))
  );
};

// src/sections/variants/team/TeamRosterRail.tsx
import React5 from "react";
var TeamRosterRail = ({ section, theme }) => {
  const members = normalizeMembers(section.props.members);
  return /* @__PURE__ */ React5.createElement(
    TeamFrame,
    {
      variantId: "team:roster-rail",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline,
      surface: "muted"
    },
    /* @__PURE__ */ React5.createElement("div", { className: "flex snap-x snap-mandatory gap-8 overflow-x-auto pb-4", role: "group", "aria-label": "Team members" }, members.map((member, i) => /* @__PURE__ */ React5.createElement("div", { key: i, className: "w-56 shrink-0 snap-start" }, /* @__PURE__ */ React5.createElement(MemberPortrait, { member, theme, ratio: "1 / 1", rounded: true }), /* @__PURE__ */ React5.createElement(MemberIdentity, { member, theme, align: "center" }))))
  );
};

// src/sections/variants/team/TeamLeadSpotlight.tsx
import React6 from "react";
var TeamLeadSpotlight = ({ section, theme }) => {
  const members = normalizeMembers(section.props.members);
  const [lead, ...rest] = members;
  return /* @__PURE__ */ React6.createElement(
    TeamFrame,
    {
      variantId: "team:lead-spotlight",
      theme,
      headline: section.props.headline,
      subheadline: section.props.subheadline
    },
    lead && /* @__PURE__ */ React6.createElement("div", { className: "mb-12 grid items-center gap-10 md:grid-cols-12" }, /* @__PURE__ */ React6.createElement("div", { className: "md:col-span-5" }, /* @__PURE__ */ React6.createElement(MemberPortrait, { member: lead, theme, ratio: "4 / 5" })), /* @__PURE__ */ React6.createElement("div", { className: "md:col-span-7" }, /* @__PURE__ */ React6.createElement(MemberIdentity, { member: lead, theme }), lead.bio && /* @__PURE__ */ React6.createElement(
      "p",
      {
        "data-ut-slot": `team.bio`,
        className: "mt-4 text-base leading-relaxed",
        style: { fontFamily: theme.typography.bodyFont, color: hsl(theme.colors.mutedForeground) }
      },
      lead.bio
    ))),
    /* @__PURE__ */ React6.createElement("div", { className: "grid gap-6 sm:grid-cols-2 md:grid-cols-4" }, rest.map((member, i) => /* @__PURE__ */ React6.createElement("div", { key: i }, /* @__PURE__ */ React6.createElement(MemberPortrait, { member, theme, ratio: "1 / 1" }), /* @__PURE__ */ React6.createElement(MemberIdentity, { member, theme }))))
  );
};

// <stdin>
var REGISTERED_VARIANTS = { "team:editorial": TeamEditorial, "team:profile-cards": TeamProfileCards, "team:portrait-grid": TeamPortraitGrid, "team:roster-rail": TeamRosterRail, "team:lead-spotlight": TeamLeadSpotlight };
export {
  REGISTERED_VARIANTS
};
