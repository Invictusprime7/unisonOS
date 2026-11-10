import type { IndustryVerticalPack } from './types';

/** Composition profiles come from the dedicated SaaS registry entries. */
export const SAAS: IndustryVerticalPack = {
  id: 'saas',
  label: 'SaaS, apps & tech startups',
  keywords: ['saas', 'software', 'software company', 'startup', 'tech startup', 'mobile app', 'web app', 'app launch', 'platform', 'api', 'developer tool', 'developer tools', 'ai tool', 'ai startup', 'ai assistant', 'b2b software', 'crm', 'analytics platform', 'dashboard', 'chrome extension', 'productivity app', 'subscription software', 'waitlist', 'beta'],
  hostIndustry: 'saas',
  vocabulary: ['features', 'integrations', 'plans', 'free trial', 'onboarding', 'changelog', 'docs', 'security'],
  contentObjects: [
    { id: 'feature', label: 'Feature', fields: ['name', 'benefit', 'detail', 'screenshot'], sample: 'Smart inbox · triage in one click' },
    { id: 'plan', label: 'Plan', fields: ['name', 'who it is for', 'price (owner pricing only)', 'limits', 'features'], sample: 'Team · for growing teams' },
    { id: 'integration', label: 'Integration', fields: ['name', 'logo', 'what it does'], sample: 'Owner-supplied integrations only' },
    { id: 'release', label: 'Changelog entry', fields: ['version', 'date', 'changes'], sample: 'v1.4 · faster sync (sample)' },
  ],
  proofMechanisms: ['product screenshots', 'customer logos and quotes (owner-supplied only)', 'usage metrics (owner-supplied)', 'security and compliance (owner-supplied)'],
  interactions: [
    { id: 'product-tour', label: 'product tour', keywords: ['product tour', 'interactive demo', 'feature tour', 'see it in action', 'demo video'], brief: 'Tabbed or scrolling tour of real product screens.', certifiedFamilies: ['features'], originalComponent: 'ProductTour' },
    { id: 'pricing-toggle', label: 'pricing with billing toggle', keywords: ['pricing plans', 'monthly and yearly', 'billing toggle', 'compare plans'], brief: 'Plans with a local monthly/yearly toggle; prices only from the owner.', certifiedFamilies: ['pricing'], originalComponent: 'PlanPicker' },
    { id: 'waitlist', label: 'waitlist signup', keywords: ['waitlist', 'join the waitlist', 'early access', 'beta signup'], brief: 'Email signup through the registered newsletter or lead form; success only after acknowledgement.', certifiedFamilies: ['cta', 'contact'], originalComponent: 'WaitlistSignup' },
    { id: 'integrations-grid', label: 'integrations', keywords: ['integrations', 'connects with', 'works with'], brief: 'Real integrations from the owner as a logo grid.', certifiedFamilies: ['logo-cloud', 'features'], originalComponent: 'IntegrationsGrid' },
    { id: 'request-demo', label: 'demo request', keywords: ['book a demo', 'request a demo', 'talk to sales', 'schedule a demo'], brief: 'Company, team size and need through the registered form.', certifiedFamilies: ['contact'], originalComponent: 'DemoRequest' },
    { id: 'changelog', label: 'changelog', keywords: ['changelog', 'release notes', 'what’s new', "what's new"], brief: 'Dated releases from the owner, labelled when sample.', certifiedFamilies: ['blog-preview', 'features'], originalComponent: 'Changelog' },
  ],
  variants: [
    { id: 'b2b-saas', label: 'B2B SaaS', keywords: ['b2b software', 'saas', 'crm', 'analytics platform', 'software company', 'subscription software', 'dashboard'], vocabulary: ['workspace', 'seats', 'SSO', 'admin'], signatureInteractions: ['product-tour', 'pricing-toggle', 'request-demo'],
      pages: [{ title: 'Product', route: '/product', role: 'services', purpose: 'Features.' }, { title: 'Pricing', route: '/pricing', role: 'pricing', purpose: 'Plans.' }, { title: 'Customers', route: '/customers', role: 'custom', purpose: 'Customer stories.' }, { title: 'Contact Sales', route: '/contact', role: 'contact', purpose: 'Book a demo.' }],
      primaryAction: 'start a free trial or book a demo', proof: ['customer logos', 'quotes', 'security'] },
    { id: 'consumer-app', label: 'Consumer or mobile app', keywords: ['mobile app', 'productivity app', 'app launch', 'web app', 'chrome extension'], vocabulary: ['download', 'app store', 'streaks', 'notifications'], signatureInteractions: ['product-tour', 'waitlist'],
      pages: [{ title: 'Features', route: '/features', role: 'services', purpose: 'What the app does.' }, { title: 'Pricing', route: '/pricing', role: 'pricing', purpose: 'Free and premium.' }, { title: 'FAQ', route: '/faq', role: 'faq', purpose: 'Questions.' }],
      primaryAction: 'download or join the waitlist', proof: ['app ratings (owner-supplied)', 'user quotes'] },
    { id: 'dev-ai-tool', label: 'Developer or AI tool', keywords: ['api', 'developer tool', 'developer tools', 'ai tool', 'ai startup', 'ai assistant', 'platform'], vocabulary: ['SDK', 'docs', 'latency', 'usage-based'], signatureInteractions: ['product-tour', 'integrations-grid', 'changelog'],
      pages: [{ title: 'Product', route: '/product', role: 'services', purpose: 'Capabilities.' }, { title: 'Pricing', route: '/pricing', role: 'pricing', purpose: 'Usage plans.' }, { title: 'Changelog', route: '/changelog', role: 'blog', purpose: 'Releases.' }, { title: 'Contact', route: '/contact', role: 'contact', purpose: 'Talk to the team.' }],
      primaryAction: 'get an API key or start building', proof: ['code samples', 'customer logos'] },
  ],
  imagery: ['real product UI in device or browser frames', 'abstract brand shapes from the theme'],
  motion: ['UI panels that slide in on scroll', 'subtle pointer-follow highlights'],
  designTerms: ['modern', 'clean', 'product-led', 'bento', 'grid', 'futuristic'],
  honesty: ['Customer logos, metrics, ratings and compliance badges only from the owner.', 'Screenshots are the owner’s product or clearly illustrative.'],
  roleProfiles: {},
};
