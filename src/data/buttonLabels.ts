/**
 * Canonical Button Labels for Intent Auto-Wiring
 * 
 * This file serves as the single source of truth for button labels that the
 * Systems AI intent auto-wiring system can detect and activate.
 * 
 * IMPORTANT: When creating pre-built templates or AI-generated sites, use
 * only these approved labels for buttons that should trigger intents.
 * 
 * The labels here map to intents that are handled by:
 * - SimplePreview.tsx (inferIntent function)
 * - globalIntentListener.ts  
 * - ctaContract.ts (normalization)
 */

// ============================================================================
// BUTTON LABEL → INTENT MAPPING
// ============================================================================

export const BUTTON_LABEL_INTENTS: Record<string, string> = {
  // ─────────────────────────────────────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────────────────────────────────────
  'sign in': 'auth.signin',
  'log in': 'auth.signin',
  'login': 'auth.signin',
  'member login': 'auth.signin',
  'sign up': 'auth.signup',
  'register': 'auth.signup',
  'get started': 'auth.signup',
  'create account': 'auth.signup',
  'join now': 'auth.signup',
  'sign up free': 'auth.signup',
  'start now': 'auth.signup',
  'join free': 'auth.signup',
  'sign out': 'auth.signout',
  'log out': 'auth.signout',
  'logout': 'auth.signout',

  // ─────────────────────────────────────────────────────────────────────────
  // TRIALS & DEMOS
  // ─────────────────────────────────────────────────────────────────────────
  'start free trial': 'trial.start',
  'start trial': 'trial.start',
  'free trial': 'trial.start',
  'try free': 'trial.start',
  'try it free': 'trial.start',
  'try for free': 'trial.start',
  'get free trial': 'trial.start',
  'begin trial': 'trial.start',
  'watch demo': 'demo.request',
  'request demo': 'demo.request',
  'see demo': 'demo.request',
  'book demo': 'demo.request',
  'schedule demo': 'demo.request',
  'get demo': 'demo.request',
  'view demo': 'demo.request',

  // ─────────────────────────────────────────────────────────────────────────
  // WAITLIST & BETA
  // ─────────────────────────────────────────────────────────────────────────
  'join waitlist': 'join.waitlist',
  'join the waitlist': 'join.waitlist',
  'get early access': 'join.waitlist',
  'early access': 'join.waitlist',
  'notify me': 'join.waitlist',
  'coming soon': 'join.waitlist',
  'join beta': 'beta.apply',
  'beta access': 'beta.apply',
  'apply for beta': 'beta.apply',

  // ─────────────────────────────────────────────────────────────────────────
  // NEWSLETTER & SUBSCRIBE
  // ─────────────────────────────────────────────────────────────────────────
  'subscribe': 'newsletter.subscribe',
  'get updates': 'newsletter.subscribe',
  'join newsletter': 'newsletter.subscribe',
  'stay updated': 'newsletter.subscribe',
  'get notified': 'newsletter.subscribe',
  'keep me posted': 'newsletter.subscribe',
  'sign up for updates': 'newsletter.subscribe',
  'subscribe now': 'newsletter.subscribe',
  'join our list': 'newsletter.subscribe',
  'stay in the loop': 'newsletter.subscribe',
  'join us': 'newsletter.subscribe',
  'join the crew': 'newsletter.subscribe',
  'get 15% off': 'newsletter.subscribe',
  'get 10% off': 'newsletter.subscribe',
  'get discount': 'newsletter.subscribe',

  // ─────────────────────────────────────────────────────────────────────────
  // CONTACT & INQUIRY
  // ─────────────────────────────────────────────────────────────────────────
  'contact': 'contact.submit',
  'contact us': 'contact.submit',
  'get in touch': 'contact.submit',
  'send message': 'contact.submit',
  'reach out': 'contact.submit',
  'talk to us': 'contact.submit',
  'message us': 'contact.submit',
  "let's talk": 'contact.submit',
  'submit': 'contact.submit',
  'send': 'contact.submit',
  'send inquiry': 'contact.submit',
  'contact sales': 'sales.contact',
  'talk to sales': 'sales.contact',
  'speak to sales': 'sales.contact',

  // ─────────────────────────────────────────────────────────────────────────
  // E-COMMERCE
  // ─────────────────────────────────────────────────────────────────────────
  'add to cart': 'cart.add',
  'add to bag': 'cart.add',
  'add item': 'cart.add',
  'buy now': 'checkout.start',
  'purchase': 'checkout.start',
  'buy': 'checkout.start',
  'order': 'checkout.start',
  'shop now': 'shop.browse',
  'browse shop': 'shop.browse',
  'explore shop': 'shop.browse',
  'view products': 'shop.browse',
  'shop collection': 'shop.browse',
  'shop the collection': 'shop.browse',
  'shop new arrivals': 'shop.browse',
  'shop best sellers': 'shop.browse',
  'view collections': 'shop.browse',
  'checkout': 'checkout.start',
  'proceed to checkout': 'checkout.start',
  'complete purchase': 'checkout.start',
  'view cart': 'cart.view',
  'see cart': 'cart.view',
  'my cart': 'cart.view',
  'shopping cart': 'cart.view',
  'add to wishlist': 'wishlist.add',
  'save for later': 'wishlist.add',
  'save item': 'wishlist.add',
  'start your box': 'checkout.start',
  'start my box': 'checkout.start',
  'build your box': 'checkout.start',
  'customize box': 'checkout.start',
  'choose plan': 'checkout.start',
  'select plan': 'checkout.start',
  'take the quiz': 'quiz.start',

  // ─────────────────────────────────────────────────────────────────────────
  // BOOKING & RESERVATION
  // ─────────────────────────────────────────────────────────────────────────
  'book now': 'booking.create',
  'reserve': 'booking.create',
  'reserve table': 'booking.create',
  'reserve a table': 'booking.create',
  'reserve your table': 'booking.create',
  'reserve your spot': 'booking.create',
  'reserve your seat': 'booking.create',
  'reserve your chair': 'booking.create',
  'reserve your session': 'booking.create',
  'reserve my treatment': 'booking.create',
  'reserve seat': 'booking.create',
  'reserve retreat': 'booking.create',
  'book service': 'booking.create',
  'make reservation': 'booking.create',
  'book appointment': 'booking.create',
  'book your appointment': 'booking.create',
  'schedule now': 'booking.create',
  'reserve now': 'booking.create',
  'book a table': 'booking.create',
  'table for': 'booking.create',
  'book': 'booking.create',
  'book this': 'booking.create',
  'book this service': 'booking.create',
  'book this treatment': 'booking.create',
  'request appointment': 'booking.create',
  'book with': 'booking.create',
  'schedule appointment': 'booking.create',
  'make booking': 'booking.create',
  'book online': 'booking.create',
  'book your experience': 'booking.create',
  'book your look': 'booking.create',
  "book the chef's table": 'booking.create',
  'book discovery call': 'booking.create',
  'schedule discovery call': 'booking.create',
  'book free chat': 'booking.create',
  'book session': 'booking.create',
  'book vip day': 'booking.create',
  'book class': 'booking.create',
  'join tasting': 'booking.create',
  'book a call': 'calendar.book',
  'schedule call': 'calendar.book',
  'book meeting': 'calendar.book',
  'book consultation': 'consultation.book',
  'free consultation': 'consultation.book',
  'schedule consultation': 'consultation.book',
  'book a session': 'booking.create',

  // ─────────────────────────────────────────────────────────────────────────
  // QUOTES & ESTIMATES
  // ─────────────────────────────────────────────────────────────────────────
  'get quote': 'quote.request',
  'get free quote': 'quote.request',
  'request quote': 'quote.request',
  'free estimate': 'quote.request',
  'get estimate': 'quote.request',
  'request estimate': 'quote.request',
  'free quote': 'quote.request',
  'get pricing': 'quote.request',
  'request pricing': 'quote.request',
  'get a quote': 'quote.request',

  // ─────────────────────────────────────────────────────────────────────────
  // PORTFOLIO & PROJECTS
  // ─────────────────────────────────────────────────────────────────────────
  'hire me': 'project.inquire',
  'work with me': 'project.inquire',
  'hire us': 'project.inquire',
  'commission work': 'project.inquire',
  'start a project': 'project.start',
  'start project': 'project.start',
  'new project': 'project.start',
  'view work': 'portfolio.view',
  'see work': 'portfolio.view',
  'our work': 'portfolio.view',
  'view portfolio': 'portfolio.view',
  'view editorial': 'portfolio.view',
  'case study': 'case.study',
  'view case study': 'case.study',
  'read case study': 'case.study',
  'download resume': 'content.download',
  'download cv': 'content.download',
  'get resume': 'content.download',
  'download brochure': 'content.download',
  'download menu': 'content.download',
  'download price list': 'content.download',
  'download report': 'content.download',
  'download guide': 'content.download',
  'download media kit': 'content.download',
  'download press kit': 'content.download',
  'download pdf': 'content.download',
  "let's build": 'project.start',
  'work together': 'project.inquire',
  'book a shoot': 'project.start',

  // ─────────────────────────────────────────────────────────────────────────
  // RESTAURANT & FOOD
  // ─────────────────────────────────────────────────────────────────────────
  'order online': 'order.online',
  'order now': 'order.online',
  'order food': 'order.online',
  'place order': 'order.online',
  'order pickup': 'order.pickup',
  'pickup order': 'order.pickup',
  'curbside pickup': 'order.pickup',
  'order delivery': 'order.delivery',
  'get delivery': 'order.delivery',
  'deliver to me': 'order.delivery',
  'view menu': 'menu.view',
  'see menu': 'menu.view',
  'see the menu': 'menu.view',
  'our menu': 'menu.view',
  'browse menu': 'menu.view',
  'explore menu': 'menu.view',
  'gift card': 'gift.purchase',
  'buy gift card': 'gift.purchase',
  'gift cards': 'gift.purchase',
  'private event': 'event.inquire',
  'book event': 'event.inquire',
  'host event': 'event.inquire',
  'catering': 'catering.inquire',
  'catering inquiry': 'catering.inquire',

  // ─────────────────────────────────────────────────────────────────────────
  // SALON & BEAUTY (unique labels not already in BOOKING section)
  // ─────────────────────────────────────────────────────────────────────────
  'explore treatments': 'services.view',
  'view services': 'services.view',
  'our services': 'services.view',
  'see services': 'services.view',

  // ─────────────────────────────────────────────────────────────────────────
  // LOCAL SERVICES / CONTRACTORS
  // ─────────────────────────────────────────────────────────────────────────
  'request service': 'service.request',
  'get service': 'service.request',
  'call now': 'call.now',
  'call us': 'call.now',
  'phone us': 'call.now',
  'give us a call': 'call.now',
  'emergency': 'emergency.service',
  'emergency service': 'emergency.service',
  '24/7 service': 'emergency.service',
  'urgent help': 'emergency.service',
  'need help now': 'emergency.service',

  // ─────────────────────────────────────────────────────────────────────────
  // REAL ESTATE
  // ─────────────────────────────────────────────────────────────────────────
  'schedule viewing': 'viewing.schedule',
  'book viewing': 'viewing.schedule',
  'request viewing': 'viewing.schedule',
  'view listing': 'listing.view',
  'see listing': 'listing.view',
  'property inquiry': 'listing.inquire',
  'inquire about property': 'listing.inquire',
  'search properties': 'property.search',
  'find properties': 'property.search',

  // ─────────────────────────────────────────────────────────────────────────
  // COACHING & CONSULTING (unique labels not already in BOOKING/AUTH sections)
  // ─────────────────────────────────────────────────────────────────────────
  'schedule session': 'session.book',
  'start coaching': 'coaching.start',
  'begin coaching': 'coaching.start',
  'work with coach': 'coaching.start',
  'apply for coaching': 'coaching.start',
  'enroll now': 'course.enroll',
  'enroll': 'course.enroll',
  'join course': 'course.enroll',
  'start course': 'course.enroll',
  'apply now': 'application.submit',
  'apply': 'application.submit',
  'view programs': 'services.view',
  'request info': 'info.request',
  'how i help': 'services.view',
  'book for event': 'event.book',
  'book marcus for your event': 'event.book',

  // ─────────────────────────────────────────────────────────────────────────
  // NONPROFIT & DONATIONS
  // ─────────────────────────────────────────────────────────────────────────
  'donate': 'donate.now',
  'donate now': 'donate.now',
  'donate today': 'donate.now',
  'give now': 'donate.now',
  'give today': 'donate.now',
  'make donation': 'donate.now',
  'support us': 'donate.now',
  'support our cause': 'donate.now',
  'plant a tree': 'donate.now',
  'volunteer': 'volunteer.signup',
  'become volunteer': 'volunteer.signup',
  'join as volunteer': 'volunteer.signup',
  'join the movement': 'newsletter.subscribe',
  'join our mission': 'newsletter.subscribe',

  // ─────────────────────────────────────────────────────────────────────────
  // CONTENT & BLOG
  // ─────────────────────────────────────────────────────────────────────────
  'read more': 'content.read',
  'continue reading': 'content.read',
  'read article': 'content.read',
  'learn more': 'content.read',
  'share': 'content.share',
  'share article': 'content.share',
  'share post': 'content.share',
  'bookmark': 'content.bookmark',
  'save article': 'content.bookmark',
  'save post': 'content.bookmark',
  'follow': 'author.follow',
  'follow author': 'author.follow',
  'follow writer': 'author.follow',

  // ─────────────────────────────────────────────────────────────────────────
  // NAVIGATION & PRICING
  // ─────────────────────────────────────────────────────────────────────────
  'see plans': 'pricing.view',
  'view plans': 'pricing.view',
  'pricing': 'pricing.view',
  'our plans': 'pricing.view',
  'compare plans': 'pricing.view',
  'see pricing': 'pricing.view',
  'view pricing': 'pricing.view',
};

// ============================================================================
// INTENT → RECOMMENDED LABELS (for AI prompts)
// ============================================================================

/**
 * For each intent, provide 2-3 recommended button label options.
 * AI should pick from these when generating CTAs for a specific intent.
 */
export const INTENT_RECOMMENDED_LABELS: Record<string, string[]> = {
  // Auth
  'auth.signin': ['Sign In', 'Log In', 'Member Login'],
  'auth.signup': ['Get Started', 'Sign Up', 'Create Account', 'Join Now'],
  'auth.signout': ['Sign Out', 'Log Out'],

  // Trials & Demos
  'trial.start': ['Start Free Trial', 'Try It Free', 'Get Free Trial'],
  'demo.request': ['Watch Demo', 'Request Demo', 'Book Demo'],

  // Waitlist
  'join.waitlist': ['Join Waitlist', 'Get Early Access', 'Notify Me'],
  'beta.apply': ['Join Beta', 'Apply for Beta'],

  // Newsletter
  'newsletter.subscribe': ['Subscribe', 'Get Updates', 'Subscribe Now'],

  // Contact
  'contact.submit': ['Contact Us', 'Get in Touch', 'Send Message'],
  'sales.contact': ['Contact Sales', 'Talk to Sales'],

  // E-Commerce
  'cart.add': ['Add to Cart', 'Add to Bag'],
  'cart.view': ['View Cart', 'My Cart'],
  'checkout.start': ['Buy Now', 'Checkout', 'Purchase'],
  'shop.browse': ['Shop Now', 'Shop Collection', 'View Products'],
  'wishlist.add': ['Add to Wishlist', 'Save for Later'],

  // Booking
  'booking.create': ['Book Now', 'Reserve', 'Book Appointment', 'Reserve Your Table'],
  'calendar.book': ['Book a Call', 'Schedule Call'],
  'consultation.book': ['Book Consultation', 'Free Consultation'],

  // Quotes
  'quote.request': ['Get Quote', 'Get Free Quote', 'Request Estimate'],

  // Portfolio
  'project.inquire': ['Hire Me', 'Work With Me', 'Hire Us'],
  'project.start': ['Start a Project', "Let's Build"],
  'portfolio.view': ['View Work', 'View Portfolio'],
  'content.download': ['Download Document', 'Download Resume', 'Download Brochure', 'Download Guide'],

  // Restaurant
  'order.online': ['Order Now', 'Order Online', 'Place Order'],
  'order.pickup': ['Order Pickup', 'Curbside Pickup'],
  'order.delivery': ['Order Delivery', 'Get Delivery'],
  'menu.view': ['View Menu', 'See Menu', 'Explore Menu'],
  'gift.purchase': ['Buy Gift Card', 'Gift Cards'],
  'event.inquire': ['Book Event', 'Private Event'],

  // Services
  'services.view': ['View Services', 'Our Services'],
  'service.request': ['Request Service', 'Schedule Service'],
  'call.now': ['Call Now', 'Call Us'],
  'emergency.service': ['Emergency', '24/7 Service'],

  // Real Estate
  'viewing.schedule': ['Schedule Viewing', 'Book Viewing'],
  'listing.view': ['View Listing'],
  'listing.inquire': ['Property Inquiry'],
  'property.search': ['Search Properties', 'Find Properties'],

  // Coaching
  'session.book': ['Book Session', 'Book a Session'],
  'coaching.start': ['Start Coaching'],
  'course.enroll': ['Enroll Now', 'Join Course'],

  // Nonprofit
  'donate.now': ['Donate Now', 'Give Now', 'Support Us'],
  'volunteer.signup': ['Volunteer', 'Become Volunteer'],

  // Content
  'content.read': ['Read More', 'Learn More', 'Continue Reading'],
  'content.share': ['Share'],
  'content.bookmark': ['Bookmark', 'Save Article'],

  // Pricing
  'pricing.view': ['See Plans', 'View Pricing', 'View Plans'],
};

// ============================================================================
// INDUSTRY-SPECIFIC RECOMMENDED LABELS
// ============================================================================

/**
 * For each industry, provide the most commonly used button labels.
 * AI should prioritize these labels for the given industry.
 */
export const INDUSTRY_BUTTON_LABELS: Record<string, { primary: string[]; secondary: string[] }> = {
  restaurant: {
    primary: ['Reserve Your Table', 'Book Now', 'Order Now', 'Order Online'],
    secondary: ['View Menu', 'See Menu', 'Buy Gift Card', 'Book Event'],
  },
  salon: {
    primary: ['Book Appointment', 'Book Now', 'Reserve', 'Book Your Appointment'],
    secondary: ['View Services', 'Our Services', 'Contact Us', 'Gift Cards'],
  },
  ecommerce: {
    primary: ['Shop Now', 'Add to Cart', 'Buy Now', 'Shop Collection'],
    secondary: ['View Cart', 'Subscribe', 'Contact Us'],
  },
  portfolio: {
    primary: ['Hire Me', 'Work With Me', "Let's Build", 'Start a Project'],
    secondary: ['View Work', 'Download Resume', 'Contact', 'Book a Call'],
  },
  coaching: {
    primary: ['Book Session', 'Book a Session', 'Get Started', 'Book Consultation'],
    secondary: ['Learn More', 'View Plans', 'Contact', 'Subscribe'],
  },
  nonprofit: {
    primary: ['Donate Now', 'Support Us', 'Give Now'],
    secondary: ['Volunteer', 'Subscribe', 'Contact Us', 'Learn More'],
  },
  'real-estate': {
    primary: ['Schedule Viewing', 'Book Viewing', 'Contact', 'Get in Touch'],
    secondary: ['View Listing', 'Search Properties', 'Request Quote'],
  },
  'local-service': {
    primary: ['Get Quote', 'Get Free Quote', 'Request Service', 'Call Now'],
    secondary: ['Contact Us', 'View Services', 'Schedule Service'],
  },
  saas: {
    primary: ['Get Started', 'Start Free Trial', 'Try It Free', 'Sign Up'],
    secondary: ['Watch Demo', 'See Plans', 'Contact Sales', 'Learn More'],
  },
  agency: {
    primary: ['Start a Project', 'Get in Touch', 'Hire Us', 'Contact'],
    secondary: ['View Work', 'See Case Study', 'Learn More'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the intent for a given label (case-insensitive)
 */
export function getIntentForLabel(label: string): string | null {
  const normalized = label.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  return BUTTON_LABEL_INTENTS[normalized] || null;
}

/**
 * Get recommended labels for a given intent
 */
export function getLabelsForIntent(intent: string): string[] {
  return INTENT_RECOMMENDED_LABELS[intent] || [];
}

/**
 * Get industry-specific button labels
 */
export function getIndustryLabels(industry: string): { primary: string[]; secondary: string[] } {
  const normalizedIndustry = industry.toLowerCase().replace(/[\s_]/g, '-');
  return INDUSTRY_BUTTON_LABELS[normalizedIndustry] || {
    primary: ['Get Started', 'Contact Us', 'Learn More'],
    secondary: ['Subscribe', 'View Services'],
  };
}

/**
 * Check if a label is a recognized button label
 */
export function isRecognizedLabel(label: string): boolean {
  return getIntentForLabel(label) !== null;
}

/**
 * Generate button label requirements text for AI prompts
 */
export function generateLabelRequirementsForAI(industry?: string): string {
  const industryLabels = industry ? getIndustryLabels(industry) : null;
  
  const allApprovedLabels = Object.keys(BUTTON_LABEL_INTENTS);
  
  let prompt = `
**APPROVED BUTTON LABELS (USE ONLY THESE FOR CTA BUTTONS):**

The following button labels are recognized by the intent auto-wiring system. 
DO NOT use abstracted labels like "CTA_BTN_1", "Click Here", "Submit Form", etc.
Instead, use one of these approved labels:

**Auth:** Sign In, Log In, Sign Up, Get Started, Create Account, Join Now
**Trials:** Start Free Trial, Try It Free, Watch Demo, Request Demo, Book Demo
**Newsletter:** Subscribe, Get Updates, Subscribe Now, Stay Updated
**Contact:** Contact Us, Get in Touch, Send Message, Contact Sales
**E-Commerce:** Shop Now, Add to Cart, Buy Now, View Cart, Checkout
**Booking:** Book Now, Reserve, Book Appointment, Reserve Your Table
**Quotes:** Get Quote, Get Free Quote, Request Estimate
**Portfolio:** Hire Me, Work With Me, View Work, Start a Project
**Restaurant:** Order Now, View Menu, Book Event, Buy Gift Card
**Services:** View Services, Request Service, Call Now, Get Quote
**Nonprofit:** Donate Now, Support Us, Volunteer
`;

  if (industryLabels) {
    prompt += `
**PREFERRED FOR THIS INDUSTRY:**
- Primary CTAs: ${industryLabels.primary.join(', ')}
- Secondary CTAs: ${industryLabels.secondary.join(', ')}
`;
  }

  return prompt;
}
