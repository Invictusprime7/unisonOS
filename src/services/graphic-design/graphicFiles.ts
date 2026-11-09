/**
 * Save an exported graphic into the owner's Files ("designs" folder), using
 * the same storage bucket and file records as the Files page.
 */

import { supabase } from '@/integrations/supabase/client';
import type { GraphicExport } from './graphicRenderer';

export const DESIGNS_FOLDER = '/designs';

export async function saveExportToFiles(file: GraphicExport): Promise<{ name: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to save designs to your Files.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = file.filename.replace(/(\.[a-z]+)$/i, `-${stamp}$1`);
  const storagePath = `${user.id}/designs/${name}`;
  const { error: uploadError } = await supabase.storage
    .from('user-files')
    .upload(storagePath, file.blob, { contentType: file.blob.type || undefined });
  if (uploadError) throw new Error(`Couldn't upload the file: ${uploadError.message}`);
  const { error: recordError } = await supabase.from('files').insert({
    user_id: user.id,
    name,
    size: file.blob.size,
    mime_type: file.blob.type,
    storage_path: storagePath,
    folder_path: DESIGNS_FOLDER,
  });
  if (recordError) {
    await supabase.storage.from('user-files').remove([storagePath]);
    throw new Error(`Couldn't add the file to Files: ${recordError.message}`);
  }
  return { name };
}

/** Download a file the browser generated. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
