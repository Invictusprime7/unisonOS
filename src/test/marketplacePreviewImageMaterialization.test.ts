import { describe, expect, it, vi } from 'vitest';
import { MARKETPLACE_SAMPLE_IMAGES } from '@/marketplace/marketplaceImagePlaceholders';
import { materializePreviewImages } from '@/marketplace/materializePreviewImages';
describe('installed preview image persistence', () => {
  it('embeds used sample assets without retaining host-only URLs', async () => {
    const fetchImage = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, blob: async () => ({ type: 'image/jpeg', arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) } as Response);
    try {
      const files = { '/src/images.ts': `export const image = '${MARKETPLACE_SAMPLE_IMAGES.objects}'` };
      const material = await materializePreviewImages(files);
      expect(material['/src/images.ts']).toContain('data:image/jpeg;base64,AQID');
      expect(material['/src/images.ts']).not.toContain(MARKETPLACE_SAMPLE_IMAGES.objects);
      expect(files['/src/images.ts']).toContain(MARKETPLACE_SAMPLE_IMAGES.objects);
      expect(fetchImage).toHaveBeenCalledOnce();
    } finally { fetchImage.mockRestore(); }
  });
});