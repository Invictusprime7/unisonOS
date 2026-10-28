import { MARKETPLACE_SAMPLE_IMAGES } from './marketplaceImagePlaceholders';

/** Embed project-owned sample images so installed source doesn't depend on the host app. */
export async function materializePreviewImages(
  files: Readonly<Record<string, string>>,
  options: { signal?: AbortSignal } = {},
) {
  const result = { ...files };
  const used = Object.values(MARKETPLACE_SAMPLE_IMAGES).filter(url => Object.values(files).some(source => source.includes(url)));
  await Promise.all(used.map(async url => {
    let response: Response;
    try {
      response = await fetch(url, { signal: options.signal });
    } catch (error) {
      if (options.signal?.aborted) {
        throw options.signal.reason instanceof Error ? options.signal.reason : new Error(String(options.signal.reason ?? 'Template image loading was stopped.'));
      }
      throw error;
    }
    if (!response.ok) throw new Error('A template preview image could not be loaded.');
    const blob = await response.blob();
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error ? options.signal.reason : new Error(String(options.signal.reason ?? 'Template image loading was stopped.'));
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const data = `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
    for (const path of Object.keys(result)) result[path] = result[path].split(url).join(data);
  }));
  return result;
}