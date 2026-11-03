/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// @unison-ai-authored role=gallery design=03d5ad4a
import React, { useState } from 'react';
import { SiteNav } from '../project-components/site/SiteNav';
import { SiteFooter } from '../project-components/site/SiteFooter';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Grid = __LucideIcons['Grid'] || __LucideFallback;
const Navigation = __LucideIcons['Navigation'] || __LucideFallback;
const Filter = __LucideIcons['Filter'] || __LucideFallback;
const Box = __LucideIcons['Box'] || __LucideFallback;
const Key = __LucideIcons['Key'] || __LucideFallback;

const Sparkles = __LucideIcons['Sparkles'] || __LucideFallback;
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideIcons['Arrowright'] || __LucideFallback;
const Eye = __LucideIcons['Eye'] || __LucideFallback;
const CheckCircle2 = __LucideIcons['CheckCircle2'] || __LucideIcons['Checkcircle2'] || __LucideFallback;
const TrendingUp = __LucideIcons['TrendingUp'] || __LucideIcons['Trendingup'] || __LucideFallback;
const Layers = __LucideIcons['Layers'] || __LucideFallback;
const ShieldCheck = __LucideIcons['ShieldCheck'] || __LucideIcons['Shield'] || __LucideIcons['Shieldcheck'] || __LucideFallback;
const Zap = __LucideIcons['Zap'] || __LucideFallback;
const SlidersHorizontal = __LucideIcons['SlidersHorizontal'] || __LucideIcons['Slidershorizontal'] || __LucideFallback;
const Star = __LucideIcons['Star'] || __LucideFallback;
const Clock = __LucideIcons['Clock'] || __LucideFallback;
const ArrowUpRight = __LucideIcons['ArrowUpRight'] || __LucideIcons['Arrowupright'] || __LucideFallback;
const X = __LucideIcons['X'] || __LucideFallback;
const Send = __LucideIcons['Send'] || __LucideFallback;
const User = __LucideIcons['User'] || __LucideFallback;
const Mail = __LucideIcons['Mail'] || __LucideFallback;
const Building = __LucideIcons['Building'] || __LucideFallback;
const MessageSquare = __LucideIcons['MessageSquare'] || __LucideIcons['Messagesquare'] || __LucideFallback;

interface ProjectData {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  client: string;
  year: string;
  impactMetric: string;
  impactLabel: string;
  image: string;
  problem: string;
  solution: string;
  treatmentDetails: string[];
  results: string[];
}

const PROJECTS: ProjectData[] = [
  {
    id: 'nova-fintech',
    title: 'Nova Financial Ecosystem',
    subtitle: 'High-yield wealth management interface built with glass-morphic data hierarchy and ultra-fast transactional flows.',
    category: 'Fintech & Banking',
    client: 'Nova Global',
    year: '2024',
    impactMetric: '+165%',
    impactLabel: 'Onboarding completion velocity',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    problem: 'Nova suffered from a cluttered multi-step compliance onboarding flow resulting in a 62% user drop-off rate prior to account funding.',
    solution: 'Engineered a cinematic dark interface system with progressive data disclosure, live micro-charts, and a streamlined 2-tap verification flow.',
    treatmentDetails: [
      'Custom dark design system with accessibility-compliant contrast states',
      'Real-time WebGL portfolio performance visualization canvas',
      'Micro-interaction cues for transactional security reassurance',
      'Context-aware responsive grid across mobile, tablet, and widescreen desktop'
    ],
    results: [
      '62% reduction in user drop-off during account creation',
      '165% increase in first-week fund deposits',
      'Awarded Best Mobile Interface at Fintech Design Summit 2024'
    ]
  },
  {
    id: 'aura-health',
    title: 'Aura Telemetry Dashboard',
    subtitle: 'Clinical SaaS suite bringing real-time patient analytics and biometrics to emergency response teams.',
    category: 'Healthcare & SaaS',
    client: 'Aura Medical',
    year: '2024',
    impactMetric: '48%',
    impactLabel: 'Reduction in task completion time',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    problem: 'Emergency clinicians were overwhelmed by legacy table views causing cognitive fatigue and delayed emergency critical responses.',
    solution: 'Designed an ergonomic dark telemetry interface with high-density priority cards, audible visual pulses, and zero-latency keyboard navigation.',
    treatmentDetails: [
      'High-contrast color tokens tailored for dark hospital control rooms',
      'Strict WCAG AAA accessibility pass for critical biometric alarms',
      'Custom SVG component primitives for multi-parameter wave telemetry',
      'Modular bento panel layout adaptable to multi-monitor arrays'
    ],
    results: [
      '48% faster diagnostic decision speed in simulated emergency trials',
      'Zero catastrophic data misreadings across 5,000 clinical hours',
      'Adopted by 14 regional hospital networks nationwide'
    ]
  },
  {
    id: 'krypton-ai',
    title: 'Krypton AI Copilot Canvas',
    subtitle: 'Prompt orchestration environment for senior software engineers and LLM workflow architects.',
    category: 'Developer Tools',
    client: 'Krypton Labs',
    year: '2024',
    impactMetric: '3.2x',
    impactLabel: 'Daily active session duration',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    problem: 'Engineers struggled with fragmented AI tools, unorganized prompt histories, and lack of visual workflow debugging.',
    solution: 'Architected an integrated IDE-grade interface combining command palettes, node graph visualization, and real-time response streaming.',
    treatmentDetails: [
      'Command-palette first UX with custom hotkey orchestration',
      'Dark-mode syntax highlight engine with token level inspection',
      'Infinite canvas visual node graph for complex AI agent chains',
      'Responsive panel split system with smooth layout physics'
    ],
    results: [
      '3.2x increase in daily active developer session time',
      '89% user preference rating over leading developer copilots',
      'Featured as Product of the Day on ProductHunt'
    ]
  },
  {
    id: 'vanguard-logistics',
    title: 'Vanguard Enterprise ERP',
    subtitle: 'Global supply chain control tower handling end-to-end fleet tracking and automated freight dispatch.',
    category: 'Enterprise SaaS',
    client: 'Vanguard Global',
    year: '2023',
    impactMetric: '$2.4M',
    impactLabel: 'Operational training savings',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    problem: 'Vanguard’s legacy 2000s desktop client required 3 weeks of intensive employee training and resulted in costly human dispatch errors.',
    solution: 'Replaced legacy tables with intuitive visual pipeline boards, automated exception highlights, and mobile driver apps.',
    treatmentDetails: [
      'Unified enterprise token library across desktop and rugged mobile scanners',
      'Automated error-state recovery UX preventing bad dispatch commands',
      'Drag-and-drop shipment assignment timeline with collision detection',
      'Design system governance package for internal developer handoff'
    ],
    results: [
      '$2.4M annual training cost savings recorded in year one',
      'Dispatch error rates dropped from 4.8% to under 0.2%',
      'Onboarded 12,000 global logistics managers seamlessly'
    ]
  },
  {
    id: 'solaris-energy',
    title: 'Solaris Smart Grid Suite',
    subtitle: 'Consumer renewable energy monitoring app turning solar grid telemetry into actionable household savings.',
    category: 'Consumer Mobile',
    client: 'Solaris Energy',
    year: '2023',
    impactMetric: '+94%',
    impactLabel: 'User daily engagement rate',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    problem: 'Homeowners felt disconnected from their solar battery usage due to overly technical charts and non-actionable data.',
    solution: 'Crafted a vibrant, story-led mobile app with ambient energy status animations, predictive battery alerts, and automated grid sharing.',
    treatmentDetails: [
      'Cinematic ambient gradient profiles matching real-time solar daylight',
      'Gamified energy-saving milestone badges and social leaderboards',
      'One-tap battery backup reservation for impending storm events',
      'Haptic feedback integration for touch interactions'
    ],
    results: [
      '94% daily app retention rate among solar battery owners',
      'Average customer saved an additional $420 annually on power bills',
      '4.9/5 stars across 15,000 App Store reviews'
    ]
  },
  {
    id: 'nexus-commerce',
    title: 'Nexus Luxury Storefront',
    subtitle: 'Headless e-commerce experience for high-end automotive design objects and limited horology timepieces.',
    category: 'E-Commerce & Luxury',
    client: 'Nexus Group',
    year: '2023',
    impactMetric: '+42%',
    impactLabel: 'Average order value lift',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    problem: 'Standard e-commerce templates failed to convey the artisan craftsmanship of $50k+ bespoke products.',
    solution: 'Delivered an ultra-minimalist, gallery-inspired web experience with 3D product inspection and full-screen video storytelling.',
    treatmentDetails: [
      'Full-bleed editorial mosaic layout with fluid image zooms',
      'Custom micro-cart slider with inline high-value consultation booking',
      'Zero-layout-shift image loader with bespoke shimmer states',
      'Multi-currency checkout localized across 18 luxury markets'
    ],
    results: [
      '42% increase in average order value',
      'Conversion rate doubled for items priced over $10,000',
      'Nominated for Site of the Year at Awwwards'
    ]
  }
];

const CATEGORIES = [
  'All Work',
  'Fintech & Banking',
  'Healthcare & SaaS',
  'Developer Tools',
  'Enterprise SaaS',
  'Consumer Mobile',
  'E-Commerce & Luxury'
];

export default function WorkPage() {
  const [selectedCategory, setSelectedCategory] = useState('All Work');
  const [activeModalProject, setActiveModalProject] = useState<ProjectData | null>(null);
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [preselectedProjectName, setPreselectedProjectName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const filteredProjects = selectedCategory === 'All Work'
    ? PROJECTS
    : PROJECTS.filter((p) => p.category === selectedCategory);

  const openConsultationWithProject = (projectName?: string) => {
    if (projectName) setPreselectedProjectName(projectName);
    else setPreselectedProjectName('');
    setIsSubmitted(false);
    setIsConsultationOpen(true);
  };

  const handleConsultationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div data-ut-page-role="gallery" className="min-h-screen bg-background text-foreground flex flex-col font-body selection:bg-primary/20" data-ut-source-locator="/src/pages/Work.tsx:223:5" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
      {/* Shared Header Navigation */}
      <SiteNav onOpenConsultation={() => openConsultationWithProject()} />

      <main className="flex-1 pt-24" data-ut-source-locator="/src/pages/Work.tsx:227:7" data-ut-source-ast="/src/pages/Work.tsx#cedbc7960af8bd62" data-ut-source-hash="31c81e8ec39da14a">
        {/* ============================================================ */}
        {/* 1. HERO SECTION: Split-Media Portfolio Intro */}
        {/* ============================================================ */}
        <section
          data-ut-variant="hero:split-image"
          className="relative py-16 lg:py-24 border-b border-border/60 bg-gradient-to-b from-card/30 via-background to-background overflow-hidden"
         data-ut-source-locator="/src/pages/Work.tsx:231:9" data-ut-source-ast="/src/pages/Work.tsx#e2e707621d4413be" data-ut-source-hash="31c81e8ec39da14a">
          {/* Subtle Radial Glow */}
          <div className="absolute -top-24 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"  data-ut-source-locator="/src/pages/Work.tsx:236:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/pages/Work.tsx:238:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center" data-ut-source-locator="/src/pages/Work.tsx:239:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              {/* Left Editorial Narrative Column */}
              <div className="lg:col-span-7 space-y-8" data-ut-source-locator="/src/pages/Work.tsx:241:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-mono font-medium tracking-widest uppercase" data-ut-source-locator="/src/pages/Work.tsx:242:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span data-ut-source-locator="/src/pages/Work.tsx:244:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Curated Case Directory · 2025</span>
                </div>

                <div className="space-y-4" data-ut-source-locator="/src/pages/Work.tsx:247:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <h1 className="ut-hero text-4xl sm:text-5xl lg:text-6xl font-heading font-[number:var(--ut-weight-display)] tracking-tight text-foreground leading-[1.08]" data-ut-source-locator="/src/pages/Work.tsx:248:19" data-ut-source-ast="/src/pages/Work.tsx#c007dc9c73abc508" data-ut-source-hash="31c81e8ec39da14a">
                    Let the work speak.{' '}
                    <span className="block text-primary font-normal" data-ut-source-locator="/src/pages/Work.tsx:250:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Cinematic systems engineered for conversion.</span>
                  </h1>

                  <p className="ut-lead text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl" data-ut-source-locator="/src/pages/Work.tsx:253:19" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                    Deep-dive architectural breakdowns of senior UI/UX treatments, interface transformations, and high-velocity digital products engineered by Eman Amanni for category-defining tech brands.
                  </p>
                </div>

                {/* Refined Performance Proof Metrics */}
                <div className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm p-4 sm:p-5 shadow-sm" data-ut-source-locator="/src/pages/Work.tsx:259:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div className="space-y-1 pr-3" data-ut-source-locator="/src/pages/Work.tsx:260:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/pages/Work.tsx:261:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      28+
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider" data-ut-source-locator="/src/pages/Work.tsx:264:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Shipped Products
                    </div>
                  </div>
                  <div className="space-y-1 px-3 sm:px-4" data-ut-source-locator="/src/pages/Work.tsx:268:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] text-primary" data-ut-source-locator="/src/pages/Work.tsx:269:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      +145%
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider" data-ut-source-locator="/src/pages/Work.tsx:272:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Avg Conversion Lift
                    </div>
                  </div>
                  <div className="space-y-1 pl-3 sm:pl-4" data-ut-source-locator="/src/pages/Work.tsx:276:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/pages/Work.tsx:277:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      100%
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider" data-ut-source-locator="/src/pages/Work.tsx:280:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Production Handoff
                    </div>
                  </div>
                </div>

                {/* Hero CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-1" data-ut-source-locator="/src/pages/Work.tsx:287:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <button
                    type="button"
                    onClick={() => openConsultationWithProject()}
                    data-ut-cta="cta.hero-secondary"
                    data-ut-intent="contact.submit"
                    className="btn-primary py-3.5 px-6 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5 active:translate-y-0"
                   data-ut-source-locator="/src/pages/Work.tsx:288:19" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                    <Sparkles className="w-4 h-4" />
                    <span data-ut-source-locator="/src/pages/Work.tsx:296:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Book Design Consultation</span>
                  </button>
                  <a
                    href="#case-studies"
                    data-ut-intent="nav.goto"
                    data-ut-path="#case-studies"
                    className="btn-secondary py-3.5 px-6 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 hover:border-primary/50"
                   data-ut-source-locator="/src/pages/Work.tsx:298:19" data-ut-source-ast="/src/pages/Work.tsx#3b4da282882e72be" data-ut-source-hash="31c81e8ec39da14a">
                    <span data-ut-source-locator="/src/pages/Work.tsx:304:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Explore Work Matrix</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Right Media Frame Column */}
              <div className="lg:col-span-5 relative" data-ut-source-locator="/src/pages/Work.tsx:311:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="relative aspect-[4/5] bg-card border border-border/80 rounded-xl shadow-2xl overflow-hidden group" data-ut-source-locator="/src/pages/Work.tsx:312:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <img
                    src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"
                    alt="Eman Amanni UI/UX Design System Showcase"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                   data-ut-source-locator="/src/pages/Work.tsx:313:19" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                  
                  {/* Subtle Cinematic Vignette Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent opacity-95"  data-ut-source-locator="/src/pages/Work.tsx:320:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>

                  <div className="absolute inset-0 p-6 flex flex-col justify-between z-10" data-ut-source-locator="/src/pages/Work.tsx:322:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="flex justify-between items-center" data-ut-source-locator="/src/pages/Work.tsx:323:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background/85 backdrop-blur-md border border-border/80" data-ut-source-locator="/src/pages/Work.tsx:324:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"  data-ut-source-locator="/src/pages/Work.tsx:325:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a"/>
                        <span className="text-[10px] font-mono tracking-widest text-foreground uppercase font-semibold" data-ut-source-locator="/src/pages/Work.tsx:326:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                          FEATURED ARCHITECTURE
                        </span>
                      </div>
                      <span className="text-[11px] font-mono bg-primary text-primary-foreground font-bold px-2.5 py-0.5 rounded shadow" data-ut-source-locator="/src/pages/Work.tsx:330:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                        v2025.1
                      </span>
                    </div>

                    <div className="space-y-2.5 bg-background/90 backdrop-blur-md border border-border/80 p-5 rounded-lg shadow-2xl transition-all duration-300 group-hover:border-primary/40" data-ut-source-locator="/src/pages/Work.tsx:335:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:336:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="uppercase tracking-wider" data-ut-source-locator="/src/pages/Work.tsx:337:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Nova Wealth Ecosystem</span>
                        <span className="text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:338:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">+165% VELOCITY</span>
                      </div>
                      <div className="text-base font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground leading-snug" data-ut-source-locator="/src/pages/Work.tsx:340:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        Cinematic FinTech Design Engine
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed" data-ut-source-locator="/src/pages/Work.tsx:343:23" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                        Design system architecture pairing ergonomic progressive disclosure with real-time biometric verification flows.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 2. GALLERY MOSAIC SECTION: Case Studies with Lightbox */}
        {/* ============================================================ */}
        <section
          id="case-studies"
          data-ut-variant="gallery:editorial-mosaic"
          className="py-16 lg:py-24 border-b border-border/60"
         data-ut-source-locator="/src/pages/Work.tsx:357:9" data-ut-source-ast="/src/pages/Work.tsx#28ae641aa8c46b1e" data-ut-source-hash="31c81e8ec39da14a">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10" data-ut-source-locator="/src/pages/Work.tsx:362:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6" data-ut-source-locator="/src/pages/Work.tsx:364:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <div className="space-y-3 max-w-2xl" data-ut-source-locator="/src/pages/Work.tsx:365:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:366:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span data-ut-source-locator="/src/pages/Work.tsx:368:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Curated Portfolio Matrix</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground" data-ut-source-locator="/src/pages/Work.tsx:370:17" data-ut-source-ast="/src/pages/Work.tsx#733700bd83b0ef41" data-ut-source-hash="31c81e8ec39da14a">
                  Case Studies & Transformation Proof
                </h2>
                <p className="text-sm text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:373:17" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                  Select a category to filter projects. Click any project card to inspect full challenge, design treatment architecture, and performance results.
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2" data-ut-source-locator="/src/pages/Work.tsx:379:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all duration-200 ${
                      selectedCategory === cat
                        ? 'bg-primary text-primary-foreground font-bold shadow-md'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
                    }`}
                   data-ut-source-locator="/src/pages/Work.tsx:381:19" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Mosaic Grid with Photo Frames */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" data-ut-source-locator="/src/pages/Work.tsx:398:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="group bg-card border border-border rounded-lg overflow-hidden flex flex-col justify-between shadow-lg hover:border-primary/60 transition-all duration-300"
                 data-ut-source-locator="/src/pages/Work.tsx:400:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  {/* Photo Frame */}
                  <div className="relative aspect-[16/10] border-b border-border overflow-hidden bg-muted" data-ut-source-locator="/src/pages/Work.tsx:405:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                     data-ut-source-locator="/src/pages/Work.tsx:406:21" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                    
                    {/* Gradient Overlay Scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-80"  data-ut-source-locator="/src/pages/Work.tsx:413:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>

                    <div className="absolute inset-0 p-4 flex flex-col justify-between z-10" data-ut-source-locator="/src/pages/Work.tsx:415:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <div className="flex justify-between items-start" data-ut-source-locator="/src/pages/Work.tsx:416:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="bg-background/90 backdrop-blur border border-border text-foreground px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-wider font-bold shadow" data-ut-source-locator="/src/pages/Work.tsx:417:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                          {project.category}
                        </span>
                        <span className="bg-primary text-primary-foreground px-2.5 py-1 rounded text-[11px] font-mono font-bold shadow" data-ut-source-locator="/src/pages/Work.tsx:420:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                          {project.impactMetric}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between" data-ut-source-locator="/src/pages/Work.tsx:428:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="space-y-2" data-ut-source-locator="/src/pages/Work.tsx:429:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:430:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        {project.client} · {project.year}
                      </div>
                      <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground group-hover:text-primary transition-colors" data-ut-source-locator="/src/pages/Work.tsx:433:23" data-ut-source-ast="/src/pages/Work.tsx#976960ba800d6336" data-ut-source-hash="31c81e8ec39da14a">
                        {project.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3" data-ut-source-locator="/src/pages/Work.tsx:436:23" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                        {project.subtitle}
                      </p>

                      <div className="pt-2 flex items-center gap-2 text-xs font-mono text-foreground" data-ut-source-locator="/src/pages/Work.tsx:440:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:442:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Impact:</span>
                        <strong className="text-foreground" data-ut-source-locator="/src/pages/Work.tsx:443:25" data-ut-source-ast="/src/pages/Work.tsx#d157da580f2391ac" data-ut-source-hash="31c81e8ec39da14a">{project.impactLabel}</strong>
                      </div>
                    </div>

                    {/* Dual Action CTAs */}
                    <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-3" data-ut-source-locator="/src/pages/Work.tsx:448:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <button
                        type="button"
                        onClick={() => setActiveModalProject(project)}
                        className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                       data-ut-source-locator="/src/pages/Work.tsx:449:23" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span data-ut-source-locator="/src/pages/Work.tsx:455:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Inspect Case Study</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openConsultationWithProject(project.title)}
                        data-ut-cta="cta.card"
                       
                        className="btn-primary py-2 px-3 text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shrink-0"
                       data-ut-intent="lead.capture" data-intent="lead.capture" data-ut-slot="card-cta" data-ut-section-role="gallery" data-ut-slot-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a:gallery:card-cta" data-ut-label="Request Availability" data-ut-ui-action="overlay" data-ut-binding-id="bind__l6uJVAZ" data-ut-binding-key="gallery.gallery.card-cta" data-ut-target-id="form_VowK01H3" data-ut-target-type="form" data-ut-source-locator="/src/pages/Work.tsx:458:23" data-ut-source-ast="/src/pages/Work.tsx#c874509671d4b742" data-ut-source-hash="31c81e8ec39da14a">
                        <span data-ut-source-locator="/src/pages/Work.tsx:465:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Request Availability</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 3. BEFORE & AFTER TRANSFORMATION PROOF SECTION */}
        {/* ============================================================ */}
        <section
          data-ut-variant="before-after:case-study"
          className="py-16 lg:py-24 border-b border-border/60 bg-gradient-to-b from-card/30 to-background"
         data-ut-source-locator="/src/pages/Work.tsx:479:9" data-ut-source-ast="/src/pages/Work.tsx#e2e707621d4413be" data-ut-source-hash="31c81e8ec39da14a">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12" data-ut-source-locator="/src/pages/Work.tsx:483:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="text-center max-w-3xl mx-auto space-y-4" data-ut-source-locator="/src/pages/Work.tsx:484:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:485:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <Zap className="w-3.5 h-3.5" />
                <span data-ut-source-locator="/src/pages/Work.tsx:487:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Credible Transformation Proof</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground" data-ut-source-locator="/src/pages/Work.tsx:489:15" data-ut-source-ast="/src/pages/Work.tsx#733700bd83b0ef41" data-ut-source-hash="31c81e8ec39da14a">
                Before & After Architecture Comparison
              </h2>
              <p className="text-sm text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:492:15" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                See how replacing generic, fragmented design templates with Eman Amanni’s cinematic system architecture directly resolves user friction and unlocks quantifiable business revenue.
              </p>
            </div>

            {/* Side-by-side Transformation Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" data-ut-source-locator="/src/pages/Work.tsx:498:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              {/* Panel 1: Nova Fintech Transformation */}
              <div className="bg-card border border-border p-6 sm:p-8 rounded-lg space-y-6 shadow-xl" data-ut-source-locator="/src/pages/Work.tsx:500:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="flex items-center justify-between border-b border-border/60 pb-4" data-ut-source-locator="/src/pages/Work.tsx:501:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div data-ut-source-locator="/src/pages/Work.tsx:502:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <span className="text-xs font-mono uppercase text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:503:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Transformation #1</span>
                    <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:504:21" data-ut-source-ast="/src/pages/Work.tsx#976960ba800d6336" data-ut-source-hash="31c81e8ec39da14a">
                      Nova Fintech Onboarding Flow
                    </h3>
                  </div>
                  <span className="bg-primary/10 border border-border/30 text-primary-foreground px-3 py-1 rounded text-xs font-mono font-bold" data-ut-source-locator="/src/pages/Work.tsx:508:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                    +165% Conversion
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-ut-source-locator="/src/pages/Work.tsx:513:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  {/* Before Box */}
                  <div className="bg-muted/40 border border-border/30 rounded overflow-hidden space-y-3" data-ut-source-locator="/src/pages/Work.tsx:515:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="relative aspect-[16/9] bg-muted" data-ut-source-locator="/src/pages/Work.tsx:516:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <img
                        src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80"
                        alt="Legacy interface before redesign"
                        className="w-full h-full object-cover filter grayscale contrast-125 opacity-70"
                       data-ut-source-locator="/src/pages/Work.tsx:517:23" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                      <div className="absolute inset-0 bg-primary/40"  data-ut-source-locator="/src/pages/Work.tsx:522:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>
                      <span className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase" data-ut-source-locator="/src/pages/Work.tsx:523:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                        BEFORE: 62% DROP-OFF
                      </span>
                    </div>
                    <ul className="p-3 space-y-2 text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:527:21" data-ut-source-ast="/src/pages/Work.tsx#a9d172de3f4802d2" data-ut-source-hash="31c81e8ec39da14a">
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:528:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:529:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">✕</span>
                        <span data-ut-source-locator="/src/pages/Work.tsx:530:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">7 fragmented form screens with poor visual hierarchy</span>
                      </li>
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:532:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:533:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">✕</span>
                        <span data-ut-source-locator="/src/pages/Work.tsx:534:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Confusing error messaging during identity check</span>
                      </li>
                    </ul>
                  </div>

                  {/* After Box */}
                  <div className="bg-primary/5 border border-primary/40 rounded overflow-hidden space-y-3" data-ut-source-locator="/src/pages/Work.tsx:540:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="relative aspect-[16/9] bg-muted" data-ut-source-locator="/src/pages/Work.tsx:541:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <img
                        src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80"
                        alt="Cinematic interface after Eman Amanni redesign"
                        className="w-full h-full object-cover"
                       data-ut-source-locator="/src/pages/Work.tsx:542:23" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                      <div className="absolute inset-0 bg-primary/10"  data-ut-source-locator="/src/pages/Work.tsx:547:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>
                      <span className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase" data-ut-source-locator="/src/pages/Work.tsx:548:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                        AFTER: 2-TAP VERIFY
                      </span>
                    </div>
                    <ul className="p-3 space-y-2 text-xs text-foreground" data-ut-source-locator="/src/pages/Work.tsx:552:21" data-ut-source-ast="/src/pages/Work.tsx#a9d172de3f4802d2" data-ut-source-hash="31c81e8ec39da14a">
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:553:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span data-ut-source-locator="/src/pages/Work.tsx:555:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Unified glass-card layout with live progress indicators</span>
                      </li>
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:557:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span data-ut-source-locator="/src/pages/Work.tsx:559:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">High-contrast dark design system with micro-interactions</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs font-mono text-muted-foreground border-t border-border/40" data-ut-source-locator="/src/pages/Work.tsx:565:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <span data-ut-source-locator="/src/pages/Work.tsx:566:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Implementation Time: 4 Weeks</span>
                  <button
                    type="button"
                    onClick={() => openConsultationWithProject('Nova Fintech Transformation')}
                    data-ut-cta="cta.card"
                   
                    className="text-primary hover:underline uppercase font-bold flex items-center gap-1"
                   data-ut-intent="lead.capture" data-intent="lead.capture" data-ut-slot="card-cta" data-ut-section-role="gallery" data-ut-slot-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a:gallery:card-cta" data-ut-label="Request Availability" data-ut-ui-action="overlay" data-ut-binding-id="bind__l6uJVAZ" data-ut-binding-key="gallery.gallery.card-cta" data-ut-target-id="form_VowK01H3" data-ut-target-type="form" data-ut-source-locator="/src/pages/Work.tsx:567:19" data-ut-source-ast="/src/pages/Work.tsx#c874509671d4b742" data-ut-source-hash="31c81e8ec39da14a">
                    <span data-ut-source-locator="/src/pages/Work.tsx:574:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Request Similar Plan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Panel 2: Aura Clinical Telemetry Transformation */}
              <div className="bg-card border border-border p-6 sm:p-8 rounded-lg space-y-6 shadow-xl" data-ut-source-locator="/src/pages/Work.tsx:581:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="flex items-center justify-between border-b border-border/60 pb-4" data-ut-source-locator="/src/pages/Work.tsx:582:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div data-ut-source-locator="/src/pages/Work.tsx:583:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <span className="text-xs font-mono uppercase text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:584:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Transformation #2</span>
                    <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:585:21" data-ut-source-ast="/src/pages/Work.tsx#976960ba800d6336" data-ut-source-hash="31c81e8ec39da14a">
                      Aura Clinical Dashboard
                    </h3>
                  </div>
                  <span className="bg-primary/10 border border-primary/30 text-primary px-3 py-1 rounded text-xs font-mono font-bold" data-ut-source-locator="/src/pages/Work.tsx:589:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                    48% Faster UX
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-ut-source-locator="/src/pages/Work.tsx:594:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  {/* Before Box */}
                  <div className="bg-muted/40 border border-border/30 rounded overflow-hidden space-y-3" data-ut-source-locator="/src/pages/Work.tsx:596:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="relative aspect-[16/9] bg-muted" data-ut-source-locator="/src/pages/Work.tsx:597:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <img
                        src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
                        alt="Legacy telemetry tables before redesign"
                        className="w-full h-full object-cover filter grayscale contrast-125 opacity-70"
                       data-ut-source-locator="/src/pages/Work.tsx:598:23" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                      <div className="absolute inset-0 bg-primary/40"  data-ut-source-locator="/src/pages/Work.tsx:603:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>
                      <span className="absolute top-2 left-2 bg-primary/90 text-primary-foreground px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase" data-ut-source-locator="/src/pages/Work.tsx:604:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                        BEFORE: HIGH FATIGUE
                      </span>
                    </div>
                    <ul className="p-3 space-y-2 text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:608:21" data-ut-source-ast="/src/pages/Work.tsx#a9d172de3f4802d2" data-ut-source-hash="31c81e8ec39da14a">
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:609:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:610:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">✕</span>
                        <span data-ut-source-locator="/src/pages/Work.tsx:611:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Dense, unformatted tables overloading clinicians</span>
                      </li>
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:613:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <span className="text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:614:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">✕</span>
                        <span data-ut-source-locator="/src/pages/Work.tsx:615:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Hidden critical alerts buried inside sub-menus</span>
                      </li>
                    </ul>
                  </div>

                  {/* After Box */}
                  <div className="bg-primary/5 border border-primary/40 rounded overflow-hidden space-y-3" data-ut-source-locator="/src/pages/Work.tsx:621:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="relative aspect-[16/9] bg-muted" data-ut-source-locator="/src/pages/Work.tsx:622:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <img
                        src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"
                        alt="Aura telemetry dashboard after Eman Amanni redesign"
                        className="w-full h-full object-cover"
                       data-ut-source-locator="/src/pages/Work.tsx:623:23" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                      <div className="absolute inset-0 bg-primary/10"  data-ut-source-locator="/src/pages/Work.tsx:628:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>
                      <span className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase" data-ut-source-locator="/src/pages/Work.tsx:629:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                        AFTER: ZERO FATIGUE
                      </span>
                    </div>
                    <ul className="p-3 space-y-2 text-xs text-foreground" data-ut-source-locator="/src/pages/Work.tsx:633:21" data-ut-source-ast="/src/pages/Work.tsx#a9d172de3f4802d2" data-ut-source-hash="31c81e8ec39da14a">
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:634:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span data-ut-source-locator="/src/pages/Work.tsx:636:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Ergonomic bento grid prioritizing emergency telemetry</span>
                      </li>
                      <li className="flex items-start gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:638:23" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span data-ut-source-locator="/src/pages/Work.tsx:640:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">WCAG AAA compliant contrast for 24/7 dark environments</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-xs font-mono text-muted-foreground border-t border-border/40" data-ut-source-locator="/src/pages/Work.tsx:646:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <span data-ut-source-locator="/src/pages/Work.tsx:647:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Implementation Time: 6 Weeks</span>
                  <button
                    type="button"
                    onClick={() => openConsultationWithProject('Aura Clinical Dashboard')}
                    data-ut-cta="cta.card"
                   
                    className="text-primary hover:underline uppercase font-bold flex items-center gap-1"
                   data-ut-intent="lead.capture" data-intent="lead.capture" data-ut-slot="card-cta" data-ut-section-role="gallery" data-ut-slot-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a:gallery:card-cta" data-ut-label="Request Availability" data-ut-ui-action="overlay" data-ut-binding-id="bind__l6uJVAZ" data-ut-binding-key="gallery.gallery.card-cta" data-ut-target-id="form_VowK01H3" data-ut-target-type="form" data-ut-source-locator="/src/pages/Work.tsx:648:19" data-ut-source-ast="/src/pages/Work.tsx#c874509671d4b742" data-ut-source-hash="31c81e8ec39da14a">
                    <span data-ut-source-locator="/src/pages/Work.tsx:655:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Request Similar Plan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 4. ABOUT / PHILOSOPHY SECTION: The Eman Amanni Treatment */}
        {/* ============================================================ */}
        <section
          data-ut-variant="about:image-story"
          className="py-16 lg:py-24 border-b border-border/60"
         data-ut-source-locator="/src/pages/Work.tsx:667:9" data-ut-source-ast="/src/pages/Work.tsx#e2e707621d4413be" data-ut-source-hash="31c81e8ec39da14a">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/pages/Work.tsx:671:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" data-ut-source-locator="/src/pages/Work.tsx:672:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              {/* Editorial Image Frame */}
              <div className="lg:col-span-5 relative" data-ut-source-locator="/src/pages/Work.tsx:674:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="aspect-[3/4] bg-card border border-border rounded-lg overflow-hidden relative shadow-2xl group" data-ut-source-locator="/src/pages/Work.tsx:675:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <img
                    src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80"
                    alt="Design Architecture Method"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                   data-ut-source-locator="/src/pages/Work.tsx:676:19" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"  data-ut-source-locator="/src/pages/Work.tsx:681:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>
                  
                  <div className="absolute inset-0 p-6 flex flex-col justify-between z-10" data-ut-source-locator="/src/pages/Work.tsx:683:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="space-y-1" data-ut-source-locator="/src/pages/Work.tsx:684:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <span className="text-[11px] font-mono text-primary font-bold uppercase tracking-widest bg-background/90 px-2.5 py-1 rounded border border-border" data-ut-source-locator="/src/pages/Work.tsx:685:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                        DESIGN ARCHITECTURE METHOD
                      </span>
                    </div>

                    <div className="space-y-3 bg-background/95 backdrop-blur border border-border p-5 rounded-lg" data-ut-source-locator="/src/pages/Work.tsx:690:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:691:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        <ShieldCheck className="w-4 h-4" />
                        <span data-ut-source-locator="/src/pages/Work.tsx:693:25" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">QUALITY GUARANTEE</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed" data-ut-source-locator="/src/pages/Work.tsx:695:23" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                        "Great UI is not just visually stunning—it is an engine for business conversion, user clarity, and operational scalability."
                      </p>
                      <div className="text-xs font-bold text-foreground font-mono" data-ut-source-locator="/src/pages/Work.tsx:698:23" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                        — Eman Amanni, Principal Lead
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Narrative */}
              <div className="lg:col-span-7 space-y-6" data-ut-source-locator="/src/pages/Work.tsx:707:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:708:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <Layers className="w-3.5 h-3.5" />
                  <span data-ut-source-locator="/src/pages/Work.tsx:710:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Deep Treatment Analysis</span>
                </div>

                <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground" data-ut-source-locator="/src/pages/Work.tsx:713:17" data-ut-source-ast="/src/pages/Work.tsx#733700bd83b0ef41" data-ut-source-hash="31c81e8ec39da14a">
                  How Senior Interface Architecture Transmutes Digital Products
                </h2>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed" data-ut-source-locator="/src/pages/Work.tsx:717:17" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                  Every product treatment begins with a rigorous audit of user cognitive load, visual friction points, and key conversion paths. We eliminate generic template clutter and replace it with bespoke, tokenized design systems that scale seamlessly across engineering teams.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2" data-ut-source-locator="/src/pages/Work.tsx:721:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div className="bg-card border border-border p-4 rounded space-y-2" data-ut-source-locator="/src/pages/Work.tsx:722:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-xs font-mono uppercase text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:723:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      01. Tokenized Design Systems
                    </div>
                    <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:726:21" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                      Comprehensive Tailwind, HSL, and React component specifications ensuring 100% fidelity from Figma to production code.
                    </p>
                  </div>

                  <div className="bg-card border border-border p-4 rounded space-y-2" data-ut-source-locator="/src/pages/Work.tsx:731:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-xs font-mono uppercase text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:732:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      02. Conversion-Led Engineering
                    </div>
                    <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:735:21" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                      Every button placement, micro-interaction state, and data visual is validated against real user behavior metrics.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-4" data-ut-source-locator="/src/pages/Work.tsx:741:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <button
                    type="button"
                    onClick={() => openConsultationWithProject()}
                    data-ut-cta="cta.card"
                   
                    className="btn-primary py-3 px-6 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
                   data-ut-intent="lead.capture" data-intent="lead.capture" data-ut-slot="card-cta" data-ut-section-role="gallery" data-ut-slot-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a:gallery:card-cta" data-ut-label="Request Availability" data-ut-ui-action="overlay" data-ut-binding-id="bind__l6uJVAZ" data-ut-binding-key="gallery.gallery.card-cta" data-ut-target-id="form_VowK01H3" data-ut-target-type="form" data-ut-source-locator="/src/pages/Work.tsx:742:19" data-ut-source-ast="/src/pages/Work.tsx#c874509671d4b742" data-ut-source-hash="31c81e8ec39da14a">
                    <Sparkles className="w-4 h-4" />
                    <span data-ut-source-locator="/src/pages/Work.tsx:750:21" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Schedule Treatment Audit</span>
                  </button>
                  <span className="text-xs font-mono text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:752:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                    Available for Q2/Q3 Projects
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 5. TESTIMONIALS SECTION: Peer & Client Proof */}
        {/* ============================================================ */}
        <section
          data-ut-variant="testimonials:spotlight"
          className="py-16 lg:py-24 border-b border-border/60 bg-gradient-to-b from-background via-card/30 to-background"
         data-ut-source-locator="/src/pages/Work.tsx:764:9" data-ut-source-ast="/src/pages/Work.tsx#e2e707621d4413be" data-ut-source-hash="31c81e8ec39da14a">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12" data-ut-source-locator="/src/pages/Work.tsx:768:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="text-center max-w-2xl mx-auto space-y-3" data-ut-source-locator="/src/pages/Work.tsx:769:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:770:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <Star className="w-3.5 h-3.5" />
                <span data-ut-source-locator="/src/pages/Work.tsx:772:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Founder & VP Endorsements</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground" data-ut-source-locator="/src/pages/Work.tsx:774:15" data-ut-source-ast="/src/pages/Work.tsx#733700bd83b0ef41" data-ut-source-hash="31c81e8ec39da14a">
                What Product Leaders Say
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8" data-ut-source-locator="/src/pages/Work.tsx:779:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              {/* Testimonial 1 */}
              <div className="bg-card border border-border p-6 rounded-lg space-y-4 flex flex-col justify-between shadow-lg" data-ut-source-locator="/src/pages/Work.tsx:781:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="space-y-3" data-ut-source-locator="/src/pages/Work.tsx:782:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div className="flex gap-1 text-primary" data-ut-source-locator="/src/pages/Work.tsx:783:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic" data-ut-source-locator="/src/pages/Work.tsx:788:19" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                    "Eman Amanni redesigned our entire wealth platform in 5 weeks. The onboarding completion rate skyrocketed by 165% immediately after launch. Incredible eye for detail."
                  </p>
                </div>
                <div className="pt-4 border-t border-border/60 flex items-center justify-between" data-ut-source-locator="/src/pages/Work.tsx:792:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div data-ut-source-locator="/src/pages/Work.tsx:793:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-xs font-[number:var(--ut-weight-display)] font-heading uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:794:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Marcus Vance
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:797:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      CTO, Nova Financial
                    </div>
                  </div>
                  <span className="text-xs font-mono text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:801:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Fintech</span>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="bg-card border border-border p-6 rounded-lg space-y-4 flex flex-col justify-between shadow-lg" data-ut-source-locator="/src/pages/Work.tsx:806:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="space-y-3" data-ut-source-locator="/src/pages/Work.tsx:807:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div className="flex gap-1 text-primary" data-ut-source-locator="/src/pages/Work.tsx:808:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic" data-ut-source-locator="/src/pages/Work.tsx:813:19" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                    "The clinical telemetry dashboard Eman created reduced emergency diagnostic times by nearly 50%. Our emergency room physicians won't work on anything else now."
                  </p>
                </div>
                <div className="pt-4 border-t border-border/60 flex items-center justify-between" data-ut-source-locator="/src/pages/Work.tsx:817:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div data-ut-source-locator="/src/pages/Work.tsx:818:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-xs font-[number:var(--ut-weight-display)] font-heading uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:819:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Dr. Elena Rostova
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:822:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Head of Product, Aura Health
                    </div>
                  </div>
                  <span className="text-xs font-mono text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:826:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Health SaaS</span>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="bg-card border border-border p-6 rounded-lg space-y-4 flex flex-col justify-between shadow-lg" data-ut-source-locator="/src/pages/Work.tsx:831:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="space-y-3" data-ut-source-locator="/src/pages/Work.tsx:832:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div className="flex gap-1 text-primary" data-ut-source-locator="/src/pages/Work.tsx:833:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed italic" data-ut-source-locator="/src/pages/Work.tsx:838:19" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                    "Working with Eman is seamless. She delivers complete React component tokens and Figma libraries that our engineers can drop directly into production without back-and-forth."
                  </p>
                </div>
                <div className="pt-4 border-t border-border/60 flex items-center justify-between" data-ut-source-locator="/src/pages/Work.tsx:842:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div data-ut-source-locator="/src/pages/Work.tsx:843:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    <div className="text-xs font-[number:var(--ut-weight-display)] font-heading uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:844:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      Siddharth Mehta
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:847:21" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                      VP Engineering, Krypton AI
                    </div>
                  </div>
                  <span className="text-xs font-mono text-primary font-bold" data-ut-source-locator="/src/pages/Work.tsx:851:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">DevTools</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* 6. CTA BANNER SECTION: Confident Booking Drive */}
        {/* ============================================================ */}
        <section
          data-ut-variant="cta:centered"
          className="py-20 lg:py-28 relative overflow-hidden bg-card border-t border-border"
         data-ut-source-locator="/src/pages/Work.tsx:861:9" data-ut-source-ast="/src/pages/Work.tsx#e2e707621d4413be" data-ut-source-hash="31c81e8ec39da14a">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none"  data-ut-source-locator="/src/pages/Work.tsx:865:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a"/>

          <div className="max-w-4xl mx-auto px-4 text-center space-y-8 relative z-10" data-ut-source-locator="/src/pages/Work.tsx:867:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-mono uppercase tracking-widest font-bold" data-ut-source-locator="/src/pages/Work.tsx:868:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <Sparkles className="w-4 h-4" />
              <span data-ut-source-locator="/src/pages/Work.tsx:870:15" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Initiate Your Design Transformation</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground leading-tight" data-ut-source-locator="/src/pages/Work.tsx:873:13" data-ut-source-ast="/src/pages/Work.tsx#733700bd83b0ef41" data-ut-source-hash="31c81e8ec39da14a">
              Ready to engineer a high-converting interface for your product?
            </h2>

            <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed" data-ut-source-locator="/src/pages/Work.tsx:877:13" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
              Book a direct consultation with Eman Amanni to review your design architecture, discuss timelines, and reserve your project kickoff slot.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2" data-ut-source-locator="/src/pages/Work.tsx:881:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <button
                type="button"
                onClick={() => openConsultationWithProject()}
                data-ut-cta="cta.card"
               
                className="btn-primary py-4 px-8 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-2xl w-full sm:w-auto justify-center"
               data-ut-intent="lead.capture" data-intent="lead.capture" data-ut-slot="card-cta" data-ut-section-role="gallery" data-ut-slot-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a:gallery:card-cta" data-ut-label="Request Availability" data-ut-ui-action="overlay" data-ut-binding-id="bind__l6uJVAZ" data-ut-binding-key="gallery.gallery.card-cta" data-ut-target-id="form_VowK01H3" data-ut-target-type="form" data-ut-source-locator="/src/pages/Work.tsx:882:15" data-ut-source-ast="/src/pages/Work.tsx#c874509671d4b742" data-ut-source-hash="31c81e8ec39da14a">
                <Sparkles className="w-4 h-4" />
                <span data-ut-source-locator="/src/pages/Work.tsx:890:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Schedule Consultation Now</span>
              </button>

              <a
                href="mailto:eman@dreamdesign.studio"
                data-ut-cta="cta.email"
                data-ut-intent="contact.email"
                className="btn-secondary py-4 px-8 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 w-full sm:w-auto justify-center"
               data-ut-source-locator="/src/pages/Work.tsx:893:15" data-ut-source-ast="/src/pages/Work.tsx#3b4da282882e72be" data-ut-source-hash="31c81e8ec39da14a">
                <span data-ut-source-locator="/src/pages/Work.tsx:899:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Direct Email Inquiry</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:904:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <span className="flex items-center gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:905:15" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                <Clock className="w-4 h-4 text-primary" />
                <span data-ut-source-locator="/src/pages/Work.tsx:907:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">24-Hour Response Guarantee</span>
              </span>
              <span className="text-border" data-ut-source-locator="/src/pages/Work.tsx:909:15" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">|</span>
              <span className="flex items-center gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:910:15" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span data-ut-source-locator="/src/pages/Work.tsx:912:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">NDAs & Custom Contracts Supported</span>
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Case Study Modal */}
      {activeModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto" data-ut-source-locator="/src/pages/Work.tsx:921:9" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
          <div className="bg-card border border-border max-w-3xl w-full rounded-lg shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col" data-ut-source-locator="/src/pages/Work.tsx:922:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/40" data-ut-source-locator="/src/pages/Work.tsx:923:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <span className="text-xs font-mono text-primary font-bold uppercase" data-ut-source-locator="/src/pages/Work.tsx:924:15" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">
                CASE STUDY INSPECTION
              </span>
              <button
                onClick={() => setActiveModalProject(null)}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
               data-ut-source-locator="/src/pages/Work.tsx:927:15" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1" data-ut-source-locator="/src/pages/Work.tsx:935:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <div className="aspect-[16/9] bg-muted rounded overflow-hidden relative border border-border" data-ut-source-locator="/src/pages/Work.tsx:936:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <img
                  src={activeModalProject.image}
                  alt={activeModalProject.title}
                  className="w-full h-full object-cover"
                 data-ut-source-locator="/src/pages/Work.tsx:937:17" data-ut-source-ast="/src/pages/Work.tsx#f38cb1b6ea50b38a" data-ut-source-hash="31c81e8ec39da14a"/>
              </div>

              <div data-ut-source-locator="/src/pages/Work.tsx:944:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <span className="text-xs font-mono text-primary uppercase" data-ut-source-locator="/src/pages/Work.tsx:945:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">{activeModalProject.category}</span>
                <h3 className="text-2xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:946:17" data-ut-source-ast="/src/pages/Work.tsx#976960ba800d6336" data-ut-source-hash="31c81e8ec39da14a">
                  {activeModalProject.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-1" data-ut-source-locator="/src/pages/Work.tsx:949:17" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">{activeModalProject.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded border border-border" data-ut-source-locator="/src/pages/Work.tsx:952:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div data-ut-source-locator="/src/pages/Work.tsx:953:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <h4 className="text-xs font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground mb-1" data-ut-source-locator="/src/pages/Work.tsx:954:19" data-ut-source-ast="/src/pages/Work.tsx#ef5c1cdbe904c7f7" data-ut-source-hash="31c81e8ec39da14a">The Problem</h4>
                  <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:955:19" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">{activeModalProject.problem}</p>
                </div>
                <div data-ut-source-locator="/src/pages/Work.tsx:957:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <h4 className="text-xs font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground mb-1" data-ut-source-locator="/src/pages/Work.tsx:958:19" data-ut-source-ast="/src/pages/Work.tsx#ef5c1cdbe904c7f7" data-ut-source-hash="31c81e8ec39da14a">The Solution</h4>
                  <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:959:19" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">{activeModalProject.solution}</p>
                </div>
              </div>

              <div data-ut-source-locator="/src/pages/Work.tsx:963:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <h4 className="text-xs font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground mb-2" data-ut-source-locator="/src/pages/Work.tsx:964:17" data-ut-source-ast="/src/pages/Work.tsx#ef5c1cdbe904c7f7" data-ut-source-hash="31c81e8ec39da14a">Key Treatment Architecture</h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:965:17" data-ut-source-ast="/src/pages/Work.tsx#a9d172de3f4802d2" data-ut-source-hash="31c81e8ec39da14a">
                  {activeModalProject.treatmentDetails.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2" data-ut-source-locator="/src/pages/Work.tsx:967:21" data-ut-source-ast="/src/pages/Work.tsx#2b0c0e9047f2ac54" data-ut-source-hash="31c81e8ec39da14a">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span data-ut-source-locator="/src/pages/Work.tsx:969:23" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border pt-4 flex items-center justify-between" data-ut-source-locator="/src/pages/Work.tsx:975:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div data-ut-source-locator="/src/pages/Work.tsx:976:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground" data-ut-source-locator="/src/pages/Work.tsx:977:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">MEASURED IMPACT</div>
                  <div className="text-xl font-heading font-[number:var(--ut-weight-display)] text-primary" data-ut-source-locator="/src/pages/Work.tsx:978:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">{activeModalProject.impactMetric} {activeModalProject.impactLabel}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const title = activeModalProject.title;
                    setActiveModalProject(null);
                    openConsultationWithProject(title);
                  }}
                  data-ut-cta="cta.card"
                 
                  className="btn-primary py-2.5 px-4 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
                 data-ut-intent="lead.capture" data-intent="lead.capture" data-ut-slot="card-cta" data-ut-section-role="gallery" data-ut-slot-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a:gallery:card-cta" data-ut-label="Request Availability" data-ut-ui-action="overlay" data-ut-binding-id="bind__l6uJVAZ" data-ut-binding-key="gallery.gallery.card-cta" data-ut-target-id="form_VowK01H3" data-ut-target-type="form" data-ut-source-locator="/src/pages/Work.tsx:980:17" data-ut-source-ast="/src/pages/Work.tsx#c874509671d4b742" data-ut-source-hash="31c81e8ec39da14a">
                  <span data-ut-source-locator="/src/pages/Work.tsx:991:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Request Availability</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consultation Booking Modal */}
      {isConsultationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md" data-ut-source-locator="/src/pages/Work.tsx:1002:9" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
          <div className="bg-card border border-border max-w-lg w-full rounded-lg shadow-2xl p-6 relative space-y-6" data-ut-source-locator="/src/pages/Work.tsx:1003:11" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
            <div className="flex justify-between items-center border-b border-border pb-4" data-ut-source-locator="/src/pages/Work.tsx:1004:13" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
              <div data-ut-source-locator="/src/pages/Work.tsx:1005:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <span className="text-xs font-mono text-primary font-bold uppercase" data-ut-source-locator="/src/pages/Work.tsx:1006:17" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">BOOKING CONSULTATION</span>
                <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/pages/Work.tsx:1007:17" data-ut-source-ast="/src/pages/Work.tsx#976960ba800d6336" data-ut-source-hash="31c81e8ec39da14a">
                  Reserve Project Kickoff
                </h3>
              </div>
              <button
                onClick={() => setIsConsultationOpen(false)}
                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
               data-ut-source-locator="/src/pages/Work.tsx:1011:15" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isSubmitted ? (
              <div className="py-8 text-center space-y-4" data-ut-source-locator="/src/pages/Work.tsx:1020:15" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mx-auto" data-ut-source-locator="/src/pages/Work.tsx:1021:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-heading font-[number:var(--ut-weight-display)] uppercase" data-ut-source-locator="/src/pages/Work.tsx:1024:17" data-ut-source-ast="/src/pages/Work.tsx#ef5c1cdbe904c7f7" data-ut-source-hash="31c81e8ec39da14a">Consultation Request Received</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto" data-ut-source-locator="/src/pages/Work.tsx:1025:17" data-ut-source-ast="/src/pages/Work.tsx#c42613b532bbf4b9" data-ut-source-hash="31c81e8ec39da14a">
                  Eman Amanni will review your project parameters and respond within 24 business hours with availability options.
                </p>
                <button
                  type="button"
                  onClick={() => setIsConsultationOpen(false)}
                  className="btn-secondary py-2 px-6 text-xs font-bold uppercase tracking-wider"
                 data-ut-source-locator="/src/pages/Work.tsx:1028:17" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleConsultationSubmit} className="space-y-4" data-ut-source-locator="/src/pages/Work.tsx:1037:15" data-ut-source-ast="/src/pages/Work.tsx#c018f53d62922fb9" data-ut-source-hash="31c81e8ec39da14a">
                {preselectedProjectName && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded text-xs font-mono text-primary" data-ut-source-locator="/src/pages/Work.tsx:1039:19" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                    Inquiring about: <strong data-ut-source-locator="/src/pages/Work.tsx:1040:38" data-ut-source-ast="/src/pages/Work.tsx#d157da580f2391ac" data-ut-source-hash="31c81e8ec39da14a">{preselectedProjectName}</strong>
                  </div>
                )}

                <div className="space-y-1" data-ut-source-locator="/src/pages/Work.tsx:1044:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <label className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:1045:19" data-ut-source-ast="/src/pages/Work.tsx#44c68cff65e94aeb" data-ut-source-hash="31c81e8ec39da14a">
                    <User className="w-3.5 h-3.5" /> Full Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Jane Doe"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/pages/Work.tsx:1048:19" data-ut-source-ast="/src/pages/Work.tsx#068f8fe5f007b3c9" data-ut-source-hash="31c81e8ec39da14a"/>
                </div>

                <div className="space-y-1" data-ut-source-locator="/src/pages/Work.tsx:1056:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <label className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:1057:19" data-ut-source-ast="/src/pages/Work.tsx#44c68cff65e94aeb" data-ut-source-hash="31c81e8ec39da14a">
                    <Mail className="w-3.5 h-3.5" /> Work Email
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="jane@company.com"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/pages/Work.tsx:1060:19" data-ut-source-ast="/src/pages/Work.tsx#068f8fe5f007b3c9" data-ut-source-hash="31c81e8ec39da14a"/>
                </div>

                <div className="space-y-1" data-ut-source-locator="/src/pages/Work.tsx:1068:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <label className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:1069:19" data-ut-source-ast="/src/pages/Work.tsx#44c68cff65e94aeb" data-ut-source-hash="31c81e8ec39da14a">
                    <Building className="w-3.5 h-3.5" /> Company / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/pages/Work.tsx:1072:19" data-ut-source-ast="/src/pages/Work.tsx#068f8fe5f007b3c9" data-ut-source-hash="31c81e8ec39da14a"/>
                </div>

                <div className="space-y-1" data-ut-source-locator="/src/pages/Work.tsx:1079:17" data-ut-source-ast="/src/pages/Work.tsx#9a11d01298fb0c26" data-ut-source-hash="31c81e8ec39da14a">
                  <label className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-1.5" data-ut-source-locator="/src/pages/Work.tsx:1080:19" data-ut-source-ast="/src/pages/Work.tsx#44c68cff65e94aeb" data-ut-source-hash="31c81e8ec39da14a">
                    <MessageSquare className="w-3.5 h-3.5" /> Project Goals & Timeline
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe your design challenge, target audience, and preferred kickoff date..."
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-primary"
                   data-ut-source-locator="/src/pages/Work.tsx:1083:19" data-ut-source-ast="/src/pages/Work.tsx#f91d3199f0c0935d" data-ut-source-hash="31c81e8ec39da14a"/>
                </div>

                <button
                  type="submit"
                  data-ut-cta="cta.hero-secondary"
                  data-ut-intent="contact.submit"
                  className="btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                 data-ut-source-locator="/src/pages/Work.tsx:1090:17" data-ut-source-ast="/src/pages/Work.tsx#7edba6272caa7e2b" data-ut-source-hash="31c81e8ec39da14a">
                  <Send className="w-4 h-4" />
                  <span data-ut-source-locator="/src/pages/Work.tsx:1097:19" data-ut-source-ast="/src/pages/Work.tsx#f6945c93a6d71f7f" data-ut-source-hash="31c81e8ec39da14a">Submit Consultation Request</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Shared Site Footer */}
      <SiteFooter />
    </div>
  );
}