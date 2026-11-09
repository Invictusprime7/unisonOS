/**
 * Affinity's chat panel inside Design Studio: describe a graphic, import
 * references, ask for changes and run the beginner design check.
 */

import { lazy, Suspense, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, ImagePlus, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  GRAPHIC_CATEGORY_LABELS,
  GRAPHIC_FORMATS,
  type GraphicCategory,
} from '@/services/graphic-design/graphicFormats';
import type { GraphicReference, ReferenceRole } from '@/services/graphic-design/graphicDocument';
import type { DesignCheckFinding } from '@/services/graphic-design/graphicDesignCheck';
import {
  MAX_REFERENCES,
  REFERENCE_ROLE_LABELS,
  referenceFromFile,
  referenceFromUrl,
} from '@/services/graphic-design/graphicReferences';

const FileBrowser = lazy(() => import('@/components/creatives/design-studio/FileBrowser').then((m) => ({ default: m.FileBrowser })));

export interface GraphicTurn {
  id: string;
  role: 'owner' | 'affinity';
  text: string;
  failed?: boolean;
}

const EDIT_SUGGESTIONS = [
  'Make the headline bigger and bolder',
  'Use fewer colours',
  'Give it more white space',
  'Try a different layout',
];

const CREATE_EXAMPLES: Record<GraphicCategory, string> = {
  flyer: 'A flyer for our spring sale at Bloom Florist: 20% off all bouquets, 1–15 April.',
  poster: 'A poster for a jazz night at The Blue Room, Friday 8pm, free entry.',
  banner: 'A roll-up banner for our bakery stand at the farmers market.',
  'business-card': 'Business cards for Maya Chen, Lead Architect at Northline Studio.',
  letterhead: 'A clean letterhead for Harbor Legal with our logo at the top.',
};

interface AffinityGraphicPanelProps {
  hasDocument: boolean;
  formatId: string;
  onFormatChange: (formatId: string) => void;
  references: GraphicReference[];
  onReferencesChange: (references: GraphicReference[]) => void;
  allowPhotos: boolean;
  onAllowPhotosChange: (allow: boolean) => void;
  turns: GraphicTurn[];
  busy: string | null;
  selectedLayerLabel: string | null;
  findings: DesignCheckFinding[];
  onSubmit: (prompt: string) => void;
  onFixFindings: () => void;
  onSelectFinding: (finding: DesignCheckFinding) => void;
  onStartOver: () => void;
  onError: (message: string) => void;
}

export function AffinityGraphicPanel({
  hasDocument,
  formatId,
  onFormatChange,
  references,
  onReferencesChange,
  allowPhotos,
  onAllowPhotosChange,
  turns,
  busy,
  selectedLayerLabel,
  findings,
  onSubmit,
  onFixFindings,
  onSelectFinding,
  onStartOver,
  onError,
}: AffinityGraphicPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [importing, setImporting] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const format = GRAPHIC_FORMATS.find((item) => item.id === formatId) ?? GRAPHIC_FORMATS[0];
  const room = MAX_REFERENCES - references.length;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    onSubmit(text);
    setPrompt('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) submit(event);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    const added: GraphicReference[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      try {
        added.push(await referenceFromFile(file));
      } catch (error) {
        onError(error instanceof Error ? error.message : `${file.name} couldn't be imported.`);
      }
    }
    if (files.length > room) onError(`You can add up to ${MAX_REFERENCES} references.`);
    onReferencesChange([...references, ...added]);
    setImporting(false);
  };

  const addFromFiles = async (url: string) => {
    setFilesOpen(false);
    if (room <= 0) { onError(`You can add up to ${MAX_REFERENCES} references.`); return; }
    setImporting(true);
    try {
      const name = decodeURIComponent(url.split('?')[0].split('/').pop() || 'From Files');
      onReferencesChange([...references, await referenceFromUrl(url, name)]);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'That file couldn\u2019t be imported.');
    } finally {
      setImporting(false);
    }
  };

  const setRole = (id: string, role: ReferenceRole) => onReferencesChange(references.map((ref) => (ref.id === id ? { ...ref, role } : ref)));
  const categories = Object.keys(GRAPHIC_CATEGORY_LABELS) as GraphicCategory[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Affinity</h2>
        </div>
        {hasDocument && (
          <Button type="button" variant="ghost" size="sm" onClick={onStartOver} disabled={Boolean(busy)}>
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />New design
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {!hasDocument && (
            <div className="space-y-2">
              <Label htmlFor="graphic-format">What are you making?</Label>
              <Select value={formatId} onValueChange={onFormatChange}>
                <SelectTrigger id="graphic-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{GRAPHIC_CATEGORY_LABELS[category]}</SelectLabel>
                      {GRAPHIC_FORMATS.filter((item) => item.category === category).map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.label} · {item.sizeLabel}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {format.print ? `Print-ready with bleed${format.defaultPages === 2 ? ', front and back' : ''}.` : 'Sized for screens.'}
              </p>
            </div>
          )}

          {turns.length > 0 && (
            <ol className="space-y-2" aria-label="Conversation with Affinity">
              {turns.map((turn) => (
                <li
                  key={turn.id}
                  className={cn(
                    'rounded-md p-3 text-sm',
                    turn.role === 'owner' ? 'ml-6 bg-primary text-primary-foreground' : 'mr-6 bg-muted text-foreground',
                    turn.failed && 'border border-destructive bg-background text-destructive',
                  )}
                >
                  <span className="sr-only">{turn.role === 'owner' ? 'You: ' : 'Affinity: '}</span>
                  {turn.text}
                </li>
              ))}
            </ol>
          )}

          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{busy}
            </p>
          )}

          {hasDocument && (
            <section aria-labelledby="design-check-title" className="space-y-2 rounded-md border border-border p-3">
              <h3 id="design-check-title" className="text-sm font-medium">Design check</h3>
              {findings.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />Looks good: clear headline, few colours, room to breathe.
                </p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {findings.slice(0, 6).map((finding, index) => (
                      <li key={`${finding.rule}-${finding.layerId ?? finding.pageId}-${index}`}>
                        <button
                          type="button"
                          onClick={() => onSelectFinding(finding)}
                          className="flex w-full items-start gap-2 rounded-sm p-1 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', finding.severity === 'problem' ? 'text-destructive' : 'text-muted-foreground')} aria-hidden="true" />
                          <span>{finding.message}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {findings.length > 6 && <p className="text-xs text-muted-foreground">And {findings.length - 6} more.</p>}
                  <Button type="button" size="sm" variant="secondary" onClick={onFixFindings} disabled={Boolean(busy)}>
                    <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />Fix with Affinity
                  </Button>
                </>
              )}
            </section>
          )}

          <section aria-labelledby="references-title" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="references-title" className="text-sm font-medium">References</h3>
              <span className="text-xs text-muted-foreground">{references.length}/{MAX_REFERENCES}</span>
            </div>
            <p className="text-xs text-muted-foreground">Add your logo, photos to use, or a design you like for inspiration.</p>
            {references.length > 0 && (
              <ul className="space-y-2">
                {references.map((ref) => (
                  <li key={ref.id} className="flex items-center gap-2">
                    <img src={ref.dataUrl} alt="" className="h-10 w-10 shrink-0 rounded-sm border border-border object-cover" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-xs" title={ref.name}>{ref.name}</p>
                      <Select value={ref.role} onValueChange={(role) => setRole(ref.id, role as ReferenceRole)}>
                        <SelectTrigger className="h-8 text-xs" aria-label={`How Affinity should use ${ref.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(REFERENCE_ROLE_LABELS) as ReferenceRole[]).map((role) => (
                            <SelectItem key={role} value={role}>{REFERENCE_ROLE_LABELS[role]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${ref.name}`} onClick={() => onReferencesChange(references.filter((item) => item.id !== ref.id))}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => { void addFiles(event.target.files); event.target.value = ''; }} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={room <= 0 || importing}>
                {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImagePlus className="mr-1 h-4 w-4" aria-hidden="true" />}Upload
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setFilesOpen(true)} disabled={room <= 0 || importing}>
                <FolderOpen className="mr-1 h-4 w-4" aria-hidden="true" />From my Files
              </Button>
            </div>
          </section>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="graphic-photos" className="text-sm font-normal">Let Affinity create photos</Label>
            <Switch id="graphic-photos" checked={allowPhotos} onCheckedChange={onAllowPhotosChange} />
          </div>
        </div>
      </ScrollArea>

      <form onSubmit={submit} className="space-y-2 border-t border-border p-4">
        {hasDocument && (
          <div className="flex flex-wrap gap-1">
            {EDIT_SUGGESTIONS.map((suggestion) => (
              <Button key={suggestion} type="button" variant="outline" size="sm" className="h-auto py-1 text-xs" disabled={Boolean(busy)} onClick={() => onSubmit(suggestion)}>
                {suggestion}
              </Button>
            ))}
          </div>
        )}
        <Label htmlFor="graphic-prompt" className="sr-only">{hasDocument ? 'Ask Affinity to change something' : 'Describe your design'}</Label>
        <Textarea
          id="graphic-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={hasDocument
            ? selectedLayerLabel ? `Ask Affinity to change "${selectedLayerLabel}"…` : 'Ask Affinity to change something…'
            : CREATE_EXAMPLES[format.category]}
        />
        <Button type="submit" className="w-full" disabled={!prompt.trim() || Boolean(busy)}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />}
          {hasDocument ? 'Ask Affinity' : 'Design it'}
        </Button>
      </form>

      <Suspense fallback={null}>
        {filesOpen && <FileBrowser open={filesOpen} onOpenChange={setFilesOpen} onImageSelect={(url) => { void addFromFiles(url); }} />}
      </Suspense>
    </div>
  );
}
