import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_PRESETS } from '@/components/onboarding/themePresets';
import { themePresetToThemeTokens } from '@/components/onboarding/themePresetToTokens';
import { buildCanonicalLaunchPlan } from '@/services/launch/canonicalLaunchPlan';
import { commitToPipeline } from '@/platform/core/commitToPipeline';
import type { WizardSelections } from '@/types/playground';

const preset = THEME_PRESETS.find((item) => item.id === 'editorial')!;
const selections: WizardSelections = {
  businessName: 'Northstar Studio',
  businessModel: 'appointment_service',
  industryOverlay: 'salon',
  systemType: 'booking',
  primaryGoal: 'book',
  secondaryGoals: ['build_trust'],
  needsBooking: true,
  wantsLeadCapture: true,
  sellsProducts: false,
  primaryIntent: 'booking.create',
  requestedPages: ['home', 'contact'],
  scaffoldMode: 'selected-pages',
  templateId: 'salon-premium',
  themePresetId: preset.id,
  themeTokens: themePresetToThemeTokens(preset),
  wizardSeedId: 'plan-only-test',
  businessId: 'business-1',
};

describe('canonical launch plan', () => {
  it('resolves complete launch contracts and protected infrastructure without page bodies', () => {
    const plan = buildCanonicalLaunchPlan(selections, {
      '/.unison/wizard-seed.json': JSON.stringify({ id: 'plan-only-test' }),
    });
    const paths = Object.keys(plan.infrastructureFiles);

    expect(plan.version).toBe('unison-canonical-launch-plan/1');
    expect(plan.sitePlan.pages.map((page) => page.role)).toEqual(['home', 'contact']);
    expect(Object.keys(plan.playground.pageRegistry.pages)).toHaveLength(2);
    expect(plan.artDirection.storagePackId).toBe(plan.designIntervention.artDirectionPackId);
    expect(plan.registryContext.artDirectionPackId).toBe(plan.designIntervention.artDirectionPackId);
    expect(plan.uiFoundationContract.manifestPath).toBe('/.unison/ui-manifest.json');
    expect(plan.infrastructureFiles['/src/App.tsx']).toContain('/src/pages/Home.tsx'.replace('/src', '.'));
    expect(plan.infrastructureFiles['/src/main.tsx']).toContain("import App from './App'");
    expect(plan.infrastructureFiles['/src/index.css']).toContain('--primary');
    expect(plan.infrastructureFiles['/.unison/wizard-registry-context.json']).toBeTruthy();
    expect(paths.some((path) => path.startsWith('/src/pages/'))).toBe(false);
  });

  it('shares contract resolution with the compatibility full compiler', () => {
    const plan = buildCanonicalLaunchPlan(selections);
    const compiled = commitToPipeline({ selections }, 'wizard-launch');

    expect(compiled.sitePlan?.pages.map((page) => page.role)).toEqual(plan.sitePlan.pages.map((page) => page.role));
    expect(compiled.siteBundleSnapshot.meta.artDirection?.storagePackId).toBe(plan.artDirection.storagePackId);
    expect(compiled.siteBundleSnapshot.meta.registryContext?.designRegistrySignature).toBe(plan.registryContext.designRegistrySignature);
    expect(compiled.siteBundleSnapshot.vfsFiles['/.unison/wizard-registry-context.json']).toBeTruthy();
  });

  it('projects Wizard business parameters and binds booking intake to the registered scheduler', () => {
    const plan = buildCanonicalLaunchPlan({
      ...selections,
      nativePublishReady: true,
      ownerEmail: 'owner@northstar.test',
      publishMode: 'native-first-party',
      businessParameters: {
        ownerEmail: 'owner@northstar.test',
        notificationEmail: 'owner@northstar.test',
        publicEmail: 'hello@northstar.test',
        phone: '+1 555 0100',
        tagline: 'Care by design',
        description: 'A neighborhood salon for every day.',
        website: 'https://northstar.test',
        logoUrl: 'https://northstar.test/logo.png',
        brandColor: '#123456',
        timezone: 'America/New_York',
        address: { line1: '10 Main Street', city: 'Brooklyn', region: 'NY', postalCode: '11201', country: 'US' },
        hours: [{ day: 'mon', open: '09:00', close: '17:00' }],
        crmDestination: 'unison_crm',
        ctaDestinations: { call: 'tel:+15550100', email: 'mailto:hello@northstar.test' },
        industry: { bookingType: 'consultation' },
        socialLinks: { instagram: 'https://instagram.com/northstar' },
      },
    });
    const businessInfo = plan.playground.creatorData.businessInfo;
    const bookingForm = Object.values(plan.playground.creatorData.forms).find((form) => form.name === 'Booking Intake');
    const components = Object.values(plan.playground.creatorData.componentInstances);

    expect(businessInfo).toMatchObject({
      email: 'hello@northstar.test',
      phone: '+1 555 0100',
      tagline: 'Care by design',
      description: 'A neighborhood salon for every day.',
      website: 'https://northstar.test',
      logoUrl: 'https://northstar.test/logo.png',
      brandColor: '#123456',
      timezone: 'America/New_York',
      address: '10 Main Street, Brooklyn, NY, 11201, US',
      hours: [{ day: 'mon', open: '09:00', close: '17:00' }],
      notificationEmail: 'owner@northstar.test',
      bookingOwner: 'owner@northstar.test',
      crmDestination: 'unison_crm',
      socialLinks: { instagram: 'https://instagram.com/northstar' },
      customValues: expect.objectContaining({ bookingType: 'consultation' }),
    });
    expect(bookingForm).toBeDefined();
    expect(components.some((component) => component.componentSlug === 'booking-scheduler'
      && component.bindings.formId === bookingForm?.formId
      && component.bindings.calendarId)).toBe(true);
    expect(components.some((component) => component.componentSlug === 'contact-form'
      && component.bindings.formId === bookingForm?.formId)).toBe(false);
  });

  it('emits no fictional package imports or placeholder component barrels', () => {
    const files = buildCanonicalLaunchPlan(selections).infrastructureFiles;
    for (const [path, content] of Object.entries(files)) {
      expect(content, path).not.toContain('@unison/');
    }
    expect(Object.keys(files).filter((path) => /^\/src\/components\/[^/]+\/index\.ts$/.test(path))).toEqual([]);
  });

  it('keeps compilePlayground out of the plan-only implementation', () => {
    const planSource = readFileSync('src/services/launch/canonicalLaunchPlan.ts', 'utf8');
    const compatibilitySource = readFileSync('src/platform/core/canonicalPipeline.ts', 'utf8');

    expect(planSource).not.toContain('compilePlayground(');
    expect(compatibilitySource).toContain('resolveCanonicalLaunchContracts(selections, existingVfsFiles)');
  });
});

