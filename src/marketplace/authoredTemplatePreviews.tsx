/* eslint-disable react-refresh/only-export-components */

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { SectionEntry, ThemeTokens } from '@/sections/types';
import { MarketplaceRegisteredSection, MARKETPLACE_TEMPLATE_VARIANT_PROFILES } from '@/marketplace/MarketplaceRegisteredSection';
import { ADDITIONAL_MARKETPLACE_TEMPLATES } from '@/marketplace/additionalMarketplacePreviews';
import {
  RegistryBoundForm,
  RegistryBoundLink,
  MarketplacePageNavigation,
  getMarketplaceVariantTheme,
  marketplaceBindingAttributes,
  type AuthoredMarketplaceTemplate,
  type MarketplacePreviewProps,
  type MarketplaceTemplateBinding,
} from '@/marketplace/marketplaceTemplatePrimitives';
export { marketplaceBindingAttributes, resolveMarketplaceTemplateBinding } from '@/marketplace/marketplaceTemplatePrimitives';
export type { AuthoredMarketplaceTemplate, MarketplaceTemplateBinding, MarketplacePreviewProps, ResolvedMarketplaceTemplateBinding } from '@/marketplace/marketplaceTemplatePrimitives';

const SORELLA_BINDINGS = {
  homeLink: { id: 'sorella:home-link', intent: 'nav.anchor', label: 'Sorella House', sourceSection: 'navbar', sourceSlot: 'brand-link', targetSectionId: 'top' },
  menuLink: { id: 'sorella:menu-link', intent: 'nav.anchor', label: 'The menu', sourceSection: 'navbar', sourceSlot: 'menu-link', targetSectionId: 'menu' },
  menuHeroLink: { id: 'sorella:menu-hero-link', intent: 'nav.anchor', label: 'See what is cooking', sourceSection: 'hero', sourceSlot: 'secondary-cta', targetSectionId: 'menu' },
  kitchenLink: { id: 'sorella:kitchen-link', intent: 'nav.anchor', label: 'Our kitchen', sourceSection: 'navbar', sourceSlot: 'story-link', targetSectionId: 'story' },
  reservationLink: { id: 'sorella:reservation-link', intent: 'nav.anchor', label: 'Find a table', sourceSection: 'navbar', sourceSlot: 'primary-action', targetSectionId: 'reservations' },
  reservationSubmit: { id: 'sorella:reservation-submit', intent: 'booking.create', label: 'Request a table', sourceSection: 'reservations', sourceSlot: 'booking-submit' },
} satisfies Record<string, MarketplaceTemplateBinding>;

const FORMWORKS_BINDINGS = {
  homeLink: { id: 'formworks:home-link', intent: 'nav.anchor', label: 'Formworks Studio', sourceSection: 'navbar', sourceSlot: 'brand-link', targetSectionId: 'top' },
  projectsLink: { id: 'formworks:projects-link', intent: 'nav.anchor', label: 'Projects', sourceSection: 'navbar', sourceSlot: 'projects-link', targetSectionId: 'projects' },
  projectsHeroLink: { id: 'formworks:projects-hero-link', intent: 'nav.anchor', label: 'Explore selected work', sourceSection: 'hero', sourceSlot: 'secondary-cta', targetSectionId: 'projects' },
  practiceLink: { id: 'formworks:practice-link', intent: 'nav.anchor', label: 'Practice', sourceSection: 'navbar', sourceSlot: 'practice-link', targetSectionId: 'practice' },
  inquiryLink: { id: 'formworks:inquiry-link', intent: 'nav.anchor', label: 'Start a brief', sourceSection: 'navbar', sourceSlot: 'primary-action', targetSectionId: 'inquiry' },
  quoteSubmit: { id: 'formworks:quote-submit', intent: 'quote.request', label: 'Request a project conversation', sourceSection: 'inquiry', sourceSlot: 'quote-submit' },
} satisfies Record<string, MarketplaceTemplateBinding>;

const RELAY_BINDINGS = {
  homeLink: { id: 'relay:home-link', intent: 'nav.anchor', label: 'Relay', sourceSection: 'navbar', sourceSlot: 'brand-link', targetSectionId: 'top' },
  productLink: { id: 'relay:product-link', intent: 'nav.anchor', label: 'Product', sourceSection: 'navbar', sourceSlot: 'product-link', targetSectionId: 'workflow' },
  productHeroLink: { id: 'relay:product-hero-link', intent: 'nav.anchor', label: 'Explore the workflow', sourceSection: 'hero', sourceSlot: 'secondary-cta', targetSectionId: 'workflow' },
  solutionsLink: { id: 'relay:solutions-link', intent: 'nav.anchor', label: 'Solutions', sourceSection: 'navbar', sourceSlot: 'solutions-link', targetSectionId: 'teams' },
  demoLink: { id: 'relay:demo-link', intent: 'nav.anchor', label: 'See Relay in action', sourceSection: 'navbar', sourceSlot: 'primary-action', targetSectionId: 'demo' },
  demoPlanLink: { id: 'relay:demo-plan-link', intent: 'nav.anchor', label: 'Plan a walkthrough', sourceSection: 'plans', sourceSlot: 'primary-action', targetSectionId: 'demo' },
  demoFooterLink: { id: 'relay:demo-footer-link', intent: 'nav.anchor', label: 'Meet Relay', sourceSection: 'footer', sourceSlot: 'primary-action', targetSectionId: 'demo' },
  demoSubmit: { id: 'relay:demo-submit', intent: 'demo.request', label: 'Request a product demo', sourceSection: 'demo', sourceSlot: 'demo-submit' },
} satisfies Record<string, MarketplaceTemplateBinding>;

const SORELLA_VARIANT_THEME = getMarketplaceVariantTheme('organic', {
  primary: '148 30% 18%', primaryForeground: '0 0% 100%', secondary: '84 20% 84%', secondaryForeground: '148 30% 18%',
  accent: '14 51% 48%', accentForeground: '0 0% 100%', background: '45 33% 92%', foreground: '148 30% 18%',
  muted: '84 20% 86%', mutedForeground: '145 10% 34%', card: '45 33% 95%', cardForeground: '148 30% 18%', border: '148 15% 70%',
});

const FORMWORKS_VARIANT_THEME = getMarketplaceVariantTheme('minimalist', {
  primary: '10 86% 59%', primaryForeground: '0 0% 100%', secondary: '195 14% 82%', secondaryForeground: '205 42% 16%',
  accent: '10 86% 59%', accentForeground: '0 0% 100%', background: '90 20% 97%', foreground: '205 42% 16%',
  muted: '145 8% 91%', mutedForeground: '205 12% 38%', card: '0 0% 100%', cardForeground: '205 42% 16%', border: '205 14% 78%',
});

const RELAY_VARIANT_THEME = getMarketplaceVariantTheme('futuristic', {
  primary: '78 80% 68%', primaryForeground: '150 15% 8%', secondary: '186 45% 66%', secondaryForeground: '150 15% 8%',
  accent: '78 80% 68%', accentForeground: '150 15% 8%', background: '150 15% 8%', foreground: '69 33% 94%',
  muted: '150 10% 16%', mutedForeground: '140 8% 67%', card: '150 12% 12%', cardForeground: '69 33% 94%', border: '150 8% 28%',
});

const SORELLA_GALLERY: SectionEntry<'gallery'> = {
  id: 'sorella-seasonal-gallery', type: 'gallery', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['sorella-house'].variants.gallery,
  props: {
    headline: 'From field to table', subheadline: 'A changing picture of the farms, ingredients, and plates that shape the season.', columns: 3,
    items: [
      { src: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1100&q=82', alt: 'Bright market salad with herbs and vegetables', caption: 'Spring greens', category: 'From the garden' },
      { src: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=900&q=82', alt: 'Seasonal dinner plate arranged for sharing', caption: 'Dinner at the pass', category: 'At the table' },
      { src: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900&q=82', alt: 'Fresh ingredients prepared by the kitchen', caption: 'Market morning', category: 'From the market' },
      { src: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=900&q=82', alt: 'Fresh produce selected for a seasonal menu', caption: 'What is in season', category: 'From the garden' },
    ],
  },
};

const SORELLA_SERVICES: SectionEntry<'services'> = {
  id: 'sorella-menu', type: 'services', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['sorella-house'].variants.services,
  props: { headline: 'From the pass', subheadline: 'A few favorites from a menu that changes with the season.', columns: 3, items: [
    { title: 'Charred spring greens', description: 'Preserved lemon · toasted seeds', price: 'From $16' },
    { title: 'Market fish, wood fired', description: 'Saffron broth · fennel', price: 'From $32' },
    { title: 'Olive oil cake', description: 'Citrus curd · cream', price: '$12' },
  ] },
};
const SORELLA_TESTIMONIALS: SectionEntry<'testimonials'> = {
  id: 'sorella-guest-notes', type: 'testimonials', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['sorella-house'].variants.testimonials,
  props: { headline: 'A table worth returning to', items: [
    { quote: 'Warm, precise service and the kind of food you talk about the next morning.', author: 'Nora S.', role: 'Guest' },
    { quote: 'The room feels special without trying too hard. We already booked our next dinner.', author: 'Chris D.', role: 'Guest' },
  ] },
};
const SORELLA_FAQ: SectionEntry<'faq'> = {
  id: 'sorella-visit-questions', type: 'faq', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['sorella-house'].variants.faq,
  props: { headline: 'Before you come by', items: [
    { question: 'Do you take reservations?', answer: 'Yes. Request a table and the installed booking flow will check available times.' },
    { question: 'Can you accommodate dietary needs?', answer: 'Share allergies or dietary needs with your reservation so the kitchen can advise.' },
    { question: 'Where should I park?', answer: 'Street parking and neighborhood transit options are available near the dining room.' },
  ] },
};

const FORMWORKS_GALLERY: SectionEntry<'gallery'> = {
  id: 'formworks-case-studies', type: 'gallery', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['formworks-studio'].variants.gallery,
  props: {
    headline: 'Selected case studies', subheadline: 'Three projects shaped by site, material, and the people who use them.', columns: 2,
    items: [
      { src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1500&q=85', alt: 'Sunlit contemporary courtyard house interior', caption: 'Courtyard House', category: 'Residential · Portland' },
      { src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1100&q=85', alt: 'Warm studio interior finished with natural timber', caption: 'Atelier North', category: 'Workplace · Seattle' },
      { src: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1100&q=85', alt: 'Quiet residential facade framed by greenery', caption: 'Garden Rooms', category: 'Residential · Hood River' },
    ],
  },
};

const FORMWORKS_ABOUT: SectionEntry<'about'> = {
  id: 'formworks-practice-story', type: 'about', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['formworks-studio'].variants.about,
  props: { headline: 'Small studio, full attention', description: 'We take on a few projects at a time, stay close to the build, and design around the people who will use the place. The studio works across residential architecture, interiors, and careful renovation.' },
};
const FORMWORKS_STATS: SectionEntry<'stats'> = {
  id: 'formworks-practice-facts', type: 'stats', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['formworks-studio'].variants.stats,
  props: { headline: 'A practice with a point of view', items: [{ value: '12', label: 'Years in practice' }, { value: '38', label: 'Projects delivered' }, { value: '3', label: 'People, start to finish' }] },
};
const FORMWORKS_TESTIMONIALS: SectionEntry<'testimonials'> = {
  id: 'formworks-client-notes', type: 'testimonials', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['formworks-studio'].variants.testimonials,
  props: { headline: 'Good work, built together', items: [{ quote: 'The decisions felt clear from the first sketch through the last site walk.', author: 'Morgan L.', role: 'Homeowner' }, { quote: 'They listened carefully and stayed present when the real-world details arrived.', author: 'Sam R.', role: 'Project client' }] },
};
const FORMWORKS_SERVICES: SectionEntry<'services'> = {
  id: 'formworks-practice-services', type: 'services', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['formworks-studio'].variants.services,
  props: { headline: 'What we do', items: [{ title: 'Architecture', description: 'New homes and renovations grounded in site and daily life.' }, { title: 'Interiors', description: 'Material, light, and storage choices considered as one system.' }, { title: 'Stewardship', description: 'A close eye on scope and construction from sketch to handover.' }] },
};

const RELAY_GALLERY: SectionEntry<'gallery'> = {
  id: 'relay-work-gallery', type: 'gallery', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['relay-operations'].variants.gallery,
  props: {
    headline: 'Work in motion', subheadline: 'Teams share context, resolve handoffs, and keep the next step visible.', columns: 3,
    items: [
      { src: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1100&q=82', alt: 'Product team reviewing a shared workflow together', caption: 'One team view', category: 'Ownership' },
      { src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1100&q=82', alt: 'Colleagues collaborating around a planning board', caption: 'Clear handoffs', category: 'Coordination' },
      { src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1100&q=82', alt: 'Operational analytics dashboard with team metrics', caption: 'Visible progress', category: 'Momentum' },
    ],
  },
};

const RELAY_FEATURES: SectionEntry<'features'> = {
  id: 'relay-product-features', type: 'features', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['relay-operations'].variants.features,
  props: {
    headline: 'The system around the handoff', subheadline: 'A connected operating view for the decisions, owners, and actions behind the work.', columns: 4,
    items: [
      { title: 'Shared workspaces', description: 'Bring projects and decisions into one clear team view.', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&q=82' },
      { title: 'Reliable handoffs', description: 'Give recurring transitions an owner and a next step.' },
      { title: 'Useful signals', description: 'Spot delays and progress without digging through reports.' },
      { title: 'Connected tools', description: 'Keep existing systems in the loop as work moves forward.' },
    ],
  },
};
const RELAY_STATS: SectionEntry<'stats'> = {
  id: 'relay-operational-signals', type: 'stats', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['relay-operations'].variants.stats,
  props: { headline: 'Signals the team can act on', items: [{ value: '1 view', label: 'Shared project context' }, { value: 'Clear', label: 'Next owner at each handoff' }, { value: 'Live', label: 'Progress without status chasing' }] },
};
const RELAY_FAQ: SectionEntry<'faq'> = {
  id: 'relay-questions', type: 'faq', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['relay-operations'].variants.faq,
  props: { headline: 'Questions teams ask', items: [{ question: 'Does Relay replace our current tools?', answer: 'No. It connects work across your existing tools and makes the handoffs easier to follow.' }, { question: 'Can different teams use different workflows?', answer: 'Yes. Teams can maintain their own steps while sharing context and ownership.' }, { question: 'How does a rollout begin?', answer: 'Start with one recurring handoff, then expand once the team sees the value.' }] },
};
const RELAY_PRICING: SectionEntry<'pricing'> = {
  id: 'relay-plans', type: 'pricing', variantId: MARKETPLACE_TEMPLATE_VARIANT_PROFILES['relay-operations'].variants.pricing,
  props: { headline: 'Start with the workflow you have', subheadline: 'A guided walkthrough can help scope the right rollout.', tiers: [{ name: 'Team', price: 'Let’s talk', description: 'For one team making its first shared workflow.', features: ['One workflow map', 'Shared owners and next steps', 'Guided rollout plan'], cta: { label: 'Plan a walkthrough', href: '#demo' } }, { name: 'Organization', price: 'Let’s talk', description: 'For teams coordinating work across groups.', features: ['Multiple workflows', 'Connected operating view', 'Expansion planning'], cta: { label: 'Talk through your needs', href: '#demo' }, highlighted: true }] },
};

function SorellaPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div className="min-h-full bg-[#f3efe4] text-[#203b2c]" style={{ fontFamily: 'Lora, Georgia, serif' }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#203b2c]/15 px-6 py-5 sm:px-10">
        <RegistryBoundLink binding={SORELLA_BINDINGS.homeLink} href="#top" onIntent={onIntent} className="text-lg font-semibold tracking-[0.08em]">SORELLA <span className="font-normal">/</span> HOUSE</RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] uppercase tracking-[0.08em] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink binding={SORELLA_BINDINGS.reservationLink} href="#reservations" onIntent={onIntent} className="inline-flex items-center gap-2 border border-[#203b2c] px-3 py-2 text-xs uppercase tracking-[0.1em]">Find a table <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></RegistryBoundLink>
      </header>
      <main id="top">
        <section className={`grid ${compact ? 'grid-cols-1' : 'min-h-[510px] grid-cols-[0.9fr_1.1fr]'}`}>
          <div className="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-16">
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a34a32]">Wood fire · Long lunch · Good company</p>
            <h1 className="max-w-xl text-5xl leading-[0.98] sm:text-6xl">A little more time around the table.</h1>
            <p className="mt-6 max-w-md font-sans text-sm leading-6 text-[#536254]">Season-led cooking from our neighborhood kitchen. Come as you are; stay for one more plate.</p>
            <RegistryBoundLink binding={SORELLA_BINDINGS.menuHeroLink} href="#menu" onIntent={onIntent} className="mt-9 inline-flex w-fit items-center gap-3 border-b border-[#a34a32] pb-2 text-sm">See what is cooking <ArrowRight aria-hidden="true" className="h-4 w-4" /></RegistryBoundLink>
          </div>
          <div className={`relative min-h-64 ${compact ? 'order-first' : ''}`}>
            <img className="absolute inset-0 h-full w-full object-cover" src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1500&q=85" alt="Warm neighborhood restaurant dining room" />
            <p className="absolute bottom-4 left-4 bg-[#f3efe4] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em]">Oakland · Open Tue—Sun</p>
          </div>
        </section>
        <section id="menu" className="border-t border-[#203b2c]/15">
          <MarketplaceRegisteredSection templateId="sorella-house" section={SORELLA_SERVICES} variantId={SORELLA_SERVICES.variantId!} theme={SORELLA_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="gallery" className="border-t border-[#203b2c]/15">
          <MarketplaceRegisteredSection templateId="sorella-house" section={SORELLA_GALLERY} variantId={SORELLA_GALLERY.variantId!} theme={SORELLA_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="story" className={`grid items-center gap-8 bg-[#d8dfce] px-7 py-10 sm:px-12 ${compact ? 'grid-cols-1' : 'grid-cols-[1fr_1fr] lg:px-16'}`}>
          <p className="max-w-xl text-3xl leading-tight">“Good food starts with knowing who grew it.”</p>
          <p className="max-w-lg font-sans text-sm leading-6 text-[#536254]">Our menu follows the farms, the weather, and the people around us. We keep the room easy, the ingredients close, and the fire going.</p>
        </section>
        <section id="guest-notes" className="border-t border-[#203b2c]/15"><MarketplaceRegisteredSection templateId="sorella-house" section={SORELLA_TESTIMONIALS} variantId={SORELLA_TESTIMONIALS.variantId!} theme={SORELLA_VARIANT_THEME} onIntent={onIntent} /></section>
        <section id="visit-questions" className="border-t border-[#203b2c]/15"><MarketplaceRegisteredSection templateId="sorella-house" section={SORELLA_FAQ} variantId={SORELLA_FAQ.variantId!} theme={SORELLA_VARIANT_THEME} onIntent={onIntent} /></section>
        <section id="reservations" className={`grid gap-8 bg-[#203b2c] px-7 py-12 text-[#f3efe4] sm:px-12 ${compact ? 'grid-cols-1' : 'grid-cols-[0.8fr_1.2fr] lg:px-16'}`}>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e2a28a]">Pull up a chair</p><h2 className="mt-3 text-4xl">Make an evening of it.</h2><p className="mt-4 max-w-sm font-sans text-sm leading-6 text-white/70">Choose a day and party size. The booking flow will confirm availability when this template is installed with a configured schedule.</p></div>
          <RegistryBoundForm binding={SORELLA_BINDINGS.reservationSubmit} onIntent={onIntent} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 font-sans text-xs">Date<input required type="date" name="date" className="h-11 border border-white/25 bg-transparent px-3 text-sm" /></label>
            <label className="grid gap-2 font-sans text-xs">Time<select required name="time" defaultValue="" className="h-11 border border-white/25 bg-[#203b2c] px-3 text-sm"><option value="" disabled>Choose a time</option><option>5:30 PM</option><option>6:30 PM</option><option>7:30 PM</option></select></label>
            <label className="grid gap-2 font-sans text-xs">Party size<select required name="partySize" defaultValue="2" className="h-11 border border-white/25 bg-[#203b2c] px-3 text-sm"><option>2</option><option>3</option><option>4</option><option>5+</option></select></label>
            <label className="grid gap-2 font-sans text-xs">Email<input required type="email" name="email" placeholder="you@example.com" className="h-11 border border-white/25 bg-transparent px-3 text-sm placeholder:text-white/40" /></label>
            <button type="submit" {...marketplaceBindingAttributes(SORELLA_BINDINGS.reservationSubmit)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#e2a28a] px-4 font-sans text-sm font-semibold text-[#203b2c] sm:col-span-2">Request a table <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></button>
          </RegistryBoundForm>
        </section>
        <section id="visit" className={`grid gap-6 border-t border-[#203b2c]/15 px-7 py-9 font-sans sm:px-12 ${compact ? 'grid-cols-1' : 'grid-cols-3 lg:px-16'}`}>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a34a32]">Find us</p><p className="mt-2 text-sm">14 Webster Street<br />Oakland, California</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a34a32]">The kitchen</p><p className="mt-2 text-sm">Tuesday–Sunday<br />Dinner from 5:00 PM</p></div>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#a34a32]">Gatherings</p><p className="mt-2 text-sm">Private tables and seasonal menus for groups of eight or more.</p></div>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-4 bg-[#d8dfce] px-7 py-6 font-mono text-[10px] uppercase tracking-[0.14em] sm:px-12 lg:px-16"><span>Sorella House · Oakland, CA</span><span>Seasonal by nature, welcoming by design</span></footer>
      </main>
    </div>
  );
}

function FormworksPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div className="min-h-full bg-[#f7f8f5] text-[#182c3a]" style={{ fontFamily: 'var(--ut-font-sans, sans-serif)' }}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 sm:px-10">
        <RegistryBoundLink binding={FORMWORKS_BINDINGS.homeLink} href="#top" onIntent={onIntent} className="text-sm font-bold tracking-[0.12em]">FORMWORKS<span className="text-[#f05a3b]">.</span></RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink binding={FORMWORKS_BINDINGS.inquiryLink} href="#inquiry" onIntent={onIntent} className="inline-flex items-center gap-2 bg-[#f05a3b] px-3 py-2 text-xs font-semibold text-white">Start a brief <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></RegistryBoundLink>
      </header>
      <main id="top">
        <section className={`px-6 pb-7 pt-9 sm:px-10 sm:pt-14 ${compact ? '' : 'lg:px-16'}`}>
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f05a3b]">Architecture · Interiors · Objects</p>
          <div className={`grid gap-8 ${compact ? 'grid-cols-1' : 'grid-cols-[1.15fr_0.85fr] items-end'}`}>
            <h1 className="max-w-3xl text-5xl font-medium leading-[0.94] sm:text-7xl" style={{ fontFamily: 'Lora, Georgia, serif' }}>Space for the way life actually happens.</h1>
            <div className="max-w-sm"><p className="text-sm leading-6 text-[#5a6870]">An independent architecture practice making thoughtful, enduring places for living, gathering, and working.</p><RegistryBoundLink binding={FORMWORKS_BINDINGS.projectsHeroLink} href="#projects" onIntent={onIntent} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Explore selected work <ArrowDownRight aria-hidden="true" className="h-4 w-4" /></RegistryBoundLink></div>
          </div>
        </section>
        <section id="projects" className="border-y border-[#182c3a]/15">
          <MarketplaceRegisteredSection templateId="formworks-studio" section={FORMWORKS_GALLERY} variantId={FORMWORKS_GALLERY.variantId!} theme={FORMWORKS_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="practice" className={`border-t border-[#182c3a]/15 px-6 py-8 sm:px-10 ${compact ? '' : 'lg:px-16'}`}>
          <div className={`flex gap-6 ${compact ? 'flex-col' : 'items-start justify-between'}`}><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f05a3b]">Small studio, full attention</p><p className="max-w-xl text-lg leading-7" style={{ fontFamily: 'Lora, Georgia, serif' }}>We take on a few projects at a time, stay close to the build, and design around the people who will use the place.</p></div>
        </section>
        <section id="project-notes" className={`grid gap-8 bg-[#e8ece8] px-6 py-10 sm:px-10 ${compact ? 'grid-cols-1' : 'grid-cols-[0.6fr_1.4fr] lg:px-16'}`}>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f05a3b]">How we work</p><h2 className="mt-3 text-3xl" style={{ fontFamily: 'Lora, Georgia, serif' }}>A clear path from first sketch to final key.</h2></div>
          <div className="grid gap-0 sm:grid-cols-3">{[['01', 'Listen', 'We start with the daily routines, constraints, and possibilities of a place.'], ['02', 'Test', 'Options are drawn, costed, and reviewed with the people who will use them.'], ['03', 'Build', 'We stay involved through delivery so the details survive the process.']].map(([step, title, text]) => <article key={step} className="border-t border-[#182c3a]/20 py-4 sm:ml-4"><p className="font-mono text-[10px] text-[#f05a3b]">{step}</p><h3 className="mt-3 text-lg">{title}</h3><p className="mt-2 max-w-xs text-xs leading-5 text-[#5a6870]">{text}</p></article>)}</div>
        </section>
        <section id="studio-story" className="border-t border-[#182c3a]/15">
          <MarketplaceRegisteredSection templateId="formworks-studio" section={FORMWORKS_ABOUT} variantId={FORMWORKS_ABOUT.variantId!} theme={FORMWORKS_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="studio-facts" className="border-t border-[#182c3a]/15">
          <MarketplaceRegisteredSection templateId="formworks-studio" section={FORMWORKS_STATS} variantId={FORMWORKS_STATS.variantId!} theme={FORMWORKS_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="client-notes" className="border-t border-[#182c3a]/15">
          <MarketplaceRegisteredSection templateId="formworks-studio" section={FORMWORKS_TESTIMONIALS} variantId={FORMWORKS_TESTIMONIALS.variantId!} theme={FORMWORKS_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="practice-services" className="border-t border-[#182c3a]/15">
          <MarketplaceRegisteredSection templateId="formworks-studio" section={FORMWORKS_SERVICES} variantId={FORMWORKS_SERVICES.variantId!} theme={FORMWORKS_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="inquiry" className={`grid gap-8 bg-[#182c3a] px-6 py-12 text-white sm:px-10 ${compact ? 'grid-cols-1' : 'grid-cols-[0.8fr_1.2fr] lg:px-16'}`}>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f39a7e]">A good first conversation</p><h2 className="mt-3 text-4xl" style={{ fontFamily: 'Lora, Georgia, serif' }}>Tell us what you are imagining.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-white/65">Share a few details about your project. A configured quote workflow can collect the brief after installation.</p></div>
          <RegistryBoundForm binding={FORMWORKS_BINDINGS.quoteSubmit} onIntent={onIntent} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-xs">Your name<input required name="name" autoComplete="name" className="h-11 border border-white/25 bg-transparent px-3 text-sm" /></label>
            <label className="grid gap-2 text-xs">Email<input required type="email" name="email" autoComplete="email" className="h-11 border border-white/25 bg-transparent px-3 text-sm" /></label>
            <label className="grid gap-2 text-xs">Project type<select required name="projectType" defaultValue="" className="h-11 border border-white/25 bg-[#182c3a] px-3 text-sm"><option value="" disabled>Select a project</option><option>Home renovation</option><option>New build</option><option>Workplace or hospitality</option></select></label>
            <label className="grid gap-2 text-xs">Location<input name="location" placeholder="City or region" className="h-11 border border-white/25 bg-transparent px-3 text-sm placeholder:text-white/45" /></label>
            <label className="grid gap-2 text-xs sm:col-span-2">What should we know?<textarea name="projectSummary" rows={3} className="border border-white/25 bg-transparent px-3 py-2 text-sm" /></label>
            <button type="submit" {...marketplaceBindingAttributes(FORMWORKS_BINDINGS.quoteSubmit)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#f05a3b] px-4 text-sm font-semibold sm:col-span-2">Request a project conversation <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></button>
          </RegistryBoundForm>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs sm:px-10 lg:px-16"><span>Formworks Studio · Portland, Pacific Northwest</span><span>Architecture shaped around people and place</span></footer>
      </main>
    </div>
  );
}

function RelayPreview({ compact, onIntent, templateId, templateName, pages, currentPagePath, onNavigate }: MarketplacePreviewProps) {
  return (
    <div className="min-h-full bg-[#111916] text-[#f2f4e9]" style={{ fontFamily: 'var(--ut-font-sans, sans-serif)' }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5 sm:px-10">
        <RegistryBoundLink binding={RELAY_BINDINGS.homeLink} href="#top" onIntent={onIntent} className="flex items-center gap-2 text-sm font-semibold tracking-wide"><span className="grid h-6 w-6 place-items-center bg-[#c8f169] text-[#111916]">r</span>relay</RegistryBoundLink>
        <MarketplacePageNavigation templateId={templateId} templateName={templateName} pages={pages} currentPagePath={currentPagePath} onNavigate={onNavigate} className="order-3 flex w-full gap-4 overflow-x-auto font-sans text-[10px] text-white/65 md:order-none md:w-auto md:flex-1 md:justify-center" />
        <RegistryBoundLink binding={RELAY_BINDINGS.demoLink} href="#demo" onIntent={onIntent} className="inline-flex items-center gap-2 bg-[#c8f169] px-3 py-2 text-xs font-semibold text-[#111916]">See Relay in action <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></RegistryBoundLink>
      </header>
      <main id="top">
        <section className={`grid items-center gap-8 px-6 py-12 sm:px-10 sm:py-16 ${compact ? 'grid-cols-1' : 'grid-cols-[0.9fr_1.1fr] lg:px-16'}`}>
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#c8f169]">Operations, without the chase</p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] sm:text-6xl">Work moves when everyone can see it.</h1>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/65">Relay connects the handoffs between teams, so priorities stay visible and the next step is always clear.</p>
            <RegistryBoundLink binding={RELAY_BINDINGS.productHeroLink} href="#workflow" onIntent={onIntent} className="mt-8 inline-flex items-center gap-3 border-b border-[#c8f169] pb-2 text-sm">Explore the workflow <ArrowRight aria-hidden="true" className="h-4 w-4 text-[#c8f169]" /></RegistryBoundLink>
          </div>
          <div id="workflow" className="border border-white/15 bg-[#1b2520] p-3 sm:p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3"><div><p className="text-xs font-medium">Launch operations</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/45">Workspace · This week</p></div><span className="bg-[#c8f169]/15 px-2 py-1 font-mono text-[9px] text-[#c8f169]">On track</span></div>
            <div className={`mt-4 grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-3'}`}>
              {[['01', 'Define scope', 'Product', 'Complete'], ['02', 'Review content', 'Studio', 'In review'], ['03', 'Prepare launch', 'Growth', 'Next up']].map(([number, title, owner, status], index) => (
                <article key={number} className="border border-white/10 p-3"><div className="flex items-center justify-between"><span className="font-mono text-[9px] text-[#c8f169]">{number}</span><span className={`h-1.5 w-1.5 ${index === 0 ? 'bg-[#c8f169]' : index === 1 ? 'bg-[#86c8d0]' : 'bg-white/25'}`} /></div><h2 className="mt-5 text-sm font-medium">{title}</h2><div className="mt-3 flex justify-between gap-2 font-mono text-[9px] text-white/45"><span>{owner}</span><span>{status}</span></div></article>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4"><div className="flex -space-x-1"><span className="grid h-6 w-6 place-items-center rounded-full border border-[#1b2520] bg-[#f0a183] text-[9px] text-[#111916]">M</span><span className="grid h-6 w-6 place-items-center rounded-full border border-[#1b2520] bg-[#86c8d0] text-[9px] text-[#111916]">J</span><span className="grid h-6 w-6 place-items-center rounded-full border border-[#1b2520] bg-[#c8f169] text-[9px] text-[#111916]">A</span></div><p className="text-[10px] text-white/50">One shared view. Clear owners. Fewer follow-ups.</p></div>
          </div>
        </section>
        <section id="teams" className="border-t border-white/10">
          <MarketplaceRegisteredSection templateId="relay-operations" section={RELAY_FEATURES} variantId={RELAY_FEATURES.variantId!} theme={RELAY_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="signals" className="border-t border-white/10">
          <MarketplaceRegisteredSection templateId="relay-operations" section={RELAY_STATS} variantId={RELAY_STATS.variantId!} theme={RELAY_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="work-gallery" className="border-t border-white/10">
          <MarketplaceRegisteredSection templateId="relay-operations" section={RELAY_GALLERY} variantId={RELAY_GALLERY.variantId!} theme={RELAY_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="customer-note" className={`grid gap-6 px-6 py-12 sm:px-10 ${compact ? 'grid-cols-1' : 'grid-cols-[1fr_1fr] lg:px-16'}`}>
          <div className="relative min-h-64 overflow-hidden bg-[#273b34]">
            <img src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&q=82" alt="Product team reviewing a shared workflow together" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          </div>
          <div className="flex flex-col justify-center"><p className="text-3xl leading-tight">“We stopped asking where the work was and started moving it forward.”</p><div className="mt-7 border-l border-[#c8f169] pl-4"><p className="text-sm font-medium">Operations lead</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">A growing product team</p></div></div>
        </section>
        <section id="plans" className="border-y border-white/10">
          <MarketplaceRegisteredSection templateId="relay-operations" section={RELAY_PRICING} variantId={RELAY_PRICING.variantId!} theme={RELAY_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="questions" className="border-t border-white/10">
          <MarketplaceRegisteredSection templateId="relay-operations" section={RELAY_FAQ} variantId={RELAY_FAQ.variantId!} theme={RELAY_VARIANT_THEME} onIntent={onIntent} />
        </section>
        <section id="demo" className={`grid gap-8 px-6 py-12 sm:px-10 ${compact ? 'grid-cols-1' : 'grid-cols-[0.8fr_1.2fr] lg:px-16'}`}>
          <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#c8f169]">See your workflow in Relay</p><h2 className="mt-3 text-4xl">Bring one handoff.</h2><p className="mt-4 max-w-sm text-sm leading-6 text-white/65">Tell us where work slows down. The configured demo request flow will collect your details after installation.</p></div>
          <RegistryBoundForm binding={RELAY_BINDINGS.demoSubmit} onIntent={onIntent} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-xs">Work email<input required type="email" name="email" autoComplete="email" className="h-11 border border-white/25 bg-transparent px-3 text-sm" /></label>
            <label className="grid gap-2 text-xs">Team size<select name="teamSize" defaultValue="1-10" className="h-11 border border-white/25 bg-[#111916] px-3 text-sm"><option>1-10</option><option>11-50</option><option>51-200</option><option>201+</option></select></label>
            <label className="grid gap-2 text-xs sm:col-span-2">Which handoff should we look at?<textarea required name="workflow" rows={3} className="border border-white/25 bg-transparent px-3 py-2 text-sm" /></label>
            <button type="submit" {...marketplaceBindingAttributes(RELAY_BINDINGS.demoSubmit)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#c8f169] px-4 text-sm font-semibold text-[#111916] sm:col-span-2">Request a product demo <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></button>
          </RegistryBoundForm>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-4 bg-[#c8f169] px-6 py-6 text-sm text-[#111916] sm:px-10 lg:px-16"><span className="font-semibold">Less chasing. More making.</span><RegistryBoundLink binding={RELAY_BINDINGS.demoFooterLink} href="#demo" onIntent={onIntent} className="inline-flex items-center gap-2">Meet Relay <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></RegistryBoundLink></footer>
      </main>
    </div>
  );
}

export const AUTHORED_MARKETPLACE_TEMPLATES: AuthoredMarketplaceTemplate[] = [
  {
    id: 'sorella-house',
    name: 'Sorella House',
    category: 'Hospitality',
    description: 'A seasonal neighborhood kitchen with a menu-led story and an easy path to plan a visit.',
    artDirection: 'Market green · Lora · ingredient-first editorial',
    coverImage: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1000&q=82',
    theme: SORELLA_VARIANT_THEME,
    pages: [
      { id: 'menu', path: '/menu', archetype: 'shop', label: 'Menu', title: 'From field to table', description: 'A seasonal menu shaped by nearby growers, the wood fire, and a table made for sharing.', sections: [SORELLA_SERVICES, SORELLA_GALLERY] },
      { id: 'visit', path: '/visit', archetype: 'custom', label: 'Visit', title: 'Make an evening of it', description: 'Plan a table, get to know the room, and see what to expect before you arrive.', sections: [SORELLA_TESTIMONIALS, SORELLA_FAQ] },
    ],
    bindings: Object.values(SORELLA_BINDINGS),
    preview: SorellaPreview,
  },
  {
    id: 'formworks-studio',
    name: 'Formworks Studio',
    category: 'Architecture',
    description: 'A project-forward practice site built around editorial type, material photography, and a clear inquiry path.',
    artDirection: 'Cobalt ink · citrus red · architectural journal',
    coverImage: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=1000&q=82',
    theme: FORMWORKS_VARIANT_THEME,
    pages: [
      { id: 'projects', path: '/projects', archetype: 'gallery', label: 'Projects', title: 'Selected case studies', description: 'A closer look at the sites, material decisions, and people behind the work.', sections: [FORMWORKS_GALLERY, FORMWORKS_TESTIMONIALS] },
      { id: 'practice', path: '/practice', archetype: 'about', label: 'Practice', title: 'A small studio, full attention', description: 'Architecture, interiors, and project stewardship from first conversation to final walk-through.', sections: [FORMWORKS_ABOUT, FORMWORKS_SERVICES, FORMWORKS_STATS] },
    ],
    bindings: Object.values(FORMWORKS_BINDINGS),
    preview: FormworksPreview,
  },
  {
    id: 'relay-operations',
    name: 'Relay Operations',
    category: 'Software',
    description: 'A product-led operations site that puts the workflow itself at the center of the story.',
    artDirection: 'Night green · acid lime · product interface',
    coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&q=82',
    theme: RELAY_VARIANT_THEME,
    pages: [
      { id: 'product', path: '/product', archetype: 'custom', label: 'Product', title: 'The operating view around the work', description: 'See how ownership, workflows, and progress stay connected across a team.', sections: [RELAY_FEATURES, RELAY_STATS, RELAY_FAQ] },
      { id: 'plans', path: '/plans', archetype: 'pricing', label: 'Plans', title: 'Start with one workflow', description: 'Choose a rollout that meets the team where it is today.', sections: [RELAY_PRICING, RELAY_FAQ] },
    ],
    bindings: Object.values(RELAY_BINDINGS),
    preview: RelayPreview,
  },
  ...ADDITIONAL_MARKETPLACE_TEMPLATES,
];