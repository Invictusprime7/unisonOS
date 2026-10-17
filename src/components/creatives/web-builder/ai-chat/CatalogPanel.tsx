import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageIcon, Package, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { getCatalogSurface } from '@/platform/core/catalogSurfaceRegistry';
import { agentOperations } from '@/services/agent-runtime/operations';
import { dispatchBuilderOperation } from '@/services/unisonBuilderToolDispatch';
import { createUnisonBuilderContext } from '@/services/unisonBuilderConnector';
import { EDITABLE_CATALOG_SURFACES, type CatalogItem, type CatalogPatch } from '@/services/agent-runtime/catalogOps';
import { applyAIBuilderFiles, type AIBuilderApplyCallback } from '@/services/aiBuilderApply';

export const OPEN_CATALOG_EVENT = 'unison:open-catalog';

interface Props {
  files: Record<string, string>;
  businessId?: string | null;
  onApply: AIBuilderApplyCallback;
}

/**
 * Owner-facing catalog editor. Every action goes through agentOperations —
 * the same catalog actions the AI uses — so the database row changes first
 * and the preview follows through the normal save.
 */
export function CatalogPanel({ files, businessId, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [tab, setTab] = useState<string>('services');
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<CatalogItem | null>(null);
  const ctx = useMemo(() => ({ files, businessId }), [files, businessId]);
  const connector = useMemo(() => createUnisonBuilderContext({ businessId: businessId ?? null }), [businessId]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CATALOG_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CATALOG_EVENT, onOpen);
  }, []);

  const reload = async () => {
    setItems(null);
    try { setItems(await agentOperations.inspect_catalog(ctx)); }
    catch { setItems([]); toast.error('Could not load your catalog.'); }
  };
  useEffect(() => { if (open) void reload(); }, [open, businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (item: CatalogItem, patch: CatalogPatch) => {
    setBusy(item.id);
    try {
      const { change, summary, item: next } = await dispatchBuilderOperation(connector, ctx, 'update_catalog_item', item.surfaceId, item.id, patch);
      setItems((prev) => prev?.map((i) => (i.id === item.id ? next : i)) ?? prev);
      if (change) {
        const outcome = await applyAIBuilderFiles(onApply, change.files, { summary, origin: 'command-menu' });
        if (outcome.success) toast.success(`${summary} — preview updated`);
        else toast.warning(`${summary}. The preview couldn't be updated: ${outcome.errors?.[0] ?? 'save failed'}`);
      } else {
        toast.success(summary);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That change was not saved.');
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    try {
      const item = await dispatchBuilderOperation(connector, ctx, 'create_catalog_item', tab, { name: `New ${getCatalogSurface(tab)?.rowLabel ?? 'item'}`, price: 0 });
      setItems((prev) => [...(prev ?? []), item]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add an item.');
    }
  };

  const upload = async (file: File) => {
    const item = uploadFor.current;
    if (!item) return;
    setBusy(item.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Sign in to upload catalog photos.');
      const path = `${auth.user.id}/catalog/${item.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      // Workspace blocks public buckets: store in the owner's private files
      // and use a long-lived signed link (10 years) for the site.
      const { error } = await supabase.storage.from('user-files').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage.from('user-files').createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error('Could not create a link for the photo.');
      await save(item, { image_url: data.signedUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Photo upload failed.');
      setBusy(null);
    }
  };

  const shown = (items ?? []).filter((i) => i.surfaceId === tab);
  const label = getCatalogSurface(tab)?.friendlyName ?? 'Items';

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Open products and services">
        <Package className="h-4 w-4" /> Catalog
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Products &amp; services</SheetTitle>
            <SheetDescription>Changes save to your business records and update the site.</SheetDescription>
          </SheetHeader>
          {!businessId ? (
            <p className="mt-6 text-sm text-muted-foreground">This site isn't linked to a business yet.</p>
          ) : (
            <>
              <Tabs value={tab} onValueChange={setTab} className="mt-4">
                <TabsList className="w-full">
                  {EDITABLE_CATALOG_SURFACES.map((s) => (
                    <TabsTrigger key={s} value={s} className="flex-1">{getCatalogSurface(s)?.friendlyName ?? s}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <ul className="mt-4 space-y-3" aria-busy={items === null}>
                {items === null && <li className="text-sm text-muted-foreground">Loading…</li>}
                {items !== null && shown.length === 0 && (
                  <li className="text-sm text-muted-foreground">No {label.toLowerCase()} yet. Add your first one below.</li>
                )}
                {shown.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                    <button
                      type="button"
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted"
                      aria-label={`Change photo for ${item.name}`}
                      onClick={() => { uploadFor.current = item; fileInput.current?.click(); }}
                    >
                      {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        defaultValue={item.name}
                        aria-label="Name"
                        onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v && v !== item.name) void save(item, { name: v }); }}
                      />
                      <Input
                        defaultValue={item.price ?? ''}
                        inputMode="decimal"
                        aria-label={`Price for ${item.name}`}
                        placeholder="Price"
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        onBlur={(e) => {
                          const raw = e.currentTarget.value.replace(/[^0-9.]/g, '');
                          const n = Number(raw);
                          if (raw && Number.isFinite(n) && n !== item.price) void save(item, { price: n });
                        }}
                      />
                    </div>
                    <Switch
                      checked={item.active}
                      disabled={busy === item.id}
                      aria-label={item.active ? `Hide ${item.name}` : `Show ${item.name}`}
                      onCheckedChange={(v) => void save(item, { active: v })}
                    />
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-4 w-full" onClick={add}>
                <Plus className="h-4 w-4" /> Add {getCatalogSurface(tab)?.rowLabel ?? 'item'}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
