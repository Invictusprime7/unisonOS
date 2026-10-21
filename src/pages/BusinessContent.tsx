import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, History, Loader2, Plus, Save, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { loadBusinessMemberships } from '@/services/businessMembership';
import {
  createContentRecord,
  listContentRecords,
  listContentRevisions,
  listContentTypes,
  mutateContentRecord,
  transitionContentRecord,
  updateContentRecord,
} from '@/services/cmsRecordService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Row = Record<string, unknown>;
type Field = { key: string; type: 'text' | 'textarea' | 'image' | 'boolean' | 'number'; required?: boolean };

function fieldsFor(type: Row | undefined): Field[] {
  const schema = type?.field_schema as { fields?: unknown } | undefined;
  return Array.isArray(schema?.fields) ? schema.fields.filter((field): field is Field => !!field && typeof field === 'object' && 'key' in field && 'type' in field) : [];
}

function statusTone(status: unknown) {
  return status === 'published' ? 'default' : status === 'review' ? 'secondary' : 'outline';
}

export default function BusinessContent() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [businessId, setBusinessId] = useState<string>();
  const [types, setTypes] = useState<Row[]>([]);
  const [typeId, setTypeId] = useState<string>();
  const [entries, setEntries] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row>();
  const [revisions, setRevisions] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState(false);
  const [typeDraft, setTypeDraft] = useState({ apiKey: '', displayName: '', fieldSchema: '{\n  "fields": []\n}' });
  const [entryDraft, setEntryDraft] = useState<{ title: string; slug: string; locale: string; data: Record<string, unknown> }>({ title: '', slug: '', locale: 'en', data: {} });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const memberships = user ? await loadBusinessMemberships(user.id) : [];
      if (cancelled) return;
      const next = memberships.map((business) => ({ id: business.businessId, name: business.name }));
      setBusinesses(next);
      setBusinessId(next.length === 1 ? next[0].id : undefined);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const loadTypes = useCallback(async () => {
    if (!businessId) return setTypes([]);
    try {
      const next = await listContentTypes({ businessId });
      setTypes(next);
      setTypeId((current) => current && next.some((type) => type.id === current) ? current : String(next[0]?.id ?? ''));
    } catch {
      toast.error('Could not load content types');
    }
  }, [businessId]);

  const loadEntries = useCallback(async () => {
    if (!businessId || !typeId) return setEntries([]);
    try { setEntries(await listContentRecords({ businessId, contentTypeId: typeId })); }
    catch { toast.error('Could not load content entries'); }
  }, [businessId, typeId]);

  useEffect(() => { void loadTypes(); }, [loadTypes]);
  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const activeType = useMemo(() => types.find((type) => String(type.id) === typeId), [types, typeId]);
  const fields = useMemo(() => fieldsFor(activeType), [activeType]);

  const openEntry = async (entry?: Row) => {
    setSelected(entry);
    setRevisions([]);
    setEntryDraft(entry ? {
      title: String(entry.title ?? ''), slug: String(entry.slug ?? ''), locale: String(entry.locale ?? 'en'), data: (entry.data as Record<string, unknown>) ?? {},
    } : { title: '', slug: '', locale: 'en', data: {} });
    if (entry?.id && businessId) {
      try { setRevisions(await listContentRevisions({ businessId, recordId: String(entry.id) })); }
      catch { toast.error('Could not load revision history'); }
    }
  };

  const saveEntry = async () => {
    if (!businessId || !typeId || !entryDraft.title.trim()) return toast.error('A title is required');
    setSaving(true);
    try {
      const input = { businessId, contentTypeId: typeId, recordId: selected ? String(selected.id) : undefined, values: entryDraft };
      const saved = selected
        ? await updateContentRecord({ ...input, expectedUpdatedAt: String(selected.updated_at ?? '') })
        : await createContentRecord(input);
      toast.success(selected ? 'Entry saved' : 'Draft created');
      await loadEntries();
      await openEntry(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save entry');
    } finally { setSaving(false); }
  };

  const transition = async (status: 'review' | 'published' | 'draft' | 'archived') => {
    if (!businessId || !selected?.id) return;
    setSaving(true);
    try {
      const saved = await transitionContentRecord({
        businessId,
        recordId: String(selected.id),
        status,
        expectedUpdatedAt: String(selected.updated_at ?? ''),
        changeSummary: `Moved to ${status}`,
      });
      toast.success(`Entry moved to ${status}`);
      await loadEntries();
      await openEntry(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update workflow');
    } finally { setSaving(false); }
  };

  const createType = async () => {
    if (!businessId) return;
    try {
      const fieldSchema = JSON.parse(typeDraft.fieldSchema) as Record<string, unknown>;
      const type = await mutateContentRecord({ action: 'content-type-create', businessId, values: { apiKey: typeDraft.apiKey, displayName: typeDraft.displayName, fieldSchema } });
      toast.success('Collection created');
      setNewType(false);
      await loadTypes();
      setTypeId(String(type.record?.id ?? ''));
    } catch { toast.error('Use a valid key, name, and field schema'); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  return <div className="min-h-screen bg-background"><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button><div><h1 className="text-2xl font-semibold">Collections</h1><p className="text-sm text-muted-foreground">Manage structured records, publication status, and revision history.</p></div></div><Link to="/business/records" className="text-sm text-muted-foreground hover:text-foreground">Open all records</Link></header>
    <div className="mb-6 flex flex-wrap gap-3">{businesses.length > 1 && <Select value={businessId} onValueChange={setBusinessId}><SelectTrigger className="w-60"><SelectValue placeholder="Select business" /></SelectTrigger><SelectContent>{businesses.map((business) => <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>)}</SelectContent></Select>}<Select value={typeId} onValueChange={(value) => { setTypeId(value); setSelected(undefined); }}><SelectTrigger className="w-60"><SelectValue placeholder="Select collection" /></SelectTrigger><SelectContent>{types.map((type) => <SelectItem key={String(type.id)} value={String(type.id)}>{String(type.display_name)}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => setNewType(true)} disabled={!businessId}><Plus className="mr-2 h-4 w-4" />Collection</Button><Button onClick={() => openEntry()} disabled={!typeId}><Plus className="mr-2 h-4 w-4" />Record</Button></div>
    {newType && <Card className="mb-6"><CardHeader><CardTitle className="text-base">New collection</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><Input placeholder="api_key" value={typeDraft.apiKey} onChange={(event) => setTypeDraft({ ...typeDraft, apiKey: event.target.value })} /><Input placeholder="Display name" value={typeDraft.displayName} onChange={(event) => setTypeDraft({ ...typeDraft, displayName: event.target.value })} /><Textarea className="md:col-span-2 font-mono text-xs" rows={6} value={typeDraft.fieldSchema} onChange={(event) => setTypeDraft({ ...typeDraft, fieldSchema: event.target.value })} /><div className="flex gap-2"><Button onClick={createType}>Create collection</Button><Button variant="ghost" onClick={() => setNewType(false)}>Cancel</Button></div></CardContent></Card>}
    <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)_minmax(16rem,0.65fr)]"><Card><CardHeader><CardTitle className="text-base">Records</CardTitle></CardHeader><CardContent className="space-y-2">{entries.length ? entries.map((entry) => <button key={String(entry.id)} onClick={() => void openEntry(entry)} className="w-full border-b py-3 text-left last:border-0"><div className="flex items-center justify-between gap-2"><span className="font-medium">{String(entry.title)}</span><Badge variant={statusTone(entry.status)}>{String(entry.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{String(entry.locale)} {entry.slug ? `/${String(entry.slug)}` : ''}</p></button>) : <p className="text-sm text-muted-foreground">Choose a collection, then create a record.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{selected ? 'Edit record' : 'New record'}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div><Label>Title</Label><Input value={entryDraft.title} onChange={(event) => setEntryDraft({ ...entryDraft, title: event.target.value })} /></div><div><Label>Slug</Label><Input value={entryDraft.slug} onChange={(event) => setEntryDraft({ ...entryDraft, slug: event.target.value })} /></div></div><div><Label>Locale</Label><Input value={entryDraft.locale} onChange={(event) => setEntryDraft({ ...entryDraft, locale: event.target.value })} /></div>{fields.map((field) => <div key={field.key}><Label>{field.key}{field.required ? ' *' : ''}</Label>{field.type === 'textarea' ? <Textarea value={String(entryDraft.data[field.key] ?? '')} onChange={(event) => setEntryDraft({ ...entryDraft, data: { ...entryDraft.data, [field.key]: event.target.value } })} /> : <Input type={field.type === 'number' ? 'number' : 'text'} value={String(entryDraft.data[field.key] ?? '')} onChange={(event) => setEntryDraft({ ...entryDraft, data: { ...entryDraft.data, [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value } })} />}</div>)}<div className="flex flex-wrap gap-2"><Button onClick={() => void saveEntry()} disabled={saving || !typeId}><Save className="mr-2 h-4 w-4" />Save draft</Button>{selected?.status === 'draft' && <Button variant="outline" onClick={() => void transition('review')} disabled={saving}><Send className="mr-2 h-4 w-4" />Submit</Button>}{selected?.status === 'review' && <Button onClick={() => void transition('published')} disabled={saving}><Upload className="mr-2 h-4 w-4" />Publish</Button>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Revisions</CardTitle></CardHeader><CardContent className="space-y-3">{revisions.length ? revisions.map((revision) => <div key={String(revision.id)} className="border-l-2 pl-3"><p className="text-sm font-medium">Revision {String(revision.revision_number)}</p><p className="text-xs text-muted-foreground">{new Date(String(revision.created_at)).toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">{String(revision.change_summary ?? 'Record updated')}</p></div>) : <p className="text-sm text-muted-foreground"><FileText className="mr-1 inline h-4 w-4" />Select a record to inspect its history.</p>}</CardContent></Card></div>
  </main></div>;
}