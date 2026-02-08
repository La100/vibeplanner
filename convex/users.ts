
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

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
        if (args.clerkUserIds.length === 0) {
            return [];
        }
        
        const users = await ctx.db
            .query("users")
            .filter(q => q.or(...args.clerkUserIds.map(id => q.eq(q.field("clerkUserId"), id))))
            .collect();
        
        return users;
    }
});
