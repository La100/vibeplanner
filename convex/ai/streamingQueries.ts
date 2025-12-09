/**
 * VibePlanner AI Streaming Queries
 * 
 * Queries for real-time streaming subscriptions.
 * Clients subscribe to these queries to receive stream deltas.
 * 
 * Note: This file must NOT have "use node" directive
 * as queries can only run in V8 runtime.
 * 
 * See: https://docs.convex.dev/agents/streaming
 */

import { components, internal } from "../_generated/api";
import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { vStreamArgs, listUIMessages, syncStreams } from "@convex-dev/agent";

/**
 * Check if a thread ID is a legacy/custom format (not a Convex agent thread ID)
 */
function isLegacyThreadId(threadId: string): boolean {
  return threadId.startsWith("thread-") || threadId.startsWith("thread_");
}

/**
 * Query to list streaming messages with delta support
 * Clients subscribe to this for real-time streaming updates
 * 
 * Uses Convex Agent's listUIMessages + syncStreams for seamless streaming
 */
export const listStreamingMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  returns: v.any(), // Complex return type from agent
  handler: async (ctx, args) => {
    console.log("📡 listStreamingMessages called for:", args.threadId);
    let agentThreadId = args.threadId;
    let mappingFound = false;

    // Handle legacy/custom thread IDs (e.g. "thread-123" or "thread_123")
    // Lookup the corresponding agent thread ID
    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
        threadId: args.threadId
      });
      
      if (mapping && mapping.agentThreadId) {
        agentThreadId = mapping.agentThreadId;
        mappingFound = true;
        console.log("🔗 Mapped thread:", args.threadId, "->", agentThreadId);
      } else {
        // If no mapping found yet, return empty
        // This is normal during initial setup - the action will save the mapping
        console.log("⏳ No mapping found yet for:", args.threadId);
        return { 
          page: [], 
          isDone: true, 
          continueCursor: "", 
          streams: { messages: [], deltas: [] },
          // Add metadata for debugging
          _meta: {
            requestedThreadId: args.threadId,
            agentThreadId: null,
            mappingFound: false,
          }
        };
      }
    }

    try {
      // Get paginated messages (non-streaming)
      const paginated = await listUIMessages(ctx, components.agent, {
        threadId: agentThreadId,
        paginationOpts: args.paginationOpts,
      });

      // Get streaming deltas - include all statuses to capture in-progress and finished
      const streams = await syncStreams(ctx, components.agent, {
        threadId: agentThreadId,
        streamArgs: args.streamArgs,
        // Include streaming, finished, and aborted to show all states
        includeStatuses: ["streaming", "finished", "aborted"],
      });

      const deltasCount = streams && 'deltas' in streams ? streams.deltas.length : 0;
      console.log(`📦 Returning ${deltasCount} deltas for ${agentThreadId}`);

      return { 
        ...paginated, 
        streams,
        // Add metadata for debugging
        _meta: {
          requestedThreadId: args.threadId,
          agentThreadId,
          mappingFound: mappingFound || !isLegacyThreadId(args.threadId),
        }
      };
    } catch (error) {
      console.error("❌ listStreamingMessages error:", error);
      // Return empty result on error rather than throwing
      return { 
        page: [], 
        isDone: true, 
        continueCursor: "", 
        streams: { messages: [], deltas: [] },
        _meta: {
          requestedThreadId: args.threadId,
          agentThreadId,
          error: (error as Error).message,
        }
      };
    }
  },
});

/**
 * Query to get streaming deltas for useStreamingUIMessages hook
 * 
 * This query must return syncStreams result DIRECTLY (not wrapped in object)
 * as useStreamingUIMessages expects the raw sync result
 * 
 * See: https://docs.convex.dev/agents/streaming#advanced-streaming-deltas-asynchronously-without-using-an-agent
 */
export const getStreamDeltas = query({
  args: {
    threadId: v.string(),
    streamArgs: v.optional(vStreamArgs), // Optional - hook provides defaults
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Handle placeholder threadId (when client has no real thread yet)
    if (args.threadId === "__no_thread__" || !args.threadId) {
      return { kind: "list", messages: [] };
    }

    let agentThreadId = args.threadId;

    // Handle legacy thread IDs
    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
        threadId: args.threadId
      });
      
      if (mapping && mapping.agentThreadId) {
        agentThreadId = mapping.agentThreadId;
      } else {
        // No mapping yet - return empty sync result
        // Return format that useStreamingUIMessages expects (empty list mode)
        return { kind: "list", messages: [] };
      }
    }

    try {
      // Return syncStreams result DIRECTLY - this is what useStreamingUIMessages expects
      const result = await syncStreams(ctx, components.agent, {
        threadId: agentThreadId,
        streamArgs: args.streamArgs, // Hook provides defaults
        // Include all statuses to capture in-progress and completed streams
        includeStatuses: ["streaming", "finished", "aborted"],
      });

      return result; // Return raw result, not wrapped!
    } catch (error) {
      console.error("❌ getStreamDeltas error:", error);
      // Return empty list mode on error
      return { kind: "list", messages: [] };
    }
  },
});

/**
 * Query to get thread info including mapping status
 * Useful for debugging streaming issues
 */
export const getThreadInfo = query({
  args: {
    threadId: v.string(),
  },
  returns: v.object({
    exists: v.boolean(),
    agentThreadId: v.optional(v.string()),
    isLegacyId: v.boolean(),
    hasMapping: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    exists: boolean;
    agentThreadId: string | undefined;
    isLegacyId: boolean;
    hasMapping: boolean;
  }> => {
    const isLegacy = isLegacyThreadId(args.threadId);
    
    if (!isLegacy) {
      return {
        exists: true,
        agentThreadId: args.threadId,
        isLegacyId: false,
        hasMapping: true, // Not a legacy ID, so no mapping needed
      };
    }

    const mapping = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
      threadId: args.threadId
    });

    return {
      exists: !!mapping,
      agentThreadId: mapping?.agentThreadId ?? undefined,
      isLegacyId: true,
      hasMapping: !!mapping?.agentThreadId,
    };
  },
});

/**
 * Query to list messages for useStreamingUIMessages hook
 * Returns just the paginated messages, no streaming deltas
 */
export const listMessagesForUI = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let agentThreadId = args.threadId;

    // Handle legacy/custom thread IDs
    if (isLegacyThreadId(args.threadId)) {
      const mapping = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
        threadId: args.threadId
      });
      
      if (mapping && mapping.agentThreadId) {
        agentThreadId = mapping.agentThreadId;
      } else {
        // No mapping yet - return empty page
        return { 
          page: [], 
          isDone: true, 
          continueCursor: "", 
        };
      }
    }

    return await listUIMessages(ctx, components.agent, {
      threadId: agentThreadId,
      paginationOpts: args.paginationOpts,
    });
  },
});
