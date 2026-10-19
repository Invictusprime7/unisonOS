import type { ResourceRecord } from './resourceTypes';

export const PERSISTED_RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Pure scoped-row resolution; ambiguity never authorizes creation or a write. */
export function resolveResourceIdentity(recordId: string, rows: readonly ResourceRecord[]): string | null {
  const wanted = recordId.toLowerCase();
  const candidates = [
    rows.filter((row) => String(row.id).toLowerCase() === wanted),
    rows.filter((row) => typeof row.slug === 'string' && row.slug.toLowerCase() === wanted),
    rows.filter((row) => [row.name, row.title].some((value) => typeof value === 'string' && slug(value) === wanted)),
  ];
  for (const matches of candidates) {
    const ids = [...new Set(matches.map((row) => row.id))];
    if (ids.length > 1) throw new Error(`More than one saved item matches "${recordId}"; select a specific record before editing.`);
    if (ids.length === 1) return ids[0];
  }
  return null;
}