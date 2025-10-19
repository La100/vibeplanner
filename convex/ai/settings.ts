import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";

const aiSettingsValidator = v.object({
  _id: v.id("aiSettings"),
  projectId: v.id("projects"),
  teamId: v.id("teams"),
  isEnabled: v.boolean(),
  createdBy: v.string(),
  enabledAt: v.optional(v.number()),
  disabledAt: v.optional(v.number()),
});

export const getAISettings = query({
  args: { projectId: v.id("projects") },
  returns: v.union(aiSettingsValidator, v.null()),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!settings) {
      return null;
    }

    return {
      _id: settings._id,
      projectId: settings.projectId,
      teamId: settings.teamId,
      isEnabled: settings.isEnabled,
      createdBy: settings.createdBy,
      enabledAt: settings.enabledAt,
      disabledAt: settings.disabledAt,
    };
  },
});

export const getAISettingsInternal = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(aiSettingsValidator, v.null()),
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!settings) {
      return null;
    }

    return {
      _id: settings._id,
      projectId: settings.projectId,
      teamId: settings.teamId,
      isEnabled: settings.isEnabled,
      createdBy: settings.createdBy,
      enabledAt: settings.enabledAt,
      disabledAt: settings.disabledAt,
    };
  },
});

export const enableAI = mutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    const timestamp = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isEnabled: true,
        disabledAt: undefined,
        enabledAt: timestamp,
      });
    } else {
      await ctx.db.insert("aiSettings", {
        projectId: args.projectId,
        teamId: args.teamId,
        isEnabled: true,
        createdBy: identity.subject,
        enabledAt: timestamp,
      });
    }

    return {
      success: true,
      message: "AI enabled for this project",
    };
  },
});

// Legacy disable mutation retained for backwards compatibility. No-op to keep AI always enabled.
export const disableAI = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async () => {
    return {
      success: true,
      message: "AI disable ignored; AI remains enabled",
    };
  },
});


