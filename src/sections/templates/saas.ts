/**
 * SaaS & Software Template Compositions
 * Real production layouts for software products, platforms, and developer tools.
 */
import type { TemplateComposition } from '../types';

export const SAAS_COMPOSITIONS: TemplateComposition[] = [
  // ──────────────────────────────────────────────
  // VARIANT 1: Apex — dark, conversion-optimized SaaS landing
  // ──────────────────────────────────────────────
  {
    id: 'saas-dark',
    name: 'SaaS Dark',
    category: 'saas',
    industry: 'saas',
    systemType: 'saas',
    description: 'Dark, high-contrast SaaS landing page with trial-start and pricing focus.',
    tags: ['saas', 'software', 'startup', 'dark', 'conversion'],
    theme: {
      colors: {
        primary: '221 83% 53%',
        primaryForeground: '0 0% 100%',
        secondary: '240 20% 18%',
        secondaryForeground: '210 40% 90%',
        accent: '190 95% 45%',
        accentForeground: '222 47% 5%',
        background: '225 28% 7%',
        foreground: '210 40% 96%',
        muted: '225 20% 14%',
        mutedForeground: '215 20% 60%',
        card: '225 25% 10%',
        cardForeground: '210 40% 96%',
        border: '225 18% 20%',
      },
      typography: {
        headingFont: "'Space Grotesk', sans-serif",
        bodyFont: "'Inter', sans-serif",
        headingWeight: '700',
        bodyWeight: '400',
      },
      radius: '0.75rem',
      sectionPadding: '6rem 1.5rem',
      containerWidth: '1200px',
    },
    sections: [
      {
        id: 'saas-dark-nav',
        type: 'navbar',
        props: {
          layout: 'minimal-dark',
          brand: 'Apex',
          sticky: true,
          transparent: false,
          links: [
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Docs', href: '#docs' },
            { label: 'Blog', href: '#blog' },
          ],
          cta: { label: 'Start Free Trial', href: '#signup', intent: 'trial.start', variant: 'primary' },
        },
      },
      {
        id: 'saas-dark-hero',
        type: 'hero',
        props: {
          layout: 'centered',
          badge: '🚀 Now in Public Beta',
          headline: 'Ship Faster. Scale Confidently.',
          subheadline: 'The all-in-one platform that takes your product from idea to production.',
          description: 'Apex handles infrastructure, deployments, and monitoring so your team can focus on building what matters.',
          ctas: [
            { label: 'Start Free Trial', href: '#signup', intent: 'trial.start', variant: 'primary' },
            { label: 'Watch Demo', href: '#demo', intent: 'demo.request', variant: 'outline' },
          ],
          stats: [
            { value: '10k+', label: 'Active Teams' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '<50ms', label: 'Avg Response' },
          ],
        },
      },
      {
        id: 'saas-dark-stats',
        type: 'stats',
        props: {
          layout: 'row',
          items: [
            { value: '10,000+', label: 'Teams using Apex', icon: '👥' },
            { value: '99.9%', label: 'Uptime SLA', icon: '⚡' },
            { value: '2.1B+', label: 'API Requests Served', icon: '🌐' },
            { value: '<50ms', label: 'Median Latency', icon: '🎯' },
          ],
        },
      },
      {
        id: 'saas-dark-features',
        type: 'features',
        props: {
          headline: 'Everything Your Team Needs',
          subheadline: 'One platform, zero complexity.',
          columns: 3,
          layout: 'grid',
          items: [
            { title: 'One-Click Deployments', description: 'Push to production in seconds. Rollbacks, canary releases, and blue-green deployments built in.', icon: '🚀' },
            { title: 'Auto-Scaling Infrastructure', description: 'Traffic spikes? No problem. Apex scales up instantly and scales down to save costs.', icon: '📈' },
            { title: 'Real-Time Monitoring', description: 'Unified dashboard for logs, metrics, alerts, and performance tracing across every service.', icon: '📊' },
            { title: 'Multi-Region by Default', description: 'Deploy to 20+ regions worldwide. Serve users from the edge, always.', icon: '🌍' },
            { title: 'Team Collaboration', description: 'Branches, environments, RBAC, and audit logs. Everything enterprise teams require.', icon: '🤝' },
            { title: 'SOC 2 Compliant', description: 'Enterprise-grade security out of the box. SSO, encryption at rest, and compliance reporting.', icon: '🔒' },
          ],
        },
      },
      {
        id: 'saas-dark-pricing',
        type: 'pricing',
        props: {
          headline: 'Simple, Transparent Pricing',
          subheadline: 'Start free, scale as you grow.',
          showToggle: true,
          tiers: [
            {
              name: 'Starter',
              price: 'Free',
              description: 'For indie hackers and side projects',
              features: ['3 projects', '1 team member', '5GB bandwidth', 'Community support', '99% SLA'],
              cta: { label: 'Get Started Free', intent: 'auth.signup', variant: 'outline' },
            },
            {
              name: 'Pro',
              price: '$49',
              period: '/mo',
              description: 'For growing teams shipping fast',
              features: ['Unlimited projects', '10 team members', '100GB bandwidth', 'Priority support', '99.9% SLA', 'Custom domains', 'Analytics dashboard'],
              cta: { label: 'Start Free Trial', intent: 'trial.start', variant: 'primary' },
              highlighted: true,
              badge: 'Most Popular',
            },
            {
              name: 'Enterprise',
              price: 'Custom',
              description: 'For companies at scale',
              features: ['Unlimited everything', 'Dedicated infrastructure', 'SSO & RBAC', 'SLA guarantee', 'Dedicated CSM', 'Custom contracts', 'On-premise option'],
              cta: { label: 'Request Demo', intent: 'demo.request', variant: 'outline' },
            },
          ],
        },
      },
      {
        id: 'saas-dark-testimonials',
        type: 'testimonials',
        props: {
          headline: 'Trusted by Engineering Teams Worldwide',
          layout: 'grid',
          items: [
            { quote: 'We cut our deployment time from 45 minutes to under 2 minutes. The auto-scaling alone saved us $18k last quarter.', author: 'David Chen', role: 'CTO, Finstack', rating: 5 },
            { quote: 'Apex handles our peak Black Friday traffic without us lifting a finger. I sleep better knowing it\'s running everything.', author: 'Maria Torres', role: 'VP Engineering, ShopLane', rating: 5 },
            { quote: 'The monitoring and alerting are best-in-class. We caught a memory leak before any users noticed. That\'s priceless.', author: 'Sam Kowalski', role: 'Lead Engineer, Pulseio', rating: 5 },
          ],
        },
      },
      {
        id: 'saas-dark-faq',
        type: 'faq',
        props: {
          headline: 'Frequently Asked Questions',
          layout: 'accordion',
          items: [
            { question: 'Is there a free trial?', answer: 'Yes! Our Starter plan is free forever with no credit card required. Pro comes with a 14-day free trial.' },
            { question: 'Can I cancel anytime?', answer: 'Absolutely. Cancel online from your dashboard with one click. No fees, no questions.' },
            { question: 'Do you support custom domains?', answer: 'Yes, Pro and Enterprise plans support unlimited custom domains with automatic SSL certificates.' },
            { question: 'What languages and frameworks do you support?', answer: 'Apex is language-agnostic. We support Node.js, Python, Go, Ruby, PHP, and any Dockerfile.' },
            { question: 'How does pricing work for teams?', answer: 'Pro is per team, not per seat. Add unlimited members to your workspace at one flat price.' },
          ],
        },
      },
      {
        id: 'saas-dark-cta',
        type: 'cta',
        props: {
          layout: 'centered',
          headline: 'Start Building in Minutes',
          description: 'No credit card required. Deploy your first project free in under 5 minutes.',
          ctas: [
            { label: 'Start Free Trial', intent: 'trial.start', variant: 'primary' },
            { label: 'Talk to Sales', intent: 'demo.request', variant: 'outline' },
          ],
        },
      },
      {
        id: 'saas-dark-footer',
        type: 'footer',
        props: {
          layout: 'centered-minimal',
          brand: 'Apex',
          copyright: '© 2024 Apex Technologies Inc. All rights reserved.',
          newsletter: false,
          columns: [
            { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Changelog', href: '#changelog' }, { label: 'Roadmap', href: '#roadmap' }] },
            { title: 'Developers', links: [{ label: 'Documentation', href: '#docs' }, { label: 'API Reference', href: '#api' }, { label: 'Status', href: '#status' }, { label: 'GitHub', href: '#github' }] },
            { title: 'Company', links: [{ label: 'About', href: '#about' }, { label: 'Blog', href: '#blog' }, { label: 'Careers', href: '#careers' }, { label: 'Contact', href: '#contact' }] },
          ],
          socials: [{ platform: 'twitter', url: '#' }, { platform: 'github', url: '#' }, { platform: 'linkedin', url: '#' }],
        },
      },
    ],
  },

  // ──────────────────────────────────────────────
  // VARIANT 2: Pulse — light, product-led SaaS
  // ──────────────────────────────────────────────
  {
    id: 'saas-light',
    name: 'SaaS Light',
    category: 'saas',
    industry: 'saas',
    systemType: 'saas',
    description: 'Clean, light SaaS page for product-led growth with trial and demo CTAs.',
    tags: ['saas', 'software', 'light', 'product-led', 'startup'],
    theme: {
      colors: {
        primary: '246 80% 60%',
        primaryForeground: '0 0% 100%',
        secondary: '246 40% 96%',
        secondaryForeground: '246 60% 25%',
        accent: '175 80% 42%',
        accentForeground: '0 0% 100%',
        background: '0 0% 100%',
        foreground: '246 20% 10%',
        muted: '240 10% 96%',
        mutedForeground: '246 12% 50%',
        card: '246 30% 98%',
        cardForeground: '246 20% 10%',
        border: '240 12% 90%',
      },
      typography: {
        headingFont: "'Plus Jakarta Sans', sans-serif",
        bodyFont: "'Inter', sans-serif",
        headingWeight: '800',
        bodyWeight: '400',
      },
      radius: '1rem',
      sectionPadding: '5rem 1.5rem',
      containerWidth: '1180px',
    },
    sections: [
      {
        id: 'saas-light-nav',
        type: 'navbar',
        props: {
          layout: 'standard',
          brand: 'Pulse',
          sticky: true,
          links: [
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Customers', href: '#testimonials' },
            { label: 'Blog', href: '#blog' },
          ],
          cta: { label: 'Get Started', href: '#signup', intent: 'auth.signup', variant: 'primary' },
        },
      },
      {
        id: 'saas-light-hero',
        type: 'hero',
        props: {
          layout: 'centered',
          badge: '✨ Trusted by 10,000+ Teams',
          headline: 'Analytics That Actually Drive Growth.',
          subheadline: 'Pulse gives you the metrics that matter — and the actions to take on them.',
          ctas: [
            { label: 'Start Free — No Card Needed', intent: 'auth.signup', variant: 'primary' },
            { label: 'See How It Works', intent: 'demo.request', variant: 'ghost' },
          ],
          stats: [
            { value: '10k+', label: 'Teams' },
            { value: '99.9%', label: 'Uptime' },
            { value: '2min', label: 'Setup Time' },
          ],
        },
      },
      {
        id: 'saas-light-features',
        type: 'features',
        props: {
          headline: 'Built for Teams Who Move Fast',
          columns: 3,
          layout: 'icon-left',
          items: [
            { title: 'Real-Time Dashboards', description: 'See every metric update live. Custom widgets, no SQL required.', icon: '📊' },
            { title: 'Automated Reports', description: 'Weekly email summaries sent to your whole team, automatically.', icon: '📬' },
            { title: 'Goal Tracking', description: 'Set targets, track progress, and celebrate wins as a team.', icon: '🎯' },
            { title: 'Funnel Analysis', description: 'Pinpoint exactly where users drop off and fix it fast.', icon: '🔍' },
            { title: 'Integrations', description: 'Connect Stripe, Segment, HubSpot, Slack, and 100+ tools instantly.', icon: '🔌' },
            { title: 'Team Collaboration', description: 'Comment on metrics, tag teammates, and assign action items.', icon: '🤝' },
          ],
        },
      },
      {
        id: 'saas-light-pricing',
        type: 'pricing',
        props: {
          headline: 'Plans for Every Stage',
          showToggle: true,
          tiers: [
            {
              name: 'Free',
              price: '$0',
              description: 'Perfect for solo founders',
              features: ['1 workspace', '5 dashboards', '30-day history', 'Email reports'],
              cta: { label: 'Get Started Free', intent: 'auth.signup', variant: 'outline' },
            },
            {
              name: 'Growth',
              price: '$29',
              period: '/mo',
              description: 'For fast-moving teams',
              features: ['3 workspaces', 'Unlimited dashboards', '1-year history', 'Slack alerts', 'Goal tracking', 'API access'],
              cta: { label: 'Start Free Trial', intent: 'trial.start', variant: 'primary' },
              highlighted: true,
              badge: 'Popular',
            },
            {
              name: 'Scale',
              price: '$99',
              period: '/mo',
              description: 'For high-growth companies',
              features: ['Unlimited workspaces', 'Unlimited history', 'Custom integrations', 'SSO', 'Priority support', 'SLA guarantee'],
              cta: { label: 'Start Free Trial', intent: 'trial.start', variant: 'outline' },
            },
          ],
        },
      },
      {
        id: 'saas-light-testimonials',
        type: 'testimonials',
        props: {
          headline: 'Teams Love Pulse',
          layout: 'grid',
          items: [
            { quote: 'We replaced 4 different tools with Pulse. The time savings alone paid for the subscription in the first week.', author: 'Alex Kim', role: 'Head of Growth, Vanta', rating: 5 },
            { quote: 'The funnel analysis helped us double our trial-to-paid conversion in 30 days. Incredibly powerful tool.', author: 'Lena Marsh', role: 'Product Manager, Relay', rating: 5 },
            { quote: 'Setup took literally 8 minutes and our data was flowing. I wish every SaaS tool was this simple.', author: 'Jake Thompson', role: 'CTO, Finloop', rating: 5 },
          ],
        },
      },
      {
        id: 'saas-light-cta',
        type: 'cta',
        props: {
          layout: 'centered',
          headline: 'Ready to See Your Data Clearly?',
          description: 'Join 10,000+ teams. Free forever, no credit card required.',
          ctas: [
            { label: 'Get Started Free', intent: 'auth.signup', variant: 'primary' },
          ],
        },
      },
      {
        id: 'saas-light-footer',
        type: 'footer',
        props: {
          layout: 'dark-band',
          brand: 'Pulse',
          copyright: '© 2024 Pulse Analytics Inc.',
          newsletter: true,
          columns: [
            { title: 'Product', links: [{ label: 'Features', href: '#' }, { label: 'Pricing', href: '#' }, { label: 'Changelog', href: '#' }] },
            { title: 'Resources', links: [{ label: 'Docs', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Community', href: '#' }] },
            { title: 'Legal', links: [{ label: 'Privacy', href: '#' }, { label: 'Terms', href: '#' }, { label: 'Security', href: '#' }] },
          ],
          socials: [{ platform: 'twitter', url: '#' }, { platform: 'linkedin', url: '#' }],
        },
      },
    ],
  },
  // ──────────────────────────────────────────────
  // VARIANT 3: SaaS Developer — terminal-inspired, technical
  // ──────────────────────────────────────────────
  {
    id: 'saas-developer',
    name: 'SaaS Developer',
    category: 'saas',
    industry: 'saas',
    systemType: 'saas',
    description: 'Terminal-inspired layout for developer-first APIs and infrastructure tools.',
    tags: ['saas', 'developer', 'api', 'technical', 'mono'],
    theme: {
      colors: {
        primary: '142 70% 45%',
        primaryForeground: '220 30% 8%',
        secondary: '220 25% 14%',
        secondaryForeground: '142 30% 85%',
        accent: '210 80% 60%',
        accentForeground: '0 0% 100%',
        background: '220 30% 8%',
        foreground: '210 25% 92%',
        muted: '220 25% 14%',
        mutedForeground: '210 15% 62%',
        card: '220 28% 12%',
        cardForeground: '210 25% 92%',
        border: '220 20% 20%',
      },
      typography: {
        headingFont: "'JetBrains Mono', monospace",
        bodyFont: "'Inter', sans-serif",
        headingWeight: '600',
        bodyWeight: '400',
      },
      radius: '0.375rem',
      sectionPadding: '5rem 1.5rem',
      containerWidth: '1180px',
    },
    sections: [
      {
        id: 'saas-developer-nav',
        type: 'navbar',
        props: {
          layout: 'minimal-dark',
          brand: 'edgequeue.dev',
          sticky: true,
          links: [
            { label: 'Docs', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Changelog', href: '#about' },
          ],
          cta: { label: '$ npm i edgequeue', intent: 'newsletter.subscribe', variant: 'primary' },
        },
      },
      {
        id: 'saas-developer-hero',
        type: 'hero',
        props: {
          layout: 'split',
          badge: 'v2.4 — now with WebSocket transport',
          headline: 'Queues, jobs, and crons. One primitive.',
          subheadline: 'A serverless message queue you can talk to over HTTP, WebSocket, or your favorite SDK.',
          ctas: [
            { label: 'Read the Docs', href: '#features', variant: 'primary' },
            { label: 'Get an API Key', intent: 'newsletter.subscribe', variant: 'outline' },
          ],
        },
      },
      {
        id: 'saas-developer-features',
        type: 'features',
        props: {
          headline: 'Built for engineers who ship.',
          columns: 3,
          layout: 'grid',
          items: [
            { title: 'p99 < 12ms', description: 'Globally distributed across 24 regions, no cold starts.' },
            { title: 'Exactly-once delivery', description: 'Idempotency keys + dead letter queues out of the box.' },
            { title: 'OpenTelemetry-native', description: 'Trace every job through your entire stack.' },
            { title: 'Strong typing', description: 'Generated TS/Go/Rust clients from your schema.' },
            { title: 'Replay any job', description: 'Time-travel debugging from the dashboard.' },
            { title: 'Self-host or cloud', description: 'Same binary. Same API. Your choice.' },
          ],
        },
      },
      {
        id: 'saas-developer-pricing',
        type: 'pricing',
        props: {
          headline: 'Simple, usage-based pricing.',
          subheadline: 'No seat fees. No surprise invoices.',
          tiers: [
            {
              name: 'Hacker',
              price: '$0',
              period: '/mo',
              description: 'For side projects',
              features: ['100k jobs/mo', '7-day retention', 'Community support'],
              cta: { label: 'Start Free', intent: 'newsletter.subscribe', variant: 'outline' },
            },
            {
              name: 'Team',
              price: '$49',
              period: '/mo',
              description: 'For production workloads',
              features: ['10M jobs/mo', '30-day retention', 'Slack support', 'Audit logs'],
              cta: { label: 'Start Trial', intent: 'newsletter.subscribe', variant: 'primary' },
              highlighted: true,
              badge: 'Most Popular',
            },
            {
              name: 'Enterprise',
              price: 'Custom',
              description: 'For regulated workloads',
              features: ['Unlimited jobs', 'BYO cloud', 'SAML SSO', 'SOC 2 + HIPAA', 'Dedicated support'],
              cta: { label: 'Contact Sales', intent: 'contact.submit', variant: 'outline' },
            },
          ],
        },
      },
      {
        id: 'saas-developer-faq',
        type: 'faq',
        props: {
          headline: 'Frequent questions',
          layout: 'accordion',
          items: [
            { question: 'How is this different from SQS or BullMQ?', answer: 'No infrastructure to provision, sub-12ms p99 latency, and first-class observability. You write a function — we handle the rest.' },
            { question: 'Can I self-host?', answer: 'Yes. The same Go binary that powers our cloud is open-source under the AGPL.' },
            { question: 'Do you support exactly-once delivery?', answer: 'Yes — via idempotency keys + dedupe windows. We document the consistency guarantees in detail.' },
          ],
        },
      },
      {
        id: 'saas-developer-cta',
        type: 'cta',
        props: {
          layout: 'banner',
          headline: 'Ready to ship?',
          description: 'Free tier, no credit card required. 5 minutes to your first job.',
          ctas: [
            { label: 'Get an API Key', intent: 'newsletter.subscribe', variant: 'primary' },
            { label: 'Read the Docs', href: '#features', variant: 'outline' },
          ],
        },
      },
      {
        id: 'saas-developer-footer',
        type: 'footer',
        props: {
          layout: 'dark-band',
          brand: 'edgequeue.dev',
          copyright: '© 2024 EdgeQueue, Inc.',
          newsletter: true,
          columns: [
            { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'Changelog', href: '#about' }] },
            { title: 'Developers', links: [{ label: 'Docs', href: '#' }, { label: 'API Reference', href: '#' }, { label: 'GitHub', href: '#' }] },
          ],
          socials: [{ platform: 'github', url: '#' }, { platform: 'twitter', url: '#' }],
        },
      },
    ],
    pageCompositions: {
      home: {
        sections: [
          {
            id: 'saas-tech-home-nav', type: 'navbar', variantId: 'navbar:floating-pill',
            props: {
              brand: 'Your Product', sticky: true,
              links: [
                { label: 'Capabilities', href: '#saas-tech-home-features', intent: 'nav.anchor' },
                { label: 'Plans', href: '#saas-tech-home-pricing', intent: 'nav.anchor' },
              ],
              cta: { label: 'View plans', href: '#saas-tech-home-pricing', intent: 'nav.anchor', variant: 'primary' },
            },
          },
          {
            id: 'saas-tech-home-hero', type: 'hero', variantId: 'hero:launch-showcase',
            props: {
              badge: 'Product overview',
              headline: 'A clearer way to move work forward.',
              subheadline: 'Explain the verified outcome your product helps customers achieve.',
              ctas: [
                { label: 'Explore capabilities', href: '#saas-tech-home-features', intent: 'nav.anchor', variant: 'primary' },
                { label: 'View plans', href: '#saas-tech-home-pricing', intent: 'nav.anchor', variant: 'outline' },
              ],
            },
          },
          {
            id: 'saas-tech-home-proof', type: 'logo-cloud', variantId: 'logo-cloud:brand-lockup',
            props: { headline: 'Customer and partner marks', logos: [], layout: 'grid' },
          },
          {
            id: 'saas-tech-home-features', type: 'features', variantId: 'features:bento-mosaic',
            props: {
              headline: 'A foundation for the work ahead',
              subheadline: 'Describe the product capabilities customers can verify.',
              items: [
                { title: 'Core workflow', description: 'Show the steps customers use to complete an important task.' },
                { title: 'Connected tools', description: 'Name only the integrations available in this product.' },
                { title: 'Clear visibility', description: 'Explain what customers can monitor or review.' },
                { title: 'Team coordination', description: 'Describe how supported roles work together.' },
              ],
            },
          },
          {
            id: 'saas-tech-home-pricing', type: 'pricing', variantId: 'pricing:comparison-table',
            props: {
              headline: 'Plans that fit the work',
              subheadline: 'Replace these fields with owner-verified prices, features, and terms before publishing.',
              tiers: [
                { name: 'Plan name', price: 'Set verified price', features: ['Add verified feature'], cta: { label: 'Ask about this plan', href: '#saas-tech-home-conversion', intent: 'nav.anchor', variant: 'outline' } },
                { name: 'Plan name', price: 'Set verified price', features: ['Add verified feature'], cta: { label: 'Ask about this plan', href: '#saas-tech-home-conversion', intent: 'nav.anchor', variant: 'primary' }, highlighted: true },
              ],
            },
          },
          {
            id: 'saas-tech-home-conversion', type: 'cta', variantId: 'cta:signal-banner',
            props: {
              layout: 'banner',
              headline: 'Make the next step clear.',
              description: 'Connect this action to a verified product workflow or destination.',
              ctas: [
                { label: 'Review plans', href: '#saas-tech-home-pricing', intent: 'nav.anchor', variant: 'primary' },
                { label: 'Explore capabilities', href: '#saas-tech-home-features', intent: 'nav.anchor', variant: 'outline' },
              ],
            },
          },
          {
            id: 'saas-tech-home-footer', type: 'footer', variantId: 'footer:columns',
            props: {
              brand: 'Your Product', newsletter: false,
              columns: [{ title: 'Product', links: [
                { label: 'Capabilities', href: '#saas-tech-home-features', intent: 'nav.anchor' },
                { label: 'Plans', href: '#saas-tech-home-pricing', intent: 'nav.anchor' },
              ] }],
              socials: [],
            },
          },
        ],
        alternatives: [{
          id: 'saas-tech-home-glass-v1',
          heroVariantId: 'hero:launch-showcase',
          themePresetIds: ['glass-tech'],
          sectionIds: [
            'saas-tech-home-nav', 'saas-tech-home-hero', 'saas-tech-home-proof',
            'saas-tech-home-features', 'saas-tech-home-pricing',
            'saas-tech-home-conversion', 'saas-tech-home-footer',
          ],
        }],
      },
    },
  },
];
