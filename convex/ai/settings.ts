import { v } from "convex/values";
import { internalQuery, internalMutation, query, mutation } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

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
      indexingEnabled: v.optional(v.boolean()),
      createdBy: v.string(),
      enabledAt: v.optional(v.number()),
      disabledAt: v.optional(v.number()),
      lastAutoIndexAt: v.optional(v.number()),
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
      indexingEnabled: v.optional(v.boolean()),
      createdBy: v.string(),
      enabledAt: v.optional(v.number()),
      disabledAt: v.optional(v.number()),
      lastAutoIndexAt: v.optional(v.number()),
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
        indexingEnabled: existingSettings.indexingEnabled ?? false, // Ensure field exists
        enabledAt: Date.now(),
      });
      return existingSettings._id;
    }

    // Create new AI settings
    const aiSettingsId = await ctx.db.insert("aiSettings", {
      projectId: args.projectId,
      teamId: project.teamId,
      isEnabled: true,
      indexingEnabled: false, // Default to false, user can enable later
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

/**
 * Toggle indexing for a project (public function)
 */
export const toggleIndexing = mutation({
  args: { projectId: v.id("projects") },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    indexingEnabled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Find AI settings for this project
    const aiSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (!aiSettings) {
      throw new Error("AI settings not found for this project");
    }

    if (!aiSettings.isEnabled) {
      throw new Error("AI must be enabled before indexing can be turned on");
    }

    // Toggle indexing setting
    const newIndexingState = !aiSettings.indexingEnabled;
    await ctx.db.patch(aiSettings._id, {
      indexingEnabled: newIndexingState,
      lastAutoIndexAt: newIndexingState ? Date.now() : aiSettings.lastAutoIndexAt,
    });

    // If enabling indexing, trigger automatic re-indexing of all project data
    if (newIndexingState) {
      try {
        // Schedule re-indexing in the background
        await ctx.scheduler.runAfter(1000, "ai.rag:indexAllProjectData" as any, {
          projectId: args.projectId
        });

        return {
          success: true,
          message: "Indexing enabled - re-indexing all project data in background",
          indexingEnabled: newIndexingState,
        };
      } catch (error) {
        console.warn("Failed to schedule automatic re-indexing:", error);
        return {
          success: true,
          message: "Indexing enabled - please manually re-index data",
          indexingEnabled: newIndexingState,
        };
      }
    }

    return {
      success: true,
      message: "Indexing disabled",
      indexingEnabled: newIndexingState,
    };
  },
});

/**
 * Update last auto-index timestamp (internal function)
 */
export const updateLastAutoIndex = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find AI settings for this project
    const aiSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (aiSettings) {
      await ctx.db.patch(aiSettings._id, {
        lastAutoIndexAt: Date.now(),
      });
    }

    return null;
  },
});
