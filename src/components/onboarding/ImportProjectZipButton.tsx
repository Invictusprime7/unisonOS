/**
 * ImportProjectZipButton — imports an external project (ZIP archive, picked
 * folder, or individual source/asset files) through the UIMP-01 pipeline:
 * secure intake → compatibility profile → canonical accepted revision.
 *
 * The source is preserved byte-for-byte. Nothing is redesigned, re-themed or
 * replaced with Unison components; the Builder opens the saved revision and
 * reports honestly whether it can be previewed here.
 */

import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload, Loader2, FolderArchive, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImportIntakeError } from '@/services/import/secureIntake';
import { importExternalProject, type ExternalImportInput, type ExternalImportStage } from '@/services/import/externalProjectImport';
import { collectDroppedImportInput } from '@/services/import/droppedImportInput';
import { IMPORT_STAGE_LABEL, importedToastDescription, prepareImportedProjectHandoff } from '@/services/import/importHandoff';

interface ImportProjectZipButtonProps {
  /** Visual variant — pill (chip) or block (large dropzone card). */
  variant?: 'pill' | 'block';
  /** Business that should own the imported project, when already chosen. */
  businessId?: string | null;
  /** Called after import succeeds and navigation is queued. */
  onImported?: () => void;
  className?: string;
}


export const ImportProjectZipButton = ({
  variant = 'pill',
  businessId,
  onImported,
  className,
}: ImportProjectZipButtonProps) => {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const isImporting = stage !== null;

  const runImport = useCallback(
    async (input: ExternalImportInput) => {
      setStage(IMPORT_STAGE_LABEL.reading);
      try {
        const result = await importExternalProject(input, {
          businessId,
          onStage: (next, detail) => setStage(detail ? `${IMPORT_STAGE_LABEL[next].replace(/…$/, '')} (${detail})…` : IMPORT_STAGE_LABEL[next]),
        });
        const routeState = prepareImportedProjectHandoff(result);
        toast.success(`Imported ${result.fileCount} files unchanged`, { description: importedToastDescription(result) });
        onImported?.();
        navigate('/web-builder', { replace: true, state: routeState });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(err instanceof ImportIntakeError ? 'Import stopped' : 'Import failed', { description: msg });
      } finally {
        setStage(null);
      }
    },
    [businessId, navigate, onImported],
  );

  const handleFiles = useCallback(
    async (list: FileList | null | undefined) => {
      const files = Array.from(list ?? []);
      if (files.length === 0) return;
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        await runImport({ kind: 'zip', file: files[0] });
        return;
      }
      await runImport({ kind: 'files', files });
    },
    [runImport],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const { input } = await collectDroppedImportInput(e.dataTransfer);
      if (input) await runImport(input);
    },
    [runImport],
  );

  const inputs = (
    <>
      <input
        ref={zipInputRef}
        type="file"
        multiple
        className="hidden"
        aria-label="Choose a .zip or project files"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        aria-label="Choose a project folder"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );

  if (variant === 'block') {
    return (
      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed transition-all cursor-pointer',
          'border-white/10 bg-white/[0.02] hover:border-cyan-500/40 hover:bg-cyan-500/[0.03]',
          isDragging && 'border-cyan-400 bg-cyan-500/[0.06] scale-[1.01]',
          isImporting && 'pointer-events-none opacity-70',
          className,
        )}
        onClick={() => zipInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
            {isImporting ? (
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            ) : (
              <FolderArchive className="w-5 h-5 text-cyan-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white/90">
              {stage ?? 'Import a project'}
            </div>
            <p className="text-[11px] text-white/40 mt-0.5">
              Drop a .zip, a folder or source files. Your code, styles, images and fonts are kept exactly as they are.
            </p>
          </div>
        </div>
        {inputs}
      </div>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => zipInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        disabled={isImporting}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
          'border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/[0.06]',
          isDragging && 'border-cyan-400 text-cyan-300 bg-cyan-500/10',
          isImporting && 'opacity-60 cursor-wait',
        )}
      >
        {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        <span>{stage ?? 'Import .zip or files'}</span>
      </button>
      {!isImporting && (
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            'border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/[0.06]',
          )}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Import folder</span>
        </button>
      )}
      {inputs}
    </span>
  );
};
