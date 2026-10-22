import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SetupWizardPanel } from '@/components/creatives/web-builder/setup-wizard/SetupWizardPanel';
import { loadSiteProfile, saveSiteProfile } from '@/services/businessProfileService';
import { uploadForPlacement } from '@/services/assets/uploadPlacement';
import type { BusinessProfileDTO } from '@/types/businessProfile';
import type { UseSetupWizardReturn } from '@/hooks/useSetupWizard';

vi.mock('@/services/businessProfileService', () => ({
  loadSiteProfile: vi.fn(),
  saveSiteProfile: vi.fn(),
}));
vi.mock('@/services/assets/uploadPlacement', () => ({ uploadForPlacement: vi.fn() }));

const profile: BusinessProfileDTO = {
  businessId: 'business-1',
  ownerId: 'owner-1',
  name: 'Northstar Studio',
  industry: 'salon',
  notificationEmail: 'owner@example.test',
  email: 'hello@example.test',
  phone: '+1 555 0100',
  timezone: 'America/New_York',
  address: { line1: '10 Main Street', city: 'Brooklyn' },
  hours: [{ day: 'mon', open: '09:00', close: '17:00' }],
  socialLinks: {},
  settings: {},
};

function renderOwnerStep() {
  const wizard = {
    steps: [{
      id: 'owner_information', title: 'Owner Information', description: 'Review owner information',
      category: 'core', timeEstimate: '~3 min', required: false, status: 'pending', config: {}, completedAt: null,
    }],
    activeStep: 'owner_information', setActiveStep: vi.fn(), completedCount: 0, totalCount: 1,
    progressPercent: 0, isLoading: false, isSaving: false, updateStepConfig: vi.fn(),
    completeStep: vi.fn(), skipStep: vi.fn(), resetStep: vi.fn(), saveStepConfig: vi.fn(),
  } as unknown as UseSetupWizardReturn;
  return render(<SetupWizardPanel
    wizard={wizard}
    businessId="business-1"
    siteId="site-1"
    projectId="project-1"
    industry="salon"
    systemType="booking"
  />);
}

describe('Owner Information launch step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSiteProfile).mockResolvedValue(profile);
    vi.mocked(saveSiteProfile).mockResolvedValue(profile);
  });

  it('loads the project-scoped owner profile and shows location and hours for local booking sites', async () => {
    renderOwnerStep();

    expect(await screen.findByDisplayValue('Northstar Studio')).toBeInTheDocument();
    expect(loadSiteProfile).toHaveBeenCalledWith('business-1', 'project-1');
    expect(screen.getByText('Brand details').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Location and hours').closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Brand details'));
    expect(screen.getByLabelText('Choose business logo image')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Location and hours'));
    expect(screen.getByDisplayValue('10 Main Street')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Brooklyn')).toBeInTheDocument();
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
  });

  it('saves edited visitor details through the site profile service', async () => {
    renderOwnerStep();

    fireEvent.change(await screen.findByLabelText('City'), { target: { value: 'Queens' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save owner information' }));

    await waitFor(() => expect(saveSiteProfile).toHaveBeenCalledWith(
      'business-1',
      'project-1',
      expect.objectContaining({ address: { ...profile.address, city: 'Queens' } }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Owner information saved.');
  });

  it('uploads a logo image and saves its durable URL without a logo URL text field', async () => {
    vi.mocked(uploadForPlacement).mockResolvedValue({
      name: 'logo.png', kind: 'image', mimeType: 'image/png', url: 'https://assets.example.test/logo.png',
    });
    renderOwnerStep();

    expect(screen.queryByLabelText('Logo URL')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText('Brand details'));
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose business logo image'), { target: { files: [file] } });

    await waitFor(() => expect(uploadForPlacement).toHaveBeenCalledWith(file, 'project-1'));
    expect(await screen.findByAltText('Business logo preview')).toHaveAttribute('src', 'https://assets.example.test/logo.png');
    fireEvent.click(screen.getByRole('button', { name: 'Save owner information' }));
    await waitFor(() => expect(saveSiteProfile).toHaveBeenCalledWith(
      'business-1', 'project-1', expect.objectContaining({ logoUrl: 'https://assets.example.test/logo.png' }),
    ));
  });
});
