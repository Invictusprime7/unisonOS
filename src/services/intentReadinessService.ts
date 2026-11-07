import type {
  PlaygroundBinding,
  PlaygroundComponentReadiness,
  PlaygroundIntentDependency,
  PlaygroundIntentReadiness,
  PlaygroundIntentReadinessReport,
  PlaygroundReadinessStatus,
  PlaygroundSetupSnapshot,
  PlaygroundState,
  PlaygroundValidation,
} from '@/types/playground';
import type { CreatorBusinessInfo, CreatorComponentInstance } from '@/types/creatorData';
import {
  getCanonicalComponentDefinition,
  inferCanonicalComponentSlug,
} from '@/services/canonicalComponentRegistry';

function mergeStatus(
  current: PlaygroundReadinessStatus,
  next: PlaygroundReadinessStatus,
): PlaygroundReadinessStatus {
  if (current === 'blocked' || next === 'blocked') return 'blocked';
  if (current === 'partial' || next === 'partial') return 'partial';
  return 'ready';
}

function dependencyStatusToReadiness(
  dependencies: PlaygroundIntentDependency[],
  mode: 'preview' | 'publish',
): PlaygroundReadinessStatus {
  return dependencies
    .filter((dependency) => dependency.mode === mode)
    .reduce<PlaygroundReadinessStatus>(
      (status, dependency) => mergeStatus(status, dependency.status),
      'ready',
    );
}

function getTargetSummary(binding: PlaygroundBinding, state: PlaygroundState): string {
  switch (binding.targetType) {
    case 'page':
      return state.pageRegistry.pages[binding.targetId]?.title || binding.targetId;
    case 'form':
      return state.creatorData.forms[binding.targetId]?.name || binding.targetId;
    case 'calendar':
      return state.calendars[binding.targetId]?.name || binding.targetId;
    case 'popup':
      return state.popups[binding.targetId]?.name || binding.targetId;
    case 'product':
      return state.creatorData.products[binding.targetId]?.name || binding.targetId;
    case 'url':
    case 'funnel_step':
    default:
      return binding.targetId;
  }
}

function getRequiredCapabilities(binding: PlaygroundBinding): string[] {
  switch (binding.intent) {
    case 'nav.goto_page':
    case 'funnel.goto_step':
    case 'product.view':
      return ['route_target'];
    case 'form.open':
      return ['form_target', 'notifications'];
    case 'calendar.open':
      return ['calendar_target', 'booking_setup'];
    case 'checkout.start':
      return ['product_target', 'payments'];
    case 'popup.open':
      return ['popup_target'];
    case 'external.open':
      return ['external_target'];
    default:
      return [];
  }
}

function isBlankValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function getSetupStepsMap(setupSnapshot: PlaygroundSetupSnapshot) {
  return new Map((setupSnapshot.setupSteps || []).map((step) => [step.id, step]));
}

function getResolvedBusinessField(
  field: string,
  businessInfo: CreatorBusinessInfo,
  setupSnapshot: PlaygroundSetupSnapshot,
) {
  const setupSteps = getSetupStepsMap(setupSnapshot);
  const notificationStep = setupSteps.get('notifications');
  const paymentStep = setupSteps.get('payments');
  const bookingStep = setupSteps.get('booking_calendar');

  switch (field) {
    case 'notificationEmail':
      return (
        setupSnapshot.notificationEmail ||
        (typeof notificationStep?.config?.notificationEmail === 'string'
          ? notificationStep.config.notificationEmail
          : null) ||
        businessInfo.notificationEmail ||
        businessInfo.email ||
        null
      );
    case 'paymentProvider':
      return (
        businessInfo.paymentProvider ||
        (paymentStep?.config?.paymentProviderConfigured === true ? 'configured' : null) ||
        (paymentStep?.config?.stripeConnected === true ? 'stripe' : null)
      );
    case 'bookingOwner':
      return (
        businessInfo.bookingOwner ||
        (typeof bookingStep?.config?.bookingOwner === 'string'
          ? bookingStep.config.bookingOwner
          : null)
      );
    case 'crmDestination':
      return businessInfo.crmDestination || (setupSteps.get('database') ? 'supabase' : null);
    case 'publishDomain':
      return businessInfo.publishDomain || setupSnapshot.customDomain || null;
    case 'followUpChannel':
      return businessInfo.followUpChannel || null;
    default:
      return (businessInfo as unknown as Record<string, unknown>)[field];
  }
}

function isSetupStepSatisfied(
  stepId: string,
  businessInfo: CreatorBusinessInfo,
  setupSnapshot: PlaygroundSetupSnapshot,
) {
  const setupSteps = getSetupStepsMap(setupSnapshot);
  const step = setupSteps.get(stepId);

  if (!step) return false;
  if (stepId === 'payments') {
    return step.config?.stripeConnected === true || step.config?.paymentProviderConfigured === true;
  }
  if (step.status === 'completed') return true;

  switch (stepId) {
    case 'booking_calendar':
      return Boolean(
        !isBlankValue(businessInfo.bookingOwner) ||
        (
          Array.isArray(step.config?.businessDays) &&
          step.config.businessDays.length > 0 &&
          typeof step.config.opensAt === 'string' &&
          typeof step.config.closesAt === 'string'
        ),
      );
    case 'notifications':
      return !isBlankValue(getResolvedBusinessField('notificationEmail', businessInfo, setupSnapshot));
    default:
      return (step.status as string) === 'completed';
  }
}

function getComponentTargetResolverSection(targetType: CreatorComponentInstance['targetType']) {
  switch (targetType) {
    case 'form':
      return 'forms' as const;
    case 'calendar':
      return 'calendars' as const;
    case 'product':
    case 'checkout':
      return 'products' as const;
    case 'chat':
    default:
      return 'components' as const;
  }
}

function getComponentTargetSummary(
  instance: CreatorComponentInstance,
  state: PlaygroundState,
): string {
  if (instance.targetType === 'form') {
    return state.creatorData.forms[instance.bindings.formId]?.name || instance.bindings.formId || 'unbound form';
  }
  if (instance.targetType === 'calendar') {
    return state.calendars[instance.bindings.calendarId]?.name || instance.bindings.calendarId || 'unbound calendar';
  }
  if (instance.targetType === 'product' || instance.targetType === 'checkout') {
    return state.creatorData.products[instance.bindings.productId]?.name || instance.bindings.productId || 'unbound product';
  }
  return instance.componentSlug || instance.componentType;
}

function buildComponentDependencies(
  instance: CreatorComponentInstance,
  state: PlaygroundState,
  setupSnapshot: PlaygroundSetupSnapshot,
): PlaygroundIntentDependency[] {
  const dependencies: PlaygroundIntentDependency[] = [];
  const slug = instance.componentSlug || inferCanonicalComponentSlug(instance.componentType || '');
  const definition = slug ? getCanonicalComponentDefinition(slug) : null;
  const targetResolverSection = getComponentTargetResolverSection(instance.targetType);

  if (!definition) {
    dependencies.push({
      id: `${instance.instanceId}:unknown-definition`,
      mode: 'preview',
      status: 'partial',
      label: 'Canonical definition',
      message: 'This component exists in the canvas but is not registered in the canonical component graph yet.',
      fixHint: 'Replace it with a canonical component or register its definition before publish.',
      resolverSection: 'components',
    });
  }

  if (!instance.usedOnPages.length) {
    dependencies.push({
      id: `${instance.instanceId}:surface`,
      mode: 'preview',
      status: 'partial',
      label: 'Placement surface',
      message: 'This component is not attached to any page yet.',
      fixHint: 'Attach it to at least one page so the runtime graph has a visible surface.',
      resolverSection: 'components',
    });
  }

  for (const bindingKey of definition?.requiredBindingKeys || []) {
    const targetId = instance.bindings?.[bindingKey];
    if (!targetId) {
      dependencies.push({
        id: `${instance.instanceId}:${bindingKey}`,
        mode: 'preview',
        status: 'blocked',
        label: bindingKey,
        message: `This component is missing its required ${bindingKey} binding.`,
        fixHint: `Bind the component to a ${bindingKey.replace(/Id$/, '')} before previewing or publishing.`,
        resolverSection: 'components',
      });
      continue;
    }

    if (bindingKey === 'formId' && !state.creatorData.forms[targetId]) {
      dependencies.push({
        id: `${instance.instanceId}:${bindingKey}:target`,
        mode: 'preview',
        status: 'blocked',
        label: 'Target form',
        message: `The form bound to this component no longer exists: ${targetId}.`,
        fixHint: 'Reconnect the component to an existing form.',
        resolverSection: targetResolverSection,
      });
    }

    if (bindingKey === 'calendarId' && !state.calendars[targetId]) {
      dependencies.push({
        id: `${instance.instanceId}:${bindingKey}:target`,
        mode: 'preview',
        status: 'blocked',
        label: 'Target calendar',
        message: `The calendar bound to this component no longer exists: ${targetId}.`,
        fixHint: 'Reconnect the component to an existing calendar.',
        resolverSection: targetResolverSection,
      });
    }

    if (bindingKey === 'productId' && !state.creatorData.products[targetId]) {
      dependencies.push({
        id: `${instance.instanceId}:${bindingKey}:target`,
        mode: 'preview',
        status: 'blocked',
        label: 'Target product',
        message: `The product bound to this component no longer exists: ${targetId}.`,
        fixHint: 'Reconnect the component to an existing product.',
        resolverSection: targetResolverSection,
      });
    }
  }

  for (const field of definition?.requiredBusinessFields || []) {
    const resolvedValue = getResolvedBusinessField(field, state.creatorData.businessInfo, setupSnapshot);
    if (!isBlankValue(resolvedValue)) continue;

    const isPartial = field === 'crmDestination';
    dependencies.push({
      id: `${instance.instanceId}:business:${field}`,
      mode: 'publish',
      status: isPartial ? 'partial' : 'blocked',
      label: field,
      message: `Publish readiness is missing the ${field} required by ${instance.label}.`,
      fixHint: `Set ${field} in Business Setup so this component can operate after publish.`,
      resolverSection: 'business',
      resolverField: field as any,
    });
  }

  for (const stepId of definition?.requiredSetupSteps || []) {
    if (isSetupStepSatisfied(stepId, state.creatorData.businessInfo, setupSnapshot)) continue;

    dependencies.push({
      id: `${instance.instanceId}:setup:${stepId}`,
      mode: 'publish',
      status: 'blocked',
      label: stepId,
      message: `${instance.label} is blocked until the ${stepId.replace(/_/g, ' ')} setup is completed.`,
      fixHint: 'Finish the required launch setup before publishing this component.',
      resolverSection: 'launch',
      resolverStepId: stepId,
    });
  }

  return dependencies;
}

function buildStructuralDependencies(
  binding: PlaygroundBinding,
  state: PlaygroundState,
  validations: PlaygroundValidation[],
): PlaygroundIntentDependency[] {
  const dependencies: PlaygroundIntentDependency[] = [];
  const sourcePage = state.pageRegistry.pages[binding.sourcePageId];

  if (!sourcePage) {
    dependencies.push({
      id: `${binding.bindingId}:source-page`,
      mode: 'preview',
      status: 'blocked',
      label: 'Source page',
      message: 'Source page is missing from the page registry.',
      fixHint: 'Recreate or remap the source page before testing this intent.',
      resolverSection: 'pages',
    });
  }

  switch (binding.targetType) {
    case 'page': {
      const targetPage = state.pageRegistry.pages[binding.targetId];
      if (!targetPage) {
        dependencies.push({
          id: `${binding.bindingId}:target-page`,
          mode: 'preview',
          status: 'blocked',
          label: 'Target page',
          message: 'Target page is missing.',
          fixHint: 'Recreate the page or point this intent at an existing page.',
          resolverSection: 'pages',
        });
      } else {
        const routeIssue = validations.find(
          (validation) =>
            validation.scope === 'router' &&
            validation.targetId === binding.targetId &&
            validation.severity !== 'info',
        );

        if (routeIssue) {
          dependencies.push({
            id: `${binding.bindingId}:router`,
            mode: 'preview',
            status: 'blocked',
            label: 'Route registration',
            message: routeIssue.message,
            fixHint: 'Regenerate or repair the route registration before previewing this navigation.',
            resolverSection: 'pages',
          });
        }
      }
      break;
    }
    case 'form': {
      const form = state.creatorData.forms[binding.targetId];
      if (!form) {
        dependencies.push({
          id: `${binding.bindingId}:target-form`,
          mode: 'preview',
          status: 'blocked',
          label: 'Target form',
          message: 'Target form is missing.',
          fixHint: 'Create the form or repoint this intent to an existing form.',
          resolverSection: 'forms',
        });
      } else {
        if (form.fields.length === 0) {
          dependencies.push({
            id: `${binding.bindingId}:form-fields`,
            mode: 'preview',
            status: 'partial',
            label: 'Form fields',
            message: `Form "${form.name}" has no fields.`,
            fixHint: 'Add the fields required to collect submissions.',
            resolverSection: 'forms',
          });
        }
        if (form.redirectPageId && !state.pageRegistry.pages[form.redirectPageId]) {
          dependencies.push({
            id: `${binding.bindingId}:form-redirect`,
            mode: 'publish',
            status: 'partial',
            label: 'Success redirect',
            message: `Form "${form.name}" points to a missing success page.`,
            fixHint: 'Update the redirect target or remove it.',
            resolverSection: 'forms',
          });
        }
      }
      break;
    }
    case 'calendar': {
      const calendar = state.calendars[binding.targetId];
      if (!calendar) {
        dependencies.push({
          id: `${binding.bindingId}:target-calendar`,
          mode: 'preview',
          status: 'blocked',
          label: 'Target calendar',
          message: 'Target calendar is missing.',
          fixHint: 'Create the calendar or repoint this booking intent.',
          resolverSection: 'calendars',
        });
      } else {
        if (calendar.attachedPageIds.length === 0) {
          dependencies.push({
            id: `${binding.bindingId}:calendar-attachment`,
            mode: 'preview',
            status: 'partial',
            label: 'Calendar attachment',
            message: `Calendar "${calendar.name}" is not attached to any page.`,
            fixHint: 'Attach the calendar to a booking surface.',
            resolverSection: 'calendars',
          });
        }
      }
      break;
    }
    case 'popup': {
      const popup = state.popups[binding.targetId];
      if (!popup) {
        dependencies.push({
          id: `${binding.bindingId}:target-popup`,
          mode: 'preview',
          status: 'blocked',
          label: 'Target popup',
          message: 'Target popup is missing.',
          fixHint: 'Create the popup or repoint this trigger.',
          resolverSection: 'popups',
        });
      } else {
        if (popup.contentType === 'form' && popup.contentRefId && !state.creatorData.forms[popup.contentRefId]) {
          dependencies.push({
            id: `${binding.bindingId}:popup-form`,
            mode: 'preview',
            status: 'blocked',
            label: 'Popup content',
            message: `Popup "${popup.name}" references a missing form.`,
            fixHint: 'Reconnect the popup to a valid form.',
            resolverSection: 'popups',
          });
        }
        if (popup.activeOnPageIds.length === 0) {
          dependencies.push({
            id: `${binding.bindingId}:popup-activation`,
            mode: 'publish',
            status: 'partial',
            label: 'Activation surface',
            message: `Popup "${popup.name}" has no active pages configured.`,
            fixHint: 'Choose where the popup can appear after publish.',
            resolverSection: 'popups',
          });
        }
      }
      break;
    }
    case 'product': {
      if (!state.creatorData.products[binding.targetId]) {
        dependencies.push({
          id: `${binding.bindingId}:target-product`,
          mode: 'preview',
          status: 'blocked',
          label: 'Target product',
          message: 'Target product is missing.',
          fixHint: 'Create the product or update the CTA target.',
          resolverSection: 'products',
        });
      }
      break;
    }
    case 'funnel_step': {
      const stepExists = Object.values(state.pageRegistry.funnels).some((funnel) =>
        funnel.steps.some((step) => step.stepId === binding.targetId),
      );
      if (!stepExists) {
        dependencies.push({
          id: `${binding.bindingId}:target-step`,
          mode: 'preview',
          status: 'blocked',
          label: 'Funnel step',
          message: 'Target funnel step is missing.',
          fixHint: 'Repair the funnel graph before testing this intent.',
          resolverSection: 'pages',
        });
      }
      break;
    }
    case 'url': {
      if (!binding.targetId) {
        dependencies.push({
          id: `${binding.bindingId}:target-url`,
          mode: 'preview',
          status: 'blocked',
          label: 'External target',
          message: 'External destination is empty.',
          fixHint: 'Provide a valid URL.',
          resolverSection: 'pages',
        });
      }
      break;
    }
  }

  if (!binding.isValid) {
    dependencies.push({
      id: `${binding.bindingId}:binding-validity`,
      mode: 'preview',
      status: 'partial',
      label: 'Binding validity',
      message: binding.validationMessage || 'Binding needs review.',
      fixHint: 'Inspect the target and source metadata for this binding.',
      resolverSection: 'pages',
    });
  }

  return dependencies;
}

function buildOperationalDependencies(
  binding: PlaygroundBinding,
  state: PlaygroundState,
  setupSnapshot: PlaygroundSetupSnapshot,
): PlaygroundIntentDependency[] {
  const dependencies: PlaygroundIntentDependency[] = [];
  const setupSteps = new Map((setupSnapshot.setupSteps || []).map((step) => [step.id, step]));
  const notificationStep = setupSteps.get('notifications');
  const paymentStep = setupSteps.get('payments');
  const bookingStep = setupSteps.get('booking_calendar');

  const businessInfo = state.creatorData.businessInfo;
  const notificationEmail =
    setupSnapshot.notificationEmail ||
    (typeof notificationStep?.config?.notificationEmail === 'string' ? notificationStep.config.notificationEmail : null) ||
    businessInfo.notificationEmail ||
    null;
  const paymentConnected =
    paymentStep?.config?.paymentProviderConfigured === true ||
    paymentStep?.config?.stripeConnected === true;
  const bookingConfigured =
    bookingStep?.status === 'completed' ||
    (
      Array.isArray(bookingStep?.config?.businessDays) &&
      bookingStep.config.businessDays.length > 0 &&
      typeof bookingStep.config.opensAt === 'string' &&
      typeof bookingStep.config.closesAt === 'string'
    );
  const crmDestination = businessInfo.crmDestination || (setupSteps.get('database') ? 'supabase' : '');

  if (binding.intent === 'form.open') {
    if (!notificationEmail) {
      dependencies.push({
        id: `${binding.bindingId}:notifications`,
        mode: 'publish',
        status: 'blocked',
        label: 'Owner notifications',
        message: 'Publish is blocked because no notification email is configured for form submissions.',
        fixHint: 'Set a notification email in Business Setup so leads have somewhere to go.',
        resolverSection: 'business',
        resolverField: 'notificationEmail',
      });
    }
    if (!crmDestination) {
      dependencies.push({
        id: `${binding.bindingId}:crm`,
        mode: 'publish',
        status: 'partial',
        label: 'CRM destination',
        message: 'This form can collect leads, but no CRM destination is configured yet.',
        fixHint: 'Choose where submissions should land after publish.',
        resolverSection: 'business',
        resolverField: 'crmDestination',
      });
    }
  }

  if (binding.intent === 'calendar.open') {
    if (!bookingConfigured) {
      dependencies.push({
        id: `${binding.bindingId}:booking-setup`,
        mode: 'publish',
        status: 'blocked',
        label: 'Booking availability',
        message: 'Publish is blocked because booking hours and availability are not configured.',
        fixHint: 'Complete the booking setup before publishing this CTA.',
        resolverSection: 'launch',
        resolverStepId: 'booking_calendar',
      });
    }
    if (!notificationEmail) {
      dependencies.push({
        id: `${binding.bindingId}:booking-notifications`,
        mode: 'publish',
        status: 'partial',
        label: 'Booking notifications',
        message: 'Bookings can be created, but no owner notification email is configured yet.',
        fixHint: 'Add a notification email so booking alerts have a destination.',
        resolverSection: 'business',
        resolverField: 'notificationEmail',
      });
    }
  }

  if (binding.intent === 'checkout.start') {
    if (!paymentConnected) {
      dependencies.push({
        id: `${binding.bindingId}:payments`,
        mode: 'publish',
        status: 'blocked',
        label: 'Payment provider',
        message: 'Publish is blocked because Stripe or another payment provider is not connected.',
        fixHint: 'Connect Stripe in launch setup before sending buyers to checkout.',
        resolverSection: 'launch',
        resolverStepId: 'payments',
      });
    }
    if (!businessInfo.paymentProvider) {
      dependencies.push({
        id: `${binding.bindingId}:payment-provider-label`,
        mode: 'publish',
        status: 'partial',
        label: 'Checkout provider label',
        message: 'A payment path exists, but Business Setup does not record the provider in use.',
        fixHint: 'Record the payment provider so readiness stays explicit.',
        resolverSection: 'business',
        resolverField: 'paymentProvider',
      });
    }
  }

  return dependencies;
}

export function buildIntentReadinessReport(
  state: PlaygroundState,
  validations: PlaygroundValidation[],
  setupSnapshot: PlaygroundSetupSnapshot = {},
): PlaygroundIntentReadinessReport {
  const readiness: Record<string, PlaygroundIntentReadiness> = {};
  const componentReadiness: Record<string, PlaygroundComponentReadiness> = {};
  const enrichedBindings: Record<string, PlaygroundBinding> = {};

  for (const binding of Object.values(state.bindings)) {
    const structuralDependencies = buildStructuralDependencies(binding, state, validations);
    const operationalDependencies = buildOperationalDependencies(binding, state, setupSnapshot);
    const dependencies = [...structuralDependencies, ...operationalDependencies];
    const previewStatus = dependencyStatusToReadiness(dependencies, 'preview');
    const publishStatus = mergeStatus(previewStatus, dependencyStatusToReadiness(dependencies, 'publish'));
    const missingDependencies = dependencies
      .filter((dependency) => dependency.status !== 'ready')
      .map((dependency) => dependency.label);
    const fixHints = dependencies
      .map((dependency) => dependency.fixHint)
      .filter((hint): hint is string => Boolean(hint));

    readiness[binding.bindingId] = {
      bindingId: binding.bindingId,
      previewStatus,
      publishStatus,
      requiredCapabilities: getRequiredCapabilities(binding),
      missingDependencies: Array.from(new Set(missingDependencies)),
      fixHints: Array.from(new Set(fixHints)),
      dependencies,
      targetSummary: getTargetSummary(binding, state),
    };

    enrichedBindings[binding.bindingId] = {
      ...binding,
      previewStatus,
      publishStatus,
      requiredCapabilities: readiness[binding.bindingId].requiredCapabilities,
      missingDependencies: readiness[binding.bindingId].missingDependencies,
      fixHints: readiness[binding.bindingId].fixHints,
    };
  }

  const componentList = Object.values(state.creatorData.componentInstances || {});
  for (const instance of componentList) {
    const dependencies = buildComponentDependencies(instance, state, setupSnapshot);
    const previewStatus = dependencyStatusToReadiness(dependencies, 'preview');
    const publishStatus = mergeStatus(previewStatus, dependencyStatusToReadiness(dependencies, 'publish'));
    const missingDependencies = dependencies
      .filter((dependency) => dependency.status !== 'ready')
      .map((dependency) => dependency.label);
    const fixHints = dependencies
      .map((dependency) => dependency.fixHint)
      .filter((hint): hint is string => Boolean(hint));

    componentReadiness[instance.instanceId] = {
      instanceId: instance.instanceId,
      componentType: instance.componentType,
      label: instance.label || getComponentTargetSummary(instance, state),
      previewStatus,
      publishStatus,
      dependencies,
      missingDependencies: Array.from(new Set(missingDependencies)),
      fixHints: Array.from(new Set(fixHints)),
    };
  }

  const bindingList = Object.values(enrichedBindings);
  const summary = {
    totalIntents: bindingList.length,
    previewReady: bindingList.filter((binding) => binding.previewStatus === 'ready').length,
    previewPartial: bindingList.filter((binding) => binding.previewStatus === 'partial').length,
    previewBlocked: bindingList.filter((binding) => binding.previewStatus === 'blocked').length,
    publishReady: bindingList.filter((binding) => binding.publishStatus === 'ready').length,
    publishPartial: bindingList.filter((binding) => binding.publishStatus === 'partial').length,
    publishBlocked: bindingList.filter((binding) => binding.publishStatus === 'blocked').length,
    hardened: bindingList.filter((binding) => binding.publishStatus === 'ready').length,
    blocked: bindingList.filter((binding) => binding.publishStatus === 'blocked').length,
    previewOnly: bindingList.filter(
      (binding) => binding.previewStatus === 'ready' && binding.publishStatus !== 'ready',
    ).length,
    totalComponents: componentList.length,
    componentPublishReady: Object.values(componentReadiness).filter((component) => component.publishStatus === 'ready').length,
    componentPublishBlocked: Object.values(componentReadiness).filter((component) => component.publishStatus === 'blocked').length,
  };

  return {
    bindings: enrichedBindings,
    readiness,
    componentReadiness,
    summary,
  };
}
