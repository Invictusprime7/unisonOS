/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const User = __LucideIcons['User'] || __LucideFallback;

const Layout = __LucideIcons['Layout'] || __LucideFallback;
const Smartphone = __LucideIcons['Smartphone'] || __LucideFallback;
const Layers = __LucideIcons['Layers'] || __LucideFallback;
const Compass = __LucideIcons['Compass'] || __LucideFallback;
const CheckCircle2 = __LucideIcons['CheckCircle2'] || __LucideIcons['Checkcircle2'] || __LucideFallback;
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideIcons['Arrowright'] || __LucideFallback;

interface HomeServicesProps {
  onSelectService?: () => void;
}

export const HomeServices: React.FC<HomeServicesProps> = ({ onSelectService }) => {
  const services = [
    {
      number: '01',
      icon: Layout,
      title: 'Product Strategy & UX Architecture',
      description:
        'Discovery workshops, user research, wireframing, and information architecture that map out high-conversion user pathways.',
      outcomes: ['User Flow Validation', 'Rapid Wireframe Prototypes', 'Information Architecture'],
    },
    {
      number: '02',
      icon: Smartphone,
      title: 'UI & Interactive Systems',
      description:
        'Bespoke, dark-mode & light-mode visual design featuring high-contrast typography, motion micro-interactions, and accessible components.',
      outcomes: ['High-Fidelity Figma Screens', 'Micro-Interactions', 'Interactive Prototypes'],
    },
    {
      number: '03',
      icon: Layers,
      title: 'Scalable Design Systems',
      description:
        'Comprehensive multi-platform design token systems, React component specifications, and brand handoff guidelines for dev teams.',
      outcomes: ['Token Architecture', 'Component Libraries', 'Dev Handoff Specs'],
    },
    {
      number: '04',
      icon: Compass,
      title: 'Design Sprints & Audits',
      description:
        'Focused 1-week product teardowns and consultation sprints to diagnose conversion friction and revamp legacy software interfaces.',
      outcomes: ['UX Health Audit', 'Conversion Optimization', 'Strategic Roadmap'],
    },
  ];

  return (
    <section
      data-ut-variant="services:editorial-rows"
      className="py-24 bg-background text-foreground relative"
     data-ut-source-locator="/src/project-components/home/HomeServices.tsx:45:5" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#ee87fd822df6bc46" data-ut-source-hash="fc9f4aad7788a109">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:49:7" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
        <div className="max-w-xl mb-16 space-y-3" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:50:9" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:51:11" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
            <span data-ut-source-locator="/src/project-components/home/HomeServices.tsx:52:13" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#3e2db43395aab3d7" data-ut-source-hash="fc9f4aad7788a109">Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:54:11" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#4a0afa5dc4503839" data-ut-source-hash="fc9f4aad7788a109">
            Core Design Services
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:57:11" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#375115d50e5ae4f1" data-ut-source-hash="fc9f4aad7788a109">
            From initial concept discovery to pixel-perfect design system execution, delivering digital interfaces that drive business outcomes.
          </p>
        </div>

        <div className="space-y-6" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:62:9" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.number}
                className="ut-foundation-card bg-card border border-border p-6 sm:p-8 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-6 items-center group hover:border-primary/40 transition-colors"
               data-ut-source-locator="/src/project-components/home/HomeServices.tsx:66:15" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                <div className="md:col-span-1 text-2xl font-mono font-black text-primary/60" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:70:17" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                  {service.number}
                </div>

                <div className="md:col-span-5 space-y-2" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:74:17" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                  <div className="flex items-center gap-3" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:75:19" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                    <div className="p-2 rounded bg-primary/10 text-primary" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:76:21" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight text-foreground group-hover:text-primary transition-colors" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:79:21" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#85dfcb5a6c3a618e" data-ut-source-hash="fc9f4aad7788a109">
                      {service.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:83:19" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#375115d50e5ae4f1" data-ut-source-hash="fc9f4aad7788a109">
                    {service.description}
                  </p>
                </div>

                <div className="md:col-span-4 flex flex-wrap gap-2" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:88:17" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                  {service.outcomes.map((outcome) => (
                    <span
                      key={outcome}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded bg-background border border-border/70 text-foreground"
                     data-ut-source-locator="/src/project-components/home/HomeServices.tsx:90:21" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#3e2db43395aab3d7" data-ut-source-hash="fc9f4aad7788a109">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      <span data-ut-source-locator="/src/project-components/home/HomeServices.tsx:95:23" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#3e2db43395aab3d7" data-ut-source-hash="fc9f4aad7788a109">{outcome}</span>
                    </span>
                  ))}
                </div>

                <div className="md:col-span-2 flex justify-start md:justify-end" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:100:17" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#5624173227e1408e" data-ut-source-hash="fc9f4aad7788a109">
                  <button
                    type="button"
                    onClick={onSelectService}
                    data-ut-intent="booking.create"
                    className="btn-secondary py-2 px-4 text-xs font-bold uppercase tracking-wider" data-ut-slot="service-card.primary-action" data-ut-source-locator="/src/project-components/home/HomeServices.tsx:101:19" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#e4f0b7844404d2c0" data-ut-source-hash="fc9f4aad7788a109">
                    <span data-ut-source-locator="/src/project-components/home/HomeServices.tsx:106:21" data-ut-source-ast="/src/project-components/home/HomeServices.tsx#3e2db43395aab3d7" data-ut-source-hash="fc9f4aad7788a109">Inquire</span>
                    <ArrowRight className="w-3.5 h-3.5 text-primary" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
export default HomeServices;
