/**
 * Prompt-first creation panel. Rendered inside the Affinity chat once the
 * visitor confirms their brief: it shows what Affinity understood, then
 * Affinity writes the whole site as its own source project — the same kind of
 * project an import creates — and opens it in the builder. The panel owns no
 * design decision and writes nothing itself.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildPromptLaunchInput, type PromptLaunchPrefill } from '@/services/launch/promptLaunchInput';
import { createAffinitySourceProject } from '@/services/source-authoring/createAffinitySourceProject';
import { SourceAuthoringError } from '@/services/source-authoring/affinitySourceAuthor';
import { prepareImportedProjectHandoff } from '@/services/import/importHandoff';
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

/** Provider outages, so the message can say "try again shortly" instead of blaming the prompt. */
export const AI_UNAVAILABLE_PATTERN = /timed? ?out|timeout|quota|credit|rate.?limit|429|402|unavailable|provider|no managed ai|not configured/i;

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
  const preview = useMemo(() => {
    try { return buildPromptLaunchInput(brief, { prefill }); } catch { return null; }
  }, [brief, prefill]);
  const creation = preview?.plan.creationInput;
  const planPages = creation?.pages ?? [];
  // Only what the owner called the site; never a generic or derived title.
  const statedName = preview?.input.businessName?.trim() ?? '';
  const [siteName, setSiteName] = useState(statedName);
  useEffect(() => { setSiteName(statedName); }, [statedName]);
  const projectName = siteName.replace(/\s+/g, ' ').trim();
  const [launching, setLaunching] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const launch = async () => {
    if (launching || !brief.trim() || !projectName) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLaunching(true);
    setError(null);
    setDetails([]);
    setActivity(['Reading your conversation']);
    try {
      const result = await createAffinitySourceProject({
        prompt: brief,
        projectName,
        businessId: prefill?.businessId,
        demoGeneration,
        planNotes: planPages.length
          ? `Pages the conversation mentions (a starting point, not a limit):\n${planPages.map((page) => `- ${page.title} (${page.route}): ${page.purpose}`).join('\n')}`
          : undefined,
        signal: controller.signal,
        onStatus: (next) => {
          if (controller.signal.aborted) return;
          setActivity((current) => current[current.length - 1] === next ? current : [...current, next].slice(-8));
        },
      });
      if (controller.signal.aborted) return;
      clearRetiredInterviewDrafts();
      onLaunchComplete?.();
      const routeState = prepareImportedProjectHandoff(result);
      toast.success(`${result.projectName} is ready`, { description: `Affinity wrote ${result.authored.pages.length || 'your'} pages. Ask Affinity for any change.` });
      navigate('/web-builder', { replace: true, state: routeState });
      onClose();
    } catch (caught) {
      if (controller.signal.aborted) return;
      const message = caught instanceof Error ? caught.message : String(caught);
      const authoring = caught instanceof SourceAuthoringError ? caught : null;
      setError(authoring?.options.timedOut
        ? `${message} Your site is not saved yet, but the parts Affinity finished are kept, so Try again continues from there.`
        : AI_UNAVAILABLE_PATTERN.test(message)
          ? `Affinity is unavailable right now, so nothing was saved. Your conversation is preserved${authoring?.options.resumable ? ' and the parts Affinity finished are kept' : ''}; try again in a moment.`
          : `${message} Nothing was saved and your conversation is preserved.`);
      setDetails(authoring && !authoring.options.timedOut ? authoring.detail : []);
      console.error('[PromptLaunchPanel] site creation failed', caught);
    } finally {
      if (!controller.signal.aborted) setLaunching(false);
    }
  };

  if (launching) {
    return (
      <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground" aria-live="polite" data-testid="prompt-launch-progress">
        <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Affinity is writing your site</p>
        <ol className="space-y-1 text-xs text-muted-foreground">
          {activity.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
        </ol>
        <Button variant="ghost" onClick={() => { abortRef.current?.abort(); setLaunching(false); setActivity([]); }}>Stop</Button>
      </div>
    );
  }

  return (
    <section className="mt-3 space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground" data-testid="prompt-launch-confirm" aria-labelledby="prompt-launch-title">
      <div className="space-y-1">
        <h2 id="prompt-launch-title" className="text-base font-semibold">Ready to create your site</h2>
        <p className="text-xs text-muted-foreground">Affinity designs and writes the whole site from your conversation. You can change anything afterwards by chatting.</p>
      </div>
      {preview ? (
        <section aria-label="What Affinity understood" data-testid="prompt-launch-plan" className="space-y-3 rounded-md border border-border bg-background/50 p-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt><label htmlFor="prompt-launch-site-name" className="text-xs text-muted-foreground">Site name</label></dt>
              <dd className="space-y-1">
                <Input
                  id="prompt-launch-site-name"
                  data-testid="prompt-launch-site-name"
                  value={siteName}
                  maxLength={64}
                  placeholder="What is your site called?"
                  aria-describedby={projectName ? undefined : 'prompt-launch-site-name-hint'}
                  onChange={(event) => setSiteName(event.target.value)}
                />
                {!projectName && <p id="prompt-launch-site-name-hint" className="text-xs text-muted-foreground">You haven't named your site yet. Type its name to continue.</p>}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">Purpose</dt>
              <dd className="font-medium">{creation?.sitePurpose || creation?.subject || 'Website from your prompt'}</dd>
            </div>
          </dl>
          {planPages.length > 0 && (
            <div className="border-t border-border pt-3">
              <h3 className="text-xs font-medium text-muted-foreground">Pages you mentioned</h3>
              <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                {planPages.map((page) => (
                  <li key={page.route} className="border-l-2 border-primary/40 pl-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{page.title}</span>
                      <code className="text-[11px] text-muted-foreground">{page.route}</code>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{page.purpose}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Affinity may add or combine pages if your site needs it.</p>
            </div>
          )}
        </section>
      ) : (
        <p role="alert" className="text-sm text-destructive">Describe the site you want to create in the chat first.</p>
      )}
      {creation?.experienceDirection && (
        <CreativeBriefInspector direction={creation.experienceDirection} pages={creation.pages} />
      )}
      {error && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive p-3 text-sm text-destructive">
          <p>{error}</p>
          {details.length > 0 && <details><summary className="cursor-pointer text-xs font-medium">What the check found</summary><ul className="mt-2 max-h-40 list-disc overflow-auto pl-4 text-xs">{details.map((line) => <li key={line}>{line}</li>)}</ul></details>}
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>Keep chatting</Button>
        <Button disabled={!preview || !projectName} onClick={() => void launch()}><Sparkle />{error ? 'Try again' : 'Create my site'}</Button>
      </div>
      <details className="border-t border-border pt-3 text-sm" data-testid="prompt-launch-import">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Already have a site? Import it instead</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <ImportProjectZipButton businessId={prefill?.businessId} onImported={onClose} />
          {prefill?.businessId && <ImportUnisonSiteZipButton businessId={prefill.businessId} onImported={onClose} />}
        </div>
      </details>
    </section>
  );
}
