/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Award, UserCheck, Shield } from '../../unison/ui/icons';

export const HomeAboutTeaser: React.FC = () => {
  return (
    <section
      data-ut-variant="about:editorial-split"
      className="py-24 bg-background border-t border-border text-foreground relative overflow-hidden"
     data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:7:5" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#58ba10f5781da9c9" data-ut-source-hash="d5dacd05626c2ed1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:11:7" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:12:9" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
          {/* Left Column: Portrait & Media Frame */}
          <div className="lg:col-span-5" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:14:11" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
            <div className="ut-media-frame p-3 bg-black border border-border rounded-lg relative space-y-4 shadow-xl" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:15:13" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
              <div className="h-80 rounded overflow-hidden bg-black border border-border/80 relative" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:16:15" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                <img
                  src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"
                  alt="Eman Amanni — Lead UI/UX Architect"
                  className="w-full h-full object-cover bg-black"
                 data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:17:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#83d7c781b6833c1d" data-ut-source-hash="d5dacd05626c2ed1"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"  data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:22:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1"/>
                <div className="absolute bottom-4 left-4 right-4" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:23:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                  <div className="flex items-center justify-between mb-1" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:24:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold bg-primary/20 px-2 py-0.5 rounded border border-primary/30" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:25:21" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#64efcd6aca8d38c6" data-ut-source-hash="d5dacd05626c2ed1">
                      Founder & Design Director
                    </span>
                    <Award className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-xl font-heading font-[number:var(--ut-weight-display)] uppercase text-foreground" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:30:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c13f508f56fc243b" data-ut-source-hash="d5dacd05626c2ed1">
                    Eman Amanni
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:33:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#8ae11d9effbd1d1a" data-ut-source-hash="d5dacd05626c2ed1">
                    Senior UI/UX Architect · San Francisco / Remote
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:39:15" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                <div className="p-3 bg-black border border-border rounded flex items-center gap-2" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:40:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:42:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#64efcd6aca8d38c6" data-ut-source-hash="d5dacd05626c2ed1">1-on-1 Client Direct</span>
                </div>
                <div className="p-3 bg-black border border-border rounded flex items-center gap-2" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:44:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                  <Shield className="w-4 h-4 text-accent" />
                  <span data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:46:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#64efcd6aca8d38c6" data-ut-source-hash="d5dacd05626c2ed1">Senior Oversight</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Philosophy Copy */}
          <div className="lg:col-span-7 space-y-6" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:53:11" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:54:13" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
              <Sparkles className="w-3.5 h-3.5" />
              <span data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:56:15" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#64efcd6aca8d38c6" data-ut-source-hash="d5dacd05626c2ed1">Studio Philosophy</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-heading font-[number:var(--ut-weight-display)] uppercase tracking-tight leading-tight" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:59:13" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#93cee1949684c7a8" data-ut-source-hash="d5dacd05626c2ed1">
              Design is not just how it looks, but how effortlessly it drives user action.
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:63:13" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#8ae11d9effbd1d1a" data-ut-source-hash="d5dacd05626c2ed1">
              Hi, I&apos;m Eman Amanni. Over the past decade, I have led visual design and product strategy for fast-growing startups and established enterprise platforms. My work blends high-contrast cinematic art direction with rigorous UX research and design systems logic.
            </p>

            <div className="space-y-3 pt-2" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:67:13" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
              <div className="flex items-start gap-3" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:68:15" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"  data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:69:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1"/>
                <div data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:70:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                  <h4 className="text-xs font-[number:var(--ut-weight-display)] uppercase font-heading text-foreground" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:71:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#1e8525a612f49fa2" data-ut-source-hash="d5dacd05626c2ed1">Zero Agency Overhead</h4>
                  <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:72:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#8ae11d9effbd1d1a" data-ut-source-hash="d5dacd05626c2ed1">Direct collaboration with senior creative leadership from initial kickoff to final handoff.</p>
                </div>
              </div>
              <div className="flex items-start gap-3" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:75:15" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                <div className="w-2 h-2 rounded-full bg-accent mt-2"  data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:76:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1"/>
                <div data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:77:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
                  <h4 className="text-xs font-[number:var(--ut-weight-display)] uppercase font-heading text-foreground" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:78:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#1e8525a612f49fa2" data-ut-source-hash="d5dacd05626c2ed1">Systematic Design Thinking</h4>
                  <p className="text-xs text-muted-foreground" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:79:19" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#8ae11d9effbd1d1a" data-ut-source-hash="d5dacd05626c2ed1">Every interface is backed by reusable design tokens, component architecture, and dev specs.</p>
                </div>
              </div>
            </div>

            <div className="pt-4" data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:84:13" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#c36d2e0dcf320c09" data-ut-source-hash="d5dacd05626c2ed1">
              <Link
                to="/about"
                data-ut-intent="nav.goto"
                data-ut-path="/about"
                className="btn-secondary py-3 px-6 text-xs font-extrabold uppercase tracking-widest inline-flex items-center gap-2"
                data-intent="nav.goto"
                data-ut-target-page-id="b2edea11-c036-4e95-8c66-088f003cd3cb"
                data-ut-target-id="b2edea11-c036-4e95-8c66-088f003cd3cb"
                data-ut-target-type="page"
                data-ut-ui-action="navigate"
                data-ut-preflight="1"
                data-ut-label="Read Full Studio Story"
              >
                <span data-ut-source-locator="/src/project-components/home/HomeAboutTeaser.tsx:98:17" data-ut-source-ast="/src/project-components/home/HomeAboutTeaser.tsx#64efcd6aca8d38c6" data-ut-source-hash="d5dacd05626c2ed1">Read Full Studio Story</span>
                <ArrowRight className="w-4 h-4 text-primary" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
export default HomeAboutTeaser;