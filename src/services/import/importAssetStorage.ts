/**
 * UIMP-01 Phase B — durable, content-addressed storage for imported binary
 * files (images, fonts, media) and the original upload.
 *
 * Bytes are stored unchanged in the owner's private folder. Paths are content
 * addressed per project, so re-imports deduplicate and an upload is never
 * silently replaced with different bytes. Links are issued on demand; only
 * the durable storage path is persisted in the import record.
 */
import { supabase } from '@/integrations/supabase/client';
import type { IntakeResult } from './secureIntake';
import type { ImportedAssetRecord, ImportedAssetsRecord } from './importedSourceRecords';

export const IMPORT_ASSET_BUCKET = 'user-files';

const extOf = (path: string) => {
  const m = /\.([a-z0-9]{1,8})$/i.exec(path);
  return m ? `.${m[1].toLowerCase()}` : '';
};

export function importAssetStoragePath(userId: string, projectId: string, sha256: string, path: string): string {
  return `${userId}/imports/${projectId}/blobs/${sha256}${extOf(path)}`;
}

async function putBytes(storagePath: string, bytes: Uint8Array, mime: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime || 'application/octet-stream' });
  const { error } = await supabase.storage.from(IMPORT_ASSET_BUCKET).upload(storagePath, blob, {
    contentType: mime || 'application/octet-stream',
    upsert: false,
  });
  if (!error) return { ok: true };
  // Content-addressed: an existing object at this path already holds these exact bytes.
  if (/exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) return { ok: true };
  return { ok: false, error: error.message };
}

export async function storeImportedAssets(input: {
  intake: IntakeResult;
  userId: string;
  projectId: string;
  originalArchive?: Uint8Array | null;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportedAssetsRecord> {
  const binaries = input.intake.manifest.files.filter((f) => f.storage === 'binary');
  const results: ImportedAssetRecord[] = new Array(binaries.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < binaries.length) {
      const index = cursor++;
      const file = binaries[index];
      const storagePath = importAssetStoragePath(input.userId, input.projectId, file.sha256, file.path);
      const outcome = await putBytes(storagePath, input.intake.binaryFiles[file.path], file.mime).catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));
      results[index] = {
        path: file.path,
        sha256: file.sha256,
        size: file.size,
        mime: file.mime,
        kind: file.kind,
        bucket: IMPORT_ASSET_BUCKET,
        storagePath: outcome.ok ? storagePath : null,
        status: outcome.ok ? 'stored' : 'failed',
        ...('error' in outcome ? { error: outcome.error } : {}),
      };
      done++;
      input.onProgress?.(done, binaries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(input.concurrency ?? 4, Math.max(1, binaries.length)) }, worker));

  let originalArchive: ImportedAssetsRecord['originalArchive'] = null;
  const archiveSha = input.intake.manifest.archiveSha256;
  if (input.originalArchive && archiveSha) {
    const storagePath = `${input.userId}/imports/${input.projectId}/original/${archiveSha}.zip`;
    const outcome = await putBytes(storagePath, input.originalArchive, 'application/zip').catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));
    originalArchive = {
      bucket: IMPORT_ASSET_BUCKET,
      storagePath: outcome.ok ? storagePath : null,
      sha256: archiveSha,
      status: outcome.ok ? 'stored' : 'failed',
      ...('error' in outcome ? { error: outcome.error } : {}),
    };
  }
  return { version: 1, assets: results, originalArchive };
}
