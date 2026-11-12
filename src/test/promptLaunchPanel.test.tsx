import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { createAffinitySourceProject } = vi.hoisted(() => ({ createAffinitySourceProject: vi.fn() }));
vi.mock('@/services/source-authoring/createAffinitySourceProject', () => ({ createAffinitySourceProject }));
vi.mock('@/services/import/importHandoff', () => ({ prepareImportedProjectHandoff: () => ({ fromImportedSource: true }) }));
vi.mock('@/components/onboarding/ImportProjectZipButton', () => ({ ImportProjectZipButton: () => <button type="button">Import an exported .zip</button> }));
vi.mock('@/components/onboarding/ImportUnisonSiteZipButton', () => ({ ImportUnisonSiteZipButton: () => <button type="button">Restore a Unison export</button> }));

import { PromptLaunchPanel } from '@/components/launch/PromptLaunchPanel';
import { SourceAuthoringError } from '@/services/source-authoring/affinitySourceAuthor';

const BRIEF = 'Build a Ghanaian football publication called Black Star Pulse with an interactive match centre.';

function renderPanel(props: Partial<Parameters<typeof PromptLaunchPanel>[0]> = {}) {
  return render(<MemoryRouter><PromptLaunchPanel brief={BRIEF} onClose={() => undefined} {...props} /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  createAffinitySourceProject.mockReset();
});

describe('PromptLaunchPanel (chat-only site creation)', () => {
  it('shows what Affinity understood and offers project import', () => {
    renderPanel({ prefill: { businessId: 'biz-1' } });
    expect(screen.getByRole('heading', { name: 'Ready to create your site' })).toBeInTheDocument();
    expect(screen.getByLabelText('Site name')).toHaveValue('Black Star Pulse');
    expect(screen.getByText('Already have a site? Import it instead')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import an exported .zip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore a Unison export' })).toBeInTheDocument();
  });

  it('hands the owner prompt, name and demo flag to Affinity source authorship', async () => {
    createAffinitySourceProject.mockRejectedValueOnce(new Error('Gemini timed out.'));
    renderPanel({ demoGeneration: true, prefill: { businessId: 'biz-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    await waitFor(() => expect(createAffinitySourceProject).toHaveBeenCalledTimes(1));
    const [input] = createAffinitySourceProject.mock.calls[0];
    expect(input).toMatchObject({ prompt: BRIEF, projectName: 'Black Star Pulse', businessId: 'biz-1', demoGeneration: true });
  });

  it('says plainly when Affinity is unavailable and keeps the conversation', async () => {
    createAffinitySourceProject.mockRejectedValueOnce(new Error('Gemini timed out before the page finished.'));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Affinity is unavailable right now, so nothing was saved.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('lists what the build check found when a site cannot be finished', async () => {
    createAffinitySourceProject.mockRejectedValueOnce(new SourceAuthoringError('Affinity could not finish a site that builds cleanly.', ['/src/App.tsx: Could not resolve "./Missing"']));
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    expect(await screen.findByText('/src/App.tsx: Could not resolve "./Missing"')).toBeInTheDocument();
  });

  it('never invents a generic name: an unnamed site waits for the owner to type one', async () => {
    createAffinitySourceProject.mockRejectedValueOnce(new Error('Gemini timed out.'));
    renderPanel({ brief: 'Conversation details:\nCreate a gym website with class schedules, trainer profiles and membership sign-ups.', prefill: { businessId: 'biz-1', businessName: 'Unholy Kitty Nails' } });
    const field = screen.getByLabelText('Site name');
    expect(field).toHaveValue('');
    expect(screen.queryByText(/Gym Website With Class Schedules/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create my site' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'Iron Haven' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create my site' }));
    await waitFor(() => expect(createAffinitySourceProject).toHaveBeenCalledTimes(1));
    expect(createAffinitySourceProject.mock.calls[0][0].projectName).toBe('Iron Haven');
  });

  it('uses the name the owner gave when Affinity asked what the site is called', () => {
    renderPanel({ brief: 'Site name: Iron Haven\n\nConversation details:\nCreate a gym website with class schedules.\nIron Haven' });
    expect(screen.getByLabelText('Site name')).toHaveValue('Iron Haven');
  });
});
