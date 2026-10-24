import { MARKETPLACE_SAMPLE_IMAGES } from './marketplaceImagePlaceholders';

/** Embed project-owned sample images so installed source doesn't depend on the host app. */
export async function materializePreviewImages(files: Readonly<Record<string, string>>) {
  const result = { ...files };
  const used = Object.values(MARKETPLACE_SAMPLE_IMAGES).filter(url => Object.values(files).some(source => source.includes(url)));
  await Promise.all(used.map(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('A template preview image could not be loaded.');
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const data = `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
    for (const path of Object.keys(result)) result[path] = result[path].split(url).join(data);
  }));
  return result;
}