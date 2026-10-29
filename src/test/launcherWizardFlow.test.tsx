import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LauncherWizard } from "@/components/onboarding/wizard/LauncherWizard";
import { runLaunchPipeline } from "@/services/launch/launchOrchestrator";
import { LaunchFatalError } from '@/services/launch/launchRun';
import { saveLaunchInterviewDraft } from '@/services/launch/interviewDraftService';

vi.mock("@/services/launch/launchOrchestrator", () => ({ runLaunchPipeline: vi.fn() }));
vi.mock("@/contexts/useLaunchHooks", () => ({ useLaunch: () => ({ setLaunch: vi.fn() }) }));
vi.mock("@/components/onboarding/ImportProjectZipButton", () => ({ ImportProjectZipButton: () => null }));
vi.mock("@/components/onboarding/ImportUnisonSiteZipButton", () => ({ ImportUnisonSiteZipButton: () => null }));
vi.mock("@/components/onboarding/TemplateLivePreview", () => ({ TemplateLivePreview: () => null }));
vi.mock("@/components/VFSPreview", () => ({ VFSPreview: ({ onReady, files }: { onReady: () => void; files: Record<string,string> }) => <button onClick={onReady}>Preview loaded {files['/src/App.tsx']}</button> }));
vi.mock("@/components/onboarding/StyleTokenCard", () => ({ StyleTokenCard: () => null }));
vi.mock("@/components/onboarding/wizard/DesignContractInspector", () => ({ DesignContractInspector: () => null }));

afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });

describe("Launcher Wizard guided flow", () => {
  it('offers the deterministic starter after AI App Builder fails', async () => {
    vi.mocked(runLaunchPipeline)
      .mockRejectedValueOnce(new LaunchFatalError('AI provider timed out.', { stage: 'app-build', code: 'app-build.failed' }))
      .mockRejectedValueOnce(new LaunchFatalError('Starter check failed.', { stage: 'app-build', code: 'app-build.failed' }));
    render(<MemoryRouter><LauncherWizard open onOpenChange={vi.fn()} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Salon & Spa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Book Appointments/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Studio Glow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create site' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Build without AI' }));

    await waitFor(() => expect(runLaunchPipeline).toHaveBeenCalledTimes(2));
    expect(vi.mocked(runLaunchPipeline).mock.calls[1][0].generationMode).toBe('deterministic');
  });

  it('restores structured owner answers instead of replaying conflicting chat defaults', async () => {
    saveLaunchInterviewDraft('shared-user', {
      selections: {
        industry: 'salon', systemId: 'booking', businessName: 'Studio Glow',
        primaryGoal: 'book_appointments', customerNeeds: ['book_service'], selectedPages: ['booking'],
        themePresetId: null, experience: 'standard', sectionPins: {}, socialLinks: {},
      },
      publicAnswers: { publicEmail: 'hello@studioglow.test' },
      privateAnswers: { ownerEmail: 'owner@studioglow.test', notificationEmail: 'owner@studioglow.test' },
    });

    render(<MemoryRouter><LauncherWizard
      open presentation="chat" onOpenChange={vi.fn()} draftScope="shared-user" guidedStep="brand"
      initialVisionPrompt="A restaurant with pickup orders"
    /></MemoryRouter>);

    expect(await screen.findByLabelText('Business name')).toHaveValue('Studio Glow');
    expect(screen.getByLabelText('Owner email')).toHaveValue('owner@studioglow.test');
    expect(screen.getByLabelText('Public email')).toHaveValue('hello@studioglow.test');
  });

  it('matches the AI question without replaying defaults over selections on later turns', async () => {
    const answer = vi.fn();
    const props = { open: true, presentation: 'chat' as const, onOpenChange: vi.fn(), onSelectionConfirmed: answer };
    const { rerender } = render(<MemoryRouter><LauncherWizard {...props} guidedStep="goals"
      initialVisionPrompt="A salon website" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Book Appointments/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(answer).toHaveBeenCalledWith(expect.stringContaining('My selection: Book Appointments'));
    expect(runLaunchPipeline).not.toHaveBeenCalled();
    rerender(<MemoryRouter><LauncherWizard {...props} guidedStep="brand"
      initialVisionPrompt="A salon website. We also discussed selling products." /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Business name'), { target: { value: 'Studio Glow' } });
    rerender(<MemoryRouter><LauncherWizard {...props} guidedStep="confirm"
      initialVisionPrompt="A salon website. We also discussed selling products. Ready to review?" /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Your site plan' })).toHaveTextContent('Book Appointments');
    expect(screen.getByRole('region', { name: 'Your site plan' })).toHaveTextContent('Studio Glow');
    expect(screen.getByRole('button', { name: 'Create site' })).toBeEnabled();
  });
  it("guides chat selections without an overlay and launches only after the final plan is confirmed", async () => {
    vi.mocked(runLaunchPipeline).mockImplementation(async (_input, callbacks) => {
      await callbacks!.onReview!({ files: { '/src/App.tsx': 'chat candidate' }, entryPoint: '/src/App.tsx' });
      const error = new Error('discarded'); error.name = 'LaunchReviewCancelled'; throw error;
    });
    render(<MemoryRouter><LauncherWizard open presentation="chat" onOpenChange={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Pages to include')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create site' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Salon & Spa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Book Appointments/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Visitor actions')).toBeInTheDocument();
    expect(screen.queryByText('Pages to include')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Pages to include')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Selected style')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business name')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Studio Glow' } });
    fireEvent.change(screen.getByLabelText('Owner email'), { target: { value: 'owner@studioglow.test' } });
    fireEvent.change(screen.getByLabelText('Public email'), { target: { value: 'hello@studioglow.test' } });
    fireEvent.change(screen.getByLabelText('Business phone'), { target: { value: '+1 555 0100' } });
    fireEvent.click(screen.getByText('Location and business hours'));
    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '10 Main Street' } });
    fireEvent.change(screen.getByLabelText('Business city'), { target: { value: 'Brooklyn' } });
    fireEvent.change(screen.getByLabelText('Monday opening time'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('region', { name: 'Your site plan' })).toHaveTextContent('Studio Glow');
    expect(runLaunchPipeline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Business name')).toHaveValue('Studio Glow');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create site' }));
    expect(runLaunchPipeline).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runLaunchPipeline).mock.calls[0][0]).toMatchObject({
      businessName: 'Studio Glow',
      primaryGoal: 'book_appointments',
      businessParameters: {
        ownerEmail: 'owner@studioglow.test',
        notificationEmail: 'owner@studioglow.test',
        publicEmail: 'hello@studioglow.test',
        phone: '+1 555 0100',
        address: { line1: '10 Main Street', city: 'Brooklyn' },
        hours: expect.arrayContaining([expect.objectContaining({ day: 'mon', open: '09:00' })]),
        ctaDestinations: {
          call: 'tel:+15550100',
          email: 'mailto:hello@studioglow.test',
        },
      },
    });
    await screen.findByRole('heading', { name: 'Preparing your site preview' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open in builder' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Preview loaded chat candidate/ }));
    expect(screen.getByRole('button', { name: 'Open in builder' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  }, 20000);

  it("signals completion only after a successful site launch", async () => {
    const onLaunchComplete = vi.fn();
    vi.mocked(runLaunchPipeline).mockResolvedValue({ launchState: {}, navigationState: {} } as never);
    render(<MemoryRouter><LauncherWizard open onOpenChange={vi.fn()} onLaunchComplete={onLaunchComplete} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /Salon & Spa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: /Book Appointments/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Studio Glow" } });
    fireEvent.click(screen.getByRole("button", { name: "Create site" }));

    await waitFor(() => expect(onLaunchComplete).toHaveBeenCalledOnce());
  }, 20000);

  it("keeps the opening screen focused on industry selection and progressively reveals setup", () => {
    render(<MemoryRouter><LauncherWizard open onOpenChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.queryByLabelText("Describe your website")).not.toBeInTheDocument();
    expect(screen.queryByText("Design details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Salon & Spa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "What should your site accomplish?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Book Appointments/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Shape the visitor experience" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("heading", { name: "Choose a starting layout" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose the visual direction" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create site" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Studio Glow" } });
    expect(screen.getByRole("button", { name: "Create site" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Business name")).toHaveValue("Studio Glow");
    expect(runLaunchPipeline).not.toHaveBeenCalled();
  }, 20000);

  it("opens directly on goals with the confirmed homepage brief prefilled", async () => {
    render(
      <MemoryRouter>
        <LauncherWizard
          open
          onOpenChange={vi.fn()}
          initialVisionPrompt="Luxury hair and nail spa named Studio Glow with online booking and lookbook gallery"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "What should your site accomplish?" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Describe your website")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Shape the visitor experience" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Business name")).toHaveValue("Studio Glow");
  });
});

it('requires preview readiness and discards the first candidate when regenerating', async () => {
 const accepted: number[] = [];
 vi.mocked(runLaunchPipeline).mockImplementation(async (_input, callbacks) => {
  const take = vi.mocked(runLaunchPipeline).mock.calls.length;
  const accept = await callbacks!.onReview!({ files: { '/src/App.tsx': String(take) }, entryPoint: '/src/App.tsx' });
  if (accept) accepted.push(take);
  const error = new Error('discarded'); error.name = 'LaunchReviewCancelled'; throw error;
 });
 render(<MemoryRouter><LauncherWizard open onOpenChange={vi.fn()} /></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:/Salon & Spa/}));
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fireEvent.click(screen.getByRole('button',{name:'Continue'}));
 fireEvent.change(screen.getByLabelText('Business name'),{target:{value:'Glow'}});
 fireEvent.click(screen.getByRole('button',{name:'Create site'}));
 await screen.findByRole('heading',{name:'Preparing your site preview'});
 expect(screen.getByRole('button',{name:'Open in builder'})).toBeDisabled();
 expect(accepted).toEqual([]);
 fireEvent.click(screen.getByRole('button',{name:'Preview loaded 1'}));
 expect(screen.getByRole('button',{name:'Open in builder'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Try another'}));
 await screen.findByRole('button',{name:'Preview loaded 2'});
 expect(runLaunchPipeline).toHaveBeenCalledTimes(2);
 expect(vi.mocked(runLaunchPipeline).mock.calls[1][0].regenerationNonce).toBeTruthy();
 expect(screen.getByRole('button',{name:'Open in builder'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Preview loaded 2'}));
 fireEvent.click(screen.getByRole('button',{name:'Open in builder'}));
 await waitFor(()=>expect(accepted).toEqual([2]));
},20000);
