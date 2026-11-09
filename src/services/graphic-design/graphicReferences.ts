/**
 * Imported references (logo, photos, style inspiration). Pictures are
 * downscaled in the browser before they are sent to Affinity or placed on the
 * canvas so requests stay small and exports never hit a tainted canvas.
 */

import type { GraphicReference, ReferenceRole } from './graphicDocument';

export const MAX_REFERENCES = 4;
export const MAX_REFERENCE_FILE_BYTES = 15 * 1024 * 1024;
const MAX_REFERENCE_EDGE = 1280;

export const REFERENCE_ROLE_LABELS: Record<ReferenceRole, string> = {
  logo: 'Logo',
  photo: 'Photo to use',
  inspiration: 'Style inspiration',
};

export function guessReferenceRole(name: string): ReferenceRole {
  const lower = name.toLowerCase();
  if (/logo|brand|mark|icon/.test(lower)) return 'logo';
  if (/inspo|inspiration|example|reference|moodboard|style/.test(lower)) return 'inspiration';
  return 'photo';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be opened.'));
    image.src = src;
  });
}

/** Downscale any image source to a JPEG (or PNG for logos with transparency) data URL. */
export async function toReferenceDataUrl(src: string, role: ReferenceRole): Promise<string> {
  const image = await loadImage(src);
  const scale = Math.min(1, MAX_REFERENCE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare that image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return role === 'logo' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsDataURL(file);
  });
}

let referenceCounter = 0;
const nextReferenceId = () => `ref-${Date.now().toString(36)}-${(referenceCounter += 1)}`;

export async function referenceFromFile(file: File): Promise<GraphicReference> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error(`${file.name} isn't a PNG, JPG or WebP image.`);
  if (file.size > MAX_REFERENCE_FILE_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const role = guessReferenceRole(file.name);
  return { id: nextReferenceId(), name: file.name, role, dataUrl: await toReferenceDataUrl(await readFile(file), role) };
}

/** Import a picture from the owner's Files (a signed storage URL). */
export async function referenceFromUrl(url: string, name: string): Promise<GraphicReference> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name} could not be downloaded.`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const role = guessReferenceRole(name);
    return { id: nextReferenceId(), name, role, dataUrl: await toReferenceDataUrl(objectUrl, role) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
