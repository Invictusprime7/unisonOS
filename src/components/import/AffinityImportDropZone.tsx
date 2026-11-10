import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FolderArchive, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImportIntakeError } from '@/services/import/secureIntake';
import { importExternalProject } from '@/services/import/externalProjectImport';
import { collectDroppedImportInput, dragHasFiles } from '@/services/import/droppedImportInput';
import { IMPORT_STAGE_LABEL, importedToastDescription, prepareImportedProjectHandoff } from '@/services/import/importHandoff';

/**
 * Lets a visitor drop a ZIP, a project folder or loose files anywhere on the
 * Affinity chat. The drop runs the same zero-drift import as the Import
 * button: the project is saved exactly as it is, then opens in the builder
 * where Affinity can make scoped edits.
 */
export function AffinityImportDropZone({ children, signedIn, onAuthRequired, businessId, disabled, className }: {
  children: ReactNode;
  signedIn: boolean;
  onAuthRequired: () => void;
  businessId?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const depthRef = useRef(0);
  const busy = stage !== null;

  const accepts = (event: DragEvent) => !disabled && dragHasFiles(event.dataTransfer);

  const onDragEnter = (event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault();
    depthRef.current += 1;
    setDragging(true);
  };
  const onDragOver = (event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
  };
  const onDragLeave = (event: DragEvent) => {
    if (!accepts(event)) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragging(false);
  };
  const onDrop = (event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.stopPropagation();
    depthRef.current = 0;
    setDragging(false);
    if (busy) return;
    if (!signedIn) { onAuthRequired(); return; }
    const collecting = collectDroppedImportInput(event.dataTransfer);
    void (async () => {
      setStage(IMPORT_STAGE_LABEL.reading);
      try {
        const { input } = await collecting;
        if (!input) { toast.error('Nothing to import', { description: 'Drop a .zip, a project folder or its files.' }); return; }
        const result = await importExternalProject(input, {
          businessId,
          onStage: (next, detail) => setStage(detail ? `${IMPORT_STAGE_LABEL[next].replace(/…$/, '')} (${detail})…` : IMPORT_STAGE_LABEL[next]),
        });
        const routeState = prepareImportedProjectHandoff(result);
        toast.success(`Imported ${result.fileCount} files unchanged`, { description: importedToastDescription(result) });
        navigate('/web-builder', { replace: true, state: routeState });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(err instanceof ImportIntakeError ? 'Import stopped' : 'Import failed', { description: message });
      } finally {
        setStage(null);
      }
    })();
  };

  return (
    <div
      className={cn('relative', className)}
      data-testid="affinity-import-drop-zone"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
      {(dragging || busy) && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/90"
          role="status"
          aria-live="polite"
        >
          <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
            {busy
              ? <Loader2 className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
              : <FolderArchive className="h-6 w-6 text-primary" aria-hidden />}
            <p className="text-sm font-medium text-foreground">{busy ? stage : 'Drop to import your project'}</p>
            <p className="text-xs text-muted-foreground">
              {busy ? 'Your files are saved exactly as they are.' : 'A .zip, a folder or its files. Kept exactly as it is, then open it to edit with Affinity.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
