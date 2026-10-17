import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { type CatalogTable } from '@/services/agent-runtime/operations';
import { dispatchBuilderOperation } from '@/services/unisonBuilderToolDispatch';
import { createUnisonBuilderContext } from '@/services/unisonBuilderConnector';
import type { BuilderFeatures } from '@/services/builder/builderFeatures';
import { captureBuilderRequestState, type BuilderRequestState } from '@/services/builder/builderRequestState';
import { buildSystemGraph } from '@/services/agent-runtime/systemGraph';
import { emitAgentEvent, onAgentEvent, type AgentEvent } from '@/services/agent-runtime/agentEvents';
import { applyAIBuilderFiles, type AIBuilderApplyCallback } from '@/services/aiBuilderApply';

const FONTS = ['Inter', 'Playfair Display', 'DM Sans', 'Cormorant Garamond', 'Space Grotesk'];

interface Props {
  files: Record<string, string>;
  onApply: AIBuilderApplyCallback;
  onAsk: (prompt: string) => void;
  businessId?: string | null;
  revisionId?: string | null;
  projectId?: string | null;
  features: BuilderFeatures;
  getCurrentRequestState?: () => BuilderRequestState;
}

type Mode = 'root' | 'font' | 'map' | 'changes' | 'catalog' | 'price' | 'image';
type CatalogRow = { table: CatalogTable; id: string; name: string; price: number | null; image: string | null };
const EDITABLE: CatalogTable[] = ['products', 'services', 'menu_items', 'pricing_plans'];
type ChangeEntry = AgentEvent & { at: number };

/**
 * Ctrl/Cmd+K. Every action calls the same agent-runtime operations and the
 * same save path the AI uses — the menu has no capabilities of its own.
 */
export function AgentCommandPalette({ files, onApply, onAsk, businessId, revisionId, projectId, getCurrentRequestState, features }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('root');
  const [query, setQuery] = useState('');
  const graph = useMemo(
    () => (open ? buildSystemGraph({ files, revisionId }) : null),
    [open, files, revisionId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('unison:open-command-tools', onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('unison:open-command-tools', onOpen); };
  }, []);

  const [catalog, setCatalog] = useState<CatalogRow[] | null>(null);
  const [picked, setPicked] = useState<CatalogRow | null>(null);
  useEffect(() => {
    if (mode !== 'catalog' || catalog) return;
    if (!businessId) { setCatalog([]); return; }
    Promise.all(EDITABLE.map(async (table) => {
      const state = captureBuilderRequestState(getCurrentRequestState?.() ?? { files, projectId: projectId ?? null, businessId: businessId ?? null, revisionId: revisionId ?? null });
      const connector = createUnisonBuilderContext(state);
      const rows = (await dispatchBuilderOperation(connector, { ...state, features }, 'inspect_data', table, 50).catch(() => [])) as Record<string, unknown>[];
      return rows.map((r) => ({
        table, id: String(r.id), name: String(r.name ?? 'Untitled'),
        price: r.price != null ? Number(r.price) : r.price_cents != null ? Number(r.price_cents) / 100 : null,
        image: typeof r.image_url === 'string' ? r.image_url : null,
      }));
    })).then((all) => setCatalog(all.flat()));
  }, [mode, catalog, businessId, files]);

  const saveCatalog = async (raw: string) => {
    if (!picked) return;
    const value = raw.trim();
    const patch = mode === 'price' ? { price: Number(value.replace(/[^0-9.]/g, '')) } : { image_url: value };
    if (mode === 'price' && !(typeof patch.price === 'number' && patch.price >= 0 && value)) { toast.error('Type a number, e.g. 49.99'); return; }
    if (mode === 'image' && !/^https:\/\//.test(value)) { toast.error('Paste an image link starting with https://'); return; }
    setOpen(false);
    try {
      const state = captureBuilderRequestState(getCurrentRequestState?.() ?? { files, projectId: projectId ?? null, businessId: businessId ?? null, revisionId: revisionId ?? null });
      const connector = createUnisonBuilderContext(state);
      const { change, summary } = await dispatchBuilderOperation(connector, { ...state, features }, 'update_catalog_item', picked.table, picked.id, patch);
      emitAgentEvent({ kind: 'data_change', message: summary, status: 'ok' });
      setCatalog(null);
      if (change) await run(change); else toast.success(`${summary}. The page didn't show the old value, so only the database changed.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The item could not be saved.');
    }
  };

  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  useEffect(() => onAgentEvent((e, at) => {
    if (e.kind !== 'file_change' && e.kind !== 'commit' && e.kind !== 'rollback') return;
    setChanges((prev) => [{ ...e, at }, ...prev].slice(0, 50));
  }), []);

  useEffect(() => { if (!open) { setMode('root'); setQuery(''); setPicked(null); } }, [open]);

  const run = async (change: { files: Record<string, string>; summary: string } | null) => {
    setOpen(false);
    if (!change) { toast.error('That change could not be prepared for this site.'); return; }
    emitAgentEvent({ kind: 'tool_call', message: change.summary, status: 'running' });
    const outcome = await applyAIBuilderFiles(onApply, change.files, { summary: change.summary, origin: 'command-menu' });
    if (outcome.success) toast.success(change.summary);
    else toast.error(outcome.errors?.[0] ?? 'The change was not saved.');
  };

  const ask = (prompt: string) => { setOpen(false); onAsk(prompt); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={mode === 'font' ? 'Choose a font…' : mode === 'map' ? 'Search pages and buttons…' : mode === 'changes' ? 'Search changes…' : mode === 'catalog' ? 'Search items…' : mode === 'price' ? `New price for ${picked?.name ?? ''}, then Enter` : mode === 'image' ? `Image link for ${picked?.name ?? ''}, then Enter` : 'Type a command or ask Unison…'}
        value={query}
        onValueChange={setQuery}
        aria-label="Command"
      />
      <CommandList>
        <CommandEmpty>
          {mode === 'root' && query.trim()
            ? <button type="button" className="underline" onClick={() => ask(query)}>Ask Unison: “{query}”</button>
            : 'No matches.'}
        </CommandEmpty>
        {mode === 'root' && (
          <>
            <CommandGroup heading="Design">
              <CommandItem onSelect={() => setMode('font')}>Change body font…</CommandItem>
              <CommandItem onSelect={() => ask('Change the colour theme to ')}>Change colour theme…</CommandItem>
              <CommandItem onSelect={() => ask('Swap the main image on this page for ')}>Swap an image…</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Site">
              <CommandItem onSelect={() => setMode('map')}>Show site map and button destinations</CommandItem>
              <CommandItem onSelect={() => { setOpen(false); window.dispatchEvent(new Event('unison:open-catalog')); }}>Edit products, services and prices…</CommandItem>
              <CommandItem onSelect={() => setMode('changes')}>Show changes made this session</CommandItem>
              <CommandItem onSelect={() => ask('Add a new page called ')}>Add a page…</CommandItem>
              <CommandItem onSelect={() => ask('Find and repair the current preview error')}>Repair current error</CommandItem>
            </CommandGroup>
            {query.trim() && (
              <CommandGroup heading="Ask">
                <CommandItem value={`ask ${query}`} onSelect={() => ask(query)}>Ask Unison: “{query}”</CommandItem>
              </CommandGroup>
            )}
          </>
        )}
        {mode === 'font' && (
          <CommandGroup heading="Fonts">
            {FONTS.map((f) => (
              <CommandItem key={f} onSelect={async () => { try { const state = captureBuilderRequestState(getCurrentRequestState?.() ?? { files, projectId: projectId ?? null, businessId: businessId ?? null, revisionId: revisionId ?? null }); await run(await dispatchBuilderOperation(createUnisonBuilderContext(state), { ...state, features }, 'set_font', f)); } catch (error) { toast.error(error instanceof Error ? error.message : 'Font change refused.'); } }}>{f}</CommandItem>
            ))}
          </CommandGroup>
        )}
        {mode === 'catalog' && (
          <CommandGroup heading={catalog === null ? 'Loading…' : catalog.length ? 'Choose what to change' : 'No products or services saved for this business yet'}>
            {catalog?.flatMap((c) => [
              <CommandItem key={`${c.id}-p`} value={`${c.name} price ${c.id}`} onSelect={() => { setPicked(c); setQuery(''); setMode('price'); }}>
                {c.name} — change price{c.price != null ? ` (now ${c.price})` : ''}
              </CommandItem>,
              ...(c.table === 'pricing_plans' ? [] : [
                <CommandItem key={`${c.id}-i`} value={`${c.name} image ${c.id}`} onSelect={() => { setPicked(c); setQuery(''); setMode('image'); }}>
                  {c.name} — swap image
                </CommandItem>,
              ]),
            ])}
          </CommandGroup>
        )}
        {(mode === 'price' || mode === 'image') && query.trim() && (
          <CommandGroup heading="Save">
            <CommandItem value={`save ${query}`} onSelect={() => saveCatalog(query)}>Save “{query}” to {picked?.name}</CommandItem>
          </CommandGroup>
        )}
        {mode === 'changes' && (
          <CommandGroup heading={changes.length ? 'Newest first' : 'No changes saved yet this session'}>
            {changes.map((c, idx) => (
              <CommandItem
                key={`${c.at}-${idx}`}
                value={`${c.message} ${c.path ?? ''} ${idx}`}
                onSelect={() => c.path && ask(`In ${c.path}, `)}
              >
                <span className="truncate">
                  {new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {c.path ?? c.message}
                  {c.kind === 'file_change' && ` (+${c.added ?? 0} −${c.removed ?? 0})`}
                  {c.kind === 'commit' && ' — saved'}
                  {c.kind === 'rollback' && ' — undone'}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {mode === 'map' && graph?.pages.map((p) => (
          <CommandGroup key={p.path} heading={`${p.name} · ${p.sections.length} sections`}>
            {p.intents.length === 0 && (
              <CommandItem value={`${p.name} no buttons`} onSelect={() => ask(`On the ${p.name} page, `)}>No wired buttons — edit this page…</CommandItem>
            )}
            {p.intents.map((i, idx) => (
              <CommandItem
                key={`${p.path}-${idx}`}
                value={`${p.name} ${i.label} ${i.intent} ${i.target ?? ''}`}
                onSelect={() => ask(`On the ${p.name} page, the "${i.label || i.intent}" button: `)}
              >
                <span className="truncate">“{i.label || i.intent}” → {i.target ?? i.intent}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
