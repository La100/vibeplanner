import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Get or create thread
export const getOrCreateThread = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Check if thread exists
    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (existingThread) {
      // Update last message time
      await ctx.db.patch(existingThread._id, {
        lastMessageAt: Date.now(),
      });
      return args.threadId;
    }

    // Get project to get teamId
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Create new thread
    await ctx.db.insert("aiThreads", {
      threadId: args.threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
    });

    return args.threadId;
  },
});

// Get thread messages for conversation history
export const getThreadMessages = internalQuery({
  args: {
    threadId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    messageIndex: v.number(),
    ragContext: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 20; // Last 20 messages by default
    
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc") // Oldest first for conversation flow
      .take(limit);

    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      messageIndex: msg.messageIndex,
      ragContext: msg.ragContext,
    }));
  },
});

// Save messages to thread
export const saveMessagesToThread = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userMessage: v.string(),
    assistantMessage: v.string(),
    tokenUsage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    }),
    ragContext: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get current message count for indexing
    const existingMessages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    const nextIndex = existingMessages.length;

    // Save user message
    await ctx.db.insert("aiMessages", {
      threadId: args.threadId,
      projectId: args.projectId,
      role: "user",
      content: args.userMessage,
      messageIndex: nextIndex,
    });

    // Save assistant message
    await ctx.db.insert("aiMessages", {
      threadId: args.threadId,
      projectId: args.projectId,
      role: "assistant",
      content: args.assistantMessage,
      tokenUsage: args.tokenUsage,
      ragContext: args.ragContext,
      messageIndex: nextIndex + 1,
    });

    return null;
  },
});

// Clear thread messages (for New Chat)
export const clearThreadMessages = internalMutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    // Delete all messages in this thread
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    return null;
  },
});







