/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Layers, Trophy } from '../../unison/ui/icons';
import { motion } from '../../unison/ui/animation';

interface HomeHeroProps {
  onStartProject: () => void;
}

export const HomeHero: React.FC<HomeHeroProps> = ({ onStartProject }) => {
  const words = [
    { text: 'Digital', isPrimary: false },
    { text: 'experiences', isPrimary: false },
    { text: 'crafted', isPrimary: false },
    { text: 'with', isPrimary: false },
    { text: 'bold', isPrimary: true },
    { text: 'cinematic', isPrimary: true },
    { text: 'purpose.', isPrimary: false },
  ];

  const titleContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.15,
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 28, filter: 'blur(8px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.65,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section
      data-ut-variant="hero:prisma-cinematic"
      className="relative min-h-[90vh] pt-32 pb-20 flex items-center justify-center overflow-hidden bg-background text-foreground"
     data-ut-source-locator="/src/project-components/home/HomeHero.tsx:46:5" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#c2b12bee138e1c62" data-ut-source-hash="767427a7828912e3">
      {/* Ambient Radial Bloom Background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[140px] pointer-events-none"  data-ut-source-locator="/src/project-components/home/HomeHero.tsx:51:7" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3"/>
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[120px] pointer-events-none"  data-ut-source-locator="/src/project-components/home/HomeHero.tsx:52:7" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3"/>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:54:7" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:55:9" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
          {/* Main Hero Copy Column */}
          <div className="lg:col-span-7 space-y-6" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:57:11" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
            {/* Eyebrow Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span data-ut-source-locator="/src/project-components/home/HomeHero.tsx:66:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">UI/UX Architecture & Brand Direction</span>
            </motion.div>

            {/* Single H1 Title with Word-by-Word Motion Reveal */}
            <motion.h1
              initial="hidden"
              animate="visible"
              variants={titleContainerVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-heading font-[number:var(--ut-weight-display)] tracking-tight uppercase leading-[1.05] text-foreground"
            >
              {words.map((item, index) => (
                <motion.span
                  key={index}
                  variants={wordVariants}
                  className={`inline-block mr-[0.25em] ${item.isPrimary ? 'text-primary' : ''}`}
                >
                  {item.text}
                </motion.span>
              ))}
            </motion.h1>

            {/* Subtitle / Lead Paragraph */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl font-body"
            >
              DREAM. Design is the creative studio of Eman Amanni. I partner with ambitious technology leaders to build intuitive interfaces, high-conversion web apps, and design systems that stand out.
            </motion.p>

            {/* Primary & Secondary Call to Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-4 pt-4"
             data-ut-intent="nav.goto" data-intent="nav.goto" data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-path="/work" data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Start a Project    View Selected Work">
              <button
                type="button"
                onClick={onStartProject}
                data-ut-cta="cta.hero"
                data-ut-intent="contact.submit"
                className="btn-primary py-3.5 px-7 text-xs font-extrabold uppercase tracking-widest"
               data-ut-source-locator="/src/project-components/home/HomeHero.tsx:104:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#5e343503aaefb57f" data-ut-source-hash="767427a7828912e3">
                <Sparkles className="w-4 h-4" />
                <span data-ut-source-locator="/src/project-components/home/HomeHero.tsx:112:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">Start a Project</span>
              </button>

              <Link
                to="/work"
                data-ut-cta="cta.hero-secondary"
                data-ut-intent="nav.goto"
                data-ut-path="/work"
                className="btn-secondary py-3.5 px-7 text-xs font-bold uppercase tracking-widest"
                data-intent="nav.goto"
                data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a"
                data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a"
                data-ut-target-type="page"
                data-ut-ui-action="navigate"
                data-ut-preflight="1"
                data-ut-label="View Selected Work"
              >
                <span data-ut-source-locator="/src/project-components/home/HomeHero.tsx:129:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">View Selected Work</span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </Link>
            </motion.div>

            {/* Stat Proof Strip */}
            <div className="pt-8 border-t border-border/80 grid grid-cols-3 gap-6 max-w-lg" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:135:13" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
              <div data-ut-source-locator="/src/project-components/home/HomeHero.tsx:136:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                <div className="text-2xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:137:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">10+</div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:138:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">Years Exp.</div>
              </div>
              <div data-ut-source-locator="/src/project-components/home/HomeHero.tsx:140:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                <div className="text-2xl font-heading font-[number:var(--ut-weight-display)] text-primary" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:141:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">40+</div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:142:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">Products Shipped</div>
              </div>
              <div data-ut-source-locator="/src/project-components/home/HomeHero.tsx:144:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                <div className="text-2xl font-heading font-[number:var(--ut-weight-display)] text-foreground" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:145:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">100%</div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:146:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">Client Satisfaction</div>
              </div>
            </div>
          </div>

          {/* Photographic Hero Showcase */}
          <div className="lg:col-span-5 relative" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:152:11" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
            <div className="ut-media-frame p-3 bg-card/90 backdrop-blur-md border border-border shadow-2xl relative overflow-hidden group" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:153:13" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
              <div className="relative h-[420px] rounded overflow-hidden bg-muted" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:154:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                <img
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"
                  alt="Cinematic UI/UX Product Interface Showcase"
                  className="w-full h-full object-cover bg-muted transition-transform duration-500 group-hover:scale-105"
                 data-ut-source-locator="/src/project-components/home/HomeHero.tsx:155:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#f2ed3ee28085a8ee" data-ut-source-hash="767427a7828912e3"/>
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"  data-ut-source-locator="/src/project-components/home/HomeHero.tsx:160:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3"/>
                <div className="absolute bottom-4 left-4 right-4 p-4 bg-card/90 backdrop-blur-md border border-border/80 rounded space-y-2" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:161:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                  <div className="flex items-center justify-between text-xs font-mono" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:162:19" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                    <span className="text-primary font-bold uppercase tracking-wider flex items-center gap-1.5" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:163:21" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">
                      <Layers className="w-3.5 h-3.5" />
                      <span data-ut-source-locator="/src/project-components/home/HomeHero.tsx:165:23" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">AURA DESIGN SYSTEM V4</span>
                    </span>
                    <span className="text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:167:21" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">STUDIO RELEASE</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:169:19" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#0beac7b1d37e26ad" data-ut-source-hash="767427a7828912e3">
                    Next-generation spatial UI architecture and component framework by Eman Amanni.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between text-xs px-2 pt-3 pb-1" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:176:15" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                <div className="flex items-center gap-2" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:177:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#2e0a586e32dbb07a" data-ut-source-hash="767427a7828912e3">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:179:19" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">Featured UX Design Studio</span>
                </div>
                <span className="text-muted-foreground text-[10px] font-mono" data-ut-source-locator="/src/project-components/home/HomeHero.tsx:181:17" data-ut-source-ast="/src/project-components/home/HomeHero.tsx#9a851d6f7aa5ddd3" data-ut-source-hash="767427a7828912e3">Q2/Q3 slots open</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default HomeHero;