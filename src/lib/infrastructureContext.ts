/**
 * UNISON TASKS INFRASTRUCTURE CONTEXT
 * 
 * Central registry of platform capabilities, services, and integrations.
 * AI uses this context to make informed, contextual decisions about:
 * - What features are available for each system type
 * - How to guide users through setup
 * - What integrations and services to recommend
 * - How to connect user actions to platform capabilities
 */

import type { BusinessSystemType } from '@/data/templates/types';

// Core platform services
export interface PlatformService {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'payments' | 'email' | 'automation' | 'analytics' | 'ai' | 'hosting';
  provider: string;
  configPath: string; // Route to configure this service
  docsUrl?: string;
  requiredEnvVars?: string[];
  status: 'ready' | 'requires-setup' | 'optional';
}

export const PLATFORM_SERVICES: PlatformService[] = [
  {
    id: 'supabase',
    name: 'Supabase Database',
    description: 'PostgreSQL database for storing all business data, users, and content',
    category: 'database',
    provider: 'Supabase',
    configPath: '/cloud?tab=integrations',
    docsUrl: 'https://supabase.com/docs',
    requiredEnvVars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    status: 'ready',
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    description: 'Accept credit cards, Apple Pay, Google Pay, and manage subscriptions',
    category: 'payments',
    provider: 'Stripe',
    configPath: '/cloud?tab=integrations',
    docsUrl: 'https://stripe.com/docs',
    requiredEnvVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'],
    status: 'requires-setup',
  },
  {
    id: 'resend',
    name: 'Resend Email',
    description: 'Send transactional emails like confirmations, reminders, and receipts',
    category: 'email',
    provider: 'Resend',
    configPath: '/cloud?tab=email',
    docsUrl: 'https://resend.com/docs',
    requiredEnvVars: ['RESEND_API_KEY'],
    status: 'requires-setup',
  },
  {
    id: 'inngest',
    name: 'Inngest Workflows',
    description: 'Run background jobs, scheduled tasks, and event-driven workflows',
    category: 'automation',
    provider: 'Inngest',
    configPath: '/cloud?tab=integrations',
    docsUrl: 'https://www.inngest.com/docs',
    status: 'ready',
  },
  {
    id: 'vercel',
    name: 'Vercel Hosting',
    description: 'Deploy and host your sites with automatic SSL and CDN',
    category: 'hosting',
    provider: 'Vercel',
    configPath: '/cloud?tab=integrations',
    docsUrl: 'https://vercel.com/docs',
    status: 'optional',
  },
  {
    id: 'anthropic',
    name: 'Claude AI (Sonnet 4.6)',
    description: 'Claude Sonnet 4.6 — extended thinking, 200K context, advanced code generation',
    category: 'ai',
    provider: 'Anthropic',

    configPath: '/cloud?tab=integrations',
    docsUrl: 'https://docs.anthropic.com',
    requiredEnvVars: ['ANTHROPIC_API_KEY'],
    status: 'ready',
  },
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Track website visitors, conversions, and user behavior',
    category: 'analytics',
    provider: 'Google',
    configPath: '/cloud?tab=integrations',
    docsUrl: 'https://analytics.google.com',
    status: 'optional',
  },
];

// System type capabilities - what each business type can do
export interface SystemCapabilities {
  systemType: BusinessSystemType;
  displayName: string;
  description: string;
  coreFeatures: string[];
  requiredServices: string[];
  optionalServices: string[];
  setupSteps: SetupStep[];
  intentCategories: string[];
}

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  section: 'payments' | 'database' | 'email' | 'calendar' | 'content' | 'domain' | 'analytics' | 'automations';
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
}

export const SYSTEM_CAPABILITIES: Record<BusinessSystemType, SystemCapabilities> = {
  booking: {
    systemType: 'booking',
    displayName: 'Booking & Appointments',
    description: 'Schedule appointments, manage availability, send reminders',
    coreFeatures: [
      'Calendar availability management',
      'Online booking widget',
      'Appointment reminders',
      'Payment collection',
      'Client management',
    ],
    requiredServices: ['supabase'],
    optionalServices: ['stripe', 'resend', 'google-analytics'],
    setupSteps: [
      { id: 'calendar', title: 'Configure Calendar', description: 'Set your availability and booking rules', section: 'calendar', priority: 'high', estimatedMinutes: 10 },
      { id: 'services', title: 'Add Services', description: 'Define bookable services with durations and prices', section: 'content', priority: 'high', estimatedMinutes: 15 },
      { id: 'payments', title: 'Connect Payments', description: 'Accept deposits or full payments', section: 'payments', priority: 'high', estimatedMinutes: 10 },
      { id: 'reminders', title: 'Set Up Reminders', description: 'Configure email/SMS reminders', section: 'automations', priority: 'medium', estimatedMinutes: 5 },
    ],
    intentCategories: ['booking', 'calendar', 'payments', 'notifications'],
  },
  store: {
    systemType: 'store',
    displayName: 'E-commerce Store',
    description: 'Sell products online with inventory management and checkout',
    coreFeatures: [
      'Product catalog',
      'Shopping cart',
      'Secure checkout',
      'Order management',
      'Inventory tracking',
    ],
    requiredServices: ['supabase', 'stripe'],
    optionalServices: ['resend', 'google-analytics'],
    setupSteps: [
      { id: 'payments', title: 'Connect Stripe', description: 'Enable secure payment processing', section: 'payments', priority: 'high', estimatedMinutes: 10 },
      { id: 'products', title: 'Add Products', description: 'Create your product catalog', section: 'content', priority: 'high', estimatedMinutes: 20 },
      { id: 'shipping', title: 'Configure Shipping', description: 'Set shipping zones and rates', section: 'automations', priority: 'medium', estimatedMinutes: 10 },
      { id: 'emails', title: 'Order Notifications', description: 'Set up order confirmation emails', section: 'email', priority: 'medium', estimatedMinutes: 5 },
    ],
    intentCategories: ['cart', 'checkout', 'products', 'orders'],
  },
  portfolio: {
    systemType: 'portfolio',
    displayName: 'Portfolio & Showcase',
    description: 'Display work, projects, and creative portfolio',
    coreFeatures: [
      'Project gallery',
      'Case studies',
      'Contact form',
      'Testimonials',
      'About section',
    ],
    requiredServices: ['supabase'],
    optionalServices: ['resend', 'google-analytics'],
    setupSteps: [
      { id: 'projects', title: 'Add Projects', description: 'Showcase your best work', section: 'content', priority: 'high', estimatedMinutes: 20 },
      { id: 'contact', title: 'Contact Form', description: 'Set up inquiry notifications', section: 'email', priority: 'high', estimatedMinutes: 5 },
      { id: 'domain', title: 'Custom Domain', description: 'Connect your professional domain', section: 'domain', priority: 'medium', estimatedMinutes: 15 },
    ],
    intentCategories: ['contact', 'portfolio', 'inquiry'],
  },
  agency: {
    systemType: 'agency',
    displayName: 'Real Estate Agency',
    description: 'Property listings, lead management, and client interactions',
    coreFeatures: [
      'Property listings',
      'Lead capture',
      'Agent profiles',
      'Viewing scheduling',
      'CRM integration',
    ],
    requiredServices: ['supabase'],
    optionalServices: ['stripe', 'resend', 'google-analytics'],
    setupSteps: [
      { id: 'listings', title: 'Add Listings', description: 'Create property listings', section: 'content', priority: 'high', estimatedMinutes: 15 },
      { id: 'crm', title: 'Lead Management', description: 'Configure CRM for tracking leads', section: 'automations', priority: 'high', estimatedMinutes: 10 },
      { id: 'email', title: 'Inquiry Notifications', description: 'Get notified of new leads', section: 'email', priority: 'medium', estimatedMinutes: 5 },
    ],
    intentCategories: ['leads', 'listings', 'contact', 'viewings'],
  },
  saas: {
    systemType: 'saas',
    displayName: 'SaaS & Software',
    description: 'Software products, subscriptions, and client management',
    coreFeatures: [
      'Subscription management',
      'User authentication',
      'Client portal',
      'Usage tracking',
      'API access',
    ],
    requiredServices: ['supabase', 'stripe'],
    optionalServices: ['resend', 'google-analytics'],
    setupSteps: [
      { id: 'services', title: 'Define Plans', description: 'List your subscription tiers', section: 'content', priority: 'high', estimatedMinutes: 15 },
      { id: 'auth', title: 'User Authentication', description: 'Enable user signup and login', section: 'database', priority: 'high', estimatedMinutes: 10 },
      { id: 'payments', title: 'Payment Setup', description: 'Accept subscriptions and one-time payments', section: 'payments', priority: 'high', estimatedMinutes: 10 },
    ],
    intentCategories: ['auth', 'subscriptions', 'payments', 'contact'],
  },
  content: {
    systemType: 'content',
    displayName: 'Content & Nonprofit',
    description: 'Content publishing, donations, and community engagement',
    coreFeatures: [
      'Blog/articles',
      'Newsletter signup',
      'Donation processing',
      'Event listings',
      'Community updates',
    ],
    requiredServices: ['supabase'],
    optionalServices: ['stripe', 'resend', 'google-analytics'],
    setupSteps: [
      { id: 'newsletter', title: 'Newsletter Signup', description: 'Collect subscriber emails', section: 'email', priority: 'high', estimatedMinutes: 5 },
      { id: 'donations', title: 'Donation Setup', description: 'Accept one-time and recurring donations', section: 'payments', priority: 'high', estimatedMinutes: 10 },
      { id: 'content', title: 'Add Content', description: 'Publish articles and updates', section: 'content', priority: 'medium', estimatedMinutes: 15 },
    ],
    intentCategories: ['newsletter', 'donations', 'content', 'events'],
  },
};

// Intent categories and their handlers
export interface IntentCategory {
  id: string;
  name: string;
  description: string;
  intents: string[];
  requiredFor: BusinessSystemType[];
}

export const INTENT_CATEGORIES: IntentCategory[] = [
  {
    id: 'booking',
    name: 'Booking & Scheduling',
    description: 'Create appointments, manage availability',
    intents: ['booking.create', 'booking.reschedule', 'booking.cancel', 'booking.confirm'],
    requiredFor: ['booking', 'saas'],
  },
  {
    id: 'cart',
    name: 'Shopping Cart',
    description: 'Add items, view cart, update quantities',
    intents: ['cart.add', 'cart.view', 'cart.update', 'cart.remove'],
    requiredFor: ['store'],
  },
  {
    id: 'checkout',
    name: 'Checkout & Payments',
    description: 'Process payments, handle orders',
    intents: ['checkout.start', 'checkout.complete', 'payment.process'],
    requiredFor: ['store', 'booking', 'content'],
  },
  {
    id: 'contact',
    name: 'Contact & Inquiries',
    description: 'Handle form submissions and inquiries',
    intents: ['contact.submit', 'inquiry.send', 'quote.request'],
    requiredFor: ['portfolio', 'agency', 'saas'],
  },
  {
    id: 'newsletter',
    name: 'Newsletter & Subscriptions',
    description: 'Email subscriptions and updates',
    intents: ['newsletter.subscribe', 'newsletter.unsubscribe'],
    requiredFor: ['content', 'store'],
  },
  {
    id: 'auth',
    name: 'Authentication',
    description: 'User signup, login, and account management',
    intents: ['auth.signup', 'auth.signin', 'auth.signout', 'auth.reset'],
    requiredFor: ['store', 'booking', 'saas', 'agency'],
  },
];

// Database tables for each system type
export interface DatabaseTable {
  name: string;
  description: string;
  requiredFor: BusinessSystemType[];
  columns: { name: string; type: string; description: string }[];
}

export const DATABASE_TABLES: DatabaseTable[] = [
  {
    name: 'services',
    description: 'Bookable services or product offerings',
    requiredFor: ['booking', 'saas', 'store'],
    columns: [
      { name: 'id', type: 'uuid', description: 'Primary key' },
      { name: 'name', type: 'text', description: 'Service name' },
      { name: 'description', type: 'text', description: 'Service description' },
      { name: 'price', type: 'numeric', description: 'Price in cents' },
      { name: 'duration_minutes', type: 'integer', description: 'Duration for bookable services' },
    ],
  },
  {
    name: 'appointments',
    description: 'Scheduled appointments and bookings',
    requiredFor: ['booking', 'saas'],
    columns: [
      { name: 'id', type: 'uuid', description: 'Primary key' },
      { name: 'service_id', type: 'uuid', description: 'Reference to service' },
      { name: 'client_name', type: 'text', description: 'Client name' },
      { name: 'client_email', type: 'text', description: 'Client email' },
      { name: 'start_time', type: 'timestamptz', description: 'Appointment start' },
      { name: 'status', type: 'text', description: 'confirmed/cancelled/completed' },
    ],
  },
  {
    name: 'products',
    description: 'E-commerce products',
    requiredFor: ['store'],
    columns: [
      { name: 'id', type: 'uuid', description: 'Primary key' },
      { name: 'name', type: 'text', description: 'Product name' },
      { name: 'price', type: 'numeric', description: 'Price in cents' },
      { name: 'inventory', type: 'integer', description: 'Stock quantity' },
      { name: 'image_url', type: 'text', description: 'Product image' },
    ],
  },
  {
    name: 'orders',
    description: 'Customer orders',
    requiredFor: ['store'],
    columns: [
      { name: 'id', type: 'uuid', description: 'Primary key' },
      { name: 'customer_email', type: 'text', description: 'Customer email' },
      { name: 'total', type: 'numeric', description: 'Order total' },
      { name: 'status', type: 'text', description: 'pending/paid/shipped/delivered' },
      { name: 'stripe_payment_id', type: 'text', description: 'Stripe payment reference' },
    ],
  },
  {
    name: 'leads',
    description: 'Sales leads and inquiries',
    requiredFor: ['agency', 'saas', 'portfolio'],
    columns: [
      { name: 'id', type: 'uuid', description: 'Primary key' },
      { name: 'name', type: 'text', description: 'Lead name' },
      { name: 'email', type: 'text', description: 'Lead email' },
      { name: 'status', type: 'text', description: 'new/contacted/qualified/closed' },
      { name: 'source', type: 'text', description: 'How they found you' },
    ],
  },
];

// Helper functions for AI context

/**
 * Get the capabilities for a specific system type
 */
export function getSystemCapabilities(systemType: BusinessSystemType): SystemCapabilities {
  return SYSTEM_CAPABILITIES[systemType] || SYSTEM_CAPABILITIES.content;
}

/**
 * Get required services for a system type
 */
export function getRequiredServices(systemType: BusinessSystemType): PlatformService[] {
  const caps = getSystemCapabilities(systemType);
  return PLATFORM_SERVICES.filter(s => caps.requiredServices.includes(s.id));
}

/**
 * Get all setup steps for a system type, ordered by priority
 */
export function getSetupSteps(systemType: BusinessSystemType): SetupStep[] {
  const caps = getSystemCapabilities(systemType);
  return [...caps.setupSteps].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Get intent categories relevant to a system type
 */
export function getRelevantIntents(systemType: BusinessSystemType): IntentCategory[] {
  return INTENT_CATEGORIES.filter(cat => cat.requiredFor.includes(systemType));
}

/**
 * Get database tables needed for a system type
 */
export function getRequiredTables(systemType: BusinessSystemType): DatabaseTable[] {
  return DATABASE_TABLES.filter(table => table.requiredFor.includes(systemType));
}

/**
 * Build a context summary for AI prompts
 */
export function buildAIContextSummary(systemType: BusinessSystemType): string {
  const caps = getSystemCapabilities(systemType);
  const services = getRequiredServices(systemType);
  const intents = getRelevantIntents(systemType);
  const tables = getRequiredTables(systemType);

  return `
## Unison Platform Context for ${caps.displayName}

### System Type: ${systemType}
${caps.description}

### Core Features:
${caps.coreFeatures.map(f => `- ${f}`).join('\n')}

### Required Services:
${services.map(s => `- ${s.name}: ${s.description}`).join('\n')}

### Available Intents:
${intents.map(cat => `- ${cat.name}: ${cat.intents.join(', ')}`).join('\n')}

### Database Tables:
${tables.map(t => `- ${t.name}: ${t.description}`).join('\n')}

### Setup Steps (in order):
${caps.setupSteps.map((s, i) => `${i + 1}. ${s.title} (~${s.estimatedMinutes} min)`).join('\n')}

Use this context to guide users through setting up their ${caps.displayName} with relevant features and proper intent wiring.
`;
}

export type { BusinessSystemType };
