import { describe, expect, it, vi } from 'vitest';
import {
  materializeCanonicalProjectMedia,
  PROJECT_MEDIA_MANIFEST_PATH,
} from '../../supabase/functions/_shared/canonicalPublishMedia';

const storagePath = 'owner-1/catalog/item-1-hero.webp';
const signedUrl = `https://project.supabase.co/storage/v1/object/sign/user-files/${storagePath}?token=temporary`;
const manifest = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  version: 1,
  assets: [{
    storagePath,
    bucket: 'user-files',
    name: 'hero.webp',
    kind: 'image',
    mimeType: 'image/webp',
    url: signedUrl,
    usedBy: ['/src/pages/Home.tsx'],
    ...overrides,
  }],
});

describe('canonical publish media materialization', () => {
  it('replaces signed source URLs with self-contained media and removes the private manifest', async () => {
    const files = {
      'index.html': '<!doctype html><html></html>',
      'src/pages/Home.tsx': `<img src="${signedUrl}" alt="Hero" />`,
      'public/media/manifest.json': manifest(),
    };
    const download = vi.fn(async () => new Uint8Array([1, 2, 3]));

    const result = await materializeCanonicalProjectMedia({
      files,
      manifestFiles: { [PROJECT_MEDIA_MANIFEST_PATH]: manifest() },
      userId: 'owner-1',
      storageOrigin: 'https://project.supabase.co',
      download,
    });

    expect(result.mediaCount).toBe(1);
    expect(result.files['src/pages/Home.tsx']).toContain('data:image/webp;base64,AQID');
    expect(result.files).not.toHaveProperty('public/media/manifest.json');
    expect(download).toHaveBeenCalledWith('user-files', storagePath);
  });

  it('rejects storage objects owned by another user before downloading them', async () => {
    const download = vi.fn(async () => new Uint8Array([1]));
    await expect(materializeCanonicalProjectMedia({
      files: { 'src/pages/Home.tsx': `<img src="${signedUrl}" />` },
      manifestFiles: { [PROJECT_MEDIA_MANIFEST_PATH]: manifest() },
      userId: 'other-user',
      storageOrigin: 'https://project.supabase.co',
      download,
    })).rejects.toThrow(/outside the publishing user/i);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects a signed URL whose path does not match the stable storage identity', async () => {
    const download = vi.fn(async () => new Uint8Array([1]));
    await expect(materializeCanonicalProjectMedia({
      files: { 'src/pages/Home.tsx': `<img src="${signedUrl}" />` },
      manifestFiles: { [PROJECT_MEDIA_MANIFEST_PATH]: manifest({ storagePath: 'owner-1/catalog/other.webp' }) },
      userId: 'owner-1',
      storageOrigin: 'https://project.supabase.co',
      download,
    })).rejects.toThrow(/does not match its stable storage identity/i);
    expect(download).not.toHaveBeenCalled();
  });

  it('rejects oversized objects before they can inflate the deploy payload', async () => {
    await expect(materializeCanonicalProjectMedia({
      files: { 'src/pages/Home.tsx': `<img src="${signedUrl}" />` },
      manifestFiles: { [PROJECT_MEDIA_MANIFEST_PATH]: manifest() },
      userId: 'owner-1',
      storageOrigin: 'https://project.supabase.co',
      download: async () => new Uint8Array(500_001),
    })).rejects.toThrow(/exceeds the 500000-byte publish limit/i);
  });

  it('materializes a referenced PDF so document links do not depend on signed URL expiry', async () => {
    const pdfPath = 'owner-1/site-uploads/project-1/brief.pdf';
    const pdfUrl = `https://project.supabase.co/storage/v1/object/sign/user-files/${pdfPath}?token=temporary`;
    const result = await materializeCanonicalProjectMedia({
      files: { 'public/index.html': `<a href="${pdfUrl}">Brief</a>` },
      manifestFiles: {
        [PROJECT_MEDIA_MANIFEST_PATH]: JSON.stringify({
          version: 1,
          assets: [{ storagePath: pdfPath, bucket: 'user-files', name: 'brief.pdf', mimeType: 'application/pdf', url: pdfUrl, usedBy: ['/public/index.html'] }],
        }),
      },
      userId: 'owner-1',
      storageOrigin: 'https://project.supabase.co',
      download: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });

    expect(result.files['public/index.html']).toContain('data:application/pdf;base64,JVB');
  });
});