import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Log an activity in the project changelog.
 * This is an internal mutation, so it can only be called from other Convex functions.
 */
export const logActivity = internalMutation({
  args: {
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    actionType: v.string(),
    details: v.any(),
    entityId: v.string(),
  },
  handler: async (ctx, { teamId, projectId, actionType, details, entityId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Should not happen when called from other mutations, but as a safeguard.
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    await ctx.db.insert("activityLog", {
      teamId,
      projectId,
      userId,
      actionType,
      details,
      entityId,
    });
  },
});

/**
 * Get the activity log for a project.
 */
export const getForProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const activities = await ctx.db
      .query("activityLog")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(100); // Get the 100 most recent activities

    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", activity.userId))
          .unique();
        return {
          ...activity,
          userName: user?.name,
          userImageUrl: user?.imageUrl,
        };
      })
    );

    return activitiesWithUsers;
  },
}); 