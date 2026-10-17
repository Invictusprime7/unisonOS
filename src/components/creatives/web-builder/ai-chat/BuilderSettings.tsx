import { Settings2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { BuilderFeature, BuilderFeatures } from '@/services/builder/builderFeatures';
import { AIPermissionControl, type AIEditPermissions } from '../AIPermissionControl';

const FEATURES: { key: BuilderFeature; label: string }[] = [
  { key: 'images', label: 'Image generation' },
  { key: 'catalog', label: 'Catalog edits' },
  { key: 'capabilities', label: 'Business actions' },
  { key: 'repairs', label: 'Error repairs' },
  { key: 'tools', label: 'Command tools' },
];

export function BuilderSettings({ open, onToggle, features, onChange, permissions, onPermissionsChange, busy }: {
  open: boolean; onToggle: () => void; features: BuilderFeatures; onChange: (next: BuilderFeatures) => void;
  permissions: AIEditPermissions; onPermissionsChange: (next: AIEditPermissions) => void; busy: boolean;
}) {
  return <>
    <Button variant="link" size="icon" onClick={onToggle} aria-label="AI settings" aria-expanded={open} aria-controls="builder-feature-settings" title="AI settings">
      <Settings2 />
    </Button>
    {open && <section id="builder-feature-settings" aria-label="AI settings" className="builder-settings">
      <div className="builder-settings-heading"><span>AI settings</span><Button variant="link" size="icon" onClick={onToggle} aria-label="Close AI settings"><ChevronDown /></Button></div>
      {FEATURES.map(({ key, label }) => <label key={key} className="builder-setting-row">
        <span>{label}</span><Switch aria-label={label} checked={features[key]} disabled={busy} onCheckedChange={checked => onChange({ ...features, [key]: checked })} />
      </label>)}
      <div className="builder-setting-row"><span>Apply changes</span><AIPermissionControl permissions={permissions} onChange={onPermissionsChange} /></div>
    </section>}
  </>;
}