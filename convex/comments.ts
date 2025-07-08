import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

        const hasAccess = await ctx.runQuery(api.projects.checkUserProjectAccess, {
            projectId: task.projectId,
        });

        if (!hasAccess) {
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

        const hasAccess = await ctx.runQuery(api.projects.checkUserProjectAccess, {
            projectId: task.projectId,
        });

        if (!hasAccess) {
            return [];
        }

        const comments = await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .order("desc")
            .collect();

        const commentsWithAuthors = await Promise.all(
            comments.map(async (comment) => {
                const author = await ctx.db
                    .query("users")
                    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", comment.authorId))
                    .unique();
                return {
                    ...comment,
                    authorName: author?.name,
                    authorImageUrl: author?.imageUrl,
                };
            })
        );

        return commentsWithAuthors;
    },
});
