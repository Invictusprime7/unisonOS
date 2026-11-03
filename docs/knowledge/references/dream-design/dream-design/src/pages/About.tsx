/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// @unison-ai-authored role=about design=03d5ad4a
import React, { useState } from 'react';
import { motion, useReducedMotion } from '../unison/ui/animation';
import { SiteNav } from '../project-components/site/SiteNav';
import { SiteFooter } from '../project-components/site/SiteFooter';
import { ConsultationModal } from '../project-components/home/ConsultationModal';
import { BeforeAfterSlider } from '../project-components/about/BeforeAfterSlider';
import { Sparkles, Award } from '../unison/ui/icons';
import { GalleryCinematicGrid } from '../unison/design-sources/Gallery';
import { TestimonialsColumns } from '../unison/design-sources/Testimonials';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Grid = __LucideIcons['Grid'] || __LucideFallback;

export default function About() {
  const [isOpen, setIsOpen] = React.useState(false);

  const [consultationOpen, setConsultationOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const titleContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12,
        delayChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.55,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div data-ut-page-role="about" className="min-h-screen bg-background text-foreground flex flex-col" data-ut-source-locator="/src/pages/About.tsx:42:5" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
      <SiteNav onOpenConsultation={() => setConsultationOpen(true)} />

      <main className="flex-1 pt-24 sm:pt-28 pb-16" data-ut-source-locator="/src/pages/About.tsx:45:7" data-ut-source-ast="/src/pages/About.tsx#c402b1de08379c4a" data-ut-source-hash="b12935b1f689f0bd">
        {/* SECTION 1: STUDIO GALLERY & CRAFT DIRECTIVE (HERO NONE) */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-20" data-ut-source-locator="/src/pages/About.tsx:47:9" data-ut-source-ast="/src/pages/About.tsx#bbe012fa9dc14196" data-ut-source-hash="b12935b1f689f0bd">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12 border-b border-border pb-8" data-ut-source-locator="/src/pages/About.tsx:48:11" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
            <div className="lg:col-span-8" data-ut-source-locator="/src/pages/About.tsx:49:13" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-mono uppercase tracking-widest mb-4"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span data-ut-source-locator="/src/pages/About.tsx:57:17" data-ut-source-ast="/src/pages/About.tsx#4bfc231b451f3c07" data-ut-source-hash="b12935b1f689f0bd">Studio & Craft Directives</span>
              </motion.div>

              <motion.h1
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
                variants={titleContainerVariants}
                className="text-3xl sm:text-5xl lg:text-6xl font-heading font-[number:var(--ut-weight-display)] tracking-tight uppercase text-foreground leading-[1.05]"
              >
                <motion.span variants={wordVariants} className="inline-block text-foreground mr-3">
                  Architecting
                </motion.span>
                <motion.span variants={wordVariants} className="inline-block text-primary mr-3">
                  <motion.span
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : {
                            textShadow: [
                              '0 0 14px hsl(var(--primary)/0.25)',
                              '0 0 28px hsl(var(--primary)/0.55)',
                              '0 0 14px hsl(var(--primary)/0.25)',
                            ],
                          }
                    }
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="inline-block text-primary"
                  >
                    Cinematic
                  </motion.span>
                </motion.span>
                <motion.span variants={wordVariants} className="inline-block text-foreground">
                  Digital Products
                </motion.span>
              </motion.h1>
            </div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-4"
            >
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed" data-ut-source-locator="/src/pages/About.tsx:104:15" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">
                DREAM. Design is the senior UI/UX consultancy of Eman Amanni. We engineer high-stakes interfaces for global technology leaders, turning complex software systems into intuitive human interactions.
              </p>
            </motion.div>
          </div>

          {/* Cinematic Gallery Grid using canonical GalleryCinematicGrid design source */}
          <GalleryCinematicGrid
            headline="Selected Studio Artifacts & Systems"
            subheadline="A visual record of design systems, spatial layouts, and pixel-precise interface architectures."
            columns={3}
            filterable={true}
            items={[
              {
                src: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
                alt: "Fintech Dashboard Architecture",
                caption: "AlphaPay Design System & Dark Interface",
                category: "UI/UX Architecture"
              },
              {
                src: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
                alt: "E-Commerce Experience Design",
                caption: "Spatial Prototype for Next-Gen Retailing",
                category: "Spatial UI"
              },
              {
                src: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80",
                alt: "UX Research Board & Wireframing",
                caption: "Behavioral Journey Mapping & Analytics",
                category: "Strategy"
              },
              {
                src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
                alt: "SaaS Component Library",
                caption: "Scalable Token Systems & Radix Components",
                category: "Design Systems"
              },
              {
                src: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
                alt: "Mobile Product Interface",
                caption: "Hyper-Responsive Motion Guidelines",
                category: "Mobile UX"
              },
              {
                src: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
                alt: "Data Visualization Platform",
                caption: "Real-time Telemetry Dashboard for Enterprise",
                category: "UI/UX Architecture"
              }
            ]}
          />
        </section>

        {/* SECTION 2: BEFORE / AFTER TRANSFORMATION REVEAL */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24" data-ut-source-locator="/src/pages/About.tsx:158:9" data-ut-source-ast="/src/pages/About.tsx#bbe012fa9dc14196" data-ut-source-hash="b12935b1f689f0bd">
          <BeforeAfterSlider
            title="Impact Through Redesign"
            subtitle="Slide to inspect how converting bloated SaaS clutter into DREAM's cinematic interface boosted user retention by 68%."
            beforeImage="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80"
            afterImage="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80"
            beforeLabel="Legacy SaaS Friction"
            afterLabel="DREAM Clean Architecture"
          />
        </section>

        {/* SECTION 3: FOUNDER & PHILOSOPHY (EDITORIAL SPLIT) */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24" data-ut-source-locator="/src/pages/About.tsx:170:9" data-ut-source-ast="/src/pages/About.tsx#bbe012fa9dc14196" data-ut-source-hash="b12935b1f689f0bd">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center bg-card border border-border p-8 sm:p-12 rounded-lg shadow-xl" data-ut-source-locator="/src/pages/About.tsx:171:11" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
            <div className="lg:col-span-5 relative" data-ut-source-locator="/src/pages/About.tsx:172:13" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
              <div className="relative aspect-[4/5] rounded-md overflow-hidden border border-border shadow-2xl group" data-ut-source-locator="/src/pages/About.tsx:173:15" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
                <img
                  src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"
                  alt="Eman Amanni - Principal UI/UX Architect"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                 data-ut-source-locator="/src/pages/About.tsx:174:17" data-ut-source-ast="/src/pages/About.tsx#4c24373e7e8259b2" data-ut-source-hash="b12935b1f689f0bd"/>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80"  data-ut-source-locator="/src/pages/About.tsx:179:17" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd"/>
                <div className="absolute bottom-4 left-4 right-4 p-4 bg-background/90 backdrop-blur-md border border-border rounded" data-ut-source-locator="/src/pages/About.tsx:180:17" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
                  <p className="font-heading font-[number:var(--ut-weight-display)] text-base text-foreground" data-ut-source-locator="/src/pages/About.tsx:181:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">Eman Amanni</p>
                  <p className="text-xs text-primary font-mono uppercase tracking-wider" data-ut-source-locator="/src/pages/About.tsx:182:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">Founder & Lead UI/UX Architect</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6" data-ut-source-locator="/src/pages/About.tsx:187:13" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-widest" data-ut-source-locator="/src/pages/About.tsx:188:15" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
                <Award className="w-4 h-4" />
                <span data-ut-source-locator="/src/pages/About.tsx:190:17" data-ut-source-ast="/src/pages/About.tsx#4bfc231b451f3c07" data-ut-source-hash="b12935b1f689f0bd">Design Leadership</span>
              </div>

              <motion.blockquote
                initial={shouldReduceMotion ? false : { opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-xl sm:text-2xl font-heading font-[number:var(--ut-weight-display)] text-foreground leading-snug italic border-l-2 border-primary pl-4"
              >
                "We build interfaces that turn first-time visitors into obsessed advocates. Design is not decoration—it is business leverage."
              </motion.blockquote>

              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed" data-ut-source-locator="/src/pages/About.tsx:203:15" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
                <p data-ut-source-locator="/src/pages/About.tsx:204:17" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">
                  With over 12 years of experience leading product design across Silicon Valley startups, fintech scaleups, and global creative agencies, Eman Amanni established DREAM. Design to provide direct, uncompromised design execution.
                </p>
                <p data-ut-source-locator="/src/pages/About.tsx:207:17" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">
                  Unlike bloated agencies where work is passed to junior teams, every project at DREAM is directly directed and architected by Eman. We partner with founders and product VPs who value craft, speed, and proven ROI.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/80" data-ut-source-locator="/src/pages/About.tsx:212:15" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.08 }}
                >
                  <p className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] text-primary" data-ut-source-locator="/src/pages/About.tsx:219:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">12+</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono" data-ut-source-locator="/src/pages/About.tsx:220:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">Years Experience</p>
                </motion.div>
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.16 }}
                >
                  <p className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/pages/About.tsx:228:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">$400M+</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono" data-ut-source-locator="/src/pages/About.tsx:229:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">Client Valuations</p>
                </motion.div>
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.24 }}
                >
                  <p className="text-2xl sm:text-3xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/pages/About.tsx:237:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">85+</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono" data-ut-source-locator="/src/pages/About.tsx:238:19" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">Products Launched</p>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: TESTIMONIAL PROOF */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-24" data-ut-source-locator="/src/pages/About.tsx:246:9" data-ut-source-ast="/src/pages/About.tsx#bbe012fa9dc14196" data-ut-source-hash="b12935b1f689f0bd">
          <TestimonialsColumns
            headline="Partner Endorsements"
            subheadline="What founders and product directors say about collaborating with DREAM."
            items={[
              {
                quote: "Eman elevated our entire product experience in less than 6 weeks. Our trial-to-paid conversion rate jumped by 42% right after the redesign.",
                author: "Sarah Lin",
                role: "VP of Product, FinFlow",
                avatar: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
                rating: 5
              },
              {
                quote: "The design system built by DREAM allowed our engineering team to ship new features 3x faster without breaking UI consistency.",
                author: "Marcus Vance",
                role: "Co-Founder & CTO, Nexus AI",
                avatar: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80",
                rating: 5
              },
              {
                quote: "Exceptional craft, unbelievable turnarounds, and deep business acumen. Eman doesn't just design screens—he designs revenue growth.",
                author: "Elena Rostova",
                role: "Head of Brand, Aether Spatial",
                avatar: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
                rating: 5
              }
            ]}
          />
        </section>

        {/* SECTION 5: CTA BANNER */}
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" data-ut-source-locator="/src/pages/About.tsx:277:9" data-ut-source-ast="/src/pages/About.tsx#bbe012fa9dc14196" data-ut-source-hash="b12935b1f689f0bd">
          <div className="bg-gradient-to-r from-card via-card/90 to-card border border-border p-8 sm:p-12 rounded-lg flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden" data-ut-source-locator="/src/pages/About.tsx:278:11" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none"  data-ut-source-locator="/src/pages/About.tsx:279:13" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd"/>
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2 max-w-xl text-center md:text-left"
             data-ut-intent="nav.goto" data-intent="nav.goto" data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-path="/work" data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Ready For A Product Transformation?
                Let's Work Together
        ">
              <span className="text-xs font-mono uppercase tracking-widest text-primary font-bold" data-ut-source-locator="/src/pages/About.tsx:289:15" data-ut-source-ast="/src/pages/About.tsx#4bfc231b451f3c07" data-ut-source-hash="b12935b1f689f0bd">
                Ready For A Product Transformation?
              </span>
              <h2 className="text-2xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/pages/About.tsx:292:15" data-ut-source-ast="/src/pages/About.tsx#7f4f89a58d4bcc09" data-ut-source-hash="b12935b1f689f0bd">
                Let's Work Together
              </h2>
              <p className="text-sm text-muted-foreground" data-ut-source-locator="/src/pages/About.tsx:295:15" data-ut-source-ast="/src/pages/About.tsx#bb893bdd707a9f61" data-ut-source-hash="b12935b1f689f0bd">
                Schedule a 30-minute design strategy session directly with Eman Amanni. We'll audit your current interface and outline a roadmap to high conversion.
              </p>
            </motion.div>

            <div className="flex flex-col sm:flex-row items-center gap-4" data-ut-source-locator="/src/pages/About.tsx:300:13" data-ut-source-ast="/src/pages/About.tsx#b1ece82a1f41d1fe" data-ut-source-hash="b12935b1f689f0bd">
              <button
                type="button"
                onClick={() => setConsultationOpen(true)}
                data-ut-intent="contact.submit"
                data-ut-cta="cta.hero"
                className="btn-primary py-3.5 px-8 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
               data-ut-source-locator="/src/pages/About.tsx:301:15" data-ut-source-ast="/src/pages/About.tsx#d2bfdadf5aaddd83" data-ut-source-hash="b12935b1f689f0bd">
                <Sparkles className="w-4 h-4" />
                <span data-ut-source-locator="/src/pages/About.tsx:309:17" data-ut-source-ast="/src/pages/About.tsx#4bfc231b451f3c07" data-ut-source-hash="b12935b1f689f0bd">Start Your Project</span>
              </button>

              <a
                href="mailto:eman@dreamdesign.studio"
                data-ut-cta="cta.email"
                data-ut-intent="contact.email"
                className="btn-secondary py-3.5 px-6 text-xs font-bold uppercase tracking-wider"
               data-ut-source-locator="/src/pages/About.tsx:312:15" data-ut-source-ast="/src/pages/About.tsx#0f6f598a0642c8e6" data-ut-source-hash="b12935b1f689f0bd">
                <span data-ut-source-locator="/src/pages/About.tsx:318:17" data-ut-source-ast="/src/pages/About.tsx#4bfc231b451f3c07" data-ut-source-hash="b12935b1f689f0bd">Email Eman Directly</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Consultation Modal */}
      <ConsultationModal
        isOpen={consultationOpen}
        onClose={() => setConsultationOpen(false)}
      />
    </div>
  );
}