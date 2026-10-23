import { lazy, Suspense, useEffect, useState } from 'react';
import { Eye, LoaderCircle, Monitor, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import type { TemplateComposition } from '@/sections/types';
import { ART_DIRECTION_PACKS, resolveArtDirectionPack } from '@/sections/variants/artDirectionPacks';
import type { CuratedMarketplaceTemplate } from '@/marketplace/curateMarketplaceTemplate';
import { getMarketplaceTemplateDesignPreset, getMarketplaceTemplateStylePresetId } from '@/marketplace/templateDesignPresets';

const VFSPreview = lazy(() => import('@/components/VFSPreview').then((module) => ({ default: module.VFSPreview })));

type PreviewDevice = 'desktop' | 'mobile';

const previewCategories = Array.from(new Set(ALL_COMPOSITIONS.map((template) => template.category))).sort();
const TEMPLATE_STYLE_PRESET = 'template';
const TEMPLATE_ART_DIRECTION = 'template';

function resolveThemePreset(template: TemplateComposition, selection: string) {
  const presetId = selection === TEMPLATE_STYLE_PRESET
    ? getMarketplaceTemplateStylePresetId(template.id)
    : selection;
  return THEME_PRESETS.find((preset) => preset.id === presetId) ?? THEME_PRESETS[0];
}

function getPreviewArtDirectionPack(template: TemplateComposition, themePresetId: string, packId: string) {
  const sealedPackId = packId === TEMPLATE_ART_DIRECTION
    ? getMarketplaceTemplateDesignPreset(template.id).artDirectionPackId
    : packId === 'auto' ? undefined : packId;
  return resolveArtDirectionPack({
    sealedPackId,
    industry: template.industry,
    themePresetId,
    seed: `marketplace-preview:${template.id}`,
  });
}

export function MarketplaceTemplateShowcase() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [themePresetId, setThemePresetId] = useState(TEMPLATE_STYLE_PRESET);
  const [artDirectionPackId, setArtDirectionPackId] = useState(TEMPLATE_ART_DIRECTION);
  const [activeTemplate, setActiveTemplate] = useState<TemplateComposition | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [curatedTemplate, setCuratedTemplate] = useState<CuratedMarketplaceTemplate | null>(null);
  const [curationLoading, setCurationLoading] = useState(false);

  const visibleTemplates = ALL_COMPOSITIONS.filter((template) => {
    const matchesCategory = category === 'all' || template.category === category;
    const searchText = `${template.name} ${template.description} ${template.category} ${(template.tags ?? []).join(' ')}`;
    return matchesCategory && searchText.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });

  useEffect(() => {
    if (!activeTemplate) {
      setCuratedTemplate(null);
      setCurationLoading(false);
      return;
    }

    let current = true;
    const themePreset = resolveThemePreset(activeTemplate, themePresetId);
    setCuratedTemplate(null);
    setPreviewError(null);
    setCurationLoading(true);
    void import('@/marketplace/curateMarketplaceTemplate').then(({ curateMarketplaceTemplate }) => {
      const curated = curateMarketplaceTemplate(
        activeTemplate,
        themePreset,
        artDirectionPackId === TEMPLATE_ART_DIRECTION
          ? getMarketplaceTemplateDesignPreset(activeTemplate.id).artDirectionPackId
          : artDirectionPackId === 'auto' ? undefined : artDirectionPackId,
      );
      if (current) setCuratedTemplate(curated);
    }).catch((error: unknown) => {
      if (current) setPreviewError(error instanceof Error ? error.message : 'Template curation failed.');
    }).finally(() => {
      if (current) setCurationLoading(false);
    });

    return () => { current = false; };
  }, [activeTemplate, artDirectionPackId, themePresetId]);

  function openPreview(template: TemplateComposition) {
    setPreviewError(null);
    setCuratedTemplate(null);
    setDevice('desktop');
    setActiveTemplate(template);
  }

  return (
    <>
      <section aria-labelledby="marketplace-live-previews-title" className="border-y border-border py-7">
        <div className="mb-5 flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Unison composition library</p>
          <h2 id="marketplace-live-previews-title" className="text-xl font-semibold tracking-tight">Live template previews</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Interactive previews of real section-registry compositions. These are preview-only, not certified marketplace releases.
          </p>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Search previews
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, industry, or feature"
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
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Style card
            <select
              value={themePresetId}
              onChange={(event) => setThemePresetId(event.target.value)}
              className="h-10 rounded-none border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={TEMPLATE_STYLE_PRESET}>Template design</option>
              {THEME_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Art direction
            <select
              value={artDirectionPackId}
              onChange={(event) => setArtDirectionPackId(event.target.value)}
              className="h-10 rounded-none border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={TEMPLATE_ART_DIRECTION}>Template direction</option>
              <option value="auto">Recommended for industry</option>
              {Object.values(ART_DIRECTION_PACKS).map((pack) => (
                <option key={pack.id} value={pack.id}>{pack.name}</option>
              ))}
            </select>
          </label>
        </div>

        {visibleTemplates.length === 0 ? (
          <p className="border-t border-border py-6 text-sm text-muted-foreground">No previews match these filters.</p>
        ) : (
          <ul className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((template) => {
              const templateTheme = resolveThemePreset(template, themePresetId);
              const artDirection = getPreviewArtDirectionPack(template, templateTheme.id, artDirectionPackId);
              return (
                <li key={template.id} className="flex min-h-36 flex-col border-t border-border py-4">
                  <p className="text-xs capitalize text-muted-foreground">
                    {template.category} · {templateTheme.label} · {artDirection.name}
                  </p>
                  <h3 className="mt-1 text-base font-medium">{template.name}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{template.description}</p>
                  <button
                    type="button"
                    onClick={() => openPreview(template)}
                    aria-label={`Preview ${template.name} live`}
                    className="mt-4 inline-flex min-h-9 w-fit items-center gap-2 border border-input px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" /> Live preview
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={activeTemplate !== null} onOpenChange={(open) => !open && setActiveTemplate(null)}>
        <DialogContent className="flex h-[92dvh] max-w-7xl flex-col gap-0 rounded-none p-0">
          <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-border px-4 py-3 pr-12 text-left">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold">{activeTemplate?.name} live preview</DialogTitle>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {curatedTemplate && activeTemplate
                  ? `${curatedTemplate.contract.business.industry} · ${resolveThemePreset(activeTemplate!, themePresetId).label} · ${curatedTemplate.designSourceBundle.identity.artDirectionPackId} · ${curatedTemplate.routeCount} pages · ${curatedTemplate.intentCount} bindings · ${curatedTemplate.portableRecipeCount} portable recipes`
                  : `${activeTemplate?.category} · ${activeTemplate && resolveThemePreset(activeTemplate, themePresetId).label} · ${activeTemplate && getPreviewArtDirectionPack(activeTemplate, resolveThemePreset(activeTemplate, themePresetId).id, artDirectionPackId).name}`}
              </p>
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
            <div className="h-full overflow-hidden rounded-none border border-border bg-white">
              {previewError ? (
                <p role="alert" className="p-4 text-sm text-destructive">Live preview could not be rendered: {previewError}</p>
              ) : curationLoading || !curatedTemplate ? (
                <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Curating routes, intents, and portable recipes
                </div>
              ) : activeTemplate ? (
                <Suspense fallback={<div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Preparing live preview</div>}>
                  <VFSPreview
                    key={activeTemplate.id}
                    nodes={[]}
                    files={curatedTemplate.files}
                    forceBackend="sandpack"
                    device={device}
                    showToolbar={false}
                    showConsole={false}
                    showBackendIndicator={false}
                    enableSelection={false}
                    className="rounded-none border-0"
                    onError={setPreviewError}
                  />
                </Suspense>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}