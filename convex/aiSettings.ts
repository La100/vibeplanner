import { v } from "convex/values";
import { internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";

/**
 * Get AI settings for a project (internal function)
 */
export const getAISettingsInternal = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("aiSettings"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      isEnabled: v.boolean(),
      createdBy: v.string(),
      enabledAt: v.optional(v.number()),
      disabledAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const aiSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    
    return aiSettings;
  },
});

/**
 * Get AI settings for a project (public function)
 */
export const getAISettings = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("aiSettings"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      isEnabled: v.boolean(),
      createdBy: v.string(),
      enabledAt: v.optional(v.number()),
      disabledAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user has access to this project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user is member of the team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this team");
    }

    const aiSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    
    return aiSettings;
  },
});

/**
 * Enable AI for a project
 */
export const enableAI = mutation({
  args: { projectId: v.id("projects") },
  returns: v.id("aiSettings"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user has access to this project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user is member of the team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this team");
    }

    // Check if AI settings already exist
    const existingSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (existingSettings) {
      // Update existing settings to enable AI
      await ctx.db.patch(existingSettings._id, {
        isEnabled: true,
        enabledAt: Date.now(),
      });
      return existingSettings._id;
    }

    // Create new AI settings
    const aiSettingsId = await ctx.db.insert("aiSettings", {
      projectId: args.projectId,
      teamId: project.teamId,
      isEnabled: true,
      createdBy: identity.subject,
      enabledAt: Date.now(),
    });

    return aiSettingsId;
  },
});

/**
 * Disable AI for a project
 */
export const disableAI = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user has access to this project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user is member of the team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this team");
    }

    // Find and disable AI settings
    const aiSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (aiSettings) {
      await ctx.db.patch(aiSettings._id, {
        isEnabled: false,
        disabledAt: Date.now(),
      });
    }

    return null;
  },
});
