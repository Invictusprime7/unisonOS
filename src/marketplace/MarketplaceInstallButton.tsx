import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { installTemplateDraft, type MarketplaceDraftSelection } from './installTemplateDraft';

export function MarketplaceInstallButton({ selection }: { selection: MarketplaceDraftSelection }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  return <div>
    <Button size="sm" disabled={busy} onClick={async () => {
      if (busy) return;
      setBusy(true); setError('');
      try {
        const state = await installTemplateDraft(selection);
        navigate(`/web-builder?id=${state.draftId}`, { state });
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Installation failed.'); }
      finally { setBusy(false); }
    }}>{busy ? <Loader2 aria-hidden="true" /> : <Download aria-hidden="true" />}{busy ? 'Building draft…' : 'Install as draft'}</Button>
    {error && <p role="alert" className="text-destructive">{error} {error.startsWith('Sign in') && <Button variant="link" size="sm" onClick={() => navigate('/auth')}>Sign in</Button>}</p>}
  </div>;
}