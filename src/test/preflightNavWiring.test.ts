import { describe, expect, it } from 'vitest';
import { preflightNavWiring } from '@/services/preflightNavWiring';

function snapshot(pages: Record<string, { title: string; path: string; filePath?: string; isHome?: boolean; pageRole?: string }>) {
  return {
    pageRegistry: {
      homePageId: Object.entries(pages).find(([, p]) => p.isHome)?.[0] ?? Object.keys(pages)[0],
      pages: Object.fromEntries(
        Object.entries(pages).map(([id, p]) => [
          id,
          {
            pageId: id,
            title: p.title,
            path: p.path,
            filePath: p.filePath,
            isHome: !!p.isHome,
            pageType: 'custom',
            pageRole: p.pageRole,
          },
        ]),
      ),
    },
    bindings: {},
  } as any;
}

describe('preflightNavWiring', () => {
  it('binds buttons by label match to known page route', () => {
    const result = preflightNavWiring(
      {
        '/src/pages/Services.tsx':
          'export default function Services() { return <div><button>Contact Us</button><button>Book Now</button></div>; }',
      },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true, filePath: '/src/App.tsx' },
        services: { title: 'Services', path: '/services', filePath: '/src/pages/Services.tsx', pageRole: 'services' },
        contact: { title: 'Contact', path: '/contact', filePath: '/src/pages/Contact.tsx', pageRole: 'contact' },
        booking: { title: 'Book Online', path: '/booking', filePath: '/src/pages/Booking.tsx', pageRole: 'booking' },
      }),
    );

    expect(result.wired).toBe(2);
    const out = result.files['/src/pages/Services.tsx'];
    expect(out).toContain('data-ut-intent="nav.goto"');
    expect(out).toContain('data-ut-target-page-id="contact"');
    expect(out).toContain('data-ut-target-page-id="booking"');
  });

  it('binds anchors by href to known route', () => {
    const result = preflightNavWiring(
      {
        '/src/App.tsx': 'export default function App() { return <a href="/shop">Browse</a>; }',
      },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true, filePath: '/src/App.tsx' },
        shop: { title: 'Shop', path: '/shop', filePath: '/src/pages/Shop.tsx', pageRole: 'shop' },
      }),
    );
    expect(result.wired).toBe(1);
    expect(result.files['/src/App.tsx']).toContain('data-ut-target-page-id="shop"');
  });

  it('leaves elements already carrying data-ut-intent untouched', () => {
    const src = 'export default function P() { return <button data-ut-intent="cart.add">Contact</button>; }';
    const result = preflightNavWiring(
      { '/src/pages/P.tsx': src },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        contact: { title: 'Contact', path: '/contact', pageRole: 'contact' },
      }),
    );
    expect(result.wired).toBe(0);
    expect(result.files['/src/pages/P.tsx']).toBe(src);
  });

  it('completes an existing nav.goto binding that is missing its route payload', () => {
    const result = preflightNavWiring(
      {
        '/src/sections/SiteNavbar.tsx':
          'export default function Nav() { return <a href="#about" data-ut-intent="nav.goto">About</a>; }',
      },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        about: { title: 'About', path: '/about', pageRole: 'about' },
      }),
    );

    expect(result.wired).toBe(1);
    const out = result.files['/src/sections/SiteNavbar.tsx'];
    expect(out.match(/data-ut-intent=/g)).toHaveLength(1);
    expect(out).toContain('data-ut-path="/about"');
    expect(out).toContain('data-ut-target-page-id="about"');
  });

  it('is a no-op when registry has only one page', () => {
    const src = 'export default function P() { return <button>Anything</button>; }';
    const result = preflightNavWiring(
      { '/src/App.tsx': src },
      snapshot({ home: { title: 'Home', path: '/', isHome: true } }),
    );
    expect(result.wired).toBe(0);
    expect(result.files['/src/App.tsx']).toBe(src);
  });

  it('binds custom button-like components (PrimaryButton, NavLinkItem, BookCTA)', () => {
    const src = `export default function P() { return (
      <div>
        <PrimaryButton>Contact</PrimaryButton>
        <NavLinkItem>Services</NavLinkItem>
        <BookCTA>Book Now</BookCTA>
      </div>
    ); }`;
    const result = preflightNavWiring(
      { '/src/pages/P.tsx': src },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        services: { title: 'Services', path: '/services', pageRole: 'services' },
        contact: { title: 'Contact', path: '/contact', pageRole: 'contact' },
        booking: { title: 'Booking', path: '/booking', pageRole: 'booking' },
      }),
    );
    expect(result.wired).toBe(3);
    const out = result.files['/src/pages/P.tsx'];
    expect(out).toContain('data-ut-target-page-id="contact"');
    expect(out).toContain('data-ut-target-page-id="services"');
    expect(out).toContain('data-ut-target-page-id="booking"');
  });

  it('binds wrappers with nested label markup (anchor wrapping spans)', () => {
    const src = `export default function P() { return (
      <a href="/contact"><div><span>Get in touch</span></div></a>
    ); }`;
    const result = preflightNavWiring(
      { '/src/App.tsx': src },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true, filePath: '/src/App.tsx' },
        contact: { title: 'Contact', path: '/contact', pageRole: 'contact' },
      }),
    );
    expect(result.wired).toBe(1);
    expect(result.files['/src/App.tsx']).toContain('data-ut-target-page-id="contact"');
  });

  it('binds divs with role="button" and onClick handlers', () => {
    const src = `export default function P() { return (
      <div>
        <div role="button">Pricing</div>
        <div onClick={() => {}}>About Us</div>
      </div>
    ); }`;
    const result = preflightNavWiring(
      { '/src/pages/P.tsx': src },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        pricing: { title: 'Pricing', path: '/pricing', pageRole: 'pricing' },
        about: { title: 'About', path: '/about', pageRole: 'about' },
      }),
    );
    expect(result.wired).toBe(2);
    const out = result.files['/src/pages/P.tsx'];
    expect(out).toContain('data-ut-target-page-id="pricing"');
    expect(out).toContain('data-ut-target-page-id="about"');
  });

  it('resolves hash-style page route hrefs (#services) to a real page even when the label does not match any alias', () => {
    const result = preflightNavWiring(
      {
        '/src/sections/SiteNavbar.tsx':
          'export default function Nav() { return <a href="#services">Learn More</a>; }',
      },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        services: { title: 'Services', path: '/services', pageRole: 'services' },
      }),
    );
    expect(result.wired).toBe(1);
    const out = result.files['/src/sections/SiteNavbar.tsx'];
    expect(out).toContain('data-ut-intent="nav.goto"');
    expect(out).toContain('data-ut-path="/services"');
    expect(out).toContain('data-ut-target-page-id="services"');
  });

  it('resolves hash-style page route hrefs with a leading slash (#/pricing)', () => {
    const result = preflightNavWiring(
      {
        '/src/sections/SiteNavbar.tsx':
          'export default function Nav() { return <a href="#/pricing">See Plans</a>; }',
      },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        pricing: { title: 'Pricing', path: '/pricing', pageRole: 'pricing' },
      }),
    );
    expect(result.wired).toBe(1);
    expect(result.files['/src/sections/SiteNavbar.tsx']).toContain('data-ut-target-page-id="pricing"');
  });

  it('leaves genuine same-page anchors (no matching page) unwired', () => {
    const src = 'export default function P() { return <a href="#newsletter-signup">Learn More</a>; }';
    const result = preflightNavWiring(
      { '/src/App.tsx': src },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        services: { title: 'Services', path: '/services', pageRole: 'services' },
      }),
    );
    expect(result.wired).toBe(0);
    expect(result.files['/src/App.tsx']).toBe(src);
  });

  it('leaves a bare "#" placeholder href untouched', () => {
    const src = 'export default function P() { return <a href="#">Learn More</a>; }';
    const result = preflightNavWiring(
      { '/src/App.tsx': src },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true },
        services: { title: 'Services', path: '/services', pageRole: 'services' },
      }),
    );
    expect(result.wired).toBe(0);
    expect(result.files['/src/App.tsx']).toBe(src);
  });

  it('uses shared action affinity for case-study and portfolio CTAs', () => {
    const result = preflightNavWiring(
      {
        '/src/pages/Home.tsx': `export default function Home(){return <main>
          <button>View Case Study</button><a href="#">View Portfolio</a>
        </main>}`,
      },
      snapshot({
        home: { title: 'Home', path: '/', isHome: true, filePath: '/src/pages/Home.tsx' },
        cases: { title: 'Case Studies', path: '/case-studies', pageRole: 'custom' },
        work: { title: 'Portfolio', path: '/work', pageRole: 'gallery' },
      }),
    );

    expect(result.wired).toBe(2);
    const out = result.files['/src/pages/Home.tsx'];
    expect(out).toContain('data-ut-target-page-id="cases"');
    expect(out).toContain('data-ut-target-page-id="work"');
  });
});
