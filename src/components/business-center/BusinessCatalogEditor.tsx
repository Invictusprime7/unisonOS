/**
 * BusinessCatalogEditor — Milestone 3 (M3) Business Center CRUD surface.
 *
 * Given a section contract (e.g. "ServicesGrid" → services resource), renders
 * a browsable/editable list scoped to the active business. Reads and writes
 * route through cmsRecordService; the server resolves physical tables and
 * applies permission checks.
 *
 * Field schemas are declared per table below so we can support every catalog
 * source in `sectionDataContracts.ts` without hand-rolling seven pages.
 * When a row is added/edited/deleted we dispatch:
 *   - `unison:catalog-seeded` so CatalogInspectorPanel refreshes
 *   - `postMessage({ type: 'CATALOG_BINDINGS_CHANGED' })` so live previews re-hydrate
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SECTION_DATA_CONTRACTS,
  type SectionDataContract,
} from '@/services/catalog/sectionDataContracts';
import {
  getCatalogSurface,
  type CatalogFieldSpec,
  type CatalogFieldType,
  type CatalogSurface,
} from '@/platform/core/catalogSurfaceRegistry';
import { loadBusinessMemberships } from '@/services/businessMembership';
import {
  createCmsRecord,
  listCmsRecords,
  removeCmsRecord,
  updateCmsRecord,
} from '@/services/cmsRecordService';

// ─────────────────────────────────────────────────────────────────────────────
// Editor schema (derived from the canonical catalogSurfaceRegistry — the
// single source of truth for every catalog surface's shape).
// ─────────────────────────────────────────────────────────────────────────────

type FieldType = CatalogFieldType;
type FieldSpec = CatalogFieldSpec;

interface TableSchema {
  resource: string;
  titleField: string;
  subtitleField?: string;
  imageField?: string;
  featuredField?: string;
  fields: readonly FieldSpec[];
  defaults: Record<string, unknown>;
}

function schemaFromSurface(surface: CatalogSurface): TableSchema {
  const f = surface.fields;
  return {
    resource: surface.surfaceId,
    titleField: f.title,
    subtitleField: f.category ?? f.description,
    imageField: f.image,
    featuredField: f.featured ?? f.active,
    fields: surface.editableFields,
    defaults: surface.newRowDefaults,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Value coercion helpers
// ─────────────────────────────────────────────────────────────────────────────

function coerceInput(field: FieldSpec, raw: string | boolean): unknown {
  switch (field.type) {
    case 'boolean':
      return Boolean(raw);
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'money': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'money-cents': {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.round(n * 100) : 0;
    }
    case 'rating': {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return Math.min(5, Math.max(0, n));
    }
    case 'tags':
      return typeof raw === 'string' ? raw.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
    case 'text':
    case 'textarea':
    case 'image':
    default:
      return typeof raw === 'string' ? raw : String(raw);
  }
}

function displayValue(field: FieldSpec, row: Record<string, unknown>): string {
  const raw = row[field.key];
  if (raw === null || raw === undefined) return '';
  if (field.type === 'tags' && Array.isArray(raw)) return raw.join(', ');
  if (field.type === 'money-cents') {
    const cents = Number(raw);
    if (!Number.isFinite(cents)) return '';
    return (cents / 100).toFixed(2);
  }
  return String(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface BusinessRow {
  id: string;
  name: string;
}

interface Props {
  sectionType: string; // key into SECTION_DATA_CONTRACTS
}

export function BusinessCatalogEditor({ sectionType }: Props) {
  const contract: SectionDataContract | undefined = SECTION_DATA_CONTRACTS[sectionType];
  const surface = useMemo(
    () => getCatalogSurface(sectionType),
    [sectionType],
  );
  const schema = useMemo(() => (surface ? schemaFromSurface(surface) : null), [surface]);


  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Load businesses the caller can access through the membership service ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const list = user
        ? (await loadBusinessMemberships(user.id)).map((business) => ({
            id: business.businessId,
            name: business.name,
          }))
        : [];
      if (cancelled) return;
      if (!user) {
        toast.error('Could not load your businesses');
        setLoading(false);
        return;
      }
      setBusinesses(list);
      // A single accessible tenant is unambiguous. Multiple tenants require
      // an explicit choice until ActiveUnisonContext is wired into this page.
      setBusinessId((previous) => (
        previous && list.some((business) => business.id === previous)
          ? previous
          : list.length === 1 ? list[0].id : null
      ));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load rows for the active business+resource ────────────────────────────
  const loadRows = useCallback(async () => {
    if (!schema || !businessId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listCmsRecords({ businessId, resource: schema.resource });
      setRows(data);
    } catch (error) {
      console.warn('[BusinessCatalogEditor] load rows failed', error);
      toast.error('Failed to load rows');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [schema, businessId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const bumpPreview = useCallback(() => {
    try {
      window.postMessage(
        { type: 'CATALOG_BINDINGS_CHANGED', projectId: null, businessId },
        '*',
      );
      window.dispatchEvent(
        new CustomEvent('unison:catalog-seeded', {
          detail: { businessId, resource: schema?.resource },
        }),
      );
    } catch {
      /* noop */
    }
  }, [businessId, schema]);

  const startNew = () => {
    if (!schema) return;
    setEditingId('new');
    setDraft({ ...schema.defaults });
  };

  const startEdit = (row: Record<string, unknown>) => {
    setEditingId(String(row.id));
    setDraft({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const save = async () => {
    if (!schema || !businessId) return;
    // Required-field guard.
    for (const f of schema.fields) {
      if (f.required) {
        const v = draft[f.key];
        if (v === undefined || v === null || String(v).trim() === '') {
          toast.error(`${f.label} is required`);
          return;
        }
      }
    }
    setSaving(true);
    const payload: Record<string, unknown> = { ...draft, business_id: businessId };
    // Never allow client to override server-managed columns.
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    try {
      if (editingId === 'new') {
        await createCmsRecord({ businessId, resource: schema.resource, values: payload });
      } else if (editingId) {
        await updateCmsRecord({
          businessId,
          resource: schema.resource,
          recordId: editingId,
          values: payload,
        });
      }
    } catch (error) {
      console.warn('[BusinessCatalogEditor] save failed', error);
      toast.error('Save failed — check required fields');
      return;
    } finally {
      setSaving(false);
    }
    toast.success(editingId === 'new' ? 'Added' : 'Saved');
    setEditingId(null);
    setDraft({});
    bumpPreview();
    await loadRows();
  };

  const remove = async (id: string) => {
    if (!schema) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this row?')) return;
    setDeletingId(id);
    try {
      if (!businessId) return;
      await removeCmsRecord({ businessId, resource: schema.resource, recordId: id });
    } catch (error) {
      console.warn('[BusinessCatalogEditor] delete failed', error);
      toast.error('Delete failed');
      return;
    } finally {
      setDeletingId(null);
    }
    toast.success('Deleted');
    bumpPreview();
    await loadRows();
  };

  const listSummary = useMemo(() => {
    if (!schema) return '';
    return `${rows.length} ${rows.length === 1 ? contract?.rowLabel ?? 'row' : `${contract?.rowLabel ?? 'row'}s`}`;
  }, [rows.length, contract, schema]);

  if (!contract || !schema || schema.fields.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Editor not available for section type <code>{sectionType}</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{contract.friendlyName}</h1>
          <p className="text-sm text-muted-foreground">
            Manage the {contract.rowLabel}s that fill your live {contract.friendlyName.toLowerCase()} sections.
            {' '}
            {listSummary && <span className="text-muted-foreground/80">· {listSummary}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {businesses.length > 1 && (
            <Select value={businessId ?? undefined} onValueChange={(v) => setBusinessId(v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={startNew} disabled={!businessId || editingId === 'new'}>
            <Plus className="mr-2 h-4 w-4" />
            Add {contract.rowLabel}
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : businesses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You don't have a business yet. Create one from the launcher to start adding {contract.rowLabel}s.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {editingId === 'new' && (
            <EditorForm
              schema={schema}
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancelEdit}
              saving={saving}
              heading={`New ${contract.rowLabel}`}
            />
          )}

          {rows.length === 0 && editingId !== 'new' ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No {contract.rowLabel}s yet. Add your first one to start hydrating your live sections.
              </CardContent>
            </Card>
          ) : (
            rows.map((row) => {
              const id = String(row.id);
              const isEditing = editingId === id;
              if (isEditing) {
                return (
                  <EditorForm
                    key={id}
                    schema={schema}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={save}
                    onCancel={cancelEdit}
                    saving={saving}
                    heading={`Edit ${contract.rowLabel}`}
                  />
                );
              }
              return (
                <Card key={id}>
                  <CardContent className="flex items-start justify-between gap-4 py-4">
                    <div className="flex min-w-0 items-start gap-4">
                      {schema.imageField && row[schema.imageField] ? (
                        <img
                          src={String(row[schema.imageField])}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 flex-shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">
                            {String(row[schema.titleField] ?? '(untitled)')}
                          </h3>
                          {schema.featuredField && row[schema.featuredField] ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <Star className="h-3 w-3" /> live
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              hidden
                            </span>
                          )}
                        </div>
                        {schema.subtitleField && row[schema.subtitleField] && (
                          <p className="truncate text-xs text-muted-foreground">
                            {String(row[schema.subtitleField])}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(id)}
                        disabled={deletingId === id}
                      >
                        {deletingId === id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorForm — inline card used for both create and edit
// ─────────────────────────────────────────────────────────────────────────────

interface EditorFormProps {
  schema: TableSchema;
  draft: Record<string, unknown>;
  setDraft: (d: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  heading: string;
}

function EditorForm({ schema, draft, setDraft, onSave, onCancel, saving, heading }: EditorFormProps) {
  const update = (field: FieldSpec, value: string | boolean) => {
    setDraft({ ...draft, [field.key]: coerceInput(field, value) });
  };

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{heading}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {schema.fields.map((field) => {
            const span = field.span === 'full' ? 'sm:col-span-2' : '';
            const value = displayValue(field, draft);
            if (field.type === 'textarea') {
              return (
                <div key={field.key} className={span}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Textarea
                    id={field.key}
                    value={value}
                    onChange={(e) => update(field, e.target.value)}
                    rows={3}
                  />
                </div>
              );
            }
            if (field.type === 'boolean') {
              return (
                <div key={field.key} className={`flex items-center justify-between rounded-md border px-3 py-2 ${span}`}>
                  <Label htmlFor={field.key} className="cursor-pointer">
                    {field.label}
                  </Label>
                  <Switch
                    id={field.key}
                    checked={Boolean(draft[field.key])}
                    onCheckedChange={(v) => update(field, v)}
                  />
                </div>
              );
            }
            const inputType =
              field.type === 'number' || field.type === 'money' || field.type === 'money-cents' || field.type === 'rating'
                ? 'number'
                : 'text';
            const step = field.type === 'rating' ? '0.1' : field.type === 'money' || field.type === 'money-cents' ? '0.01' : '1';
            return (
              <div key={field.key} className={span}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={inputType}
                  step={inputType === 'number' ? step : undefined}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(e) => update(field, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
