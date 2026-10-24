import { useState, type ReactNode } from 'react';
import { ChevronDown, Monitor, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import '@/marketplace/marketplaceActions.css';

export function MarketplacePreviewShell({ title, subtitle, description, device, onDevice, onClose, action, children }: {
  title: string; subtitle: string; description: string;
  device: 'desktop' | 'mobile'; onDevice: (device: 'desktop' | 'mobile') => void;
  onClose: () => void; action?: ReactNode; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return <section className="marketplace-preview-shell bg-background text-foreground" aria-label={`${title} preview`}>
    <header className="marketplace-preview-header border-b border-border">
      <div className="marketplace-preview-heading">
        <div className="marketplace-preview-controls">
          <h1>{title} design preview</h1>
          <Button variant="link" size="sm" aria-label="Template description" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <ChevronDown aria-hidden="true" /> Description
          </Button>
        </div>
        <p className="text-muted-foreground">{subtitle}</p>
        {expanded && <p className="marketplace-description-cascade text-muted-foreground">{description}</p>}
      </div>
      <div className="marketplace-preview-controls">
        {action}
        <Button variant="outline" size="icon" title="Desktop preview" aria-label="Desktop preview" aria-pressed={device === 'desktop'} onClick={() => onDevice('desktop')}><Monitor /></Button>
        <Button variant="outline" size="icon" title="Mobile preview" aria-label="Mobile preview" aria-pressed={device === 'mobile'} onClick={() => onDevice('mobile')}><Smartphone /></Button>
        <Button variant="ghost" size="icon" title="Close preview" aria-label="Close preview" onClick={onClose}><X /></Button>
      </div>
    </header>
    <div className="marketplace-preview-body">{children}</div>
  </section>;
}