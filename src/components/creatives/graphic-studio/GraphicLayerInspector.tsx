/**
 * Simple controls for the selected layer: words, font, size, colour,
 * alignment, image replacement and stacking. Every change is a layer patch on
 * the graphic document.
 */

import { useRef } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { GRAPHIC_FONTS, findGraphicFont, snapFontWeight } from '@/services/graphic-design/graphicFonts';
import type { GraphicLayer, GraphicPage } from '@/services/graphic-design/graphicDocument';
import { toReferenceDataUrl } from '@/services/graphic-design/graphicReferences';

const WEIGHT_LABELS: Record<number, string> = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold', 900: 'Black' };

interface GraphicLayerInspectorProps {
  page: GraphicPage;
  layer: GraphicLayer | null;
  palette: string[];
  onChange: (patch: Partial<GraphicLayer>) => void;
  onPageChange: (patch: { background: string }) => void;
  onDelete: () => void;
  onReorder: (step: 1 | -1) => void;
  onError: (message: string) => void;
}

function ColorField({ id, label, value, palette, onChange }: { id: string; label: string; value: string; palette: string[]; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-12 cursor-pointer p-1" />
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={`Use colour ${color}`}
            aria-pressed={color === value}
            className="h-7 w-7 rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-primary"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

export function GraphicLayerInspector({ page, layer, palette, onChange, onPageChange, onDelete, onReorder, onError }: GraphicLayerInspectorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!layer) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">Click something on your design to change it, or double-click text to type.</p>
        <ColorField id="page-background" label={`${page.name} background`} value={page.background} palette={palette} onChange={(background) => onPageChange({ background })} />
      </div>
    );
  }

  const replaceImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      const src = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('That image could not be read.'));
        reader.readAsDataURL(file);
      });
      onChange({ src: await toReferenceDataUrl(src, 'photo'), generate: null, referenceId: null, alt: file.name } as Partial<GraphicLayer>);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'That image could not be used.');
    }
  };

  const font = layer.type === 'text' ? findGraphicFont(layer.fontFamily) : undefined;

  return (
    <div className="space-y-4 p-4">
      {layer.type === 'text' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="layer-text">Text</Label>
            <Textarea id="layer-text" value={layer.text} rows={3} onChange={(event) => onChange({ text: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="layer-font">Font</Label>
              <Select
                value={layer.fontFamily}
                onValueChange={(family) => {
                  const next = findGraphicFont(family)!;
                  onChange({ fontFamily: family, fontWeight: snapFontWeight(next, layer.fontWeight), italic: next.italic && layer.italic });
                }}
              >
                <SelectTrigger id="layer-font"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRAPHIC_FONTS.map((item) => <SelectItem key={item.family} value={item.family}>{item.family}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="layer-size">Size</Label>
              <Input id="layer-size" type="number" min={4} value={Math.round(layer.fontSize)} onChange={(event) => onChange({ fontSize: Math.max(4, Number(event.target.value) || layer.fontSize) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="layer-weight">Weight</Label>
              <Select value={String(layer.fontWeight)} onValueChange={(weight) => onChange({ fontWeight: Number(weight) })}>
                <SelectTrigger id="layer-weight"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(font?.weights ?? [400]).map((weight) => <SelectItem key={weight} value={String(weight)}>{WEIGHT_LABELS[weight] ?? weight}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label id="layer-align-label">Alignment</Label>
            <ToggleGroup type="single" value={layer.align} onValueChange={(align) => align && onChange({ align: align as 'left' | 'center' | 'right' })} aria-labelledby="layer-align-label" className="justify-start">
              <ToggleGroupItem value="left" aria-label="Align left"><AlignLeft className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="center" aria-label="Align centre"><AlignCenter className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="Align right"><AlignRight className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </div>
          <ColorField id="layer-color" label="Colour" value={layer.color} palette={palette} onChange={(color) => onChange({ color })} />
        </>
      )}

      {layer.type === 'shape' && (
        <ColorField id="layer-fill" label="Fill" value={layer.fill} palette={palette} onChange={(fill) => onChange({ fill })} />
      )}

      {layer.type === 'image' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {layer.src ? (layer.alt || 'Picture') : 'Empty picture frame. Add your own picture.'}
          </p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void replaceImage(event.target.files?.[0]); event.target.value = ''; }} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />{layer.src ? 'Replace picture' : 'Add picture'}
          </Button>
          <div className="space-y-2">
            <Label htmlFor="layer-fit">Fit</Label>
            <Select value={layer.fit} onValueChange={(fit) => onChange({ fit: fit as 'cover' | 'contain' })}>
              <SelectTrigger id="layer-fit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Fill the frame</SelectItem>
                <SelectItem value="contain">Show the whole picture</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" size="sm" onClick={() => onReorder(1)}><ArrowUp className="mr-1 h-4 w-4" aria-hidden="true" />Forward</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onReorder(-1)}><ArrowDown className="mr-1 h-4 w-4" aria-hidden="true" />Back</Button>
        <Button type="button" variant="outline" size="sm" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />Delete</Button>
      </div>
    </div>
  );
}
