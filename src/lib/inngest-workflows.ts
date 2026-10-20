/**
 * Inngest Workflow Functions
 * 
 * CRM automation workflows powered by Inngest's durable execution.
 * These run on your existing serverless infrastructure.
 */

import { inngest } from "./inngest.js";
import { executeMatchingRecipes } from "../services/recipeExecutor.js";

/**
 * Deal Stage Change Workflow
 * 
 * Triggered when a deal moves to a new stage.
 * Handles notifications, follow-ups, and stage-specific automations.
 */
export const dealStageWorkflow = inngest.createFunction(
  { 
    id: "deal-stage-workflow",
    name: "Deal Stage Change Handler",
    retries: 3,
  },
    { event: "crm/deal.stage.changed" },
  async ({ event, step  }: any) => {
    const { dealId, businessId, newStage, previousStage, contactEmail } = event.data;

    // Step 1: Log the stage change
    await step.run("log-stage-change", async () => {
      console.log(`Deal ${dealId} moved from ${previousStage} to ${newStage}`);
      // In production: log to automation_logs table
      return { logged: true };
    });

    // Step 2: Handle stage-specific actions
    if (newStage === "negotiation") {
      await step.run("negotiation-actions", async () => {
        // Send notification to sales team
        // Create follow-up task
        console.log(`Deal ${dealId} entered negotiation - notifying sales team`);
        return { notified: true };
      });

      // Wait 1 day, then send follow-up reminder
      await step.sleep("wait-for-follow-up", "1d");

      await step.run("send-follow-up-reminder", async () => {
        console.log(`Follow-up reminder for deal ${dealId}`);
        return { reminded: true };
      });
    }

    if (newStage === "closed_won") {
      await step.run("closed-won-actions", async () => {
        // Send congratulations email
        // Create onboarding tasks
        // Update revenue metrics
        console.log(`Deal ${dealId} closed! Processing win actions.`);
        return { processed: true };
      });

      // Wait 7 days, then request review
      if (contactEmail) {
        await step.sleep("wait-for-review-request", "7d");
        
        await step.run("request-review", async () => {
          console.log(`Requesting review from ${contactEmail} for deal ${dealId}`);
          return { reviewRequested: true };
        });
      }
    }

    if (newStage === "closed_lost") {
      await step.run("closed-lost-actions", async () => {
        // Log loss reason
        // Schedule follow-up for 30 days
        console.log(`Deal ${dealId} lost. Scheduling re-engagement.`);
        return { processed: true };
      });

      // Wait 30 days, then re-engage
      await step.sleep("wait-for-reengagement", "30d");

      await step.run("re-engage-contact", async () => {
        console.log(`Re-engaging contact for deal ${dealId}`);
        return { reengaged: true };
      });
    }

    return { 
      dealId, 
      newStage, 
      completed: true,
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Lead Follow-up Workflow
 * 
 * Automated follow-up sequence for new leads.
 */
export const leadFollowUpWorkflow = inngest.createFunction(
  {
    id: "lead-follow-up-workflow",
    name: "Lead Follow-up Sequence",
    retries: 3,
  },
    { event: "crm/lead.created" },
  async ({ event, step  }: any) => {
    const { leadId, businessId, email, phone } = event.data;

    // Step 0: Execute matching recipes (e.g., contractor-lead-followup)
    const recipeResults = await step.run("execute-recipes", async () => {
      return executeMatchingRecipes(step, event.data as Record<string, unknown>);
    });

    // Step 1: Immediate acknowledgment
    await step.run("acknowledge-lead", async () => {
      console.log(`New lead ${leadId} received - sending acknowledgment`);
      return { acknowledged: true, recipesRun: recipeResults.length };
    });

    // Step 2: Wait 30 minutes, then send first follow-up
    await step.sleep("wait-first-follow-up", "30m");

    await step.run("first-follow-up", async () => {
      console.log(`First follow-up for lead ${leadId}`);
      return { firstFollowUp: true };
    });

    // Step 3: Wait 1 day, then second follow-up
    await step.sleep("wait-second-follow-up", "1d");

    await step.run("second-follow-up", async () => {
      console.log(`Second follow-up for lead ${leadId}`);
      return { secondFollowUp: true };
    });

    // Step 4: Wait 3 days, then final follow-up
    await step.sleep("wait-final-follow-up", "3d");

    await step.run("final-follow-up", async () => {
      console.log(`Final follow-up for lead ${leadId}`);
      return { finalFollowUp: true };
    });

    return {
      leadId,
      completed: true,
      sequence: ["acknowledge", "first", "second", "final"],
    };
  }
);

/**
 * Booking Reminder Workflow
 * 
 * Send reminders before scheduled bookings.
 */
export const bookingReminderWorkflow = inngest.createFunction(
  {
    id: "booking-reminder-workflow",
    name: "Booking Reminder Sequence",
    retries: 3,
  },
    { event: "booking/created" },
  async ({ event, step  }: any) => {
    const { bookingId, businessId, contactEmail, scheduledAt, service } = event.data;
    
    // Step 0: Execute matching recipes (e.g., salon-booking-confirm, restaurant-reservation-confirm)
    const recipeResults = await step.run("execute-recipes", async () => {
      return executeMatchingRecipes(step, event.data as Record<string, unknown>);
    });

    const scheduledDate = new Date(scheduledAt);
    const now = new Date();
    
    // Calculate time until booking
    const msUntilBooking = scheduledDate.getTime() - now.getTime();
    const hoursUntilBooking = msUntilBooking / (1000 * 60 * 60);

    // Step 1: Immediate confirmation
    await step.run("send-confirmation", async () => {
      console.log(`Booking ${bookingId} confirmed for ${service} at ${scheduledAt}`);
      return { confirmed: true };
    });

    // Step 2: 24-hour reminder (if booking is >24h away)
    if (hoursUntilBooking > 24) {
      const reminderTime = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000);
      await step.sleepUntil("wait-for-24h-reminder", reminderTime);
      
      await step.run("send-24h-reminder", async () => {
        console.log(`24h reminder for booking ${bookingId}`);
        return { reminded24h: true };
      });
    }

    // Step 3: 2-hour reminder
    if (hoursUntilBooking > 2) {
      const twoHourReminder = new Date(scheduledDate.getTime() - 2 * 60 * 60 * 1000);
      await step.sleepUntil("wait-for-2h-reminder", twoHourReminder);
      
      await step.run("send-2h-reminder", async () => {
        console.log(`2h reminder for booking ${bookingId}`);
        return { reminded2h: true };
      });
    }

    return {
      bookingId,
      service,
      scheduledAt,
      remindersComplete: true,
    };
  }
);

/**
 * Post-Booking Review Request Workflow
 * 
 * Request reviews after service completion.
 */
export const reviewRequestWorkflow = inngest.createFunction(
  {
    id: "review-request-workflow",
    name: "Post-Service Review Request",
    retries: 2,
  },
    { event: "booking/completed" },
  async ({ event, step  }: any) => {
    const { bookingId, businessId, contactEmail } = event.data;

    // Wait 2 hours after completion
    await step.sleep("wait-for-review-timing", "2h");

    await step.run("send-review-request", async () => {
      console.log(`Requesting review for booking ${bookingId} from ${contactEmail}`);
      // Send email with review link
      return { reviewRequested: true };
    });

    // Wait 3 days, if no review, send gentle reminder
    await step.sleep("wait-for-review-reminder", "3d");

    await step.run("send-review-reminder", async () => {
      console.log(`Review reminder for booking ${bookingId}`);
      return { reminderSent: true };
    });

    return {
      bookingId,
      reviewSequenceComplete: true,
    };
  }
);

/**
 * No-Show Follow-up Workflow
 */
export const noShowFollowUpWorkflow = inngest.createFunction(
  {
    id: "no-show-follow-up-workflow",
    name: "No-Show Follow-up",
    retries: 2,
  },
    { event: "booking/no.show" },
  async ({ event, step  }: any) => {
    const { bookingId, businessId, contactEmail } = event.data;

    // Wait 1 hour after no-show detection
    await step.sleep("wait-after-no-show", "1h");

    await step.run("send-no-show-follow-up", async () => {
      console.log(`No-show follow-up for booking ${bookingId}`);
      // Send message asking to reschedule
      return { followUpSent: true };
    });

    return {
      bookingId,
      noShowHandled: true,
    };
  }
);

/**
 * Form Submission Workflow
 * 
 * Process form submissions and create leads.
 */
export const formSubmissionWorkflow = inngest.createFunction(
  {
    id: "form-submission-workflow",
    name: "Form Submission Handler",
    retries: 3,
  },
    { event: "form/submitted" },
  async ({ event, step  }: any) => {
    const { formId, businessId, submissionId, email, data } = event.data;

    // Step 1: Create or update contact/lead
    const lead = await step.run("create-lead", async () => {
      console.log(`Processing form submission ${submissionId}`);
      // Create lead in CRM
      return { leadId: `lead_${submissionId}` };
    });

    // Step 2: Send confirmation
    await step.run("send-confirmation", async () => {
      console.log(`Sending form confirmation to ${email}`);
      return { confirmed: true };
    });

    // Step 3: Notify business owner
    await step.run("notify-owner", async () => {
      console.log(`Notifying business ${businessId} of new submission`);
      return { notified: true };
    });

    // Step 4: Trigger lead follow-up sequence
    await step.sendEvent("trigger-lead-follow-up", {
      name: "crm/lead.created",
      data: {
        leadId: lead.leadId,
        businessId,
        email,
        source: "form",
      },
    });

    return {
      submissionId,
      leadCreated: lead.leadId,
      processed: true,
    };
  }
);
/**
 * Cart Abandonment Recovery Workflow
 * 
 * Triggered when a cart is abandoned (30min of inactivity).
 * Sends a sequence of recovery emails.
 */
export const cartAbandonmentWorkflow = inngest.createFunction(
  {
    id: "cart-abandonment-workflow",
    name: "Cart Abandonment Recovery",
    retries: 3,
  },
    { event: "cart/abandoned" },
  async ({ event, step  }: any) => {
    const { cartId, businessId, customerEmail, items, total } = event.data;

    if (!customerEmail) {
      console.log(`[CartAbandonment] No email for cart ${cartId}, skipping`);
      return { cartId, skipped: true, reason: "no_email" };
    }

    // Step 1: Wait 1 hour, then send first reminder
    await step.sleep("wait-first-reminder", "1h");

    const firstReminder = await step.run("send-first-reminder", async () => {
      console.log(`[CartAbandonment] First reminder for cart ${cartId} to ${customerEmail}`);
      // TODO: Send email with cart items and checkout link
      return { sent: true, type: "first" };
    });

    // Step 2: Wait 24 hours, then send second reminder with discount
    await step.sleep("wait-discount-reminder", "24h");

    const secondReminder = await step.run("send-discount-reminder", async () => {
      console.log(`[CartAbandonment] Discount reminder for cart ${cartId}`);
      // TODO: Send email with 10% discount code
      return { sent: true, type: "discount", discountCode: "COMEBACK10" };
    });

    // Step 3: Wait 3 days, then send final reminder
    await step.sleep("wait-final-reminder", "3d");

    const finalReminder = await step.run("send-final-reminder", async () => {
      console.log(`[CartAbandonment] Final reminder for cart ${cartId}`);
      // TODO: Send urgency email
      return { sent: true, type: "final" };
    });

    return {
      cartId,
      customerEmail,
      itemsCount: items?.length || 0,
      total,
      remindersSequence: ["first", "discount", "final"],
      completed: true,
    };
  }
);

/**
 * Order Fulfillment Workflow
 * 
 * Handles post-order communications: confirmation, shipping, delivery, review.
 */
export const orderFulfillmentWorkflow = inngest.createFunction(
  {
    id: "order-fulfillment-workflow",
    name: "Order Fulfillment Sequence",
    retries: 3,
  },
    { event: "order/created" },
  async ({ event, step  }: any) => {
    const { orderId, businessId, customerEmail, items, total } = event.data;

    // Step 1: Immediate order confirmation
    await step.run("send-order-confirmation", async () => {
      console.log(`[Order] Confirmation for order ${orderId} to ${customerEmail}`);
      // TODO: Send order confirmation email
      return { confirmed: true };
    });

    // Step 2: Notify business owner
    await step.run("notify-business", async () => {
      console.log(`[Order] Notifying business ${businessId} of new order`);
      // TODO: Send notification to business
      return { notified: true };
    });

    // Step 3: Wait for shipping event (up to 3 days, then check)
    // In production, this would be triggered by order/shipped event
    await step.sleep("wait-for-shipping", "3d");

    await step.run("shipping-reminder-check", async () => {
      console.log(`[Order] Checking shipping status for order ${orderId}`);
      // TODO: Check if order shipped, if not, send reminder to business
      return { checked: true };
    });

    return {
      orderId,
      customerEmail,
      itemsCount: items?.length || 0,
      total,
      fulfilled: true,
    };
  }
);

/**
 * Newsletter Welcome Sequence
 * 
 * Sends welcome emails to new newsletter subscribers.
 */
export const newsletterWelcomeWorkflow = inngest.createFunction(
  {
    id: "newsletter-welcome-workflow",
    name: "Newsletter Welcome Sequence",
    retries: 3,
  },
    { event: "newsletter/subscribed" },
  async ({ event, step  }: any) => {
    const { subscriptionId, businessId, email, source } = event.data;

    // Step 1: Immediate welcome email
    await step.run("send-welcome-email", async () => {
      console.log(`[Newsletter] Welcome email to ${email}`);
      // TODO: Send welcome email with intro content
      return { sent: true, type: "welcome" };
    });

    // Step 2: Wait 3 days, send value email
    await step.sleep("wait-value-email", "3d");

    await step.run("send-value-email", async () => {
      console.log(`[Newsletter] Value email to ${email}`);
      // TODO: Send helpful content/tips
      return { sent: true, type: "value" };
    });

    // Step 3: Wait 7 days, send engagement email
    await step.sleep("wait-engagement-email", "7d");

    await step.run("send-engagement-email", async () => {
      console.log(`[Newsletter] Engagement email to ${email}`);
      // TODO: Send CTA or offer
      return { sent: true, type: "engagement" };
    });

    return {
      subscriptionId,
      email,
      source,
      welcomeSequenceComplete: true,
    };
  }
);

/**
 * Generic Automation Trigger Workflow
 * 
 * Handles automation/trigger events from the Intent Executor.
 * Routes to specific automations based on triggerType.
 */
export const automationTriggerWorkflow = inngest.createFunction(
  {
    id: "automation-trigger-workflow",
    name: "Automation Trigger Handler",
    retries: 3,
  },
    { event: "automation/trigger" },
  async ({ event, step  }: any) => {
    const { automationId, businessId, triggerId, triggerType, payload } = event.data;

    // Step 0: Execute any matching recipe steps attached to this event
    const recipeResults = await step.run("execute-recipes", async () => {
      const results = await executeMatchingRecipes(step, event.data as Record<string, unknown>);
      return { recipesRun: results.length, results };
    });

    // Log the trigger
    await step.run("log-trigger", async () => {
      console.log(`[Automation] Trigger: ${triggerType} (${triggerId}) for business ${businessId}`);
      console.log(`[Automation] Recipes executed: ${recipeResults.recipesRun}`);
      return { logged: true, recipesRun: recipeResults.recipesRun };
    });

    // Route based on trigger type
    switch (triggerType) {
      case "checkout":
        await step.run("handle-checkout-trigger", async () => {
          console.log(`[Automation] Checkout started - items: ${JSON.stringify(payload.items)}`);
          return { handled: true, type: "checkout" };
        });
        break;

      case "cart_abandoned":
        // Emit cart/abandoned event for the cart abandonment workflow
        await step.sendEvent("trigger-cart-abandonment", {
          name: "cart/abandoned",
          data: {
            cartId: payload.cartId as string || triggerId,
            businessId,
            customerEmail: payload.email as string,
            items: payload.items as Array<{ productId: string; quantity: number }> || [],
            total: payload.total as number,
            lastActivityAt: new Date().toISOString(),
          },
        });
        break;

      case "button.clicked":
        await step.run("handle-button-click", async () => {
          console.log(`[Automation] Button clicked: ${JSON.stringify(payload)}`);
          return { handled: true, type: "button_click" };
        });
        break;

      default:
        await step.run("handle-generic-trigger", async () => {
          console.log(`[Automation] Generic trigger: ${triggerType}`);
          return { handled: true, type: "generic" };
        });
    }

    return {
      automationId,
      triggerId,
      triggerType,
      processed: true,
      recipesExecuted: recipeResults.recipesRun,
    };
  }
);

// Export all workflows
export const inngestFunctions = [
  dealStageWorkflow,
  leadFollowUpWorkflow,
  bookingReminderWorkflow,
  reviewRequestWorkflow,
  noShowFollowUpWorkflow,
  formSubmissionWorkflow,
  cartAbandonmentWorkflow,
  orderFulfillmentWorkflow,
  newsletterWelcomeWorkflow,
  automationTriggerWorkflow,
];
