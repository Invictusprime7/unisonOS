import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { installTemplateDraft, type InstallProgress, type MarketplaceDraftSelection } from './installTemplateDraft';

/** App Builder authors every page; long installs must stay visibly alive and bounded. */
export const INSTALL_TIME_LIMIT_MS = 7 * 60_000;

function elapsedLabel(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function MarketplaceInstallButton({ selection }: { selection: MarketplaceDraftSelection }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const start = async () => {
    if (busy) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const limit = window.setTimeout(() => controller.abort('Building this template took too long and was stopped. Please try again.'), INSTALL_TIME_LIMIT_MS);
    setBusy(true); setError(''); setProgress({ label: 'Starting' });
    setStartedAt(Date.now()); setNow(Date.now());
    try {
      const state = await installTemplateDraft(selection, { signal: controller.signal, onStatus: setProgress });
      navigate(`/web-builder?id=${state.draftId}`, { state });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Installation failed.');
    } finally {
      window.clearTimeout(limit);
      controllerRef.current = null;
      setBusy(false); setProgress(null);
    }
  };

  const pages = progress?.total ? ` · ${progress.done ?? 0} of ${progress.total} pages ready` : '';
  return <div>
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={busy} onClick={start}>
        {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
        {busy ? 'Building draft…' : 'Install as draft'}
      </Button>
      {busy && <Button size="sm" variant="ghost" onClick={() => controllerRef.current?.abort('Installation was stopped before the draft was saved.')}>Stop</Button>}
    </div>
    {busy && progress && <p role="status" aria-live="polite" className="text-muted-foreground text-xs">
      {progress.label}{pages} · {elapsedLabel(now - startedAt)} (usually 2–5 minutes)
    </p>}
    {error && <p role="alert" className="text-destructive">{error} {error.startsWith('Sign in') && <Button variant="link" size="sm" onClick={() => navigate('/auth')}>Sign in</Button>}</p>}
  </div>;
}
