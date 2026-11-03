/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));

const Sparkles = __LucideIcons['Sparkles'] || __LucideFallback;
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideIcons['Arrowright'] || __LucideFallback;
const Mail = __LucideIcons['Mail'] || __LucideFallback;

interface HomeCTAProps {
  onStartProject: () => void;
}

export const HomeCTA: React.FC<HomeCTAProps> = ({ onStartProject }) => {
  return (
    <section
      data-ut-variant="cta:signal-banner"
      className="py-24 bg-card border-t border-border text-foreground relative overflow-hidden"
     data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:10:5" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#1233a58e0307ecda" data-ut-source-hash="e4a89c07524dce73">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 opacity-60"  data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:14:7" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#5c92ea0e01fce172" data-ut-source-hash="e4a89c07524dce73"/>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8" data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:15:7" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#5c92ea0e01fce172" data-ut-source-hash="e4a89c07524dce73">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-mono uppercase tracking-widest border border-primary/30" data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:16:9" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#5c92ea0e01fce172" data-ut-source-hash="e4a89c07524dce73">
          <Sparkles className="w-3.5 h-3.5" />
          <span data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:18:11" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#4078ce0f14b7f61b" data-ut-source-hash="e4a89c07524dce73">Now Booking Q2 / Q3 Engagements</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight leading-tight max-w-3xl mx-auto" data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:21:9" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#74b966a1fc622f95" data-ut-source-hash="e4a89c07524dce73">
          Ready to elevate your digital product into a <span className="text-primary" data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:22:56" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#4078ce0f14b7f61b" data-ut-source-hash="e4a89c07524dce73">cinematic experience</span>?
        </h2>

        <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed" data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:25:9" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#4abe9251c602bc75" data-ut-source-hash="e4a89c07524dce73">
          Whether starting from scratch or re-architecting an existing product, let&apos;s build an interface your users will love.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4" data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:29:9" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#5c92ea0e01fce172" data-ut-source-hash="e4a89c07524dce73">
          <button
            type="button"
            onClick={onStartProject}
            data-ut-cta="cta.primary-cta"
            data-ut-intent="contact.submit"
            className="btn-primary py-4 px-8 text-xs font-extrabold uppercase tracking-widest shadow-xl"
           data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:30:11" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#e631b023b12b6f97" data-ut-source-hash="e4a89c07524dce73">
            <Sparkles className="w-4 h-4" />
            <span data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:38:13" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#4078ce0f14b7f61b" data-ut-source-hash="e4a89c07524dce73">Start Your Project</span>
          </button>

          <a
            href="mailto:eman@dreamdesign.studio"
            data-ut-cta="cta.email"
            data-ut-intent="contact.email"
            className="btn-secondary py-4 px-8 text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2"
           data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:41:11" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#f5f9795ee8a05dba" data-ut-source-hash="e4a89c07524dce73">
            <Mail className="w-4 h-4 text-primary" />
            <span data-ut-source-locator="/src/project-components/home/HomeCTA.tsx:48:13" data-ut-source-ast="/src/project-components/home/HomeCTA.tsx#4078ce0f14b7f61b" data-ut-source-hash="e4a89c07524dce73">Direct Email</span>
          </a>
        </div>
      </div>
    </section>
  );
};
export default HomeCTA;
