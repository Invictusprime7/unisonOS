/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Navigation = __LucideIcons['Navigation'] || __LucideFallback;
const Home = __LucideIcons['Home'] || __LucideFallback;

const Mail = __LucideIcons['Mail'] || __LucideFallback;
const ArrowRight = __LucideIcons['ArrowRight'] || __LucideIcons['Arrowright'] || __LucideFallback;
const CheckCircle2 = __LucideIcons['CheckCircle2'] || __LucideIcons['Checkcircle2'] || __LucideFallback;
const Globe = __LucideIcons['Globe'] || __LucideFallback;
const Heart = __LucideIcons['Heart'] || __LucideFallback;

export const SiteFooter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <footer
      data-ut-variant="footer:brand-social"
      className="bg-card border-t border-border pt-16 pb-8 text-foreground"
     data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:19:5" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#3f1cdf6d3d03ef51" data-ut-source-hash="ccfc29d149ccbfcd">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:23:7" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-border/60" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:24:9" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:26:11" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
            <div className="flex items-center gap-3" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:27:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
              <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-base" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:28:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
                D
              </div>
              <span className="font-heading font-[number:var(--ut-weight-display)] text-xl tracking-tight text-foreground" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:31:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">
                DREAM. <span className="text-primary font-normal" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:32:24" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Design</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:35:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#31736dde31ddf6da" data-ut-source-hash="ccfc29d149ccbfcd">
              Eman Amanni Studio is a senior UI/UX consultancy architecting cinematic digital product experiences, high-converting interfaces, and scalable design systems for forward-thinking technology brands.
            </p>
            <div className="pt-2" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:38:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
              <a
                href="mailto:eman@dreamdesign.studio"
                data-ut-cta="cta.email"
                data-ut-intent="contact.email"
                className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-primary hover:underline uppercase"
               data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:39:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#863886d14244d515" data-ut-source-hash="ccfc29d149ccbfcd">
                <Mail className="w-4 h-4" />
                <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:46:17" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Email: eman@dreamdesign.studio</span>
              </a>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="md:col-span-3 space-y-3" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:52:11" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
            <h3 className="text-xs font-heading uppercase tracking-widest text-foreground font-[number:var(--ut-weight-display)]" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:53:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#117ae34fdb0eb67b" data-ut-source-hash="ccfc29d149ccbfcd">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:56:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#197c56c3c2360727" data-ut-source-hash="ccfc29d149ccbfcd">
              <li data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:57:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#97487471ac55ed75" data-ut-source-hash="ccfc29d149ccbfcd">
                <Link
                  to="/"
                  data-ut-intent="nav.goto"
                  data-ut-path="/"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                 data-intent="nav.goto" data-ut-target-page-id="f20eab4c-04f8-4912-a946-2362f9022562" data-ut-target-id="f20eab4c-04f8-4912-a946-2362f9022562" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Home">
                  <ArrowRight className="w-3 h-3 text-primary" />
                  <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:65:19" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Home</span>
                </Link>
              </li>
              <li data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:68:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#97487471ac55ed75" data-ut-source-hash="ccfc29d149ccbfcd">
                <Link
                  to="/about"
                  data-ut-intent="nav.goto"
                  data-ut-path="/about"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                 data-intent="nav.goto" data-ut-target-page-id="b2edea11-c036-4e95-8c66-088f003cd3cb" data-ut-target-id="b2edea11-c036-4e95-8c66-088f003cd3cb" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Studio &amp; Biography">
                  <ArrowRight className="w-3 h-3 text-primary" />
                  <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:76:19" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Studio & Biography</span>
                </Link>
              </li>
              <li data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:79:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#97487471ac55ed75" data-ut-source-hash="ccfc29d149ccbfcd">
                <Link
                  to="/work"
                  data-ut-intent="nav.goto"
                  data-ut-path="/work"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                 data-intent="nav.goto" data-ut-target-page-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-id="1a5da236-d10f-4165-b9ed-5ba4b9bca13a" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="Case Studies &amp; Work">
                  <ArrowRight className="w-3 h-3 text-primary" />
                  <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:87:19" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Case Studies & Work</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="md:col-span-4 space-y-4" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:94:11" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
            <h3 className="text-xs font-heading uppercase tracking-widest text-foreground font-[number:var(--ut-weight-display)]" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:95:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#117ae34fdb0eb67b" data-ut-source-hash="ccfc29d149ccbfcd">
              Design Dispatch
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:98:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#31736dde31ddf6da" data-ut-source-hash="ccfc29d149ccbfcd">
              Subscribe to receiving curated case study teardowns, UX insights, and system design frameworks. No spam.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-2" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:102:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#a8e7330413c98300" data-ut-source-hash="ccfc29d149ccbfcd">
              <div className="flex gap-2" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:103:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
                <input
                  type="email"
                  required
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border border-border px-3 py-2 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary flex-1"
                 data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:104:17" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#4ecb080e81637c4a" data-ut-source-hash="ccfc29d149ccbfcd"/>
                <button
                  type="submit"
                  data-ut-cta="cta.newsletter-submit"
                  data-ut-intent="newsletter.subscribe"
                  className="btn-primary py-2 px-4 text-xs font-bold uppercase tracking-wider"
                 data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:112:17" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#e0cce1320bc1a226" data-ut-source-hash="ccfc29d149ccbfcd">
                  <Mail className="w-3.5 h-3.5" />
                  <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:119:19" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Subscribe</span>
                </button>
              </div>
              {subscribed && (
                <p className="text-xs text-primary flex items-center gap-1 mt-1" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:123:17" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#31736dde31ddf6da" data-ut-source-hash="ccfc29d149ccbfcd">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:125:19" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Thank you for subscribing!</span>
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:133:9" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
          <p data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:134:11" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#31736dde31ddf6da" data-ut-source-hash="ccfc29d149ccbfcd">© {new Date().getFullYear()} DREAM. Design by Eman Amanni. All rights reserved.</p>
          <div className="flex items-center gap-6" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:135:11" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#604d604d63cbb4c9" data-ut-source-hash="ccfc29d149ccbfcd">
            <span className="inline-flex items-center gap-1" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:136:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:138:15" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Available Globally</span>
            </span>
            <span className="text-border" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:140:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">|</span>
            <span className="font-mono text-[11px]" data-ut-source-locator="/src/project-components/site/SiteFooter.tsx:141:13" data-ut-source-ast="/src/project-components/site/SiteFooter.tsx#7fb567aa46947186" data-ut-source-hash="ccfc29d149ccbfcd">Cinematic UI/UX Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
export default SiteFooter;
