"use node";

/**
 * VibePlanner AI Chat System - Convex Agent Implementation
 *
 * This replaces the manual OpenAI Responses API with @convex-dev/agent
 * while preserving all functionality including:
 * - Long context mode with conditional loading
 * - File uploads
 * - All 27 custom tools
 * - Thread management
 * - Token usage tracking
 */

import { internal, api } from "../_generated/api";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { createVibePlannerAgent } from "./agent";
import {
  buildContextFromSnapshot,
  buildTeamMembersContext,
  buildSystemInstructions,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import { getFileUrl, processFileForAI } from "./helpers/fileProcessor";
import type { ProjectContextSnapshot } from "./types";
import { AI_MODEL, calculateCost } from "./config";
import { webcrypto } from "crypto";

// Ensure global crypto in Convex action runtime (needed for agent file storage hashing)
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

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
  const normalized = message.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (normalized.length >= MIN_MESSAGE_LENGTH_FOR_CONTEXT) return true;
  return LONG_CONTEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const chatWithAgent = action({
  args: {
    threadId: v.optional(v.union(v.string(), v.id("threads"))),
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
    pendingItems: v.optional(
      v.array(
        v.object({
          type: v.union(
            v.literal("task"),
            v.literal("note"),
            v.literal("shopping"),
            v.literal("survey"),
            v.literal("contact"),
            v.literal("shoppingSection")
          ),
          operation: v.optional(
            v.union(
              v.literal("create"),
              v.literal("edit"),
              v.literal("delete"),
              v.literal("bulk_edit"),
              v.literal("bulk_create")
            )
          ),
          data: v.any(),
          updates: v.optional(v.any()),
          originalItem: v.optional(v.any()),
          functionCall: v.optional(
            v.object({
              callId: v.string(),
              functionName: v.string(),
              arguments: v.string(),
            })
          ),
          responseId: v.optional(v.string()),
        })
      )
    ),
  }),
  handler: async (ctx, args) => {
    console.log("🚀 Convex Agent chat called with fileId:", args.fileId);

    const startTime = Date.now();
    const includeLongContext = shouldIncludeLongContext(args.message);
    let snapshot: ProjectContextSnapshot | null = null;

    // Lazy snapshot loader
    const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
      if (!snapshot) {
        console.log("📥 Loading long context snapshot for project:", args.projectId);
        snapshot = (await ctx.runQuery(
          internal.ai.longContextQueries.getProjectContextSnapshot,
          { projectId: args.projectId }
        )) as unknown as ProjectContextSnapshot;

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

    // Get AI settings and teamId
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

    const systemPrompt: string =
      customPrompt || (await ctx.runQuery(api.ai.promptDb.getDefaultPromptTemplate, {}));

    // Get team members for AI context
    const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
      projectId: args.projectId,
    });
    const teamMembersContext = buildTeamMembersContext(teamMembers);

    // Build long context if needed
    let longContextSnapshot = "";
    if (includeLongContext) {
      const snapshotForContext = await ensureSnapshot();
      longContextSnapshot = buildContextFromSnapshot(snapshotForContext);
    }

    // Build system instructions with context
    const { currentDate, currentDateTime } = getCurrentDateTime();
    const systemInstructions = buildSystemInstructions(
      systemPrompt,
      currentDateTime,
      currentDate,
      teamMembersContext
    );

    // Build user message with long context
    let userMessage = args.message;
    if (longContextSnapshot) {
      userMessage = `CONTEXT:\n${longContextSnapshot}\n\nUSER MESSAGE:\n${args.message}`;
    }

    // Handle file if provided
    if (args.fileId) {
      // Ensure this action stays in the Node runtime when using Node APIs inside try/catch.
      "use node";
      console.log(`🔍 Processing file: ${args.fileId}`);
      const fileId = (typeof args.fileId === "string" ? args.fileId : args.fileId) as any;
      const file = await ctx.runQuery(api.files.getFileById, { fileId });

      if (file) {
        console.log(`📁 File details: name=${file.name}, mimeType=${file.mimeType}, size=${file.size}`);
        const fileUrl = await getFileUrl(file, ctx);

        if (fileUrl) {
          try {
            userMessage = await processFileForAI(
              file,
              fileUrl,
              userMessage,
            );
            console.log("📄 File processed for AI prompt");
          } catch (fileProcessingError) {
            console.error("Failed to process file for AI:", fileProcessingError);
            userMessage = `${userMessage}\n\n[User attached file: ${file.name} (${file.mimeType}) - processing failed, please ask for specific content.]`;
          }
        } else {
          userMessage = `${userMessage}\n\n[User attached file: ${file.name} (${file.mimeType}) - unable to generate download URL.]`;
        }
      }
    }

    console.log("🧵 Convex Agent mode | Long context:", includeLongContext ? "enabled" : "skipped");

    try {
      // Create the agent with system instructions and usage tracking
      const agent = createVibePlannerAgent(systemInstructions, {
        usageHandler: async (ctx, usageData) => {
          // Track token usage automatically
          const inputTokens = usageData.usage?.promptTokens || 0;
          const outputTokens = usageData.usage?.completionTokens || 0;
          const totalTokens = usageData.usage?.totalTokens || inputTokens + outputTokens;

          await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
            projectId: args.projectId,
            teamId: teamId as any,
            userClerkId: usageData.userId || args.userClerkId,
            threadId: usageData.threadId,
            model: usageData.model || AI_MODEL,
            requestType: "chat",
            inputTokens,
            outputTokens,
            totalTokens,
            contextSize: longContextSnapshot.length,
            mode: "convex_agent_advanced",
            estimatedCostCents: Math.round(calculateCost(usageData.model || AI_MODEL, inputTokens, outputTokens) * 100),
            responseTimeMs: Date.now() - startTime,
            success: true,
          });
        },
      });

      let actualThreadId =
        typeof args.threadId === "string" && args.threadId.trim().length > 0
          ? (args.threadId as string)
          : undefined;
      let result;

      // Debug: Log the incoming threadId
      console.log("📨 Received threadId:", actualThreadId, "| Type:", typeof actualThreadId);

      const isLegacyThreadId =
        !!actualThreadId &&
        (actualThreadId.startsWith("thread-") ||
          actualThreadId.startsWith("thread_"));

      if (actualThreadId && !isLegacyThreadId) {
        console.log("🔄 Attempting to continue thread:", actualThreadId);
        try {
          result = await agent.generateText(ctx, { threadId: actualThreadId as any }, {
            prompt: userMessage,
          });
        } catch (e) {
          // If continuing fails (invalid or expired ID), create new thread
          console.log("⚠️ Failed to continue thread, creating new one for user:", args.userClerkId, "| error:", e);
          const { threadId } = await agent.createThread(ctx, {
            userId: args.userClerkId,
          });
          actualThreadId = threadId;

          result = await agent.generateText(ctx, { threadId: actualThreadId }, {
            prompt: userMessage,
          });
        }
      } else {
        // No usable thread ID provided (either missing or legacy format), start a new conversation thread
        console.log("🆕 Creating new thread for user:", args.userClerkId);
        const { threadId } = await agent.createThread(ctx, {
          userId: args.userClerkId,
        });
        actualThreadId = threadId;

        result = await agent.generateText(ctx, { threadId: actualThreadId }, {
          prompt: userMessage,
        });
      }

      const responseTime = Date.now() - startTime;

      // Extract text response from resolvedOutput
      // In new API, the final text is in resolvedOutput
      const aiResponse = (result as any).resolvedOutput || (result as any).text || "";

      // Process tool calls to create pending items
      const pendingItems: any[] = [];

      // Extract tool results from the response
      // In new Convex Agent API, tool results are in result.steps[].content[]
      const steps = (result as any).steps || [];

      for (const step of steps) {
        if (step.content && Array.isArray(step.content)) {
          for (const item of step.content) {
            // Find tool-result items
            if (item.type === 'tool-result' && item.output) {
              try {
                // Parse the JSON output from the tool
                const parsedOutput = JSON.parse(item.output);

                console.log(`🔧 Found tool result: ${item.toolName}`, parsedOutput);

                pendingItems.push({
                  type: parsedOutput.type,
                  operation: parsedOutput.operation,
                  data: parsedOutput.data,
                  functionCall: {
                    callId: item.toolCallId || '',
                    functionName: item.toolName || '',
                    arguments: JSON.stringify(item.input || {}),
                  },
                });
              } catch (e) {
                console.error("Failed to parse tool output:", e, item.output);
              }
            }
          }
        }
      }

      console.log(`✅ Processed ${pendingItems.length} pending items`);

      // Calculate token usage from steps
      // In new API, usage is in each step
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalTotalTokens = 0;

      for (const step of steps) {
        if (step.usage) {
          totalInputTokens += step.usage.inputTokens || 0;
          totalOutputTokens += step.usage.outputTokens || 0;
          totalTotalTokens += step.usage.totalTokens || 0;
        }
      }

      const tokenUsage = {
        inputTokens: totalInputTokens || Math.ceil(userMessage.length / 4),
        outputTokens: totalOutputTokens || Math.ceil(aiResponse.length / 4),
        totalTokens: totalTotalTokens || (totalInputTokens + totalOutputTokens),
        estimatedCostUSD: calculateCost(AI_MODEL, totalInputTokens, totalOutputTokens),
      };

      // Save token usage to database
      await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: teamId as any,
        userClerkId: args.userClerkId,
        threadId: actualThreadId,
        model: AI_MODEL,
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        contextSize: longContextSnapshot.length,
        mode: "convex_agent",
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: true,
      });

      return {
        response: aiResponse,
        threadId: actualThreadId,
        tokenUsage,
        mode: "convex_agent",
        contextSize: longContextSnapshot.length,
        pendingItems: pendingItems.length > 0 ? pendingItems : undefined,
      };
    } catch (error) {
      console.error("Error in chatWithAgent:", error);

      // Try to save error to usage tracking
      try {
        await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
          projectId: args.projectId,
          teamId: teamId as any,
          userClerkId: args.userClerkId,
          model: AI_MODEL,
          requestType: "chat",
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostCents: 0,
          responseTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: (error as Error).message,
        });
      } catch (usageError) {
        console.error("Failed to save error usage:", usageError);
      }

      return {
        response: `Error: ${(error as Error).message}`,
        threadId: args.threadId || `thread_error_${Date.now()}`,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUSD: 0 },
        mode: "convex_agent",
        contextSize: longContextSnapshot.length,
        pendingItems: [],
      };
    }
  },
});
