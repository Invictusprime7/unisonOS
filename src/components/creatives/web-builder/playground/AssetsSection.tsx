/**
 * Playground → Manage → Assets. One live view over the Resource Runtime:
 * Catalog, Content, Business and Media, filtered to what this site uses and
 * ranked by its industry. Reads/writes go through resourceRuntime only.
 */
import { sanitizeHTML, sanitizeCSS } from "@/utils/htmlSanitizer";
import { isTrustedPreviewOrigin } from "@/utils/trustedPreviewOrigin";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, ChevronDown, ChevronRight, Eye, FileBox, Grid3X3, List, MoreVertical, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RecordFieldsEditor } from "../RecordFieldsEditor";
import { listContentTypes, transitionContentRecord } from "@/services/cmsRecordService";
import { supabase } from "@/integrations/supabase/client";
import { getResource, registerContentTypes, BUSINESS_PROFILE_RESOURCE_KEY, type ContentTypeRow } from "@/services/resources/resourceRegistry";
import { applyResourceOp, getResourceRecord, onResourceInvalidated, queryResource } from "@/services/resources/resourceRuntime";
import type { ResourceRecord } from "@/services/resources/resourceTypes";
import {
  buildRenderedResourceIndex, isRelevantAsset, listAssetTypes, listSiteImages, type AssetType,
} from "@/services/resources/assetCatalog";
import { persistScannedCatalogItem, type ScannedCatalogItem } from "@/services/resources/previewAssetScan";
import { adoptLongformFromSite, seedLaunchAssets } from "@/services/resources/seedLaunchAssets";
import { listCatalog } from "@/services/agent-runtime/catalogOps";
import { uploadForPlacement } from "@/services/assets/uploadPlacement";
import type { CreatorData } from "@/types/creatorData";
import { cn } from "@/lib/utils";
import { usePlaygroundApi, type PlaygroundResourceUsage } from "@/hooks/usePlaygroundApi";
import { LiveResourcePreview } from "./LiveResourcePreview";

interface Props {
  businessId?: string | null;
  projectId?: string | null;
  industry?: string | null;
  vfsFiles?: Record<string, string>;
  formsSlot?: React.ReactNode;
  /** Show a record's real on-site instance (closes Playground, reveals in preview). */
  onReveal?: (mark: string, files: string[]) => void;
  /** Ask the AI Builder to place a saved record onto a page (closes Playground, prefills the request). */
  onPlace?: (prompt: string) => void;
  /** Create real pages for saved articles/case studies and link their read buttons (canonical save). */
  onPublishLongform?: (items: { record: ResourceRecord; kind: "articles" | "case-studies"; resourceKey: string }[]) => Promise<void>;
  /** Saved launch data; used to backfill assets for sites generated before launch seeding existed. */
  creatorData?: CreatorData | null;
  initialTab?: "catalog" | "content" | "business" | "media";
}

function recordTitle(r: ResourceRecord): string {
  return String(r.name ?? r.title ?? r.question ?? r.author_name ?? r.client_name ?? r.id);
}

interface ScannedItem extends ScannedCatalogItem { meta?: { date?: string | null; readTime?: string | null; author?: string | null } | null; kind: string; section: string; resourceMark?: string | null; html: string }
const SCAN_GROUP: Record<string, "catalog" | "content"> = { menu: "catalog", products: "catalog", services: "catalog", testimonials: "content", articles: "content", faqs: "content", team: "content", gallery: "content" };
const SCAN_LABEL: Record<string, string> = { menu: "Menu", products: "Products", services: "Services", testimonials: "Testimonials", articles: "Articles", faqs: "FAQs", team: "Team", gallery: "Gallery & portfolio" };

/** Read-only Live Preview scan: lists items actually rendered on the current
 *  page, whether or not they are saved. Saving goes through seedLaunchAssets. */
function SiteScanList({ group, businessId, projectId, onSaved }: { group: "catalog" | "content"; businessId: string; projectId?: string | null; onSaved: () => void }) {
  const [scan, setScan] = useState<{ items: ScannedItem[]; css: string } | null>(null);
  const [open, setOpen] = useState<number | null>(-1);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const requestId = `scan-${Date.now()}`;
    const onMsg = (e: MessageEvent) => {
      // Accept scans only from a preview frame on this page.
      const fromPreview = Array.from(document.querySelectorAll("iframe")).some((f) => f.contentWindow === e.source);
      if (!fromPreview || !isTrustedPreviewOrigin(e.origin)) return;
      const d = e.data as { type?: string; requestId?: string; items?: ScannedItem[]; css?: string };
      if (d?.type !== "ASSET_SCAN" || d.requestId !== requestId) return;
      setScan({ items: d.items ?? [], css: d.css ?? "" });
    };
    window.addEventListener("message", onMsg);
    const ask = () => document.querySelectorAll("iframe").forEach((f) => f.contentWindow?.postMessage({ type: "SCAN_ASSETS", requestId }, "*"));
    ask();
    const retry = setTimeout(ask, 900);
    return () => { window.removeEventListener("message", onMsg); clearTimeout(retry); };
  }, [tick]);
  const items = (scan?.items ?? []).map((it, i) => ({ it, i })).filter(({ it }) => SCAN_GROUP[it.kind] === group);
  const save = async (it: ScannedItem, i: number) => {
    try {
      const surfaceId = it.kind === "menu" ? "menu" : it.kind === "products" ? "products" : it.kind === "services" ? "services" : null;
      if (surfaceId) {
        await persistScannedCatalogItem({ kind: surfaceId, item: it, index: i, businessId, projectId });
      } else {
        const price = it.price ? Number(it.price.replace(/[^0-9.]/g, "")) || null : null;
        const one = { x: { name: it.name, description: it.description, price } };
        const data: Record<string, unknown> = {};
        if (it.kind === "testimonials") data.testimonials = { x: { author: it.name, content: it.description } };
        else if (it.kind === "articles") data.articles = { x: { title: it.name, excerpt: it.description, date: it.meta?.date ?? undefined, readTime: it.meta?.readTime ?? undefined, author: it.meta?.author ?? undefined, image: it.image ?? undefined } };
        else if (it.kind === "faqs") data.faqs = { x: { question: it.name, answer: it.description } };
        else if (it.kind === "team") data.team = { x: { name: it.name, bio: it.description } };
        else data.gallery = { x: { caption: it.name, image: it.image ?? undefined } };
        await seedLaunchAssets({ businessId, projectId, creatorData: data as unknown as CreatorData });
      }
      setSaved((s) => new Set(s).add(i));
      onSaved();
      toast.success(`Saved "${it.name}"`);
    } catch (error) {
      toast.error("Couldn't save this item", { description: error instanceof Error ? error.message : String(error) });
    }
  };
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Found on this page</h3>
        <Button variant="ghost" size="sm" onClick={() => setTick((n) => n + 1)}>Rescan</Button>
      </div>
      {!scan && <p className="text-xs text-muted-foreground">Scanning the live preview…</p>}
      {scan && items.length === 0 && <p className="text-xs text-muted-foreground">Nothing of this kind is showing on the current page.</p>}
      <ul className="divide-y divide-border">
        {items.map(({ it, i }) => (
          <li key={i} className="py-2">
            <div className="flex items-center gap-2">
              <button type="button" className="flex flex-1 items-center gap-2 text-left text-sm text-foreground" onClick={() => setOpen(open === i ? null : i)}>
                {open === i ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="truncate">{it.name}</span>
                <Badge variant="outline">{SCAN_LABEL[it.kind]}</Badge>
              </button>
              {saved.has(i) ? <Badge variant="secondary">Saved</Badge> : <Button variant="ghost" size="sm" onClick={() => save(it, i)}>Save to assets</Button>}
            </div>
            {(open === -1 || open === i) && (
              <iframe
                title="Live appearance"
                sandbox=""
                className="pointer-events-none mt-2 w-full border border-border"
                style={{ height: "12rem", background: "white" }}
                srcDoc={`<!doctype html><html><head><style>${sanitizeCSS(scan?.css ?? "")}</style><style>body{margin:0}</style></head><body>${sanitizeHTML(it.html ?? "", { allowStyles: true })}</body></html>`}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const LONGFORM = /^content:(articles|case-studies)$/;

/** Article / case-study actions: AI-drafted full text (saved as Draft) and a
 *  per-item page with linked "Read" buttons via the AI Builder save flow. */
function LongformActions({ type, record, businessId, projectId, onPublish }: { type: AssetType; record: ResourceRecord; businessId: string; projectId?: string | null; onPublish?: Props['onPublishLongform'] }) {
  const [busy, setBusy] = useState(false);
  const isArticle = type.key === "content:articles";
  const title = recordTitle(record);
  const slug = String(record.slug ?? "") || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const write = async () => {
    setBusy(true);
    try {
      const rec = (await getResourceRecord(type.key, { businessId, projectId, mode: "builder" }, record.id).catch(() => null)) ?? record;
      const brief = [`Title: ${title}`, rec.category && `Category: ${record.category}`, record.client && `Client: ${record.client}`, record.excerpt && `Summary: ${record.excerpt}`, record.results && `Results: ${record.results}`].filter(Boolean).join("\n");
      const { data, error } = await supabase.functions.invoke("copy-rewrite", { body: { text: brief, purpose: "article", tone: "authoritative" } });
      if (error || !data?.rewrittenText) throw new Error(data?.error || error?.message || "No text came back");
      await applyResourceOp({ op: "update", ref: { resourceKey: type.key, kind: "content", recordId: record.id }, values: { body: data.rewrittenText, slug } }, { businessId, projectId, mode: "builder" });
      if (record.status !== "draft") await transitionContentRecord({ businessId, projectId, recordId: record.id, status: "draft", changeSummary: "AI wrote full text" }).catch(() => undefined);
      toast.success("Full text written and saved as Draft", { description: "Review it below, then publish." });
    } catch (e) {
      toast.error("Couldn't write the article", { description: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };
  const page = async () => {
    if (!onPublish) return;
    setBusy(true);
    try {
      // List rows omit saved fields (slug, text); load the full item first.
      const full = (await getResourceRecord(type.key, { businessId, projectId, mode: "builder" }, record.id).catch(() => null)) ?? record;
      const fullSlug = String(full.slug ?? "") || slug;
      await onPublish([{ record: { ...full, slug: fullSlug }, kind: isArticle ? "articles" : "case-studies", resourceKey: type.key }]); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={write}>{busy ? "Writing…" : record.body ? "Rewrite full text" : "Write full text"}</Button>
      {onPublish && <Button variant="outline" size="sm" disabled={busy} onClick={page}>Create page &amp; link button</Button>}
    </div>
  );
}

function recordImage(record: ResourceRecord): string | null {
  const candidate = record.image ?? record.image_url ?? record.cover_image ?? record.thumbnail ?? record.photo ?? record.avatar;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function recordDescription(record: ResourceRecord): string {
  const candidate = record.description ?? record.excerpt ?? record.bio ?? record.answer ?? record.content ?? record.summary;
  return typeof candidate === "string" ? candidate : "";
}

interface SelectedAsset {
  type: AssetType;
  record: ResourceRecord;
  usageId?: string;
}

function ResourceCardPreview({ type, record }: { type: AssetType; record: ResourceRecord }) {
  const api = usePlaygroundApi();
  const ref = `${type.key}#${record.id}`;
  const [usage, setUsage] = useState<PlaygroundResourceUsage>();
  useEffect(() => {
    let alive = true;
    void api.getUsages(ref).then((items) => { if (alive) setUsage(items[0]); });
    return () => { alive = false; };
  }, [api, ref]);
  return <LiveResourcePreview appearance={{ ref, name: recordTitle(record), usage }} className="h-full" />;
}

function MediaIframePreview({ url, label }: { url: string; label: string }) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#070c10}img{width:100%;height:100%;object-fit:cover}</style></head><body><img src=${JSON.stringify(url)} alt=${JSON.stringify(label)}></body></html>`;
  return <iframe title={`Live media asset ${label}`} sandbox="" loading="lazy" className="pointer-events-none aspect-[4/3] w-full border-0 bg-[#070c10]" srcDoc={html} />;
}

function AssetList({ type, businessId, projectId, liveIndex, onPublishLongform, onReveal, onPlace, search, liveOnly, view, selectedMark, onSelect }: { type: AssetType; businessId: string; projectId?: string | null; liveIndex: Map<string, string[]>; onPublishLongform?: Props['onPublishLongform']; onReveal?: Props["onReveal"]; onPlace?: Props["onPlace"]; search: string; liveOnly: boolean; view: "grid" | "list"; selectedMark?: string | null; onSelect: (asset: SelectedAsset) => void }) {
  const [rows, setRows] = useState<ResourceRecord[] | null>(null);
  const [tick, setTick] = useState(0);
  const api = usePlaygroundApi();
  const ctx = useMemo(() => ({ businessId, projectId, mode: "builder" as const }), [businessId, projectId]);

  useEffect(() => {
    let alive = true;
    queryResource(type.key, ctx).then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [type.key, ctx, tick]);
  useEffect(() => onResourceInvalidated((i) => { if (i.resourceKey === type.key) setTick((t) => t + 1); }), [type.key]);

  const add = async () => {
    const first = type.def?.schema.find((f) => f.required) ?? type.def?.schema[0];
    try {
      await applyResourceOp({ op: "create", resourceKey: type.key, values: first ? { [first.key]: `New ${type.label}` } : {} }, ctx);
    } catch (e) { toast.error(`Couldn't add to ${type.label}`, { description: e instanceof Error ? e.message : String(e) }); }
  };
  const duplicate = async (record: ResourceRecord) => {
    try {
      const copy = await api.duplicateResource(`${type.key}#${record.id}`);
      if (!copy) throw new Error("The duplicate wasn't returned by the resource runtime.");
      onSelect({ type, record: copy });
      toast.success(`${recordTitle(record)} duplicated`);
    } catch (error) {
      toast.error("Couldn't duplicate this asset", { description: error instanceof Error ? error.message : String(error) });
    }
  };
  const visibleRows = (rows ?? []).filter((record) => {
    const mark = `${type.key}#${record.id}`;
    if (liveOnly && !liveIndex.has(mark)) return false;
    const haystack = `${recordTitle(record)} ${recordDescription(record)} ${String(record.category ?? "")}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{type.label}</h4>
          {type.used && <Badge className="h-5 border-emerald-400/15 bg-emerald-400/10 text-[9px] text-emerald-300 hover:bg-emerald-400/10">On site</Badge>}
          {rows && <span className="text-[10px] text-slate-600">{visibleRows.length}</span>}
        </div>
        <div className="flex items-center gap-1">
          {LONGFORM.test(type.key) && onPublishLongform && rows && rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={async () => {
              // List rows omit saved fields (slug, text); load each full item first.
              const full = await Promise.all(rows.map((r) => getResourceRecord(type.key, ctx, r.id).catch(() => null).then((f) => f ?? r)));
              await onPublishLongform(full.map((record) => ({ record, kind: type.key === "content:articles" ? "articles" : "case-studies", resourceKey: type.key })));
            }}>
              Create all pages
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white" onClick={add}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
      </header>
      {rows === null && <div className="h-40 animate-pulse rounded-xl border border-white/5 bg-white/[0.025]" />}
      {rows?.length === 0 && <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">Nothing saved yet.</div>}
      {rows && rows.length > 0 && visibleRows.length === 0 && <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">No assets match these filters.</div>}
      <ul className={cn(view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2")}>
        {visibleRows.map((r) => {
          const mark = `${type.key}#${r.id}`;
          const live = liveIndex.has(mark);
          const description = recordDescription(r);
          const active = selectedMark === mark;
          return (
            <li key={r.id}>
              <div className={cn("group relative overflow-hidden rounded-xl border transition-all duration-200", active ? "border-emerald-400/80 bg-[#111b20] shadow-[0_0_0_2px_rgba(52,211,153,0.08),0_10px_30px_rgba(0,0,0,0.3)]" : "border-white/[0.08] bg-[#10171d] hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#131c23]", view === "list" && "flex min-h-[104px]")}>
                <button type="button" onClick={() => onSelect({ type, record: r })} className={cn("w-full min-w-0 text-left", view === "list" && "flex min-h-[104px] pr-10")}>
                <div className={cn("relative overflow-hidden bg-[radial-gradient(circle_at_70%_20%,rgba(45,212,191,0.18),transparent_42%),linear-gradient(145deg,#111b22,#080d12)]", view === "grid" ? "aspect-[16/9]" : "w-40 shrink-0")}>
                  <ResourceCardPreview type={type} record={r} />
                  <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-[#07110e]/85 px-2 py-1 text-[9px] font-medium text-emerald-300 backdrop-blur"><span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-emerald-400" : "bg-slate-500")} />{live ? "Live" : "Saved"}</span>
                </div>
                <div className="min-w-0 flex-1 p-3.5 pr-10">
                  <div className="flex items-start justify-between gap-2"><h5 className="truncate text-sm font-semibold text-slate-100">{recordTitle(r)}</h5></div>
                  {description && <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">{description}</p>}
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><span className="rounded-full bg-white/5 px-2 py-1">{String(r.category ?? type.label)}</span>{typeof r.status === "string" && <span className="capitalize">{r.status}</span>}</div>
                </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`Actions for ${recordTitle(r)}`} className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#080d12]/85 text-slate-400 opacity-70 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => onSelect({ type, record: r })}>Edit details</DropdownMenuItem>
                    {live && onReveal && <DropdownMenuItem onSelect={() => onReveal(mark, liveIndex.get(mark) ?? [])}>Edit in Preview</DropdownMenuItem>}
                    {!live && onPlace && <DropdownMenuItem onSelect={() => onPlace(`Add the saved ${type.label.toLowerCase()} "${recordTitle(r)}" (resource ${mark}) to the most relevant page of the site, rendering it with its saved fields. Keep all existing content and button destinations unchanged.`)}>Place on page</DropdownMenuItem>}
                    {type.def?.cardinality === "collection" && <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => void duplicate(r)}>Duplicate</DropdownMenuItem>
                    </>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AssetInspector({ asset, businessId, projectId, onReveal, onPlace, onRemove, onAssetChange }: { asset: SelectedAsset | null; businessId: string; projectId?: string | null; onReveal?: Props["onReveal"]; onPlace?: Props["onPlace"]; onRemove: (asset: SelectedAsset) => Promise<void>; onAssetChange: (asset: SelectedAsset) => void }) {
  const api = usePlaygroundApi();
  const [usages, setUsages] = useState<PlaygroundResourceUsage[]>([]);
  useEffect(() => {
    if (!asset) { setUsages([]); return; }
    void api.getUsages(`${asset.type.key}#${asset.record.id}`).then(setUsages);
  }, [api, asset?.record.id, asset?.type.key]);
  if (!asset) {
    return (
      <aside className="flex min-h-full flex-col border-l border-white/[0.08] bg-[#0b1218]">
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035]"><FileBox className="h-6 w-6 text-slate-600" /></div>
          <p className="mt-4 text-sm font-medium text-slate-300">Select an asset</p>
          <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-slate-600">Choose a card to inspect its appearance and see where it is used.</p>
        </div>
      </aside>
    );
  }

  const { type, record } = asset;
  const mark = `${type.key}#${record.id}`;
  const files = usages.map((usage) => usage.file);
  const live = files.length > 0;
  const image = recordImage(record);

  return (
    <aside className="flex min-h-full flex-col border-l border-white/[0.08] bg-[#0b1218]">
      <div className="border-b border-white/[0.08] p-5">
        <div className="flex items-start gap-3">
          <div className="h-[72px] w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_60%_20%,rgba(45,212,191,0.18),transparent_50%),#081015]">
            <LiveResourcePreview appearance={{ ref: mark, name: recordTitle(record), usage: usages.find((usage) => usage.id === asset.usageId) ?? usages[0] }} className="h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300"><span className={cn("h-2 w-2 rounded-full", live ? "bg-emerald-400" : "bg-slate-500")} />{live ? "Live" : "Saved"}</div>
            <h4 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-white">{recordTitle(record)}</h4>
            <p className="mt-1 text-[10px] text-slate-600">Updated in real time</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="data" className="w-full flex-1">
        <TabsList className="grid h-11 w-full grid-cols-3 rounded-none border-b border-white/[0.08] bg-white/[0.02] p-0">
          {(["data", "appearance", "usage"] as const).map((tab) => <TabsTrigger key={tab} value={tab} className="h-11 rounded-none border-b-2 border-transparent text-[11px] capitalize text-slate-500 data-[state=active]:border-emerald-400 data-[state=active]:bg-emerald-400/[0.07] data-[state=active]:text-slate-100">{tab}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="data" className="m-0 space-y-4 p-5">
          <RecordFieldsEditor mark={mark} businessId={businessId} projectId={projectId} defaultOpen />
        </TabsContent>
        <TabsContent value="appearance" className="m-0 space-y-5 p-5">
          <div>
            <p className="mb-2 text-[11px] font-medium text-slate-300">Cover image</p>
            <div className="aspect-[16/7] overflow-hidden rounded-xl border border-white/10 bg-[#081015]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] text-slate-600">No cover image</div>}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-slate-600">Resource type</p><p className="mt-1 font-medium text-slate-300">{type.label}</p></div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-slate-600">Visibility</p><p className="mt-1 font-medium text-slate-300">{live ? "Published" : "Library only"}</p></div>
          </div>
          <LiveResourcePreview appearance={{ ref: mark, name: recordTitle(record), usage: usages.find((usage) => usage.id === asset.usageId) ?? usages[0] }} className="h-44 rounded-xl border border-white/10" />
        </TabsContent>
        <TabsContent value="usage" className="m-0 space-y-4 p-5">
          <div className="flex items-center justify-between"><p className="text-[11px] font-medium text-slate-300">Used on ({files.length} locations)</p>{live && onReveal ? <button type="button" onClick={() => onReveal(mark, files)} className="text-[10px] font-medium text-sky-400 hover:text-sky-300">Manage</button> : null}</div>
          {usages.length > 0 ? <ul className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.07]">{usages.map((usage) => <li key={usage.id}><button type="button" onClick={() => { onAssetChange({ ...asset, usageId: usage.id }); void api.focusAppearance(usage.id); }} className={cn("flex w-full items-center gap-3 bg-white/[0.02] px-3 py-3 text-left transition hover:bg-white/[0.05]", asset.usageId === usage.id && "bg-emerald-400/[0.06]")}><FileBox className="h-4 w-4 text-slate-500" /><div className="min-w-0 flex-1"><p className="truncate text-[11px] text-slate-300">{usage.pageName}</p><p className="mt-0.5 truncate text-[9px] text-slate-600">{usage.sectionName} · {usage.role}</p></div><ArrowUpRight className="h-3.5 w-3.5 text-slate-600" /></button></li>)}</ul> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-[10px] text-slate-600">This asset is not used on a page yet.</p>}
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-0 mt-auto border-t border-white/[0.08] bg-[#0b1218]/95 p-4 backdrop-blur">
        <div className="flex gap-2">
          {live && onReveal ? <Button size="sm" className="flex-1 border border-white/10 bg-white/[0.06] text-[11px] text-slate-100 hover:bg-white/10" onClick={() => onReveal(mark, files)}>Edit in Preview <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}
          {!live && onPlace ? <Button size="sm" className="flex-1 bg-emerald-400 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-300" onClick={() => onPlace(`Add the saved ${type.label.toLowerCase()} "${recordTitle(record)}" (resource ${mark}) to the most relevant page of the site, rendering it with its saved fields. Keep all existing content and button destinations unchanged.`)}>Place on page <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}
          {type.def && type.def.kind !== "content" ? <Button variant="outline" size="icon" className="border-white/10 bg-white/[0.04] text-slate-500 hover:bg-red-500/10 hover:text-red-300" aria-label="Delete asset" onClick={() => void onRemove(asset)}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
        </div>
      </div>
    </aside>
  );
}

export function AssetsSection({ businessId, projectId, industry, vfsFiles = {}, formsSlot, onReveal, onPlace, onPublishLongform, creatorData, initialTab = "catalog" }: Props) {
  const api = usePlaygroundApi();
  const [contentReady, setContentReady] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [search, setSearch] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const backfillTried = useRef<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    listContentTypes({ businessId, projectId: projectId ?? undefined } as never)
      .then((rows) => { if (!alive) return; registerContentTypes(rows as ContentTypeRow[]); setContentReady((n) => n + 1); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [businessId, projectId]);

  // Backfill: sites generated before launch seeding existed have planned
  // assets in their saved playground data but nothing in the catalog. Seed
  // once per business, only when the catalog is still completely empty, so
  // deliberately deleted items are never resurrected.
  useEffect(() => {
    if (!businessId || !creatorData || backfillTried.current === businessId) return;
    const hasPlanned =
      Object.keys(creatorData.products ?? {}).length > 0 ||
      Object.keys(creatorData.services ?? {}).length > 0 ||
      Object.keys(creatorData.testimonials ?? {}).length > 0 ||
      Object.keys(creatorData.faqs ?? {}).length > 0 ||
      Object.keys(creatorData.team ?? {}).length > 0;
    if (!hasPlanned) return;
    backfillTried.current = businessId;
    let alive = true;
    listCatalog(businessId, ["products", "services", "testimonials"], projectId)
      .then(async (rows) => {
        if (!alive || rows.length > 0) return;
        await seedLaunchAssets({ businessId, projectId, creatorData });
        if (alive) setContentReady((n) => n + 1);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [businessId, creatorData]);

  // Adopt articles / case studies the site already shows (once per business per session).
  const longformTried = useRef<string | null>(null);
  useEffect(() => {
    if (!businessId || longformTried.current === businessId || !Object.keys(vfsFiles).length) return;
    longformTried.current = businessId;
    let alive = true;
    adoptLongformFromSite({ businessId, projectId, vfsFiles })
      .then(() => listContentTypes({ businessId, projectId: projectId ?? undefined } as never))
      .then((rows) => { if (!alive) return; registerContentTypes(rows as ContentTypeRow[]); setContentReady((n) => n + 1); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [businessId, projectId, vfsFiles]);

  const types = useMemo(() => listAssetTypes({ industry, vfsFiles }), [industry, vfsFiles, contentReady]);
  const liveIndex = useMemo(() => buildRenderedResourceIndex(vfsFiles), [vfsFiles]);
  const images = useMemo(() => listSiteImages(vfsFiles), [vfsFiles]);

  useEffect(() => {
    if (!businessId || selectedAsset) return;
    let alive = true;
    api.listResources({ group: initialTab === "content" ? "content" : "catalog" })
      .then((resources) => {
        const first = resources.find((resource) => isRelevantAsset(resource.type)) ?? resources[0];
        if (alive && first) setSelectedAsset({ type: first.type, record: first.record, usageId: first.usages[0]?.id });
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [api, businessId, initialTab, selectedAsset]);

  const selectedMark = selectedAsset ? `${selectedAsset.type.key}#${selectedAsset.record.id}` : null;
  useEffect(() => onResourceInvalidated((invalidation) => {
    if (!selectedAsset || invalidation.resourceKey !== selectedAsset.type.key || !invalidation.recordIds.includes(selectedAsset.record.id)) return;
    void api.inspect(`${selectedAsset.type.key}#${selectedAsset.record.id}`).then((resource) => {
      if (resource) setSelectedAsset((current) => current ? { type: resource.type, record: resource.record, usageId: current.usageId ?? resource.usages[0]?.id } : current);
    });
  }), [api, selectedAsset]);

  if (!businessId) return <p className="text-sm text-muted-foreground">Save the site to a business to manage its assets.</p>;

  const removeSelected = async (asset: SelectedAsset) => {
    try {
      await api.deleteResource(`${asset.type.key}#${asset.record.id}`);
      setSelectedAsset(null);
    } catch (error) {
      toast.error("Couldn't remove", { description: error instanceof Error ? error.message : String(error) });
    }
  };
  const selectAsset = async (asset: SelectedAsset) => {
    const ref = `${asset.type.key}#${asset.record.id}`;
    const usages = await api.getUsages(ref);
    const next = { ...asset, usageId: usages[0]?.id };
    setSelectedAsset(next);
    if (next.usageId) await api.focusAppearance(next.usageId);
  };

  const renderGroup = (group: "catalog" | "content") => {
    const all = types.filter((t) => t.group === group);
    const filtered = typeFilter === "all" ? all : all.filter((type) => type.key === typeFilter);
    const relevant = filtered.filter(isRelevantAsset);
    const rest = filtered.filter((t) => !isRelevantAsset(t));
    return (
      <div className="space-y-7">
        <details className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-400">Found on the current preview</summary>
          <div className="pt-4"><SiteScanList group={group} businessId={businessId} projectId={projectId} onSaved={() => setContentReady((n) => n + 1)} /></div>
        </details>
        {relevant.map((t) => <AssetList key={t.key} type={t} businessId={businessId} projectId={projectId} liveIndex={liveIndex} onPublishLongform={onPublishLongform} onReveal={onReveal} onPlace={onPlace} search={search} liveOnly={liveOnly} view={view} selectedMark={selectedMark} onSelect={(asset) => void selectAsset(asset)} />)}
        {group === "content" && formsSlot}
        {relevant.length === 0 && group === "catalog" && <p className="text-sm text-muted-foreground">This site doesn't sell or list items yet.</p>}
        {rest.length > 0 && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setShowMore((v) => !v)}>
              {showMore ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Add more types ({rest.length})
            </Button>
            {showMore && <div className="space-y-6 pt-3">{rest.map((t) => <AssetList key={t.key} type={t} businessId={businessId} projectId={projectId} liveIndex={liveIndex} onPublishLongform={onPublishLongform} onReveal={onReveal} onPlace={onPlace} search={search} liveOnly={liveOnly} view={view} selectedMark={selectedMark} onSelect={(asset) => void selectAsset(asset)} />)}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid min-h-full grid-cols-[minmax(0,1fr)_360px] bg-[#080d12]">
      <div className="min-w-0 border-b border-white/[0.07] px-7 pb-0 pt-7">
        <div className="mb-5">
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-slate-100">Assets</h3>
          <Button variant="link" asChild><Link to={projectId ? `/business/records?projectId=${encodeURIComponent(projectId)}` : '/business/records'}>Records</Link></Button>
          <p className="mt-1 text-xs text-slate-500">Everything this site shows, synchronized with the live preview.</p>
        </div>
        <Tabs defaultValue={initialTab}>
        <TabsList className="h-11 w-full max-w-[520px] justify-start rounded-xl border border-white/[0.08] bg-white/[0.035] p-1">
          <TabsTrigger className="h-9 flex-1 rounded-lg text-xs text-slate-400 data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-300 data-[state=active]:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]" value="catalog">Catalog</TabsTrigger>
          <TabsTrigger className="h-9 flex-1 rounded-lg text-xs text-slate-400 data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-300" value="content">Content</TabsTrigger>
          <TabsTrigger className="h-9 flex-1 rounded-lg text-xs text-slate-400 data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-300" value="business">Business</TabsTrigger>
          <TabsTrigger className="h-9 flex-1 rounded-lg text-xs text-slate-400 data-[state=active]:bg-emerald-400/10 data-[state=active]:text-emerald-300" value="media">Media</TabsTrigger>
        </TabsList>
        <div className="-mx-7 mt-5 border-t border-white/[0.07] bg-[#0a1015] px-7 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setLiveOnly((value) => !value)} className={cn("flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] transition-colors", liveOnly ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.025] text-slate-400 hover:text-white")}><span className={cn("h-2 w-2 rounded-full", liveOnly ? "bg-emerald-400" : "bg-slate-600")} />{liveOnly ? "Live only" : "All status"}<ChevronDown className="h-3 w-3" /></button>
            <label className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-[11px] text-slate-400"><SlidersHorizontal className="h-3.5 w-3.5" /><select aria-label="Filter by resource type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-transparent pr-2 text-[11px] text-slate-400 outline-none"><option value="all">All resources</option>{types.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
            <div className="ml-auto flex h-9 min-w-[240px] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3"><Search className="h-3.5 w-3.5 text-slate-600" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets..." className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600" /></div>
            <div className="flex h-9 overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]"><button type="button" aria-label="Grid view" onClick={() => setView("grid")} className={cn("px-3 text-slate-500", view === "grid" && "bg-white/[0.07] text-slate-200")}><Grid3X3 className="h-3.5 w-3.5" /></button><button type="button" aria-label="List view" onClick={() => setView("list")} className={cn("border-l border-white/10 px-3 text-slate-500", view === "list" && "bg-white/[0.07] text-slate-200")}><List className="h-4 w-4" /></button></div>
          </div>
        </div>
        <TabsContent value="catalog" className="-mx-7 mt-0 px-7 py-6">{renderGroup("catalog")}</TabsContent>
        <TabsContent value="content" className="-mx-7 mt-0 px-7 py-6">{renderGroup("content")}</TabsContent>
        <TabsContent value="business" className="-mx-7 mt-0 px-7 py-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,.8fr)_minmax(380px,1.2fr)]">
            <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#10171d]"><LiveResourcePreview appearance={{ ref: `${BUSINESS_PROFILE_RESOURCE_KEY}#${businessId}`, name: creatorData?.businessInfo.businessName || "Business profile" }} className="h-64" /><div className="border-t border-white/[0.07] px-4 py-3"><p className="text-xs font-medium text-slate-200">Live business identity</p><p className="mt-1 text-[10px] text-slate-500">Rendered from the current site runtime.</p></div></div>
            <div className="rounded-xl border border-white/[0.08] bg-[#0d151b] p-5"><RecordFieldsEditor defaultOpen mark={`${BUSINESS_PROFILE_RESOURCE_KEY}#${businessId}`} businessId={businessId} projectId={projectId} /></div>
          </div>
        </TabsContent>
        <TabsContent value="media" className="-mx-7 mt-0 px-7 py-6">
          {images.length === 0 ? <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">No images on the site yet.</div> : (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {images.map((img) => (
                <li key={img.url} className="group overflow-hidden rounded-xl border border-white/[0.08] bg-[#10171d]">
                  <MediaIframePreview url={img.url} label={img.files[0]?.split("/").pop() ?? "media"} />
                  <p className="truncate px-3 py-2.5 text-[10px] text-slate-500">{img.files.map((f) => f.split("/").pop()).join(", ")}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
        <div className="sticky bottom-0 -mx-3 mb-4 mt-2 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#101820]/95 px-4 py-3 shadow-[0_-12px_30px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><ArrowUpRight className="h-4 w-4 rotate-45" /></div>
          <div><p className="text-[11px] font-medium text-slate-200">Live Sync with Preview</p><p className="mt-0.5 text-[9px] text-slate-600">Select a resource to highlight it. Edits update live.</p></div>
          <div className="ml-auto hidden items-center gap-2 text-[10px] text-slate-500 lg:flex"><span className="h-2 w-2 rounded-full bg-emerald-400" />{selectedAsset ? recordTitle(selectedAsset.record) : "Waiting for selection"}</div>
          {selectedAsset && liveIndex.has(selectedMark ?? "") && onReveal ? <Button variant="outline" size="sm" className="ml-2 h-8 border-white/10 bg-white/[0.04] text-[10px] text-slate-200" onClick={() => onReveal(selectedMark ?? "", liveIndex.get(selectedMark ?? "") ?? [])}>Open Preview <ArrowUpRight className="ml-1.5 h-3 w-3" /></Button> : null}
        </div>
      </div>
      <AssetInspector asset={selectedAsset} businessId={businessId} projectId={projectId} onReveal={onReveal} onPlace={onPlace} onRemove={removeSelected} onAssetChange={setSelectedAsset} />
    </div>
  );
}
