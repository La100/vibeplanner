"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";
import Stripe from "stripe";
const internalAny = require("./_generated/api").internal as any;

// Initialize Stripe client from component (for customer management)
const stripeClient = new StripeSubscriptions(components.stripe, {});

// Direct Stripe SDK for checkout (to support promotion codes)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

// Public action to create checkout session with promotion codes support
export const createCheckoutSession = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args): Promise<{ url: string }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user info (primary source for billing)
    const user: any = await ctx.runQuery(internalAny.users.getUserForStripe, {
      clerkUserId: identity.subject,
    });

    // Get team info (for access check + name)
    const team: any = await ctx.runQuery(internalAny.stripe.getTeamForStripe, {
      teamId: args.teamId,
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is admin of this team
    const membership: any = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
      teamId: args.teamId,
      clerkUserId: identity.subject,
    });

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can manage subscriptions");
    }

    // Get or create Stripe customer using component
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email || "admin@company.com",
      name: team.name,
    });

    // Update user + team with customer ID if new
    if (!user?.stripeCustomerId) {
      await ctx.runMutation(internalAny.stripe.updateTeamStripeCustomer, {
        teamId: args.teamId,
        stripeCustomerId: customer.customerId,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Create checkout session using direct Stripe SDK (supports allow_promotion_codes)
    const session = await stripe.checkout.sessions.create({
      customer: customer.customerId,
      mode: "subscription",
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/organisation/subscription?success=true`,
      cancel_url: `${baseUrl}/organisation/subscription?canceled=true`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          teamId: args.teamId,
          userId: identity.subject,
        },
      },
    });

    return { url: session.url || "" };
  },
});

// Public action to create Stripe Billing Portal session
export const createBillingPortalSession = action({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.object({
    url: v.string(),
  }),
  async handler(ctx, args): Promise<{ url: string }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user info (primary source for billing)
    const user: any = await ctx.runQuery(internalAny.users.getUserForStripe, {
      clerkUserId: identity.subject,
    });

    // Get team info (for access check)
    const team: any = await ctx.runQuery(internalAny.stripe.getTeamForStripe, {
      teamId: args.teamId,
    });

    if (!team) {
      throw new Error("Team not found");
    }

    const stripeCustomerId = user?.stripeCustomerId || team.stripeCustomerId;
    if (!stripeCustomerId) {
      throw new Error("No Stripe customer found. Please subscribe first.");
    }

    // Check if user is admin of this team
    const membership: any = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
      teamId: args.teamId,
      clerkUserId: identity.subject,
    });

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can manage subscriptions");
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Create portal session using component
    const session = await stripeClient.createCustomerPortalSession(ctx, {
      customerId: stripeCustomerId,
      returnUrl: `${baseUrl}/organisation/settings`,
    });

    return { url: session.url };
  },
});

type EnsureSubscriptionSyncedResult =
  | { synced: true; plan: string; status: string }
  | { synced: false };

// Auto-sync subscription from Stripe if out of sync (called automatically)
export const ensureSubscriptionSynced = action({
  args: {
    teamId: v.id("teams"),
  },
  returns: v.union(
    v.object({
      synced: v.literal(true),
      plan: v.string(),
      status: v.string(),
    }),
    v.object({
      synced: v.literal(false),
    })
  ),
  async handler(ctx, args): Promise<EnsureSubscriptionSyncedResult> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { synced: false };
    }

    // Get user info (primary source for billing)
    const user: any = await ctx.runQuery(internalAny.users.getUserForStripe, {
      clerkUserId: identity.subject,
    });

    // Get team info (fallback)
    const team: any = await ctx.runQuery(internalAny.stripe.getTeamForStripe, {
      teamId: args.teamId,
    });

    const stripeCustomerId = user?.stripeCustomerId || team?.stripeCustomerId;
    if (!stripeCustomerId) {
      return { synced: false };
    }

    // If user already has active subscription in DB, no need to sync
    const subStatus = user?.subscriptionStatus || team?.subscriptionStatus;
    if (subStatus === "active" || subStatus === "trialing") {
      return { synced: false };
    }

    // Check Stripe for active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "trialing",
        limit: 1,
      });

      if (trialingSubscriptions.data.length === 0) {
        return { synced: false };
      }

      subscriptions.data = trialingSubscriptions.data;
    }

    const subscription = subscriptions.data[0];
    const subscriptionItem = subscription.items.data[0];
    const priceId = subscriptionItem?.price.id || "";
    const currentPeriodEnd = subscriptionItem?.current_period_end
      ? subscriptionItem.current_period_end * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const plan = (subscriptionItem?.price.id && process.env.STRIPE_AI_SCALE_PRICE_ID === subscriptionItem.price.id)
      ? "ai_scale"
      : "ai";

    // Sync the subscription to the team
    await ctx.runMutation(internalAny.stripe.syncSubscriptionDirectly, {
      teamId: args.teamId,
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    return {
      synced: true,
      plan,
      status: subscription.status,
    };
  },
});
