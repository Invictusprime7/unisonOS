import { describe, expect, it } from 'vitest';
import { PROJECT_MEDIA_MANIFEST, readProjectMedia, recordProjectMedia, refreshProjectMediaUrls, unusedProjectMedia } from '@/services/assets/projectMedia';

const path = 'u1/site-uploads/p1/abc-photo.png';
const upload = { name: 'photo.png', kind: 'image', mimeType: 'image/png', url: `https://x/sign/user-files/${path}?token=t`, bucket: 'user-files', storagePath: path };

describe('project media manifest', () => {
  it('records an upload with the pages that use it', () => {
    const files = { '/src/pages/Home.tsx': `<img src="${upload.url}" />`, '/src/pages/About.tsx': 'none' };
    const m = readProjectMedia({ ...files, [PROJECT_MEDIA_MANIFEST]: recordProjectMedia(files, [upload]) });
    expect(m.assets).toHaveLength(1);
    expect(m.assets[0].usedBy).toEqual(['/src/pages/Home.tsx']);
  });
  it('dedupes by storage path and keeps uploads without a path out', () => {
    const once = recordProjectMedia({}, [upload]);
    const twice = recordProjectMedia({ [PROJECT_MEDIA_MANIFEST]: once }, [upload, { ...upload, storagePath: undefined }]);
    expect(readProjectMedia({ [PROJECT_MEDIA_MANIFEST]: twice }).assets).toHaveLength(1);
    expect(twice).toBe(once);
  });
  it('lists assets no page references', () => {
    const files = { [PROJECT_MEDIA_MANIFEST]: recordProjectMedia({}, [upload]) };
    expect(unusedProjectMedia(files).map((a) => a.storagePath)).toEqual([path]);
  });
});

describe('project media sync from saved source', () => {
  it('finds upload links in pages and drops the random prefix from names', async () => {
    const { syncProjectMedia } = await import('@/services/assets/projectMedia');
    const url = 'https://b.supabase.co/storage/v1/object/sign/user-files/u1/site-uploads/p1/0b0e1c2d-1111-4111-8111-123456789abc-hero.jpg?token=x';
    const out = syncProjectMedia({ '/src/pages/Home.tsx': `<img src="${url}" />` })!;
    const asset = readProjectMedia({ [PROJECT_MEDIA_MANIFEST]: out }).assets[0];
    expect(asset).toMatchObject({ name: 'hero.jpg', kind: 'image', bucket: 'user-files', usedBy: ['/src/pages/Home.tsx'] });
  });
  it('writes nothing for a site with no uploads', async () => {
    const { syncProjectMedia } = await import('@/services/assets/projectMedia');
    expect(syncProjectMedia({ '/src/pages/Home.tsx': '<img src="/a.png" />' })).toBeNull();
  });
});

describe('project media preview URL refresh', () => {
  it('reissues signed URLs from stable storage paths without changing accepted files', async () => {
    const files = {
      '/src/pages/Home.tsx': `<img src="${upload.url}" />`,
      [PROJECT_MEDIA_MANIFEST]: recordProjectMedia({ '/src/pages/Home.tsx': `<img src="${upload.url}" />` }, [upload]),
    };
    const refreshedUrl = 'https://x/storage/v1/object/sign/user-files/u1/site-uploads/p1/abc-photo.png?token=fresh';
    const createSignedUrl = vi.fn(async () => refreshedUrl);

    const previewFiles = await refreshProjectMediaUrls(files, { userId: 'u1', createSignedUrl });

    expect(createSignedUrl).toHaveBeenCalledWith('user-files', path);
    expect(previewFiles['/src/pages/Home.tsx']).toContain(refreshedUrl);
    expect(readProjectMedia(previewFiles).assets[0].url).toBe(refreshedUrl);
    expect(files['/src/pages/Home.tsx']).toContain(upload.url);
  });

  it('does not sign paths owned by another user', async () => {
    const files = {
      '/src/pages/Home.tsx': `<img src="${upload.url}" />`,
      [PROJECT_MEDIA_MANIFEST]: recordProjectMedia({ '/src/pages/Home.tsx': `<img src="${upload.url}" />` }, [upload]),
    };
    const createSignedUrl = vi.fn(async () => 'https://x/fresh');

    await expect(refreshProjectMediaUrls(files, { userId: 'other-user', createSignedUrl }))
      .rejects.toThrow(/outside the signed-in user storage scope/i);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
