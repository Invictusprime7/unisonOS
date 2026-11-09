/**
 * Affinity Graphics workspace in Design Studio. Owns the one graphic
 * document, its undo history, imported references and the Affinity
 * conversation. Every change — Affinity's or the owner's — is a new document
 * revision; the canvas and exports only project it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_GRAPHIC_FORMAT_ID, getGraphicFormat, isGraphicFormatId } from '@/services/graphic-design/graphicFormats';
import {
  removeLayer,
  reorderLayer,
  updateLayer,
  updatePage,
  type GraphicDocument,
  type GraphicLayer,
  type GraphicReference,
} from '@/services/graphic-design/graphicDocument';
import { designCheckFixInstruction, runDesignCheck, type DesignCheckFinding } from '@/services/graphic-design/graphicDesignCheck';
import { fillGeneratedImages, requestGraphicDesign } from '@/services/graphic-design/graphicDesignClient';
import { GraphicCanvas } from './GraphicCanvas';
import { GraphicLayerInspector } from './GraphicLayerInspector';
import { AffinityGraphicPanel, type GraphicTurn } from './AffinityGraphicPanel';
import { GraphicExportMenu } from './GraphicExportMenu';

const MAX_HISTORY = 50;

export interface GraphicBrief {
  prompt: string;
  formatId: string;
}

interface AffinityGraphicStudioProps {
  /** Brief handed over from the Home chat; designed once on arrival. */
  initialBrief?: GraphicBrief | null;
}

let turnCounter = 0;
const turn = (role: GraphicTurn['role'], text: string, failed = false): GraphicTurn => ({ id: `turn-${(turnCounter += 1)}`, role, text, failed });

function layerLabel(layer: GraphicLayer | null): string | null {
  if (!layer) return null;
  if (layer.type === 'text') return layer.text.slice(0, 40);
  if (layer.type === 'image') return layer.alt || 'picture';
  return 'shape';
}

export function AffinityGraphicStudio({ initialBrief }: AffinityGraphicStudioProps) {
  const { toast } = useToast();
  const [formatId, setFormatId] = useState(() => (initialBrief && isGraphicFormatId(initialBrief.formatId) ? initialBrief.formatId : DEFAULT_GRAPHIC_FORMAT_ID));
  const [history, setHistory] = useState<{ past: GraphicDocument[]; present: GraphicDocument | null; future: GraphicDocument[] }>({ past: [], present: null, future: [] });
  const [pageId, setPageId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [references, setReferences] = useState<GraphicReference[]>([]);
  const [allowPhotos, setAllowPhotos] = useState(true);
  const [turns, setTurns] = useState<GraphicTurn[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const briefStarted = useRef(false);

  const doc = history.present;
  const page = doc ? doc.pages.find((item) => item.id === pageId) ?? doc.pages[0] : null;
  const pageIndex = doc && page ? doc.pages.indexOf(page) : 0;
  const selectedLayer = page?.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const findings = useMemo(() => (doc ? runDesignCheck(doc) : []), [doc]);
  const format = getGraphicFormat(doc?.formatId ?? formatId);

  const commit = useCallback((next: GraphicDocument) => {
    setHistory((current) => ({
      past: current.present ? [...current.past, current.present].slice(-MAX_HISTORY) : current.past,
      present: next,
      future: [],
    }));
  }, []);

  const notifyError = useCallback((message: string) => toast({ title: 'Something went wrong', description: message, variant: 'destructive' }), [toast]);

  const ask = useCallback(async (prompt: string) => {
    const mode = history.present ? 'edit' : 'create';
    setTurns((current) => [...current, turn('owner', prompt)]);
    setBusy(mode === 'create' ? 'Affinity is designing…' : 'Affinity is making your change…');
    try {
      const result = await requestGraphicDesign({
        mode,
        prompt,
        formatId: history.present?.formatId ?? formatId,
        document: history.present,
        selectedLayerId: mode === 'edit' ? selectedLayerId : null,
        references,
        allowGeneratedPhotos: allowPhotos,
      });
      let next = result.document;
      commit(next);
      setPageId((current) => (next.pages.some((item) => item.id === current) ? current : next.pages[0].id));
      setTurns((current) => [...current, turn('affinity', result.summary)]);

      if (allowPhotos) {
        const photos = await fillGeneratedImages(next, (done, total) => {
          if (total > 0 && done < total) setBusy(`Creating photo ${done + 1} of ${total}…`);
        });
        if (photos.document !== next) {
          next = photos.document;
          // Photos complete the same revision Affinity just designed.
          setHistory((current) => ({ ...current, present: next }));
        }
        if (photos.failed > 0) {
          setTurns((current) => [...current, turn('affinity', `I couldn't create ${photos.failed === 1 ? 'one photo' : `${photos.failed} photos`} (${photos.firstError}). The empty frame is ready for your own picture.`, true)]);
        }
      }
    } catch (error) {
      setTurns((current) => [...current, turn('affinity', error instanceof Error ? error.message : 'Affinity couldn\u2019t finish this design. Nothing was changed.', true)]);
    } finally {
      setBusy(null);
    }
  }, [allowPhotos, commit, formatId, history.present, references, selectedLayerId]);

  useEffect(() => {
    if (!initialBrief?.prompt || briefStarted.current) return;
    briefStarted.current = true;
    void ask(initialBrief.prompt);
  }, [ask, initialBrief]);

  const changeLayer = useCallback((layerId: string, patch: Partial<GraphicLayer>) => {
    if (!doc || !page) return;
    commit(updateLayer(doc, page.id, layerId, patch));
  }, [commit, doc, page]);

  const deleteLayer = useCallback((layerId: string) => {
    if (!doc || !page) return;
    commit(removeLayer(doc, page.id, layerId));
    setSelectedLayerId(null);
  }, [commit, doc, page]);

  const undo = () => setHistory((current) => (current.past.length && current.present ? {
    past: current.past.slice(0, -1),
    present: current.past[current.past.length - 1],
    future: [current.present, ...current.future],
  } : current));
  const redo = () => setHistory((current) => (current.future.length && current.present ? {
    past: [...current.past, current.present],
    present: current.future[0],
    future: current.future.slice(1),
  } : current));

  const startOver = () => {
    setHistory({ past: [], present: null, future: [] });
    setTurns([]);
    setSelectedLayerId(null);
    setPageId(null);
  };

  const selectFinding = (finding: DesignCheckFinding) => {
    setPageId(finding.pageId);
    setSelectedLayerId(finding.layerId ?? null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc?.title ?? 'New design'}</p>
            <p className="text-xs text-muted-foreground">{format.label} · {format.sizeLabel}</p>
          </div>
          {doc && doc.pages.length > 1 && (
            <Tabs value={page?.id} onValueChange={(value) => { setPageId(value); setSelectedLayerId(null); }}>
              <TabsList>
                {doc.pages.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.name}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          )}
          {doc && (
            <>
              <Button type="button" variant="ghost" size="icon" onClick={undo} disabled={!history.past.length || Boolean(busy)} aria-label="Undo"><Undo2 className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" onClick={redo} disabled={!history.future.length || Boolean(busy)} aria-label="Redo"><Redo2 className="h-4 w-4" /></Button>
              {format.print && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowGuides((value) => !value)} aria-pressed={showGuides} aria-label={showGuides ? 'Hide trim and safe-area guides' : 'Show trim and safe-area guides'}>
                  {showGuides ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              )}
              <GraphicExportMenu
                document={doc}
                pageIndex={pageIndex}
                disabled={Boolean(busy)}
                onDone={(message) => toast({ title: 'Done', description: message })}
                onError={notifyError}
              />
            </>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="h-[55dvh] min-h-0 flex-1 md:h-auto">
            {doc && page ? (
              <GraphicCanvas
                document={doc}
                pageId={page.id}
                selectedLayerId={selectedLayerId}
                showGuides={showGuides && format.print}
                onSelect={setSelectedLayerId}
                onLayerChange={changeLayer}
                onLayerDelete={deleteLayer}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted p-8">
                <div className="max-w-sm space-y-2 text-center">
                  <p className="text-base font-medium">Describe your design to Affinity</p>
                  <p className="text-sm text-muted-foreground">
                    Pick what you're making, say what it's for, and add your logo or photos. Affinity designs a finished piece you can then change by asking or by clicking.
                  </p>
                </div>
              </div>
            )}
          </div>
          {doc && page && (
            <aside className="w-full shrink-0 border-t border-border md:w-64 md:border-l md:border-t-0" aria-label="Selected item">
              <GraphicLayerInspector
                page={page}
                layer={selectedLayer}
                palette={doc.palette}
                onChange={(patch) => selectedLayer && changeLayer(selectedLayer.id, patch)}
                onPageChange={(patch) => commit(updatePage(doc, page.id, patch))}
                onDelete={() => selectedLayer && deleteLayer(selectedLayer.id)}
                onReorder={(step) => selectedLayer && commit(reorderLayer(doc, page.id, selectedLayer.id, step))}
                onError={notifyError}
              />
            </aside>
          )}
        </div>
      </div>

      <aside className="flex h-[70dvh] w-full shrink-0 flex-col border-t border-border bg-card text-card-foreground lg:h-auto lg:w-96 lg:border-l lg:border-t-0" aria-label="Affinity">
        <AffinityGraphicPanel
          hasDocument={Boolean(doc)}
          formatId={formatId}
          onFormatChange={setFormatId}
          references={references}
          onReferencesChange={setReferences}
          allowPhotos={allowPhotos}
          onAllowPhotosChange={setAllowPhotos}
          turns={turns}
          busy={busy}
          selectedLayerLabel={layerLabel(selectedLayer)}
          findings={findings}
          onSubmit={(prompt) => void ask(prompt)}
          onFixFindings={() => void ask(designCheckFixInstruction(findings))}
          onSelectFinding={selectFinding}
          onStartOver={startOver}
          onError={notifyError}
        />
      </aside>
    </div>
  );
}
