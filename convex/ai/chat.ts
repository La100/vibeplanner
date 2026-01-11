"use node";

/**
 * VibePlanner AI Simple Chat
 *
 * Simple request → response using agent.generateText()
 * No streaming - just send message, wait for response, return it.
 */

import { internal, api } from "../_generated/api";
import { action } from "../_generated/server";
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

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

type SendMessageResult = {
  success: boolean;
  threadId: string;
  response?: string;
  error?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUSD: number;
  };
};

/**
 * Simple chat - no streaming
 */
export const sendMessage = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.string(),
    fileId: v.optional(v.union(v.id("files"), v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    threadId: v.string(),
    response: v.optional(v.string()),
    error: v.optional(v.string()),
    tokenUsage: v.optional(v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    })),
  }),
  handler: async (ctx, args): Promise<SendMessageResult> => {
    const startTime = Date.now();

    try {
      // Auth
      const identity = await ctx.auth.getUserIdentity();
      if (!identity || identity.subject !== args.userClerkId) {
        throw new Error("Unauthorized");
      }

      const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
      if (!project) throw new Error("Project not found");

      const membership = await ctx.runQuery(api.teams.getCurrentUserTeamMember, {
        teamId: project.teamId,
      });
      if (!membership || membership.isActive === false) throw new Error("Forbidden");

      const aiAccess = await ctx.runQuery(internal.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      });

      if (!aiAccess.allowed) {
        throw new Error(aiAccess.message || "AI features are unavailable for this project.");
      }

      // Ensure thread exists
      await ctx.runMutation(internal.ai.threads.getOrCreateThread, {
        threadId: args.threadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });

      // Snapshot on-demand
      let snapshot: ProjectContextSnapshot | null = null;
      const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
        if (!snapshot) {
          snapshot = (await ctx.runQuery(
            internal.ai.longContextQueries.getProjectContextSnapshot,
            { projectId: args.projectId }
          )) as unknown as ProjectContextSnapshot;
        }
        return snapshot!;
      };

      // Build instructions
      const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
        projectId: args.projectId,
      });
      const { currentDate, currentDateTime } = getCurrentDateTime();
      const systemInstructions = buildSystemInstructions(
        defaultPrompt,
        currentDateTime,
        currentDate,
        buildTeamMembersContext(teamMembers)
      );

      // Prepare message (with file if provided)
      let userMessageContent: string | Array<any> = args.message;
      let fileMetadata: FileMetadataForHistory | undefined;

      if (args.fileId) {
        const result = await prepareMessageWithFile({
          ctx,
          fileId: args.fileId as string,
          baseMessage: args.message,
        });
        userMessageContent = result.content;
        fileMetadata = result.fileMetadata;
      }

      // Load thread messages
      const loadThreadMessages = async (): Promise<Array<{ role: "user" | "assistant"; content: string }>> => {
        const messages: Array<{ role: "user" | "assistant"; content: string }> = await ctx.runQuery(internal.ai.threads.getThreadMessages, {
          threadId: args.threadId,
          limit: 30,
        });
        return messages.map((msg) => ({ role: msg.role, content: msg.content }));
      };

      // Create agent
      const agent = createVibePlannerAgent(systemInstructions, {
        projectId: args.projectId as string,
        runAction: ctx.runAction,
        loadSnapshot: ensureSnapshot,
        loadThreadMessages,
      });

      // Get or create agent thread
      let agentThreadId: string | undefined;
      const isLegacyThreadId = args.threadId.startsWith("thread-") || args.threadId.startsWith("thread_");

      if (isLegacyThreadId) {
        const mapping: any = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
          threadId: args.threadId
        });
        agentThreadId = mapping?.agentThreadId;
      }

      if (!agentThreadId) {
        const createResult = await agent.createThread(ctx, { userId: args.userClerkId });
        agentThreadId = createResult.threadId;
        await ctx.runMutation(internal.ai.threads.saveAgentThreadMapping, {
          threadId: args.threadId,
          agentThreadId,
        });
      }

      // Load previous messages
      const previousMessages: Array<{ role: "user" | "assistant"; content: string }> = await loadThreadMessages();

      // Generate response (NOT streaming!)
      const response: any = await agent.generateText(
        ctx,
        { userId: args.userClerkId, threadId: agentThreadId },
        {
          system: systemInstructions,
          messages: [
            ...previousMessages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "user" as const, content: userMessageContent },
          ],
          toolChoice: "auto" as const,
        },
      );

      // Get response text
      let fullResponse: string = response.text || "";

      // Extract tool calls for pending items
      const allToolCalls: any[] = [];
      const allToolResults: any[] = [];
      const toolResultMap = new Map<string, any>();

      if (response.steps && Array.isArray(response.steps)) {
        for (const step of response.steps) {
          if (step.toolCalls) allToolCalls.push(...step.toolCalls);
          if (step.toolResults) {
            for (const result of step.toolResults) {
              allToolResults.push(result);
              const id = (result as any)?.toolCallId || (result as any)?.id;
              if (id) toolResultMap.set(id, result);
            }
          }
          // Extract text from steps if needed
          if (!fullResponse && step.text) fullResponse = step.text;
        }
      }

      if (!fullResponse && allToolCalls.length > 0) {
        fullResponse = "✅ Operation completed";
      }

      // Process tool calls for pending items (create/edit/delete actions)
      if (allToolCalls.length > 0) {
        const readOnlyTools = new Set([
          'search_tasks', 'search_shopping_items', 'search_notes',
          'search_surveys', 'search_contacts', 'load_full_project_context',
        ]);

        const toolNameDefaults: Record<string, { type: string; operation?: string }> = {
          delete_task: { type: 'task', operation: 'delete' },
          delete_note: { type: 'note', operation: 'delete' },
          delete_shopping_item: { type: 'shopping', operation: 'delete' },
          delete_survey: { type: 'survey', operation: 'delete' },
          delete_contact: { type: 'contact', operation: 'delete' },
          edit_task: { type: 'task', operation: 'edit' },
          edit_note: { type: 'note', operation: 'edit' },
          edit_shopping_item: { type: 'shopping', operation: 'edit' },
          edit_survey: { type: 'survey', operation: 'edit' },
        };

        const functionCalls: Array<{ callId: string; functionName: string; arguments: string }> = [];

        for (let i = 0; i < allToolCalls.length; i++) {
          const toolCall = allToolCalls[i];
          const toolName = toolCall.toolName || toolCall.name || "unknown";
          if (readOnlyTools.has(toolName)) continue;

          const toolCallId = toolCall.toolCallId || toolCall.id || `tc_${Date.now()}_${i}`;
          const toolArgs = toolCall.args || toolCall.input || {};
          const toolResult = toolResultMap.get(toolCallId) ?? allToolResults[i];
          const resultValue = toolResult?.result || toolResult?.output || toolResult;

          let payload: any;
          try {
            payload = typeof resultValue === 'string' ? JSON.parse(resultValue) : resultValue;
          } catch { payload = {}; }

          const defaults = toolNameDefaults[toolName];
          payload = {
            type: payload?.type ?? defaults?.type ?? toolName,
            operation: payload?.operation ?? defaults?.operation,
            data: payload?.data ?? toolArgs ?? {},
          };

          if (payload.type) {
            functionCalls.push({
              callId: toolCallId,
              functionName: toolName,
              arguments: JSON.stringify(payload),
            });
          }
        }

        if (functionCalls.length > 0) {
          await ctx.runMutation(internal.ai.threads.saveFunctionCalls, {
            threadId: args.threadId,
            projectId: args.projectId,
            responseId: `resp_${Date.now()}`,
            functionCalls,
          });
        }
      }

      // Calculate tokens
      const usage = response.usage || {};
      const inputTokens = (usage as any).inputTokens || (usage as any).promptTokens || Math.ceil(args.message.length / 4);
      const outputTokens = (usage as any).outputTokens || (usage as any).completionTokens || Math.ceil(fullResponse.length / 4);
      const tokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUSD: calculateCost(AI_MODEL, inputTokens, outputTokens),
      };

      // Save messages
      await ctx.runMutation(internal.ai.threads.saveMessagesToThread, {
        threadId: args.threadId,
        projectId: args.projectId,
        userMessage: args.message.trim() || (fileMetadata ? `📎 ${fileMetadata.fileName}` : ""),
        assistantMessage: fullResponse,
        tokenUsage,
        userMetadata: fileMetadata ? {
          fileId: fileMetadata.fileId,
          fileName: fileMetadata.fileName,
          fileType: fileMetadata.fileType,
          fileSize: fileMetadata.fileSize,
        } : undefined,
        assistantMetadata: { mode: "simple_chat" },
      });

      // Save usage stats
      await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: project.teamId as Id<"teams">,
        userClerkId: args.userClerkId,
        threadId: args.threadId,
        model: AI_MODEL,
        feature: "assistant",
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        contextSize: 0,
        mode: "simple_chat",
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        threadId: args.threadId,
        response: fullResponse,
        tokenUsage,
      };
    } catch (error) {
      console.error("❌ sendMessage error:", error);
      return {
        success: false,
        threadId: args.threadId,
        error: (error as Error).message,
      };
    }
  },
});
