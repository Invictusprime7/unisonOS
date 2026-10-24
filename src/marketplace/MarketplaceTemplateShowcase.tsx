import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Eye, Monitor, Smartphone, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AUTHORED_MARKETPLACE_TEMPLATES,
  marketplaceBindingAttributes,
  resolveMarketplaceTemplateBinding,
  type AuthoredMarketplaceTemplate,
  type MarketplaceTemplateBinding,
  type ResolvedMarketplaceTemplateBinding,
} from '@/marketplace/authoredTemplatePreviews';
import { MarketplaceRegisteredSection, MARKETPLACE_TEMPLATE_VARIANT_PROFILES } from '@/marketplace/MarketplaceRegisteredSection';
import { pageArchetypeIssues, resolvePageArchetype } from '@/sections/pageArchetypeContract';
import type { MarketplacePreviewSection, MarketplaceTemplatePage } from '@/marketplace/marketplaceTemplatePrimitives';
import { MarketplaceThumbnailSurface } from '@/marketplace/MarketplaceThumbnailSurface';
import { MarketplaceCartCountContext, MarketplacePreviewCart } from '@/marketplace/MarketplacePreviewCart';
import { BROWSER_CART_EVENT, buildBrowserCartStorageKey, createBrowserCartManager, readBrowserCart } from '@/runtime/browserCartManager';
import type { Cart } from '@/runtime/intentExecutor';

type PreviewDevice = 'desktop' | 'mobile';

const previewCategories = Array.from(new Set(AUTHORED_MARKETPLACE_TEMPLATES.map((template) => template.category))).sort();

function routeUnboundPreviewAnchor(event: MouseEvent<HTMLDivElement>, template: AuthoredMarketplaceTemplate | null) {
  if (!template) return;
  const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  const targetSectionId = anchor?.getAttribute('href')?.slice(1);
  if (!anchor || !targetSectionId || anchor.hasAttribute('data-ut-cta')) return;

  event.preventDefault();
  event.stopPropagation();
  const label = anchor.textContent?.trim() || 'Open section';
  const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  const binding = {
    id: `${template.id}:content-link:${labelSlug}`,
    intent: 'nav.anchor',
    label,
    sourceSection: 'content',
    sourceSlot: 'internal-link',
    targetSectionId,
  } satisfies MarketplaceTemplateBinding;
  for (const [name, value] of Object.entries(marketplaceBindingAttributes(binding))) {
    anchor.setAttribute(name, value);
  }

  const target = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[id]'))
    .find((element) => element.id === targetSectionId);
  event.currentTarget.setAttribute('data-marketplace-current-section', targetSectionId);
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function MarketplaceIntentRedirect({
  template,
  binding,
  onClose,
}: {
  template: AuthoredMarketplaceTemplate;
  binding: ResolvedMarketplaceTemplateBinding;
  onClose: () => void;
}) {
  const returnButtonRef = useRef<HTMLButtonElement>(null);
  const theme = template.intentPreviewTheme ?? (template.id === 'relay-operations'
    ? { surface: 'bg-[#111916] text-[#f2f4e9]', border: 'border-white/15', muted: 'text-white/65', button: 'bg-[#c8f169] text-[#111916]' }
    : template.id === 'formworks-studio'
      ? { surface: 'bg-[#f7f8f5] text-[#182c3a]', border: 'border-[#182c3a]/20', muted: 'text-[#5a6870]', button: 'bg-[#f05a3b] text-white' }
      : { surface: 'bg-[#f3efe4] text-[#203b2c]', border: 'border-[#203b2c]/20', muted: 'text-[#536254]', button: 'bg-[#a34a32] text-white' });
  const flowLabel = 'Sample action';
  const flowDescription = binding.definition.surface === 'redirect'
    ? 'This sample does not take payments or start an external checkout.'
    : 'Your sample request is complete. No real reservation or business request was created.';

  useEffect(() => {
    returnButtonRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      returnButtonRef.current?.focus();
    }
  }

  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm" onKeyDown={handleKeyDown}>
      <section role="dialog" aria-modal="true" aria-labelledby="marketplace-intent-title" aria-describedby="marketplace-intent-description" data-unison-preview-redirect={binding.definition.name} className={`my-auto w-full max-w-xl overflow-hidden border shadow-2xl ${theme.surface} ${theme.border}`}>
        <img src={template.coverImage} alt="" className="h-36 w-full object-cover" />
        <div className="p-5 sm:p-7">
          <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${theme.muted}`}>{flowLabel}</p>
          <h2 id="marketplace-intent-title" className="mt-3 text-2xl font-semibold">{binding.label}</h2>
          <p id="marketplace-intent-description" className={`mt-3 text-sm leading-6 ${theme.muted}`}>
            {flowDescription}
          </p>
          <p className={`mt-4 text-xs ${theme.muted}`}>Sample only; no form details are sent or saved.</p>
          <button ref={returnButtonRef} type="button" onClick={onClose} className={`mt-6 inline-flex min-h-11 items-center justify-center px-4 text-sm font-semibold ${theme.button}`}>
            Return to {template.name}
          </button>
        </div>
      </section>
    </div>
  );
}

function MarketplaceTemplateRoutePage({
  template,
  page,
  onIntent,
  onNavigate,
}: {
  template: AuthoredMarketplaceTemplate;
  page: MarketplaceTemplatePage;
  onIntent: (binding: MarketplaceTemplateBinding) => void;
  onNavigate: (path: string) => void;
}) {
  const templateId = template.id as keyof typeof MARKETPLACE_TEMPLATE_VARIANT_PROFILES;
  const calendarFields = ['Hospitality', 'Beauty & Wellness', 'Fitness & Movement', 'Boutique Lodging', 'Photography'].includes(template.category)
    ? [{ name: 'preferredDate', type: 'date', placeholder: 'Preferred date' }]
    : [];
  const routeSections: MarketplacePreviewSection[] = [
    ...page.sections,
    {
      id: `${page.id}-cta`,
      type: 'cta',
      props: {
        headline: `Continue with ${page.title.toLowerCase()}`,
        description: page.description,
        ctas: [{ label: `Ask about ${page.label.toLowerCase()}`, href: `#${page.id}-contact` }],
      },
    },
    {
      id: `${page.id}-contact`,
      type: 'contact',
      props: {
        headline: `Talk with ${template.name}`,
        description: `Send a preview-only ${template.category.toLowerCase()} inquiry about ${page.title.toLowerCase()}.`,
        fields: [
          { name: 'name', type: 'text', placeholder: 'Your name', required: true },
          { name: 'email', type: 'email', placeholder: 'Your email', required: true },
          ...calendarFields,
          { name: 'message', type: 'textarea', placeholder: `Tell us about ${page.label.toLowerCase()}`, required: true },
        ],
        submitLabel: `Send ${template.category.toLowerCase()} inquiry`,
        submitIntent: 'contact.submit',
      },
    },
  ];
  const footerSection: MarketplacePreviewSection = {
    id: `${template.id}-route-footer`,
    type: 'footer',
    props: {
      brand: template.name,
      layout: 'centered-minimal',
      copyright: 'Concept preview - no inquiry details are sent or saved',
    },
  };
  const navigationSection: MarketplacePreviewSection = {
    id: `${template.id}-${page.id}-navigation`,
    type: 'navbar',
    props: {
      brand: template.name,
      links: [{ label: 'Home', href: '/' }, ...template.pages.map(({ label, path }) => ({ label, href: path }))],
      layout: 'standard',
    },
  };
  const archetype = resolvePageArchetype(page.archetype, template.category);
  const archetypeIssuesFound = pageArchetypeIssues(page.archetype, routeSections.map((section) => section.type), {}, { industry: template.category });
  if (archetypeIssuesFound.length > 0) {
    throw new Error(`Marketplace route ${template.id}${page.path} violates its ${page.archetype} archetype: ${archetypeIssuesFound.join('; ')}`);
  }
  return (
    <main
      data-marketplace-current-route={page.path}
      data-marketplace-template-id={template.id}
      data-marketplace-theme-family={MARKETPLACE_TEMPLATE_VARIANT_PROFILES[templateId].artDirectionPackId}
      data-marketplace-page-archetype={page.archetype}
      data-ut-page-role={page.archetype}
      data-marketplace-required-families={archetype.requiredFamilies.join(',')}
      data-marketplace-archetype-purpose={archetype.purpose}
      style={{ backgroundColor: `hsl(${template.theme.colors.background})`, color: `hsl(${template.theme.colors.foreground})`, fontFamily: template.theme.typography.bodyFont }}
    >
      <header className="border-b px-5 py-4" style={{ backgroundColor: `hsl(${template.theme.colors.background})`, borderColor: `hsl(${template.theme.colors.border})` }}>
        <MarketplaceRegisteredSection
          templateId={templateId}
          section={navigationSection}
          theme={template.theme}
          pages={template.pages}
          onNavigate={onNavigate}
        />
      </header>
      <section className="grid gap-6 border-b px-7 py-10 sm:px-12 md:grid-cols-[1fr_0.7fr]" style={{ backgroundColor: `hsl(${template.theme.colors.muted})`, borderColor: `hsl(${template.theme.colors.border})` }}>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: `hsl(${template.theme.colors.mutedForeground})` }}>{template.category} · {page.path}</p>
          <h1 className="mt-3 text-4xl font-semibold" style={{ color: `hsl(${template.theme.colors.foreground})`, fontFamily: template.theme.typography.headingFont }}>{page.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: `hsl(${template.theme.colors.mutedForeground})` }}>{page.description}</p>
        </div>
      </section>
      {routeSections.map((section) => (
        <section key={section.id} id={section.id} className="border-b border-border">
          <MarketplaceRegisteredSection
            templateId={templateId}
            section={section}
            variantId={section.variantId}
            theme={template.theme}
            onIntent={onIntent}
          />
        </section>
      ))}
      <MarketplaceRegisteredSection templateId={templateId} section={footerSection} theme={template.theme} onIntent={onIntent} />
    </main>
  );
}

export function MarketplaceTemplateShowcase({ children }: { children?: ReactNode }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeTemplate, setActiveTemplate] = useState<AuthoredMarketplaceTemplate | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [activePagePath, setActivePagePath] = useState('/');
  const [previewAction, setPreviewAction] = useState<{
    templateId: string;
    binding: ResolvedMarketplaceTemplateBinding;
  } | null>(null);
  const previewActionTriggerRef = useRef<HTMLElement | null>(null);
  const previewSurfaceRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<Cart>({ id: 'concept', items: [], total: 0 });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!activeTemplate) return;
    const context = { siteId: `marketplace-concept:${activeTemplate.id}` };
    const storageKey = buildBrowserCartStorageKey(context);
    const refresh = () => setCart(readBrowserCart(context));
    const handleCart = (event: Event) => {
      if ((event as CustomEvent).detail?.storageKey === storageKey) refresh();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(BROWSER_CART_EVENT, handleCart);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(BROWSER_CART_EVENT, handleCart);
      window.removeEventListener('storage', handleStorage);
    };
  }, [activeTemplate]);

  const visibleTemplates = AUTHORED_MARKETPLACE_TEMPLATES.filter((template) => {
    const matchesCategory = category === 'all' || template.category === category;
    const searchText = `${template.name} ${template.description} ${template.category} ${template.artDirection}`;
    return matchesCategory && searchText.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });

  function openPreview(template: AuthoredMarketplaceTemplate) {
    setDevice('desktop');
    setActivePagePath('/');
    setActiveTemplate(template);
    setPreviewAction(null);
    setCartOpen(false);
  }

  function navigatePage(path: string) {
    setActivePagePath(path);
    setPreviewAction(null);
    requestAnimationFrame(() => previewSurfaceRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function showPreviewAction(template: AuthoredMarketplaceTemplate, binding: MarketplaceTemplateBinding) {
    const resolved = resolveMarketplaceTemplateBinding(binding);
    if (resolved.intent === 'cart.add' && binding.product) {
      void createBrowserCartManager({ siteId: `marketplace-concept:${template.id}` }).add(binding.product);
      setPreviewAction(null);
      return;
    }
    if (resolved.intent === 'cart.view') {
      setCartOpen(true);
      setPreviewAction(null);
      return;
    }
    if (binding.targetSectionId && resolved.definition.surface === 'client') {
      setPreviewAction(null);
      return;
    }
    previewActionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreviewAction({ templateId: template.id, binding: resolved });
  }

  function closePreviewAction() {
    const trigger = previewActionTriggerRef.current;
    setPreviewAction(null);
    requestAnimationFrame(() => trigger?.focus());
  }

  return (
    <>
      <section aria-labelledby="marketplace-live-previews-title" className="border-y border-border py-7">
        <div className="mb-5 flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Concept previews</p>
          <h2 id="marketplace-live-previews-title" className="text-xl font-semibold tracking-tight">Designed for a point of view</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Individually authored website previews with distinct audiences, page structures, and visual systems. Concepts are not certified marketplace releases and cannot be purchased or installed.
          </p>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Sample photography, names, and testimonials are illustrative placeholders, not real client endorsements.
          </p>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Search previews
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, industry, or design"
              className="h-10 rounded-none border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Template category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-none border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All categories</option>
              {previewCategories.map((item) => (
                <option key={item} value={item}>{item.replace(/-/g, ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        {visibleTemplates.length === 0 ? (
          <p className="border-t border-border py-6 text-sm text-muted-foreground">No previews match these filters.</p>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((template) => (
              <li key={template.id} className="flex min-h-36 flex-col border-t border-border py-4">
                <MarketplaceThumbnailSurface src={template.coverImage} category={template.category} />
                <p className="text-xs text-muted-foreground">{template.artDirection}</p>
                <h3 className="mt-1 text-base font-medium">{template.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{template.description}</p>
                <button
                  type="button"
                  onClick={() => openPreview(template)}
                  aria-label={`Preview ${template.name}`}
                  className="mt-4 inline-flex min-h-9 w-fit items-center gap-2 border border-input px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Eye aria-hidden="true" className="h-4 w-4" /> Preview design
                </button>
              </li>
            ))}
          </ul>
        )}
        {children}
      </section>

      <Dialog open={activeTemplate !== null} onOpenChange={(open) => !open && setActiveTemplate(null)}>
        <DialogContent className="flex h-[92dvh] max-w-7xl flex-col gap-0 rounded-none p-0">
          <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-border px-4 py-3 pr-12 text-left">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold">{activeTemplate?.name} design preview</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">{activeTemplate?.category} · {activeTemplate?.artDirection} · Concept preview only</p>
            </div>
            <div aria-label="Preview size" className="flex shrink-0 border border-border">
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                aria-label="Desktop preview"
                aria-pressed={device === 'desktop'}
                className={`grid h-9 w-10 place-items-center rounded-none ${device === 'desktop' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Monitor aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDevice('mobile')}
                aria-label="Mobile preview"
                aria-pressed={device === 'mobile'}
                className={`grid h-9 w-10 place-items-center rounded-none border-l border-border ${device === 'mobile' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Smartphone aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted/30 p-2 sm:p-4">
            <div
              role="region"
              aria-label={`${activeTemplate?.name ?? 'Template'} page preview`}
              data-marketplace-preview-surface
              data-marketplace-current-route={activePagePath}
              onClickCapture={(event) => routeUnboundPreviewAnchor(event, activeTemplate)}
              ref={previewSurfaceRef}
              className="relative h-full min-h-0 overflow-y-auto overscroll-contain rounded-none border border-border bg-background"
            >
              {activeTemplate && (
                <MarketplaceCartCountContext.Provider value={cart.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)}>
                  <div className={`mx-auto min-h-full ${device === 'mobile' ? 'max-w-[390px] border-x border-border' : 'w-full'}`}>
                    {activePagePath === '/' ? (
                      <activeTemplate.preview
                        compact={device === 'mobile'}
                        templateId={activeTemplate.id}
                        templateName={activeTemplate.name}
                        pages={activeTemplate.pages}
                        currentPagePath={activePagePath}
                        onNavigate={navigatePage}
                        onIntent={(binding) => showPreviewAction(activeTemplate, binding)}
                      />
                    ) : (() => {
                      const page = activeTemplate.pages.find((candidate) => candidate.path === activePagePath);
                      return page ? (
                        <MarketplaceTemplateRoutePage
                          template={activeTemplate}
                          page={page}
                          onIntent={(binding) => showPreviewAction(activeTemplate, binding)}
                          onNavigate={navigatePage}
                        />
                      ) : null;
                    })()}
                  </div>
                  {previewAction?.templateId === activeTemplate.id && previewAction.binding.definition.surface !== 'client' && (
                    <MarketplaceIntentRedirect
                      template={activeTemplate}
                      binding={previewAction.binding}
                      onClose={closePreviewAction}
                    />
                  )}
                  <MarketplacePreviewCart cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} onUpdate={(productId, quantity) => {
                    void createBrowserCartManager({ siteId: `marketplace-concept:${activeTemplate.id}` }).update(productId, quantity);
                  }} />
                </MarketplaceCartCountContext.Provider>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}