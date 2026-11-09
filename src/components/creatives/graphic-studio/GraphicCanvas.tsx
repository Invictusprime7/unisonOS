/**
 * Editable canvas for one page of a graphic document. The document is the
 * source of truth: the canvas is rebuilt from it, and moves, resizes and
 * text edits are read back into layer changes.
 */

import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, type FabricObject, type Textbox } from 'fabric';
import { Loader2 } from 'lucide-react';
import { canvasSize, getGraphicFormat } from '@/services/graphic-design/graphicFormats';
import type { GraphicDocument, GraphicLayer } from '@/services/graphic-design/graphicDocument';
import {
  buildGuideObjects,
  buildPageObjects,
  objectData,
  preloadDocumentAssets,
  readLayerFromObject,
} from '@/services/graphic-design/graphicRenderer';

interface GraphicCanvasProps {
  document: GraphicDocument;
  pageId: string;
  selectedLayerId: string | null;
  showGuides: boolean;
  onSelect: (layerId: string | null) => void;
  onLayerChange: (layerId: string, patch: Partial<GraphicLayer>) => void;
  onLayerDelete: (layerId: string) => void;
}

/** Theme colour as a Fabric-readable `hsl()` string. */
function tokenColor(name: string): string {
  const value = getComputedStyle(window.document.documentElement).getPropertyValue(name).trim();
  const parts = value.split(/[\s,/]+/).filter(Boolean);
  return parts.length >= 3 ? `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})` : 'gray';
}

export function GraphicCanvas({ document: doc, pageId, selectedLayerId, showGuides, onSelect, onLayerChange, onLayerDelete }: GraphicCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const callbacks = useRef({ onSelect, onLayerChange, onLayerDelete, doc, pageId });
  callbacks.current = { onSelect, onLayerChange, onLayerDelete, doc, pageId };
  const [zoom, setZoom] = useState(0);
  const [loading, setLoading] = useState(true);
  const renderToken = useRef(0);

  const format = getGraphicFormat(doc.formatId);
  const size = canvasSize(format);

  // Create the Fabric canvas once.
  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new FabricCanvas(canvasElRef.current, { preserveObjectStacking: true, selection: false });
    fabricRef.current = canvas;

    const layerFor = (object: FabricObject | undefined) => {
      const id = object ? objectData(object).layerId : undefined;
      const { doc: current, pageId: currentPage } = callbacks.current;
      const layer = current.pages.find((page) => page.id === currentPage)?.layers.find((item) => item.id === id);
      return layer ? { id: id!, layer } : null;
    };
    const select = () => callbacks.current.onSelect(layerFor(canvas.getActiveObject())?.id ?? null);
    canvas.on('selection:created', select);
    canvas.on('selection:updated', select);
    canvas.on('selection:cleared', () => callbacks.current.onSelect(null));
    canvas.on('object:modified', ({ target }) => {
      const found = layerFor(target);
      if (found) callbacks.current.onLayerChange(found.id, readLayerFromObject(target, found.layer));
    });
    canvas.on('text:editing:exited', ({ target }) => {
      const found = layerFor(target as unknown as FabricObject);
      if (found && found.layer.type === 'text') callbacks.current.onLayerChange(found.id, readLayerFromObject(target as unknown as Textbox, found.layer));
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const active = canvas.getActiveObject() as (FabricObject & { isEditing?: boolean }) | undefined;
      if (!active || active.isEditing) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (event.target as HTMLElement | null)?.isContentEditable) return;
      const found = layerFor(active);
      if (found) {
        event.preventDefault();
        callbacks.current.onLayerDelete(found.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Fit the page to the available space.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const padding = 32;
      const next = Math.min((host.clientWidth - padding) / size.width, (host.clientHeight - padding) / size.height);
      setZoom(Number.isFinite(next) && next > 0 ? next : 0.1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [size.width, size.height]);

  // Rebuild the page whenever the document changes.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || zoom <= 0) return;
    const active = canvas.getActiveObject() as (FabricObject & { isEditing?: boolean }) | undefined;
    if (active?.isEditing) return;
    const token = (renderToken.current += 1);
    const page = doc.pages.find((item) => item.id === pageId) ?? doc.pages[0];
    setLoading(true);
    void preloadDocumentAssets(doc).then(() => {
      if (token !== renderToken.current || fabricRef.current !== canvas) return;
      canvas.discardActiveObject();
      canvas.clear();
      canvas.setDimensions({ width: Math.round(size.width * zoom), height: Math.round(size.height * zoom) });
      canvas.setZoom(zoom);
      canvas.backgroundColor = page.background;
      const objects = buildPageObjects(page);
      objects.forEach((object) => canvas.add(object));
      if (showGuides) buildGuideObjects(format, zoom, { trim: tokenColor('--destructive'), safe: tokenColor('--primary') }).forEach((guide) => canvas.add(guide));
      const reselect = objects.find((object) => objectData(object).layerId === selectedLayerId);
      if (reselect) canvas.setActiveObject(reselect);
      canvas.requestRenderAll();
      setLoading(false);
    });
    // selectedLayerId is applied on rebuild only; selection changes do not redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageId, zoom, showGuides, format, size.width, size.height]);

  // Follow selections made outside the canvas (inspector, design check).
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const current = canvas.getActiveObject();
    if ((current ? objectData(current).layerId : null) === selectedLayerId) return;
    const target = canvas.getObjects().find((object) => objectData(object).layerId === selectedLayerId);
    if (target) canvas.setActiveObject(target);
    else canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [selectedLayerId]);

  return (
    <div ref={hostRef} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
      <div className="shadow-lg">
        <canvas ref={canvasElRef} aria-label={`${doc.title} — ${doc.pages.find((page) => page.id === pageId)?.name ?? ''}`} />
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
          <span className="sr-only">Drawing your design…</span>
        </div>
      )}
    </div>
  );
}
