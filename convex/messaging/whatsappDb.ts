/**
 * WhatsApp Database Operations
 * 
 * This file contains queries and mutations for WhatsApp integration.
 * Separated from whatsapp.ts because Convex requires queries/mutations
 * to be in non-Node.js files.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

// Insert AI thread for WhatsApp
export const insertAiThread = internalMutation({
    args: {
        threadId: v.string(),
        projectId: v.id("projects"),
        teamId: v.id("teams"),
        userClerkId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("aiThreads")
            .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
            .first();

        if (existing) return;

        await ctx.db.insert("aiThreads", {
            threadId: args.threadId,
            projectId: args.projectId,
            teamId: args.teamId,
            userClerkId: args.userClerkId,
            lastMessageAt: Date.now(),
            messageCount: 0,
            title: "WhatsApp Chat",
        });
    },
});
