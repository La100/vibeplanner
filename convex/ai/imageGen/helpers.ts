import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import { r2 } from "../../files";

/**
 * Internal helper functions for image generation
 * These run in the V8 runtime (not Node.js)
 */

/**
 * Get project and team info for file storage path
 */
export const getProjectInfo = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      teamId: v.id("teams"),
      teamSlug: v.string(),
      projectSlug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const team = await ctx.db.get(project.teamId);
    if (!team) return null;

    return {
      teamId: project.teamId,
      teamSlug: team.slug,
      projectSlug: project.slug,
    };
  },
});

/**
 * Generate R2 upload URL for storing generated image
 */
export const generateR2UploadUrl = internalMutation({
  args: {
    key: v.string(),
  },
  returns: v.object({
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    const uploadData = await r2.generateUploadUrl(args.key);
    return { url: uploadData.url };
  },
});

/**
 * Create file record in database with "Generated" folder
 */
export const createFileRecord = internalMutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    fileName: v.string(),
    fileKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    description: v.optional(v.string()),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const uploadedBy = identity?.subject || "system";

    // Find or create "Generated" folder
    let generatedFolder = await ctx.db
      .query("folders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("name"), "Generated"))
      .first();

    if (!generatedFolder) {
      const folderId = await ctx.db.insert("folders", {
        name: "Generated",
        teamId: args.teamId,
        projectId: args.projectId,
        createdBy: uploadedBy,
      });
      generatedFolder = await ctx.db.get(folderId);
    }

    const fileType = args.mimeType.startsWith("video/") ? "video" : "image";

    return await ctx.db.insert("files", {
      name: args.fileName,
      description: args.description,
      teamId: args.teamId,
      projectId: args.projectId,
      folderId: generatedFolder?._id,
      fileType: fileType,
      storageId: args.fileKey,
      size: args.size,
      mimeType: args.mimeType,
      uploadedBy,
      version: 1,
      isLatest: true,
      origin: "general",
    });
  },
});

/**
 * Get signed URL for file
 */
export const getFileUrl = internalQuery({
  args: {
    fileKey: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    try {
      const url = await r2.getUrl(args.fileKey, {
        expiresIn: 60 * 60 * 24, // 24 hours
      });
      return url;
    } catch {
      return null;
    }
  },
});

/**
 * Log image generation to aiGeneratedImages table
 */
export const logImageGeneration = internalMutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    prompt: v.string(),
    model: v.string(),
    storageKey: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    mimeType: v.string(),
    sizeBytes: v.optional(v.number()),
    durationMs: v.number(),
    promptTokens: v.optional(v.number()),
    responseTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    referenceImageCount: v.optional(v.number()),
    textResponse: v.optional(v.string()),
    error: v.optional(v.string()),
    success: v.boolean(),
  },
  returns: v.id("aiGeneratedImages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiGeneratedImages", {
      projectId: args.projectId,
      teamId: args.teamId,
      userClerkId: args.userClerkId,
      prompt: args.prompt,
      model: args.model,
      storageKey: args.storageKey,
      fileUrl: args.fileUrl,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      durationMs: args.durationMs,
      promptTokens: args.promptTokens,
      responseTokens: args.responseTokens,
      totalTokens: args.totalTokens,
      savedToFiles: false,
      referenceImageCount: args.referenceImageCount,
      textResponse: args.textResponse,
      error: args.error,
      success: args.success,
    });
  },
});

/**
 * Mark image as saved to files
 */
export const markImageAsSaved = internalMutation({
  args: {
    generationId: v.id("aiGeneratedImages"),
    fileId: v.id("files"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.generationId, {
      savedToFiles: true,
      fileId: args.fileId,
    });
    return null;
  },
});
