import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { AI_MODEL, calculateCost } from "./ai/config";

const DEFAULT_BILLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Token system - direct token usage tracking
// Stripe subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free",
    maxProjects: 3,
    maxTeamMembers: 1,
    maxStorageGB: 1,
    hasAdvancedFeatures: false,
    hasAIFeatures: false,
    price: 0,
    aiMonthlyTokens: 0,
  },
  basic: {
    id: "basic",
    name: "Basic",
    maxProjects: 10,
    maxTeamMembers: 15,
    maxStorageGB: 10,
    hasAdvancedFeatures: false,
    hasAIFeatures: false,
    price: 19,
    aiMonthlyTokens: 0,
  },
  ai: {
    id: "ai",
    name: "AI Pro",
    maxProjects: 20,
    maxTeamMembers: 25,
    maxStorageGB: 50,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 39,
    aiMonthlyTokens: 5000000, // 5M tokens monthly
  },
  ai_scale: {
    id: "ai_scale",
    name: "AI Scale",
    maxProjects: 20,
    maxTeamMembers: 25,
    maxStorageGB: 50,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 99,
    aiMonthlyTokens: 25000000, // 25M tokens monthly
  },
  pro: {
    id: "pro",
    name: "Pro",
    maxProjects: 50,
    maxTeamMembers: 50,
    maxStorageGB: 100,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 49,
    aiMonthlyTokens: 5000000, // 5M tokens (same as AI Pro)
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    maxProjects: 999,
    maxTeamMembers: 999,
    maxStorageGB: 1000,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 199,
    aiMonthlyTokens: 12500000, // 12.5M tokens monthly
  },
} as const;

function getEffectiveLimits(team: any) {
  const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
  const defaultLimits = SUBSCRIPTION_PLANS[plan];
  const storedLimits = team.subscriptionLimits;

  if (plan === "free") {
    return {
      ...defaultLimits,
      ...(storedLimits || {}),
      maxTeamMembers: Math.min(
        storedLimits?.maxTeamMembers ?? defaultLimits.maxTeamMembers,
        defaultLimits.maxTeamMembers
      ),
    };
  }

  return storedLimits || defaultLimits;
}

export function getBillingWindow(team: any) {
  const now = Date.now();
  const start = typeof team?.currentPeriodStart === "number"
    ? team.currentPeriodStart
    : now - DEFAULT_BILLING_WINDOW_MS;

  const end = typeof team?.currentPeriodEnd === "number"
    ? team.currentPeriodEnd
    : now + DEFAULT_BILLING_WINDOW_MS;

  return { start, end };
}

export const ensureBillingWindow = mutation({
  args: { teamId: v.id("teams") },
  returns: v.object({
    updated: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    const hasStart = typeof team.currentPeriodStart === "number";
    const hasEnd = typeof team.currentPeriodEnd === "number";
    const start = hasStart ? team.currentPeriodStart! : now;
    const end = hasEnd ? team.currentPeriodEnd! : now + DEFAULT_BILLING_WINDOW_MS;

    const canOverride =
      !team.stripeCustomerId ||
      (team.subscriptionStatus !== "active" && team.subscriptionStatus !== "trialing");
    const needsUpdate =
      canOverride &&
      (!hasStart ||
        !hasEnd ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start ||
        end < now);

    if (!needsUpdate) {
      return {
        updated: false,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      };
    }

    const currentPeriodStart = now;
    const currentPeriodEnd = now + DEFAULT_BILLING_WINDOW_MS;

    await ctx.db.patch(args.teamId, {
      currentPeriodStart,
      currentPeriodEnd,
    });

    return {
      updated: true,
      currentPeriodStart,
      currentPeriodEnd,
    };
  },
});


async function evaluateAIAccess(ctx: any, team: any) {
  // BYPASS for now as requested
  return {
    allowed: true,
    message: "AI features available (Bypassed)",
    currentPlan: team.subscriptionPlan || "free",
    subscriptionStatus: team.subscriptionStatus || null,
    totalTokens: 1000000000,
    usedTokens: 0,
    remainingTokens: 1000000000,
  };
}


// Add tokens to team (can be called by admin)
export const addAITokens = mutation({
  args: {
    teamId: v.id("teams"),
    tokens: v.number(), // tokens to add
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Only team admin can add tokens
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can add AI tokens");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const currentTokens = team.aiTokens || 0;
    const newTokens = currentTokens + Math.max(args.tokens, 0);

    await ctx.db.patch(args.teamId, {
      aiTokens: newTokens,
    });

    return {
      success: true,
      aiTokens: newTokens,
    };
  },
});

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

    const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
    const subscriptionLimits = getEffectiveLimits(team);

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
      planDetails: SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.free,
    };
  },
});

// Internal query to get team for Stripe operations
export const getTeamForStripe = internalQuery({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
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

// Internal mutation to sync team subscription from Stripe
export const syncTeamSubscriptionFromStripe = internalMutation({
  args: {
    teamId: v.string(),
    stripeSubscriptionId: v.string(),
    userId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    // Get subscription from Stripe component's database
    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscription,
      { stripeSubscriptionId: args.stripeSubscriptionId }
    );

    if (!subscription) {
      console.log(`Subscription ${args.stripeSubscriptionId} not found in Stripe component`);
      return;
    }

    // Determine plan from price ID
    const plan = determinePlanFromPriceId(subscription.priceId);
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    // Update team with subscription data
    await ctx.db.patch(args.teamId as Id<"teams">, {
      subscriptionId: subscription.stripeSubscriptionId,
      subscriptionStatus: subscription.status as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: subscription.priceId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      subscriptionLimits: limits,
    });

    console.log(`Team ${args.teamId} subscription synced: plan=${plan}, status=${subscription.status}`);
  },
});

// Helper function to determine plan from Stripe price ID
function determinePlanFromPriceId(priceId: string): string {
  const aiPriceId = process.env.STRIPE_AI_PRICE_ID;
  const aiScalePriceId = process.env.STRIPE_AI_SCALE_PRICE_ID;

  if (aiScalePriceId && priceId === aiScalePriceId) return "ai_scale";
  if (aiPriceId && priceId === aiPriceId) return "ai";
  return "ai"; // Default to base AI plan if unknown
}

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

// Direct subscription sync mutation (for manual sync from Stripe API)
export const syncSubscriptionDirectly = internalMutation({
  args: {
    teamId: v.id("teams"),
    subscriptionId: v.string(),
    status: v.string(),
    priceId: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  async handler(ctx, args) {
    const plan = determinePlanFromPriceId(args.priceId);
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    await ctx.db.patch(args.teamId, {
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.status as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: args.priceId,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      subscriptionLimits: limits,
    });

    console.log(`Team ${args.teamId} subscription synced directly: plan=${plan}, status=${args.status}`);
    return { success: true, plan, status: args.status };
  },
});

// Fix team AI access (one-time fix for existing teams)
export const fixTeamAIAccess = internalMutation({
  args: { teamId: v.string() },
  async handler(ctx, args) {
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (!team) {
      throw new Error("Team not found");
    }

    const plan = team.subscriptionPlan || "free";
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    await ctx.db.patch(args.teamId as Id<"teams">, {
      subscriptionLimits: limits,
    });

    return { success: true, plan, limits };
  },
});

// Public mutation to refresh team subscription limits (syncs with current plan definitions)
export const refreshTeamLimits = mutation({
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

    // Check if user is admin of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive || membership.role !== "admin") {
      throw new Error("Not authorized - admin access required");
    }

    const plan = team.subscriptionPlan || "free";
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;

    await ctx.db.patch(args.teamId, {
      subscriptionLimits: limits,
    });

    return { success: true, plan, limits };
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

    // BYPASS limits for now as requested
    return { allowed: true };
  },
});

// Internal query to check AI feature access by project ID
export const checkAIFeatureAccessByProject = internalQuery({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
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

    if (identity) {
      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
        )
        .unique();

    }

    const access = await evaluateAIAccess(ctx, team);
    return {
      ...access,
      limits: getEffectiveLimits(team),
    };
  },
});

// Internal query to check AI feature access
export const checkAIFeatureAccess = internalQuery({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return {
        allowed: false,
        message: "Team not found",
      };
    }

    if (identity) {
      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
        )
        .unique();

    }

    const access = await evaluateAIAccess(ctx, team);
    return {
      ...access,
      limits: getEffectiveLimits(team),
    };
  },
});

// Public query to check AI access for a team (by teamId)
export const checkTeamAIAccess = query({
  args: { teamId: v.id("teams") },
  returns: v.object({
    hasAccess: v.boolean(),
    message: v.string(),
    currentPlan: v.string(),
    subscriptionStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("trialing"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("paused"),
      v.literal("unpaid"),
      v.null()
    )),
    subscriptionLimits: v.optional(v.any()),
    // Simple token balance
    totalTokens: v.optional(v.number()),
    usedTokens: v.optional(v.number()),
    remainingTokens: v.optional(v.number()),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        hasAccess: false,
        message: "Not authenticated",
        currentPlan: "free",
        subscriptionStatus: null,
      };
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      return {
        hasAccess: false,
        message: "Team not found",
        currentPlan: "free",
        subscriptionStatus: null,
      };
    }

    // Check membership
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      return {
        hasAccess: false,
        message: "Not a member of this team",
        currentPlan: "free",
        subscriptionStatus: null,
      };
    }

    const access = await evaluateAIAccess(ctx, team);
    const hasAccess = access.allowed;

    return {
      hasAccess,
      message: access.message || (hasAccess ? "AI features available" : "AI features unavailable"),
      currentPlan: team.subscriptionPlan || "free",
      subscriptionStatus: team.subscriptionStatus || null,
      subscriptionLimits: getEffectiveLimits(team),
      // Simple token balance
      totalTokens: access.totalTokens,
      usedTokens: access.usedTokens,
      remainingTokens: access.remainingTokens,
    };
  },
});

// Query to get user's subscriptions from Stripe component
export const getUserSubscriptions = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject }
    );
  },
});

// Query to get user's payments from Stripe component  
export const getUserPayments = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listPaymentsByUserId,
      { userId: identity.subject }
    );
  },
});

// Query to get user's invoices from Stripe component
export const getUserInvoices = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listInvoicesByUserId,
      { userId: identity.subject }
    );
  },
});

// Query to get team's subscriptions from Stripe component (by org ID)
export const getTeamSubscriptionsFromStripe = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const team = await ctx.db.get(args.teamId);
    if (!team || !team.stripeCustomerId) return [];

    return await ctx.runQuery(
      components.stripe.public.listSubscriptions,
      { stripeCustomerId: team.stripeCustomerId }
    );
  },
});

// Query to get team's payments from Stripe component (by org ID)
export const getTeamPayments = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const team = await ctx.db.get(args.teamId);
    if (!team) return [];

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) return [];

    if (!team.stripeCustomerId) return [];

    const payments = await ctx.runQuery(
      components.stripe.public.listPayments,
      { stripeCustomerId: team.stripeCustomerId }
    );

    return payments.sort((a, b) => b.created - a.created);
  },
});

export const getSubscriptionConfig = query({
  args: {},
  handler: async () => {
    return {
      proPriceId: process.env.STRIPE_AI_PRICE_ID,
    };
  },
});
