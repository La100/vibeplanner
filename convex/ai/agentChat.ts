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
  buildTeamMembersContext,
  buildSystemInstructions,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import { prepareMessageWithFile, type FileMetadataForHistory } from "./files";
import type { ProjectContextSnapshot } from "./types";
import { AI_MODEL, calculateCost } from "./config";
import { defaultPrompt } from "./prompt";
import { webcrypto } from "crypto";

// Ensure global crypto in Convex action runtime (needed for agent file storage hashing)
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

const normalizeDisplayMode = (mode?: string | null): "full" | "recent" | undefined => {
  if (!mode) {
    return undefined;
  }

  const normalized = mode.toLowerCase();
  if (
    normalized.includes("advanced") ||
    normalized.includes("long") ||
    normalized.includes("full")
  ) {
    return "full";
  }

  return "recent";
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
          selection: v.optional(v.any()),
          titleChanges: v.optional(v.any()),
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

    // Agent mode identifier for tracking
    const agentModeIdentifier = "convex_agent";

    // Snapshot is loaded on-demand via load_full_project_context tool
    let snapshot: ProjectContextSnapshot | null = null;

    // Lazy snapshot loader - called by AI tool when needed
    const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
      if (!snapshot) {
        console.log("📥 Loading project context snapshot on-demand:", args.projectId);
        snapshot = (await ctx.runQuery(
          internal.ai.longContextQueries.getProjectContextSnapshot,
          { projectId: args.projectId }
        )) as unknown as ProjectContextSnapshot;

        console.log("✅ Snapshot loaded - Tasks:", snapshot!.tasks.length, "| Notes:", snapshot!.notes.length, "| Shopping:", snapshot!.shoppingItems.length);
      }
      return snapshot!;
    };

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
    if (!teamId) {
      throw new Error("Unable to resolve teamId for project while running AI chat");
    }

    // Use default system prompt
    const systemPrompt: string = defaultPrompt;

    // Get team members for AI context
    const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
      projectId: args.projectId,
    });
    const teamMembersContext = buildTeamMembersContext(teamMembers);

    // Build system instructions with context
    const { currentDate, currentDateTime } = getCurrentDateTime();
    const systemInstructions = buildSystemInstructions(
      systemPrompt,
      currentDateTime,
      currentDate,
      teamMembersContext
    );

    // Context size tracking (loaded on-demand by AI tool)
    const longContextSnapshot = "";

    // User message (no automatic context injection - AI uses tools instead)
    let userMessage = args.message;
    let userMessageContent: Array<
      { type: "text"; text: string } | { type: "image"; image: string; mediaType?: string }
    > = [{ type: "text", text: userMessage }];
    let fileMetadata: FileMetadataForHistory | undefined;

    // Handle file if provided
    if (args.fileId) {
      console.log(`🔍 Processing file: ${args.fileId}`);
      const result = await prepareMessageWithFile({
        ctx,
        fileId: (typeof args.fileId === "string" ? args.fileId : (args.fileId as any)) as string,
        baseMessage: userMessage,
      });
      userMessage = result.message;
      userMessageContent = result.content;
      fileMetadata = result.fileMetadata;
    }

    console.log("🧵 Convex Agent mode | Full context available via tool: load_full_project_context");

    try {
      // Create the agent with system instructions and usage tracking
      const agent = createVibePlannerAgent(systemInstructions, {
        projectId: args.projectId,
        runAction: ctx.runAction,
        loadSnapshot: ensureSnapshot,
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
            mode: agentModeIdentifier,
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
            messages: [
              {
                role: "user",
                content: userMessageContent,
              },
            ],
          });
        } catch (e) {
          // If continuing fails (invalid or expired ID), create new thread
          console.log("⚠️ Failed to continue thread, creating new one for user:", args.userClerkId, "| error:", e);
          const { threadId } = await agent.createThread(ctx, {
            userId: args.userClerkId,
          });
          actualThreadId = threadId;

          result = await agent.generateText(ctx, { threadId: actualThreadId }, {
            messages: [
              {
                role: "user",
                content: userMessageContent,
              },
            ],
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
          messages: [
            {
              role: "user",
              content: userMessageContent,
            },
          ],
        });
      }

      if (!actualThreadId) {
        throw new Error("Agent did not return a threadId for chat");
      }

      await ctx.runMutation(internal.ai.threads.getOrCreateThread, {
        threadId: actualThreadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });

      const responseTime = Date.now() - startTime;

      // Extract text response from resolvedOutput
      // In new API, the final text is in resolvedOutput
      const aiResponse = (result as any).resolvedOutput || (result as any).text || "";

      // Process tool calls to create pending items
      const pendingItems: any[] = [];
      const taskCache = new Map<string, any>();

      const getTaskDetails = async (taskId: string) => {
        if (!taskCache.has(taskId)) {
          try {
            const taskDoc = await ctx.runQuery(internal.rag.getTaskById, {
              taskId: taskId as any,
            });
            taskCache.set(taskId, taskDoc);
          } catch (error) {
            console.error("Failed to fetch task details for bulk edit preview:", error);
            taskCache.set(taskId, null);
          }
        }
        return taskCache.get(taskId);
      };

      const shoppingCache = new Map<string, any>();
      const getShoppingItemDetails = async (itemId: string) => {
        if (!shoppingCache.has(itemId)) {
          try {
            const itemDoc = await ctx.runQuery(internal.rag.getShoppingItemById, {
              itemId: itemId as any,
            });
            shoppingCache.set(itemId, itemDoc);
          } catch (error) {
            console.error("Failed to fetch shopping item details for bulk edit preview:", error);
            shoppingCache.set(itemId, null);
          }
        }
        return shoppingCache.get(itemId);
      };

      const processTaskBulkEditResult = async (parsedOutput: any, toolResult: any) => {
        const rawData = parsedOutput?.data ?? {};
        const tasksArray = Array.isArray(rawData.tasks) ? rawData.tasks : [];
        const baseFunctionCall = {
          callId: toolResult.toolCallId || "",
          functionName: toolResult.toolName || "",
          arguments: JSON.stringify(toolResult.input || {}),
        };

        if (tasksArray.length === 0) {
          // Fallback to original payload if tasks array missing
          return [{
            type: parsedOutput.type,
            operation: parsedOutput.operation,
            data: rawData,
            functionCall: baseFunctionCall,
          }];
        }

        const perTaskUpdates: Array<{ taskId: string; updates: Record<string, unknown> }> = tasksArray
          .map((task: any) => {
            if (!task || !task.taskId) {
              return null;
            }
            const { taskId, ...updates } = task;
            return {
              taskId: String(taskId),
              updates: updates as Record<string, unknown>,
            };
          })
          .filter(
            (entry: { taskId: string; updates: Record<string, unknown> } | null): entry is { taskId: string; updates: Record<string, unknown> } =>
              entry !== null
          );

        if (perTaskUpdates.length === 0) {
          return [{
            type: parsedOutput.type,
            operation: parsedOutput.operation,
            data: rawData,
            functionCall: baseFunctionCall,
          }];
        }

        const allowedBulkFields = ["title", "description", "status", "priority", "assignedTo", "tags"];
        const uniqueFields = new Set<string>();
        perTaskUpdates.forEach(
          ({ updates }: { updates: Record<string, unknown> }) => {
            Object.keys(updates || {}).forEach((key) => {
              if (updates[key] !== undefined) {
                uniqueFields.add(key);
              }
            });
          }
        );

        const aggregatedUpdates: Record<string, unknown> = {};
        allowedBulkFields.forEach((field) => {
          let firstValueSet = false;
          let reference: unknown;
          let applicable = true;

          for (const { updates } of perTaskUpdates) {
            if (!(field in updates)) {
              applicable = false;
              break;
            }
            const value = updates[field];
            if (!firstValueSet) {
              reference = value;
              firstValueSet = true;
            } else {
              const areEqual =
                Array.isArray(reference) && Array.isArray(value)
                  ? JSON.stringify(reference) === JSON.stringify(value)
                  : reference === value;
              if (!areEqual) {
                applicable = false;
                break;
              }
            }
          }

          if (applicable && firstValueSet) {
            aggregatedUpdates[field] = reference;
          }
        });

        const aggregatedKeys = new Set(Object.keys(aggregatedUpdates));
        const shouldUseBulkUpdates =
          aggregatedKeys.size > 0 &&
          [...uniqueFields].every((field) => aggregatedKeys.has(field));

        const changeSummaries: string[] = [];
        const detailedChanges: Array<{
          taskId: string;
          original: any;
          updates: Record<string, unknown>;
          changeSummary: string;
        }> = [];
        const titleChanges: Array<{ taskId?: string; currentTitle?: string; originalTitle?: string; newTitle: string }> = [];

        for (const { taskId, updates } of perTaskUpdates) {
          const taskDoc = await getTaskDetails(taskId);
          const currentTitle = taskDoc?.title || taskDoc?.name || "Task";

          const changeParts: string[] = [];
          if (updates.title !== undefined) {
            changeParts.push(`title → ${updates.title}`);
            titleChanges.push({
              taskId,
              currentTitle,
              originalTitle: currentTitle,
              newTitle: updates.title as string,
            });
          }
          if (updates.status !== undefined) {
            changeParts.push(`status → ${updates.status}`);
          }
          if (updates.priority !== undefined) {
            changeParts.push(`priority → ${updates.priority}`);
          }
          if (updates.assignedTo !== undefined) {
            changeParts.push(`assignedTo → ${updates.assignedTo}`);
          }
          if (updates.tags !== undefined && Array.isArray(updates.tags)) {
            changeParts.push(`tags → ${(updates.tags as string[]).join(", ")}`);
          }
          if (updates.description !== undefined) {
            changeParts.push("description updated");
          }
          if (updates.content !== undefined) {
            changeParts.push("content updated");
          }
          if (updates.dueDate !== undefined) {
            changeParts.push(`dueDate → ${updates.dueDate}`);
          }
          if (changeParts.length > 0) {
            const summary = `${currentTitle}: ${changeParts.join(", ")}`;
            changeSummaries.push(summary);
            if (taskDoc) {
              detailedChanges.push({
                taskId,
                original: taskDoc,
                updates,
                changeSummary: summary,
              });
            }
          }
        }

        if (!shouldUseBulkUpdates) {
          // Fall back to individual edit items so we don't lose per-task differences
          const individualItems: any[] = [];
          for (const entry of perTaskUpdates) {
            const { taskId, updates } = entry;
            const taskDoc = await getTaskDetails(taskId);
            if (!taskDoc) {
              continue;
            }
            const newData = { ...updates };
            if (!newData.title && taskDoc.title) {
              newData.title = taskDoc.title;
            }
            individualItems.push({
              type: "task",
              operation: "edit",
              data: newData,
              updates,
              originalItem: taskDoc,
              functionCall: baseFunctionCall,
            });
          }
          if (individualItems.length > 0) {
            return individualItems;
          }
        }

        const selectionSource = rawData.selection || {};
        const selection = {
          taskIds: perTaskUpdates.map(({ taskId }) => taskId),
          applyToAll: selectionSource.applyToAll === true,
          reason: rawData.reason || selectionSource.reason,
        };

        const changeSummary = changeSummaries;

        return [{
          type: "task",
          operation: "bulk_edit",
          data: {
            ...rawData,
            taskIds: selection.taskIds,
            updates: aggregatedUpdates,
            changeSummary,
            tasks: tasksArray,
            taskDetails: detailedChanges,
          },
          updates: aggregatedUpdates,
          selection,
          titleChanges,
          functionCall: baseFunctionCall,
        }];
      };

      const processShoppingBulkEditResult = async (parsedOutput: any, toolResult: any) => {
        const rawData = parsedOutput?.data ?? {};
        const itemsArray = Array.isArray(rawData.items) ? rawData.items : [];
        const baseFunctionCall = {
          callId: toolResult.toolCallId || "",
          functionName: toolResult.toolName || "",
          arguments: JSON.stringify(toolResult.input || {}),
        };

        if (itemsArray.length === 0) {
          // Fallback to original payload if items array missing
          return [{
            type: parsedOutput.type,
            operation: parsedOutput.operation,
            data: rawData,
            functionCall: baseFunctionCall,
          }];
        }

        const perItemUpdates: Array<{ itemId: string; updates: Record<string, unknown> }> = itemsArray
          .map((item: any) => {
            if (!item || !item.itemId) {
              return null;
            }
            const { itemId, ...updates } = item;
            return {
              itemId: String(itemId),
              updates: updates as Record<string, unknown>,
            };
          })
          .filter(
            (entry: { itemId: string; updates: Record<string, unknown> } | null): entry is { itemId: string; updates: Record<string, unknown> } =>
              entry !== null
          );

        if (perItemUpdates.length === 0) {
          return [{
            type: parsedOutput.type,
            operation: parsedOutput.operation,
            data: rawData,
            functionCall: baseFunctionCall,
          }];
        }

        const allowedBulkFields = ["name", "notes", "quantity", "priority", "buyBefore", "supplier", "category", "unitPrice"];
        const uniqueFields = new Set<string>();
        perItemUpdates.forEach(
          ({ updates }: { updates: Record<string, unknown> }) => {
            Object.keys(updates || {}).forEach((key) => {
              if (updates[key] !== undefined) {
                uniqueFields.add(key);
              }
            });
          }
        );

        const aggregatedUpdates: Record<string, unknown> = {};
        allowedBulkFields.forEach((field) => {
          let firstValueSet = false;
          let reference: unknown;
          let applicable = true;

          for (const { updates } of perItemUpdates) {
            if (!(field in updates)) {
              applicable = false;
              break;
            }
            const value = updates[field];
            if (!firstValueSet) {
              reference = value;
              firstValueSet = true;
            } else {
              const areEqual =
                Array.isArray(reference) && Array.isArray(value)
                  ? JSON.stringify(reference) === JSON.stringify(value)
                  : reference === value;
              if (!areEqual) {
                applicable = false;
                break;
              }
            }
          }

          if (applicable && firstValueSet) {
            aggregatedUpdates[field] = reference;
          }
        });

        const aggregatedKeys = new Set(Object.keys(aggregatedUpdates));
        const shouldUseBulkUpdates =
          aggregatedKeys.size > 0 &&
          [...uniqueFields].every((field) => aggregatedKeys.has(field));

        const changeSummaries: string[] = [];
        const detailedChanges: Array<{
          itemId: string;
          original: any;
          updates: Record<string, unknown>;
          changeSummary: string;
        }> = [];
        const nameChanges: Array<{ itemId?: string; currentName?: string; originalName?: string; newName: string }> = [];

        for (const { itemId, updates } of perItemUpdates) {
          const itemDoc = await getShoppingItemDetails(itemId);
          const currentName = itemDoc?.name || "Shopping item";

          const changeParts: string[] = [];
          if (updates.name !== undefined) {
            changeParts.push(`name → ${updates.name}`);
            nameChanges.push({
              itemId,
              currentName,
              originalName: currentName,
              newName: updates.name as string,
            });
          }
          if (updates.quantity !== undefined) {
            changeParts.push(`quantity → ${updates.quantity}`);
          }
          if (updates.priority !== undefined) {
            changeParts.push(`priority → ${updates.priority}`);
          }
          if (updates.supplier !== undefined) {
            changeParts.push(`supplier → ${updates.supplier}`);
          }
          if (updates.category !== undefined) {
            changeParts.push(`category → ${updates.category}`);
          }
          if (updates.unitPrice !== undefined) {
            changeParts.push(`unitPrice → ${updates.unitPrice}`);
          }
          if (updates.notes !== undefined) {
            changeParts.push("notes updated");
          }
          if (updates.buyBefore !== undefined) {
            changeParts.push(`buyBefore → ${updates.buyBefore}`);
          }
          if (changeParts.length > 0) {
            const summary = `${currentName}: ${changeParts.join(", ")}`;
            changeSummaries.push(summary);
            if (itemDoc) {
              detailedChanges.push({
                itemId,
                original: itemDoc,
                updates,
                changeSummary: summary,
              });
            }
          }
        }

        if (!shouldUseBulkUpdates) {
          // Fall back to individual edit items so we don't lose per-item differences
          const individualItems: any[] = [];
          for (const entry of perItemUpdates) {
            const { itemId, updates } = entry;
            const itemDoc = await getShoppingItemDetails(itemId);
            if (!itemDoc) {
              continue;
            }
            const newData = { ...updates };
            if (!newData.name && itemDoc.name) {
              newData.name = itemDoc.name;
            }
            individualItems.push({
              type: "shopping",
              operation: "edit",
              data: newData,
              updates,
              originalItem: itemDoc,
              functionCall: baseFunctionCall,
            });
          }
          if (individualItems.length > 0) {
            return individualItems;
          }
        }

        const selectionSource = rawData.selection || {};
        const selection = {
          itemIds: perItemUpdates.map(({ itemId }) => itemId),
          applyToAll: selectionSource.applyToAll === true,
          reason: rawData.reason || selectionSource.reason,
        };

        const changeSummary = changeSummaries;

        return [{
          type: "shopping",
          operation: "bulk_edit",
          data: {
            ...rawData,
            itemIds: selection.itemIds,
            updates: aggregatedUpdates,
            changeSummary,
            items: itemsArray,
            itemDetails: detailedChanges,
          },
          updates: aggregatedUpdates,
          selection,
          nameChanges,
          functionCall: baseFunctionCall,
        }];
      };

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

                // Search tools and other read-only utilities don't return actionable payloads
                if (!parsedOutput.type) {
                  continue;
                }

                if (parsedOutput.type === "task" && parsedOutput.operation === "bulk_edit") {
                  const transformed = await processTaskBulkEditResult(parsedOutput, item);
                  for (const transformedEntry of transformed) {
                    pendingItems.push(transformedEntry);
                  }
                } else if (parsedOutput.type === "shopping" && parsedOutput.operation === "bulk_edit") {
                  const transformed = await processShoppingBulkEditResult(parsedOutput, item);
                  for (const transformedEntry of transformed) {
                    pendingItems.push(transformedEntry);
                  }
                } else {
                  pendingItems.push({
                    type: parsedOutput.type,
                    operation: parsedOutput.operation,
                    data: parsedOutput.data,
                    updates: parsedOutput.updates,
                    originalItem: parsedOutput.originalItem,
                    selection: parsedOutput.selection,
                    titleChanges: parsedOutput.titleChanges,
                    functionCall: {
                      callId: item.toolCallId || '',
                      functionName: item.toolName || '',
                      arguments: JSON.stringify(item.input || {}),
                    },
                  });
                }
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

      const trimmedUserMessage = args.message.trim();
      const persistedUserMessage =
        trimmedUserMessage.length > 0
          ? trimmedUserMessage
          : fileMetadata
          ? `📎 Attached: ${fileMetadata.fileName ?? "file"}`
          : "";
      const displayMode = normalizeDisplayMode(agentModeIdentifier);
      const responseMode = displayMode ?? agentModeIdentifier;

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
        mode: agentModeIdentifier,
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: true,
      });

      await ctx.runMutation(internal.ai.threads.saveMessagesToThread, {
        threadId: actualThreadId,
        projectId: args.projectId,
        userMessage: persistedUserMessage,
        assistantMessage: aiResponse,
        tokenUsage,
        ragContext: longContextSnapshot.length > 0 ? longContextSnapshot : undefined,
        userMetadata: fileMetadata
          ? {
              fileId: fileMetadata.fileId,
              fileName: fileMetadata.fileName,
              fileType: fileMetadata.fileType,
              fileSize: fileMetadata.fileSize,
            }
          : undefined,
        assistantMetadata: displayMode ? { mode: displayMode } : undefined,
      });

      return {
        response: aiResponse,
        threadId: actualThreadId,
        tokenUsage,
        mode: responseMode,
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
        mode: agentModeIdentifier,
        contextSize: longContextSnapshot.length,
        pendingItems: [],
      };
    }
  },
});
