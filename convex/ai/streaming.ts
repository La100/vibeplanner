"use node";

/**
 * VibePlanner AI Streaming Chat
 * 
 * Streaming architecture:
 * 1. Client calls /api/ai/stream which calls initializeStreaming mutation
 * 2. Mutation schedules internalDoStreaming action and returns immediately
 * 3. Client subscribes to listStreamingMessages query with threadId
 * 4. Action runs, saves deltas to DB as they're generated via Convex Agent saveStreamDeltas
 * 5. Client sees streaming updates via query subscription
 * 
 * See: https://docs.convex.dev/agents/streaming
 */

import { internal, api } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { createVibePlannerAgent } from "./agent";
import {
  buildTeamMembersContext,
  buildSystemInstructions,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import { prepareMessageWithFile, type FileMetadataForHistory } from "./files";
import type { ProjectContextSnapshot } from "./types";
import { AI_MODEL, calculateCost } from "./config";
import { defaultPrompt } from "./prompt";
import { webcrypto } from "crypto";
import type { Id } from "../_generated/dataModel";
import { buildFallbackResponseFromTools } from "./helpers/streamResponseBuilder";

// Ensure global crypto in Convex action runtime
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

/**
 * Internal action that does the actual streaming work
 * Called by scheduler from initializeStreaming mutation - runs in background
 */
export const internalDoStreaming = internalAction({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.string(),
    fileId: v.optional(v.union(v.id("files"), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startTime = Date.now();
    console.log("▶️ Starting internalDoStreaming for thread:", args.threadId);
    const agentModeIdentifier = "convex_agent_stream";

    try {
      const providedThreadId = args.threadId;
      const isLegacyThreadId = providedThreadId.startsWith("thread-") || providedThreadId.startsWith("thread_");

      // Streaming start

      // Resolve teamId from project
      console.log("🔍 Resolving teamId for project:", args.projectId);
      const projectForTeam = await ctx.runQuery(api.projects.getProject, {
        projectId: args.projectId,
      });
      const teamId = projectForTeam?.teamId ?? null;
      if (!teamId) {
        throw new Error("Unable to resolve teamId");
      }
      console.log("✅ Resolved teamId:", teamId);

      const aiAccess = await ctx.runQuery(internal.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      });

      if (!aiAccess.allowed) {
        throw new Error(aiAccess.message || "AI features are unavailable for this project.");
      }

      // Snapshot loaded on-demand
      let snapshot: ProjectContextSnapshot | null = null;

      const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
        if (!snapshot) {
          console.log("📸 Loading project snapshot...");
          snapshot = (await ctx.runQuery(
            internal.ai.longContextQueries.getProjectContextSnapshot,
            { projectId: args.projectId }
          )) as unknown as ProjectContextSnapshot;
          console.log("✅ Snapshot loaded, tasks count:", snapshot.tasks.length);
        }
        return snapshot!;
      };

      // Build system instructions
      console.log("📝 Building system instructions...");
      const systemPrompt = defaultPrompt;
      const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
        projectId: args.projectId,
      });
      const teamMembersContext = buildTeamMembersContext(teamMembers);
      const { currentDate, currentDateTime } = getCurrentDateTime();
      const systemInstructions = buildSystemInstructions(
        systemPrompt,
        currentDateTime,
        currentDate,
        teamMembersContext
      );

      // Prepare user message
      let userPrompt = args.message;
      let userMessageContent:
        | string
        | Array<
            | { type: "text"; text: string }
            | { type: "image"; image: string; mediaType?: string }
            | { type: "file"; data: string; mediaType: string }
          > = userPrompt;
      let fileMetadata: FileMetadataForHistory | undefined;

      if (args.fileId) {
        const result = await prepareMessageWithFile({
          ctx,
          fileId: args.fileId as string,
          baseMessage: args.message,
        });
        userPrompt = result.message;
        userMessageContent = result.content;
        fileMetadata = result.fileMetadata;
      }

      // Load conversation history from our custom storage
      const loadThreadMessages = async (): Promise<Array<{ role: "user" | "assistant"; content: string }>> => {
        const messages = await ctx.runQuery(internal.ai.threads.getThreadMessages, {
          threadId: providedThreadId,
          limit: 30,
        });
        return messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
      };

      // Create agent
      console.log("🤖 Creating agent...");
      const agent = createVibePlannerAgent(systemInstructions, {
        projectId: args.projectId as string,
        runAction: ctx.runAction,
        loadSnapshot: ensureSnapshot,
        loadThreadMessages,
      });

      // Check for existing agent thread mapping or create new
      let agentThreadId: string | undefined;

      if (isLegacyThreadId) {
        const mapping: any = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
          threadId: providedThreadId
        });
        if (mapping && mapping.agentThreadId) {
          agentThreadId = mapping.agentThreadId;
          // Found existing mapping
        }
      }

      if (!agentThreadId) {
        console.log("🧵 Creating new agent thread...");
        const createResult = await agent.createThread(ctx, {
          userId: args.userClerkId,
        });
        agentThreadId = createResult.threadId;

        await ctx.runMutation(internal.ai.threads.saveAgentThreadMapping, {
          threadId: providedThreadId,
          agentThreadId: agentThreadId
        });
        console.log("✅ Created new agent thread:", agentThreadId);
      } else {
        console.log("✅ Using existing agent thread:", agentThreadId);
      }

      // Load previous messages for context
      console.log("📚 Loading previous messages...");
      const previousMessages = await loadThreadMessages();
      const messagesForAI = previousMessages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Stream via Convex Agent (saves deltas for subscriptions)
      console.log(`🌊 Starting agent.streamText with model: ${AI_MODEL}...`);
      
      let response;
      try {
        response = await agent.streamText(
          ctx,
          { userId: args.userClerkId, threadId: agentThreadId },
          {
            system: systemInstructions,
            messages: [
              ...messagesForAI,
              { role: "user" as const, content: userMessageContent },
            ],
            toolChoice: "auto" as const, // Allow AI to decide when to use tools
          },
          {
          saveStreamDeltas: {
            chunking: "word",
            // throttleMs: 50,
          },
          },
        );
        console.log("✅ agent.streamText returned response object");
      } catch (err) {
        console.error("❌ agent.streamText failed immediately:", err);
        throw err;
      }

      // Get final result - need to extract from steps when tools are used
      console.log("⏳ Waiting for response.usage...");
      const usage = await response.usage;
      console.log("✅ usage received:", JSON.stringify(usage));

      const totalInputTokens = (usage as any)?.inputTokens || (usage as any)?.promptTokens || 0;
      const totalOutputTokens = (usage as any)?.outputTokens || (usage as any)?.completionTokens || 0;

      // Extract the latest text from steps (avoid concatenating duplicates)
      console.log("⏳ Waiting for response.steps...");
      const steps = await response.steps;
      console.log(`✅ steps received (${steps?.length || 0} steps)`);
      
      let fullResponse = "";
      
      if (steps && Array.isArray(steps)) {
        let latestStepText = "";

        const extractStepText = (step: any): string => {
          let text = "";
          if (typeof step?.text === "string") {
            text = step.text;
          }
          if (step?.content && Array.isArray(step.content)) {
            const contentText = step.content
              .filter((part: any) => part?.type === "text" && typeof part.text === "string")
              .map((part: any) => part.text)
              .join("");
            // If content text exists, prefer it; otherwise keep text
            if (contentText.length > 0) {
              text = contentText;
            }
          }
          return text;
        };

        for (const step of steps) {
          const stepText = extractStepText(step);
          if (stepText && stepText.trim().length > 0) {
            latestStepText = stepText;
          }
        }

        fullResponse = latestStepText;
      }
      
      // Fallback to response.text if steps didn't have content
      if (!fullResponse) {
        fullResponse = await response.text;
      }

      // Extract tool calls first (moved up for availability)
      const allToolCalls: any[] = [];
      const allToolResults: any[] = [];
      const toolResultMap = new Map<string, any>();
      
      // Collect tool calls and results from the response steps
      if (steps && Array.isArray(steps)) {
        for (const step of steps) {
          if (step.toolCalls && Array.isArray(step.toolCalls)) {
            allToolCalls.push(...step.toolCalls);
          }
          if (step.toolResults && Array.isArray(step.toolResults)) {
            for (const result of step.toolResults) {
              allToolResults.push(result);
              const resultId = (result as any)?.toolCallId || (result as any)?.id;
              if (resultId) {
                toolResultMap.set(resultId, result);
              }
            }
          }
        }
      }

      // If still empty, but we had tool calls, derive fallback from tool results
      if (!fullResponse && allToolCalls.length > 0) {
        const toolSummary = buildFallbackResponseFromTools(allToolCalls, allToolResults);
        if (toolSummary) {
          fullResponse = toolSummary;
        } else {
          fullResponse = "✅ Operation completed";
          console.log("ℹ️ Tool call completed without additional AI commentary.");
        }
      }

      if (allToolCalls.length > 0) {
        console.log("🛠 Detected tool calls", {
          count: allToolCalls.length,
          names: allToolCalls.map((c: any) => c.toolName || c.name),
          results: allToolResults.length,
        });

        // Tools that should NOT create pending items (read-only/search tools)
        const readOnlyTools = new Set([
          'search_tasks',
          'search_shopping_items', 
          'search_notes',
          'search_surveys',
          'search_contacts',
          'load_full_project_context',
        ]);
        
        const functionCalls: Array<{
          callId: string;
          functionName: string;
          arguments: string;
        }> = [];

        // Fallback map so delete/edit tools still create pending items even if parsing fails
        const toolNameDefaults: Record<string, { type: string; operation?: string }> = {
          delete_task: { type: 'task', operation: 'delete' },
          delete_note: { type: 'note', operation: 'delete' },
          delete_shopping_item: { type: 'shopping', operation: 'delete' },
          delete_shopping_section: { type: 'shoppingSection', operation: 'delete' },
          delete_survey: { type: 'survey', operation: 'delete' },
          delete_contact: { type: 'contact', operation: 'delete' },
          edit_task: { type: 'task', operation: 'edit' },
          edit_note: { type: 'note', operation: 'edit' },
          edit_shopping_item: { type: 'shopping', operation: 'edit' },
          edit_shopping_section: { type: 'shoppingSection', operation: 'edit' },
          edit_survey: { type: 'survey', operation: 'edit' },
          edit_contact: { type: 'contact', operation: 'edit' },
        };
        
        for (let i = 0; i < allToolCalls.length; i++) {
          const toolCall = allToolCalls[i] as any;
          // Create function call record - handle different property names
          const toolCallId = toolCall.toolCallId || toolCall.id || `tc_${Date.now()}_${i}`;
          const toolResult = toolResultMap.get(toolCallId) ?? (allToolResults[i] as any);

          const toolName = toolCall.toolName || toolCall.name || "unknown";
          const toolArgs = toolCall.args || toolCall.input || toolCall.arguments || {};
          
          // Skip read-only tools - they shouldn't create pending items
          if (readOnlyTools.has(toolName)) {
            continue;
          }
          
          // Parse tool result to verify it's an action item and persist full payload
          const resultValue = toolResult?.result || toolResult?.output || toolResult;
          let payload: any = undefined;

          // Try parsing tool result first
          if (resultValue) {
            try {
              const parsed = typeof resultValue === 'string' 
                ? JSON.parse(resultValue) 
                : resultValue;
              if (parsed && typeof parsed === 'object') {
                payload = parsed;
              }
            } catch (e) {
              console.warn("⚠️ Could not parse tool result:", e);
            }
          }

          // Fallback payload based on tool name/args when parsing fails or lacks type/operation
          if (!payload || !payload.type || !payload.operation) {
            const defaults = toolNameDefaults[toolName];
            const normalizedArgs = typeof toolArgs === 'string'
              ? (() => { try { return JSON.parse(toolArgs); } catch { return toolArgs; } })()
              : toolArgs;

            payload = {
              ...(payload && typeof payload === 'object' ? payload : {}),
              type: payload?.type ?? defaults?.type ?? toolName,
              operation: payload?.operation ?? defaults?.operation,
              data: payload?.data ?? normalizedArgs ?? {},
            };
          } else if (!payload.data) {
            payload.data = toolArgs ?? {};
          }

          // Only persist if we have at least a type
          if (payload?.type) {
            console.log("💾 Saving tool call to pending:", {
              toolName,
              callId: toolCallId,
              type: payload.type,
              operation: payload.operation,
              hasData: Boolean(payload.data),
            });

            functionCalls.push({
              callId: toolCallId,
              functionName: toolName,
              arguments: JSON.stringify(payload),
            });
          } else {
            console.warn("⚠️ Skipping tool call without type", { toolName, toolCallId, payload });
          }
        }
        
        // Save action function calls to database for confirmation UI
        if (functionCalls.length > 0) {
          const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          await ctx.runMutation(internal.ai.threads.saveFunctionCalls, {
            threadId: providedThreadId,
            projectId: args.projectId,
            responseId,
            functionCalls,
          });

          console.log("✅ Saved tool calls for confirmation", {
            responseId,
            count: functionCalls.length,
            names: functionCalls.map((f) => f.functionName),
          });
        } else {
          console.warn("⚠️ No functionCalls generated from tool calls", {
            toolCalls: allToolCalls.length,
            toolResults: allToolResults.length,
          });

          // Heuristic: if user asked to delete and search_shopping_items returned exactly one item, auto-stage delete
          const userAskedToDelete = /\b(delete|remove|usun|usuń)\b/i.test(args.message);
          const onlyShoppingSearch =
            allToolCalls.length === 1 &&
            (allToolCalls[0]?.toolName || allToolCalls[0]?.name) === "search_shopping_items";

          if (userAskedToDelete && onlyShoppingSearch && allToolResults.length === 1) {
            const rawResult = allToolResults[0]?.result || allToolResults[0]?.output || allToolResults[0];
            try {
              const parsed = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
              const items = Array.isArray(parsed?.items) ? parsed.items : [];

              // If many items, stage individual delete calls so UI can show bulk grid
              if (items.length > 1) {
                const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                const functionCalls = items.map((item: any, idx: number) => {
                  const itemId = item?.id || item?._id || `unknown_${idx}`;
                  return {
                    callId: `auto_delete_${itemId}`,
                    functionName: "delete_shopping_item",
                    arguments: JSON.stringify({
                      type: "shopping",
                      operation: "delete",
                      data: { itemId, name: item?.name },
                    }),
                  };
                });

                await ctx.runMutation(internal.ai.threads.saveFunctionCalls, {
                  threadId: providedThreadId,
                  projectId: args.projectId,
                  responseId,
                  functionCalls,
                });
                console.log("✅ Auto-staged bulk delete_shopping_item after search_shopping_items", {
                  count: functionCalls.length,
                  responseId,
                });
              } else {
                const firstItem = items[0];
                const itemId = firstItem?.id || firstItem?._id;
                if (itemId) {
                  const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                  const autoCall = {
                    callId: `auto_delete_${itemId}`,
                    functionName: "delete_shopping_item",
                    arguments: JSON.stringify({
                      type: "shopping",
                      operation: "delete",
                      data: { itemId, name: firstItem?.name },
                    }),
                  };
                  await ctx.runMutation(internal.ai.threads.saveFunctionCalls, {
                    threadId: providedThreadId,
                    projectId: args.projectId,
                    responseId,
                    functionCalls: [autoCall],
                  });
                  console.log("✅ Auto-staged delete_shopping_item after search_shopping_items", { itemId, responseId });
                }
              }
            } catch (e) {
              console.warn("⚠️ Failed to auto-stage delete after shopping search", e);
            }
          }
        }
      }

      // Calculate token usage
      const tokenUsage = {
        inputTokens: totalInputTokens || Math.ceil(userPrompt.length / 4),
        outputTokens: totalOutputTokens || Math.ceil(fullResponse.length / 4),
        totalTokens: (totalInputTokens || Math.ceil(userPrompt.length / 4)) + 
                     (totalOutputTokens || Math.ceil(fullResponse.length / 4)),
        estimatedCostUSD: calculateCost(AI_MODEL, 
          totalInputTokens || Math.ceil(userPrompt.length / 4), 
          totalOutputTokens || Math.ceil(fullResponse.length / 4)
        ),
      };

      // Save to our custom storage
      const responseTime = Date.now() - startTime;
      const trimmedUserMessage = args.message.trim() ||
        (fileMetadata ? `📎 Attached: ${fileMetadata.fileName ?? "file"}` : "");

      await ctx.runMutation(internal.ai.threads.saveMessagesToThread, {
        threadId: providedThreadId,
        projectId: args.projectId,
        userMessage: trimmedUserMessage,
        assistantMessage: fullResponse,
        tokenUsage,
        userMetadata: fileMetadata ? {
          fileId: fileMetadata.fileId,
          fileName: fileMetadata.fileName,
          fileType: fileMetadata.fileType,
          fileSize: fileMetadata.fileSize,
        } : undefined,
        assistantMetadata: { mode: agentModeIdentifier },
      });

      // Save usage statistics
      await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: teamId as Id<"teams">,
        userClerkId: args.userClerkId,
        threadId: providedThreadId,
        model: AI_MODEL,
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        contextSize: 0,
        mode: agentModeIdentifier,
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: true,
      });

      // Streaming completed

      return null;
    } catch (error) {
      console.error("❌ Streaming error:", error);
      return null;
    }
  },
});

/**
 * Public action for backwards compatibility
 * Now schedules streaming via mutation and returns immediately
 */
export const startStreamingChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    fileId: v.optional(v.union(v.id("files"), v.string())),
  },
  returns: v.object({
    threadId: v.string(),
    agentThreadId: v.optional(v.string()),
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    threadId: string;
    agentThreadId: string | undefined;
    success: boolean;
    error?: string;
  }> => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized");
      }

      if (identity.subject !== args.userClerkId) {
        throw new Error("Forbidden");
      }

      const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
      if (!project) {
        throw new Error("Project not found");
      }

      const membership = await ctx.runQuery(api.teams.getCurrentUserTeamMember, {
        teamId: project.teamId,
      });

      if (!membership || membership.isActive === false) {
        throw new Error("Forbidden");
      }

      // Generate threadId if not provided
      const providedThreadId = typeof args.threadId === "string" && args.threadId.trim().length > 0
        ? args.threadId
        : `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Call the mutation to initialize and schedule streaming
      // Type annotation to break circular reference
      await ctx.scheduler.runAfter(0, internal.ai.streaming.internalDoStreaming, {
        message: args.message,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
        threadId: providedThreadId,
        fileId: args.fileId,
      });

      return {
        threadId: providedThreadId,
        agentThreadId: undefined,
        success: true,
      };
    } catch (error) {
      console.error("❌ Error scheduling streaming:", error);
      return {
        threadId: args.threadId || "",
        agentThreadId: undefined,
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
