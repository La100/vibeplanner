"use node";

/**
 * VibePlanner AI Chat System - OpenAI Integration (Long Context Mode)
 *
 * This is the main AI system for VibePlanner using OpenAI's Responses API.
 * Supports file uploads, long-context retrieval, and function calling.
 * Uses conditional context loading for better performance.
 *
 * UI Component: /components/AIAssistantSmart.tsx
 * AI Page: /app/[slug]/[projectSlug]/ai/page.tsx
 */

import { internal, api } from "../_generated/api";
import { action } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { functionTools } from "./toolCalls";
import { AI_MODEL } from "./config";
import {
  buildContextFromSnapshot,
  buildTeamMembersContext,
  buildSystemInstructions,
  buildUserMessage,
  buildCreationSummary,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import { getFileUrl, processFileForAI } from "./helpers/fileProcessor";
import { processFunctionCalls } from "./helpers/functionCallHandler";
import { calculateTokenUsage } from "./helpers/tokenUtils";
import type { ProjectContextSnapshot } from "./types";

const MIN_MESSAGE_LENGTH_FOR_CONTEXT = 120;

const LONG_CONTEXT_KEYWORDS: string[] = [
  "task",
  "tasks",
  "zadanie",
  "zadań",
  "note",
  "notes",
  "notatka",
  "notatki",
  "shopping",
  "zakup",
  "survey",
  "ankieta",
  "contact",
  "kontakt",
  "plan",
  "project",
  "projekt",
  "deadline",
  "termin",
  "assign",
  "przydziel",
  "status",
  "update",
  "summary",
  "podsumowanie",
];

const shouldIncludeLongContext = (message: string): boolean => {
  // Ignore short pleasantries like "hello" by requiring either
  // sufficient length or the presence of domain-specific keywords.
  const normalized = message.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  if (normalized.length >= MIN_MESSAGE_LENGTH_FOR_CONTEXT) {
    return true;
  }

  return LONG_CONTEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const chatWithLongContextAgent = action({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    fileId: v.optional(v.union(v.id("files"), v.string(), v.null())),
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
    tokenUsage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    }),
    mode: v.string(),
    contextSize: v.number(),
    pendingItems: v.optional(v.array(v.object({
      type: v.union(
        v.literal("task"),
        v.literal("note"),
        v.literal("shopping"),
        v.literal("survey"),
        v.literal("contact"),
        v.literal("shoppingSection"),
      ),
      operation: v.optional(
        v.union(
          v.literal("create"),
          v.literal("edit"),
          v.literal("delete"),
          v.literal("bulk_edit"),
          v.literal("bulk_create"),
        ),
      ),
      data: v.any(),
      updates: v.optional(v.any()),
      originalItem: v.optional(v.any()),
      functionCall: v.optional(v.object({
        callId: v.string(),
        functionName: v.string(),
        arguments: v.string(),
      })),
      responseId: v.optional(v.string()),
    }))),
  }),
  handler: async (ctx, args) => {
    console.log("🚀 Long context action called with fileId:", args.fileId);

    const includeLongContext = shouldIncludeLongContext(args.message);
    let snapshot: ProjectContextSnapshot | null = null;

    const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
      if (!snapshot) {
        console.log("📥 Loading long context snapshot for project:", args.projectId);
        snapshot = await ctx.runQuery(
          internal.ai.longContextQueries.getProjectContextSnapshot,
          { projectId: args.projectId },
        ) as unknown as ProjectContextSnapshot;

        console.log("Long context snapshot - Tasks:", snapshot!.tasks.length);
        console.log("Long context snapshot - Notes:", snapshot!.notes.length);
        console.log("Long context snapshot - Shopping:", snapshot!.shoppingItems.length);
      }

      return snapshot!;
    };

    if (includeLongContext) {
      console.log("🧠 Including project snapshot for enriched context");
      await ensureSnapshot();
    } else {
      console.log("⚡ Skipping long context snapshot for lightweight message");
    }

    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, {
      projectId: args.projectId,
    });

    let teamId = aiSettings?.teamId ?? null;
    if (!teamId) {
      const projectForTeam = await ctx.runQuery(api.projects.getProject, {
        projectId: args.projectId,
      });
      teamId = projectForTeam?.teamId ?? null;
    }
    if (!teamId && includeLongContext) {
      const snapshotForTeam = await ensureSnapshot();
      teamId = snapshotForTeam.project?.teamId ?? null;
    }
    if (!teamId) {
      throw new Error("Unable to resolve teamId for project while running AI chat");
    }

    // Get system prompt (custom or default)
    const customPrompt = await ctx.runQuery(internal.ai.promptDb.getActiveCustomPromptInternal, {
      projectId: args.projectId,
    });

    const systemPrompt: string = customPrompt ||
      await ctx.runQuery(api.ai.promptDb.getDefaultPromptTemplate, {});

    // Ensure thread exists
    let actualThreadId = args.threadId;
    if (!actualThreadId) {
      actualThreadId = `thread_${args.projectId}_${Date.now()}`;
    }

    await ctx.runMutation(internal.ai.threads.getOrCreateThread, {
      threadId: actualThreadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
    });

    // Get team members for AI context
    const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
      projectId: args.projectId,
    });
    const teamMembersContext = buildTeamMembersContext(teamMembers);

    console.log("🧵 Thread ID:", actualThreadId, "| Long context:", includeLongContext ? "enabled" : "skipped");

    let longContextSnapshot = "";
    if (includeLongContext) {
      const snapshotForContext = await ensureSnapshot();
      longContextSnapshot = buildContextFromSnapshot(snapshotForContext);
    }

    const { currentDate, currentDateTime } = getCurrentDateTime();
    const systemInstructions = buildSystemInstructions(systemPrompt, currentDateTime, currentDate, teamMembersContext);
    const parsedSummary = buildCreationSummary(args.message);
    const userMessage = buildUserMessage(longContextSnapshot, args.message, parsedSummary);

    const snapshotForFunctions = async (): Promise<ProjectContextSnapshot> => {
      if (!includeLongContext) {
        console.log("🔁 Loading long context snapshot on-demand for function call");
      }
      return ensureSnapshot();
    };

    const startTime = Date.now();

    try {
      const OpenAI = await import("openai");
      const openaiClient = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY,
      });

    const functions = functionTools;
    const messages: any[] = [];

    // Replay past conversation so the model has full context of this thread
    const previousMessages = await ctx.runQuery(internal.ai.threads.getThreadMessages, {
      threadId: actualThreadId,
      limit: 50,
    });

    for (const prev of previousMessages) {
      messages.push({
        role: prev.role,
        content: [{ type: "text", text: prev.content }],
      });
    }
      let usePreviousResponseId = true;

      const latestToolCallStatus = await ctx.runQuery(internal.ai.threads.getLatestToolCallStatus, {
        threadId: actualThreadId,
      });

      const hasUnresolvedToolCalls = latestToolCallStatus.hasPending || latestToolCallStatus.hasRejected;

      if (hasUnresolvedToolCalls) {
        console.log(
          `⚠️ Detected unresolved tool calls (pending: ${latestToolCallStatus.hasPending}, rejected: ${latestToolCallStatus.hasRejected}) for response ${latestToolCallStatus.responseId}. Skipping previous_response_id usage.`,
        );
        usePreviousResponseId = false;

        try {
          await ctx.runMutation(api.ai.threads.clearLastResponseId, {
            threadId: actualThreadId,
          });
        } catch (error) {
          console.error("Failed to clear last response id after unresolved tool calls:", error);
        }
      }

      // Replay confirmed function calls from previous turn
      const confirmedCalls = await ctx.runQuery(internal.ai.threads.getPendingFunctionCalls, {
        threadId: actualThreadId,
      });

      if (confirmedCalls.length > 0) {
        usePreviousResponseId = false; // Do not use previous_response_id when replaying calls
        console.log(`Replaying ${confirmedCalls.length} confirmed function calls.`);
        const callIdsToMarkAsReplayed: Id<"aiFunctionCalls">[] = [];
        for (const call of confirmedCalls) {
          messages.push({
            type: "function_call",
            call_id: call.callId,
            name: call.functionName,
            arguments: call.arguments,
          });
          messages.push({
            type: "function_call_output",
            call_id: call.callId,
            output: call.result, // result is already a stringified JSON
          });
          callIdsToMarkAsReplayed.push(call._id);
        }

        if (callIdsToMarkAsReplayed.length > 0) {
          await ctx.runMutation(internal.ai.threads.markFunctionCallsAsReplayed, {
            callIds: callIdsToMarkAsReplayed,
          });
        }
      }

      // Process file if provided
      if (args.fileId) {
        console.log(`🔍 Processing file: ${args.fileId}`);
        const fileId = typeof args.fileId === 'string' ? args.fileId as any : args.fileId;
        const file = await ctx.runQuery(api.files.getFileById, { fileId });

        if (file) {
          console.log(`📁 File details: name=${file.name}, mimeType=${file.mimeType}, size=${file.size}`);
          const fileUrl = await getFileUrl(file, ctx);

          if (fileUrl) {
            const updatedMessage = await processFileForAI(file, fileUrl, userMessage);
            messages.push({ role: "user", content: [{ type: "text", text: updatedMessage }] });
          } else {
            messages.push({ role: "user", content: [{ type: "text", text: userMessage }] });
          }
        } else {
          messages.push({ role: "user", content: [{ type: "text", text: userMessage }] });
        }
      } else {
        messages.push({ role: "user", content: [{ type: "text", text: userMessage }] });
      }

      // Get previous response ID for threading
      const threadData: any = await ctx.runQuery(internal.ai.threads.getThreadForResponses, {
        threadId: actualThreadId,
      });
      const previousResponseId: string | undefined = usePreviousResponseId ? threadData?.lastResponseId : undefined;

      // Use Responses API
      const openaiResult: any = await openaiClient.responses.create({
        model: AI_MODEL,
        input: messages,
        instructions: systemInstructions,
        previous_response_id: previousResponseId,
        tools: functions.map(func => ({
          type: "function" as const,
          name: func.name,
          parameters: func.parameters,
          description: func.description,
          strict: false
        })),
        temperature: 1,
        store: true,
      });

      const aiResponse: string = openaiResult.output_text || "";
      const functionCalls: any[] | undefined = openaiResult.output?.filter((item: any) => item.type === "function_call");
      const responseTime = Date.now() - startTime;

      const tokenUsage = calculateTokenUsage(openaiResult, userMessage, aiResponse);

      // Handle function calls
      let finalResponse: string = aiResponse;
      let pendingItems: any[] = [];

      if (functionCalls && functionCalls.length > 0) {
        // Save function calls for replay
        await ctx.runMutation(internal.ai.threads.saveFunctionCalls, {
          threadId: actualThreadId,
          projectId: args.projectId,
          responseId: openaiResult.id,
          functionCalls: functionCalls.map(fc => ({
            callId: fc.call_id,
            functionName: fc.name,
            arguments: fc.arguments,
          })),
        });

        try {
          const functionCallProcessingResult = await processFunctionCalls(
            functionCalls,
            aiResponse,
            teamMembers,
            snapshotForFunctions,
            openaiResult.id
          );
          finalResponse = functionCallProcessingResult.finalResponse;
          pendingItems = functionCallProcessingResult.pendingItems;
        } catch (error) {
          console.error("Error parsing function call:", error);
        }
      }

      // Store response ID for threading - always save it to maintain conversation context
      if (openaiResult.id) {
        await ctx.runMutation(internal.ai.threads.updateThreadResponseId, {
          threadId: actualThreadId,
          responseId: openaiResult.id,
        });
      }

      // Persist the full exchange so upcoming turns have accurate history
      await ctx.runMutation(internal.ai.threads.saveMessagesToThread, {
        threadId: actualThreadId,
        projectId: args.projectId,
        userMessage: args.message,
        assistantMessage: finalResponse,
        tokenUsage,
        ragContext: includeLongContext ? longContextSnapshot : undefined,
      });

      return {
        response: finalResponse,
        threadId: actualThreadId,
        tokenUsage: tokenUsage,
        mode: "long_context",
        contextSize: longContextSnapshot.length,
        pendingItems: pendingItems,
      };
    } catch (error) {
      console.error("Error in chatWithLongContextAgent:", error);
      return {
        response: `Error: ${(error as Error).message}`,
        threadId: actualThreadId,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
        mode: "long_context",
        contextSize: longContextSnapshot.length,
        pendingItems: [],
      };
    }
  },
});
