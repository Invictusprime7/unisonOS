/**
 * Turns a drag-and-drop payload (ZIP, loose files or whole folders) into the
 * one import input `importExternalProject` accepts. Folder structure is kept
 * as relative paths so the secure intake sees the project exactly as it is on
 * disk. Dependency and version-control folders are not read (the intake
 * would exclude them anyway, and they can hold hundreds of thousands of files).
 */
import type { ExternalImportInput } from './externalProjectImport';

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.svn', '.hg']);

interface FsEntry { isFile: boolean; isDirectory: boolean; name: string; fullPath: string }
interface FsFileEntry extends FsEntry { file: (ok: (file: File) => void, fail: (err: unknown) => void) => void }
interface FsDirEntry extends FsEntry { createReader: () => { readEntries: (ok: (entries: FsEntry[]) => void, fail: (err: unknown) => void) => void } }

export interface DroppedImportCollection {
  input: ExternalImportInput | null;
  skippedDirectories: string[];
}

/** True when a drag carries files (not text or links). */
export function dragHasFiles(dt: DataTransfer | null | undefined): boolean {
  return Boolean(dt && Array.from(dt.types ?? []).includes('Files'));
}

async function readDirectory(dir: FsDirEntry): Promise<FsEntry[]> {
  const reader = dir.createReader();
  const all: FsEntry[] = [];
  for (;;) {
    const batch = await new Promise<FsEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

/** Must be called synchronously inside the drop handler; entries are captured first. */
export function collectDroppedImportInput(dt: DataTransfer): Promise<DroppedImportCollection> {
  const items = Array.from(dt.items ?? []);
  const entries = items
    .map((item) => (item.kind === 'file' && typeof (item as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry === 'function'
      ? (item as DataTransferItem & { webkitGetAsEntry: () => FsEntry | null }).webkitGetAsEntry()
      : null))
    .filter((entry): entry is FsEntry => Boolean(entry));
  const plainFiles = Array.from(dt.files ?? []);

  return (async () => {
    const skippedDirectories: string[] = [];
    if (entries.length === 0 || entries.every((e) => e.isFile)) {
      if (plainFiles.length === 0) return { input: null, skippedDirectories };
      if (plainFiles.length === 1 && plainFiles[0].name.toLowerCase().endsWith('.zip')) return { input: { kind: 'zip', file: plainFiles[0] }, skippedDirectories };
      return { input: { kind: 'files', files: plainFiles }, skippedDirectories };
    }
    const files: File[] = [];
    const relativePaths: string[] = [];
    const walk = async (entry: FsEntry): Promise<void> => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FsFileEntry).file(resolve, reject));
        files.push(file);
        relativePaths.push(entry.fullPath.replace(/^\/+/, ''));
        return;
      }
      if (!entry.isDirectory) return;
      if (SKIPPED_DIRS.has(entry.name)) { skippedDirectories.push(entry.fullPath.replace(/^\/+/, '')); return; }
      for (const child of await readDirectory(entry as FsDirEntry)) await walk(child);
    };
    for (const entry of entries) await walk(entry);
    if (files.length === 0) return { input: null, skippedDirectories };
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) return { input: { kind: 'zip', file: files[0] }, skippedDirectories };
    return { input: { kind: 'files', files, relativePaths }, skippedDirectories };
  })();
}
