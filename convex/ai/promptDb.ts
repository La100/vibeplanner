import { v } from "convex/values";
import { query, mutation, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ====== AI CUSTOM PROMPTS MANAGEMENT ======

/**
 * Get the active custom prompt for a project
 * Returns null if no custom prompt is set (will use default)
 */
export const getActiveCustomPrompt = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("aiCustomPrompts"),
      customPrompt: v.string(),
      createdBy: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // TODO: Add proper access control check

    const activePrompt = await ctx.db
      .query("aiCustomPrompts")
      .withIndex("by_project_and_active", (q) => 
        q.eq("projectId", args.projectId).eq("isActive", true)
      )
      .first();

    return activePrompt;
  },
});

/**
 * Internal function to get active custom prompt (used by AI system)
 */
export const getActiveCustomPromptInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const activePrompt = await ctx.db
      .query("aiCustomPrompts")
      .withIndex("by_project_and_active", (q) => 
        q.eq("projectId", args.projectId).eq("isActive", true)
      )
      .first();

    return activePrompt ? activePrompt.customPrompt : null;
  },
});

/**
 * Save or update custom prompt for a project
 */
export const saveCustomPrompt = mutation({
  args: {
    projectId: v.id("projects"),
    customPrompt: v.string(),
  },
  returns: v.id("aiCustomPrompts"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get project to verify access and get teamId
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // TODO: Add proper access control check (user must be member of team)

    const now = Date.now();

    // Deactivate any existing custom prompt for this project
    const existingPrompts = await ctx.db
      .query("aiCustomPrompts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const prompt of existingPrompts) {
      if (prompt.isActive) {
        await ctx.db.patch(prompt._id, { isActive: false });
      }
    }

    // Create new custom prompt
    const promptId = await ctx.db.insert("aiCustomPrompts", {
      projectId: args.projectId,
      teamId: project.teamId,
      customPrompt: args.customPrompt.trim(),
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    return promptId;
  },
});

/**
 * Update existing custom prompt
 */
export const updateCustomPrompt = mutation({
  args: {
    promptId: v.id("aiCustomPrompts"),
    customPrompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existingPrompt = await ctx.db.get(args.promptId);
    if (!existingPrompt) throw new Error("Custom prompt not found");

    // TODO: Add proper access control check

    await ctx.db.patch(args.promptId, {
      customPrompt: args.customPrompt.trim(),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Reset to default prompt (deactivate custom prompt)
 */
export const resetToDefaultPrompt = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // TODO: Add proper access control check

    // Deactivate all custom prompts for this project
    const activePrompts = await ctx.db
      .query("aiCustomPrompts")
      .withIndex("by_project_and_active", (q) => 
        q.eq("projectId", args.projectId).eq("isActive", true)
      )
      .collect();

    for (const prompt of activePrompts) {
      await ctx.db.patch(prompt._id, { isActive: false });
    }

    return null;
  },
});

/**
 * Get prompt history for a project
 */
export const getCustomPromptHistory = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(v.object({
    _id: v.id("aiCustomPrompts"),
    customPrompt: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(),
    _creationTime: v.number(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // TODO: Add proper access control check

    const prompts = await ctx.db
      .query("aiCustomPrompts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return prompts;
  },
});

/**
 * Delete custom prompt
 */
export const deleteCustomPrompt = mutation({
  args: {
    promptId: v.id("aiCustomPrompts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) throw new Error("Custom prompt not found");

    // TODO: Add proper access control check

    await ctx.db.delete(args.promptId);
    return null;
  },
});

import { defaultPrompt } from "./prompt";

/**
 * Get default system prompt template for reference
 */
export const getDefaultPromptTemplate = query({
  args: {},
  returns: v.string(),
  handler: async (ctx, args) => {
    // Return the default prompt template that users can customize
    return defaultPrompt;
  },
});
