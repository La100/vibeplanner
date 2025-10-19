import { v } from "convex/values";
import { internalQuery, internalMutation, mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Internal version - used by server-side functions
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
      lastResponseId: undefined, // Will be set after first AI response
    });

    return args.threadId;
  },
});

// Public version - callable from client
export const getOrCreateThreadPublic = mutation({
  args: {
    threadId: v.optional(v.string()),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Generate threadId if not provided
    const threadIdToUse = args.threadId || `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Check if thread exists
    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", threadIdToUse))
      .unique();

    if (existingThread) {
      // Update last message time
      await ctx.db.patch(existingThread._id, {
        lastMessageAt: Date.now(),
      });
      return threadIdToUse;
    }

    // Get project to get teamId
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Create new thread
    await ctx.db.insert("aiThreads", {
      threadId: threadIdToUse,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      lastResponseId: undefined, // Will be set after first AI response
    });

    return threadIdToUse;
  },
});

// Update thread with last response ID for Responses API
export const updateThreadResponseId = internalMutation({
  args: {
    threadId: v.string(),
    responseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (thread) {
      await ctx.db.patch(thread._id, {
        lastResponseId: args.responseId,
        lastMessageAt: Date.now(),
      });
    }
  },
});

// Get thread for Responses API (includes lastResponseId)
export const getThreadForResponses = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(v.null(), v.object({
    _id: v.id("aiThreads"),
    threadId: v.string(),
    projectId: v.id("projects"),
    lastResponseId: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return null;
    }

    return {
      _id: thread._id,
      threadId: thread.threadId,
      projectId: thread.projectId,
      lastResponseId: thread.lastResponseId,
    };
  },
});

export const getLatestToolCallStatus = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    responseId: v.optional(v.string()),
    hasPending: v.boolean(),
    hasRejected: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread || !thread.lastResponseId) {
      return {
        responseId: undefined,
        hasPending: false,
        hasRejected: false,
      };
    }

    const responseId = thread.lastResponseId;

    const calls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_response_id", (q) => q.eq("responseId", responseId))
      .collect();

    let hasPending = false;
    let hasRejected = false;

    for (const call of calls) {
      if (call.status === "pending") {
        hasPending = true;
      } else if (call.status === "rejected") {
        hasRejected = true;
      }

      if (hasPending && hasRejected) {
        break;
      }
    }

    return {
      responseId,
      hasPending,
      hasRejected,
    };
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
    // Get current message count for this thread to determine messageIndex
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

// Add message to thread
export const addMessage = internalMutation({
  args: {
    threadId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get project to get teamId
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Get current message count for this thread to determine messageIndex
    const existingMessages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    const messageIndex = existingMessages.length; // 0-based index

    await ctx.db.insert("aiMessages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      projectId: args.projectId,
      messageIndex: messageIndex,
    });

    return null;
  },
});

// Save function calls for later replay (Rodrigo's approach)
export const saveFunctionCalls = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    responseId: v.string(),
    functionCalls: v.array(v.object({
      callId: v.string(),
      functionName: v.string(),
      arguments: v.string(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const call of args.functionCalls) {
      await ctx.db.insert("aiFunctionCalls", {
        threadId: args.threadId,
        projectId: args.projectId,
        responseId: args.responseId,
        callId: call.callId,
        functionName: call.functionName,
        arguments: call.arguments,
        status: "pending",
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

// Get pending function calls to replay in next message
export const getPendingFunctionCalls = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("aiFunctionCalls"),
    callId: v.string(),
    functionName: v.string(),
    arguments: v.string(),
    result: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const calls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread_and_status", (q) =>
        q.eq("threadId", args.threadId).eq("status", "confirmed")
      )
      .collect();

    return calls.map(call => ({
      _id: call._id,
      callId: call.callId,
      functionName: call.functionName,
      arguments: call.arguments,
      result: call.result,
    }));
  },
});

// Mark function calls as replayed
export const markFunctionCallsAsReplayed = internalMutation({
  args: {
    callIds: v.array(v.id("aiFunctionCalls")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const callId of args.callIds) {
      await ctx.db.patch(callId, {
        status: "replayed",
      });
    }
    return null;
  },
});

// Mark function calls as confirmed (called from frontend after user confirmation or rejection)
export const markFunctionCallsAsConfirmed = mutation({
  args: {
    threadId: v.string(),
    responseId: v.string(),
    results: v.array(v.object({
      callId: v.string(),
      result: v.optional(v.string()),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Find all pending calls for this response
    const calls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_response_id", (q) => q.eq("responseId", args.responseId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const call of calls) {
      const result = args.results.find(r => r.callId === call.callId);
      if (result) {
        await ctx.db.patch(call._id, {
          status: result.result ? "confirmed" : "rejected",
          result: result.result,
          confirmedAt: Date.now(),
        });
      }
    }
    return null;
  },
});

// Clear the last response ID to break the chain when user rejects a tool call
export const clearLastResponseId = mutation({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (thread) {
      await ctx.db.patch(thread._id, {
        lastResponseId: undefined,
      });
    }
  },
});