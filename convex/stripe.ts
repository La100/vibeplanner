import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { AI_MODEL, calculateCost } from "./ai/config";

const DEFAULT_BILLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FREE_TRIAL_AI_BUDGET_USD = 1;
const PRO_AI_BUDGET_USD = 9;
const SCALE_AI_BUDGET_USD = 25;
const TOKEN_EQ_COST_PER_1M_USD = 5;

const tokenBudgetFromUsd = (usd: number) =>
  Math.max(0, Math.floor((usd / TOKEN_EQ_COST_PER_1M_USD) * 1_000_000));

// Stripe subscription plans configuration
export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free",
    maxProjects: 1,
    maxTeamMembers: 1,
    maxStorageGB: 1,
    hasAdvancedFeatures: false,
    hasAIFeatures: true,
    price: 0,
    aiMonthlyTokens: tokenBudgetFromUsd(FREE_TRIAL_AI_BUDGET_USD),
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
    maxProjects: 4,
    maxTeamMembers: 25,
    maxStorageGB: 50,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 29,
    aiMonthlyTokens: tokenBudgetFromUsd(PRO_AI_BUDGET_USD),
  },
  ai_scale: {
    id: "ai_scale",
    name: "AI Scale",
    maxProjects: 10,
    maxTeamMembers: 25,
    maxStorageGB: 50,
    hasAdvancedFeatures: true,
    hasAIFeatures: true,
    price: 49,
    aiMonthlyTokens: tokenBudgetFromUsd(SCALE_AI_BUDGET_USD),
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
    aiMonthlyTokens: 5000000,
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
    aiMonthlyTokens: 12500000,
  },
} as const;

// Helper: get authenticated user doc
async function getAuthenticatedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", identity.subject))
    .unique();
}

function getEffectiveLimits(source: any) {
  const plan = (source.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
  const defaultLimits = SUBSCRIPTION_PLANS[plan];
  const storedLimits = source.subscriptionLimits;

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

export function getBillingWindow(source: any) {
  const now = Date.now();
  const start = typeof source?.currentPeriodStart === "number"
    ? source.currentPeriodStart
    : now - DEFAULT_BILLING_WINDOW_MS;
  const end = typeof source?.currentPeriodEnd === "number"
    ? source.currentPeriodEnd
    : now + DEFAULT_BILLING_WINDOW_MS;
  return { start, end };
}

// Helper: find user by team ownership
async function getUserByTeam(ctx: any, teamId: Id<"teams">) {
  const team = await ctx.db.get(teamId);
  if (!team?.ownerUserId) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", team.ownerUserId))
    .unique();
}

export const ensureBillingWindow = mutation({
  args: { teamId: v.id("teams") },
  returns: v.object({
    updated: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  }),
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();
    const hasStart = typeof user.currentPeriodStart === "number";
    const hasEnd = typeof user.currentPeriodEnd === "number";
    const start = hasStart ? user.currentPeriodStart! : now;
    const end = hasEnd ? user.currentPeriodEnd! : now + DEFAULT_BILLING_WINDOW_MS;

    const canOverride =
      !user.stripeCustomerId ||
      (user.subscriptionStatus !== "active" && user.subscriptionStatus !== "trialing");
    const needsUpdate =
      canOverride &&
      (!hasStart || !hasEnd || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end < now);

    if (!needsUpdate) {
      return { updated: false, currentPeriodStart: start, currentPeriodEnd: end };
    }

    const currentPeriodStart = now;
    const currentPeriodEnd = now + DEFAULT_BILLING_WINDOW_MS;
    await ctx.db.patch(user._id, { currentPeriodStart, currentPeriodEnd });
    return { updated: true, currentPeriodStart, currentPeriodEnd };
  },
});

async function evaluateAIAccess(ctx: any, user: any) {
  const plan = (user.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
  const limits = getEffectiveLimits(user);
  const subscriptionStatus = user.subscriptionStatus || null;
  const isActive = subscriptionStatus === "active";
  const isTrialing = subscriptionStatus === "trialing";

  let teamId: Id<"teams"> | null = null;
  if (user._id && user.clerkUserId) {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q: any) => q.eq("ownerUserId", user.clerkUserId))
      .unique();
    teamId = team?._id ?? null;
  } else if (user._id) {
    teamId = user._id as Id<"teams">;
  }

  let usedTokens = 0;
  if (teamId) {
    const { start, end } = getBillingWindow(user);
    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_team", (q: any) => q.eq("teamId", teamId!))
      .filter((q: any) =>
        q.and(
          q.gte(q.field("_creationTime"), start),
          q.lte(q.field("_creationTime"), end)
        )
      )
      .collect();

    usedTokens = usage.reduce((sum: number, record: any) => sum + (record.totalTokens || 0), 0);
  }

  // Free and trial plans get starter AI token access.
  const hasAiAccess = limits.hasAIFeatures || plan === "free" || isTrialing;
  if (!hasAiAccess) {
    return {
      allowed: false,
      message: "AI features are unavailable for the current subscription.",
      currentPlan: plan,
      subscriptionStatus,
      totalTokens: 0,
      usedTokens,
      remainingTokens: 0,
    };
  }

  // If subscription is inactive and not in trial, block paid plans.
  if (plan !== "free" && !isActive && !isTrialing) {
    return {
      allowed: false,
      message: "Subscription inactive. Renew to continue using AI tokens.",
      currentPlan: plan,
      subscriptionStatus,
      totalTokens: limits.aiMonthlyTokens || 0,
      usedTokens,
      remainingTokens: 0,
    };
  }

  const totalTokens = Math.max(0, limits.aiMonthlyTokens || 0);
  const remainingTokens = Math.max(0, totalTokens - usedTokens);
  const allowed = remainingTokens > 0;

  return {
    allowed,
    message: allowed
      ? "AI tokens available."
      : "Monthly AI token limit reached. Upgrade to continue using AI.",
    currentPlan: plan,
    subscriptionStatus,
    totalTokens,
    usedTokens,
    remainingTokens,
  };
}

export const addAITokens = mutation({
  args: {
    teamId: v.id("teams"),
    tokens: v.number(),
  },
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const currentTokens = user.aiTokens || 0;
    const newTokens = currentTokens + Math.max(args.tokens, 0);
    await ctx.db.patch(user._id, { aiTokens: newTokens });
    return { success: true, aiTokens: newTokens };
  },
});

// Get subscription info (reads from user)
export const getTeamSubscription = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const plan = (user.subscriptionPlan || "free") as keyof typeof SUBSCRIPTION_PLANS;
    return {
      teamId: args.teamId,
      subscriptionStatus: user.subscriptionStatus || null,
      subscriptionPlan: plan,
      subscriptionId: user.subscriptionId,
      stripeCustomerId: user.stripeCustomerId,
      currentPeriodStart: user.currentPeriodStart,
      currentPeriodEnd: user.currentPeriodEnd,
      trialEnd: user.trialEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
      limits: getEffectiveLimits(user),
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

// Internal: update team's Stripe customer ID (also updates user)
export const updateTeamStripeCustomer = internalMutation({
  args: {
    teamId: v.id("teams"),
    stripeCustomerId: v.string(),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.teamId, { stripeCustomerId: args.stripeCustomerId });
    const user = await getUserByTeam(ctx, args.teamId);
    if (user) {
      await ctx.db.patch(user._id, { stripeCustomerId: args.stripeCustomerId });
    }
  },
});

// Internal: sync subscription from Stripe (writes to both team + user)
export const syncTeamSubscriptionFromStripe = internalMutation({
  args: {
    teamId: v.string(),
    stripeSubscriptionId: v.string(),
    userId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscription,
      { stripeSubscriptionId: args.stripeSubscriptionId }
    );
    if (!subscription) {
      console.log(`Subscription ${args.stripeSubscriptionId} not found in Stripe component`);
      return;
    }

    const plan = determinePlanFromPriceId(subscription.priceId);
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;
    const patch = {
      subscriptionId: subscription.stripeSubscriptionId,
      subscriptionStatus: subscription.status as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: subscription.priceId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      subscriptionLimits: limits,
    };

    // Update team
    await ctx.db.patch(args.teamId as Id<"teams">, patch);

    // Update user
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    const clerkUserId = args.userId || team?.ownerUserId;
    if (clerkUserId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
        .unique();
      if (user) await ctx.db.patch(user._id, patch);
    }

    console.log(`Subscription synced: plan=${plan}, status=${subscription.status}`);
  },
});

function determinePlanFromPriceId(priceId: string): string {
  const aiPriceId = process.env.STRIPE_AI_PRICE_ID;
  const aiScalePriceId = process.env.STRIPE_AI_SCALE_PRICE_ID;
  if (aiScalePriceId && priceId === aiScalePriceId) return "ai_scale";
  if (aiPriceId && priceId === aiPriceId) return "ai";
  return "ai";
}

export const updateTeamToFree = internalMutation({
  args: { teamId: v.string() },
  async handler(ctx, args) {
    const freePatch = {
      subscriptionStatus: null as null,
      subscriptionId: undefined as undefined,
      subscriptionPlan: "free" as const,
      subscriptionPriceId: undefined as undefined,
      currentPeriodStart: undefined as undefined,
      currentPeriodEnd: undefined as undefined,
      trialEnd: undefined as undefined,
      cancelAtPeriodEnd: false,
      subscriptionLimits: SUBSCRIPTION_PLANS.free,
    };

    await ctx.db.patch(args.teamId as Id<"teams">, freePatch);

    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (team?.ownerUserId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", team.ownerUserId!))
        .unique();
      if (user) await ctx.db.patch(user._id, freePatch);
    }
  },
});

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
    const patch = {
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.status as any,
      subscriptionPlan: planKey,
      subscriptionPriceId: args.priceId,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      subscriptionLimits: limits,
    };

    await ctx.db.patch(args.teamId, patch);
    const user = await getUserByTeam(ctx, args.teamId);
    if (user) await ctx.db.patch(user._id, patch);

    console.log(`Subscription synced directly: plan=${plan}, status=${args.status}`);
    return { success: true, plan, status: args.status };
  },
});

export const fixTeamAIAccess = internalMutation({
  args: { teamId: v.string() },
  async handler(ctx, args) {
    const team = await ctx.db.get(args.teamId as Id<"teams">);
    if (!team) throw new Error("Team not found");

    const plan = team.subscriptionPlan || "free";
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;
    await ctx.db.patch(args.teamId as Id<"teams">, { subscriptionLimits: limits });
    return { success: true, plan, limits };
  },
});

export const refreshTeamLimits = mutation({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const plan = user.subscriptionPlan || "free";
    const planKey = plan as keyof typeof SUBSCRIPTION_PLANS;
    const limits = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.free;
    await ctx.db.patch(user._id, { subscriptionLimits: limits });
    await ctx.db.patch(args.teamId, { subscriptionLimits: limits });
    return { success: true, plan, limits };
  },
});

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
    if (!identity) throw new Error("Not authenticated");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
    if (!membership || !membership.isActive) throw new Error("Not authorized");

    const user = await getAuthenticatedUser(ctx);
    const source = user || team;
    const limits = getEffectiveLimits(source);

    if (args.action === "create_project") {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .collect();
      const used = projects.length;
      return {
        allowed: used < limits.maxProjects,
        used,
        limit: limits.maxProjects,
      };
    }

    if (args.action === "add_member") {
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      const used = members.length;
      return {
        allowed: used < limits.maxTeamMembers,
        used,
        limit: limits.maxTeamMembers,
      };
    }

    if (args.action === "use_advanced_features") {
      return { allowed: !!limits.hasAdvancedFeatures };
    }

    return { allowed: true };
  },
});

export const checkAIFeatureAccessByProject = internalQuery({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) return { allowed: false, message: "Project not found" };

    const user = await getUserByTeam(ctx, project.teamId);
    const source = user || await ctx.db.get(project.teamId);
    if (!source) return { allowed: false, message: "Team not found" };

    const access = await evaluateAIAccess(ctx, source);
    return { ...access, limits: getEffectiveLimits(source) };
  },
});

export const checkAIFeatureAccess = internalQuery({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const user = await getUserByTeam(ctx, args.teamId);
    const source = user || await ctx.db.get(args.teamId);
    if (!source) return { allowed: false, message: "Team not found" };

    const access = await evaluateAIAccess(ctx, source);
    return { ...access, limits: getEffectiveLimits(source) };
  },
});

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
    totalTokens: v.optional(v.number()),
    usedTokens: v.optional(v.number()),
    remainingTokens: v.optional(v.number()),
  }),
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return { hasAccess: false, message: "Not authenticated", currentPlan: "free", subscriptionStatus: null };
    }

    const access = await evaluateAIAccess(ctx, user);
    return {
      hasAccess: access.allowed,
      message: access.message || (access.allowed ? "AI features available" : "AI features unavailable"),
      currentPlan: user.subscriptionPlan || "free",
      subscriptionStatus: user.subscriptionStatus || null,
      subscriptionLimits: getEffectiveLimits(user),
      totalTokens: access.totalTokens,
      usedTokens: access.usedTokens,
      remainingTokens: access.remainingTokens,
    };
  },
});

export const getUserSubscriptions = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, { userId: identity.subject });
  },
});

export const getUserPayments = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.runQuery(components.stripe.public.listPaymentsByUserId, { userId: identity.subject });
  },
});

export const getUserInvoices = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.runQuery(components.stripe.public.listInvoicesByUserId, { userId: identity.subject });
  },
});

export const getTeamSubscriptionsFromStripe = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) return [];

    const team = await ctx.db.get(args.teamId);
    const stripeCustomerId = user.stripeCustomerId || team?.stripeCustomerId;
    if (!stripeCustomerId) return [];

    return await ctx.runQuery(components.stripe.public.listSubscriptions, { stripeCustomerId });
  },
});

export const getTeamPayments = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const user = await getAuthenticatedUser(ctx);
    if (!user) return [];

    const team = await ctx.db.get(args.teamId);
    const stripeCustomerId = user.stripeCustomerId || team?.stripeCustomerId;
    if (!stripeCustomerId) return [];

    const payments = await ctx.runQuery(components.stripe.public.listPayments, { stripeCustomerId });
    return payments.sort((a, b) => b.created - a.created);
  },
});

export const getSubscriptionConfig = query({
  args: {},
  handler: async () => {
    return {
      proPriceId: process.env.STRIPE_AI_PRICE_ID,
      scalePriceId: process.env.STRIPE_AI_SCALE_PRICE_ID,
      proMonthlyPrice: SUBSCRIPTION_PLANS.ai.price,
      scaleMonthlyPrice: SUBSCRIPTION_PLANS.ai_scale.price,
    };
  },
});
