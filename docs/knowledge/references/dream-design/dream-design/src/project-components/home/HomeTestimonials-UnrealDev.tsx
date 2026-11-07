/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));

const Star = __LucideIcons['Star'] || __LucideFallback;
const Quote = __LucideIcons['Quote'] || __LucideFallback;

export const HomeTestimonials: React.FC = () => {
  const testimonials = [
    {
      quote:
        'Eman transformed our complex financial software into a streamlined, high-converting product. The attention to detail and cinematic finish blew our stakeholders away.',
      author: 'Marcus Vance',
      role: 'VP of Product, Aura Labs',
    },
    {
      quote:
        'Working with DREAM. Design was the single best decision for our launch. Eman delivered an entire design system and mobile app UI ahead of schedule.',
      author: 'Elena Rostova',
      role: 'Founder & CEO, Neo Monolith',
    },
    {
      quote:
        'Eman possesses that rare combination of visual mastery and deep user conversion psychology. Our trial conversion increased by 40% post-relaunch.',
      author: 'David Chen',
      role: 'Head of Growth, Velocity Health',
    },
  ];

  return (
    <section
      data-ut-variant="testimonials:spotlight"
      className="py-24 bg-background text-foreground border-t border-border relative"
     data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:27:5" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#19ff8e4edcc3844a" data-ut-source-hash="2ba0b5c366722d4f">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:31:7" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
        <div className="text-center max-w-xl mx-auto mb-16 space-y-3" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:32:9" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-primary" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:33:11" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
            <Star className="w-3.5 h-3.5 fill-primary text-primary" />
            <span data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:35:13" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#1f52cecfaad2902b" data-ut-source-hash="2ba0b5c366722d4f">Client Endorsements</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:37:11" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#744325e1db564c85" data-ut-source-hash="2ba0b5c366722d4f">
            Trusted by Product Leaders
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:42:9" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="ut-foundation-card bg-card border border-border p-6 rounded-lg flex flex-col justify-between space-y-4"
             data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:44:13" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
              <div className="space-y-3" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:48:15" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
                <div className="flex text-primary gap-1" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:49:17" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <Quote className="w-6 h-6 text-muted-foreground/40" />
                <p className="text-xs text-foreground/90 leading-relaxed italic" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:55:17" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#2feed61102303345" data-ut-source-hash="2ba0b5c366722d4f">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-border/60" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:60:15" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">
                <div className="font-heading font-[number:var(--ut-weight-display)] text-sm text-foreground uppercase" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:61:17" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">{t.author}</div>
                <div className="text-[11px] font-mono text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeTestimonials.tsx:62:17" data-ut-source-ast="/src/project-components/home/HomeTestimonials.tsx#27b948ce92846fc2" data-ut-source-hash="2ba0b5c366722d4f">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
export default HomeTestimonials;
