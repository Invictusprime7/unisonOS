/**
 * AIConversationInput — Modern chat input with file attachment + screenshot support
 */

import React, { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Send,
  Loader2,
  Paperclip,
  ImageIcon,
  FileCode2,
  FileText,
  X,
  ArrowUp,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface DroppedFile {
  id: string;
  name: string;
  type: 'image' | 'text' | 'code' | 'other';
  preview?: string;
  content?: string;
  size: number;
  /** Raw file, kept so it can be uploaded and placed on the site. */
  file?: File;
}

interface Props {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  droppedFiles: DroppedFile[];
  onAddFiles: (files: FileList | File[]) => Promise<void>;
  onRemoveFile: (id: string) => void;
  /** Ref to preview iframe for screenshot capture */
  previewRef?: React.RefObject<{ getIframe?: () => HTMLIFrameElement | null } | null>;
  className?: string;
}

export const AIConversationInput: React.FC<Props> = ({
  input,
  onInputChange,
  onSend,
  isLoading,
  droppedFiles,
  onAddFiles,
  onRemoveFile,
  previewRef,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      await onAddFiles(e.dataTransfer.files);
    }
  }, [onAddFiles]);

  /**
   * Capture the preview iframe as a screenshot and attach it as a file.
   * Uses html2canvas for cross-origin safe rendering, falling back to
   * canvas drawImage for same-origin iframes.
   */
  const capturePreviewScreenshot = useCallback(async () => {
    if (droppedFiles.length >= 5) {
      toast.error('Maximum 5 attachments reached');
      return;
    }

    const iframe = previewRef?.current?.getIframe?.();
    if (!iframe) {
      toast.error('Preview not available');
      return;
    }

    setIsCapturing(true);
    try {
      let dataUrl: string | null = null;

      // Try html2canvas on the iframe's body (same-origin)
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(doc.body, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            scale: 1,
            logging: false,
            width: iframe.clientWidth || doc.documentElement.scrollWidth,
            height: Math.min(iframe.clientHeight || doc.documentElement.scrollHeight, 4096),
            windowWidth: iframe.clientWidth || doc.documentElement.scrollWidth,
            windowHeight: iframe.clientHeight || doc.documentElement.scrollHeight,
          });
          dataUrl = canvas.toDataURL('image/png');
        }
      } catch {
        // Cross-origin or other failure
      }

      if (!dataUrl) {
        toast.error('Could not capture preview — try a manual screenshot');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `preview-screenshot-${timestamp}.png`;

      await onAddFiles([
        new File(
          [await (await fetch(dataUrl)).blob()],
          fileName,
          { type: 'image/png' }
        ),
      ]);

      toast.success('Preview screenshot attached');
    } catch (err) {
      console.error('[Screenshot] Capture failed:', err);
      toast.error('Screenshot capture failed');
    } finally {
      setIsCapturing(false);
    }
  }, [previewRef, droppedFiles.length, onAddFiles]);

  const canSend = (input.trim() || droppedFiles.length > 0) && !isLoading;

  return (
    <div className={cn("builder-composer", className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.ts,.tsx,.js,.jsx,.css,.html,.json,.sql,.py"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files?.length) {
            await onAddFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Attached file chips */}
      {droppedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {droppedFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 border border-border rounded-lg text-[11px] text-foreground/70 max-w-[160px] group"
            >
              {f.type === 'image' ? (
                f.preview ? (
                  <img src={f.preview} alt={f.name} className="w-4 h-4 rounded object-cover flex-shrink-0" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                )
              ) : f.type === 'code' ? (
                <FileCode2 className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{f.name}</span>
              <Button variant="link" size="icon" aria-label={`Remove ${f.name}`}
                onClick={() => onRemoveFile(f.id)}
                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 "
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          'builder-input-frame',
          isDragging && 'ring-2 ring-primary/40 border-primary/40'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/5 border-2 border-dashed border-primary/30 pointer-events-none">
            <div className="flex items-center gap-2 text-primary text-sm">
              <Paperclip className="w-4 h-4" />
              <span>Drop files here</span>
            </div>
          </div>
        )}

        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={droppedFiles.length > 0 ? 'Add instructions for attachments...' : 'What would you like to build?'}
          aria-label="Message AI Builder"
          className="border-0 bg-transparent text-sm resize-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
          disabled={isLoading}
        />

        {/* Send button — inside the text field */}
        <div className="builder-input-send">
          <Button
            size="icon"
            onClick={onSend}
            disabled={!canSend}
            variant="link"
            aria-label="Send message"
            title="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar row — outside the text field */}
      <div className="builder-input-toolbar">
        <div className="flex items-center gap-0.5">
          <Button variant="link" size="icon" onClick={capturePreviewScreenshot} disabled={isLoading || isCapturing || droppedFiles.length >= 5} aria-label="Capture preview screenshot" title="Capture preview screenshot"><Camera /></Button>
          <Button variant="link" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isLoading || droppedFiles.length >= 5} aria-label="Attach files" title="Attach files"><Paperclip /></Button>
        </div>
        <span className="text-[10px] text-muted-foreground/40">
          {droppedFiles.length > 0 && `${droppedFiles.length}/5 files · `}

        </span>
      </div>
    </div>
  );
};
