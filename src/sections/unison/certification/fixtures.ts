/** Deterministic sample content used by certification renders. Never shipped as page copy. */
import type { SectionPropsMap, SectionType, ThemeTokens } from '../../types';

export const CERTIFICATION_THEME: ThemeTokens = {
  colors: {
    primary: '222 47% 11%', primaryForeground: '0 0% 100%', secondary: '210 20% 96%', secondaryForeground: '222 47% 11%',
    accent: '24 90% 55%', accentForeground: '0 0% 100%', background: '0 0% 100%', foreground: '222 47% 11%',
    muted: '210 20% 96%', mutedForeground: '215 16% 40%', card: '0 0% 100%', cardForeground: '222 47% 11%', border: '214 32% 88%',
  },
  typography: { headingFont: 'Lora, serif', bodyFont: 'Inter, sans-serif', headingWeight: '600', bodyWeight: '400' },
  radius: '0.5rem', sectionPadding: '5rem 1rem', containerWidth: '1200px',
};

const img = (n: number) => ({ src: `https://images.example/${n}.jpg`, alt: `Sample image ${n}`, caption: `Caption ${n}`, category: n % 2 ? 'Work' : 'Studio' });
const cta = (label: string) => ({ label, href: '#contact', intent: 'contact.submit' });
const service = (n: number) => ({ title: `Service ${n}`, description: `Description for service ${n}.`, price: `$${n}0`, image: img(n).src, cta: cta('Book') });

export const CERTIFICATION_FIXTURES: { [K in SectionType]: SectionPropsMap[K] } = {
  navbar: { brand: 'Northline', links: [{ label: 'Work', href: '#work' }, { label: 'Studio', href: '#studio' }], cta: cta('Contact') },
  hero: { headline: 'A studio for considered work', subheadline: 'Sample subheadline', description: 'Sample description.', ctas: [cta('Start'), { ...cta('Learn more'), variant: 'outline' }], image: img(1).src, backgroundImage: img(2).src, images: [img(1), img(2), img(3), img(4)], badge: 'New', stats: [{ value: '12', label: 'Years' }] },
  services: { headline: 'Services', subheadline: 'What we do', items: [1, 2, 3, 4].map(service) },
  features: { headline: 'Features', subheadline: 'Why it works', items: [1, 2, 3, 4].map(service) },
  pricing: { headline: 'Pricing', tiers: [1, 2, 3].map((n) => ({ name: `Tier ${n}`, price: `$${n}9`, period: '/mo', description: 'Plan', features: ['One', 'Two'], cta: cta('Choose'), highlighted: n === 2 })) },
  testimonials: { headline: 'What clients say', subheadline: 'Proof', items: [1, 2, 3, 4].map((n) => ({ quote: `Sample quote ${n}.`, author: `Client ${n}`, role: 'Founder', rating: 5 })) },
  team: { headline: 'Team', members: [1, 2, 3].map((n) => ({ name: `Person ${n}`, role: 'Partner', bio: 'Bio', image: img(n).src })) },
  gallery: { headline: 'Gallery', items: [1, 2, 3, 4, 5, 6].map(img) },
  faq: { headline: 'Questions', items: [1, 2, 3].map((n) => ({ question: `Question ${n}?`, answer: `Answer ${n}.` })) },
  cta: { headline: 'Start a project', description: 'Sample', ctas: [cta('Get in touch')] },
  contact: { headline: 'Contact', description: 'Sample', fields: [{ name: 'email', type: 'email', placeholder: 'Email', required: true }], submitLabel: 'Send', submitIntent: 'contact.submit', address: '1 Main St', phone: '555-0100', email: 'hi@example.com' },
  footer: { brand: 'Northline', columns: [{ title: 'Studio', links: [{ label: 'About', href: '#about' }] }], socials: [{ platform: 'instagram', url: 'https://instagram.com/example' }], copyright: '© Northline' },
  stats: { headline: 'Proof', items: [{ value: '120+', label: 'Projects' }, { value: '12', label: 'Years' }, { value: '98%', label: 'Retention' }] },
  about: { headline: 'About', description: 'Sample story.', image: img(1).src, cta: cta('Meet us') },
  'logo-cloud': { headline: 'Trusted by', logos: [1, 2, 3, 4].map((n) => ({ name: `Brand ${n}` })) },
  'blog-preview': { headline: 'Journal', posts: [1, 2, 3, 4].map((n) => ({ title: `Post ${n}`, excerpt: 'Excerpt', image: img(n).src, date: '2026-01-0' + n, href: '#post' })) },
  'before-after': { headline: 'Results', items: [1, 2].map((n) => ({ before: img(n).src, after: img(n + 2).src, label: `Case ${n}` })) },
  'auth-form': { heading: 'Welcome back', subheading: 'Sign in to continue.', submitLabel: 'Sign in', footerNote: 'Authorized users only.' },
  'data-table': { heading: 'Recent work', columns: [{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }], rows: [{ name: 'Spring campaign', status: 'Active' }, { name: 'Onboarding flow', status: 'Draft' }], emptyMessage: 'Nothing here yet.', stats: [{ label: 'Active projects', value: '12', change: '+2' }] },
};
