import { describe, expect, it } from 'vitest';
import { mergeWorkspaceProjects } from '@/services/cloudProjectDrafts';

describe('mergeWorkspaceProjects', () => {
  it('binds the latest durable draft to its Cloud project', () => {
    const result = mergeWorkspaceProjects(
      [{ id: 'project-1', name: 'Storefront', created_at: '2026-07-01' }],
      [
        { id: 'draft-old', project_id: 'project-1', last_revision_id: 'revision-old', updated_at: '2026-07-02' },
        { id: 'draft-latest', project_id: 'project-1', last_revision_id: 'revision-latest', updated_at: '2026-07-03' },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'project-1',
      draft_id: 'draft-latest',
      revision_id: 'revision-latest',
      updated_at: '2026-07-03',
    });
  });

  it('keeps an autosaved draft discoverable while database linkage is repaired', () => {
    const result = mergeWorkspaceProjects([], [{
      id: 'draft-only',
      business_id: 'business-1',
      metadata: { projectName: 'Recovered Website' },
      updated_at: '2026-07-03',
    }]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'draft-only',
        name: 'Recovered Website',
        draft_id: 'draft-only',
        draft_only: true,
      }),
    ]);
  });

  it('does not duplicate a project that already represents its draft', () => {
    const result = mergeWorkspaceProjects(
      [{ id: 'project-1', name: 'Site', created_at: '2026-07-01' }],
      [{ id: 'draft-1', project_id: 'project-1', updated_at: '2026-07-02' }],
    );

    expect(result.map((project) => project.id)).toEqual(['project-1']);
  });

  it('replaces a historical Untitled placeholder with the live draft name', () => {
    const result = mergeWorkspaceProjects(
      [{ id: 'project-1', name: 'Untitled project', created_at: '2026-10-01' }],
      [{
        id: 'draft-1', project_id: 'project-1', name: 'Untitled Project',
        metadata: { projectName: 'Horizon Estates Site' }, updated_at: '2026-10-11',
      }],
    );

    expect(result[0].name).toBe('Horizon Estates Site');
  });

  it('uses a meaningful project name when every draft title is a placeholder', () => {
    const result = mergeWorkspaceProjects(
      [{ id: 'project-1', name: 'SPARK Site', created_at: '2026-10-01' }],
      [{ id: 'draft-1', project_id: 'project-1', name: 'Untitled project', updated_at: '2026-10-11' }],
    );

    expect(result[0].name).toBe('SPARK Site');
  });

  it('does not substitute a business content label for a missing project title', () => {
    const result = mergeWorkspaceProjects(
      [{ id: 'project-1', name: 'Untitled project', created_at: '2026-10-01' }],
      [{
        id: 'draft-1', project_id: 'project-1', name: 'Untitled project',
        metadata: { projectName: 'Untitled project', sitePlan: { businessName: 'FLIX. By Ariann' } },
        updated_at: '2026-10-11',
      }],
    );

    expect(result[0].name).toBe('Untitled project');
  });

  it('does not let an uncommitted recovery shell outrank canonical activity', () => {
    const result = mergeWorkspaceProjects(
      [{ id: 'project-1', name: 'Live Site', created_at: '2026-10-01', updated_at: '2026-10-05' }],
      [
        { id: 'canonical', project_id: 'project-1', last_revision_id: 'revision-1', created_at: '2026-10-01', updated_at: '2026-10-05' },
        { id: 'recovery-shell', project_id: 'project-1', created_at: '2026-10-12', updated_at: '2026-10-12' },
      ],
      new Map([['revision-1', '2026-10-05']]),
    );

    expect(result[0]).toMatchObject({
      draft_id: 'canonical',
      revision_id: 'revision-1',
      updated_at: '2026-10-05',
    });
  });
});
