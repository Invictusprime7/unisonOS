/**
 * Download (PNG, JPG, print PDF) or save the design into Files.
 */

import { useState } from 'react';
import { Download, FolderInput, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getGraphicFormat } from '@/services/graphic-design/graphicFormats';
import type { GraphicDocument } from '@/services/graphic-design/graphicDocument';
import { exportPageImage, exportPdf, type GraphicExport } from '@/services/graphic-design/graphicRenderer';
import { downloadBlob, saveExportToFiles } from '@/services/graphic-design/graphicFiles';

type ExportKind = 'png' | 'jpeg' | 'pdf';

interface GraphicExportMenuProps {
  document: GraphicDocument;
  pageIndex: number;
  disabled?: boolean;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

export function GraphicExportMenu({ document: doc, pageIndex, disabled, onDone, onError }: GraphicExportMenuProps) {
  const [working, setWorking] = useState<string | null>(null);
  const format = getGraphicFormat(doc.formatId);
  const pageName = doc.pages[pageIndex]?.name ?? '';
  const multiPage = doc.pages.length > 1;
  const emptyFrames = doc.pages.reduce((count, page) => count + page.layers.filter((layer) => layer.type === 'image' && !layer.src).length, 0);

  const make = (kind: ExportKind): Promise<GraphicExport> => (kind === 'pdf' ? exportPdf(doc) : exportPageImage(doc, pageIndex, kind));

  const run = async (kind: ExportKind, destination: 'download' | 'files') => {
    setWorking(destination === 'files' ? 'Saving to Files…' : 'Preparing your file…');
    try {
      const file = await make(kind);
      if (destination === 'download') {
        downloadBlob(file.blob, file.filename);
        onDone(format.print ? `Downloaded ${file.filename} at ${file.dpi} DPI.` : `Downloaded ${file.filename}.`);
      } else {
        const saved = await saveExportToFiles(file);
        onDone(`Saved ${saved.name} to Files › designs.`);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The file couldn\u2019t be created.');
    } finally {
      setWorking(null);
    }
  };

  const imageLabel = (name: string) => (multiPage ? `${name} (${pageName})` : name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" disabled={disabled || Boolean(working)}>
          {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
          {working ?? 'Download'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {emptyFrames > 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {emptyFrames === 1 ? 'One empty picture frame' : `${emptyFrames} empty picture frames`} will be left blank. Click a frame to add a picture.
          </p>
        )}
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void run('pdf', 'download')}>{format.print ? 'PDF for print (with bleed)' : 'PDF'}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('png', 'download')}>{imageLabel('PNG image')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('jpeg', 'download')}>{imageLabel('JPG image')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2"><FolderInput className="h-4 w-4" aria-hidden="true" />Save to Files</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void run('pdf', 'files')}>PDF</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run('png', 'files')}>{imageLabel('PNG image')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
