/**
 * Shown in the Home Affinity chat when the owner asks for a flyer, poster,
 * banner, business card or letterhead. Hands the brief to Design Studio,
 * where Affinity designs it immediately.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GRAPHIC_FORMATS, getGraphicFormat } from '@/services/graphic-design/graphicFormats';
import type { GraphicRequest } from '@/services/graphic-design/graphicIntent';

interface GraphicHandoffCardProps {
  request: GraphicRequest;
  onDismiss: () => void;
}

export function GraphicHandoffCard({ request, onDismiss }: GraphicHandoffCardProps) {
  const navigate = useNavigate();
  const [formatId, setFormatId] = useState(request.format.id);
  const format = getGraphicFormat(formatId);
  const choices = GRAPHIC_FORMATS.filter((item) => item.category === request.category);

  return (
    <section className="mt-3 space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground" aria-labelledby="graphic-handoff-title" data-testid="graphic-handoff">
      <div className="space-y-1">
        <h2 id="graphic-handoff-title" className="flex items-center gap-2 text-base font-semibold">
          <Palette className="h-4 w-4 text-primary" aria-hidden="true" />Ready to design your {format.label.toLowerCase()}
        </h2>
        <p className="text-xs text-muted-foreground">
          Affinity designs it in Design Studio. Add your logo or photos there, change anything by asking, then download it {format.print ? 'print-ready' : ''}.
        </p>
      </div>
      {choices.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="graphic-handoff-format">Size</Label>
          <Select value={formatId} onValueChange={setFormatId}>
            <SelectTrigger id="graphic-handoff-format"><SelectValue /></SelectTrigger>
            <SelectContent>
              {choices.map((item) => <SelectItem key={item.id} value={item.id}>{item.label} · {item.sizeLabel}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDismiss}>Not now</Button>
        <Button type="button" onClick={() => navigate('/design-studio', { state: { graphicBrief: { prompt: request.prompt, formatId } } })}>
          <Palette className="mr-2 h-4 w-4" aria-hidden="true" />Design it in Design Studio
        </Button>
      </div>
    </section>
  );
}
