/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sparkles, ArrowRight } from '../../unison/ui/icons';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Home = __LucideIcons['Home'] || __LucideFallback;
const Navigation = __LucideIcons['Navigation'] || __LucideFallback;

interface SiteNavProps {
  onOpenConsultation?: () => void;
}

export const SiteNav: React.FC<SiteNavProps> = ({ onOpenConsultation }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Studio', href: '/about' },
    { label: 'Work', href: '/work' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header
      data-ut-variant="navbar:floating-pill"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-4 px-4 sm:px-8`}
     data-ut-source-locator="/src/project-components/site/SiteNav.tsx:34:5" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#b82b70833cf303f7" data-ut-source-hash="4a94e4dd7d27c709">
      <div className="max-w-7xl mx-auto flex items-center justify-between" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:38:7" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
        {/* Brand Identity */}
        <Link
          to="/"
          data-ut-intent="nav.goto"
          data-ut-path="/"
          className="group flex items-center gap-3 text-foreground focus:outline-none"
          data-intent="nav.goto" data-ut-target-page-id="f20eab4c-04f8-4912-a946-2362f9022562" data-ut-target-id="f20eab4c-04f8-4912-a946-2362f9022562" data-ut-target-type="page" data-ut-ui-action="navigate" data-ut-preflight="1" data-ut-label="DREAM. Design Eman Amanni Studio">
          <div className="w-10 h-10 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg tracking-wider shadow-lg transition-transform group-hover:scale-105" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:46:11" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
            D
          </div>
          <div className="flex flex-col" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:49:11" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
            <span className="font-heading font-[number:var(--ut-weight-display)] text-base tracking-tight leading-none text-foreground group-hover:text-primary transition-colors" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:50:13" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#91b6cb8ae08e4096" data-ut-source-hash="4a94e4dd7d27c709">
              DREAM. <span className="text-primary font-normal" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:51:22" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#91b6cb8ae08e4096" data-ut-source-hash="4a94e4dd7d27c709">Design</span>
            </span>
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase font-mono mt-0.5" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:53:13" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#91b6cb8ae08e4096" data-ut-source-hash="4a94e4dd7d27c709">
              Eman Amanni Studio
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Pill */}
        <nav className="hidden md:flex items-center gap-1 bg-card/80 backdrop-blur-md border border-border/80 px-4 py-2 rounded-full shadow-2xl" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:60:9" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#062d9153a002daaf" data-ut-source-hash="4a94e4dd7d27c709">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              data-ut-intent="nav.goto"
              data-ut-path={link.href}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                isActive(link.href)
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Action Button & Mobile Toggle */}
        <div className="flex items-center gap-3" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:79:9" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
          <button
            type="button"
            onClick={onOpenConsultation}
            data-ut-intent="booking.create"
            data-ut-slot="navbar.primary-action"
            data-ut-cta="cta.hero-secondary"
            className="hidden sm:inline-flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary border border-primary/30 hover:text-primary-foreground px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm"
           data-ut-source-locator="/src/project-components/site/SiteNav.tsx:80:11" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#930669c31fd12ce7" data-ut-source-hash="4a94e4dd7d27c709">
            <Sparkles className="w-3.5 h-3.5" />
            <span data-ut-source-locator="/src/project-components/site/SiteNav.tsx:89:13" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#91b6cb8ae08e4096" data-ut-source-hash="4a94e4dd7d27c709">Book Consultation</span>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            data-ut-cta="icon.menu"
            data-ut-intent="nav.goto"
            data-ut-path="#mobile-nav"
            className="md:hidden p-2 rounded-md bg-card border border-border text-foreground hover:text-primary transition-colors"
           data-ut-source-locator="/src/project-components/site/SiteNav.tsx:93:11" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#f36726929c3600d6" data-ut-source-hash="4a94e4dd7d27c709">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-4 top-20 bg-card border border-border p-6 rounded-lg shadow-2xl z-50 flex flex-col gap-4 animate-fade-in-up" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:109:9" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
          <div className="flex flex-col gap-2" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:110:11" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                data-ut-intent="nav.goto"
                data-ut-path={link.href}
                className={`px-4 py-3 rounded-md text-sm font-bold uppercase tracking-wider flex items-center justify-between ${
                  isActive(link.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span data-ut-source-locator="/src/project-components/site/SiteNav.tsx:124:17" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#91b6cb8ae08e4096" data-ut-source-hash="4a94e4dd7d27c709">{link.label}</span>
                <ArrowRight className="w-4 h-4 opacity-70" />
              </Link>
            ))}
          </div>
          <div className="pt-4 border-t border-border" data-ut-source-locator="/src/project-components/site/SiteNav.tsx:129:11" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#aee7f92d140242d9" data-ut-source-hash="4a94e4dd7d27c709">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenConsultation) onOpenConsultation();
              }}
              data-ut-intent="booking.create"
              data-ut-slot="navbar.primary-action"
              className="w-full btn-primary py-3 text-xs font-bold uppercase tracking-wider justify-center"
             data-ut-source-locator="/src/project-components/site/SiteNav.tsx:130:13" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#930669c31fd12ce7" data-ut-source-hash="4a94e4dd7d27c709">
              <Sparkles className="w-4 h-4" />
              <span data-ut-source-locator="/src/project-components/site/SiteNav.tsx:141:15" data-ut-source-ast="/src/project-components/site/SiteNav.tsx#91b6cb8ae08e4096" data-ut-source-hash="4a94e4dd7d27c709">Start Your Project</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
export default SiteNav;