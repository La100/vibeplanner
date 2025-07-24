import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { SUBSCRIPTION_PLANS } from "./stripe";

// 🚀 QUICK ADMIN: Set team subscription by ID (paste team ID and it changes)
export const quickSetTeamPro = mutation({
  args: {
    teamId: v.string(), // Paste team ID here as string
  },
  async handler(ctx, args) {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    
    if (!team) {
      throw new Error(`Team not found with ID: ${args.teamId}`);
    }

    const limits = SUBSCRIPTION_PLANS.pro;
    const now = Date.now();
    const endTime = now + (30 * 24 * 60 * 60 * 1000); // 30 days

    await ctx.db.patch(teamId, {
      subscriptionPlan: "pro",
      subscriptionStatus: "active",
      subscriptionId: `manual_pro_${teamId}_${now}`,
      subscriptionLimits: limits,
      currentPeriodStart: now,
      currentPeriodEnd: endTime,
      cancelAtPeriodEnd: false,
    });

    return {
      success: true,
      message: `✅ Team "${team.name}" upgraded to Pro until ${new Date(endTime).toLocaleDateString()}`,
      teamName: team.name,
      plan: "pro",
      limits,
      expiresAt: new Date(endTime).toLocaleDateString(),
    };
  },
});

// Quick set to Basic
export const quickSetTeamBasic = mutation({
  args: {
    teamId: v.string(),
  },
  async handler(ctx, args) {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    
    if (!team) {
      throw new Error(`Team not found with ID: ${args.teamId}`);
    }

    const limits = SUBSCRIPTION_PLANS.basic;
    const now = Date.now();
    const endTime = now + (30 * 24 * 60 * 60 * 1000);

    await ctx.db.patch(teamId, {
      subscriptionPlan: "basic",
      subscriptionStatus: "active",
      subscriptionId: `manual_basic_${teamId}_${now}`,
      subscriptionLimits: limits,
      currentPeriodStart: now,
      currentPeriodEnd: endTime,
      cancelAtPeriodEnd: false,
    });

    return {
      success: true,
      message: `✅ Team "${team.name}" set to Basic until ${new Date(endTime).toLocaleDateString()}`,
      teamName: team.name,
      plan: "basic",
      limits,
      expiresAt: new Date(endTime).toLocaleDateString(),
    };
  },
});

// Quick set to Enterprise
export const quickSetTeamEnterprise = mutation({
  args: {
    teamId: v.string(),
  },
  async handler(ctx, args) {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    
    if (!team) {
      throw new Error(`Team not found with ID: ${args.teamId}`);
    }

    const limits = SUBSCRIPTION_PLANS.enterprise;
    const now = Date.now();
    const endTime = now + (30 * 24 * 60 * 60 * 1000);

    await ctx.db.patch(teamId, {
      subscriptionPlan: "enterprise",
      subscriptionStatus: "active",
      subscriptionId: `manual_enterprise_${teamId}_${now}`,
      subscriptionLimits: limits,
      currentPeriodStart: now,
      currentPeriodEnd: endTime,
      cancelAtPeriodEnd: false,
    });

    return {
      success: true,
      message: `✅ Team "${team.name}" upgraded to Enterprise until ${new Date(endTime).toLocaleDateString()}`,
      teamName: team.name,
      plan: "enterprise", 
      limits,
      expiresAt: new Date(endTime).toLocaleDateString(),
    };
  },
});

// Reset to Free
export const quickSetTeamFree = mutation({
  args: {
    teamId: v.string(),
  },
  async handler(ctx, args) {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    
    if (!team) {
      throw new Error(`Team not found with ID: ${args.teamId}`);
    }

    await ctx.db.patch(teamId, {
      subscriptionPlan: "free",
      subscriptionStatus: null,
      subscriptionId: undefined,
      subscriptionLimits: SUBSCRIPTION_PLANS.free,
      currentPeriodStart: undefined,
      currentPeriodEnd: undefined,
      cancelAtPeriodEnd: false,
    });

    return {
      success: true,
      message: `✅ Team "${team.name}" reset to Free plan`,
      teamName: team.name,
      plan: "free",
      limits: SUBSCRIPTION_PLANS.free,
    };
  },
});

// Get team info (to see current status)
export const getTeamInfo = mutation({
  args: {
    teamId: v.string(),
  },
  async handler(ctx, args) {
    const teamId = args.teamId as Id<"teams">;
    const team = await ctx.db.get(teamId);
    
    if (!team) {
      throw new Error(`Team not found with ID: ${args.teamId}`);
    }

    return {
      _id: team._id,
      name: team.name,
      slug: team.slug,
      clerkOrgId: team.clerkOrgId,
      subscriptionPlan: team.subscriptionPlan || "free",
      subscriptionStatus: team.subscriptionStatus,
      subscriptionLimits: team.subscriptionLimits || SUBSCRIPTION_PLANS.free,
      currentPeriodEnd: team.currentPeriodEnd ? new Date(team.currentPeriodEnd).toLocaleDateString() : null,
    };
  },
}); 