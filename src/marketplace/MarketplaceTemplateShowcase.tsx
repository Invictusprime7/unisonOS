import { lazy, Suspense, useMemo, useState } from 'react';
import { Eye, LoaderCircle, Monitor, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildThemedIndexCss } from '@/components/onboarding/themePresetToIndexCss';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { compositionToReactFileSet } from '@/sections/compositionToFileSet';
import { ALL_COMPOSITIONS } from '@/sections/templates';
import type { TemplateComposition } from '@/sections/types';
import { ART_DIRECTION_PACKS, resolveArtDirectionPack } from '@/sections/variants/artDirectionPacks';

const VFSPreview = lazy(() => import('@/components/VFSPreview').then((module) => ({ default: module.VFSPreview })));

type PreviewDevice = 'desktop' | 'mobile';

const previewCategories = Array.from(new Set(ALL_COMPOSITIONS.map((template) => template.category))).sort();
const defaultThemePresetId = THEME_PRESETS.find((preset) => preset.id === 'editorial')?.id ?? THEME_PRESETS[0].id;

function getPreviewArtDirectionPack(template: TemplateComposition, themePresetId: string, packId: string) {
  return resolveArtDirectionPack({
    sealedPackId: packId === 'auto' ? undefined : packId,
    industry: template.industry,
    themePresetId,
    seed: `marketplace-preview:${template.id}`,
  });
}

export function MarketplaceTemplateShowcase() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [themePresetId, setThemePresetId] = useState(defaultThemePresetId);
  const [artDirectionPackId, setArtDirectionPackId] = useState('auto');
  const [activeTemplate, setActiveTemplate] = useState<TemplateComposition | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const visibleTemplates = ALL_COMPOSITIONS.filter((template) => {
    const matchesCategory = category === 'all' || template.category === category;
    const searchText = `${template.name} ${template.description} ${template.category} ${(template.tags ?? []).join(' ')}`;
    return matchesCategory && searchText.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });

  const previewFiles = useMemo(() => {
    if (!activeTemplate) return {};
    const themePreset = THEME_PRESETS.find((preset) => preset.id === themePresetId) ?? THEME_PRESETS[0];
    const seed = `marketplace-preview:${activeTemplate.id}`;
    const artDirectionPack = getPreviewArtDirectionPack(activeTemplate, themePreset.id, artDirectionPackId);
    return {
      ...compositionToReactFileSet(activeTemplate, '/src/pages/Home.tsx', {
        designIntervention: {
          sectionVariants: [],
          industry: activeTemplate.industry,
          themePresetId: themePreset.id,
          artDirectionPackId: artDirectionPack.id,
          seed,
        },
      }),
      '/src/App.tsx': "import Page from './pages/Home';\nexport default function App() { return <Page />; }\n",
      '/src/index.css': buildThemedIndexCss(themePreset, {
        sealedPackId: artDirectionPack.id,
        industry: activeTemplate.industry,
        seed,
      }),
    };
  }, [activeTemplate, artDirectionPackId, themePresetId]);

  function openPreview(template: TemplateComposition) {
    setPreviewError(null);
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
            {visibleTemplates.map((template) => (
              <li key={template.id} className="flex min-h-36 flex-col border-t border-border py-4">
                <p className="text-xs capitalize text-muted-foreground">
                  {template.category} · {getPreviewArtDirectionPack(template, themePresetId, artDirectionPackId).name}
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
            ))}
          </ul>
        )}
      </section>

      <Dialog open={activeTemplate !== null} onOpenChange={(open) => !open && setActiveTemplate(null)}>
        <DialogContent className="flex h-[92dvh] max-w-7xl flex-col gap-0 rounded-none p-0">
          <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-border px-4 py-3 pr-12 text-left">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold">{activeTemplate?.name} live preview</DialogTitle>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {activeTemplate?.category} · {activeTemplate && getPreviewArtDirectionPack(activeTemplate, themePresetId, artDirectionPackId).name}
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
              ) : activeTemplate ? (
                <Suspense fallback={<div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Preparing live preview</div>}>
                  <VFSPreview
                    key={activeTemplate.id}
                    nodes={[]}
                    files={previewFiles}
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