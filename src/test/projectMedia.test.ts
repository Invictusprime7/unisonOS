import { describe, expect, it } from 'vitest';
import { PROJECT_MEDIA_MANIFEST, readProjectMedia, recordProjectMedia, unusedProjectMedia } from '@/services/assets/projectMedia';

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
