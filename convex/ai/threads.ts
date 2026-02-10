import { v } from "convex/values";
import { listMessages } from "@convex-dev/agent";
import { components } from "../_generated/api";
import { internalQuery, internalMutation, mutation, query } from "../_generated/server";
const internalAny = require("../_generated/api").internal as any;

export const USER_ONBOARDING_THREAD_TITLE = "User Onboarding";
export const ASSISTANT_ONBOARDING_THREAD_TITLE = "Assistant Onboarding";

function resolveAgentThreadId(thread: { threadId: string; agentThreadId?: string | undefined }) {
  if (thread.agentThreadId) {
    return thread.agentThreadId;
  }
  if (thread.threadId.startsWith("thread-") || thread.threadId.startsWith("thread_")) {
    return undefined;
  }
  return thread.threadId;
}

function isLegacyThreadId(threadId: string): boolean {
  return threadId.startsWith("thread-") || threadId.startsWith("thread_");
}

// Get or create the single active thread for a project/user
export const getProjectThread = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userClerkId) {
      throw new Error("Unauthorized");
    }

    // Check for ANY existing thread for this project and user
    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      // Do not reuse dedicated onboarding threads for normal assistant chat
      .filter((q) => q.neq(q.field("title"), USER_ONBOARDING_THREAD_TITLE))
      .filter((q) => q.neq(q.field("title"), ASSISTANT_ONBOARDING_THREAD_TITLE))
      .first();

    if (existingThread) {
      return existingThread.threadId;
    }

    // Get project to get teamId
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Create new thread with deterministic ID if we want, or just random
    // Using random ID is fine as long as we only ever look it up by project/user
    const threadId = `thread-${args.projectId}-${args.userClerkId}-${Date.now()}`;

    await ctx.db.insert("aiThreads", {
      threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      messageCount: 0,
      title: "Assistant Chat",
    });

    return threadId;
  },
});

export const getUserOnboardingThread = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userClerkId) {
      throw new Error("Unauthorized");
    }

    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .filter((q) => q.eq(q.field("title"), USER_ONBOARDING_THREAD_TITLE))
      .first();

    if (existingThread) {
      return existingThread.threadId;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const threadId = `thread-user-onboarding-${args.projectId}-${args.userClerkId}-${Date.now()}`;

    await ctx.db.insert("aiThreads", {
      threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      messageCount: 0,
      title: USER_ONBOARDING_THREAD_TITLE,
    });

    return threadId;
  },
});

export const getAssistantOnboardingThread = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userClerkId) {
      throw new Error("Unauthorized");
    }

    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .filter((q) => q.eq(q.field("title"), ASSISTANT_ONBOARDING_THREAD_TITLE))
      .first();

    if (existingThread) {
      return existingThread.threadId;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const threadId = `thread-assistant-onboarding-${args.projectId}-${args.userClerkId}-${Date.now()}`;

    await ctx.db.insert("aiThreads", {
      threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      messageCount: 0,
      title: ASSISTANT_ONBOARDING_THREAD_TITLE,
    });

    return threadId;
  },
});

// Internal helper for creating/returning a thread without auth checks (used by messaging bots)
export const getProjectThreadInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const existingThread = await ctx.db
      .query("aiThreads")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();

    if (existingThread) {
      return existingThread.threadId;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const threadId = `thread-${args.projectId}-${args.userClerkId}-${Date.now()}`;

    await ctx.db.insert("aiThreads", {
      threadId,
      projectId: args.projectId,
      teamId: project.teamId,
      userClerkId: args.userClerkId,
      lastMessageAt: Date.now(),
      messageCount: 0,
      title: args.title ?? "Assistant Chat",
    });

    return threadId;
  },
});

// Internal helper: get latest assistant message text for a thread (legacy or agent thread id)
export const getLatestAssistantMessageText = internalQuery({
  args: {
    threadId: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    let agentThreadId = args.threadId;

    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.db
        .query("aiThreads")
        .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
        .unique();
      if (!mapping?.agentThreadId) {
        return null;
      }
      agentThreadId = mapping.agentThreadId;
    }

    const latestMessages = await listMessages(ctx, components.agent, {
      threadId: agentThreadId,
      paginationOpts: { cursor: null, numItems: 5 },
      excludeToolMessages: true,
    });

    const latestAssistant = latestMessages.page.find(
      (msg) => msg.message?.role === "assistant"
    );

    return latestAssistant?.text ?? null;
  },
});

export const autoConfirmFunctionCalls = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    responseId: v.string(),
    actorUserId: v.string(),
    functionCalls: v.array(v.object({
      callId: v.string(),
      functionName: v.string(),
      arguments: v.string(),
    })),
  },
  returns: v.object({
    confirmed: v.number(),
    rejected: v.number(),
  }),
  handler: async (ctx, args) => {
    let confirmed = 0;
    let rejected = 0;

    for (const call of args.functionCalls) {
      let payload: any;
      try {
        payload = JSON.parse(call.arguments);
      } catch (error) {
        payload = null;
      }

      let status: "confirmed" | "rejected" = "rejected";
      let result: any = { error: "Invalid payload" };

      if (payload?.type === "task" && payload?.operation) {
        try {
          const normalizeDate = (value?: string) =>
            value ? new Date(value).getTime() : undefined;

          if (payload.operation === "create") {
            const data = payload.data ?? {};
            const taskId = await ctx.runMutation(internalAny.tasks.createTaskInternal, {
              projectId: args.projectId,
              actorUserId: args.actorUserId,
              title: data.title || data.name || "Untitled",
              description: data.description,
              content: data.content,
              assignedTo: data.assignedTo ?? null,
              priority: data.priority,
              status: data.status || "todo",
              startDate: normalizeDate(data.startDate),
              endDate: normalizeDate(data.endDate),
              cost: data.cost,
            });
            status = "confirmed";
            result = { success: true, taskId, message: "Task created successfully" };
          } else if (payload.operation === "bulk_create") {
            const items = payload.data?.items ?? [];
            const createdIds: string[] = [];
            for (const item of items) {
              const taskId = await ctx.runMutation(internalAny.tasks.createTaskInternal, {
                projectId: args.projectId,
                actorUserId: args.actorUserId,
                title: item.title || item.name || "Untitled",
                description: item.description,
                content: item.content,
                assignedTo: item.assignedTo ?? null,
                priority: item.priority,
                status: item.status || "todo",
                startDate: normalizeDate(item.startDate),
                endDate: normalizeDate(item.endDate),
                cost: item.cost,
              });
              createdIds.push(taskId);
            }
            status = "confirmed";
            result = { success: true, taskIds: createdIds, message: "Tasks created successfully" };
          } else if (payload.operation === "edit") {
            const data = payload.data ?? {};
            const updates = payload.updates ?? {};
            const taskId = data.itemId || updates.itemId;
            if (!taskId) {
              throw new Error("Missing taskId");
            }
            const cleanUpdates = { ...updates } as Record<string, unknown>;
            delete cleanUpdates.assignedToName;
            await ctx.runMutation(internalAny.tasks.updateTaskInternal, {
              taskId,
              actorUserId: args.actorUserId,
              title: cleanUpdates.title as string | undefined,
              description: cleanUpdates.description as string | undefined,
              content: cleanUpdates.content as string | undefined,
              assignedTo: (cleanUpdates.assignedTo as string | null | undefined) ?? null,
              priority: cleanUpdates.priority as any,
              status: cleanUpdates.status as any,
              startDate: normalizeDate(cleanUpdates.startDate as string | undefined),
              endDate: normalizeDate(cleanUpdates.endDate as string | undefined),
              cost: cleanUpdates.cost as number | undefined,
              link: cleanUpdates.link as string | undefined,
            });
            status = "confirmed";
            result = { success: true, message: "Task updated successfully" };
          } else if (payload.operation === "bulk_edit") {
            const items = payload.data?.items ?? [];
            const errors: string[] = [];
            for (const item of items) {
              try {
                const updates = { ...(item.updates ?? {}) } as Record<string, unknown>;
                delete updates.assignedToName;
                const taskId = item.itemId || updates.itemId;
                if (!taskId) {
                  throw new Error("Missing taskId");
                }
                await ctx.runMutation(internalAny.tasks.updateTaskInternal, {
                  taskId,
                  actorUserId: args.actorUserId,
                  title: updates.title as string | undefined,
                  description: updates.description as string | undefined,
                  content: updates.content as string | undefined,
                  assignedTo: (updates.assignedTo as string | null | undefined) ?? null,
                  priority: updates.priority as any,
                  status: updates.status as any,
                  startDate: normalizeDate(updates.startDate as string | undefined),
                  endDate: normalizeDate(updates.endDate as string | undefined),
                  cost: updates.cost as number | undefined,
                  link: updates.link as string | undefined,
                });
              } catch (error) {
                errors.push(String(error));
              }
            }
            if (errors.length > 0) {
              throw new Error(`Bulk edit failed: ${errors.join("; ")}`);
            }
            status = "confirmed";
            result = { success: true, message: "Tasks updated successfully" };
          } else if (payload.operation === "delete") {
            const data = payload.data ?? {};
            const taskId = data.itemId;
            if (!taskId) {
              throw new Error("Missing taskId");
            }
            await ctx.runMutation(internalAny.tasks.deleteTaskInternal, {
              taskId,
              actorUserId: args.actorUserId,
            });
            status = "confirmed";
            result = { success: true, message: "Task deleted successfully" };
          } else {
            result = { error: `Unsupported operation: ${payload.operation}` };
          }
        } catch (error) {
          result = { error: String(error) };
        }
      } else if (payload?.type === "habit" && payload?.operation) {
        try {
          if (payload.operation === "create") {
            const data = payload.data ?? {};
            const habitId = await ctx.runMutation(internalAny.habits.createHabitInternal, {
              projectId: args.projectId,
              actorUserId: args.actorUserId,
              name: data.name || data.title || "Habit",
              description: data.description,
              targetValue: data.targetValue,
              unit: data.unit,
              frequency: data.frequency,
              reminderTime: data.reminderTime,
              reminderPlan: data.reminderPlan,
              source: data.source ?? "assistant",
              scheduleDays: data.scheduleDays,
              isActive: data.isActive,
            });
            status = "confirmed";
            result = { success: true, habitId, message: "Habit created successfully" };
          } else if (payload.operation === "bulk_create") {
            const items = payload.data?.habits ?? payload.data?.items ?? [];
            const createdIds: string[] = [];
            for (const item of items) {
              const habitId = await ctx.runMutation(internalAny.habits.createHabitInternal, {
                projectId: args.projectId,
                actorUserId: args.actorUserId,
                name: item.name || item.title || "Habit",
                description: item.description,
                targetValue: item.targetValue,
                unit: item.unit,
                frequency: item.frequency,
                reminderTime: item.reminderTime,
                reminderPlan: item.reminderPlan,
                source: item.source ?? "assistant",
                scheduleDays: item.scheduleDays,
                isActive: item.isActive,
              });
              createdIds.push(habitId);
            }
            status = "confirmed";
            result = { success: true, habitIds: createdIds, message: "Habits created successfully" };
          } else if (payload.operation === "edit") {
            const data = payload.data ?? {};
            const updates = payload.updates ?? {};
            const habitId = data.itemId || updates.itemId;
            if (!habitId) {
              throw new Error("Missing habitId");
            }
            await ctx.runMutation(internalAny.habits.updateHabitInternal, {
              habitId,
              actorUserId: args.actorUserId,
              name: updates.name,
              description: updates.description,
              scheduleDays: updates.scheduleDays,
              targetValue: updates.targetValue,
              unit: updates.unit,
              frequency: updates.frequency,
              reminderTime: updates.reminderTime,
              reminderPlan: updates.reminderPlan,
              isActive: updates.isActive,
            });
            status = "confirmed";
            result = { success: true, message: "Habit updated successfully" };
          } else if (payload.operation === "complete") {
            const data = payload.data ?? {};
            const habitId = data.habitId || data.itemId;
            if (!habitId) {
              throw new Error("Missing habitId");
            }
            const completed = typeof data.completed === "boolean" ? data.completed : undefined;
            const value = typeof data.value === "number" ? data.value : undefined;
            const completionResult = await ctx.runMutation(internalAny.habits.setHabitCompletionInternal, {
              habitId,
              actorUserId: args.actorUserId,
              date: data.date,
              completed,
              value,
            });
            const message =
              completed === false
                ? "Habit marked incomplete"
                : completed === true
                  ? "Habit marked complete"
                  : "Habit completion toggled";
            status = "confirmed";
            result = { success: true, message, ...completionResult };
          } else if (payload.operation === "bulk_edit") {
            const items = payload.data?.items ?? [];
            const errors: string[] = [];
            for (const item of items) {
              try {
                const updates = item.updates ?? {};
                const habitId = item.itemId || updates.itemId;
                if (!habitId) {
                  throw new Error("Missing habitId");
                }
                await ctx.runMutation(internalAny.habits.updateHabitInternal, {
                  habitId,
                  actorUserId: args.actorUserId,
                  name: updates.name,
                  description: updates.description,
                  scheduleDays: updates.scheduleDays,
                  targetValue: updates.targetValue,
                  unit: updates.unit,
                  frequency: updates.frequency,
                  reminderTime: updates.reminderTime,
                  reminderPlan: updates.reminderPlan,
                  isActive: updates.isActive,
                });
              } catch (error) {
                errors.push(String(error));
              }
            }
            if (errors.length > 0) {
              throw new Error(`Bulk edit failed: ${errors.join("; ")}`);
            }
            status = "confirmed";
            result = { success: true, message: "Habits updated successfully" };
          } else if (payload.operation === "delete") {
            const data = payload.data ?? {};
            const habitId = data.itemId;
            if (!habitId) {
              throw new Error("Missing habitId");
            }
            await ctx.runMutation(internalAny.habits.deleteHabitInternal, {
              habitId,
              actorUserId: args.actorUserId,
            });
            status = "confirmed";
            result = { success: true, message: "Habit deleted successfully" };
          } else {
            result = { error: `Unsupported operation: ${payload.operation}` };
          }
        } catch (error) {
          result = { error: String(error) };
        }
      } else {
        // Tools that already executed during streaming (save_user_profile, configure_telegram, etc.)
        // Mark as "replayed" so they are never re-fed into agent history — the result
        // was already consumed by the model during the original streaming turn.
        const doc = await ctx.db
          .query("aiFunctionCalls")
          .withIndex("by_response_id", (q) => q.eq("responseId", args.responseId))
          .filter((q) => q.eq(q.field("callId"), call.callId))
          .filter((q) => q.eq(q.field("threadId"), args.threadId))
          .first();
        if (doc) {
          await ctx.db.patch(doc._id, {
            status: "replayed",
            result: JSON.stringify({ ...payload, status: "confirmed", outcome: { success: true } }),
            confirmedAt: Date.now(),
          });
        }
        confirmed += 1;
        continue;
      }

      await ctx.db
        .query("aiFunctionCalls")
        .withIndex("by_response_id", (q) => q.eq("responseId", args.responseId))
        .filter((q) => q.eq(q.field("callId"), call.callId))
        .filter((q) => q.eq(q.field("threadId"), args.threadId))
        .first()
        .then(async (doc) => {
          if (!doc) return;
          await ctx.db.patch(doc._id, {
            status,
            result: JSON.stringify({
              ...payload,
              status,
              outcome: result,
            }),
            confirmedAt: Date.now(),
          });
        });

      if (status === "confirmed") confirmed += 1;
      else rejected += 1;
    }

    return { confirmed, rejected };
  },
});

export const clearThreadInternal = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread || thread.projectId !== args.projectId) {
      throw new Error("Thread not found");
    }

    const functionCalls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const call of functionCalls) {
      await ctx.db.delete(call._id);
    }

    const agentThreadId = resolveAgentThreadId(thread);
    if (agentThreadId) {
      await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
        threadId: agentThreadId,
      });
    }

    await ctx.db.patch(thread._id, {
      lastMessageAt: Date.now(),
      lastMessagePreview: undefined,
      lastMessageRole: undefined,
      messageCount: 0,
      lastResponseId: undefined,
      agentThreadId: undefined,
      title: thread.title ?? "Assistant Chat",
    });

    return { success: true };
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
      messageCount: 0,
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
    title: v.optional(v.string()),
    lastResponseId: v.optional(v.string()),
    agentThreadId: v.optional(v.string()),
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
      title: thread.title,
      lastResponseId: thread.lastResponseId,
      agentThreadId: thread.agentThreadId,
    };
  },
});

// Helper to map legacy thread ID to agent thread ID
export const saveAgentThreadMapping = internalMutation({
  args: {
    threadId: v.string(),
    agentThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (thread) {
      await ctx.db.patch(thread._id, {
        agentThreadId: args.agentThreadId,
      });
    }
  },
});

export const updateThreadSummary = internalMutation({
  args: {
    threadId: v.string(),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    lastMessageRole: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
    messageCountDelta: v.optional(v.number()),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return null;
    }

    const updates: Record<string, unknown> = {};

    if (args.lastMessageAt !== undefined) {
      updates.lastMessageAt = args.lastMessageAt;
    }

    if (args.lastMessagePreview !== undefined) {
      updates.lastMessagePreview = args.lastMessagePreview;
    }

    if (args.lastMessageRole !== undefined) {
      updates.lastMessageRole = args.lastMessageRole;
    }

    if (args.messageCountDelta !== undefined) {
      const nextCount = (thread.messageCount ?? 0) + args.messageCountDelta;
      updates.messageCount = Math.max(0, nextCount);
    }

    if (args.title !== undefined) {
      updates.title = args.title;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(thread._id, updates);
    }

    return null;
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


export const listThreadsForUser = query({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.array(
    v.object({
      threadId: v.string(),
      title: v.string(),
      lastMessageAt: v.number(),
      lastMessagePreview: v.optional(v.string()),
      lastMessageRole: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
      messageCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.userClerkId))
      .collect();

    const filtered = threads.filter((thread) => thread.projectId === args.projectId);

    const summaries = await Promise.all(
      filtered.map(async (thread) => {
        let preview = thread.lastMessagePreview;
        let previewRole = thread.lastMessageRole;
        let messageCount = thread.messageCount;

        if (preview === undefined || previewRole === undefined || messageCount === undefined) {
          const agentThreadId = resolveAgentThreadId(thread);
          if (agentThreadId) {
            const latestMessages = await listMessages(ctx, components.agent, {
              threadId: agentThreadId,
              paginationOpts: { cursor: null, numItems: 1 },
              excludeToolMessages: true,
            });
            const latest = latestMessages.page[0];
            if (latest) {
              preview = latest.text ?? "";
              const role = latest.message?.role;
              if (role === "user" || role === "assistant") {
                previewRole = role;
              }
              messageCount = latest.order + 1;
            }
          }
        }

        return {
          threadId: thread.threadId,
          title: thread.title && thread.title.trim().length > 0 ? thread.title : "Untitled chat",
          lastMessageAt: thread.lastMessageAt || thread._creationTime,
          lastMessagePreview: preview,
          lastMessageRole: previewRole,
          messageCount: messageCount ?? 0,
        };
      })
    );

    summaries.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return summaries;
  },
});


// Public mutation to clear a user's thread (messages + pending function calls)
export const clearThreadForUser = mutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!thread) {
      return { success: true, message: "Thread already cleared" };
    }

    if (thread.projectId !== args.projectId || thread.userClerkId !== args.userClerkId) {
      throw new Error("Thread does not belong to this project or user");
    }

    const functionCalls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const call of functionCalls) {
      await ctx.db.delete(call._id);
    }

    const agentThreadId = resolveAgentThreadId(thread);
    if (agentThreadId) {
      await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
        threadId: agentThreadId,
      });
    }

    await ctx.db.delete(thread._id);

    return { success: true, message: "Thread deleted" };
  },
});

// Remove all previous threads for a user (optionally keep the active one)
export const clearPreviousThreadsForUser = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
    keepThreadId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    removedThreads: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const threadsToRemove = threads.filter(
      (thread) =>
        thread.userClerkId === args.userClerkId &&
        thread.threadId !== args.keepThreadId
    );

    for (const thread of threadsToRemove) {
      const functionCalls = await ctx.db
        .query("aiFunctionCalls")
        .withIndex("by_thread", (q) => q.eq("threadId", thread.threadId))
        .collect();

      for (const call of functionCalls) {
        await ctx.db.delete(call._id);
      }

      const agentThreadId = resolveAgentThreadId(thread);
      if (agentThreadId) {
        await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
          threadId: agentThreadId,
        });
      }

      await ctx.db.delete(thread._id);
    }

    return { success: true, removedThreads: threadsToRemove.length };
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
    status: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const confirmed = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread_and_status", (q) =>
        q.eq("threadId", args.threadId).eq("status", "confirmed")
      )
      .collect();

    const rejected = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread_and_status", (q) =>
        q.eq("threadId", args.threadId).eq("status", "rejected")
      )
      .collect();

    const calls = [...confirmed, ...rejected];
    // Sort by creation time to maintain order
    calls.sort((a, b) => a._creationTime - b._creationTime);

    return calls.map(call => ({
      _id: call._id,
      callId: call.callId,
      functionName: call.functionName,
      arguments: call.arguments,
      result: call.result,
      status: call.status,
    }));
  },
});

// Get pending items for UI confirmation
export const listPendingItems = query({
  args: {
    threadId: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("aiFunctionCalls"),
    callId: v.string(),
    functionName: v.string(),
    arguments: v.string(),
    responseId: v.string(),
    status: v.optional(v.string()),
    result: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    // const { internal } = await import("../_generated/api");
    const calls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    // Filter out replayed calls as they are handled by the agent history
    // UPDATE: We now KEEP replayed calls so the UI can show them as "Confirmed"
    const visibleCalls = calls; // calls.filter(call => call.status !== "replayed");

    return await Promise.all(visibleCalls.map(async (call) => {
      let argsStr = call.arguments;
      let status = call.status;

      // If replayed, recover the original status (confirmed/rejected) from the result JSON if possible
      if (status === "replayed" && call.result) {
        try {
          const parsedResult = JSON.parse(call.result);
          if (parsedResult.status === "confirmed" || parsedResult.status === "rejected") {
            status = parsedResult.status;
          } else {
            // Default to confirmed if result exists but no explicit status in it
            status = "confirmed";
          }
        } catch (e) {
          // If parse fails but result exists, assume confirmed
          status = "confirmed";
        }
      }

      // Enrich update_item arguments with originalItem if missing
      // Check function name case-insensitive recursively? No, exact match.
      // We also check "update_multiple_items" if needed, but the bug is reported for "update_item".
      if (call.functionName === "update_item") {
        let argsObj: any;
        try {
          try {
            argsObj = JSON.parse(call.arguments);
          } catch (e) {
            // If double stringified
            try {
              argsObj = JSON.parse(JSON.parse(call.arguments));
            } catch (e2) {
              // Return explicit error for client debug
              return {
                ...call,
                arguments: JSON.stringify({ debug_error: "Double parse failed" })
              };
            }
          }

          if (argsObj) {
            // Ensure we handle both "itemId" and "data.itemId"
            const type = argsObj.type;
            const itemId = argsObj.itemId || argsObj.data?.itemId;

            // Debug signal
            argsObj.debug_server_touched = true;

            if (itemId) {
              try {
                const originalItem = await ctx.db.get(itemId as any);
                if (originalItem) {
                  argsObj.originalItem = originalItem;
                } else {
                  argsObj.debug_error = `Item not found for ID: ${itemId}`;
                }
              } catch (dbErr: any) {
                argsObj.debug_error = `DB Error: ${dbErr.message}`;
              }
            } else {
              argsObj.debug_error = "No itemId found in args";
            }

            argsStr = JSON.stringify(argsObj);
          }
        } catch (error: any) {
          // Catch all
          const errObj = { debug_error: `General enrichment error: ${error.message}` };
          argsStr = JSON.stringify(errObj);
        }
      }

      return {
        _id: call._id,
        callId: call.callId,
        functionName: call.functionName,
        arguments: argsStr,
        responseId: call.responseId,
        status: status,
        result: call.result,
      };
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
      status: v.optional(v.union(v.literal("confirmed"), v.literal("rejected"))),
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
        // Determine status: explicit status > result presence > rejected
        let newStatus: "confirmed" | "rejected" = "rejected";
        if (result.status) {
          newStatus = result.status;
        } else if (result.result) {
          newStatus = "confirmed";
        }

        await ctx.db.patch(call._id, {
          status: newStatus,
          result: result.result,
          confirmedAt: Date.now(),
        });
      }
    }
    return null;
  },
});

// Clear ALL threads for a user in a project (for settings page)
export const clearAllThreadsForUser = mutation({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    removedThreads: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    if (identity.subject !== args.userClerkId) {
      throw new Error("Forbidden");
    }

    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const threadsToRemove = threads.filter(
      (thread) => thread.userClerkId === args.userClerkId
    );

    for (const thread of threadsToRemove) {
      const functionCalls = await ctx.db
        .query("aiFunctionCalls")
        .withIndex("by_thread", (q) => q.eq("threadId", thread.threadId))
        .collect();

      for (const call of functionCalls) {
        await ctx.db.delete(call._id);
      }

      const agentThreadId = resolveAgentThreadId(thread);
      if (agentThreadId) {
        await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
          threadId: agentThreadId,
        });
      }

      await ctx.db.delete(thread._id);
    }

    return { success: true, removedThreads: threadsToRemove.length };
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

// Save pending items from AI tool calls (for streaming chat)
export const savePendingItems = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    items: v.array(v.object({
      type: v.string(),
      operation: v.optional(v.string()),
      data: v.any(),
      functionCall: v.optional(v.object({
        callId: v.string(),
        functionName: v.string(),
        arguments: v.string(),
      })),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get or create a response ID for grouping these items
    const responseId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    for (const item of args.items) {
      await ctx.db.insert("aiFunctionCalls", {
        threadId: args.threadId,
        projectId: args.projectId,
        responseId,
        callId: item.functionCall?.callId || `call_${Date.now()}`,
        functionName: item.functionCall?.functionName || item.type,
        arguments: item.functionCall?.arguments || JSON.stringify(item.data),
        status: "pending",
        createdAt: Date.now(),
      });
    }

    // Update thread with response ID
    const thread = await ctx.db
      .query("aiThreads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (thread) {
      await ctx.db.patch(thread._id, {
        lastResponseId: responseId,
        lastMessageAt: Date.now(),
      });
    }

    return null;
  },
});
