import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { AI_MODEL, calculateCost } from "./ai/config";

const DEFAULT_BILLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Credit system: 1 credit = 5 cents ($0.05)
// Credits are used for both chat and image generation
const CENTS_PER_CREDIT = 5;

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
    aiMonthlyCredits: 0,
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
    aiMonthlyCredits: 0,
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
    aiMonthlyCredits: 200, // 200 credits = $10 value (1 credit = 5¢)
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
    aiMonthlyCredits: 1000, // 1000 credits = $50 value
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
    aiMonthlyCredits: 200, // Same as AI Pro
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
    aiMonthlyCredits: 500,
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

// Convert cents to credits (rounded up)
function centsToCredits(cents: number): number {
  return Math.ceil(cents / CENTS_PER_CREDIT);
}

// Gemini 4K image cost: ~6 cents API cost × 5 margin = 30 cents = 6 credits
const GEMINI_4K_IMAGE_CREDITS = 6;

async function getTeamAIUsageSummary(ctx: any, teamId: Id<"teams">, windowStart: number) {
  const tokenUsage = await ctx.db
    .query("aiTokenUsage")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .filter((q: any) => q.gte(q.field("_creationTime"), windowStart))
    .collect();

  // Chat costs in cents (from stored estimatedCostCents which is API cost)
  const chatApiCostCents = tokenUsage.reduce(
    (sum: number, record: any) => sum + (record.estimatedCostCents || 0),
    0
  );

  const totalTokensUsed = tokenUsage.reduce(
    (sum: number, record: any) => sum + (record.totalTokens || 0),
    0
  );

  const imageUsage = await ctx.db
    .query("aiGeneratedImages")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .filter((q: any) => q.gte(q.field("_creationTime"), windowStart))
    .collect();

  // Image costs: each 4K image = 6 credits
  const imageCreditsUsed = imageUsage.length * GEMINI_4K_IMAGE_CREDITS;

  // Convert chat API cost to credits (with 5x margin, rounded up)
  // API cost × 5 margin / 5 cents per credit = API cost in cents
  const chatCreditsUsed = centsToCredits(chatApiCostCents * 5); // 5x margin

  const totalCreditsUsed = chatCreditsUsed + imageCreditsUsed;

  return {
    tokenUsageCount: tokenUsage.length,
    totalTokensUsed,
    totalCreditsUsed,
    chatCreditsUsed,
    imageCreditsUsed,
    imageCount: imageUsage.length,
    windowStart,
    // Legacy fields for backward compatibility
    aiSpendCents: totalCreditsUsed * CENTS_PER_CREDIT,
  };
}

async function evaluateAIAccess(ctx: any, team: any) {
  const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
  const limits = getEffectiveLimits(team);
  const hasAIFeatures = (limits as any).hasAIFeatures === true;

  if (!hasAIFeatures) {
    return {
      allowed: false,
      message: "🚫 AI features require an AI-enabled subscription.",
      currentPlan: team.subscriptionPlan || "free",
      subscriptionStatus: team.subscriptionStatus || null,
    };
  }

  if (team.subscriptionStatus && !["active", "trialing"].includes(team.subscriptionStatus)) {
    return {
      allowed: false,
      message: "🚫 Your subscription is not active. Please update billing to continue using AI features.",
      currentPlan: team.subscriptionPlan || "free",
      subscriptionStatus: team.subscriptionStatus,
    };
  }

  // Support both new aiMonthlyCredits and legacy aiMonthlySpendLimitCents
  let monthlyCredits = (limits as any).aiMonthlyCredits || 0;

  // Fallback: convert legacy cents to credits if new field not set
  if (monthlyCredits === 0 && (limits as any).aiMonthlySpendLimitCents) {
    // Old system: cents. Convert to credits (1 credit = 5 cents)
    monthlyCredits = Math.ceil((limits as any).aiMonthlySpendLimitCents / CENTS_PER_CREDIT);
  }

  const { start } = getBillingWindow(team);

  // Extra credits (top-ups) - convert from cents to credits if stored in cents
  const extraCreditsActive = team.aiExtraCreditsPeriodStart === start;
  const extraCreditsCentsStored = extraCreditsActive ? team.aiExtraCreditsCents || 0 : 0;
  const extraCredits = centsToCredits(extraCreditsCentsStored);

  if (monthlyCredits > 0 || extraCredits > 0) {
    const usage = await getTeamAIUsageSummary(ctx, team._id as Id<"teams">, start);
    const totalCredits = monthlyCredits + extraCredits;
    const remainingCredits = Math.max(totalCredits - usage.totalCreditsUsed, 0);

    if (usage.totalCreditsUsed >= totalCredits) {
      return {
        allowed: false,
        message: "🔒 Kredyty AI na ten okres zostały wyczerpane. Dokup kredyty, aby kontynuować.",
        currentPlan: plan,
        subscriptionStatus: team.subscriptionStatus || null,
        totalCredits,
        usedCredits: usage.totalCreditsUsed,
        remainingCredits: 0,
        usage,
        extraCredits,
      };
    }

    return {
      allowed: true,
      message: "AI features available",
      currentPlan: plan,
      subscriptionStatus: team.subscriptionStatus || null,
      totalCredits,
      usedCredits: usage.totalCreditsUsed,
      remainingCredits,
      usage,
      extraCredits,
    };
  }

  return {
    allowed: true,
    message: "AI features available",
    currentPlan: team.subscriptionPlan || "free",
    subscriptionStatus: team.subscriptionStatus || null,
    extraCredits: 0,
  };
}

// Manual top-up credits (can be called after Stripe payment or by admin)
export const addAIExtraCredits = mutation({
  args: {
    teamId: v.id("teams"),
    amountCents: v.number(), // cents to add for current billing period
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Only team admin can add credits
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can add AI credits");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const { start } = getBillingWindow(team);
    const currentCredits = team.aiExtraCreditsPeriodStart === start ? team.aiExtraCreditsCents || 0 : 0;
    const newCredits = currentCredits + Math.max(args.amountCents, 0);

    await ctx.db.patch(args.teamId, {
      aiExtraCreditsCents: newCredits,
      aiExtraCreditsPeriodStart: start,
    });

    return {
      success: true,
      aiExtraCreditsCents: newCredits,
      periodStart: start,
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

    const plan = (team.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
    const limits = getEffectiveLimits(team);

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
            message: "Advanced features are not available on your current plan.",
          };
        }
        break;
      }
    }

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

      if (membership && membership.role === "customer") {
        return {
          allowed: false,
          message: "🚫 Customers do not have access to AI features.",
          currentPlan: team.subscriptionPlan || "free",
          subscriptionStatus: team.subscriptionStatus || null,
        };
      }
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

      if (membership && membership.role === "customer") {
        return {
          allowed: false,
          message: "🚫 Customers do not have access to AI features.",
          currentPlan: team.subscriptionPlan || "free",
          subscriptionStatus: team.subscriptionStatus || null,
        };
      }
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
    // New credit-based fields
    totalCredits: v.optional(v.number()),
    usedCredits: v.optional(v.number()),
    remainingCredits: v.optional(v.number()),
    extraCredits: v.optional(v.number()),
    // Usage breakdown
    chatCreditsUsed: v.optional(v.number()),
    imageCreditsUsed: v.optional(v.number()),
    aiImageCount: v.optional(v.number()),
    billingWindowStart: v.optional(v.number()),
    totalTokensUsed: v.optional(v.number()),
    // Legacy fields for backward compatibility
    remainingBudgetCents: v.optional(v.number()),
    aiSpendCents: v.optional(v.number()),
    aiExtraCreditsCents: v.optional(v.number()),
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

    if (membership.role === "customer") {
      return {
        hasAccess: false,
        message: "🚫 Customers do not have access to AI features.",
        currentPlan: team.subscriptionPlan || "free",
        subscriptionStatus: team.subscriptionStatus || null,
        subscriptionLimits: getEffectiveLimits(team),
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
      // New credit fields
      totalCredits: (access as any).totalCredits,
      usedCredits: (access as any).usedCredits,
      remainingCredits: (access as any).remainingCredits,
      extraCredits: (access as any).extraCredits,
      // Usage breakdown
      chatCreditsUsed: (access as any).usage?.chatCreditsUsed,
      imageCreditsUsed: (access as any).usage?.imageCreditsUsed,
      aiImageCount: (access as any).usage?.imageCount,
      billingWindowStart: (access as any).usage?.windowStart,
      totalTokensUsed: (access as any).usage?.totalTokensUsed,
      // Legacy fields
      remainingBudgetCents: (access as any).remainingCredits ? (access as any).remainingCredits * CENTS_PER_CREDIT : undefined,
      aiSpendCents: (access as any).usedCredits ? (access as any).usedCredits * CENTS_PER_CREDIT : undefined,
      aiExtraCreditsCents: (access as any).extraCredits ? (access as any).extraCredits * CENTS_PER_CREDIT : undefined,
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
