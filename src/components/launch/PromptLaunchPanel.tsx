/**
 * Prompt-first creation panel (UPG-01). Rendered inside the Affinity chat once
 * the visitor confirms their brief: it shows the inferred plan as revisable
 * defaults, runs the one canonical launch pipeline, lets the visitor review the
 * generated preview, and hands off to the builder. It owns no design decision
 * and writes nothing itself — `runLaunchPipeline` and App Builder do.
 */

import type { RequirementCoverageReport } from '@/services/app-builder/requirementCoverage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Monitor, PanelsTopLeft, Smartphone, Sparkle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VFSPreview } from '@/components/VFSPreview';
import { LaunchStageTimeline } from '@/components/onboarding/wizard/LaunchStageTimeline';
import { useLaunch } from '@/contexts/useLaunchHooks';
import { runLaunchPipeline } from '@/services/launch/launchOrchestrator';
import { buildPromptLaunchInput, type PromptLaunchPrefill } from '@/services/launch/promptLaunchInput';
import {
  createLaunchFailureReport,
  persistLaunchFailureReport,
  type LaunchFailureReport,
  type LaunchRunSnapshot,
} from '@/services/launch/launchRun';
import type { AppBuildGenerationMode } from '@/services/app-builder/appBuilderContracts';
import { ImportProjectZipButton } from '@/components/onboarding/ImportProjectZipButton';
import { ImportUnisonSiteZipButton } from '@/components/onboarding/ImportUnisonSiteZipButton';
import { CreativeBriefInspector } from '@/components/launch/CreativeBriefInspector';

/** Key prefix of answers saved by the retired guided setup; they may hold private contact details. */
export const RETIRED_INTERVIEW_DRAFT_PREFIX = 'unison.launch-interview.';

/** Remove answers the retired guided setup left in this browser. */
export function clearRetiredInterviewDrafts(storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | null = typeof window === 'undefined' ? null : window.localStorage): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(RETIRED_INTERVIEW_DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage may be unavailable (private mode); nothing to clean up.
  }
}

/** Provider outages only; validation failures never offer the starter fallback. */
export const AI_UNAVAILABLE_PATTERN = /timed? ?out|timeout|quota|credit|rate.?limit|429|402|unavailable|provider|no managed ai|not configured/i;

interface ReviewCandidate {
  files: Record<string, string>;
  entryPoint: string;
  coverage?: RequirementCoverageReport;
}

export interface PromptLaunchPanelProps {
  /** Confirmed conversation brief; the original prompt stays creative authority. */
  brief: string;
  demoGeneration?: boolean;
  prefill?: PromptLaunchPrefill | null;
  onClose: () => void;
  onLaunchComplete?: () => void;
}

export function PromptLaunchPanel({ brief, demoGeneration, prefill, onClose, onLaunchComplete }: PromptLaunchPanelProps) {
  const navigate = useNavigate();
  const { setLaunch } = useLaunch();
  const preview = useMemo(() => {
    try { return buildPromptLaunchInput(brief, { prefill }); } catch { return null; }
  }, [brief, prefill]);
  const [launching, setLaunching] = useState(false);
  const [mode, setMode] = useState<AppBuildGenerationMode>('ai');
  const [status, setStatus] = useState('');
  const [activity, setActivity] = useState<string[]>([]);
  const [progress, setProgress] = useState<LaunchRunSnapshot | null>(null);
  const [review, setReview] = useState<ReviewCandidate | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<LaunchFailureReport | null>(null);
  const runRef = useRef(0);
  const decisionRef = useRef<((accepted: boolean) => void) | null>(null);
  const mountedRef = useRef(true);
  const progressRef = useRef<LaunchRunSnapshot | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      decisionRef.current?.(false);
    };
  }, []);

  const handlePreviewReady = useCallback(() => { setPreviewReady(true); setError(null); }, []);
  const handlePreviewError = useCallback((message: string) => { setPreviewReady(false); setError(`Preview could not render: ${message}`); }, []);

  const launch = async (generationMode: AppBuildGenerationMode) => {
    if (launching) return;
    const run = ++runRef.current;
    decisionRef.current?.(false);
    decisionRef.current = null;
    setMode(generationMode);
    setLaunching(true);
    setReview(null);
    setPreviewReady(false);
    setError(null);
    setFailure(null);
    setProgress(null);
    setActivity([]);
    progressRef.current = null;
    setStatus(generationMode === 'deterministic' ? 'Building starter pages…' : 'Preparing your site…');
    const live = () => run === runRef.current && mountedRef.current;
    try {
      const { input } = buildPromptLaunchInput(brief, {
        generationMode,
        demoGeneration,
        prefill,
        regenerationNonce: run > 1 ? `take-${run}` : null,
      });
      const result = await runLaunchPipeline(input, {
        onReview: (candidate) => new Promise<boolean>((resolve) => {
          if (!live()) { resolve(false); return; }
          setReview({ files: candidate.files, entryPoint: candidate.entryPoint, coverage: candidate.coverage });
          setLaunching(false);
          decisionRef.current = resolve;
        }),
        onStatus: (next) => {
          if (!live()) return;
          setStatus(next);
          setActivity((current) => current[current.length - 1] === next ? current : [...current, next].slice(-6));
        },
        onProgress: (snapshot) => {
          if (!live()) return;
          progressRef.current = snapshot;
          setProgress(snapshot);
        },
      });
      if (run !== runRef.current) return;
      clearRetiredInterviewDrafts();
      onLaunchComplete?.();
      setLaunch(result.launchState);
      navigate('/web-builder', { replace: true, state: result.navigationState });
      onClose();
    } catch (caught) {
      if (run !== runRef.current || (caught instanceof Error && caught.name === 'LaunchReviewCancelled')) return;
      setReview(null);
      decisionRef.current = null;
      const report = createLaunchFailureReport(caught, progressRef.current);
      persistLaunchFailureReport(report);
      setFailure(report);
      setError(`${report.message} Your conversation is preserved.`);
      console.error('[PromptLaunchPanel] site creation failed', report, caught);
    } finally {
      if (run === runRef.current && mountedRef.current) {
        setLaunching(false);
        setStatus('');
      }
    }
  };

  const aiUnavailable = Boolean(failure && failure.stage === 'app-build' && mode === 'ai' && AI_UNAVAILABLE_PATTERN.test(failure.message));

  if (review) {
    return (
      <section className="mt-3 flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground" data-testid="prompt-launch-review">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold">{previewReady ? 'Your site is ready to review' : 'Preparing your site preview'}</h2>
            <p className="text-xs text-muted-foreground">{previewReady ? 'Check the result before opening it in the builder.' : 'Your pages are generated. Checking that they render correctly.'}</p>
            {review.coverage && (
              <p className={review.coverage.complete ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'} data-testid="prompt-launch-coverage">
                {review.coverage.summary}
              </p>
            )}
            {review.coverage && review.coverage.promotionCandidates.length > 0 && (
              <p className="text-xs text-muted-foreground" data-testid="prompt-launch-promotion">
                {`${new Set(review.coverage.promotionCandidates.map((candidate) => candidate.modulePath)).size} original part(s) were designed for this site and could be added to the Unison library later.`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-1">
            <Button size="icon" variant={device === 'desktop' ? 'secondary' : 'ghost'} aria-label="Desktop preview" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor /></Button>
            <Button size="icon" variant={device === 'mobile' ? 'secondary' : 'ghost'} aria-label="Mobile preview" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone /></Button>
          </div>
        </div>
        <div className="h-[60dvh] min-h-96 overflow-hidden bg-background">
          <VFSPreview nodes={[]} files={review.files} activeFile={review.entryPoint} device={device} forceBackend="sandpack" autoStart={false} showToolbar={false} onReady={handlePreviewReady} onError={handlePreviewError} />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { decisionRef.current?.(false); decisionRef.current = null; setReview(null); }}>Keep chatting</Button>
            <Button variant="outline" onClick={() => void launch('ai')}>Try another</Button>
          </div>
          <Button disabled={!previewReady || launching} onClick={() => { setLaunching(true); decisionRef.current?.(true); decisionRef.current = null; }}>
            {launching ? <Loader2 className="animate-spin" /> : <Sparkle />}
            {launching ? 'Opening…' : 'Open in builder'}
          </Button>
        </div>
        {error && <p role="alert" className="px-4 pb-4 text-sm text-destructive">{error}</p>}
      </section>
    );
  }

  if (launching) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-card p-4 text-card-foreground" aria-live="polite">
        {progress
          ? <LaunchStageTimeline snapshot={progress} statusText={status} activity={activity} generationMode={mode} className="w-full" />
          : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{status || 'Preparing your site…'}</p>}
      </div>
    );
  }

  return (
    <section className="mt-3 space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground" data-testid="prompt-launch-confirm" aria-labelledby="prompt-launch-title">
      <div className="space-y-1">
        <h2 id="prompt-launch-title" className="text-base font-semibold">Ready to create your site</h2>
        <p className="text-xs text-muted-foreground">Affinity builds from your conversation. Everything below is a starting point you can change later by chatting.</p>
      </div>
      {preview ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Working name</dt>
            <dd className="font-medium">{preview.input.businessName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Pages</dt>
            <dd className="font-medium">{preview.plan.creationInput.pages.map((page) => page.title).join(', ') || 'Home'}</dd>
          </div>
          {preview.plan.creationInput.requestedCapabilities.length > 0 && (
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Requested features</dt>
              <dd className="font-medium">{preview.plan.creationInput.requestedCapabilities.join(', ')}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p role="alert" className="text-sm text-destructive">Describe the site you want to create in the chat first.</p>
      )}
      {preview?.plan.creationInput.experienceDirection && (
        <CreativeBriefInspector direction={preview.plan.creationInput.experienceDirection} pages={preview.plan.creationInput.pages} />
      )}
      {error && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive p-3 text-sm text-destructive">
          <p>{error}</p>
          {failure && <details><summary className="cursor-pointer text-xs font-medium">Technical details</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(failure, null, 2)}</pre></details>}
          {aiUnavailable && (
            <Button variant="outline" onClick={() => void launch('deterministic')}><PanelsTopLeft />Build without AI</Button>
          )}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>Keep chatting</Button>
        <Button disabled={!preview} onClick={() => void launch('ai')}><Sparkle />{error ? 'Try again' : 'Create my site'}</Button>
      </div>
      <details className="border-t border-border pt-3 text-sm" data-testid="prompt-launch-import">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Already have a site? Import it instead</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <ImportProjectZipButton onImported={onClose} />
          {prefill?.businessId && <ImportUnisonSiteZipButton businessId={prefill.businessId} onImported={onClose} />}
        </div>
      </details>
    </section>
  );
}
