import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { SUBSCRIPTION_PLANS } from "./stripe";

// Admin function to manually set team subscription (for testing/admin purposes)
export const setTeamSubscription = mutation({
  args: {
    teamId: v.id("teams"),
    plan: v.union(v.literal("free"), v.literal("basic"), v.literal("pro"), v.literal("enterprise")),
    durationDays: v.optional(v.number()), // Default 30 days
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin of this team (optional security check)
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

    const limits = SUBSCRIPTION_PLANS[args.plan];
    const now = Date.now();
    const durationMs = (args.durationDays || 30) * 24 * 60 * 60 * 1000;
    const endTime = now + durationMs;

    const updateData: any = {
      subscriptionPlan: args.plan,
      subscriptionLimits: limits,
      currentPeriodStart: now,
      currentPeriodEnd: endTime,
      cancelAtPeriodEnd: false,
    };

    if (args.plan === "free") {
      updateData.subscriptionStatus = null;
      updateData.subscriptionId = undefined;
      updateData.stripeCustomerId = undefined;
      updateData.currentPeriodStart = undefined;
      updateData.currentPeriodEnd = undefined;
    } else {
      updateData.subscriptionStatus = "active";
      updateData.subscriptionId = `manual_${team._id}_${now}`;
    }

    await ctx.db.patch(args.teamId, updateData);

    return {
      success: true,
      message: `Team subscription set to ${args.plan} until ${new Date(endTime).toLocaleDateString()}`,
      plan: args.plan,
      limits,
      expiresAt: endTime,
    };
  },
});

// Helper function to get all teams with their subscription info
export const getAllTeamsWithSubscriptions = mutation({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Only allow for admin users - you might want to add additional checks
    const teams = await ctx.db.query("teams").collect();
    
    return teams.map(team => ({
      _id: team._id,
      name: team.name,
      slug: team.slug,
      clerkOrgId: team.clerkOrgId,
      subscriptionPlan: team.subscriptionPlan || "free",
      subscriptionStatus: team.subscriptionStatus,
      subscriptionLimits: team.subscriptionLimits || SUBSCRIPTION_PLANS.free,
      currentPeriodEnd: team.currentPeriodEnd,
    }));
  },
});

// Function to extend current subscription
export const extendTeamSubscription = mutation({
  args: {
    teamId: v.id("teams"),
    additionalDays: v.number(),
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

    const currentEnd = team.currentPeriodEnd || Date.now();
    const extensionMs = args.additionalDays * 24 * 60 * 60 * 1000;
    const newEndTime = currentEnd + extensionMs;

    await ctx.db.patch(args.teamId, {
      currentPeriodEnd: newEndTime,
    });

    return {
      success: true,
      message: `Subscription extended by ${args.additionalDays} days`,
      newExpiryDate: new Date(newEndTime).toLocaleDateString(),
    };
  },
});