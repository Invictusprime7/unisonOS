import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LaunchFatalError } from '@/services/launch/launchRun';

const { runLaunchPipeline } = vi.hoisted(() => ({ runLaunchPipeline: vi.fn() }));
vi.mock('@/services/launch/launchOrchestrator', () => ({ runLaunchPipeline }));
vi.mock('@/contexts/useLaunchHooks', () => ({ useLaunch: () => ({ setLaunch: vi.fn() }) }));
vi.mock('@/components/VFSPreview', () => ({ VFSPreview: () => null }));
vi.mock('@/components/onboarding/ImportProjectZipButton', () => ({ ImportProjectZipButton: () => <button type="button">Import an exported .zip</button> }));
vi.mock('@/components/onboarding/ImportUnisonSiteZipButton', () => ({ ImportUnisonSiteZipButton: () => <button type="button">Restore a Unison export</button> }));

import { PromptLaunchPanel } from '@/components/launch/PromptLaunchPanel';

const BRIEF = 'Build a Ghanaian football publication called Black Star Pulse with an interactive match centre.';

function renderPanel(props: Partial<Parameters<typeof PromptLaunchPanel>[0]> = {}) {
  return render(<MemoryRouter><PromptLaunchPanel brief={BRIEF} onClose={() => undefined} {...props} /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  runLaunchPipeline.mockReset();
});

describe('PromptLaunchPanel (chat-only site creation)', () => {
  it('shows the plan inferred from the conversation and offers project import', () => {
    renderPanel({ prefill: { businessId: 'biz-1' } });
    expect(screen.getByRole('heading', { name: 'Ready to create your site' })).toBeInTheDocument();
    expect(screen.getByText('Black Star Pulse')).toBeInTheDocument();
    expect(screen.getByText('Already have a site? Import it instead')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import an exported .zip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore a Unison export' })).toBeInTheDocument();
  });

  it('shows the Creative Brief Affinity read from the conversation, with where each choice came from', () => {
    renderPanel({ brief: 'Create a cinematic music artist website with an immersive hero, horizontal releases gallery, tour dates, and fan sign-ups.' });
    const inspector = screen.getByTestId('creative-brief-inspector');
    expect(inspector).toHaveTextContent('Cinematic Portfolio');
    expect(inspector).toHaveTextContent('Rich motion and reveals');
    expect(inspector).toHaveTextContent('“immersive hero”');
    expect(inspector).toHaveTextContent('“horizontal releases gallery”');
    expect(inspector).toHaveTextContent('Your words');
    expect(screen.getByText(/Releases/, { selector: 'dd' })).toBeInTheDocument();
  });

  it('runs the canonical launch with the prompt-only AI input', async () => {
    runLaunchPipeline.mockRejectedValueOnce(new LaunchFatalError('Gemini timed out.', { stage: 'app-build' }));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    await waitFor(() => expect(runLaunchPipeline).toHaveBeenCalledTimes(1));
    const [input] = runLaunchPipeline.mock.calls[0];
    expect(input).toMatchObject({ generationMode: 'ai', industry: 'universal', primaryGoal: null, customerNeeds: [] });
    expect(input.universalCreation.originalPrompt).toBe(BRIEF);
  });

  it('offers "Build without AI" only when the AI provider is unavailable', async () => {
    runLaunchPipeline.mockRejectedValueOnce(new LaunchFatalError('Gemini timed out before the page finished.', { stage: 'app-build' }));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    expect(await screen.findByRole('button', { name: 'Build without AI' })).toBeInTheDocument();
  });

  it('does not offer the starter fallback for a design validation failure', async () => {
    runLaunchPipeline.mockRejectedValueOnce(new LaunchFatalError('Home planned section order must be preserved.', { stage: 'app-build' }));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Build without AI' })).not.toBeInTheDocument();
  });
});
