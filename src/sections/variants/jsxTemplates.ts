/**
 * Variant JSX Templates
 * 
 * JSX/TSX source string renderers for each variant layout.
 * These produce React JSX source code that replaces existing section blocks
 * in the VFS App.tsx, consistent with the LauncherWizard React pipeline.
 *
 * All templates use Tailwind CSS classes and produce valid JSX
 * (className instead of class, self-closing tags, etc.).
 */

import type { ExtractedSectionContent } from './types';

// ============================================================================
// Helpers
// ============================================================================

function esc(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
}

function renderButtons(
  buttons: ExtractedSectionContent['ctaButtons'],
  primaryCls: string,
  secondaryCls: string,
): string {
  if (!buttons?.length) return '';
  return buttons.map((btn, i) => {
    const cls = (i === 0 || btn.isPrimary) ? primaryCls : secondaryCls;
    return `              <a href="${btn.href}" className="${cls}">${esc(btn.text)}</a>`;
  }).join('\n');
}

function renderLinks(links: ExtractedSectionContent['navLinks'], cls: string): string {
  if (!links?.length) return '';
  return links.map(link =>
    `              <a href="${link.href}" className="${cls}">${esc(link.text)}</a>`
  ).join('\n');
}

// ============================================================================
// Hero Variants
// ============================================================================

export function heroCenteredJSX(c: ExtractedSectionContent): string {
  return `      <section className="relative isolate overflow-hidden bg-background py-20 md:py-28" data-variant="hero:centered">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-80 bg-[radial-gradient(35%_80%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
${c.badge ? `          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `          <h1 className="mb-6 text-balance font-serif text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `          <p className="mx-auto mb-9 max-w-2xl font-sans text-lg leading-relaxed text-muted-foreground md:text-xl">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `          <div className="flex flex-wrap justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center rounded-[var(--radius)] bg-primary px-6 py-3 font-sans font-medium text-primary-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5', 'inline-flex items-center rounded-[var(--radius)] border border-border px-6 py-3 font-sans font-medium text-foreground motion-safe:transition-colors hover:bg-muted')}
          </div>\n` : ''}\
${c.imageSrc ? `          <div className="mt-12"><img src="${c.imageSrc}" alt="${esc(c.imageAlt || '')}" className="mx-auto w-full max-w-3xl rounded-[var(--radius)] shadow-lg" /></div>\n` : ''}\
        </div>
      </section>`;
}

export function heroSplitImageJSX(c: ExtractedSectionContent): string {
  return `      <section className="relative overflow-hidden bg-background py-20 md:py-28" data-variant="hero:split-image">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 md:grid-cols-2">
          <div className="flex flex-col gap-6">
${c.badge ? `            <span className="inline-flex w-fit items-center rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-foreground">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `            <h1 className="max-w-xl font-serif text-3xl font-bold leading-[1.05] tracking-tighter text-foreground md:text-4xl lg:text-5xl">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `            <p className="max-w-md font-sans text-xl leading-relaxed tracking-tight text-muted-foreground">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `            <div className="flex flex-wrap gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center rounded-[var(--radius)] bg-primary px-6 py-3 font-sans font-medium text-primary-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5', 'inline-flex items-center rounded-[var(--radius)] border border-border px-6 py-3 font-sans font-medium text-foreground motion-safe:transition-colors hover:bg-muted')}
            </div>\n` : ''}\
          </div>
          <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius)] bg-muted">
${c.imageSrc
    ? `            <img src="${c.imageSrc}" alt="${esc(c.imageAlt || '')}" className="h-full w-full object-cover" />`
    : ''
}
          </div>
        </div>
      </section>`;
}

export function heroFullBleedJSX(c: ExtractedSectionContent): string {
  const bgStyle = c.imageSrc
    ? `{{ backgroundImage: "url('${c.imageSrc}')", backgroundSize: "cover", backgroundPosition: "center" }}`
    : `{{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))" }}`;
  return `      <section className="relative isolate flex min-h-[var(--ut-hero-block)] items-center justify-center overflow-hidden" data-variant="hero:full-bleed" style={${bgStyle}}>
        <div aria-hidden="true" className="absolute inset-0 bg-foreground/55" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center">
${c.badge ? `          <span className="mb-4 inline-block rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary-foreground backdrop-blur-sm">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `          <h1 className="mb-6 text-balance font-serif text-4xl font-bold leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `          <p className="mx-auto mb-9 max-w-2xl font-sans text-lg leading-relaxed text-primary-foreground/80 md:text-xl">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `          <div className="flex flex-wrap justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center rounded-[var(--radius)] bg-primary-foreground px-6 py-3 font-sans font-semibold text-primary motion-safe:transition-transform motion-safe:hover:-translate-y-0.5', 'inline-flex items-center rounded-[var(--radius)] border border-primary-foreground/30 px-6 py-3 font-sans font-medium text-primary-foreground backdrop-blur-sm motion-safe:transition-colors')}
          </div>\n` : ''}\
        </div>
      </section>`;
}

// ============================================================================
// CTA Variants
// ============================================================================

export function ctaCenteredJSX(c: ExtractedSectionContent): string {
  return `      <section className="py-16 md:py-24 bg-gray-50" data-variant="cta:centered">
        <div className="max-w-3xl mx-auto px-4 text-center">
${c.heading ? `          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `          <p className="text-lg text-gray-600 mb-8 leading-relaxed">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `          <div className="flex gap-3 justify-center flex-wrap">
${renderButtons(c.ctaButtons, 'inline-block px-8 py-3.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm', 'inline-block px-8 py-3.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-white transition-colors')}
          </div>\n` : ''}\
        </div>
      </section>`;
}

export function ctaGradientBannerJSX(c: ExtractedSectionContent): string {
  return `      <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" data-variant="cta:gradient-banner">
        <div className="max-w-4xl mx-auto px-4 text-center">
${c.heading ? `          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-sm">${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `          <p className="text-lg text-white/85 mb-8 max-w-2xl mx-auto leading-relaxed">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `          <div className="flex gap-3 justify-center flex-wrap">
${renderButtons(c.ctaButtons, 'inline-block px-8 py-3.5 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-gray-100 transition-colors shadow-lg', 'inline-block px-8 py-3.5 rounded-lg border-2 border-white/40 text-white font-medium hover:bg-white/10 transition-colors')}
          </div>\n` : ''}\
        </div>
      </section>`;
}

export function ctaSplitCardJSX(c: ExtractedSectionContent): string {
  return `      <section className="py-16 md:py-24 bg-white" data-variant="cta:split-card">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 md:p-12 grid grid-cols-1 md:grid-cols-5 gap-8 items-center shadow-xl">
            <div className="md:col-span-3">
${c.heading ? `              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `              <p className="text-gray-400 leading-relaxed">${esc(c.subheading)}</p>\n` : ''}\
            </div>
            <div className="md:col-span-2 flex flex-col gap-3 items-start md:items-end">
${c.ctaButtons?.length ? renderButtons(
  c.ctaButtons,
  'inline-block px-8 py-3.5 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-400 transition-colors shadow-lg w-full md:w-auto text-center',
  'inline-block px-8 py-3.5 rounded-lg border border-gray-600 text-gray-300 font-medium hover:bg-gray-700 transition-colors w-full md:w-auto text-center'
) : ''}
            </div>
          </div>
        </div>
      </section>`;
}

// ============================================================================
// Navbar Variants
// ============================================================================

export function navbarStandardJSX(c: ExtractedSectionContent): string {
  const brand = c.brandName || 'Brand';
  const navLinks = c.navLinks || [];
  const ctaButton = c.ctaButtons?.[0];

  return `      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md" data-variant="navbar:standard">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-stretch justify-between border-y border-border">
            <a href="#/" className="flex items-center py-4 text-lg font-semibold tracking-tight text-foreground">${esc(brand)}</a>
            <nav aria-label="Main navigation" className="hidden items-stretch md:flex">
${renderLinks(navLinks, 'flex items-center border-l border-border px-4 text-sm font-medium text-foreground motion-safe:transition-colors hover:opacity-80')}
${ctaButton ? `              <span className="flex items-center border-l border-border pl-4"><a href="${ctaButton.href}" className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">${esc(ctaButton.text)}</a></span>\n` : ''}\
            </nav>
          </div>
        </div>
      </header>`;
}

export function navbarCenteredLogoJSX(c: ExtractedSectionContent): string {
  const brand = c.brandName || 'Brand';
  const navLinks = c.navLinks || [];
  const ctaButton = c.ctaButtons?.[0];

  return `      <header className="sticky top-0 z-50 w-full px-2 pt-2" data-variant="navbar:centered-logo">
        <div className="mx-auto max-w-6xl rounded-2xl border border-border/60 bg-background/70 px-6 backdrop-blur-lg">
          <div className="relative flex items-center justify-between py-3">
            <a href="#/" aria-label="Home" className="text-xl font-semibold tracking-tight text-foreground">${esc(brand)}</a>
            <nav aria-label="Main navigation" className="absolute inset-0 m-auto hidden size-fit md:block">
              <ul className="flex gap-8 text-sm">
${renderLinks(navLinks, 'block text-muted-foreground motion-safe:duration-150 hover:opacity-80')}
              </ul>
            </nav>
${ctaButton ? `            <a href="${ctaButton.href}" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">${esc(ctaButton.text)}</a>\n` : ''}\
          </div>
        </div>
      </header>`;
}

export function navbarMinimalDarkJSX(c: ExtractedSectionContent): string {
  const brand = c.brandName || 'Brand';
  const navLinks = c.navLinks || [];
  const ctaButton = c.ctaButtons?.[0];

  return `      <header className="sticky top-0 z-50 border-b border-background/10 bg-foreground/95 backdrop-blur-md" data-variant="navbar:minimal-dark">
        <div className="mx-auto grid min-h-16 max-w-6xl grid-cols-3 items-center gap-4 px-6">
          <nav aria-label="Main navigation" className="hidden items-center justify-start gap-6 md:flex">
${renderLinks(navLinks, 'text-sm text-background/70 motion-safe:transition-colors hover:text-background')}
          </nav>
          <a href="#/" className="justify-self-center text-base font-semibold tracking-tight text-background">${esc(brand)}</a>
          <div className="flex items-center justify-end gap-4 border-l border-background/10 py-3 pl-6">
${ctaButton ? `            <a href="${ctaButton.href}" className="rounded-[var(--radius)] bg-primary px-5 py-1.5 text-sm font-medium text-primary-foreground motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">${esc(ctaButton.text)}</a>\n` : ''}\
          </div>
        </div>
      </header>`;
}

// ============================================================================
// Features Variants
// ============================================================================

export function featuresGridJSX(c: ExtractedSectionContent): string {
  const items = c.listItems || [];
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.background) }} data-variant="features:grid">
        <div style={{ ...containerStyle }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
${items.map((item, i) => `            <div style={{ padding: '1.5rem', background: hsl(THEME.colors.card), border: \`1px solid \${hsla(THEME.colors.border, 0.6)}\`, borderRadius: THEME.radius }}>
              <h3 style={{ ...headingStyle, fontSize: '1.125rem', marginBottom: '0.5rem' }}>${esc(item)}</h3>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`;
}

export function featuresIconLeftJSX(c: ExtractedSectionContent): string {
  const items = c.listItems || [];
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.background) }} data-variant="features:icon-left">
        <div style={{ ...containerStyle }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '48rem', margin: '0 auto' }}>
${items.map((item, i) => `            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: '3rem', height: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.75rem', background: hsla(THEME.colors.primary, 0.1), color: hsl(THEME.colors.primary), fontSize: '1.25rem' }}>✦</div>
              <div>
                <h3 style={{ ...headingStyle, fontSize: '1.125rem', marginBottom: '0.25rem' }}>${esc(item)}</h3>
              </div>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`;
}

export function featuresMinimalCenteredJSX(c: ExtractedSectionContent): string {
  const items = c.listItems || [];
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.muted) }} data-variant="features:minimal-centered">
        <div style={{ ...containerStyle }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem', textAlign: 'center' }}>
${items.map((item, i) => `            <div>
              <div style={{ margin: '0 auto', width: '3.5rem', height: '3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', borderRadius: '9999px', marginBottom: '1rem', background: hsla(THEME.colors.primary, 0.08), color: hsl(THEME.colors.primary) }}>✦</div>
              <h3 style={{ ...headingStyle, fontSize: '1.125rem', marginBottom: '0.5rem' }}>${esc(item)}</h3>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`;
}

// ============================================================================
// Services Variants
// ============================================================================

export function servicesCardGridJSX(c: ExtractedSectionContent): string {
  const items = c.listItems || [];
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.background) }} data-variant="services:card-grid">
        <div style={{ ...containerStyle }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
${items.map((item, i) => `            <div style={{ padding: '1.5rem', background: hsl(THEME.colors.card), border: \`1px solid \${hsla(THEME.colors.border, 0.6)}\`, borderRadius: THEME.radius }}>
              <h3 style={{ ...headingStyle, fontSize: '1.125rem', marginBottom: '0.5rem' }}>${esc(item)}</h3>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`;
}

export function servicesAlternatingJSX(c: ExtractedSectionContent): string {
  const items = c.listItems || [];
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.background) }} data-variant="services:alternating">
        <div style={{ ...containerStyle }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
${items.map((item, i) => `            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center'${i % 2 !== 0 ? ", direction: 'rtl'" : ''} }}>
              <div${i % 2 !== 0 ? " style={{ direction: 'ltr' }}" : ''}>
                <h3 style={{ ...headingStyle, fontSize: '1.5rem', marginBottom: '0.75rem' }}>${esc(item)}</h3>
              </div>
              <div style={{${i % 2 !== 0 ? " direction: 'ltr'," : ''} aspectRatio: '4/3', borderRadius: THEME.radius, background: \`linear-gradient(135deg, \${hsla(THEME.colors.primary, 0.08)}, \${hsla(THEME.colors.secondary, 0.08)})\`, border: \`1px solid \${hsla(THEME.colors.border, 0.4)}\` }} />
            </div>`).join('\n')}
          </div>
        </div>
      </section>`;
}

export function servicesCompactListJSX(c: ExtractedSectionContent): string {
  const items = c.listItems || [];
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.muted) }} data-variant="services:compact-list">
        <div style={{ ...containerStyle, maxWidth: '56rem' }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, fontSize: '1rem', maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
${items.map((item, i) => `            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem', background: hsl(THEME.colors.card), border: \`1px solid \${hsla(THEME.colors.border, 0.5)}\`, borderRadius: THEME.radius }}>
              <div style={{ flexShrink: 0, width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem', background: hsla(THEME.colors.primary, 0.1), color: hsl(THEME.colors.primary), fontSize: '1.125rem' }}>●</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ ...headingStyle, fontSize: '1rem', marginBottom: '0.125rem' }}>${esc(item)}</h3>
              </div>
            </div>`).join('\n')}
          </div>
        </div>
      </section>`;
}

// ============================================================================
// Contact Variants
// ============================================================================

export function contactCenteredJSX(c: ExtractedSectionContent): string {
  const inputStr = `style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: THEME.radius, border: \`1px solid \${hsla(THEME.colors.border, 0.8)}\`, background: hsl(THEME.colors.card), color: hsl(THEME.colors.cardForeground), fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', outline: 'none' }}`;
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.muted) }} data-variant="contact:centered">
        <div style={{ ...containerStyle, maxWidth: '40rem' }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <form data-demo-form="true" data-ut-intent="contact.submit" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input type="text" placeholder="Your name" ${inputStr} />
            <input type="email" placeholder="your@email.com" ${inputStr} />
            <textarea placeholder="How can we help?" rows={4} ${inputStr} />
            <button type="submit" style={{ width: '100%', padding: '0.75rem', border: 'none', borderRadius: THEME.radius, background: hsl(THEME.colors.primary), color: hsl(THEME.colors.primaryForeground), fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>Send Message</button>
          </form>
        </div>
      </section>`;
}

export function contactSplitCardJSX(c: ExtractedSectionContent): string {
  const inputStr = `style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: THEME.radius, border: \`1px solid \${hsla(THEME.colors.border, 0.8)}\`, background: hsl(THEME.colors.background), color: hsl(THEME.colors.foreground), fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', outline: 'none' }}`;
  return `      <section style={{ ...sectionPad, background: hsl(THEME.colors.background) }} data-variant="contact:split-card">
        <div style={{ ...containerStyle, maxWidth: '56rem' }}>
${c.heading ? `          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>
${c.subheading ? `            <p style={{ ...bodyStyle, maxWidth: '32rem', margin: '0 auto' }}>${esc(c.subheading)}</p>\n` : ''}\
          </div>\n` : ''}\
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
            <form data-demo-form="true" data-ut-intent="contact.submit" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" placeholder="Your name" ${inputStr} />
              <input type="email" placeholder="your@email.com" ${inputStr} />
              <textarea placeholder="Your message..." rows={5} ${inputStr} />
              <button type="submit" style={{ width: '100%', padding: '0.75rem', border: 'none', borderRadius: THEME.radius, background: hsl(THEME.colors.primary), color: hsl(THEME.colors.primaryForeground), fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>Send Message</button>
            </form>
            <div style={{ padding: '2rem', background: hsl(THEME.colors.card), border: \`1px solid \${hsla(THEME.colors.border, 0.6)}\`, borderRadius: THEME.radius, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ ...headingStyle, fontSize: '1.125rem' }}>Get in Touch</h3>
${c.listItems?.map(info => `              <p style={{ ...bodyStyle, fontSize: '0.875rem' }}>${esc(info)}</p>`).join('\n') || ''}
            </div>
          </div>
        </div>
      </section>`;
}

export function contactMinimalInlineJSX(c: ExtractedSectionContent): string {
  const inputStr = `style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: THEME.radius, border: \`1px solid \${hsla(THEME.colors.border, 0.8)}\`, background: hsl(THEME.colors.card), color: hsl(THEME.colors.cardForeground), fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', outline: 'none' }}`;
  return `      <section style={{ ...sectionPad, background: \`linear-gradient(135deg, \${hsla(THEME.colors.primary, 0.04)}, \${hsla(THEME.colors.secondary, 0.04)})\` }} data-variant="contact:minimal-inline">
        <div style={{ ...containerStyle, maxWidth: '48rem', textAlign: 'center' }}>
${c.heading ? `          <h2 style={{ ...headingStyle, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.75rem' }}>${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `          <p style={{ ...bodyStyle, marginBottom: '2rem', maxWidth: '28rem', margin: '0 auto 2rem' }}>${esc(c.subheading)}</p>\n` : ''}\
          <form data-demo-form="true" data-ut-intent="contact.submit" style={{ display: 'flex', gap: '0.75rem', maxWidth: '36rem', margin: '0 auto 1.5rem' }}>
            <input type="email" placeholder="your@email.com" ${inputStr} />
            <input type="text" placeholder="Message" ${inputStr} />
            <button type="submit" style={{ flexShrink: 0, padding: '0.65rem 1.5rem', border: 'none', borderRadius: THEME.radius, background: hsl(THEME.colors.primary), color: hsl(THEME.colors.primaryForeground), fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>Send</button>
          </form>
${c.listItems?.length ? `          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
${c.listItems.map(info => `            <span style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: '9999px', background: hsl(THEME.colors.card), color: hsl(THEME.colors.mutedForeground), border: \`1px solid \${hsla(THEME.colors.border, 0.5)}\` }}>${esc(info)}</span>`).join('\n')}
          </div>\n` : ''}\
        </div>
      </section>`;
}

// ============================================================================
// Footer Variants
// ============================================================================

export function footerColumnsJSX(c: ExtractedSectionContent): string {
  const brand = c.brandName || 'Brand';
  const navLinks = c.navLinks || [];
  return `      <footer style={{ paddingTop: '3rem', paddingBottom: '1.5rem', background: hsl(THEME.colors.card), borderTop: \`1px solid \${hsla(THEME.colors.border, 0.5)}\` }} data-variant="footer:columns">
        <div style={{ ...containerStyle }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ ...headingStyle, fontSize: '1.125rem', marginBottom: '0.75rem' }}>${esc(brand)}</h3>
            </div>
            <div>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', color: hsl(THEME.colors.cardForeground), marginBottom: '0.75rem' }}>Links</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
${navLinks.map(link => `                <a href="${link.href}" style={{ ...bodyStyle, fontSize: '0.875rem', textDecoration: 'none', color: hsl(THEME.colors.mutedForeground) }}>${esc(link.text)}</a>`).join('\n')}
              </div>
            </div>
          </div>
          <div style={{ borderTop: \`1px solid \${hsla(THEME.colors.border, 0.3)}\`, paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: hsl(THEME.colors.mutedForeground) }}>© ${new Date().getFullYear()} ${esc(brand)}. All rights reserved.</p>
          </div>
        </div>
      </footer>`;
}

export function footerCenteredMinimalJSX(c: ExtractedSectionContent): string {
  const brand = c.brandName || 'Brand';
  const navLinks = c.navLinks || [];
  return `      <footer style={{ padding: '2.5rem 1rem', background: hsl(THEME.colors.background), borderTop: \`1px solid \${hsla(THEME.colors.border, 0.4)}\`, textAlign: 'center' }} data-variant="footer:centered-minimal">
        <div style={{ ...containerStyle }}>
          <h3 style={{ ...headingStyle, fontSize: '1.125rem', marginBottom: '1rem' }}>${esc(brand)}</h3>
${navLinks.length ? `          <nav style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
${navLinks.map(link => `            <a href="${link.href}" style={{ ...bodyStyle, fontSize: '0.875rem', textDecoration: 'none', color: hsl(THEME.colors.mutedForeground) }}>${esc(link.text)}</a>`).join('\n')}
          </nav>\n` : ''}\
          <p style={{ fontSize: '0.75rem', color: hsl(THEME.colors.mutedForeground) }}>© ${new Date().getFullYear()} ${esc(brand)}. All rights reserved.</p>
        </div>
      </footer>`;
}

export function footerDarkBandJSX(c: ExtractedSectionContent): string {
  const brand = c.brandName || 'Brand';
  const navLinks = c.navLinks || [];
  return `      <footer style={{ paddingTop: '3.5rem', paddingBottom: '1.5rem', background: hsl(THEME.colors.foreground), color: hsl(THEME.colors.background) }} data-variant="footer:dark-band">
        <div style={{ ...containerStyle }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '2rem', marginBottom: '2.5rem' }}>
            <div>
              <h3 style={{ fontFamily: THEME.typography.headingFont, fontWeight: THEME.typography.headingWeight, fontSize: '1.25rem', marginBottom: '0.5rem' }}>${esc(brand)}</h3>
            </div>
            <div>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem' }}>Links</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
${navLinks.map(link => `                <a href="${link.href}" style={{ fontFamily: THEME.typography.bodyFont, fontSize: '0.875rem', textDecoration: 'none', color: 'rgba(255,255,255,0.5)' }}>${esc(link.text)}</a>`).join('\n')}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>© ${new Date().getFullYear()} ${esc(brand)}. All rights reserved.</p>
          </div>
        </div>
      </footer>`;
}

// ============================================================================
// Gallery Variants (Recovery Phase 4 — premium proof family)
// ============================================================================

function galleryTiles(c: ExtractedSectionContent, count: number): Array<{ src: string; caption: string }> {
  const captions = c.listItems?.length ? c.listItems : [];
  const base = c.imageSrc || '/placeholder.svg';
  return Array.from({ length: Math.max(count, captions.length || count) }, (_, i) => ({
    src: base,
    caption: captions[i] || '',
  }));
}

function galleryIntro(c: ExtractedSectionContent): string {
  if (!c.heading && !c.subheading) return '';
  return `          <div className="mb-12 text-center">
${c.heading ? `            <h2 className="mb-3 text-3xl font-semibold text-foreground">${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `            <p className="mx-auto max-w-xl text-base text-muted-foreground">${esc(c.subheading)}</p>\n` : ''}\
          </div>\n`;
}

function galleryFigure(tile: { src: string; caption: string }, cls: string, aspect: string): string {
  return `            <figure className="group relative m-0 overflow-hidden rounded-[var(--radius)] border border-border bg-muted ${cls}" style={{ aspectRatio: '${aspect}' }}>
              <img src="${tile.src}" alt="${esc(tile.caption)}" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-105" />
${tile.caption ? `              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent p-4 text-sm text-background opacity-0 transition-opacity group-hover:opacity-100">${esc(tile.caption)}</figcaption>\n` : ''}\
            </figure>`;
}

function galleryShell(variant: string, c: ExtractedSectionContent, grid: string): string {
  return `      <section className="bg-background py-20 md:py-24" data-variant="${variant}">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
${galleryIntro(c)}\
${grid}
        </div>
      </section>`;
}

export function galleryEditorialMosaicJSX(c: ExtractedSectionContent): string {
  const tiles = galleryTiles(c, 6);
  const grid = `          <div className="grid auto-rows-[var(--ut-tile-block)] grid-cols-2 gap-4 lg:grid-cols-4">
${tiles.map((t, i) => galleryFigure(t, i % 5 === 0 ? 'col-span-2 row-span-2' : i % 7 === 3 ? 'col-span-2' : '', 'auto')).join('\n')}
          </div>`;
  return galleryShell('gallery:editorial-mosaic', c, grid);
}

export function galleryMasonryJSX(c: ExtractedSectionContent): string {
  const tiles = galleryTiles(c, 6);
  const grid = `          <div style={{ columnCount: 3, columnGap: '1rem' }}>
${tiles.map((t, i) => `            <div className="mb-4 break-inside-avoid">\n${galleryFigure(t, '', i % 3 === 0 ? '3 / 4' : i % 3 === 1 ? '1 / 1' : '4 / 5')}\n            </div>`).join('\n')}
          </div>`;
  return galleryShell('gallery:masonry', c, grid);
}

export function galleryCinematicGridJSX(c: ExtractedSectionContent): string {
  const tiles = galleryTiles(c, 6);
  const grid = `          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
${tiles.map((t) => galleryFigure(t, '', '16 / 9')).join('\n')}
          </div>`;
  return galleryShell('gallery:cinematic-grid', c, grid);
}

export function galleryLightboxGridJSX(c: ExtractedSectionContent): string {
  const tiles = galleryTiles(c, 6);
  const grid = `          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
${tiles.map((t) => galleryFigure(t, 'cursor-zoom-in', '1 / 1')).join('\n')}
          </div>`;
  return galleryShell('gallery:lightbox-grid', c, grid);
}

export function galleryHorizontalReelJSX(c: ExtractedSectionContent): string {
  const tiles = galleryTiles(c, 6);
  const grid = `          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
${tiles.map((t) => `            <div className="w-[78%] flex-none snap-start sm:w-[46%] lg:w-[32%]">\n${galleryFigure(t, '', '4 / 5')}\n            </div>`).join('\n')}
          </div>`;
  return galleryShell('gallery:horizontal-reel', c, grid);
}

export function galleryFeatureSplitJSX(c: ExtractedSectionContent): string {
  const [feature, ...rest] = galleryTiles(c, 5);
  const grid = `          <div className="grid gap-4 lg:grid-cols-2">
${galleryFigure(feature, '', '4 / 5')}
            <div className="grid grid-cols-2 gap-4 self-start">
${rest.map((t) => galleryFigure(t, '', '1 / 1')).join('\n')}
            </div>
          </div>`;
  return galleryShell('gallery:feature-split', c, grid);
}

// ============================================================================
// Testimonials + Pricing Variants (Recovery Phase 3 — first-class families)
// ============================================================================

function proofIntro(c: ExtractedSectionContent): string {
  if (!c.heading && !c.subheading) return '';
  return `          <div className="mb-12 text-center">
${c.heading ? `            <h2 className="mb-3 text-3xl font-semibold text-foreground">${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `            <p className="mx-auto max-w-2xl text-base text-muted-foreground">${esc(c.subheading)}</p>\n` : ''}\
          </div>\n`;
}

function proofShell(variant: string, c: ExtractedSectionContent, body: string, surface = 'bg-background'): string {
  return `      <section className="${surface} py-20 md:py-24" data-variant="${variant}">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
${proofIntro(c)}\
${body}
        </div>
      </section>`;
}

function proofQuotes(c: ExtractedSectionContent, count: number): string[] {
  const quotes = c.listItems?.length ? c.listItems : [];
  return Array.from({ length: Math.max(count, quotes.length || count) }, (_, i) => quotes[i] || 'They delivered exactly what we needed, on time.');
}

function quoteCard(text: string, cls = ''): string {
  return `            <figure className="m-0 flex h-full flex-col justify-between rounded-[var(--radius)] border border-border bg-card p-8 text-card-foreground ${cls}">
              <blockquote className="mb-6 text-base leading-relaxed">&ldquo;${esc(text)}&rdquo;</blockquote>
              <figcaption className="text-sm font-semibold">Verified client</figcaption>
            </figure>`;
}

export function testimonialsGridJSX(c: ExtractedSectionContent): string {
  const quotes = proofQuotes(c, 3);
  const body = `          <div className="grid gap-6 md:grid-cols-3">
${quotes.map((q) => quoteCard(q)).join('\n')}
          </div>`;
  return proofShell('testimonials:grid', c, body);
}

export function testimonialsRailJSX(c: ExtractedSectionContent): string {
  const quotes = proofQuotes(c, 4);
  const body = `          <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4" role="group" aria-label="Customer testimonials">
${quotes.map((q) => quoteCard(q, 'w-[var(--ut-carousel-card)] shrink-0 snap-start')).join('\n')}
          </div>`;
  return proofShell('testimonials:rail', c, body);
}

export function testimonialsSpotlightJSX(c: ExtractedSectionContent): string {
  const [featured, ...rest] = proofQuotes(c, 3);
  const body = `          <figure className="mx-auto m-0 max-w-3xl rounded-[var(--radius)] border border-border bg-card p-10 text-center text-card-foreground">
            <blockquote className="mb-6 text-2xl font-semibold leading-relaxed">&ldquo;${esc(featured)}&rdquo;</blockquote>
            <figcaption className="text-sm font-semibold">Verified client</figcaption>
          </figure>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
${rest.map((q) => quoteCard(q)).join('\n')}
          </div>`;
  return proofShell('testimonials:spotlight', c, body, 'bg-muted');
}

function pricingPlans(c: ExtractedSectionContent): Array<{ name: string; price: string; features: string[] }> {
  const names = ['Starter', 'Professional', 'Premium'];
  const features = c.listItems?.length ? c.listItems : ['Dedicated support', 'Fast turnaround', 'Transparent pricing'];
  return names.map((name, i) => ({
    name,
    price: `$${(i + 1) * 99}`,
    features: features.slice(0, 3 + i),
  }));
}

function planCta(c: ExtractedSectionContent): { label: string; href: string } {
  const cta = c.ctaButtons?.[0];
  return { label: cta?.text || 'Get started', href: cta?.href || '#contact' };
}

export function pricingTiersJSX(c: ExtractedSectionContent): string {
  const plans = pricingPlans(c);
  const cta = planCta(c);
  const body = `          <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
${plans.map((plan, i) => `            <article className="flex h-full flex-col rounded-[var(--radius)] border ${i === 1 ? 'border-primary' : 'border-border'} bg-card p-8 text-card-foreground">
              <h3 className="text-lg font-semibold">${esc(plan.name)}</h3>
              <p className="mt-2 text-3xl font-semibold">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <ul className="mt-6 flex-1 list-none space-y-2 p-0 text-sm">
${plan.features.map((f) => `                <li>✓ ${esc(f)}</li>`).join('\n')}
              </ul>
              <a href="${cta.href}" data-ut-intent="lead.capture" className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline">${esc(cta.label)}</a>
            </article>`).join('\n')}
          </div>`;
  return proofShell('pricing:tiers', c, body, 'bg-muted');
}

export function pricingComparisonJSX(c: ExtractedSectionContent): string {
  const plans = pricingPlans(c);
  const rows = Array.from(new Set(plans.flatMap((p) => p.features)));
  const body = `          <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm text-card-foreground">
              <caption className="sr-only">Plan comparison</caption>
              <thead>
                <tr>
                  <th scope="col" className="p-4">Features</th>
${plans.map((p) => `                  <th scope="col" className="p-4">${esc(p.name)}<span className="block text-base font-semibold">${p.price}</span></th>`).join('\n')}
                </tr>
              </thead>
              <tbody>
${rows.map((row) => `                <tr className="border-t border-border">
                  <th scope="row" className="p-4 font-normal">${esc(row)}</th>
${plans.map((p) => `                  <td className="p-4">${p.features.includes(row) ? '✓' : '—'}</td>`).join('\n')}
                </tr>`).join('\n')}
              </tbody>
            </table>
          </div>`;
  return proofShell('pricing:comparison', c, body, 'bg-muted');
}

export function pricingAccordionJSX(c: ExtractedSectionContent): string {
  const plans = pricingPlans(c);
  const cta = planCta(c);
  const body = `          <div className="mx-auto max-w-3xl">
${plans.map((plan) => `            <details className="mb-3 rounded-[var(--radius)] border border-border bg-card p-5 text-card-foreground">
              <summary className="flex cursor-pointer items-center justify-between text-base font-semibold">${esc(plan.name)}<span>${plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span></span></summary>
              <ul className="mt-4 list-none space-y-2 p-0 text-sm">
${plan.features.map((f) => `                <li>✓ ${esc(f)}</li>`).join('\n')}
              </ul>
              <a href="${cta.href}" data-ut-intent="lead.capture" className="mt-5 inline-flex w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline">${esc(cta.label)}</a>
            </details>`).join('\n')}
          </div>`;
  return proofShell('pricing:accordion', c, body, 'bg-muted');
}

// ============================================================================
// About / FAQ / Stats / Team Variants (Phase 4 — premium inventory)
// ============================================================================

function sectionShell(variant: string, c: ExtractedSectionContent, body: string, surface = 'bg-background'): string {
  return proofShell(variant, c, body, surface);
}

function aboutParagraphsFrom(c: ExtractedSectionContent): string[] {
  const parts = [c.subheading, ...(c.listItems || [])].filter(Boolean) as string[];
  return parts.length ? parts : ['We build every engagement around clear outcomes, honest timelines and craft you can see.'];
}

function aboutCta(c: ExtractedSectionContent): string {
  const cta = c.ctaButtons?.[0];
  if (!cta) return '';
  return `\n            <a href="${cta.href}" className="mt-6 inline-block rounded-[var(--radius)] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">${esc(cta.text)}</a>`;
}

function aboutMedia(c: ExtractedSectionContent, aspect: string): string {
  return c.imageSrc
    ? `            <img src="${c.imageSrc}" alt="${esc(c.imageAlt || '')}" loading="lazy" className="w-full rounded-[var(--radius)] object-cover ${aspect}" />`
    : `            <div className="w-full rounded-[var(--radius)] border border-border bg-muted ${aspect}" />`;
}

export function aboutEditorialSplitJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
${c.heading ? `              <h2 className="mb-5 text-3xl font-semibold text-foreground">${esc(c.heading)}</h2>\n` : ''}\
${aboutParagraphsFrom(c).map((p) => `              <p className="mb-4 text-base leading-relaxed text-muted-foreground">${esc(p)}</p>`).join('\n')}${aboutCta(c)}
            </div>
${aboutMedia(c, 'aspect-[4/5]')}
          </div>`;
  return `      <section className="bg-background py-20 md:py-24" data-variant="about:editorial-split">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
${body}
        </div>
      </section>`;
}

export function aboutStatementJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="mx-auto max-w-3xl text-center">
${c.heading ? `            <h2 className="mb-5 text-3xl font-semibold text-foreground">${esc(c.heading)}</h2>\n` : ''}\
${aboutParagraphsFrom(c).map((p) => `            <p className="mb-4 text-base leading-relaxed text-muted-foreground">${esc(p)}</p>`).join('\n')}${aboutCta(c)}
          </div>`;
  return `      <section className="bg-muted py-20 md:py-24" data-variant="about:statement">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
${body}
        </div>
      </section>`;
}

export function aboutStoryPanelJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-0 md:grid-cols-12">
            <div className="md:col-span-7">
${aboutMedia(c, 'aspect-[16/10]')}
            </div>
            <div className="md:col-span-5 md:-ml-12 md:mt-16">
              <div className="rounded-[var(--radius)] border border-border bg-card p-10 text-card-foreground">
${c.heading ? `                <h2 className="mb-5 text-3xl font-semibold">${esc(c.heading)}</h2>\n` : ''}\
${aboutParagraphsFrom(c).map((p) => `                <p className="mb-4 text-base leading-relaxed text-muted-foreground">${esc(p)}</p>`).join('\n')}${aboutCta(c)}
              </div>
            </div>
          </div>`;
  return `      <section className="bg-muted py-20 md:py-24" data-variant="about:story-panel">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
${body}
        </div>
      </section>`;
}

function faqPairs(c: ExtractedSectionContent, count: number): Array<{ q: string; a: string }> {
  const items = c.listItems?.length ? c.listItems : [];
  const defaults = [
    'How soon can we start?',
    'What does the process look like?',
    'How is pricing handled?',
    'Do you offer ongoing support?',
  ];
  return Array.from({ length: Math.max(count, items.length || count) }, (_, i) => ({
    q: items[i] || defaults[i % defaults.length],
    a: 'Reach out and we will walk you through the details, timelines and next steps.',
  }));
}

export function faqAccordionJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="mx-auto max-w-3xl">
${faqPairs(c, 4).map((p) => `            <details className="mb-3 rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground">
              <summary className="cursor-pointer list-none text-base font-semibold">${esc(p.q)}</summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">${esc(p.a)}</p>
            </details>`).join('\n')}
          </div>`;
  return sectionShell('faq:accordion', c, body);
}

export function faqTwoColumnJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
${faqPairs(c, 4).map((p) => `            <div className="border-t border-border pt-5">
              <h3 className="mb-2 text-base font-semibold text-foreground">${esc(p.q)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">${esc(p.a)}</p>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('faq:two-column', c, body, 'bg-muted');
}

export function faqCardsJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-6 md:grid-cols-3">
${faqPairs(c, 3).map((p) => `            <div className="h-full rounded-[var(--radius)] border border-border bg-card p-8 text-card-foreground">
              <h3 className="mb-3 text-base font-semibold">${esc(p.q)}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">${esc(p.a)}</p>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('faq:cards', c, body);
}

function statFigures(c: ExtractedSectionContent, count: number): Array<{ value: string; label: string }> {
  const labels = c.listItems?.length ? c.listItems : ['Projects delivered', 'Years in practice', 'Client retention', 'Average rating'];
  const values = ['250+', '12', '96%', '4.9'];
  return Array.from({ length: count }, (_, i) => ({ value: values[i % values.length], label: labels[i % labels.length] }));
}

export function statsRowJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
${statFigures(c, 4).map((s, i) => `            <div className="px-4 text-center${i === 0 ? '' : ' md:border-l md:border-border'}">
              <span className="block text-4xl font-semibold text-primary">${esc(s.value)}</span>
              <span className="mt-2 block text-sm text-muted-foreground">${esc(s.label)}</span>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('stats:row', c, body);
}

export function statsBandedGridJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
${statFigures(c, 4).map((s) => `            <div className="rounded-[var(--radius)] border border-border bg-card p-8 text-center text-card-foreground">
              <span className="block text-4xl font-semibold text-primary">${esc(s.value)}</span>
              <span className="mt-2 block text-sm">${esc(s.label)}</span>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('stats:banded-grid', c, body, 'bg-muted');
}

export function statsHighlightJSX(c: ExtractedSectionContent): string {
  const [lead, ...rest] = statFigures(c, 4);
  const body = `          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="rounded-[var(--radius)] border border-border bg-card p-10 text-card-foreground">
              <span className="block text-5xl font-semibold text-primary">${esc(lead.value)}</span>
              <span className="mt-3 block text-base">${esc(lead.label)}</span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
${rest.map((s) => `              <div className="border-t border-border pt-4">
                <span className="block text-4xl font-semibold text-primary">${esc(s.value)}</span>
                <span className="mt-1 block text-sm text-muted-foreground">${esc(s.label)}</span>
              </div>`).join('\n')}
            </div>
          </div>`;
  return sectionShell('stats:highlight', c, body);
}

function teamRoster(c: ExtractedSectionContent, count: number): Array<{ name: string; role: string }> {
  const names = c.listItems?.length ? c.listItems : ['Alex Rivera', 'Jordan Blake', 'Sam Okafor', 'Riley Chen'];
  const roles = ['Founder', 'Lead Specialist', 'Client Director', 'Operations'];
  return Array.from({ length: count }, (_, i) => ({ name: names[i % names.length], role: roles[i % roles.length] }));
}

function memberPortrait(indent: string, src: string | undefined, alt: string, shape: string): string {
  return src
    ? `${indent}<img src="${src}" alt="${esc(alt)}" loading="lazy" className="w-full object-cover ${shape}" />`
    : `${indent}<div className="w-full border border-border bg-muted ${shape}" />`;
}

export function teamPortraitGridJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
${teamRoster(c, 4).map((m) => `            <div>
${memberPortrait('              ', c.imageSrc, m.name, 'aspect-[3/4] rounded-[var(--radius)]')}
              <span className="mt-4 block text-base font-semibold text-foreground">${esc(m.name)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">${esc(m.role)}</span>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('team:portrait-grid', c, body);
}

export function teamRosterRailJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="flex snap-x snap-mandatory gap-8 overflow-x-auto pb-4" role="group" aria-label="Team members">
${teamRoster(c, 4).map((m) => `            <div className="w-56 shrink-0 snap-start text-center">
${memberPortrait('              ', c.imageSrc, m.name, 'aspect-square rounded-full')}
              <span className="mt-4 block text-base font-semibold text-foreground">${esc(m.name)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">${esc(m.role)}</span>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('team:roster-rail', c, body, 'bg-muted');
}

export function teamLeadSpotlightJSX(c: ExtractedSectionContent): string {
  const [lead, ...rest] = teamRoster(c, 4);
  const body = `          <div className="mb-12 grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
${memberPortrait('              ', c.imageSrc, lead.name, 'aspect-[4/5] rounded-[var(--radius)]')}
            </div>
            <div className="md:col-span-7">
              <span className="block text-2xl font-semibold text-foreground">${esc(lead.name)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">${esc(lead.role)}</span>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">${esc(c.subheading || 'Leading every engagement personally, from first conversation to final handover.')}</p>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
${rest.map((m) => `            <div>
${memberPortrait('              ', c.imageSrc, m.name, 'aspect-square rounded-[var(--radius)]')}
              <span className="mt-4 block text-base font-semibold text-foreground">${esc(m.name)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">${esc(m.role)}</span>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('team:lead-spotlight', c, body);
}

// ============================================================================
// Logo Cloud / Blog Preview / Before-After Variants (Phase 3 first-class families)
// ============================================================================

function logoMarks(c: ExtractedSectionContent, count: number): string[] {
  const names = c.listItems?.length ? c.listItems : ['Northwind', 'Harbor & Co', 'Atlas Group', 'Meridian', 'Fieldhouse'];
  return Array.from({ length: Math.max(count, names.length) }, (_, i) => names[i % names.length]);
}

export function logoCloudGridJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid grid-cols-2 items-center gap-8 sm:grid-cols-3 md:grid-cols-5">
${logoMarks(c, 5).map((name) => `            <div className="flex items-center justify-center rounded-[var(--radius)] border border-border py-4">
              <span className="text-lg font-semibold text-muted-foreground">${esc(name)}</span>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('logo-cloud:grid', c, body, 'bg-muted');
}

export function logoCloudMarqueeJSX(c: ExtractedSectionContent): string {
  const marks = logoMarks(c, 5);
  const body = `          <div className="overflow-hidden">
            <div className="flex w-max items-center gap-16 opacity-75">
${[...marks, ...marks].map((name) => `              <span className="shrink-0 text-lg font-semibold text-muted-foreground">${esc(name)}</span>`).join('\n')}
            </div>
          </div>`;
  return sectionShell('logo-cloud:marquee', c, body);
}

export function logoCloudBrandLockupJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <p className="text-2xl font-semibold text-foreground">${esc(c.heading || 'Trusted by teams who care about the details')}</p>
            <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3">
${logoMarks(c, 6).map((name) => `              <span className="border-b border-border pb-3 text-lg font-semibold text-muted-foreground">${esc(name)}</span>`).join('\n')}
            </div>
          </div>`;
  return sectionShell('logo-cloud:brand-lockup', c, body, 'bg-muted');
}

function previewPosts(c: ExtractedSectionContent, count: number): Array<{ title: string; excerpt: string }> {
  const titles = c.listItems?.length ? c.listItems : ['What to expect from your first visit', 'Care that lasts between appointments', 'Behind the work we are proudest of'];
  return Array.from({ length: Math.max(count, titles.length) }, (_, i) => ({
    title: titles[i % titles.length],
    excerpt: 'A short read on how we work and what it means for your result.',
  }));
}

function postCard(post: { title: string; excerpt: string }, indent: string): string {
  return `${indent}<article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground">
${indent}  <h3 className="mb-2 text-lg font-semibold">${esc(post.title)}</h3>
${indent}  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">${esc(post.excerpt)}</p>
${indent}  <a href="#" className="mt-auto text-sm font-semibold text-primary no-underline">Read more</a>
${indent}</article>`;
}

export function blogPreviewEditorialJSX(c: ExtractedSectionContent): string {
  const [lead, ...rest] = previewPosts(c, 3);
  const body = `          <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <article className="flex flex-col">
              <h3 className="mb-3 text-2xl font-semibold text-foreground">${esc(lead.title)}</h3>
              <p className="mb-5 text-base leading-relaxed text-muted-foreground">${esc(lead.excerpt)}</p>
              <a href="#" className="text-sm font-semibold text-primary no-underline">Read the story</a>
            </article>
            <div className="flex flex-col">
${rest.map((post, i) => `              <article className="flex flex-col py-6${i === 0 ? '' : ' border-t border-border'}">
                <h3 className="mb-2 text-lg font-semibold text-foreground">${esc(post.title)}</h3>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">${esc(post.excerpt)}</p>
                <a href="#" className="text-sm font-semibold text-primary no-underline">Read more</a>
              </article>`).join('\n')}
            </div>
          </div>`;
  return sectionShell('blog-preview:editorial', c, body);
}

export function blogPreviewFeaturedGridJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
${previewPosts(c, 3).map((post) => postCard(post, '            ')).join('\n')}
          </div>`;
  return sectionShell('blog-preview:featured-grid', c, body, 'bg-muted');
}

export function blogPreviewHorizontalRailJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4">
${previewPosts(c, 3).map((post) => `            <div className="w-80 shrink-0 snap-start">
${postCard(post, '              ')}
            </div>`).join('\n')}
          </div>`;
  return sectionShell('blog-preview:horizontal-rail', c, body);
}

function transformationPairs(c: ExtractedSectionContent, count: number): Array<{ label: string }> {
  const labels = c.listItems?.length ? c.listItems : ['Full restoration', 'Colour correction', 'Complete refresh'];
  return Array.from({ length: Math.max(count, labels.length) }, (_, i) => ({ label: labels[i % labels.length] }));
}

function pairFigure(src: string | undefined, label: string, indent: string, aspect: string): string {
  const media = src
    ? `<img src="${src}" alt="${esc(label)}" loading="lazy" className="w-full ${aspect} object-cover" />`
    : `<div className="w-full ${aspect} bg-muted" />`;
  return `${indent}<div className="relative">
${indent}  ${media}
${indent}  <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold uppercase text-background">${esc(label)}</span>
${indent}</div>`;
}

export function beforeAfterSliderJSX(c: ExtractedSectionContent): string {
  const body = `          <figure className="m-0 mx-auto max-w-3xl">
            <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius)] border border-border">
${pairFigure(c.imageSrc, 'Before', '              ', 'aspect-[4/3]')}
${pairFigure(c.imageSrc, 'After', '              ', 'aspect-[4/3]')}
            </div>
            <figcaption className="mt-4 text-center text-sm text-muted-foreground">${esc(c.subheading || 'Drag to compare the finished result.')}</figcaption>
          </figure>`;
  return sectionShell('before-after:slider', c, body, 'bg-muted');
}

export function beforeAfterGridJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="grid gap-8 sm:grid-cols-2">
${transformationPairs(c, 2).map((pair) => `            <figure className="m-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card">
              <div className="grid grid-cols-2">
${pairFigure(c.imageSrc, 'Before', '                ', 'aspect-square')}
${pairFigure(c.imageSrc, 'After', '                ', 'aspect-square')}
              </div>
              <figcaption className="p-4 text-sm text-muted-foreground">${esc(pair.label)}</figcaption>
            </figure>`).join('\n')}
          </div>`;
  return sectionShell('before-after:grid', c, body, 'bg-muted');
}

export function beforeAfterCaseStudyJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="flex flex-col gap-14">
${transformationPairs(c, 2).map((pair) => `            <article className="grid items-center gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="grid grid-cols-2 gap-3">
${pairFigure(c.imageSrc, 'Before', '                ', 'aspect-[3/4] rounded-[var(--radius)]')}
${pairFigure(c.imageSrc, 'After', '                ', 'aspect-[3/4] rounded-[var(--radius)]')}
              </div>
              <div>
                <h3 className="mb-3 text-2xl font-semibold text-foreground">${esc(pair.label)}</h3>
                <p className="text-base leading-relaxed text-muted-foreground">A considered plan, careful execution and a finish the client can maintain.</p>
              </div>
            </article>`).join('\n')}
          </div>`;
  return sectionShell('before-after:case-study', c, body);
}

// ============================================================================
// 21st.dev adapted variants (provenance recorded on registry entries)
// ============================================================================

export function heroCommerceGradientJSX(c: ExtractedSectionContent): string {
  return `      <section className="relative overflow-hidden py-16 md:py-24 bg-white" data-variant="hero:commerce-gradient">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 px-6 py-20 md:py-28 text-center">
${c.badge ? `            <span className="inline-block text-xs font-medium tracking-wide uppercase mb-6 px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `            <h1 className="mx-auto max-w-[18ch] text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-tight mb-6 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `            <p className="mx-auto max-w-2xl text-base md:text-lg text-gray-600 leading-relaxed">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `            <div className="flex gap-3 flex-wrap justify-center mt-10">
${renderButtons(c.ctaButtons, 'inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors', 'inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 transition-colors')}
            </div>\n` : ''}\
          </div>
        </div>
      </section>`;
}

export function galleryCollectionTilesJSX(c: ExtractedSectionContent): string {
  const tiles = galleryTiles(c, 4);
  const grid = `          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
${tiles.map((t) => `            <a href="#" className="group relative block min-h-[18rem] overflow-hidden rounded-3xl bg-gray-100 p-6">
              <h3 className="relative z-10 my-2 text-center text-2xl font-bold text-blue-600 sm:text-3xl">${esc(t.caption || '')}</h3>
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <img src="${t.src}" alt="${esc(t.caption || '')}" loading="lazy" className="h-auto w-full max-w-[45%] object-contain opacity-90 transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="absolute bottom-0 right-0 z-10 flex h-16 w-16 items-center justify-center rounded-tl-2xl border-l border-t border-gray-200 bg-white md:h-20 md:w-20">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white transition-transform duration-300 group-hover:scale-110 md:h-12 md:w-12">&#8599;</span>
              </div>
            </a>`).join('\n')}
          </div>`;
  return galleryShell('gallery:collection-tiles', c, grid);
}

export function heroShowcasePanelJSX(c: ExtractedSectionContent): string {
  const media = c.imageSrc
    ? `            <div className="relative w-full overflow-hidden rounded-2xl border border-gray-200">
              <img src="${c.imageSrc}" alt="${esc(c.imageAlt || c.heading || '')}" loading="lazy" className="h-72 w-full object-cover sm:h-96" />
            </div>\n`
    : '';
  return `      <section className="relative isolate w-full overflow-hidden py-20 sm:py-28 bg-white" data-variant="hero:showcase-panel">
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 sm:gap-14">
          <div className="flex w-full max-w-2xl flex-col items-center gap-5 text-center">
${c.badge ? `            <span className="inline-block rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-blue-600">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `            <h1 className="text-balance text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `            <p className="max-w-xl text-balance text-sm leading-relaxed text-gray-600 sm:text-base">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `            <div className="flex flex-wrap items-center justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700', 'inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50')}
            </div>\n` : ''}\
          </div>
${media}\
        </div>
      </section>`;
}

export function logoCloudWordmarkRowJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-border pt-8 sm:pt-10">
${logoMarks(c, 5).map((name) => `            <span className="text-sm font-semibold tracking-tight text-muted-foreground/70">${esc(name)}</span>`).join('\n')}
          </div>`;
  return sectionShell('logo-cloud:wordmark-row', c, body);
}

export function featuresBentoGridJSX(c: ExtractedSectionContent): string {
  const spans = [
    'md:col-span-1 md:row-span-3',
    'md:col-span-1 md:row-span-1',
    'md:col-span-1 md:row-span-1',
    'md:col-span-1 md:row-span-1',
    'md:col-span-1 md:row-span-1',
    'md:col-span-2 md:row-span-1',
  ];
  const items = c.listItems || [];
  const body = `          <div className="grid w-full auto-rows-[minmax(180px,auto)] grid-cols-1 gap-6 md:grid-cols-3 md:grid-rows-3">
${items.map((item, i) => `            <div className="flex flex-col justify-end rounded-2xl border border-border bg-card p-6 ${spans[i % spans.length]}">
              <h3 className="text-lg font-semibold text-card-foreground">${esc(item)}</h3>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('features:bento-grid', c, body);
}

// ============================================================================
// 21st.dev certified variants (product cards, CTA, proof, nav, footer, pricing, stats)
// ============================================================================

export function servicesProductCardsJSX(c: ExtractedSectionContent): string {
  const items = c.listItems?.length ? c.listItems : ['Signature Piece', 'Everyday Essential', 'Limited Release', 'Studio Favourite'];
  const body = `          <div className="grid w-full grid-cols-2 gap-6 lg:grid-cols-4">
${items.map((item) => `            <article className="flex h-full flex-col rounded-[var(--radius)] border border-border bg-card p-5 text-center transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none">
              <div className="mb-4 flex h-40 items-center justify-center rounded-[var(--radius)] bg-muted" />
              <h3 className="text-base font-semibold text-card-foreground">${esc(item)}</h3>
              <a href="#products" data-ut-intent="cart.add" className="mt-4 inline-flex w-full items-center justify-center rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Add to Bag</a>
            </article>`).join('\n')}
          </div>`;
  return sectionShell('services:product-cards', c, body);
}

export function ctaSignalBannerJSX(c: ExtractedSectionContent): string {
  const body = `          <div className="relative w-full overflow-hidden rounded-[var(--radius)] border border-primary/30 bg-card/80 px-6 py-12 text-center">
            <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-primary/50" />
            <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-primary/50" />
            <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-primary/50" />
            <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-primary/50" />
${c.heading ? `            <h2 className="text-2xl font-semibold tracking-wide text-foreground md:text-3xl">${esc(c.heading)}</h2>\n` : ''}\
${c.subheading ? `            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center rounded-[var(--radius)] border border-primary bg-primary/15 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-primary', 'inline-flex items-center rounded-[var(--radius)] border border-primary/30 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground')}
            </div>\n` : ''}\
          </div>`;
  return sectionShell('cta:signal-banner', c, body);
}

export function testimonialsMarqueeJSX(c: ExtractedSectionContent): string {
  const quotes = c.listItems?.length ? c.listItems : ['Exceptional from first contact to delivery.', 'The quality speaks for itself.', 'We keep coming back for every season.'];
  const row = (marks: string[]) => marks.map((quote) => `              <figure className="m-0 w-[320px] shrink-0 rounded-[var(--radius)] border border-border bg-card p-8">
                <blockquote className="text-base leading-relaxed text-card-foreground">${esc(quote)}</blockquote>
              </figure>`).join('\n');
  const body = `          <div className="flex w-full flex-col gap-6 overflow-hidden">
            <div className="flex w-max gap-6">
${row([...quotes, ...quotes])}
            </div>
          </div>`;
  return sectionShell('testimonials:marquee', c, body, 'bg-muted');
}

export function statsMetricCardsJSX(c: ExtractedSectionContent): string {
  const items = c.listItems?.length ? c.listItems : ['12k+ orders shipped', '4.9 average rating', '48h dispatch', '30-day returns'];
  const body = `          <div className="grid w-full grid-cols-2 gap-5 lg:grid-cols-4">
${items.map((item) => {
    const [value, ...rest] = item.split(' ');
    const label = rest.join(' ') || item;
    return `            <div className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-card p-7">
              <span className="absolute left-0 top-0 h-full w-1 bg-primary/75" />
              <span className="block text-4xl font-semibold text-primary">${esc(value)}</span>
              <span className="mt-2 block text-sm text-muted-foreground">${esc(label)}</span>
            </div>`;
  }).join('\n')}
          </div>`;
  return sectionShell('stats:metric-cards', c, body);
}

export function pricingFeatureTableJSX(c: ExtractedSectionContent): string {
  const tiers = c.listItems?.length ? c.listItems : ['Starter', 'Studio', 'Atelier'];
  const body = `          <div className="grid w-full gap-6 md:grid-cols-3">
${tiers.map((tier, i) => `            <div className="flex h-full flex-col rounded-[var(--radius)] border ${i === 1 ? 'border-primary' : 'border-border'} bg-card p-8">
              <h3 className="text-lg font-semibold text-card-foreground">${esc(tier)}</h3>
              <span className="mt-4 block text-4xl font-semibold text-card-foreground">$${(i + 1) * 49}</span>
              <a href="#contact" data-ut-intent="lead.capture" className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Get started</a>
            </div>`).join('\n')}
          </div>`;
  return sectionShell('pricing:feature-table', c, body, 'bg-muted');
}

/**
 * pricing:billing-toggle — owner-authorized adaptation of 21st.dev "Pricing Section"
 * (21st:6247). The odometer price roll and switch spring are reproduced with a
 * CSS-only peer toggle so the recipe needs no runtime packages or hooks.
 */
export function pricingBillingToggleJSX(c: ExtractedSectionContent): string {
  const plans = pricingPlans(c);
  const cta = planCta(c);
  const monthlyOf = (price: string) => Number((/(\d[\d,.]*)/.exec(price)?.[1] || '0').replace(/,/g, '')) || 0;
  const body = `          <input type="checkbox" id="pricing-billing-yearly" className="peer sr-only" aria-label="Show yearly pricing" />
          <div className="mb-10 flex w-full justify-center peer-checked:[&_[data-pill=monthly]]:bg-transparent peer-checked:[&_[data-pill=monthly]]:text-muted-foreground peer-checked:[&_[data-pill=yearly]]:bg-primary peer-checked:[&_[data-pill=yearly]]:text-primary-foreground">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
              <label data-pill="monthly" htmlFor="pricing-billing-yearly" className="cursor-pointer rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors duration-300 motion-reduce:transition-none">Monthly</label>
              <label data-pill="yearly" htmlFor="pricing-billing-yearly" className="flex cursor-pointer items-center gap-2 rounded-full px-6 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 motion-reduce:transition-none">
                Yearly
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Save 20%</span>
              </label>
            </div>
          </div>
          <div className="grid w-full items-start gap-6 sm:grid-cols-2 lg:grid-cols-3 peer-checked:[&_[data-roll]]:-translate-y-1/2">

${plans.map((plan, i) => {
    const monthly = monthlyOf(plan.price);
    return `            <article className="flex h-full flex-col rounded-[var(--radius)] border ${i === 1 ? 'border-primary' : 'border-border'} bg-card p-8 text-card-foreground transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none" data-ut-slot="plan-${i + 1}">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold">${esc(plan.name)}</h3>
${i === 1 ? '                <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Popular</span>\n' : ''}\
              </div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="relative inline-flex h-[1.1em] overflow-hidden text-4xl font-semibold">
                  <span data-roll="price" className="flex flex-col transition-transform duration-500 ease-out motion-reduce:transition-none">
                    <span className="leading-[1.1em]">$${monthly}</span>
                    <span className="leading-[1.1em]">$${monthly * 10}</span>
                  </span>
                </span>
                <span className="relative inline-flex h-[1.4em] overflow-hidden text-sm text-muted-foreground">
                  <span data-roll="period" className="flex flex-col transition-transform duration-500 ease-out motion-reduce:transition-none">

                    <span className="leading-[1.4em]">/month</span>
                    <span className="leading-[1.4em]">/year</span>
                  </span>
                </span>
              </div>
              <a href="${cta.href}" data-ut-intent="lead.capture" className="mt-6 inline-flex w-full items-center justify-center rounded-[var(--radius)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground no-underline">${esc(cta.label)}</a>
              <ul className="mt-6 flex-1 list-none space-y-2 p-0 text-sm text-muted-foreground">
${plan.features.map((f) => `                <li>✓ ${esc(f)}</li>`).join('\n')}
              </ul>
            </article>`;
  }).join('\n')}
          </div>`;
  return sectionShell('pricing:billing-toggle', c, body, 'bg-muted');
}



export function navbarFloatingPillJSX(c: ExtractedSectionContent): string {
  return `      <header className="fixed left-0 right-0 top-0 z-50 px-6 pt-4 backdrop-blur-md" data-variant="navbar:floating-pill">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-border bg-background/80 px-6">
          <a href="#" className="text-base font-semibold tracking-tight text-foreground">${esc(c.brandName || 'Studio')}</a>
          <nav className="hidden items-center gap-7 md:flex">
${renderLinks(c.navLinks, 'text-sm text-muted-foreground hover:opacity-80')}
          </nav>
${c.ctaButtons?.length ? `          <a href="${c.ctaButtons[0].href}" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">${esc(c.ctaButtons[0].text)}</a>` : ''}
        </div>
      </header>`;
}

export function footerBrandSocialJSX(c: ExtractedSectionContent): string {
  const socials = ['Instagram', 'LinkedIn', 'YouTube'];
  return `      <footer className="border-t border-border bg-card" data-variant="footer:brand-social">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_2fr]">
          <div>
            <span className="block text-xl font-semibold text-foreground">${esc(c.brandName || 'Studio')}</span>
            <div className="mt-5 flex flex-wrap items-center gap-2">
${socials.map((s) => `              <a href="#" aria-label="${s}" className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-medium text-muted-foreground">${s}</a>`).join('\n')}
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
${renderLinks(c.navLinks, 'text-sm text-muted-foreground hover:opacity-80')}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">© ${new Date().getFullYear()} ${esc(c.brandName || 'Studio')}. All rights reserved.</div>
      </footer>`;
}

export function heroPrismaCinematicJSX(c: ExtractedSectionContent): string {
  const words = String(c.heading || '').trim().split(/\s+/).filter(Boolean);
  const media = c.imageSrc
    ? `          <img src="${c.imageSrc}" alt="${esc(c.imageAlt || c.heading || 'Hero background')}" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />\n`
    : '';
  return `      <section className="relative w-full bg-background py-12 sm:py-16" data-variant="hero:prisma-cinematic">
        <div className="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end overflow-hidden rounded-[2rem] bg-foreground px-5 pb-6 sm:px-8 md:min-h-[80vh] md:px-10 md:pb-10">
${media}\
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-foreground/40 via-transparent to-foreground/80" />
          <div className="relative z-10 grid grid-cols-12 items-end gap-6">
            <div className="col-span-12 lg:col-span-8">
              <h1 className="flex flex-wrap font-medium leading-[0.85] tracking-[-0.06em] text-background text-[16vw] md:text-[13vw]">
${words.map((w) => `                <span className="mr-[0.22em] inline-block">${esc(w)}</span>`).join('\n')}
              </h1>
            </div>
            <div className="col-span-12 flex flex-col gap-5 lg:col-span-4 lg:pb-8">
${c.subheading ? `              <p className="text-sm leading-snug text-background/80 md:text-base">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `              <div className="flex flex-wrap items-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-medium text-foreground', 'inline-flex items-center gap-2 rounded-full border border-background/50 px-6 py-3 text-sm font-medium text-background')}
              </div>\n` : ''}\
            </div>
          </div>
        </div>
      </section>`;
}

export function heroTunnelImmersiveJSX(c: ExtractedSectionContent): string {
  const rings = Array.from({ length: 9 }, (_, i) => `          <span className="ut-tunnel-ring absolute left-1/2 top-1/2 aspect-square w-[140vmax] rounded-full border border-dashed border-background/30" style={{ animationDelay: '-${i}s', transform: 'translate(-50%, -50%) scale(${(1 - i / 9).toFixed(2)})' }} />`).join('\n');
  return `      <section className="relative min-h-screen w-full overflow-hidden bg-foreground" data-variant="hero:tunnel-immersive">
        <style>{\`@keyframes ut-tunnel-recede{from{transform:translate(-50%,-50%) scale(1.6);opacity:0}20%{opacity:1}to{transform:translate(-50%,-50%) scale(.05);opacity:0}}.ut-tunnel-ring{animation:ut-tunnel-recede 9s linear infinite}@media(prefers-reduced-motion:reduce){.ut-tunnel-ring{animation:none;opacity:.5}}\`}</style>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
${rings}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--foreground)/0.85)_70%)]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
${c.badge ? `          <span className="mb-6 text-xs uppercase tracking-[0.3em] text-background/70">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `          <h1 className="text-balance text-5xl font-semibold leading-[0.95] text-background md:text-7xl lg:text-8xl">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `          <p className="mt-6 max-w-xl text-base text-background/75 md:text-lg">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `          <div className="mt-10 flex flex-wrap justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex items-center rounded-full bg-background px-6 py-3 text-sm font-medium text-foreground', 'inline-flex items-center rounded-full border border-background/50 px-6 py-3 text-sm font-medium text-background')}
          </div>\n` : ''}\
        </div>
      </section>`;
}

export function heroSpatialDepthJSX(c: ExtractedSectionContent): string {
  const coords = [[-28,-18,250],[30,-22,150],[-32,20,80],[28,18,-50],[-16,28,-150],[18,-32,-250],[-12,-30,-350],[12,32,-450]];
  const media = c.imageSrc || '/placeholder.svg';
  const cards = coords.map(([x, y, z], i) => `          <div className="ut-depth-card absolute left-1/2 top-1/2 aspect-[3/4] w-[14vw] min-w-28 overflow-hidden rounded-xl border border-foreground/10 shadow-2xl" style={{ transform: 'translate3d(calc(-50% + ${x}vw), calc(-50% + ${y}vh), ${z}px) rotateX(${y * 0.5}deg) rotateY(${x * -0.5}deg) rotateZ(${((i - 3.5) * 1.5).toFixed(1)}deg) scale(.8)', animationDelay: '${(i * 0.06).toFixed(2)}s' }}><img src="${media}" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} /></div>`).join('\n');
  return `      <section className="relative min-h-screen w-full overflow-hidden bg-background" data-variant="hero:spatial-depth">
        <style>{\`@keyframes ut-spatial-spread{from{transform:translate3d(-50%,-50%,0) scale(.4);opacity:0}}.ut-depth-card{animation:ut-spatial-spread 1.6s cubic-bezier(.2,.8,.2,1) both}@media(prefers-reduced-motion:reduce){.ut-depth-card{animation:none}}\`}</style>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ perspective: '1200px' }}>
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
${cards}
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.4)_45%,transparent_75%)]" />
        </div>
        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
${c.badge ? `          <span className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `          <h1 className="text-balance text-5xl font-semibold leading-[0.95] text-foreground md:text-7xl lg:text-8xl">${esc(c.heading)}</h1>\n` : ''}\
${c.subheading ? `          <p className="mt-6 max-w-xl text-base text-foreground/70 md:text-lg">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `          <div className="mt-10 flex flex-wrap justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex min-h-11 items-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background', 'inline-flex min-h-11 items-center rounded-full border border-foreground/30 px-6 py-3 text-sm font-medium text-foreground')}
          </div>\n` : ''}\
        </div>
      </section>`;
}

export function heroImageStreamJSX(c: ExtractedSectionContent): string {
  const media = c.imageSrc || '/placeholder.svg';
  const cards = Array.from({ length: 9 }, (_, index) => `                <div key={${index}} className="ut-ish-card absolute overflow-hidden border border-border bg-muted" style={{ left: '50%', top: '56%', width: '18cqw', height: '25cqw', marginLeft: '-9cqw', marginTop: '-12.5cqw', borderRadius: 'max(.4cqw, var(--radius))', animation: \`ut-ish-rail-\${rail} 18s linear infinite\`, animationDelay: '-${(index * 2).toFixed(0)}s', backfaceVisibility: 'hidden' }}>
                  <img src="${media}" alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
                </div>`).join('\n');
  return `      <section className="relative min-h-[clamp(34rem,82vh,56rem)] w-full overflow-hidden bg-background" style={{ containerType: 'inline-size' }} data-variant="hero:image-stream">
        <style>{\`@keyframes ut-ish-rail-1{0%{transform:translate3d(-11cqw,0,-258.46cqw) rotateY(-6deg)}50%{transform:translate3d(38.55cqw,0,-31.38cqw) rotateY(-17deg)}100%{transform:translate3d(44cqw,0,13.70cqw) rotateY(-28deg)}}@keyframes ut-ish-rail--1{0%{transform:translate3d(11cqw,0,-258.46cqw) rotateY(6deg)}50%{transform:translate3d(-38.55cqw,0,-31.38cqw) rotateY(17deg)}100%{transform:translate3d(-44cqw,0,13.70cqw) rotateY(28deg)}}@media(prefers-reduced-motion:reduce){.ut-ish-card{animation-play-state:paused!important}}\`}</style>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ perspective: '30cqw', perspectiveOrigin: '50% 56%' }}>
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {[1, -1].map((rail) => (
              <React.Fragment key={rail}>
${cards}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/20 to-background/90" />
        <div className="relative z-10 mx-auto flex min-h-[clamp(34rem,82vh,56rem)] max-w-6xl flex-col items-center justify-between px-6 py-12 text-center md:py-16">
          <div className="max-w-4xl">
${c.badge ? `            <span className="mb-5 inline-flex rounded-[var(--radius)] border border-border px-3 py-1 text-xs font-medium uppercase text-muted-foreground">${esc(c.badge)}</span>\n` : ''}\
${c.heading ? `            <h1 className="text-balance text-5xl font-semibold leading-[0.98] text-foreground sm:text-6xl lg:text-8xl">${esc(c.heading)}</h1>\n` : ''}\
          </div>
          <div className="flex max-w-xl flex-col items-center gap-5">
${c.subheading ? `            <p className="text-balance text-sm leading-relaxed text-muted-foreground md:text-base">${esc(c.subheading)}</p>\n` : ''}\
${c.ctaButtons?.length ? `            <div className="flex flex-wrap items-center justify-center gap-3">
${renderButtons(c.ctaButtons, 'inline-flex min-h-11 items-center justify-center rounded-[calc(var(--radius)*4)] bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground', 'inline-flex min-h-11 items-center justify-center rounded-[calc(var(--radius)*4)] border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground')}
            </div>\n` : ''}\
          </div>
        </div>
      </section>`;
}
