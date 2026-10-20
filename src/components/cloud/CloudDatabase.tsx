/**
 * CloudDatabase — project-scoped records overview
 *
 * Project records use project_id. Installed recipe packs remain business-scoped.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getInstalledPacks, type InstalledPack } from '@/services/recipeManagerService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { naturalLanguageEventLabel, naturalLanguageRecordLabel } from '@/services/resources/recordIdentity';
import { listProjectCrmResources } from '@/services/resources/resourceRegistry';
import { applyResourceOp, queryResource } from '@/services/resources/resourceRuntime';
import type { ResourceDefinition, ResourceFieldDefinition, ResourceRecord } from '@/services/resources/resourceTypes';
import { toast } from 'sonner';
import {
  Database,
  Pencil,
  RefreshCw,
  Save,
  Table2,
  PackageCheck,
  PackageX,
  CheckCircle2,
  Clock,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface TableStat {
  label: string;
  table: string;
  count: number | null;
  error?: boolean;
  /** colour class for the accent stripe */
  color: string;
}

const TABLE_DEFS: Omit<TableStat, 'count' | 'error'>[] = [
  { label: 'Contacts', table: 'crm_contacts', color: 'text-cyan-400' },
  { label: 'Leads', table: 'crm_leads', color: 'text-fuchsia-400' },
  { label: 'Form submissions', table: 'crm_form_submissions', color: 'text-amber-400' },
  { label: 'Workflow activity', table: 'ghl_webhook_events', color: 'text-sky-400' },
];

interface RecentIntake {
  id: string;
  type: string;
  label: string;
  detail: string;
  createdAt: string;
}

interface ProjectCrmRecords {
  resource: ResourceDefinition;
  records: ResourceRecord[];
}

function fieldDraft(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function fieldValue(field: ResourceFieldDefinition, value: string): unknown {
  if (field.type === 'tags') return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  if (['number', 'money', 'money-cents', 'rating'].includes(field.type)) {
    return value.trim() === '' ? null : Number(value);
  }
  return value.trim() === '' ? null : value;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchCount(table: string, projectId: string): Promise<number | null> {
  try {
    const { count, error } = await (supabase as any)
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function fetchRecentIntakes(projectId: string): Promise<RecentIntake[]> {
  const [forms, leads, workflows] = await Promise.all([
    (supabase as any)
      .from('crm_form_submissions')
      .select('id, form_name, form_id, data, intent, created_at, submitted_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(8),
    (supabase as any)
      .from('crm_leads')
      .select('id, title, contact_name, email, status, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(8),
    (supabase as any)
      .from('ghl_webhook_events')
      .select('id, event_type, payload, contact_id, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const rows: RecentIntake[] = [];
  for (const row of forms.data ?? []) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    rows.push({
      id: `form:${row.id}`,
      type: row.intent ? naturalLanguageEventLabel(String(row.intent)) : 'Form submission',
      label: naturalLanguageRecordLabel(data, row.form_name || 'Website form'),
      detail: typeof data.email === 'string' ? data.email : row.form_name || 'Website intake',
      createdAt: row.submitted_at || row.created_at,
    });
  }
  for (const row of leads.data ?? []) {
    rows.push({
      id: `lead:${row.id}`,
      type: 'Lead',
      label: naturalLanguageRecordLabel({ fullName: row.contact_name, title: row.title }, 'New lead'),
      detail: row.email || row.status || 'CRM lead',
      createdAt: row.created_at,
    });
  }
  for (const row of workflows.data ?? []) {
    rows.push({
      id: `event:${row.id}`,
      type: naturalLanguageEventLabel(String(row.event_type || 'activity')),
      label: naturalLanguageRecordLabel(row.payload, row.contact_id ? 'Contact activity' : 'Workflow activity'),
      detail: 'GoHighLevel',
      createdAt: row.created_at,
    });
  }

  return rows
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 12);
}

// ── Component ──────────────────────────────────────────────────────────────

interface CloudDatabaseProps {
  businessId: string;
  businessName: string;
  projectId: string | null;
  projectName: string;
}

export function CloudDatabase({ businessId, businessName, projectId, projectName }: CloudDatabaseProps) {
  const [stats, setStats] = useState<TableStat[]>([]);
  const [recentIntakes, setRecentIntakes] = useState<RecentIntake[]>([]);
  const [crmRecords, setCrmRecords] = useState<ProjectCrmRecords[]>([]);
  const [editingRecord, setEditingRecord] = useState<{ resource: ResourceDefinition; record: ResourceRecord } | null>(null);
  const [recordDraft, setRecordDraft] = useState<Record<string, string>>({});
  const [savingRecord, setSavingRecord] = useState(false);
  const [packs, setPacks] = useState<InstalledPack[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    if (!projectId) {
      setStats([]);
      setRecentIntakes([]);
      setLoadingStats(false);
      return;
    }
    const results = await Promise.all(
      TABLE_DEFS.map(async (def) => {
        const count = await fetchCount(def.table, projectId);
        return { ...def, count, error: count === null };
      })
    );
    setStats(results);
    setRecentIntakes(await fetchRecentIntakes(projectId));
    setLoadingStats(false);
    setLastRefreshed(new Date());
  }, [projectId]);

  const loadCrmRecords = useCallback(async () => {
    if (!projectId) {
      setCrmRecords([]);
      return;
    }
    try {
      const context = { businessId, projectId, mode: 'cloud' as const };
      const resources = await Promise.all(listProjectCrmResources().map(async (resource) => ({
        resource,
        records: await queryResource(resource.key, context),
      })));
      setCrmRecords(resources);
    } catch (error) {
      console.error('[CloudDatabase] Failed to load project CRM records', error);
      toast.error('Could not load project CRM records');
    }
  }, [businessId, projectId]);

  const loadPacks = useCallback(async () => {
    setLoadingPacks(true);
    const result = await getInstalledPacks(businessId);
    // Sort: enabled first, then by packName
    result.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.packName.localeCompare(b.packName);
    });
    setPacks(result);
    setLoadingPacks(false);
  }, [businessId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadCrmRecords();
  }, [loadCrmRecords]);

  useEffect(() => {
    if (businessId) loadPacks();
  }, [businessId, loadPacks]);

  const refresh = () => {
    loadStats();
    loadCrmRecords();
    loadPacks();
  };

  const openRecordEditor = (resource: ResourceDefinition, record: ResourceRecord) => {
    setEditingRecord({ resource, record });
    setRecordDraft(Object.fromEntries(resource.schema.filter((field) => field.editable).map((field) => [field.key, fieldDraft(record[field.key])] )));
  };

  const saveRecord = async () => {
    if (!editingRecord || !projectId || savingRecord) return;
    const { resource, record } = editingRecord;
    for (const field of resource.schema.filter((candidate) => candidate.editable && candidate.required)) {
      if (!recordDraft[field.key]?.trim()) {
        toast.error(`${field.label} is required`);
        return;
      }
    }
    const values = Object.fromEntries(resource.schema
      .filter((field) => field.editable)
      .map((field) => [field.key, fieldValue(field, recordDraft[field.key] ?? '')]));
    if (Object.values(values).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
      toast.error('Enter a valid number');
      return;
    }

    setSavingRecord(true);
    try {
      await applyResourceOp({
        op: 'update',
        ref: { resourceKey: resource.key, kind: resource.kind, recordId: record.id },
        values,
        expected: record.updated_at ? { updated_at: record.updated_at } : undefined,
      }, { businessId, projectId, mode: 'cloud' });
      toast.success(`${resource.label.slice(0, -1)} updated`);
      setEditingRecord(null);
      await Promise.all([loadCrmRecords(), loadStats()]);
    } catch (error) {
      toast.error('Could not save record', { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setSavingRecord(false);
    }
  };

  const isLoading = loadingStats || loadingPacks;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Database className="h-5 w-5 text-cyan-400" />
            Project Database
          </h2>
          <p className="mt-0.5 text-sm text-white/45">
            <span className="text-white/70">{projectName}</span> · {businessName}. Project-scoped records and intake activity.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-white/10"
          onClick={refresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn('mr-2 h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {lastRefreshed && !isLoading && (
        <p className="text-[11px] text-white/30">
          Last refreshed at {lastRefreshed.toLocaleTimeString()}
        </p>
      )}

      {!projectId ? (
        <Card className="border-white/5 bg-white/[0.02]">
          <CardContent className="py-10 text-center text-sm text-white/45">
            Select a project to view its database records.
          </CardContent>
        </Card>
      ) : <>
      {/* ── Project row counts ─────────────────────────────────────── */}
      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Table2 className="h-4 w-4 text-cyan-400" />
            Project records
          </CardTitle>
          <CardDescription>
            Counts are filtered by the selected project. Internal record IDs stay hidden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {loadingStats
              ? Array.from({ length: TABLE_DEFS.length }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />
                ))
              : stats.map((stat) => (
                  <div
                    key={stat.table}
                    className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                  >
                    <span className="text-[11px] uppercase tracking-widest text-white/35">
                      {stat.label}
                    </span>
                    {stat.error ? (
                      <span className="text-sm text-white/25">—</span>
                    ) : (
                      <span className={cn('text-2xl font-semibold tabular-nums', stat.color)}>
                        {stat.count?.toLocaleString() ?? '—'}
                      </span>
                    )}
                  </div>
                ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-amber-400" />
            Recent project intake
          </CardTitle>
          <CardDescription>Forms, CRM leads, and GoHighLevel activity for this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.04]" />)}</div>
          ) : recentIntakes.length === 0 ? (
            <p className="py-5 text-center text-sm text-white/40">No project intake records yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {recentIntakes.map((row) => (
                <div key={row.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(10rem,1fr)_minmax(8rem,1fr)_auto] sm:items-center sm:gap-4">
                  <Badge variant="outline" className="w-fit border-white/10 text-white/60">{row.type}</Badge>
                  <span className="truncate text-sm font-medium text-white/85">{row.label}</span>
                  <span className="truncate text-xs text-white/40">{row.detail}</span>
                  <time className="text-[11px] text-white/35">{new Date(row.createdAt).toLocaleString()}</time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-cyan-400" />
            Project CRM records
          </CardTitle>
          <CardDescription>Edits save through Unison’s project-scoped resource runtime. Creation stays with intake workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingStats ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.04]" />)}</div>
          ) : crmRecords.every(({ records }) => records.length === 0) ? (
            <p className="py-5 text-center text-sm text-white/40">No project contacts or leads yet.</p>
          ) : crmRecords.map(({ resource, records }) => (
            <section key={resource.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">{resource.label}</h3>
              {records.length === 0 ? (
                <p className="text-xs text-white/30">No {resource.label.toLowerCase()} in this project.</p>
              ) : records.slice(0, 25).map((record) => {
                const detail = [record.email, record.company, record.status].find((value) => typeof value === 'string' && value.trim());
                return (
                  <div key={record.id} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/85">{naturalLanguageRecordLabel(record, resource.label.slice(0, -1))}</p>
                      {detail && <p className="truncate text-xs text-white/40">{String(detail)}</p>}
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 text-white/60" onClick={() => openRecordEditor(resource, record)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                );
              })}
            </section>
          ))}
        </CardContent>
      </Card>
      </>}

      {/* ── Migration / Pack Log ────────────────────────────────────── */}
      <Card className="border-white/5 bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="h-4 w-4 text-emerald-400" />
            Business-level installed packs
            {packs.length > 0 && (
              <Badge variant="outline" className="ml-1 border-white/10 text-white/50 text-[10px]">
                {packs.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Recipe packs provisioned by <code className="text-xs text-white/50">install-system</code>.
            Each pack represents a capability group (booking, leads, ecommerce, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPacks ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg bg-white/[0.04]" />
              ))}
            </div>
          ) : packs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-6 py-8 text-center">
              <PackageX className="mx-auto mb-3 h-8 w-8 text-white/20" />
              <p className="text-sm font-medium text-white/40">No packs installed</p>
              <p className="mt-1 text-xs text-white/25">
                Packs are auto-provisioned when you first launch a system or save automation defaults.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {packs.map((pack) => (
                <div key={pack.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {pack.enabled ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <PackageX className="h-4 w-4 shrink-0 text-white/25" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{pack.packName}</p>
                    {pack.industry && (
                      <p className="text-xs text-white/40 capitalize">{pack.industry}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {pack.installedAt && (
                      <span className="flex items-center gap-1 text-[11px] text-white/30">
                        <Clock className="h-3 w-3" />
                        {new Date(pack.installedAt).toLocaleDateString()}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        pack.enabled
                          ? 'border-emerald-500/30 text-emerald-300'
                          : 'border-white/10 text-white/30'
                      )}
                    >
                      {pack.enabled ? 'active' : 'disabled'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Notice ─────────────────────────────────────────────────── */}
      <p className="text-[11px] text-white/20">
        CRM edits are project-scoped and saved through Resource Runtime. Recipe packs remain business-level.
      </p>
    </div>

    <Dialog open={Boolean(editingRecord)} onOpenChange={(open) => { if (!open && !savingRecord) setEditingRecord(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#0d0d18] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {editingRecord?.resource.label.slice(0, -1).toLowerCase()}</DialogTitle>
          <DialogDescription>Changes are limited to this project and the fields owned by this CRM record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {editingRecord?.resource.schema.filter((field) => field.editable).map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`crm-record-${field.key}`}>{field.label}</Label>
              {field.type === 'textarea' ? (
                <Textarea id={`crm-record-${field.key}`} value={recordDraft[field.key] ?? ''} onChange={(event) => setRecordDraft((current) => ({ ...current, [field.key]: event.target.value }))} />
              ) : (
                <Input id={`crm-record-${field.key}`} type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : ['number', 'money', 'money-cents', 'rating'].includes(field.type) ? 'number' : 'text'} value={recordDraft[field.key] ?? ''} onChange={(event) => setRecordDraft((current) => ({ ...current, [field.key]: event.target.value }))} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingRecord(null)} disabled={savingRecord}>Cancel</Button>
          <Button onClick={saveRecord} disabled={savingRecord}>
            <Save className="mr-2 h-4 w-4" />{savingRecord ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
