import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Stripe subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free",
    maxProjects: 3,
    maxTeamMembers: 5,
    maxStorageGB: 1,
    hasAdvancedFeatures: false,
    price: 0,
  },
  basic: {
    id: "basic",
    name: "Basic",
    maxProjects: 10,
    maxTeamMembers: 15,
    maxStorageGB: 10,
    hasAdvancedFeatures: false,
    price: 19,
  },
  pro: {
    id: "pro",
    name: "Pro", 
    maxProjects: 50,
    maxTeamMembers: 50,
    maxStorageGB: 100,
    hasAdvancedFeatures: true,
    price: 49,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    maxProjects: 999,
    maxTeamMembers: 999,
    maxStorageGB: 1000,
    hasAdvancedFeatures: true,
    price: 199,
  },
} as const;

// Get subscription info for a team
export const getTeamSubscription = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is member of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    const plan = team.subscriptionPlan || "free";
    const subscriptionLimits = team.subscriptionLimits || SUBSCRIPTION_PLANS.free;

    return {
      teamId: args.teamId,
      subscriptionStatus: team.subscriptionStatus || null,
      subscriptionPlan: plan,
      subscriptionId: team.subscriptionId,
      stripeCustomerId: team.stripeCustomerId,
      currentPeriodStart: team.currentPeriodStart,
      currentPeriodEnd: team.currentPeriodEnd,
      trialEnd: team.trialEnd,
      cancelAtPeriodEnd: team.cancelAtPeriodEnd || false,
      limits: subscriptionLimits,
      planDetails: SUBSCRIPTION_PLANS[plan],
    };
  },
});

// Check if team can perform an action based on subscription limits
export const checkTeamLimits = query({
  args: { 
    teamId: v.id("teams"),
    action: v.union(
      v.literal("create_project"),
      v.literal("add_member"),
      v.literal("use_advanced_features"),
      v.literal("upload_file")
    ),
    additionalData: v.optional(v.any())
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const plan = team.subscriptionPlan || "free";
    const limits = team.subscriptionLimits || SUBSCRIPTION_PLANS[plan];

    // Check subscription status
    if (team.subscriptionStatus && !["active", "trialing"].includes(team.subscriptionStatus)) {
      return {
        allowed: false,
        reason: "subscription_inactive",
        message: "Your subscription is not active. Please update your billing information.",
      };
    }

    switch (args.action) {
      case "create_project": {
        const projectCount = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .collect()
          .then(projects => projects.length);

        if (projectCount >= limits.maxProjects) {
          return {
            allowed: false,
            reason: "project_limit_reached",
            message: `You've reached the maximum number of projects (${limits.maxProjects}) for your ${plan} plan.`,
            current: projectCount,
            limit: limits.maxProjects,
          };
        }
        break;
      }

      case "add_member": {
        const memberCount = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect()
          .then(members => members.length);

        if (memberCount >= limits.maxTeamMembers) {
          return {
            allowed: false,
            reason: "member_limit_reached",
            message: `You've reached the maximum number of team members (${limits.maxTeamMembers}) for your ${plan} plan.`,
            current: memberCount,
            limit: limits.maxTeamMembers,
          };
        }
        break;
      }

      case "use_advanced_features": {
        if (!limits.hasAdvancedFeatures) {
          return {
            allowed: false,
            reason: "feature_not_available",
            message: `This feature is not available in your ${plan} plan. Please upgrade to Pro or Enterprise.`,
          };
        }
        break;
      }

      case "upload_file": {
        // This would need additional logic to check current storage usage
        // For now, we'll just check if the feature is available
        const fileSizeGB = (args.additionalData?.fileSize || 0) / (1024 * 1024 * 1024);
        if (fileSizeGB > limits.maxStorageGB) {
          return {
            allowed: false,
            reason: "storage_limit_reached",
            message: `File size exceeds your storage limit of ${limits.maxStorageGB}GB for your ${plan} plan.`,
            limit: limits.maxStorageGB,
          };
        }
        break;
      }
    }

    return {
      allowed: true,
      limits,
    };
  },
});

// Public mutation to create checkout session URL (called from client)
export const createCheckoutSession = mutation({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
  },
  async handler(ctx, args): Promise<string> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can manage subscriptions");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Schedule internal action to create checkout session
    return await ctx.scheduler.runAfter(0, internal.stripe.createCheckoutSessionInternal, {
      teamId: args.teamId,
      teamName: team.name,
      priceId: args.priceId,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/${team.slug}/settings?success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/${team.slug}/settings?canceled=true`,
    });
  },
});

// Internal action for creating checkout session
export const createCheckoutSessionInternal = internalAction({
  args: {
    teamId: v.id("teams"),
    teamName: v.string(),
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  async handler(ctx, args): Promise<{ url: string }> {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    try {
      // Get team to check for existing customer
      const team: any = await ctx.runQuery(internal.stripe.getTeamForStripe, {
        teamId: args.teamId,
      });

      if (!team) {
        throw new Error("Team not found");
      }

      let customerId: string = team.stripeCustomerId;

      // Create customer if doesn't exist
      if (!customerId) {
        const customer: any = await stripe.customers.create({
          email: team.adminEmail || "admin@company.com",
          name: args.teamName,
          metadata: {
            teamId: args.teamId,
          },
        });

        customerId = customer.id;
        await ctx.runMutation(internal.stripe.updateTeamStripeCustomer, {
          teamId: args.teamId,
          stripeCustomerId: customerId,
        });
      }

      const session: any = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: args.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        metadata: {
          teamId: args.teamId,
        },
        subscription_data: {
          trial_period_days: 14, // 14-day trial
          metadata: {
            teamId: args.teamId,
          },
        },
      });

      return { url: session.url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  },
});

// Internal query to get team data for Stripe operations
export const getTeamForStripe = internalQuery({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const team = await ctx.db.get(args.teamId);
    if (!team) return null;

    // Get admin email for customer creation
    const adminMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    let adminEmail = null;
    if (adminMember) {
      const adminUser = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", adminMember.clerkUserId))
        .unique();
      adminEmail = adminUser?.email;
    }

    return {
      ...team,
      adminEmail,
    };
  },
});

// Internal mutation to update team's Stripe customer ID
export const updateTeamStripeCustomer = internalMutation({
  args: {
    teamId: v.id("teams"),
    stripeCustomerId: v.string(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.teamId, {
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

// Update team subscription from Stripe webhook
export const updateTeamSubscription = internalMutation({
  args: {
    teamId: v.string(),
    subscriptionId: v.string(),
    subscriptionStatus: v.string(),
    subscriptionPlan: v.string(),
    priceId: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args) {
    const planKey = args.subscriptionPlan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    await ctx.db.patch(args.teamId as Id<"teams">, {
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.subscriptionStatus as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: args.priceId,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEnd: args.trialEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      subscriptionLimits: limits,
    });
  },
});

// Update team to free plan
export const updateTeamToFree = internalMutation({
  args: { teamId: v.string() },
  async handler(ctx, args) {
    await ctx.db.patch(args.teamId as Id<"teams">, {
      subscriptionStatus: null,
      subscriptionId: undefined,
      subscriptionPlan: "free",
      subscriptionPriceId: undefined,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      trialEnd: undefined,
      cancelAtPeriodEnd: false,
      subscriptionLimits: SUBSCRIPTION_PLANS.free,
    });
  },
});

// Cancel subscription
export const cancelSubscription = mutation({
  args: {
    teamId: v.id("teams"),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args): Promise<string> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can manage subscriptions");
    }

    // Call internal action to cancel subscription
    return await ctx.scheduler.runAfter(0, internal.stripe.cancelSubscriptionInternal, {
      teamId: args.teamId,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    });
  },
});

// Internal action to cancel subscription
export const cancelSubscriptionInternal = internalAction({
  args: {
    teamId: v.id("teams"),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args) {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const team = await ctx.runQuery(internal.stripe.getTeamForStripe, {
      teamId: args.teamId,
    });

    if (!team || !team.subscriptionId) {
      throw new Error("No active subscription found");
    }

    try {
      if (args.cancelAtPeriodEnd) {
        // Cancel at period end
        await stripe.subscriptions.update(team.subscriptionId, {
          cancel_at_period_end: true,
        });

        await ctx.runMutation(internal.stripe.updateCancellationStatus, {
          teamId: args.teamId,
          cancelAtPeriodEnd: true,
        });
      } else {
        // Cancel immediately
        await stripe.subscriptions.cancel(team.subscriptionId);

        await ctx.runMutation(internal.stripe.updateTeamToFree, {
          teamId: args.teamId,
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  },
});

// Update cancellation status
export const updateCancellationStatus = internalMutation({
  args: {
    teamId: v.id("teams"),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.teamId, {
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    });
  },
});

// Check if team has access to AI features (internal query)
export const checkAIFeatureAccess = internalQuery({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return {
        allowed: false,
        message: "Project not found",
      };
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      return {
        allowed: false,
        message: "Team not found",
      };
    }

    // Check if team has advanced AI features
    const subscriptionLimits = team.subscriptionLimits || SUBSCRIPTION_PLANS.free;
    if (!subscriptionLimits.hasAdvancedFeatures) {
      return {
        allowed: false,
        message: "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI task generation.",
        currentPlan: team.subscriptionPlan || "free",
        limits: subscriptionLimits,
      };
    }

    // Check subscription status
    if (team.subscriptionStatus && !["active", "trialing"].includes(team.subscriptionStatus)) {
      return {
        allowed: false,
        message: "🚫 Your subscription is not active. Please update your billing information to use AI features.",
        currentPlan: team.subscriptionPlan || "free",
        subscriptionStatus: team.subscriptionStatus,
      };
    }

    return {
      allowed: true,
      currentPlan: team.subscriptionPlan || "free",
      limits: subscriptionLimits,
    };
  },
}); 