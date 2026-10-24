import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { INTENT_REGISTRY } from '@/platform/core/intentSurfaceRegistry';
import { pageArchetypeIssues } from '@/sections/pageArchetypeContract';
import { ART_DIRECTION_PACKS, familyForSection, getGenerationVariantsForSection, type VariantId } from '@/sections/variants';
import { MarketplaceTemplateShowcase } from '@/marketplace/MarketplaceTemplateShowcase';
import {
  AUTHORED_MARKETPLACE_TEMPLATES,
  marketplaceBindingAttributes,
  resolveMarketplaceTemplateBinding,
} from '@/marketplace/authoredTemplatePreviews';
import { MARKETPLACE_TEMPLATE_VARIANT_PROFILES, type MarketplaceSectionVariantSlot } from '@/marketplace/MarketplaceRegisteredSection';
import { MARKETPLACE_SAMPLE_IMAGES } from '@/marketplace/marketplaceImagePlaceholders';

afterEach(() => { cleanup(); window.localStorage.clear(); });

describe('authored marketplace previews', () => {
  it('shows only the authored concepts instead of generic registry compositions', () => {
    render(<MarketplaceTemplateShowcase />);

    expect(AUTHORED_MARKETPLACE_TEMPLATES).toHaveLength(12);
    for (const template of AUTHORED_MARKETPLACE_TEMPLATES) {
      expect(screen.getByRole('heading', { name: template.name })).toBeInTheDocument();
    }
    expect(screen.queryByText('Portfolio Photography')).not.toBeInTheDocument();
    expect(screen.getByText(/not certified marketplace releases/i)).toBeInTheDocument();
  });

  it('filters authored concepts by their design details', () => {
    render(<MarketplaceTemplateShowcase />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search previews' }), {
      target: { value: 'ingredient-first' },
    });

    expect(screen.getByRole('heading', { name: 'Sorella House' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Formworks Studio' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Relay Operations' })).not.toBeInTheDocument();
  });

  it('resolves every template action through stable user-action registry definitions', () => {
    for (const template of AUTHORED_MARKETPLACE_TEMPLATES) {
      expect(template.bindings.length, template.id).toBeGreaterThan(0);
      for (const binding of template.bindings) {
        const resolved = resolveMarketplaceTemplateBinding(binding);
        const attributes = marketplaceBindingAttributes(binding);
        expect(INTENT_REGISTRY[resolved.definition.name], binding.id).toBeDefined();
        expect(resolved.definition.triggerType, binding.id).toBe('user-action');
        expect(resolved.definition.status, binding.id).toBe('stable');
        expect(attributes['data-intent'], binding.id).toBe(resolved.definition.name);
        expect(attributes['data-ut-intent'], binding.id).toBe(resolved.definition.name);
        expect(attributes['data-ut-slot'], binding.id).toBe(binding.sourceSlot);
      }
    }
  });

  it("renders each industry's eligible section types and distinct registered layout set", () => {
    const sections: Record<MarketplaceSectionVariantSlot, { sectionType: string; role: string }> = {
      gallery: { sectionType: 'gallery', role: 'gallery' },
      journal: { sectionType: 'blog-preview', role: 'blog' },
      features: { sectionType: 'features', role: 'home' },
      services: { sectionType: 'services', role: 'services' },
      stats: { sectionType: 'stats', role: 'home' },
      team: { sectionType: 'team', role: 'about' },
      testimonials: { sectionType: 'testimonials', role: 'home' },
      faq: { sectionType: 'faq', role: 'faq' },
      pricing: { sectionType: 'pricing', role: 'pricing' },
      cta: { sectionType: 'cta', role: 'home' },
      contact: { sectionType: 'contact', role: 'contact' },
      navbar: { sectionType: 'navbar', role: 'home' },
      footer: { sectionType: 'footer', role: 'home' },
      about: { sectionType: 'about', role: 'about' },
      'before-after': { sectionType: 'before-after', role: 'gallery' },
    };
    const variantMixes = new Set<string>();
    const sectionTypeMixes = new Set<string>();

    for (const template of AUTHORED_MARKETPLACE_TEMPLATES) {
      const templateId = template.id as keyof typeof MARKETPLACE_TEMPLATE_VARIANT_PROFILES;
      const profile = MARKETPLACE_TEMPLATE_VARIANT_PROFILES[templateId];
      const mix = Object.values(profile.variants).join('|');
      expect(variantMixes.has(mix), `${templateId} repeats ${mix}`).toBe(false);
      variantMixes.add(mix);

      for (const [key, registeredVariant] of Object.entries(profile.variants) as Array<[MarketplaceSectionVariantSlot, VariantId]>) {
        const { sectionType, role } = sections[key];
        const variantId = registeredVariant;
        const eligible = getGenerationVariantsForSection(sectionType, ART_DIRECTION_PACKS[profile.artDirectionPackId], role);
        expect(eligible.some((variant) => variant.id === variantId), `${templateId}:${variantId}`).toBe(true);
      }

      const { unmount } = render(<MarketplaceTemplateShowcase />);
      fireEvent.click(screen.getByRole('button', { name: `Preview ${template.name}` }));
      const surface = screen.getByRole('region', { name: `${template.name} page preview` });
      const renderedVariantIds = Array.from(surface.querySelectorAll('[data-ut-variant-id]'))
        .map((element) => element.getAttribute('data-ut-variant-id'));
      expect(renderedVariantIds).toEqual(expect.arrayContaining(Object.values(profile.variants)));
      const sectionTypes = Array.from(new Set(Array.from(surface.querySelectorAll('[data-ut-section-type]'), (element) => element.getAttribute('data-ut-section-type')))).sort();
      expect(sectionTypes.length, templateId).toBeGreaterThanOrEqual(3);
      const sectionTypeMix = sectionTypes.join('|');
      expect(sectionTypeMixes.has(sectionTypeMix), `${templateId} repeats section set ${sectionTypeMix}`).toBe(false);
      sectionTypeMixes.add(sectionTypeMix);
      unmount();
    }
  });

  it('keeps every route inside its template theme family and canonical page archetype', () => {
    for (const template of AUTHORED_MARKETPLACE_TEMPLATES) {
      const templateId = template.id as keyof typeof MARKETPLACE_TEMPLATE_VARIANT_PROFILES;
      const profile = MARKETPLACE_TEMPLATE_VARIANT_PROFILES[templateId];
      const pack = ART_DIRECTION_PACKS[profile.artDirectionPackId];

      for (const family of ['cta', 'contact', 'navbar', 'footer'] as const) {
        const role = family === 'contact' ? 'contact' : 'home';
        expect(getGenerationVariantsForSection(family, pack, role).length, `${templateId}:${family}`).toBeGreaterThan(0);
      }

      for (const page of template.pages) {
        const families = [...page.sections.map((section) => section.type), 'cta', 'contact'];
        expect(
          pageArchetypeIssues(page.archetype, families, {}, { industry: template.category }),
          `${templateId}${page.path}`,
        ).toEqual([]);
      }
    }
  });

  it('renders pack-affine navigation and footer variants on every secondary route', () => {
    for (const template of AUTHORED_MARKETPLACE_TEMPLATES) {
      const templateId = template.id as keyof typeof MARKETPLACE_TEMPLATE_VARIANT_PROFILES;
      const pack = ART_DIRECTION_PACKS[MARKETPLACE_TEMPLATE_VARIANT_PROFILES[templateId].artDirectionPackId];
      const { unmount } = render(<MarketplaceTemplateShowcase />);
      fireEvent.click(screen.getByRole('button', { name: `Preview ${template.name}` }));

      for (const page of template.pages) {
        const siteNavigation = screen.queryByRole('navigation', { name: `${template.name} pages` })
          ?? screen.getByRole('main').querySelector('[data-ut-section-type="navbar"]');
        const routeLink = siteNavigation?.querySelector<HTMLAnchorElement>(`a[href="${page.path}"]`);
        expect(routeLink, `${template.id}${page.path} navigation link`).toBeInTheDocument();
        fireEvent.click(routeLink!);

        const route = screen.getByRole('main');
        expect(route).toHaveAttribute('data-marketplace-current-route', page.path);
        expect(route).toHaveAttribute('data-marketplace-theme-family', pack.id);
        expect(route).toHaveAttribute('data-marketplace-page-archetype', page.archetype);
        const navbar = route.querySelector('[data-ut-section-type="navbar"]');
        const footer = route.querySelector('[data-ut-section-type="footer"]');
        expect(familyForSection(pack, 'navbar')).toContain(navbar?.getAttribute('data-ut-variant-id'));
        expect(familyForSection(pack, 'footer')).toContain(footer?.getAttribute('data-ut-variant-id'));
      }

      unmount();
    }
  });

  it('uses unique image sources across every preview and catalog cover', () => {
    const seenImages = new Map<string, string>();

    for (const template of AUTHORED_MARKETPLACE_TEMPLATES) {
      const { container, unmount } = render(createElement(template.preview, {
        compact: false,
        onIntent: () => undefined,
        templateId: template.id,
        templateName: template.name,
        pages: template.pages,
        currentPagePath: '/',
        onNavigate: () => undefined,
      }));
      const imageUrls = [template.coverImage, ...Array.from(container.querySelectorAll('img[src]'), (image) => image.getAttribute('src')!)];
      for (const imageUrl of imageUrls) {
        // Intentional shared generated placeholders are durable project assets;
        // the original authored photographs must still remain distinct.
        if (Object.values(MARKETPLACE_SAMPLE_IMAGES).includes(imageUrl)) continue;
        const photoId = imageUrl.match(/images\.unsplash\.com\/(photo-[^?]+)/)?.[1];
        expect(photoId, `${template.id} image ${imageUrl}`).toBeDefined();
        expect(seenImages.has(photoId!), `${photoId} is reused by ${seenImages.get(photoId!) ?? template.id} and ${template.id}`).toBe(false);
        seenImages.set(photoId!, template.id);
      }
      unmount();
    }
  });

  it('redirects a bound action into the registry overlay without exposing submitted details', () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Sorella House' }));

    const previewSurface = screen.getByRole('region', { name: 'Sorella House page preview' });
    expect(previewSurface).toHaveClass('overflow-y-auto');
    expect(previewSurface).toHaveAttribute('data-marketplace-preview-surface');
    expect(screen.getAllByRole('img', { name: /seasonal|market|table/i }).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '6:30 PM' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'guest@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request a table' }));

    const redirect = screen.getByRole('dialog', { name: 'Request a table' });
    expect(redirect).toHaveAttribute('data-unison-preview-redirect', 'booking.create');
    expect(redirect).toHaveTextContent('no form details are sent or saved');
    expect(redirect).not.toHaveTextContent('guest@example.com');
    expect(screen.getByRole('button', { name: 'Request a table' })).toHaveAttribute('data-ut-cta', 'sorella:reservation-submit');
  });

  it('routes a bound in-template link to its section without opening an intent overlay', () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Sorella House' }));

    const previewSurface = screen.getByRole('region', { name: 'Sorella House page preview' });
    fireEvent.click(screen.getByRole('link', { name: 'See what is cooking' }));

    expect(previewSurface).toHaveAttribute('data-marketplace-current-section', 'menu');
    expect(screen.queryByRole('dialog', { name: 'See what is cooking' })).not.toBeInTheDocument();
  });

  it('navigates between full template pages from the template header without changing the marketplace URL', () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Sorella House' }));

    const pageNavigation = screen.getByRole('navigation', { name: 'Sorella House pages' });
    expect(pageNavigation.closest('header')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Menu' }));

    const menuPage = screen.getByRole('main');
    expect(menuPage).toHaveAttribute('data-marketplace-current-route', '/menu');
    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('');

    fireEvent.click(screen.getByRole('link', { name: 'Visit' }));
    const visitPage = screen.getByRole('main');
    expect(visitPage).toHaveAttribute('data-marketplace-current-route', '/visit');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('data-ut-intent', 'nav.goto');

    const homeLink = visitPage.querySelector<HTMLAnchorElement>('[data-ut-section-type="navbar"] a[href="/"]');
    expect(homeLink).toBeInTheDocument();
    fireEvent.click(homeLink!);
    expect(screen.getByRole('region', { name: 'Sorella House page preview' })).toHaveAttribute('data-marketplace-current-route', '/');
    expect(window.location.pathname).toBe('/');
  });

  it('keeps secondary pages in their template theme and previews date-based inquiries locally', () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Sorella House' }));
    fireEvent.click(screen.getByRole('link', { name: 'Menu' }));

    const menuPage = screen.getByRole('main');
    expect(menuPage).toHaveAttribute('data-marketplace-template-id', 'sorella-house');
    expect(menuPage).toHaveAttribute('data-marketplace-theme-family', 'warm-craft');
    expect(menuPage).toHaveAttribute('data-marketplace-page-archetype', 'shop');
    expect(menuPage).toHaveStyle({ backgroundColor: 'hsl(45 33% 92%)' });
    expect(menuPage.querySelector('[data-ut-section-type="navbar"]')).toHaveAttribute('data-ut-variant-id');
    expect(menuPage.querySelector('[data-ut-section-type="footer"]')).toHaveAttribute('data-ut-variant-id');
    expect(menuPage.querySelector('input[type="date"]')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Preview Guest' } });
    fireEvent.change(screen.getByPlaceholderText('Your email'), { target: { value: 'guest@example.test' } });
    fireEvent.submit(screen.getByPlaceholderText('Your name').closest('form')!);

    const redirect = screen.getByRole('dialog', { name: 'Send hospitality inquiry' });
    expect(redirect).toHaveAttribute('data-unison-preview-redirect', 'contact.submit');
    expect(redirect).not.toHaveTextContent('guest@example.test');
    expect(window.location.pathname).toBe('/');
  });

  it('persists collection cart additions and quantity totals across remounts', async () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Pollen Objects' }));
    const collectionLink = screen.getByRole('link', { name: 'Shop the collection' });
    fireEvent.click(collectionLink);

    expect(window.location.hash).toBe('');
    expect(collectionLink).toHaveAttribute('data-ut-intent', 'nav.anchor');
    expect(screen.getByRole('region', { name: 'Pollen Objects page preview' })).toHaveAttribute('data-marketplace-current-section', 'collections');

    fireEvent.click(screen.getByRole('button', { name: /Add to bag/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add to bag/ }));
    await waitFor(() => expect(screen.getByLabelText('Bag item count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: /Bag/ }));
    const bag = screen.getByRole('dialog', { name: 'Shopping bag' });
    expect(within(bag).getByLabelText('The Sunday cup quantity')).toHaveTextContent('2');
    expect(bag).toHaveTextContent('Total: $76.00');
    fireEvent.click(within(bag).getByRole('button', { name: 'Increase The Sunday cup' }));
    await waitFor(() => expect(bag).toHaveTextContent('Total: $114.00'));
    cleanup();
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Pollen Objects' }));
    await waitFor(() => expect(screen.getByLabelText('Bag item count')).toHaveTextContent('3'));
    fireEvent.click(screen.getByRole('button', { name: /Bag/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove The Sunday cup' }));
    await waitFor(() => expect(screen.getByLabelText('Bag item count')).toHaveTextContent('0'));
  });

  it('simulates nonprofit donation redirects without launching checkout', () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Common Ground Fund' }));
    fireEvent.click(screen.getByRole('button', { name: 'Give today' }));

    const redirect = screen.getByRole('dialog', { name: 'Fund a neighborhood garden' });
    expect(redirect).toHaveAttribute('data-unison-preview-redirect', 'donation.start');
    expect(redirect).toHaveTextContent('does not take payments');
  });

  it('adds registered catalog products through the same persistent cart', async () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Pollen Objects' }));
    fireEvent.click(screen.getAllByRole('link', { name: 'Add to Bag', exact: true })[1]);
    await waitFor(() => expect(screen.getByLabelText('Bag item count')).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('button', { name: /Bag/ }));
    const bag = screen.getByRole('dialog', { name: 'Shopping bag' });
    expect(within(bag).getByLabelText('Field watch quantity')).toHaveTextContent('1');
    expect(bag).toHaveTextContent('Total: $165.00');
  });

  it('supports keyboard focus, Tab containment, Escape, and focus restoration', async () => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview Sorella House' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '6:30 PM' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'preview@example.test' } });
    const submitButton = screen.getByRole('button', { name: 'Request a table' });
    submitButton.focus();
    fireEvent.click(submitButton);

    const returnButton = screen.getByRole('button', { name: 'Return to Sorella House' });
    expect(returnButton).toHaveFocus();
    fireEvent.keyDown(returnButton, { key: 'Tab' });
    expect(returnButton).toHaveFocus();
    fireEvent.keyDown(returnButton, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Request a table' })).not.toBeInTheDocument();
    await waitFor(() => expect(submitButton).toHaveFocus());
  });

  it.each([
    { template: 'Formworks Studio', previewButton: 'Preview Formworks Studio', actionButton: 'Request a project conversation', intent: 'quote.request', overlay: 'quote' },
    { template: 'Relay Operations', previewButton: 'Preview Relay Operations', actionButton: 'Request a product demo', intent: 'demo.request', overlay: 'contact' },
  ])('redirects $template actions to the registered $overlay overlay', ({ previewButton, actionButton, intent, overlay }) => {
    render(<MarketplaceTemplateShowcase />);
    fireEvent.click(screen.getByRole('button', { name: previewButton }));

    const actionForm = screen.getByRole('button', { name: actionButton }).closest('form');
    expect(actionForm).not.toBeNull();
    fireEvent.submit(actionForm!);

    const redirect = screen.getByRole('dialog', { name: actionButton });
    expect(redirect).toHaveAttribute('data-unison-preview-redirect', intent);
    expect(redirect).toHaveTextContent('no form details are sent or saved');
  });
});
