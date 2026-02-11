import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const fetchUsersByClerkIds = async (ctx: any, clerkUserIds: Iterable<string>) => {
    const uniqueIds = [...new Set([...clerkUserIds].filter(Boolean))];
    if (uniqueIds.length === 0) return new Map<string, any>();

    const users = await Promise.all(
        uniqueIds.map((clerkUserId) =>
            ctx.db
                .query("users")
                .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
                .unique()
        )
    );

    const byClerkId = new Map<string, any>();
    for (const user of users) {
        if (user) byClerkId.set(user.clerkUserId, user);
    }
    return byClerkId;
};

export const addComment = mutation({
    args: {
        taskId: v.id("tasks"),
        content: v.string(),
        parentId: v.optional(v.id("comments")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
                q.eq("teamId", task.teamId).eq("clerkUserId", identity.subject)
            )
            .unique();

        if (!membership || !membership.isActive) {
            throw new Error("You don't have permission to comment on this task.");
        }

        const commentId = await ctx.db.insert("comments", {
            authorId: identity.subject,
            taskId: args.taskId,
            projectId: task.projectId,
            teamId: task.teamId,
            content: args.content,
            parentCommentId: args.parentId,
            isEdited: false,
        });

        return commentId;
    },
});

export const getCommentsForTask = query({
    args: {
        taskId: v.id("tasks"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            return [];
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) =>
                q.eq("teamId", task.teamId).eq("clerkUserId", identity.subject)
            )
            .unique();

        if (!membership || !membership.isActive) {
            return [];
        }

        const comments = await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .order("desc")
            .collect();

        const usersByClerkId = await fetchUsersByClerkIds(
            ctx,
            comments.map((comment) => comment.authorId)
        );

        const commentsWithAuthors = comments.map((comment) => {
            const author = usersByClerkId.get(comment.authorId);
            return {
                ...comment,
                authorName: author?.name,
                authorImageUrl: author?.imageUrl,
            };
        });

        return commentsWithAuthors;
    },
});
