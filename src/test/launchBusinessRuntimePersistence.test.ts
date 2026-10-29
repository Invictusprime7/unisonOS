import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBuilderPage, createEmptyPageRegistry } from '@/types/pageRegistry';
import { createEmptyCreatorData } from '@/types/creatorData';
import type { SiteBundleSnapshot } from '@/platform/core/canonicalPipeline';
import { planSectionDataBindings } from '@/services/autoEmitSectionBindings';
import { CATALOG_SURFACES } from '@/platform/core/catalogSurfaceRegistry';
import { draftRowToTemplate } from '@/hooks/useTemplateFiles';
import {
  buildPublishedRuntimeConfig,
  buildPublishedRuntimeModule,
  buildGeneratedSiteRuntimeManifestModule,
  GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH,
  PUBLISHED_RUNTIME_MODULE_PATH,
  upsertCanonicalMetadataFiles,
} from '@/services/canonicalLaunchVfs';
import { CATALOG_HYDRATION_MODULE } from '@/sections/catalogHydrationModule';
import { BUSINESS_PROFILE_HYDRATION_MODULE } from '@/sections/businessProfileHydrationModule';
import { FORM_RUNTIME_MODULE } from '@/sections/formRuntimeModule';
import { PUBLISHED_ACTION_RUNTIME_MODULE } from '@/sections/publishedActionRuntimeModule';
import { planLaunchFormDefinitions } from '@/services/launchFormDefinitions';
import { evaluatePublishedRuntimeReadiness } from '@/services/publishedRuntimeReadiness';
import { createCanonicalComponentInstance } from '@/services/canonicalComponentRegistry';
import { resolveComponentRuntimeContract } from '@/services/componentRuntimeContract';
import { compileGeneratedSiteRuntimeManifest } from '@/services/generatedSiteRuntimeManifest';
import { getIntentDef } from '@/platform/core/intentSurfaceRegistry';
import { buildSiteSetupPlan } from '@/services/siteSetupPlan';

function createSnapshot(): SiteBundleSnapshot {
  const pageRegistry = createEmptyPageRegistry();
  const home = createBuilderPage('home', 'Home', '/', 'home', {
    isHome: true,
    filePath: '/src/pages/Home.tsx',
  });
  (home as unknown as { sectionTypes: string[] }).sectionTypes = [
    'Hero',
    'ServiceGrid',
    'ProductGrid',
  ];
  pageRegistry.pages[home.pageId] = home;
  pageRegistry.homePageId = home.pageId;

  return {
    snapshotId: 'snapshot-1',
    businessName: 'Northstar Studio',
    industry: 'agency',
    pageRegistry,
    vfsFiles: { '/src/App.tsx': 'export default function App() { return null; }' },
    routerFile: { path: '/src/App.tsx', content: '' },
    manifest: {
      routes: [{ path: '/', pageId: home.pageId, isHome: true }],
      nav: [],
      layout: { header: 'default', footer: 'default' },
      metadata: { title: 'Northstar Studio', description: '' },
    },
    bindings: {},
    calendars: {},
    popups: {},
    creatorData: createEmptyCreatorData('Northstar Studio'),
    componentInstances: {},
    routes: ['/'],
    homeRoute: '/',
    createdAt: '2026-07-28T12:00:00.000Z',
    meta: {
      source: 'wizard',
      systemId: 'agency',
      industry: 'agency',
      verticalContractId: 'agency',
    },
  };
}

describe('launch business runtime persistence', () => {
  it('always includes Owner Information as the first core launch setup step', () => {
    for (const input of [{}, { systemType: 'booking' }, { systemType: 'store', capabilities: ['commerce'] }]) {
      const plan = buildSiteSetupPlan(input);
      expect(plan[0]).toMatchObject({
        id: 'owner_information',
        title: 'Owner Information',
        category: 'core',
      });
    }
  });

  it('emits a public standalone runtime contract without credentials', () => {
    const runtime = buildPublishedRuntimeConfig({
      siteId: 'site-1',
      businessId: 'business-1',
      projectId: 'project-1',
      siteBundleSnapshot: createSnapshot(),
    });

    expect(runtime).toMatchObject({
      version: '1.0',
      runtimeVersion: '1.0',
      siteId: 'site-1',
      businessId: 'business-1',
      projectId: 'project-1',
      snapshotId: 'snapshot-1',
    });
    expect(runtime.formEndpoint).not.toMatch(/service_role|anon_key|publishable_key|eyJ[a-zA-Z0-9_-]+/i);
    expect(runtime.runtimeEndpoint).toContain('/functions/v1/site-runtime');
    expect(JSON.stringify(runtime)).not.toMatch(/service_role|anon_key|publishable_key|eyJ[a-zA-Z0-9_-]+/i);
  });

  it('blocks a launch when required public runtime endpoints are absent', () => {
    const runtime = buildPublishedRuntimeConfig({
      siteId: 'site-1',
      businessId: 'business-1',
      projectId: 'project-1',
      siteBundleSnapshot: createSnapshot(),
    });

    expect(evaluatePublishedRuntimeReadiness({
      runtime,
      bindingCount: 1,
      formDefinitionCount: 1,
    })).toMatchObject({ ok: true });
    expect(evaluatePublishedRuntimeReadiness({
      runtime: { ...runtime, endpoint: null },
      bindingCount: 1,
      formDefinitionCount: 0,
    })).toMatchObject({
      ok: false,
      blockers: ['Published profile/catalog runtime endpoint is unavailable.'],
    });
  });

  it('persists the public runtime contract into canonical VFS metadata', () => {
    const files = upsertCanonicalMetadataFiles({}, {
      appContext: {} as never,
      runtimeManifest: {} as never,
      generatedSiteRuntimeManifest: compileGeneratedSiteRuntimeManifest({
        siteId: 'site-1',
        snapshot: createSnapshot(),
        generatedAt: '2026-07-30T00:00:00.000Z',
      }),
      publishedRuntime: buildPublishedRuntimeConfig({
        siteId: 'site-1',
        businessId: 'business-1',
        projectId: 'project-1',
        siteBundleSnapshot: createSnapshot(),
      }),
    });

    expect(JSON.parse(files['/.unison/published-runtime.json'])).toMatchObject({
      siteId: 'site-1',
      snapshotId: 'snapshot-1',
    });
    expect(JSON.parse(files['/.unison/generated-site-runtime.json'])).toMatchObject({
      siteId: 'site-1',
      snapshotId: 'snapshot-1',
      version: '1.0',
    });
    expect(buildPublishedRuntimeModule(buildPublishedRuntimeConfig({
      siteId: 'site-1',
      businessId: 'business-1',
      projectId: 'project-1',
      siteBundleSnapshot: createSnapshot(),
    }))).toContain('PUBLISHED_RUNTIME_CONFIG');
    expect(PUBLISHED_RUNTIME_MODULE_PATH).toBe('/src/unison/publishedRuntime.ts');
    expect(buildGeneratedSiteRuntimeManifestModule(compileGeneratedSiteRuntimeManifest({
      siteId: 'site-1',
      snapshot: createSnapshot(),
      generatedAt: '2026-07-30T00:00:00.000Z',
    }))).toContain('GENERATED_SITE_RUNTIME_MANIFEST');
    expect(GENERATED_SITE_RUNTIME_MANIFEST_MODULE_PATH).toBe('/src/unison/generatedSiteRuntimeManifest.ts');
  });

  it('keeps Builder hydration while adding the standalone public runtime path', () => {
    expect(CATALOG_HYDRATION_MODULE).toContain('CATALOG_HYDRATE_REQUEST');
    expect(CATALOG_HYDRATION_MODULE).toContain("from '@/unison/publishedRuntime'");
    // Published live reads target the public read gateway (site-runtime-read)
    // with its flat body contract — never the action runtime's operation shape.
    expect(CATALOG_HYDRATION_MODULE).toContain("type: 'catalog'");
    expect(CATALOG_HYDRATION_MODULE).toContain('fetch(runtime.endpoint');
    expect(CATALOG_HYDRATION_MODULE).not.toContain("operation: 'read'");
    expect(CATALOG_HYDRATION_MODULE).toContain('PUBLISHED_CATALOG_REVALIDATE_MS = 60_000');
    expect(CATALOG_HYDRATION_MODULE).toContain("document.addEventListener('visibilitychange', onVisibilityChange)");
    expect(CATALOG_HYDRATION_MODULE).toContain('refreshPublishedCatalog(false)');
    expect(BUSINESS_PROFILE_HYDRATION_MODULE).toContain('BUSINESS_PROFILE_REQUEST');
    expect(BUSINESS_PROFILE_HYDRATION_MODULE).toContain("type: 'profile'");
    expect(BUSINESS_PROFILE_HYDRATION_MODULE).toContain('fetch(runtime.endpoint');
  });

  it('captures only generated standalone forms through the public submit endpoint', () => {
    expect(FORM_RUNTIME_MODULE).toContain("form.dataset.demoForm !== 'true'");
    expect(FORM_RUNTIME_MODULE).toContain("fetch(runtime.formEndpoint");
    expect(FORM_RUNTIME_MODULE).toContain("window.parent !== window");
    expect(FORM_RUNTIME_MODULE).toContain("'Content-Type': 'application/json'");
  });

  it('dispatches manifest-authorized backend actions through the published Supabase runtime', () => {
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("'contact.submit': ['contact.submit']");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("'quote.request': ['quote.request', 'contact.submit']");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("form.scrollIntoView");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('GENERATED_SITE_RUNTIME_MANIFEST');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('runtime.controllerEndpoints[controller.functionName]');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("controller.transport !== 'supabase-function'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('fetch(endpoint');
  });

  it('reports actual booking notification delivery rather than claiming an email was sent', () => {
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("customerStatus === 'sent'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("ownerStatus === 'not_configured'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('the confirmation email could not be sent');
  });

  it('derives booking component reads, writes, and slot requirements from the canonical registry', () => {
    const instance = createCanonicalComponentInstance('booking-scheduler', {
      bindings: {
        calendarId: 'calendar-1',
        sectionType: 'hero',
        sectionInstanceId: 'home-hero',
        variantId: 'hero:split-image',
      },
    });
    expect(instance).not.toBeNull();

    expect(resolveComponentRuntimeContract(instance!, ['booking'])).toMatchObject({
      status: 'ready',
      catalogSurfaces: ['services', 'availability_slots'],
      writeIntent: 'booking.create',
      slotBindings: ['form-submit', 'primary-cta', 'card-cta'],
    });
    expect(resolveComponentRuntimeContract(instance!, [])).toMatchObject({
      status: 'blocked',
      blockers: ['Missing required capability: booking.'],
    });
  });

  it('compiles a page-less booking component into a transport-agnostic runtime contract', () => {
    const snapshot = createSnapshot();
    const instance = createCanonicalComponentInstance('booking-scheduler', {
      bindings: {
        calendarId: 'calendar-1',
        sectionType: 'hero',
        sectionInstanceId: 'home-hero',
        variantId: 'hero:split-image',
      },
    });
    expect(instance).not.toBeNull();
    snapshot.componentInstances[instance!.instanceId] = instance!;

    const manifest = compileGeneratedSiteRuntimeManifest({
      siteId: 'site-1',
      snapshot,
      enabledCapabilities: ['booking'],
      generatedAt: '2026-07-30T00:00:00.000Z',
    });

    expect(manifest).toMatchObject({
      version: '1.0',
      siteId: 'site-1',
      snapshotId: 'snapshot-1',
      reads: ['availability_slots', 'services'],
      readiness: { status: 'ready' },
    });
    expect(manifest.components[0]).toMatchObject({
      instanceId: instance!.instanceId,
      pageLess: true,
      writeIntent: 'booking.create',
      slots: expect.arrayContaining([
        expect.objectContaining({
          slotId: `${instance!.instanceId}:primary-cta`,
          slot: 'primary-cta',
          section: 'hero',
          sectionInstanceId: 'home-hero',
          variantId: 'hero:split-image',
          intent: 'booking.create',
          status: 'ready',
        }),
      ]),
    });
    expect(manifest.intents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        intent: 'booking.create',
        handler: 'site-runtime',
        componentIds: [instance!.instanceId],
      }),
    ]));
    expect(manifest.controllers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        handler: 'site-runtime',
        functionName: 'site-runtime',
        intents: ['booking.create'],
        requiredCapabilities: ['booking'],
      }),
    ]));
    expect(manifest.controllers.find((controller) => controller.intents.includes('booking.create')))
      .not.toMatchObject({ functionName: expect.stringMatching(/intent-(?:exec|router|booking)/) });
    expect(manifest.agents).toEqual([{
      agentSlug: 'booking_agent',
      intents: ['booking.create'],
      allowedTools: ['calendar.check', 'calendar.book'],
      requiredCapabilities: ['booking'],
    }]);
    expect(manifest.requiredBackendFunctions).toContain('site-runtime');
  });

  it('does not provision an agent binding without a generated Booking intent', () => {
    const manifest = compileGeneratedSiteRuntimeManifest({
      siteId: 'site-1',
      snapshot: createSnapshot(),
      enabledCapabilities: ['booking'],
      generatedAt: '2026-07-30T00:00:00.000Z',
    });

    expect(manifest.agents).toEqual([]);
  });

  it('reconciles Builder revisions through the compiler-produced runtime contract', () => {
    const commitService = readFileSync(
      resolve(process.cwd(), 'src/services/vfsCommitService.ts'),
      'utf8',
    );
    const reconciler = readFileSync(
      resolve(process.cwd(), 'supabase/functions/reconcile-generated-runtime/index.ts'),
      'utf8',
    );
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');

    expect(commitService).toContain("files['/.unison/wizard-seed.json']");
    expect(commitService).toContain('seed.canonical?.capabilities');
    expect(commitService).toContain('buildCanonicalLaunchArtifacts({');
    expect(commitService).not.toContain('compileGeneratedSiteRuntimeManifest({');
    expect(commitService).toContain("supabase.functions.invoke('reconcile-generated-runtime'");
    expect(commitService).toContain("status = 'rejected'");
    expect(commitService).toContain("code: 'generated-runtime-reconciliation-failed'");
    expect(reconciler).toContain('UPDATE public.site_runtime_configs');
    expect(reconciler).toContain("placement_key LIKE 'runtime:%'");
    expect(reconciler).toContain('INSERT INTO public.ai_plugin_instances');
    expect(reconciler).toContain("await pg.queryArray('BEGIN')");
    expect(reconciler).toContain("await pg.queryArray('COMMIT')");
    expect(config).toMatch(/\[functions\.reconcile-generated-runtime\]\r?\nverify_jwt = true/);
  });

  it('declares the site runtime as the sole canonical booking.create handler', () => {
    expect(getIntentDef('booking.create')).toMatchObject({
      handler: 'site-runtime',
      requiredCapabilities: ['booking'],
    });
  });

  it('routes booking notifications through site setup or the private business email', () => {
    const runtime = readFileSync(resolve(process.cwd(), 'supabase/functions/site-runtime/index.ts'), 'utf8');
    const resolver = runtime.slice(
      runtime.indexOf('async function configuredBookingOwnerEmail'),
      runtime.indexOf('function emailStatus'),
    );

    expect(resolver).toContain(".from('site_setup_steps')");
    expect(resolver).toContain(".from('businesses')");
    expect(resolver).toContain(".select('notification_email')");
    expect(resolver).toContain('config?.emailNewBooking === false');
  });

  it('does not generate new booking bindings to legacy executors', () => {
    const legacyBinding = /booking\.create[^\n]*(?:intent-exec|intent-router|intent-booking)|(?:intent-exec|intent-router|intent-booking)[^\n]*booking\.create/;
    const builderActions = readFileSync(
      resolve(process.cwd(), 'supabase/functions/builder-actions/index.ts'),
      'utf8',
    );
    const systemsCompile = readFileSync(
      resolve(process.cwd(), 'supabase/functions/systems-compile/index.ts'),
      'utf8',
    );

    expect(builderActions).not.toMatch(legacyBinding);
    expect(systemsCompile).not.toMatch(legacyBinding);
  });

  it('shuts down every legacy Booking execution path', () => {
    const intentExec = readFileSync(resolve(process.cwd(), 'supabase/functions/intent-exec/index.ts'), 'utf8');
    const intentRouter = readFileSync(resolve(process.cwd(), 'supabase/functions/intent-router/index.ts'), 'utf8');
    const intentRouterLite = readFileSync(resolve(process.cwd(), 'supabase/functions/intent-router-lite/index.ts'), 'utf8');
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');

    expect(intentExec).not.toContain('intentId === "booking.create"');
    expect(intentExec).not.toContain('handleBookingCreate');
    expect(intentExec).not.toContain('"intent-booking"');
    expect(intentRouter).not.toContain('case "booking.create"');
    expect(intentRouterLite).not.toContain('BOOKING_INTENTS');
    expect(intentRouterLite).not.toContain('forwardToFunction("intent-booking"');
    expect(config).not.toContain('[functions.intent-booking]');
    expect(existsSync(resolve(process.cwd(), 'supabase/functions/intent-booking/index.ts'))).toBe(false);
  });

  it('does not let the legacy React runtime bypass the canonical Booking gateway', () => {
    const runtimeProvider = readFileSync(
      resolve(process.cwd(), 'src/runtime/TemplateRuntimeProvider.tsx'),
      'utf8',
    );
    const bookingManager = runtimeProvider.slice(
      runtimeProvider.indexOf('function createBookingManagerWired'),
      runtimeProvider.indexOf('function createBookingManagerWired') + 4_000,
    );

    expect(bookingManager).not.toContain("invokeRuntimeCanonicalIntent(config, 'booking.create'");
    expect(bookingManager).not.toContain(".from('bookings')");
    expect(bookingManager).toContain('Booking writes require the generated site-runtime adapter.');
  });

  it('removes unreferenced public and preview-only Booking writers', () => {
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');
    const templateAutomation = readFileSync(
      resolve(process.cwd(), 'supabase/functions/template-automation/index.ts'),
      'utf8',
    );
    const functionalBlocks = readFileSync(
      resolve(process.cwd(), 'src/components/creatives/web-builder/functional-blocks/index.ts'),
      'utf8',
    );

    expect(functionalBlocks).not.toContain('IntentBookingForm');
    expect(existsSync(resolve(
      process.cwd(),
      'src/components/creatives/web-builder/functional-blocks/IntentBookingForm.tsx',
    ))).toBe(false);
    expect(config).not.toContain('[functions.create-booking]');
    expect(existsSync(resolve(process.cwd(), 'supabase/functions/create-booking/index.ts'))).toBe(false);
    expect(templateAutomation).not.toContain("case 'createBooking'");
    expect(templateAutomation).not.toContain("case 'getAvailableSlots'");
    expect(functionalBlocks).not.toContain("export { BookingWidget }");
    expect(existsSync(resolve(
      process.cwd(),
      'src/components/creatives/web-builder/functional-blocks/BookingWidget.tsx',
    ))).toBe(false);
  });

  it('keeps the private canonical operation as the only Booking transaction writer', () => {
    const forbiddenWriters = [
      'supabase/functions/agent-runner/index.ts',
      'supabase/functions/intent-router/index.ts',
      'src/lib/crm-managers.ts',
      'src/runtime/TemplateRuntimeProvider.tsx',
      'supabase/functions/template-automation/index.ts',
    ];

    for (const file of forbiddenWriters) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/\.from\(["']bookings["']\)[\s\S]{0,500}?\.(?:insert|update|upsert|delete)\(/);
      expect(source, file).not.toMatch(/\.from\(["']availability_slots["']\)[\s\S]{0,500}?\.update\(\{\s*is_booked:/);
    }

    const agentRunner = readFileSync(
      resolve(process.cwd(), 'supabase/functions/agent-runner/index.ts'),
      'utf8',
    );
    const siteRuntime = readFileSync(
      resolve(process.cwd(), 'supabase/functions/site-runtime/index.ts'),
      'utf8',
    );
    const sharedBookingAdapter = readFileSync(
      resolve(process.cwd(), 'supabase/functions/_shared/canonicalBooking.ts'),
      'utf8',
    );
    const bookingMigration = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8'))
      .find((source) => source.includes('private.create_atomic_booking'));

    expect(bookingMigration).toContain('CREATE OR REPLACE FUNCTION private.create_atomic_booking');
    expect(bookingMigration).toContain('FOR UPDATE');
    expect(bookingMigration).toContain('pg_advisory_xact_lock');
    expect(bookingMigration).toContain('REVOKE ALL ON FUNCTION private.create_atomic_booking');
    expect(sharedBookingAdapter).toContain('private.create_atomic_booking');
    expect(siteRuntime).toContain('createCanonicalBooking({');
    expect(siteRuntime).not.toContain('INSERT INTO public.bookings');
    expect(agentRunner).toContain("'calendar.book': calendarBook");
    expect(agentRunner).toContain('createCanonicalBooking({');
    expect(agentRunner).toContain(".from('ai_plugin_instances')");
    expect(agentRunner).toContain(".from('projects')");
    expect(agentRunner).toContain(".from('site_runtime_configs')");
    expect(agentRunner).toContain('settings?.generatedSiteRuntimeManifest');
    expect(agentRunner).toContain("manifest?.readiness?.status !== 'ready'");
    expect(agentRunner).toContain('manifest.agents.find');
    expect(agentRunner).toContain("registryAgent.id !== instance.agent_id");
    expect(agentRunner).toContain('agentSlug = authorization.agentSlug');
    expect(agentRunner).toContain('allowedTools.filter((tool) => registryTools.includes(tool))');
    expect(agentRunner).toContain('idempotencyKey: `agent:${context.eventId}`');
    expect(agentRunner).toContain("event.intent === 'booking.create'");
    expect(agentRunner).toContain(".from('availability_slots')");
    expect(agentRunner).toContain("status: 'failed'");
    expect(agentRunner).toContain("? { ...(event.payload || {}), ...toolCall.payload }");
  });

  it('submits generated booking forms through the site runtime with stable visitor context', () => {
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("form[data-intent-form=\"booking.create\"]");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("operation: 'action'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('runtimeVersion: runtime.runtimeVersion');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('idempotencyKey');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('sessionId');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('new FormData(form)');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('runtime.runtimeEndpoint');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("read: { type: 'booking', sessionId: createSessionId() }");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("form.elements.namedItem('serviceId')");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("form.elements.namedItem('slotId')");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("window.dispatchEvent(new CustomEvent('unison:booking.updated'");
  });

  it('settles booking selectors on missing runtime, read failure, or empty service/availability results', () => {
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("markUnavailable('Booking unavailable'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("'No services available'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain("'No availability available'");
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('Booking is not configured yet: no services are available.');
    expect(PUBLISHED_ACTION_RUNTIME_MODULE).toContain('Booking is not available yet: no appointment times are available.');
  });

  it('provisions only stable approved definitions for generated forms', () => {
    const definitions = planLaunchFormDefinitions({
      vfsFiles: { '/src/components/Contact.tsx': '<form data-demo-form="true" />' },
    });

    expect(definitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalId: 'contact.submit', intent: 'contact.submit' }),
      expect.objectContaining({ externalId: 'newsletter.subscribe', intent: 'newsletter.subscribe' }),
    ]));
    expect(planLaunchFormDefinitions({ vfsFiles: {} })).toEqual([]);
  });

  it('allows every canonical catalog source in the confirmed launch endpoint', () => {
    const endpoint = readFileSync(
      resolve(process.cwd(), 'supabase/functions/provision-launch-site/index.ts'),
      'utf8',
    );
    const sourceTables = new Set(
      Object.values(CATALOG_SURFACES).map((surface) => surface.sourceTable),
    );

    for (const sourceTable of sourceTables) {
      expect(endpoint).toContain(`'${sourceTable}'`);
    }
  });

  it('requires a provisioned form definition before accepting public submissions', () => {
    const formSubmit = readFileSync(resolve(process.cwd(), 'supabase/functions/form-submit/index.ts'), 'utf8');
    const persistence = readFileSync(resolve(process.cwd(), 'src/services/launchFormDefinitionPersistence.ts'), 'utf8');

    // form-submit is the enforcement point for approved definitions.
    expect(formSubmit).toContain('.from("form_definitions")');
    expect(formSubmit).toContain('.eq("external_id", formId)');
    expect(formSubmit).toContain('Form intent does not match its approved definition');
    expect(formSubmit).toContain('Missing required form fields');

    // Confirmed-launch provisioning owns identity only; the commit path writes
    // the site-scoped form contracts.
    expect(persistence).toContain("from('form_definitions')");
    expect(persistence).toContain("onConflict: 'business_id,project_id,site_id,external_id'");
    expect(persistence).toContain('persistLaunchFormDefinitions');
  });

  it('persists only a site-bound compiled runtime manifest with the confirmed launch', () => {
    const reconciler = readFileSync(resolve(process.cwd(), 'supabase/functions/reconcile-generated-runtime/index.ts'), 'utf8');
    const provisioner = readFileSync(resolve(process.cwd(), 'supabase/functions/provision-launch-site/index.ts'), 'utf8');
    const commitService = readFileSync(resolve(process.cwd(), 'src/services/vfsCommitService.ts'), 'utf8');

    // Manifest persistence is site-bound and transactional.
    expect(reconciler).toContain("'{generatedSiteRuntimeManifest}'");
    expect(reconciler).toContain('RUNTIME_SITE_IDENTITY_MISMATCH');
    expect(reconciler).toContain("project.site_id !== body.manifest.siteId");
    expect(reconciler).toContain('INSERT INTO public.ai_plugin_instances');
    expect(reconciler).toContain('RUNTIME_AGENT_UNAVAILABLE');
    expect(reconciler).toContain('compiledIntents.includes(intent)');
    expect(reconciler).toContain('enabledCapabilities.includes(capability)');

    expect(commitService).toContain("supabase.functions.invoke('reconcile-generated-runtime'");
    expect(commitService).toContain('Canonical finalization did not provide a generated runtime manifest.');
    expect(commitService).toContain('const manifest = input.manifest;');
    expect(commitService).toContain('manifest.siteId !== project.site_id');

    // Provisioning still validates the runtime controller contract shape.
    expect(provisioner).toContain("PUBLIC_RUNTIME_FUNCTIONS = new Set(['site-runtime', 'intent-exec', 'create-order-checkout'])");
    expect(provisioner).toContain('manifest.controllers.find((candidate) =>');
    expect(provisioner).toContain('has no matching controller');
    expect(provisioner).toContain('references uncompiled intent');
    expect(provisioner).toContain('requires disabled capability');
  });

  it('keeps published catalog reads site-scoped and source-whitelisted', () => {
    const endpoint = readFileSync(
      resolve(process.cwd(), 'supabase/functions/site-runtime-read/index.ts'),
      'utf8',
    );

    expect(endpoint).toContain('eq("site_id", siteId)');
    expect(endpoint).toContain('public_runtime_enabled');
    expect(endpoint).toContain('Site runtime is unavailable');
    expect(endpoint).toContain('const surface = SURFACES[String(binding.source_table)]');
    expect(endpoint).toContain('findSurface(sectionType)');
    expect(endpoint).toContain('catalog_collections');
    expect(endpoint).toContain('isSurfaceEnabled(supabase, body.siteId, surface)');
    expect(endpoint).toContain('requiredCapability');
    expect(endpoint).not.toContain('body.businessId');
    expect(endpoint).not.toContain('body.projectId');
  });

  it('registers the guarded runtime reader as a public function', () => {
    const config = readFileSync(resolve(process.cwd(), 'supabase/config.toml'), 'utf8');

    expect(config).toMatch(/\[functions\.site-runtime-read\]\r?\nverify_jwt = false/);
    expect(config).toMatch(/\[functions\.site-runtime\]\r?\nverify_jwt = false/);
  });

  it('routes standalone reads through the persisted manifest dispatcher and atomically authorizes booking writes', () => {
    const dispatcher = readFileSync(resolve(process.cwd(), 'supabase/functions/site-runtime/index.ts'), 'utf8');
    const canonicalOperation = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
      .filter((file) => file.endsWith('.sql'))
      .map((file) => readFileSync(resolve(process.cwd(), 'supabase/migrations', file), 'utf8'))
      .find((source) => source.includes('private.create_atomic_booking')) || '';

    expect(dispatcher).toContain('generatedSiteRuntimeManifest');
    expect(dispatcher).toContain('body.runtimeVersion !== context.manifest.version');
    expect(dispatcher).toContain('body.operation === "bootstrap"');
    expect(dispatcher).toContain('body.operation === "action"');
    expect(dispatcher).toContain('isBookingActionAuthorized');
    expect(dispatcher).toContain('bookingCapabilityIsEnabled');
    expect(dispatcher).toContain('createCanonicalBooking({');
    expect(canonicalOperation).toContain('FOR UPDATE');
    expect(canonicalOperation).toContain('SET is_booked = true');
    expect(canonicalOperation).toContain('INSERT INTO public.bookings');
    expect(canonicalOperation).toContain('booking.idempotency_key = p_idempotency_key');
    expect(canonicalOperation).toContain('pg_advisory_xact_lock');
    expect(canonicalOperation).toContain('availability_slot_id');
    expect(canonicalOperation).toContain('p_session_id');
    expect(dispatcher).toContain('{ success: true, state }');
    expect(dispatcher).toContain('loadBookingState');
    expect(dispatcher).toContain('read?.type === "booking"');
    expect(dispatcher).toContain('.eq("session_id", sessionId)');
    expect(dispatcher).toContain('This runtime action is not configured for the site');
    expect(dispatcher).toContain('/functions/v1/site-runtime-read');
  });

  it('plans only registry-backed live data surfaces with stable snapshot identity', () => {
    const bindings = planSectionDataBindings(createSnapshot());

    expect(bindings).toHaveLength(2);
    expect(bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        snapshotId: 'snapshot-1',
        sectionId: 'ServiceGrid-1',
        sourceKind: 'service',
        sourceTable: 'services',
      }),
      expect.objectContaining({
        snapshotId: 'snapshot-1',
        sectionId: 'ProductGrid-2',
        sourceKind: 'product',
        sourceTable: 'products',
      }),
    ]));
  });

  it('blocks a component whose visual variant conflicts with its semantic section role', () => {
    const snapshot = createSnapshot();
    const instance = createCanonicalComponentInstance('booking-scheduler', {
      bindings: {
        calendarId: 'calendar-1',
        sectionType: 'hero',
        sectionInstanceId: 'home-hero',
        variantId: 'footer:dark-band',
      },
    });
    snapshot.componentInstances[instance!.instanceId] = instance!;

    const manifest = compileGeneratedSiteRuntimeManifest({
      snapshot,
      enabledCapabilities: ['booking'],
    });

    expect(manifest.readiness.status).toBe('blocked');
    expect(manifest.components[0].blockers).toContain(
      'Component variant footer:dark-band does not match section: hero.',
    );
  });

  it('restores runtime metadata and confirmed identities from a durable draft row', () => {
    const runtimeManifest = {
      entryPoint: '/src/App.tsx',
      appContext: { businessRuntime: { version: '1.0', businessId: 'business-1' } },
    };
    const template = draftRowToTemplate({
      id: 'draft-1',
      business_id: 'business-1',
      project_id: 'project-1',
      site_id: 'site-1',
      code: '',
      editor_code: '',
      vfs_files: { '/src/App.tsx': 'export default function App() { return null; }' },
      metadata: {
        name: 'Northstar Studio',
        runtimeManifest,
        businessRuntime: runtimeManifest.appContext.businessRuntime,
      },
      created_at: '2026-07-28T12:00:00.000Z',
      updated_at: '2026-07-28T13:00:00.000Z',
    });

    expect(template.canvas_data).toMatchObject({
      businessId: 'business-1',
      projectId: 'project-1',
      draftId: 'draft-1',
      siteId: 'site-1',
      runtimeManifest,
      businessRuntime: { version: '1.0', businessId: 'business-1' },
    });
  });
});