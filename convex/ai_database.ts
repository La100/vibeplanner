import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

// ====== DATABASE FUNCTIONS FOR AI CHAT THREADS ======

// Create thread in database
export const createThreadInDB = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    systemPrompt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get team ID from project
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    
    // Create thread entry
    await ctx.db.insert("aiChatThreads", {
      threadId: args.threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      title: "Chat Thread",
      isActive: true,
    });
    
    // Add system message
    await ctx.db.insert("aiChatMessages", {
      threadId: args.threadId,
      role: "system",
      content: args.systemPrompt,
      order: 0,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
    });
    
    return null;
  },
});

// Get thread messages from database
export const getThreadMessages = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.array(v.object({
    role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
    content: v.string(),
    order: v.number(),
  })),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_thread_and_order", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
    
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      order: msg.order,
    }));
  },
});

// Save thread messages to database
export const saveThreadMessages = internalMutation({
  args: {
    threadId: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Delete existing messages for this thread
    const existingMessages = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    
    for (const msg of existingMessages) {
      await ctx.db.delete(msg._id);
    }
    
    // Insert new messages
    for (let i = 0; i < args.messages.length; i++) {
      const message = args.messages[i];
      await ctx.db.insert("aiChatMessages", {
        threadId: args.threadId,
        role: message.role,
        content: message.content,
        order: i,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });
    }
    
    return null;
  },
});

// Delete thread from database
export const deleteThreadFromDB = internalMutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Delete all messages for this thread
    const messages = await ctx.db
      .query("aiChatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    
    // Delete thread entry
    const thread = await ctx.db
      .query("aiChatThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();
    
    if (thread) {
      await ctx.db.delete(thread._id);
    }
    
    return null;
  },
});

// Get threads for a project
export const getThreadsForProject = internalQuery({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.array(v.object({
    threadId: v.string(),
    title: v.optional(v.string()),
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("aiChatThreads")
      .withIndex("by_project_and_user", (q) => 
        q.eq("projectId", args.projectId).eq("userClerkId", args.userClerkId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const result = [];
    for (const thread of threads) {
      // Get last message time
      const lastMessage = await ctx.db
        .query("aiChatMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread.threadId))
        .order("desc")
        .first();
      
      result.push({
        threadId: thread.threadId,
        title: thread.title,
        createdAt: thread._creationTime,
        lastMessageAt: lastMessage?._creationTime,
      });
    }
    
    return result.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  },
});

// Get thread info
export const getThreadInfo = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(
    v.object({
      projectId: v.id("projects"),
      userClerkId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiChatThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();
    
    if (!thread) return null;
    
    return {
      projectId: thread.projectId,
      userClerkId: thread.userClerkId,
    };
  },
});