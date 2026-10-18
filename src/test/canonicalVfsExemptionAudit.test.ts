import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EXEMPTION_REGISTRY_PATH,
  auditExemptions,
  collectExemptions,
  collectSourceFiles,
} from '../../scripts/lint-canonical-vfs-writes.mjs';

/**
 * P0.5 — every canonical VFS write exemption is audited.
 *
 * The registry is the audit record: each exemption reason maps to an approved
 * category, per-file counts are frozen, and the highest-risk category
 * (`optimistic-hmr`) must be chained to a durable write in the same code path.
 */
describe('canonical VFS exemption audit', () => {
  const registry = JSON.parse(readFileSync(EXEMPTION_REGISTRY_PATH, 'utf8'));
  const sources = collectSourceFiles();

  it('classifies every exemption and keeps the audited baseline', () => {
    expect(auditExemptions(sources, registry)).toEqual([]);
  });

  it('keeps the registry free of stale entries', () => {
    const live = new Set<string>();
    for (const text of Object.values(sources) as string[]) {
      for (const { reason } of collectExemptions(text)) live.add(reason);
    }
    const stale = Object.keys(registry.reasons).filter((reason) => !live.has(reason));
    expect(stale).toEqual([]);
  });

  it('maps every registered reason to a documented category', () => {
    const unknown = Object.entries(registry.reasons as Record<string, string>)
      .filter(([, category]) => !registry.categories[category])
      .map(([reason]) => reason);
    expect(unknown).toEqual([]);
  });

  it('holds the total audited exemption count at the reviewed number', () => {
    const total = Object.values(registry.baseline as Record<string, Record<string, number>>)
      .flatMap((reasons) => Object.values(reasons))
      .reduce((sum, count) => sum + count, 0);
    expect(total).toBe(39);
  });
});
