import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const REQUIRED_PROJECT_COLUMNS = [
  'id',
  'name',
  'description',
  'owner_id',
  'template_type',
  'created_at',
  'updated_at',
] as const;

const OPTIONAL_PROJECT_COLUMNS = [
  'slug',
  'status',
  'publish_status',
  'business_id',
  'site_id',
  'published_at',
  'custom_domain',
  'settings',
] as const;

const unsupportedProjectColumns = new Set<string>();

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string | null;
  owner_id?: string | null;
  template_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  slug?: string | null;
  status?: string | null;
  publish_status?: string | null;
  business_id?: string | null;
  site_id?: string | null;
  published_at?: string | null;
  custom_domain?: string | null;
  settings?: Record<string, unknown> | null;
}

interface ProjectListOptions {
  ownerId: string;
  businessId?: string | null;
  businessIds?: string[];
  limit?: number;
  withCount?: boolean;
}

interface ProjectMutationInput {
  name: string;
  description?: string | null;
  owner_id: string;
  template_type?: string | null;
  slug?: string | null;
  status?: string | null;
  publish_status?: string | null;
  business_id?: string | null;
  published_at?: string | null;
  custom_domain?: string | null;
  settings?: Record<string, unknown> | null;
}

function buildProjectSelectColumns(extraColumns: string[] = []) {
  const columns = [
    ...REQUIRED_PROJECT_COLUMNS,
    ...OPTIONAL_PROJECT_COLUMNS,
    ...extraColumns,
  ].filter((column, index, source) => source.indexOf(column) === index && !unsupportedProjectColumns.has(column));

  return columns.join(', ');
}

function extractMissingProjectColumn(error: PostgrestError | null) {
  const message = error?.message || '';
  const details = error?.details || '';
  const haystack = `${message}\n${details}`;

  const patterns = [
    /Could not find the '([^']+)' column of 'projects' in the schema cache/i,
    /column ["']?(?:public\.)?projects\.([^"'\s]+)["']? does not exist/i,
    /column ["']?([^"'\s]+)["']? of relation ["']?projects["']? does not exist/i,
  ];

  for (const pattern of patterns) {
    const match = haystack.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/^projects\./i, '').trim();
    }
  }

  return null;
}

function rememberMissingProjectColumn(error: PostgrestError | null) {
  const column = extractMissingProjectColumn(error);
  if (column) {
    unsupportedProjectColumns.add(column);
  }
  return column;
}

function normalizeProjectRecord(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: (row.description as string | null | undefined) ?? null,
    owner_id: (row.owner_id as string | null | undefined) ?? null,
    template_type: (row.template_type as string | null | undefined) ?? null,
    created_at: (row.created_at as string | null | undefined) ?? null,
    updated_at: (row.updated_at as string | null | undefined) ?? null,
    slug: (row.slug as string | null | undefined) ?? null,
    status: (row.status as string | null | undefined) ?? null,
    publish_status: (row.publish_status as string | null | undefined) ?? null,
    business_id: (row.business_id as string | null | undefined) ?? null,
    site_id: (row.site_id as string | null | undefined) ?? null,
    published_at: (row.published_at as string | null | undefined) ?? null,
    custom_domain: (row.custom_domain as string | null | undefined) ?? null,
    settings: (row.settings as Record<string, unknown> | null | undefined) ?? null,
  };
}

function sanitizeProjectMutation(input: ProjectMutationInput) {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => value !== undefined && !unsupportedProjectColumns.has(key)),
  );
}

async function runProjectQuery<T extends { error: PostgrestError | null }>(
  execute: (selectColumns: string) => Promise<T>,
) {
  const attemptedColumns = new Set<string>();

  while (true) {
    const result = await execute(buildProjectSelectColumns());
    if (!result.error) {
      return result;
    }

    const missingColumn = rememberMissingProjectColumn(result.error);
    if (!missingColumn || attemptedColumns.has(missingColumn)) {
      return result;
    }

    attemptedColumns.add(missingColumn);
  }
}

async function runProjectMutation(
  input: ProjectMutationInput,
) {
  const attemptedColumns = new Set<string>();

  while (true) {
    const payload = sanitizeProjectMutation(input);
    const result = await (supabase as any)
      .from('projects')
      .insert(payload)
      .select(buildProjectSelectColumns())
      .single();

    if (!result.error) {
      return {
        data: normalizeProjectRecord(result.data as Record<string, unknown>),
        error: null,
      };
    }

    const missingColumn = rememberMissingProjectColumn(result.error);
    if (!missingColumn || attemptedColumns.has(missingColumn)) {
      return {
        data: null,
        error: result.error,
      };
    }

    attemptedColumns.add(missingColumn);
  }
}

export function canUseProjectBusinessScope() {
  return !unsupportedProjectColumns.has('business_id');
}

export async function getProjectByIdCompat(projectId: string) {
  const result: any = await runProjectQuery((selectColumns) =>
    (supabase as any)
      .from('projects')
      .select(selectColumns)
      .eq('id', projectId)
      .maybeSingle(),
  );

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error,
    };
  }

  return {
    data: normalizeProjectRecord(result.data as Record<string, unknown>),
    error: null,
  };
}

export async function createProjectCompat(input: ProjectMutationInput) {
  return runProjectMutation(input);
}

/**
 * Update an existing project (rename, change settings, status, …).
 * Mirrors the silent-drop behaviour of insert so unknown columns don't break the call.
 */
export async function updateProjectCompat(
  projectId: string,
  patch: Partial<Omit<ProjectMutationInput, 'owner_id'>>,
) {
  const attemptedColumns = new Set<string>();

  while (true) {
    const payload = Object.fromEntries(
      Object.entries(patch).filter(
        ([key, value]) => value !== undefined && !unsupportedProjectColumns.has(key),
      ),
    );

    if (Object.keys(payload).length === 0) {
      return { data: null, error: null };
    }

    const result = await (supabase as any)
      .from('projects')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select(buildProjectSelectColumns())
      .single();

    if (!result.error) {
      return {
        data: normalizeProjectRecord(result.data as Record<string, unknown>),
        error: null,
      };
    }

    const missingColumn = rememberMissingProjectColumn(result.error);
    if (!missingColumn || attemptedColumns.has(missingColumn)) {
      return { data: null, error: result.error };
    }
    attemptedColumns.add(missingColumn);
  }
}

/**
 * Rename helper. Updates `projects.name` (the DB trigger mirrors the change into
 * builder_drafts.name + metadata.projectName so the WebBuilder header / lists stay in sync).
 */
export async function renameProjectCompat(projectId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: new Error('Name cannot be empty') as any };
  return updateProjectCompat(projectId, { name: trimmed });
}

export async function listProjectsCompat(options: ProjectListOptions) {
  const {
    ownerId,
    businessId,
    businessIds = [],
    limit,
    withCount = false,
  } = options;

  const scopedBusinessIds = Array.from(new Set(
    [
      ...(businessId ? [businessId] : []),
      ...businessIds,
    ].filter(Boolean),
  ));

  if (scopedBusinessIds.length > 0 && canUseProjectBusinessScope()) {
    const businessScoped: any = await runProjectQuery((selectColumns) => {
      let query = (supabase as any)
        .from('projects')
        .select(selectColumns, withCount ? { count: 'exact' } : undefined)
        .in('business_id', scopedBusinessIds)
        .order('updated_at', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      return query;
    });

    if (!businessScoped.error) {
      return {
        data: (businessScoped.data || []).map((row) => normalizeProjectRecord(row as Record<string, unknown>)),
        count: businessScoped.count || 0,
        error: null,
      };
    }
  }

  const ownerScoped: any = await runProjectQuery((selectColumns) => {
    let query = (supabase as any)
      .from('projects')
      .select(selectColumns, withCount ? { count: 'exact' } : undefined)
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    return query;
  });

  return {
    data: (ownerScoped.data || []).map((row) => normalizeProjectRecord(row as Record<string, unknown>)),
    count: ownerScoped.count || 0,
    error: ownerScoped.error,
  };
}

export async function listProjectIdsByBusinessCompat(businessIds: string[]) {
  const scopedBusinessIds = Array.from(new Set(businessIds.filter(Boolean)));
  if (scopedBusinessIds.length === 0 || !canUseProjectBusinessScope()) {
    return {
      data: [] as Array<{ id: string }>,
      error: null,
    };
  }

  const attemptedColumns = new Set<string>();

  while (true) {
    const result = await supabase
      .from('projects')
      .select('id')
      .in('business_id', scopedBusinessIds);

    if (!result.error) {
      return {
        data: (result.data || []) as Array<{ id: string }>,
        error: null,
      };
    }

    const missingColumn = rememberMissingProjectColumn(result.error);
    if (!missingColumn || attemptedColumns.has(missingColumn)) {
      return {
        data: [] as Array<{ id: string }>,
        error: result.error,
      };
    }

    attemptedColumns.add(missingColumn);

    if (missingColumn === 'business_id') {
      return {
        data: [] as Array<{ id: string }>,
        error: null,
      };
    }
  }
}
