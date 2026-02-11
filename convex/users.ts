import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get a user by their Clerk ID. 
 * Returns the user document or null if not found.
 */
export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  returns: v.union(v.object({
    _id: v.id("users"),
    _creationTime: v.number(),
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    preferredName: v.optional(v.union(v.string(), v.null())),
    preferredLanguage: v.optional(v.union(v.string(), v.null())),
    age: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(v.union(
      v.literal("female"),
      v.literal("male"),
      v.literal("nonbinary"),
      v.literal("prefer_not_to_say"),
      v.literal("other"),
    )),
    genderOther: v.optional(v.union(v.string(), v.null())),
    workMode: v.optional(v.union(
      v.literal("office"),
      v.literal("home"),
      v.literal("hybrid"),
      v.literal("other"),
    )),
    workModeOther: v.optional(v.union(v.string(), v.null())),
    onboardingCompletedAt: v.optional(v.number()),
  }), v.null()),
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    return user;
  },
});

export const getMyOnboardingProfile = query({
  args: {},
  returns: v.union(v.null(), v.object({
    completed: v.boolean(),
    preferredName: v.optional(v.union(v.string(), v.null())),
    preferredLanguage: v.optional(v.union(v.string(), v.null())),
    age: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(v.union(
      v.literal("female"),
      v.literal("male"),
      v.literal("nonbinary"),
      v.literal("prefer_not_to_say"),
      v.literal("other"),
    )),
    genderOther: v.optional(v.union(v.string(), v.null())),
    workMode: v.optional(v.union(
      v.literal("office"),
      v.literal("home"),
      v.literal("hybrid"),
      v.literal("other"),
    )),
    workModeOther: v.optional(v.union(v.string(), v.null())),
    onboardingCompletedAt: v.optional(v.number()),
  })),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) return null;

    return {
      completed: typeof user.onboardingCompletedAt === "number",
      preferredName: user.preferredName,
      preferredLanguage: user.preferredLanguage,
      age: user.age,
      gender: user.gender,
      genderOther: user.genderOther,
      workMode: user.workMode,
      workModeOther: user.workModeOther,
      onboardingCompletedAt: user.onboardingCompletedAt,
    };
  },
});

const genderValidator = v.union(
  v.literal("female"),
  v.literal("male"),
);

const workModeValidator = v.union(
  v.literal("office"),
  v.literal("home"),
  v.literal("hybrid"),
  v.literal("other"),
);

export const saveUserOnboardingProfileInternal = internalMutation({
  args: {
    clerkUserId: v.string(),
    preferredName: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    age: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(genderValidator),
    genderOther: v.optional(v.string()),
    workMode: v.optional(workModeValidator),
    workModeOther: v.optional(v.string()),
    complete: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    completed: v.boolean(),
  }),
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const patch: Record<string, unknown> = {};

    if (args.preferredName !== undefined) {
      const trimmed = args.preferredName.trim();
      patch.preferredName = trimmed.length > 0 ? trimmed : null;
    }
    if (args.preferredLanguage !== undefined) {
      const trimmed = args.preferredLanguage.trim();
      patch.preferredLanguage = trimmed.length > 0 ? trimmed : null;
    }
    if (args.age !== undefined) patch.age = args.age;
    if (args.gender !== undefined) patch.gender = args.gender;
    if (args.genderOther !== undefined) {
      const trimmed = args.genderOther.trim();
      patch.genderOther = trimmed.length > 0 ? trimmed : null;
    }
    if (args.workMode !== undefined) patch.workMode = args.workMode;
    if (args.workModeOther !== undefined) {
      const trimmed = args.workModeOther.trim();
      patch.workModeOther = trimmed.length > 0 ? trimmed : null;
    }

    const shouldComplete = args.complete === true;
    if (shouldComplete) {
      patch.onboardingCompletedAt = Date.now();
    }

    await ctx.db.patch(user._id, patch);

    const completed = shouldComplete || typeof user.onboardingCompletedAt === "number";
    return { success: true, completed };
  },
});

export const saveMyOnboardingProfile = mutation({
  args: {
    preferredName: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    age: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(genderValidator),
    genderOther: v.optional(v.string()),
    workMode: v.optional(workModeValidator),
    workModeOther: v.optional(v.string()),
    complete: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    completed: v.boolean(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const patch: Record<string, unknown> = {};

    if (args.preferredName !== undefined) {
      const trimmed = args.preferredName.trim();
      patch.preferredName = trimmed.length > 0 ? trimmed : null;
    }
    if (args.preferredLanguage !== undefined) {
      const trimmed = args.preferredLanguage.trim();
      patch.preferredLanguage = trimmed.length > 0 ? trimmed : null;
    }
    if (args.age !== undefined) patch.age = args.age;
    if (args.gender !== undefined) patch.gender = args.gender;
    if (args.genderOther !== undefined) {
      const trimmed = args.genderOther.trim();
      patch.genderOther = trimmed.length > 0 ? trimmed : null;
    }
    if (args.workMode !== undefined) patch.workMode = args.workMode;
    if (args.workModeOther !== undefined) {
      const trimmed = args.workModeOther.trim();
      patch.workModeOther = trimmed.length > 0 ? trimmed : null;
    }

    const shouldComplete = args.complete === true;
    if (shouldComplete) {
      patch.onboardingCompletedAt = Date.now();
    }

    await ctx.db.patch(user._id, patch);

    const completed = shouldComplete || typeof user.onboardingCompletedAt === "number";
    return { success: true, completed };
  },
});

/**
 * Get a list of users by their Clerk IDs.
 * Useful for fetching data for multiple users at once (e.g., team members, assignees).
 * @param clerkUserIds - An array of Clerk user IDs.
 * @returns A list of user documents.
 */
export const getByClerkIds = query({
    args: { clerkUserIds: v.array(v.string()) },
    async handler(ctx, args) {
      const uniqueIds = [...new Set(args.clerkUserIds.filter(Boolean))];
      if (uniqueIds.length === 0) return [];

      const users = await Promise.all(
        uniqueIds.map((clerkUserId) =>
          ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
            .unique()
        )
      );

      return users.filter((user): user is NonNullable<typeof user> => Boolean(user));
    }
});

// ====== SUBSCRIPTION & BILLING (migrated from teams) ======

/** Get current user's subscription info */
export const getMySubscription = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) return null;

    return {
      stripeCustomerId: user.stripeCustomerId,
      subscriptionStatus: user.subscriptionStatus || null,
      subscriptionPlan: user.subscriptionPlan || "free",
      subscriptionId: user.subscriptionId,
      subscriptionPriceId: user.subscriptionPriceId,
      currentPeriodStart: user.currentPeriodStart,
      currentPeriodEnd: user.currentPeriodEnd,
      trialEnd: user.trialEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
      subscriptionLimits: user.subscriptionLimits,
      aiTokens: user.aiTokens,
      timezone: user.timezone,
    };
  },
});

/** Internal query to get user for Stripe operations */
export const getUserForStripe = internalQuery({
  args: { clerkUserId: v.string() },
  async handler(ctx, args) {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});

/** Internal mutation to update user's Stripe customer ID */
export const updateUserStripeCustomer = internalMutation({
  args: {
    clerkUserId: v.string(),
    stripeCustomerId: v.string(),
  },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { stripeCustomerId: args.stripeCustomerId });
  },
});

/** Internal mutation to sync user subscription from Stripe */
export const syncUserSubscriptionFromStripe = internalMutation({
  args: {
    clerkUserId: v.string(),
    subscriptionId: v.string(),
    status: v.string(),
    priceId: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    plan: v.string(),
    limits: v.any(),
  },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) {
      console.log(`User ${args.clerkUserId} not found for subscription sync`);
      return;
    }

    await ctx.db.patch(user._id, {
      subscriptionId: args.subscriptionId,
      subscriptionStatus: args.status as any,
      subscriptionPlan: args.plan as any,
      subscriptionPriceId: args.priceId,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      subscriptionLimits: args.limits,
    });

    console.log(`User ${args.clerkUserId} subscription synced: plan=${args.plan}, status=${args.status}`);
  },
});

/** Internal mutation to reset user to free plan */
export const resetUserToFree = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
    if (!user) return;

    await ctx.db.patch(user._id, {
      subscriptionStatus: null,
      subscriptionId: undefined,
      subscriptionPlan: "free",
      subscriptionPriceId: undefined,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      trialEnd: undefined,
      cancelAtPeriodEnd: false,
    });
  },
});

/** Update user timezone */
export const updateMyTimezone = mutation({
  args: { timezone: v.string() },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { timezone: args.timezone });
    return { success: true };
  },
});

/** Migration: copy billing fields from team to user (one-time) */
export const migrateTeamBillingToUser = internalMutation({
  args: {},
  async handler(ctx) {
    const teams = await ctx.db.query("teams").collect();
    let migrated = 0;

    for (const team of teams) {
      if (!team.ownerUserId) continue;

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", team.ownerUserId!))
        .unique();

      if (!user) continue;

      // Only migrate if user doesn't already have subscription data
      if (user.stripeCustomerId || user.subscriptionId) continue;

      const patch: Record<string, unknown> = {};
      if (team.stripeCustomerId) patch.stripeCustomerId = team.stripeCustomerId;
      if (team.subscriptionStatus) patch.subscriptionStatus = team.subscriptionStatus;
      if (team.subscriptionId) patch.subscriptionId = team.subscriptionId;
      if (team.subscriptionPlan) patch.subscriptionPlan = team.subscriptionPlan;
      if (team.subscriptionPriceId) patch.subscriptionPriceId = team.subscriptionPriceId;
      if (team.currentPeriodStart) patch.currentPeriodStart = team.currentPeriodStart;
      if (team.currentPeriodEnd) patch.currentPeriodEnd = team.currentPeriodEnd;
      if (team.trialEnd) patch.trialEnd = team.trialEnd;
      if (team.cancelAtPeriodEnd !== undefined) patch.cancelAtPeriodEnd = team.cancelAtPeriodEnd;
      if (team.subscriptionLimits) patch.subscriptionLimits = team.subscriptionLimits;
      if (team.aiTokens !== undefined) patch.aiTokens = team.aiTokens;
      if (team.timezone) patch.timezone = team.timezone;

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(user._id, patch);
        migrated++;
      }
    }

    console.log(`Migrated billing data from ${migrated} teams to users`);
    return { migrated };
  },
});
