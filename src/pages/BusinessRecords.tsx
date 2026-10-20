import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecordFieldsEditor } from '@/components/creatives/web-builder/RecordFieldsEditor';
import { loadBusinessMemberships } from '@/services/businessMembership';
import { listContentTypes, mutateContentRecord, transitionContentRecord } from '@/services/cmsRecordService';
import { canonicalContentSlug, contentTypeToResource, listRecordCollections, registerContentTypes, resourceCreateDefaults, type RecordCollectionKind } from '@/services/resources/resourceRegistry';
import { applyResourceOp, onResourceInvalidated } from '@/services/resources/resourceRuntime';
import { SEED_CONTENT_TYPES } from '@/services/resources/seedLaunchAssets';
import { loadUnifiedRecords, type UnifiedRecord } from '@/services/resources/recordsProjection';
import './BusinessRecords.css';

export default function BusinessRecords() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('projectId') ?? params.get('id') ?? '';
  const [projects, setProjects] = useState<Array<{ id: string; name: string; business_id: string | null }>>([]);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string }>>([]);
  const [businessId, setBusinessId] = useState('');
  const [records, setRecords] = useState<UnifiedRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [kind, setKind] = useState<RecordCollectionKind | 'all'>(() => params.get('kind') || 'all');
  useEffect(() => { const next = new URLSearchParams(params); if (kind === 'all') next.delete('kind'); else next.set('kind', kind); if (next.toString() !== params.toString()) setParams(next, { replace: true }); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (alive) setErrors(['Sign in to view your records.']); return; }
        const memberships = await loadBusinessMemberships(user.id);
        const { data, error } = await supabase.from('projects').select('id,name,business_id').order('created_at', { ascending: false });
        if (error) throw error;
        if (!alive) return;
        setProjects(data ?? []);
        setBusinesses(memberships.map((b) => ({ id: b.businessId, name: b.name })));
        setBusinessId(memberships.length === 1 ? memberships[0].businessId : '');
      } catch (error) { if (alive) setErrors([error instanceof Error ? error.message : 'Could not load sites.']); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);
  const selectedProject = projects.find((p) => p.id === projectId);
  const scopedBusinessId = selectedProject ? selectedProject.business_id ?? businessId : '';
  useEffect(() => {
    let alive = true;
    setRecords([]);
    if (!projectId || !scopedBusinessId) return;
    setLoading(true); setErrors([]);
    void (async () => {
      try {
        const types = await listContentTypes({ businessId: scopedBusinessId, projectId });
        if (!alive) return;
        registerContentTypes(types);
        const result = await loadUnifiedRecords({ businessId: scopedBusinessId, projectId, mode: 'builder' });
        if (alive) { setRecords(result.records); setErrors(result.errors); }
      } catch (error) { if (alive) setErrors([error instanceof Error ? error.message : 'Could not load records.']); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [projectId, scopedBusinessId, revision]);
  useEffect(() => { setSelected(null); }, [projectId, scopedBusinessId]);
  useEffect(() => onResourceInvalidated((event) => {
    if (event.projectId === projectId && event.businessId === scopedBusinessId) setRevision((r) => r + 1);
  }), [projectId, scopedBusinessId]);

  const collections = listRecordCollections();
  // Planned empty CMS collections become installed only on explicit New record.
  for (const [key, seed] of Object.entries(SEED_CONTENT_TYPES)) {
    const resource = contentTypeToResource({ api_key: key, display_name: seed.displayName, field_schema: { fields: seed.fields } });
    if (resource && !collections.some((collection) => collection.resources.some((def) => def.key === resource.key))) {
      const collectionKind = key === 'faq' ? 'faqs' : key === 'case-studies' ? key : resource.key;
      if (!collections.some((collection) => collection.kind === collectionKind)) collections.push({ kind: collectionKind, label: seed.displayName, resources: [] });
    }
  }
  const active = records.find((record) => record.key === selected);
  const visible = records.filter((record) => (kind === 'all' || record.kind === kind) && `${record.title} ${record.kind}`.toLowerCase().includes(search.toLowerCase()));
  async function createRecord() {
    if (kind === 'all' || !projectId || !scopedBusinessId) return;
    setBusy(true);
    try {
      let def = collections.find((collection) => collection.kind === kind)?.resources[0];
      const key = canonicalContentSlug(kind.replace(/^content:/, ''));
      if (!def && SEED_CONTENT_TYPES[key]) {
        const seed = SEED_CONTENT_TYPES[key];
        await mutateContentRecord({ action: 'content-type-create', businessId: scopedBusinessId, projectId, values: { apiKey: key.replace(/-/g, '_'), displayName: seed.displayName, fieldSchema: { fields: seed.fields } } });
        registerContentTypes(await listContentTypes({ businessId: scopedBusinessId, projectId }));
        def = listRecordCollections().find((collection) => collection.kind === kind)?.resources[0];
      }
      if (!def) throw new Error('This collection is not available yet.');
      const values = resourceCreateDefaults(def);
      await applyResourceOp({ op: 'create', resourceKey: def.key, values }, { businessId: scopedBusinessId, projectId, mode: 'builder' });
      setRevision((r) => r + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create record.'); }
    finally { setBusy(false); }
  }
  async function transition(status: 'draft' | 'review' | 'published' | 'archived') {
    if (!active || !scopedBusinessId) return;
    setBusy(true);
    try {
      await transitionContentRecord({ businessId: scopedBusinessId, projectId, recordId: active.record.id, status });
      setRevision((r) => r + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not change status.'); }
    finally { setBusy(false); }
  }
  return <main className="records-page">
    <header className="records-row"><h1>Records</h1><Link to={projectId ? `/web-builder?id=${projectId}` : '/business/content'}>Back</Link></header>
    <div className="records-row">
      <Select value={projectId} onValueChange={(value) => setParams({ projectId: value })}><SelectTrigger aria-label="Site"><SelectValue placeholder="Select site" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name || 'Untitled site'}</SelectItem>)}</SelectContent></Select>
      {!scopedBusinessId && <Select value={businessId} onValueChange={setBusinessId}><SelectTrigger aria-label="Business"><SelectValue placeholder="Select business" /></SelectTrigger><SelectContent>{businesses.map((business) => <SelectItem key={business.id} value={business.id}>{business.name}</SelectItem>)}</SelectContent></Select>}
      <Button variant="ghost" size="icon" aria-label="Refresh records" disabled={loading || !projectId} onClick={() => setRevision((r) => r + 1)}><RefreshCw /></Button>
    </div>
    <nav className="records-row" aria-label="Record types">
      <Button variant={kind === 'all' ? 'default' : 'link'} onClick={() => setKind('all')}>All</Button>
      {collections.map((collection) => <Button key={collection.kind} variant={kind === collection.kind ? 'default' : 'link'} onClick={() => setKind(collection.kind)}>{collection.label} ({records.filter((r) => r.kind === collection.kind).length})</Button>)}
    </nav>
    <div className="records-row"><Search aria-hidden="true" /><Input aria-label="Search records" placeholder="Search records" value={search} onChange={(event) => setSearch(event.target.value)} /><Button onClick={() => void createRecord()} disabled={busy || !projectId || !scopedBusinessId || kind === 'all'}><Plus />New record</Button></div>
    {errors.map((error) => <p role="alert" key={error}>{error}</p>)}
    {loading ? <p role="status">Loading records…</p> : !projectId ? <p>Select a site.</p> : <div className="records-layout"><div className="records-list">
      {visible.length ? visible.map((item) => <article key={item.key} className="records-item"><Button variant={selected === item.key ? 'secondary' : 'link'} onClick={() => setSelected(item.key)}>{item.title}</Button><span>{collections.find((c) => c.kind === item.kind)?.label}</span><span>{String(item.record.status ?? 'Active')}</span></article>) : <p>No records found.</p>}
    </div>{active && <aside aria-label="Edit record"><h2>{active.title}</h2><RecordFieldsEditor key={active.key} mark={active.key} businessId={scopedBusinessId} projectId={projectId} defaultOpen />{active.resource.kind === 'content' && <div className="records-row">{(['draft', 'review', 'published', 'archived'] as const).filter((status) => status !== active.record.status).map((status) => <Button key={status} variant="outline" disabled={busy} onClick={() => void transition(status)}>{status === 'published' ? 'Publish' : status === 'review' ? 'Submit for review' : status === 'archived' ? 'Archive' : 'Draft'}</Button>)}</div>}</aside>}</div>}
  </main>;
}