/**
 * Canonical Industry Default Template Registry
 *
 * This is NOT a second template engine. It is the deterministic bridge between
 * the canonical Industry Matrix and the existing TemplateComposition registry.
 *
 * Responsibilities:
 *  - give every first-class industry exactly one known-good default composition
 *  - provide curated starter content for route sections that are required by an
 *    industry page contract but are not present on the selected Home composition
 *  - provide first-party compositions for industries that previously fell
 *    through to another industry's layout (local service, contractor, real estate)
 *
 * Page presence/order remains owned by `industryMatrix.defaultPages` and the
 * topology planner. Rendering remains owned by the section/variant registry.
 */

import type {
  FAQItem,
  GalleryItem,
  PricingTier,
  SectionEntry,
  SectionType,
  ServiceItem,
  StatItem,
  TemplateComposition,
  TestimonialItem,
  ThemeTokens,
} from '../types';
import { normalizeIndustryKey } from '@/platform/core/industryMatrix';

export type CanonicalIndustryKey =
  | 'saas'
  | 'salon'
  | 'restaurant'
  | 'local-service'
  | 'contractor'
  | 'coaching'
  | 'real-estate'
  | 'ecommerce'
  | 'portfolio'
  | 'nonprofit'
  | 'agency';

export interface IndustryDefaultTemplateRegistration {
  industry: CanonicalIndustryKey;
  defaultTemplateId: string;
  label: string;
  systemType: 'booking' | 'saas' | 'agency' | 'portfolio' | 'store' | 'content';
}

export const INDUSTRY_DEFAULT_TEMPLATE_REGISTRY: Record<CanonicalIndustryKey, IndustryDefaultTemplateRegistration> = {
  saas: { industry: 'saas', defaultTemplateId: 'saas-dark', label: 'SaaS & Software', systemType: 'saas' },
  salon: { industry: 'salon', defaultTemplateId: 'salon-premium', label: 'Salon & Spa', systemType: 'booking' },
  restaurant: { industry: 'restaurant', defaultTemplateId: 'restaurant-premium', label: 'Restaurant & Food', systemType: 'booking' },
  'local-service': { industry: 'local-service', defaultTemplateId: 'local-service-premium', label: 'Local Service', systemType: 'booking' },
  contractor: { industry: 'contractor', defaultTemplateId: 'contractor-premium', label: 'Contractor & Trades', systemType: 'booking' },
  coaching: { industry: 'coaching', defaultTemplateId: 'coaching-premium', label: 'Coaching & Consulting', systemType: 'booking' },
  'real-estate': { industry: 'real-estate', defaultTemplateId: 'real-estate-premium', label: 'Real Estate', systemType: 'agency' },
  ecommerce: { industry: 'ecommerce', defaultTemplateId: 'store-premium', label: 'E-Commerce', systemType: 'store' },
  portfolio: { industry: 'portfolio', defaultTemplateId: 'portfolio-photography', label: 'Portfolio & Creative', systemType: 'portfolio' },
  nonprofit: { industry: 'nonprofit', defaultTemplateId: 'nonprofit-premium', label: 'Nonprofit & Content', systemType: 'content' },
  agency: { industry: 'agency', defaultTemplateId: 'agency-bold', label: 'Agency & Professional Services', systemType: 'agency' },
};

export function getIndustryDefaultRegistration(industry: string | null | undefined): IndustryDefaultTemplateRegistration | undefined {
  if (!industry) return undefined;
  const explicit = INDUSTRY_DEFAULT_TEMPLATE_REGISTRY[industry.trim().toLowerCase() as CanonicalIndustryKey];
  if (explicit) return explicit;
  const normalized = normalizeIndustryKey(industry) as CanonicalIndustryKey;
  return INDUSTRY_DEFAULT_TEMPLATE_REGISTRY[normalized];
}

export function getDefaultTemplateIdForIndustry(industry: string | null | undefined): string | undefined {
  return getIndustryDefaultRegistration(industry)?.defaultTemplateId;
}

interface IndustryStarterKit {
  industry: CanonicalIndustryKey;
  brand: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryIntent: string;
  primaryCta: string;
  secondaryCta: string;
  heroImage: string;
  gallery: GalleryItem[];
  services: ServiceItem[];
  stats: StatItem[];
  testimonials: TestimonialItem[];
  faqs: FAQItem[];
  about: string;
  contactPrompt: string;
}

const STARTER_KITS: Record<CanonicalIndustryKey, IndustryStarterKit> = {
  salon: {
    industry: 'salon', brand: 'Studio House', eyebrow: 'Modern beauty, thoughtfully delivered',
    headline: 'A studio experience designed around you.',
    subheadline: 'Signature services, expert care, and effortless online booking in one polished destination.',
    primaryIntent: 'booking.create', primaryCta: 'Book an appointment', secondaryCta: 'Explore services',
    heroImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=900&q=80', alt: 'Modern salon interior' },
      { src: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=900&q=80', alt: 'Salon styling service' },
      { src: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=900&q=80', alt: 'Beauty service detail' },
    ],
    services: [
      { title: 'Signature Cut', description: 'Consultation-led cutting and styling tailored to your texture and routine.', price: 'From $75', duration: '60 min' },
      { title: 'Dimensional Color', description: 'Custom color placement designed for tone, depth, and natural grow-out.', price: 'From $145', duration: '2 hrs' },
      { title: 'Treatment Ritual', description: 'Restorative care focused on shine, strength, hydration, and scalp health.', price: 'From $55', duration: '45 min' },
    ],
    stats: [{ value: '4.9★', label: 'Client rating' }, { value: '8+', label: 'Years of craft' }, { value: '500+', label: 'Clients served' }],
    testimonials: [
      { quote: 'The whole experience feels considered, from booking to the final detail.', author: 'Avery M.', role: 'Client' },
      { quote: 'I finally found a studio that understands both style and long-term hair health.', author: 'Jordan K.', role: 'Client' },
      { quote: 'Beautiful space, clear recommendations, and exactly the result we discussed.', author: 'Mia R.', role: 'Client' },
    ],
    faqs: [
      { question: 'How should I prepare for my appointment?', answer: 'Bring inspiration photos and notes about recent treatments or color history so your stylist can plan safely.' },
      { question: 'Can I book a consultation first?', answer: 'Yes. Choose a consultation when you are considering a major color change, corrective work, or a new service.' },
      { question: 'What is your cancellation policy?', answer: 'Appointment policies are confirmed during booking and can be reviewed before you finalize your time.' },
    ],
    about: 'We combine technical craft with a calm, modern service experience. Every visit starts with listening, then builds a plan around your goals, routine, and personal style.',
    contactPrompt: 'Tell us what you are looking for and our studio will help you choose the right service.',
  },
  restaurant: {
    industry: 'restaurant', brand: 'Table & Hearth', eyebrow: 'Seasonal kitchen · neighborhood hospitality',
    headline: 'A table worth coming back to.',
    subheadline: 'Season-led cooking, generous hospitality, and memorable evenings made simple to reserve.',
    primaryIntent: 'booking.create', primaryCta: 'Reserve a table', secondaryCta: 'View the menu',
    heroImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80', alt: 'Seasonal dishes on a table' },
      { src: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=900&q=80', alt: 'Warm restaurant dining room' },
      { src: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80', alt: 'Chef plated dish' },
    ],
    services: [
      { title: 'Dinner', description: 'Seasonal plates, shared dishes, and a focused wine and cocktail list.', price: 'À la carte' },
      { title: 'Weekend Brunch', description: 'Comforting classics, bright seasonal dishes, and relaxed weekend service.', price: 'Sat–Sun' },
      { title: 'Private Dining', description: 'Flexible menus and thoughtful hosting for celebrations and team dinners.', price: 'By enquiry' },
    ],
    stats: [{ value: '4.8★', label: 'Guest rating' }, { value: 'Local', label: 'Seasonal sourcing' }, { value: '7 days', label: 'Reservations open' }],
    testimonials: [
      { quote: 'Warm, precise service and the kind of food you talk about the next morning.', author: 'Nora S.', role: 'Guest' },
      { quote: 'The room feels special without trying too hard. We already booked our next dinner.', author: 'Chris D.', role: 'Guest' },
      { quote: 'A polished neighborhood restaurant with genuinely memorable cooking.', author: 'Taylor B.', role: 'Guest' },
    ],
    faqs: [
      { question: 'Do you take reservations?', answer: 'Yes. Reserve online for available times; larger parties can contact the restaurant directly.' },
      { question: 'Can you accommodate dietary restrictions?', answer: 'Share allergies or dietary needs with your reservation so the kitchen can advise on suitable options.' },
      { question: 'Do you host private events?', answer: 'Private dining and group options are available by enquiry depending on date, party size, and menu needs.' },
    ],
    about: 'Our kitchen follows the seasons and our dining room is built around generous, unhurried hospitality. The menu changes often, but the goal stays simple: food worth sharing and a room worth returning to.',
    contactPrompt: 'Ask about reservations, group dining, accessibility, or anything that will help us prepare for your visit.',
  },
  saas: {
    industry: 'saas', brand: 'Orbit Systems', eyebrow: 'Built for modern operating teams',
    headline: 'Move work from scattered to coordinated.',
    subheadline: 'A focused software platform that turns repeatable workflows into clear, measurable systems.',
    primaryIntent: 'contact.submit', primaryCta: 'Start free', secondaryCta: 'See the platform',
    heroImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80', alt: 'Analytics dashboard' },
      { src: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=900&q=80', alt: 'Product team collaborating' },
      { src: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=900&q=80', alt: 'Cloud infrastructure' },
    ],
    services: [
      { title: 'Unified Workspace', description: 'Bring projects, communication, and decisions into one operating view.' },
      { title: 'Automated Workflows', description: 'Turn recurring handoffs into reliable rules with less manual coordination.' },
      { title: 'Operational Analytics', description: 'Track adoption, throughput, and outcomes with dashboards built for action.' },
    ],
    stats: [{ value: '38%', label: 'Less admin work' }, { value: '2.4×', label: 'Faster handoffs' }, { value: '99.9%', label: 'Platform uptime' }],
    testimonials: [
      { quote: 'We replaced three disconnected workflows with one system the whole team understands.', author: 'Priya N.', role: 'COO' },
      { quote: 'Setup was fast, but the real value is how much clearer ownership became.', author: 'Marcus L.', role: 'VP Operations' },
      { quote: 'It gives us structure without forcing every team into the same process.', author: 'Elena C.', role: 'Product Lead' },
    ],
    faqs: [
      { question: 'How quickly can we get started?', answer: 'Most teams can configure a first workflow immediately and expand as processes become clear.' },
      { question: 'Does it integrate with our existing stack?', answer: 'The platform is designed around common webhooks, APIs, and connected workflow patterns.' },
      { question: 'Can different teams use different workflows?', answer: 'Yes. Shared standards can coexist with team-specific views, fields, permissions, and automations.' },
    ],
    about: 'Orbit Systems is built for teams that have outgrown ad hoc coordination. We turn repeatable work into visible systems so people can spend more time executing and less time chasing status.',
    contactPrompt: 'Tell us about the workflow you want to improve and we will map the fastest path to a working setup.',
  },
  'local-service': {
    industry: 'local-service', brand: 'Neighborhood Service Co.', eyebrow: 'Fast response · trusted local service',
    headline: 'Reliable help for the work your home cannot wait on.',
    subheadline: 'Clear estimates, skilled technicians, and responsive service from first call through final walkthrough.',
    primaryIntent: 'quote.request', primaryCta: 'Request an estimate', secondaryCta: 'View services',
    heroImage: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80', alt: 'Home service professional at work' },
      { src: 'https://images.unsplash.com/photo-1505798577917-a65157d3320a?w=900&q=80', alt: 'Skilled repair work' },
      { src: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=900&q=80', alt: 'Technician completing service' },
    ],
    services: [
      { title: 'Repairs & Troubleshooting', description: 'Practical diagnosis and clear repair options for common household problems.', price: 'Estimate first' },
      { title: 'Installations', description: 'Clean, code-conscious installation with careful setup and walkthrough.', price: 'Project quote' },
      { title: 'Preventive Maintenance', description: 'Routine service that helps catch wear early and reduce surprise failures.', price: 'Plans available' },
    ],
    stats: [{ value: 'Same day', label: 'Response available' }, { value: 'Licensed', label: 'Qualified pros' }, { value: '4.9★', label: 'Local rating' }],
    testimonials: [
      { quote: 'They explained the issue clearly, gave options, and finished exactly when promised.', author: 'Jamie W.', role: 'Homeowner' },
      { quote: 'Professional from the first call through cleanup. No surprises on the invoice.', author: 'Sam R.', role: 'Property owner' },
      { quote: 'Fast response and excellent communication. This is who we call now.', author: 'Dana H.', role: 'Local client' },
    ],
    faqs: [
      { question: 'Do you provide estimates before work begins?', answer: 'Yes. We explain the recommended work, expected scope, and pricing before approved work starts.' },
      { question: 'What areas do you serve?', answer: 'Service areas are shown during enquiry. Share your address and we will confirm availability.' },
      { question: 'Are emergency appointments available?', answer: 'Urgent availability depends on trade, location, and schedule. Send the issue details for the fastest response.' },
    ],
    about: 'We built our service model around the things homeowners value most: responsive communication, skilled work, transparent decisions, and respect for the property.',
    contactPrompt: 'Describe the issue, location, and timing you need. We will respond with the next practical step.',
  },
  contractor: {
    industry: 'contractor', brand: 'Forge Construction', eyebrow: 'Licensed · insured · built to last',
    headline: 'Craftsmanship you can inspect at every stage.',
    subheadline: 'Residential construction and exterior projects managed with transparent scopes, clean sites, and accountable timelines.',
    primaryIntent: 'quote.request', primaryCta: 'Get a project estimate', secondaryCta: 'See recent work',
    heroImage: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80', alt: 'Construction team on site' },
      { src: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=900&q=80', alt: 'Completed modern home exterior' },
      { src: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80', alt: 'Architectural project detail' },
    ],
    services: [
      { title: 'Exterior Renovation', description: 'Siding, roofing, gutters, and exterior upgrades planned as one coordinated scope.', price: 'Custom estimate' },
      { title: 'Remodeling', description: 'Structured renovation delivery from demolition and rough work through final finishes.', price: 'Custom estimate' },
      { title: 'Project Management', description: 'Scheduling, trade coordination, inspections, and homeowner communication from start to closeout.', price: 'Included' },
    ],
    stats: [{ value: '15 yr', label: 'Workmanship warranty' }, { value: '250+', label: 'Projects completed' }, { value: 'Licensed', label: 'Fully insured' }],
    testimonials: [
      { quote: 'The scope was clear, the site stayed organized, and every change was communicated before it happened.', author: 'Ryan T.', role: 'Homeowner' },
      { quote: 'They managed the details like a real construction partner, not just a crew.', author: 'Alex P.', role: 'Property owner' },
      { quote: 'The finished work is excellent, but the communication is what set them apart.', author: 'Morgan S.', role: 'Client' },
    ],
    faqs: [
      { question: 'How does the estimate process work?', answer: 'We review the project, clarify scope and constraints, then provide a written estimate before scheduling.' },
      { question: 'Do you handle permits and inspections?', answer: 'Permit responsibility is confirmed in the project scope. When included, we coordinate required submissions and inspection milestones.' },
      { question: 'How are changes handled during construction?', answer: 'Any scope or cost change is documented and approved before the affected work moves forward.' },
    ],
    about: 'Forge Construction delivers residential projects with disciplined planning and visible accountability. We believe a professional build should feel organized long before the finished work is revealed.',
    contactPrompt: 'Share your project type, location, target timing, and any photos or drawings you already have.',
  },
  coaching: {
    industry: 'coaching', brand: 'Northstar Coaching', eyebrow: 'Focused coaching for meaningful change',
    headline: 'Turn clarity into consistent action.',
    subheadline: 'Structured coaching programs for leaders and professionals ready to make better decisions and build durable momentum.',
    primaryIntent: 'booking.create', primaryCta: 'Book a discovery call', secondaryCta: 'Explore programs',
    heroImage: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=900&q=80', alt: 'Coaching conversation' },
      { src: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=900&q=80', alt: 'Leadership workshop' },
      { src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=80', alt: 'Strategy session' },
    ],
    services: [
      { title: 'Clarity Intensive', description: 'A focused session to define the real challenge, priorities, and next decisions.', price: '$275' },
      { title: 'Leadership Program', description: 'A structured coaching engagement with goals, experiments, and accountability.', price: 'From $1,500' },
      { title: 'Team Workshop', description: 'Facilitated sessions for alignment, communication, and better operating habits.', price: 'Custom' },
    ],
    stats: [{ value: '200+', label: 'Leaders coached' }, { value: '92%', label: 'Goal completion' }, { value: '12 wk', label: 'Core program' }],
    testimonials: [
      { quote: 'The process gave me a way to make hard decisions without overcomplicating them.', author: 'Leah V.', role: 'Founder' },
      { quote: 'Every session ended with clear actions and accountability. That consistency changed how I lead.', author: 'Omar J.', role: 'Director' },
      { quote: 'Thoughtful, practical coaching that connected strategy with what I actually do each week.', author: 'Kim A.', role: 'Executive' },
    ],
    faqs: [
      { question: 'What happens on a discovery call?', answer: 'We discuss your goals, current constraints, and whether the coaching format is a good fit before any commitment.' },
      { question: 'Is coaching confidential?', answer: 'Yes. Engagement boundaries and confidentiality expectations are clarified at the start of the relationship.' },
      { question: 'Do you work with teams?', answer: 'Yes. Team workshops and leadership engagements can be structured around a shared challenge or operating goal.' },
    ],
    about: 'Northstar Coaching helps capable people create the structure needed to follow through. Our work blends reflection, decision frameworks, and practical accountability.',
    contactPrompt: 'Share what you are trying to change and where you feel stuck. We will suggest the best starting point.',
  },
  'real-estate': {
    industry: 'real-estate', brand: 'Avenue & Co.', eyebrow: 'Local market expertise · high-touch representation',
    headline: 'Make your next move with better information.',
    subheadline: 'Thoughtful representation for buyers and sellers who want strategy, market clarity, and responsive guidance.',
    primaryIntent: 'contact.submit', primaryCta: 'Schedule a consultation', secondaryCta: 'Browse listings',
    heroImage: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=80', alt: 'Modern home listing' },
      { src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80', alt: 'Luxury home exterior' },
      { src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=900&q=80', alt: 'Contemporary home interior' },
    ],
    services: [
      { title: 'Buy With Confidence', description: 'Neighborhood strategy, showing coordination, offer guidance, and due-diligence support.' },
      { title: 'Sell Strategically', description: 'Positioning, pricing, launch planning, and negotiation built around your goals.' },
      { title: 'Relocation Advisory', description: 'Area comparisons, virtual touring, and a structured move plan for out-of-market clients.' },
    ],
    stats: [{ value: '$48M', label: 'Recent volume' }, { value: '98%', label: 'List-to-sale ratio' }, { value: '12 yr', label: 'Market experience' }],
    testimonials: [
      { quote: 'We always knew what the next decision was and why it mattered.', author: 'Devin & Maya', role: 'Home buyers' },
      { quote: 'The launch strategy was sharp, communication was constant, and the negotiation exceeded our expectations.', author: 'Chris E.', role: 'Seller' },
      { quote: 'They translated the market into practical choices instead of pressure.', author: 'Nina F.', role: 'Relocation client' },
    ],
    faqs: [
      { question: 'When should I talk to an agent before buying?', answer: 'Earlier is useful. A planning conversation can clarify financing, neighborhoods, timing, and the real cost of your target move.' },
      { question: 'How do you prepare a home for market?', answer: 'We build a launch plan around condition, positioning, photography, pricing, showing strategy, and likely buyer expectations.' },
      { question: 'Can you help with relocation?', answer: 'Yes. We can structure area research, remote tours, vendor coordination, and a practical move timeline.' },
    ],
    about: 'Avenue & Co. combines local market knowledge with a calm, structured advisory process. We help clients understand the tradeoffs behind each move so they can act with confidence.',
    contactPrompt: 'Tell us whether you are buying, selling, or exploring a move and the timeline you have in mind.',
  },
  ecommerce: {
    industry: 'ecommerce', brand: 'Common Goods', eyebrow: 'Useful objects · considered design',
    headline: 'Everyday pieces, chosen with intention.',
    subheadline: 'A curated shop of durable, expressive products designed to earn a permanent place in your routine.',
    primaryIntent: 'cart.add', primaryCta: 'Shop new arrivals', secondaryCta: 'Explore the collection',
    heroImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&q=80', alt: 'Curated retail store' },
      { src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=80', alt: 'Product closeup' },
      { src: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=900&q=80', alt: 'Lifestyle products' },
    ],
    services: [
      { title: 'New Arrivals', description: 'Fresh pieces selected for usefulness, material quality, and lasting design.', price: 'Shop collection' },
      { title: 'Best Sellers', description: 'Customer favorites that have earned their place through repeated use.', price: 'Shop favorites' },
      { title: 'Gift Edit', description: 'Easy-to-give pieces for hosts, milestones, teams, and thoughtful everyday moments.', price: 'Browse gifts' },
    ],
    stats: [{ value: 'Free', label: 'Shipping over $75' }, { value: '30 day', label: 'Returns' }, { value: '4.8★', label: 'Customer rating' }],
    testimonials: [
      { quote: 'Everything feels thoughtfully selected. The quality was even better in person.', author: 'Alex C.', role: 'Customer' },
      { quote: 'Beautiful packaging, fast shipping, and products that actually feel built to last.', author: 'Jamie P.', role: 'Customer' },
      { quote: 'My default place for gifts now. The collection feels distinct without being overwhelming.', author: 'Riley S.', role: 'Customer' },
    ],
    faqs: [
      { question: 'When will my order ship?', answer: 'In-stock orders are typically processed promptly; delivery timing is shown at checkout based on destination.' },
      { question: 'What is the return policy?', answer: 'Eligible unused items can be returned within the stated return window. Final-sale exceptions are identified before purchase.' },
      { question: 'Do you ship internationally?', answer: 'Available shipping regions and any destination-specific costs are calculated during checkout.' },
    ],
    about: 'Common Goods is a tightly edited collection for people who want fewer, better things. We look for functional design, honest materials, and products that age well through real use.',
    contactPrompt: 'Need help with an order, product detail, gift, or return? Send us the details and we will help.',
  },
  portfolio: {
    industry: 'portfolio', brand: 'Studio North', eyebrow: 'Independent creative practice',
    headline: 'Distinct work for brands with something real to say.',
    subheadline: 'Selected identity, digital, and image-making projects shaped by strategy, craft, and a point of view.',
    primaryIntent: 'contact.submit', primaryCta: 'Start a project', secondaryCta: 'View selected work',
    heroImage: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=900&q=80', alt: 'Creative studio work' },
      { src: 'https://images.unsplash.com/photo-1558655146-d09347e92766?w=900&q=80', alt: 'Design project detail' },
      { src: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=900&q=80', alt: 'Art direction study' },
    ],
    services: [
      { title: 'Brand Systems', description: 'Identity direction, visual language, and flexible systems for consistent expression.' },
      { title: 'Digital Experiences', description: 'Web direction and interface design that balances clarity with character.' },
      { title: 'Campaign & Art Direction', description: 'Concept, image direction, and launch assets built around one coherent idea.' },
    ],
    stats: [{ value: '36', label: 'Selected launches' }, { value: '11', label: 'Industries explored' }, { value: '7 yr', label: 'Independent practice' }],
    testimonials: [
      { quote: 'The work gave us a visual language we could actually grow into.', author: 'Mara T.', role: 'Founder' },
      { quote: 'Strong point of view, rigorous thinking, and no generic design decisions.', author: 'Evan R.', role: 'Creative Director' },
      { quote: 'The final system felt original but still practical for our internal team.', author: 'Jules P.', role: 'Marketing Lead' },
    ],
    faqs: [
      { question: 'What kinds of projects are the best fit?', answer: 'Projects with a clear business need, room for creative direction, and a team ready to collaborate on decisions.' },
      { question: 'Do you work with existing brand systems?', answer: 'Yes. Engagements can extend, refine, or translate an existing identity into new channels.' },
      { question: 'How do projects usually begin?', answer: 'We start with scope, goals, constraints, references, and a working timeline before design production begins.' },
    ],
    about: 'Studio North is an independent practice working across identity, digital design, and art direction. The goal is not decoration; it is creating a visual system that makes the idea clearer and more memorable.',
    contactPrompt: 'Share the project, what needs to change, your target timing, and anything that helps explain the ambition.',
  },
  nonprofit: {
    industry: 'nonprofit', brand: 'Common Ground', eyebrow: 'Community-led work with measurable impact',
    headline: 'Turn care into practical change.',
    subheadline: 'Programs, stories, and ways to participate—organized around the people and communities closest to the work.',
    primaryIntent: 'donation.start', primaryCta: 'Support the mission', secondaryCta: 'See our programs',
    heroImage: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=900&q=80', alt: 'Community volunteers' },
      { src: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=900&q=80', alt: 'Community support program' },
      { src: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=900&q=80', alt: 'Volunteers working together' },
    ],
    services: [
      { title: 'Direct Programs', description: 'Practical services delivered with community partners and clear local accountability.' },
      { title: 'Resource Access', description: 'Guides, referrals, and support pathways that help people reach the right next step.' },
      { title: 'Community Partnerships', description: 'Shared initiatives that combine local knowledge, funding, and volunteer capacity.' },
    ],
    stats: [{ value: '12k+', label: 'People reached' }, { value: '87¢', label: 'Per dollar to programs' }, { value: '46', label: 'Community partners' }],
    testimonials: [
      { quote: 'They listened first, then built the program with the people who would actually use it.', author: 'Community Partner', role: 'Local organization' },
      { quote: 'The support was practical, respectful, and easy to understand when we needed it most.', author: 'Program Participant', role: 'Community member' },
      { quote: 'Clear reporting and visible outcomes make it easy to understand where support goes.', author: 'Recurring Donor', role: 'Supporter' },
    ],
    faqs: [
      { question: 'How are donations used?', answer: 'Funding priorities and program allocations are reported transparently, with current needs highlighted before donation.' },
      { question: 'Can I volunteer?', answer: 'Volunteer opportunities depend on current programs and are listed with role expectations, timing, and training needs.' },
      { question: 'How can an organization partner with you?', answer: 'Send your organization, community need, and collaboration idea. Partnership conversations begin with fit and local impact.' },
    ],
    about: 'Common Ground develops practical programs with communities rather than around them. We pair direct support with strong partnerships, transparent reporting, and tools people can use beyond one interaction.',
    contactPrompt: 'Reach out about programs, partnerships, volunteering, press, or support resources.',
  },
  agency: {
    industry: 'agency', brand: 'Signal Studio', eyebrow: 'Strategy · design · growth systems',
    headline: 'Make the business easier to understand—and harder to ignore.',
    subheadline: 'A senior-led agency helping ambitious teams sharpen positioning, digital experience, and go-to-market execution.',
    primaryIntent: 'contact.submit', primaryCta: 'Start a conversation', secondaryCta: 'See our work',
    heroImage: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1400&q=85',
    gallery: [
      { src: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=900&q=80', alt: 'Agency team collaboration' },
      { src: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=900&q=80', alt: 'Client strategy session' },
      { src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=900&q=80', alt: 'Workshop planning' },
    ],
    services: [
      { title: 'Positioning & Strategy', description: 'Clarify the audience, value proposition, narrative, and priorities behind the work.' },
      { title: 'Web & Digital Experience', description: 'Design high-conviction digital experiences that turn strategy into understandable action.' },
      { title: 'Growth Systems', description: 'Connect campaigns, lead capture, content, and measurement into a repeatable operating model.' },
    ],
    stats: [{ value: '42', label: 'Client launches' }, { value: '3.2×', label: 'Avg. lead lift' }, { value: '91%', label: 'Referral rate' }],
    testimonials: [
      { quote: 'They simplified a complicated offer and gave the whole company language we could use.', author: 'Mina R.', role: 'CEO' },
      { quote: 'The work connected brand, site, and pipeline instead of treating them as separate projects.', author: 'Theo M.', role: 'VP Growth' },
      { quote: 'Senior thinking stayed involved all the way through execution.', author: 'Andrea S.', role: 'Founder' },
    ],
    faqs: [
      { question: 'What size engagements do you take on?', answer: 'We work best on focused strategic and digital engagements with a clear decision-maker and measurable business objective.' },
      { question: 'Do you offer retainers?', answer: 'Yes. Ongoing work is structured around a defined operating cadence, priorities, and capacity rather than an open-ended task list.' },
      { question: 'Can you work with our internal team?', answer: 'Yes. We often partner with internal marketing, product, engineering, or sales teams and define ownership before work begins.' },
    ],
    about: 'Signal Studio is a senior-led strategy and digital practice. We focus on the connective tissue between what a business says, what customers experience, and how demand becomes a repeatable system.',
    contactPrompt: 'Tell us what needs to change, what is already working, and the outcome you need from the engagement.',
  },
};

function starterKitFor(industry: string | null | undefined): IndustryStarterKit | undefined {
  if (!industry) return undefined;
  return STARTER_KITS[normalizeIndustryKey(industry) as CanonicalIndustryKey];
}

function withCta(items: ServiceItem[], kit: IndustryStarterKit): ServiceItem[] {
  return items.map((item) => ({
    ...item,
    cta: item.cta ?? { label: kit.primaryCta, intent: kit.primaryIntent, variant: 'primary' },
  }));
}

function pricingFor(kit: IndustryStarterKit): PricingTier[] {
  const prices = kit.services.map((service, index) => service.price || (index === 0 ? 'Essential' : index === 1 ? 'Growth' : 'Custom'));
  return kit.services.slice(0, 3).map((service, index) => ({
    name: service.title,
    price: prices[index],
    description: service.description,
    features: [
      index === 0 ? 'Focused starting scope' : 'Expanded scope and support',
      'Clear next steps',
      'Responsive communication',
    ],
    cta: { label: kit.primaryCta, intent: kit.primaryIntent, variant: 'primary' },
    highlighted: index === 1,
  }));
}

/**
 * Curated route-section fallback. Called only when the selected composition is
 * missing a section type required by the canonical industry page contract.
 */
export function createIndustryStarterSection(
  industry: string | null | undefined,
  type: SectionType,
  context: { businessName: string; pageTitle?: string; idPrefix: string },
): SectionEntry | null {
  // Application screens have useful defaults even without a marketing starter kit.
  if (type === 'auth-form') return {
    id: `${context.idPrefix}-${type}`, type,
    props: { heading: context.pageTitle || 'Welcome back', subheading: `Sign in to ${context.businessName || 'your account'}.`, submitLabel: 'Sign in', footerNote: 'Authorized users only.' },
  };
  if (type === 'data-table') return {
    id: `${context.idPrefix}-${type}`, type,
    props: { heading: context.pageTitle || 'Records', columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }], rows: [], emptyMessage: 'No records yet.' },
  };
  const kit = starterKitFor(industry);
  if (!kit) return null;
  const brand = context.businessName?.trim() || kit.brand;
  const pageTitle = context.pageTitle?.trim();
  const id = `${context.idPrefix}-${type}`;

  switch (type) {
    case 'navbar':
      return { id, type, props: {
        brand,
        sticky: true,
        layout: 'standard',
        links: [
          { label: 'Services', href: '#services' },
          { label: 'About', href: '#about' },
          { label: 'Proof', href: '#proof' },
          { label: 'Contact', href: '#contact' },
        ],
        cta: { label: kit.primaryCta, intent: kit.primaryIntent, variant: 'primary' },
      } };
    case 'hero':
      return { id, type, props: {
        layout: pageTitle ? 'page-title' : 'split',
        badge: pageTitle || kit.eyebrow,
        headline: pageTitle || kit.headline,
        subheadline: pageTitle ? `${kit.subheadline}` : kit.subheadline,
        image: kit.heroImage,
        ctas: [
          { label: kit.primaryCta, intent: kit.primaryIntent, variant: 'primary' },
          { label: kit.secondaryCta, href: '#services', variant: 'outline' },
        ],
        stats: kit.stats,
      } };
    case 'services':
      return { id, type, props: { headline: pageTitle === 'Services' ? 'What we do' : 'Services built around the outcome', subheadline: kit.subheadline, columns: 3, layout: 'grid', items: withCta(kit.services, kit) } };
    case 'features':
      return { id, type, props: { headline: 'Why clients choose this approach', subheadline: 'A polished experience is built from clear expectations, useful communication, and dependable delivery.', columns: 3, layout: 'icon-left', items: withCta(kit.services.map((service, index) => ({ ...service, title: ['Clear process', 'Expert delivery', 'Responsive support'][index] || service.title, price: undefined, duration: undefined })), kit) } };
    case 'pricing':
      return { id, type, props: { headline: 'Options that make the next step clear', subheadline: 'Use these starter offers as a structured baseline, then replace them with your real services or packages.', tiers: pricingFor(kit) } };
    case 'testimonials':
      return { id, type, props: { headline: 'Proof from people who chose us', subheadline: 'Specific outcomes and experience matter more than generic claims.', items: kit.testimonials, layout: 'grid' } };
    case 'gallery':
      return { id, type, props: { headline: pageTitle === 'Listings' ? 'Featured listings' : pageTitle === 'Projects' ? 'Selected projects' : 'A closer look', subheadline: 'Use the visual proof that best represents the quality and character of the work.', items: kit.gallery, columns: 3, filterable: false } };
    case 'faq':
      return { id, type, props: { headline: 'Helpful details before you begin', items: kit.faqs, layout: 'accordion' } };
    case 'cta':
      return { id, type, props: { headline: 'Ready for the next step?', description: kit.contactPrompt, layout: 'split', ctas: [
        { label: kit.primaryCta, intent: kit.primaryIntent, variant: 'primary' },
        { label: 'Ask a question', href: '#contact', intent: 'contact.submit', variant: 'outline' },
      ] } };
    case 'contact':
      return { id, type, props: {
        headline: `Contact ${brand}`,
        description: kit.contactPrompt,
        layout: 'split-card',
        fields: [
          { name: 'name', type: 'text', placeholder: 'Your name', required: true },
          { name: 'email', type: 'email', placeholder: 'Email address', required: true },
          { name: 'message', type: 'textarea', placeholder: 'How can we help?', required: true },
        ],
        submitLabel: 'Send enquiry',
        submitIntent: 'contact.submit',
      } };
    case 'footer':
      return { id, type, props: {
        brand,
        layout: 'columns',
        newsletter: true,
        columns: [
          { title: 'Explore', links: [{ label: 'Services', href: '#services' }, { label: 'About', href: '#about' }] },
          { title: 'Connect', links: [{ label: 'Contact', href: '#contact' }, { label: 'Get started', href: '#contact', intent: kit.primaryIntent }] },
        ],
        copyright: `© ${brand}. All rights reserved.`,
      } };
    case 'stats':
      return { id, type, props: { headline: 'Built on visible proof', items: kit.stats, layout: 'row' } };
    case 'about':
      return { id, type, props: { headline: `About ${brand}`, description: kit.about, image: kit.gallery[1]?.src || kit.heroImage, layout: 'text-right', cta: { label: kit.primaryCta, intent: kit.primaryIntent, variant: 'outline' } } };
    case 'team':
      return { id, type, props: { headline: 'Meet the people behind the work', subheadline: 'A small, accountable team with clear ownership from first conversation through delivery.', columns: 3, members: [
        { name: 'Alex Morgan', role: 'Founder & Lead', bio: 'Leads client strategy, quality, and key decisions.' },
        { name: 'Jordan Lee', role: 'Client Experience', bio: 'Keeps communication, scheduling, and handoffs moving clearly.' },
        { name: 'Taylor Brooks', role: 'Specialist', bio: 'Brings focused craft and technical delivery to the work.' },
      ] } };
    case 'logo-cloud':
      return { id, type, props: { headline: 'Trusted by clients and partners', logos: [{ name: 'North & Co.' }, { name: 'Fieldwork' }, { name: 'Harbor' }, { name: 'Atlas' }] } };
    case 'blog-preview':
      return { id, type, props: { headline: 'Insights and updates', posts: [
        { title: 'What to know before you get started', excerpt: 'A practical guide to making the first conversation more useful and productive.', image: kit.gallery[0]?.src },
        { title: 'How we think about quality', excerpt: 'The standards and decisions that shape a better client experience.', image: kit.gallery[1]?.src },
        { title: 'Three questions clients ask most', excerpt: 'Clear answers to the details that usually matter before moving forward.', image: kit.gallery[2]?.src },
      ] } };
    case 'before-after':
      return { id, type, props: { headline: 'Transformation you can see', subheadline: 'Use before-and-after proof where the outcome is visual and measurable.', items: [
        { before: kit.gallery[0]?.src || kit.heroImage, after: kit.gallery[1]?.src || kit.heroImage, label: 'Project transformation' },
      ] } };
    default:
      return null;
  }
}

const LOCAL_SERVICE_THEME: ThemeTokens = {
  colors: {
    primary: '215 82% 45%', primaryForeground: '0 0% 100%', secondary: '210 33% 95%', secondaryForeground: '215 45% 20%',
    accent: '34 95% 55%', accentForeground: '215 45% 12%', background: '0 0% 100%', foreground: '218 28% 13%',
    muted: '210 24% 96%', mutedForeground: '215 12% 45%', card: '0 0% 100%', cardForeground: '218 28% 13%', border: '214 22% 88%',
  },
  typography: { headingFont: "'Manrope', sans-serif", bodyFont: "'Inter', sans-serif", headingWeight: '800', bodyWeight: '400' },
  radius: '0.75rem', sectionPadding: '5rem 1.5rem', containerWidth: '1180px',
};

const CONTRACTOR_THEME: ThemeTokens = {
  colors: {
    primary: '24 92% 50%', primaryForeground: '0 0% 100%', secondary: '220 13% 18%', secondaryForeground: '0 0% 100%',
    accent: '44 94% 57%', accentForeground: '220 20% 10%', background: '38 30% 97%', foreground: '220 20% 11%',
    muted: '35 18% 91%', mutedForeground: '220 8% 40%', card: '0 0% 100%', cardForeground: '220 20% 11%', border: '32 16% 82%',
  },
  typography: { headingFont: "'Archivo', sans-serif", bodyFont: "'DM Sans', sans-serif", headingWeight: '800', bodyWeight: '400' },
  radius: '0.4rem', sectionPadding: '5.5rem 1.5rem', containerWidth: '1200px',
};

const REAL_ESTATE_THEME: ThemeTokens = {
  colors: {
    primary: '145 24% 22%', primaryForeground: '42 40% 96%', secondary: '40 38% 91%', secondaryForeground: '145 24% 18%',
    accent: '31 58% 55%', accentForeground: '0 0% 100%', background: '42 45% 97%', foreground: '145 18% 14%',
    muted: '40 24% 92%', mutedForeground: '145 9% 42%', card: '0 0% 100%', cardForeground: '145 18% 14%', border: '38 20% 84%',
  },
  typography: { headingFont: "'Cormorant Garamond', serif", bodyFont: "'Manrope', sans-serif", headingWeight: '600', bodyWeight: '400' },
  radius: '0.25rem', sectionPadding: '6rem 1.5rem', containerWidth: '1240px',
};

function buildPremiumGeneratedComposition(
  industry: CanonicalIndustryKey,
  id: string,
  name: string,
  category: string,
  systemType: string,
  theme: ThemeTokens,
  homeTypes: SectionType[],
  tags: string[],
): TemplateComposition {
  const kit = STARTER_KITS[industry];
  const sections = homeTypes
    .map((type, index) => createIndustryStarterSection(industry, type, {
      businessName: kit.brand,
      idPrefix: `${id}-${index}`,
    }))
    .filter((section): section is SectionEntry => Boolean(section));

  // Give generated defaults stronger registry-owned visual variety. These IDs
  // are already registered in the existing variant registry.
  const variantByType: Partial<Record<SectionType, string>> = {
    hero: industry === 'contractor' ? 'hero:full-bleed' : 'hero:split-image',
    services: industry === 'contractor' ? 'services:alternating' : 'services:card-grid',
    gallery: industry === 'real-estate' ? 'gallery:feature-split' : 'gallery:editorial-mosaic',
    testimonials: 'testimonials:spotlight',
    faq: 'faq:accordion',
    contact: 'contact:split-card',
    stats: 'stats:banded-grid',
    footer: industry === 'contractor' ? 'footer:dark-band' : 'footer:columns',
  };

  return {
    id,
    name,
    category,
    industry,
    systemType,
    description: `${name} is a full-depth, registry-composed default with explicit industry proof, conversion, and service structure.`,
    tags,
    theme,
    sections: sections.map((section) => ({
      ...section,
      variantId: variantByType[section.type] as SectionEntry['variantId'] | undefined,
    })),
  };
}

export const GENERATED_INDUSTRY_DEFAULT_COMPOSITIONS: TemplateComposition[] = [
  buildPremiumGeneratedComposition(
    'local-service',
    'local-service-premium',
    'Local Service Pro',
    'contractor',
    'booking',
    LOCAL_SERVICE_THEME,
    ['navbar', 'hero', 'stats', 'services', 'gallery', 'testimonials', 'faq', 'cta', 'footer'],
    ['local-service', 'home-services', 'quote', 'trust', 'conversion'],
  ),
  buildPremiumGeneratedComposition(
    'contractor',
    'contractor-premium',
    'Contractor Built',
    'contractor',
    'booking',
    CONTRACTOR_THEME,
    ['navbar', 'hero', 'services', 'stats', 'gallery', 'testimonials', 'faq', 'cta', 'footer'],
    ['contractor', 'construction', 'trades', 'projects', 'quote'],
  ),
  buildPremiumGeneratedComposition(
    'real-estate',
    'real-estate-premium',
    'Real Estate Editorial',
    'realestate',
    'agency',
    REAL_ESTATE_THEME,
    ['navbar', 'hero', 'stats', 'services', 'gallery', 'testimonials', 'about', 'cta', 'footer'],
    ['real-estate', 'property', 'luxury', 'listings', 'lead-capture'],
  ),
];
