import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentDateTime } from "./ai/helpers/contextBuilder";

const hasProjectAccess = async (ctx: any, projectId: Id<"projects">): Promise<boolean> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) return false;
  return membership.role === "admin" || membership.role === "member";
};

const getProjectAccessForUser = async (
  ctx: any,
  projectId: Id<"projects">,
  clerkUserId: string
) => {
  const project = await ctx.db.get(projectId);
  if (!project) return null;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) return null;
  if (membership.role !== "admin" && membership.role !== "member") return null;

  return { project, membership };
};

const getProjectDate = async (ctx: any, projectId: Id<"projects">): Promise<string> => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    const { currentDate } = getCurrentDateTime();
    return currentDate;
  }
  const team = await ctx.db.get(project.teamId);
  const { currentDate } = getCurrentDateTime(team?.timezone);
  return currentDate;
};

// ============================================
// PUBLIC QUERIES
// ============================================

export const listDiaryEntries = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const entries = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  },
});

export const getDiaryEntryByDate = query({
  args: {
    projectId: v.id("projects"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return null;

    return await ctx.db
      .query("diaryEntries")
      .withIndex("by_project_and_date", (q) =>
        q.eq("projectId", args.projectId).eq("date", args.date)
      )
      .first();
  },
});

// ============================================
// PUBLIC MUTATIONS
// ============================================

export const upsertDiaryEntry = mutation({
  args: {
    projectId: v.id("projects"),
    date: v.string(),
    content: v.string(),
    mood: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) throw new Error("Access denied");

    const existing = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project_and_date", (q) =>
        q.eq("projectId", args.projectId).eq("date", args.date)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        mood: args.mood,
        source: "user" as const,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("diaryEntries", {
      projectId: args.projectId,
      teamId: project.teamId,
      date: args.date,
      content: args.content,
      source: "user" as const,
      createdBy: identity.subject,
      updatedAt: Date.now(),
      mood: args.mood,
    });
  },
});

// ============================================
// INTERNAL (for AI tool)
// ============================================

export const upsertDiaryEntryInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    date: v.optional(v.string()),
    content: v.string(),
    mood: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForUser(ctx, args.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    const date = args.date ?? (await getProjectDate(ctx, args.projectId));

    const existing = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project_and_date", (q) =>
        q.eq("projectId", args.projectId).eq("date", date)
      )
      .first();

    if (existing) {
      const separator = existing.content.trim() ? "\n\n---\n\n" : "";
      await ctx.db.patch(existing._id, {
        content: existing.content + separator + args.content,
        mood: args.mood ?? existing.mood,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("diaryEntries", {
      projectId: args.projectId,
      teamId: access.project.teamId,
      date,
      content: args.content,
      source: "assistant" as const,
      createdBy: args.actorUserId,
      updatedAt: Date.now(),
      mood: args.mood,
    });
  },
});

export const getRecentDiaryEntriesInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const sorted = entries.sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, args.limit ?? 7);
  },
});
