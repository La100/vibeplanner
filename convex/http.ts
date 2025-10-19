import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import handleClerkWebhook from "./clerk";

const http = httpRouter();

http.route({
  path: "/ai/stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response("Unauthorized", { status: 401 });
      }

      const body = await request.json();

      const {
        projectId,
        threadId,
        message,
        userClerkId,
        fileId,
      } = body ?? {};

      if (!projectId || !message || !userClerkId) {
        return new Response("Missing required fields", { status: 400 });
      }

      // Call streaming handler action to prepare data
      const initResult = await ctx.runAction(api.ai.longContext.chatWithLongContextAgent, {
        projectId,
        threadId,
        message,
        userClerkId,
        fileId,
      });

      return new Response(JSON.stringify(initResult), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error) {
      console.error("AI stream error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }),
});

http.route({
  path: "/clerk",
  method: "POST",
  handler: handleClerkWebhook,
});

// Endpoint do zapraszania klienta do organizacji z dostępem do konkretnego projektu
http.route({
  path: "/invite-client",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { email, projectId, clerkOrgId } = body;

    if (!email || !projectId || !clerkOrgId) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Sprawdź autoryzację (opcjonalnie)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Not authenticated", { status: 401 });
    }

    try {
      // Zapisz tymczasowo informację o zaproszeniu w bazie
      await ctx.runMutation(internal.teams.createPendingCustomerInvitation, {
        email,
        projectId,
        clerkOrgId,
        invitedBy: identity.subject,
      });

      // Wywołaj Clerk API do zaproszenia do organizacji
      const clerkResponse = await fetch(`https://api.clerk.dev/v1/organizations/${clerkOrgId}/invitations`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          role: "org:customer",
          public_metadata: {
            invited_to_project: projectId, // Metadane do identyfikacji w webhook
          }
        }),
      });

      if (!clerkResponse.ok) {
        const error = await clerkResponse.text();
        throw new Error(`Clerk API error: ${error}`);
      }

      const invitation = await clerkResponse.json();
      return new Response(JSON.stringify({ success: true, invitation }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Error inviting client:", error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Stripe webhook endpoint
http.route({
  path: "/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("No Stripe signature found", { status: 400 });
    }

    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        throw new Error("Stripe webhook secret not configured");
      }

      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const teamId = session.metadata?.teamId;
          
          if (teamId && session.subscription) {
            // Get subscription details
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            
            // Update team subscription
            await ctx.runMutation(internal.stripe.updateTeamSubscription, {
              teamId,
              subscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              subscriptionPlan: determinePlanFromPriceId(subscription.items.data[0].price.id),
              priceId: subscription.items.data[0].price.id,
              currentPeriodStart: subscription.current_period_start * 1000,
              currentPeriodEnd: subscription.current_period_end * 1000,
              trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            });
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const teamId = subscription.metadata?.teamId;
            
            if (teamId) {
              await ctx.runMutation(internal.stripe.updateTeamSubscription, {
                teamId,
                subscriptionId: subscription.id,
                subscriptionStatus: subscription.status,
                subscriptionPlan: determinePlanFromPriceId(subscription.items.data[0].price.id),
                priceId: subscription.items.data[0].price.id,
                currentPeriodStart: subscription.current_period_start * 1000,
                currentPeriodEnd: subscription.current_period_end * 1000,
                trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              });
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
            const teamId = subscription.metadata?.teamId;
            
            if (teamId) {
              await ctx.runMutation(internal.stripe.updateTeamSubscription, {
                teamId,
                subscriptionId: subscription.id,
                subscriptionStatus: 'past_due',
                subscriptionPlan: determinePlanFromPriceId(subscription.items.data[0].price.id),
                priceId: subscription.items.data[0].price.id,
                currentPeriodStart: subscription.current_period_start * 1000,
                currentPeriodEnd: subscription.current_period_end * 1000,
                trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              });
            }
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const teamId = subscription.metadata?.teamId;
          
          if (teamId) {
            if (event.type === 'customer.subscription.deleted') {
              // Revert to free plan
              await ctx.runMutation(internal.stripe.updateTeamToFree, {
                teamId,
              });
            } else {
              // Update subscription
              await ctx.runMutation(internal.stripe.updateTeamSubscription, {
                teamId,
                subscriptionId: subscription.id,
                subscriptionStatus: subscription.status,
                subscriptionPlan: determinePlanFromPriceId(subscription.items.data[0].price.id),
                priceId: subscription.items.data[0].price.id,
                currentPeriodStart: subscription.current_period_start * 1000,
                currentPeriodEnd: subscription.current_period_end * 1000,
                trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              });
            }
          }
          break;
        }

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Stripe webhook error:", error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Helper function to determine plan from Stripe price ID
function determinePlanFromPriceId(priceId: string): string {
  // You'll need to set these to your actual Stripe price IDs
  const priceIdToPlan: Record<string, string> = {
    // Add your actual Stripe price IDs here
    "price_basic_monthly": "basic",
    "price_basic_yearly": "basic", 
    "price_pro_monthly": "pro",
    "price_pro_yearly": "pro",
    "price_enterprise_monthly": "enterprise",
    "price_enterprise_yearly": "enterprise",
  };
  
  return priceIdToPlan[priceId] || "basic";
}

export default http; 