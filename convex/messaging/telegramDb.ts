/**
 * Telegram Database Operations
 * 
 * This file contains queries and mutations for Telegram integration.
 * Separated from telegram.ts because Convex requires queries/mutations
 * to be in non-Node.js files.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Ensure AI thread exists
export const ensureAiThread = internalMutation({
    args: {
        threadId: v.string(),
        projectId: v.id("projects"),
        teamId: v.id("teams"),
        externalUserId: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if thread exists
        const existing = await ctx.db
            .query("aiThreads")
            .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
            .first();

        if (existing) return;

        // Create thread
        const systemUserId = `telegram:${args.externalUserId}`;
        await ctx.db.insert("aiThreads", {
            threadId: args.threadId,
            projectId: args.projectId,
            teamId: args.teamId,
            userClerkId: systemUserId,
            lastMessageAt: Date.now(),
            messageCount: 0,
            title: "Telegram Chat",
        });
    },
});

// Get latest assistant message from thread
export const getLatestAssistantMessage = internalQuery({
    args: {
        threadId: v.string(),
    },
    returns: v.union(v.null(), v.string()),
    handler: async (ctx, args) => {
        const thread = await ctx.db
            .query("aiThreads")
            .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
            .first();

        if (!thread) return null;

        return thread.lastMessagePreview || null;
    },
});
