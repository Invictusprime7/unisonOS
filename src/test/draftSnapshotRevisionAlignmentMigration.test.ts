import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
const stamp = read('20260930045635_persist_authorship_authority_handoff.sql');
const align = read('20261004123245_align_canonical_snapshots_with_revision.sql');
const base = read('20260815032033_ececf37c-f596-4970-b2d1-7d6574725950.sql');
const buildRecovery = read('20261013144937_canonical_build_row_recovery.sql');
const pointerIntegrity = read('20261021111258_enforce_builder_draft_revision_pointer_integrity.sql');

describe('draft snapshot alignment with stamped revisions', () => {
  it('reproduces the divergence: revision snapshot is mutated on insert while the draft strict-compares it', () => {
    expect(stamp).toContain('NEW.site_bundle_snapshot := COALESCE(NEW.site_bundle_snapshot');
    expect(base).toContain("NEW.metadata->'siteBundleSnapshot' IS DISTINCT FROM v_revision.site_bundle_snapshot");
  });

  it('projects the stored revision snapshot onto the draft before the invariant trigger runs', () => {
    expect(align).toContain('SELECT revision.site_bundle_snapshot');
    expect(align).toMatch(/jsonb_build_object\(\s*'siteBundleSnapshot',\s*v_snapshot\s*\)/);
    expect(align).toContain('BEFORE INSERT OR UPDATE OF last_revision_id, metadata');
    expect('builder_drafts_align_revision_snapshot'.localeCompare('builder_drafts_assert_canonical_projection')).toBeLessThan(0);
    expect(base).toContain('CREATE TRIGGER builder_drafts_assert_canonical_projection');
  });

  it('projects the stored revision snapshot onto bundles before their invariant trigger runs', () => {
    expect(align).toContain('NEW.bundle := v_snapshot');
    expect(align).toContain('BEFORE INSERT OR UPDATE OF revision_id, bundle, site_id');
    expect('site_bundles_align_revision_snapshot'.localeCompare('site_bundles_assert_canonical_revision')).toBeLessThan(0);
    expect(base).toContain('revision.site_bundle_snapshot = NEW.bundle');
  });

  it('repairs historical projections and restores strict canonical guards', () => {
    expect(align).toContain('DROP TRIGGER IF EXISTS builder_drafts_assert_canonical_projection');
    expect(align).toContain('DROP TRIGGER IF EXISTS site_bundles_assert_canonical_revision');
    expect(align).toContain('AND draft.metadata->\'siteBundleSnapshot\' IS DISTINCT FROM revision.site_bundle_snapshot');
    expect(align).toContain('AND bundle.bundle IS DISTINCT FROM revision.site_bundle_snapshot');
    expect(align).toContain('CREATE TRIGGER builder_drafts_assert_canonical_projection');
    expect(align).toContain('CREATE TRIGGER site_bundles_assert_canonical_revision');
  });

  it('restores a missing site build before delegating the canonical commit', () => {
    expect(buildRecovery).toContain("v_metadata->>'siteBuildId'");
    expect(buildRecovery).toContain("v_metadata->>'siteBundleId'");
    expect(buildRecovery).toContain('public.is_project_member(v_user_id, project.id)');
    expect(buildRecovery).toContain('INSERT INTO public.site_builds');
    expect(buildRecovery).toContain('ON CONFLICT (id) DO NOTHING');
    expect(buildRecovery.indexOf('INSERT INTO public.site_builds')).toBeLessThan(
      buildRecovery.indexOf('RETURN public.commit_canonical_site_revision_v2_full'),
    );
  });

  it('keeps draft pointers attached to an immutable committed revision', () => {
    expect(pointerIntegrity).toContain('FOREIGN KEY (last_revision_id)');
    expect(pointerIntegrity).toContain('ON DELETE RESTRICT');
    expect(pointerIntegrity).toContain('BEFORE UPDATE OF id, project_id, business_id, draft_id, status');
    expect(pointerIntegrity).toContain("IF OLD.status = 'committed'");
    expect(pointerIntegrity).toContain('NEW.status IS DISTINCT FROM OLD.status');
    expect(pointerIntegrity).toContain('invalid pointers exist');
  });
});
