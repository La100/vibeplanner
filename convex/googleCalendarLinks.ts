import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getLinkBySource = internalQuery({
  args: {
    sourceType: v.union(v.literal("task"), v.literal("shopping")),
    sourceId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleCalendarLinks")
      .withIndex("by_source_and_user", (q) =>
        q.eq("sourceType", args.sourceType)
          .eq("sourceId", args.sourceId)
          .eq("clerkUserId", args.clerkUserId)
      )
      .first();
  },
});

export const upsertLink = internalMutation({
  args: {
    sourceType: v.union(v.literal("task"), v.literal("shopping")),
    sourceId: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarLinks")
      .withIndex("by_source_and_user", (q) =>
        q.eq("sourceType", args.sourceType)
          .eq("sourceId", args.sourceId)
          .eq("clerkUserId", args.clerkUserId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        googleEventId: args.googleEventId,
        projectId: args.projectId,
        teamId: args.teamId,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("googleCalendarLinks", {
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      projectId: args.projectId,
      teamId: args.teamId,
      clerkUserId: args.clerkUserId,
      googleEventId: args.googleEventId,
      lastSyncedAt: Date.now(),
    });
  },
});

export const deleteLink = internalMutation({
  args: {
    sourceType: v.union(v.literal("task"), v.literal("shopping")),
    sourceId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarLinks")
      .withIndex("by_source_and_user", (q) =>
        q.eq("sourceType", args.sourceType)
          .eq("sourceId", args.sourceId)
          .eq("clerkUserId", args.clerkUserId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
