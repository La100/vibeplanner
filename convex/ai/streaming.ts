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

const apiAny = require("../_generated/api").api as any;
const internalAny = require("../_generated/api").internal as any;
import { components } from "../_generated/api";
import { ActionCtx, MutationCtx, QueryCtx, action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { createThread } from "@convex-dev/agent";
import { createVibePlannerAgent } from "./agent";
import {
  buildTeamMembersContext,
  getCurrentDateTime,
} from "./helpers/contextBuilder";
import { prepareMessageWithFile, prepareMessageWithFiles } from "./files";
import type { ProjectContextSnapshot } from "./types";
import { AI_MODEL, calculateCost } from "./config";
import { buildSoulfulPrompt } from "./systemPrompt";
import { buildCompactContextFromSnapshot } from "./helpers/contextBuilder";
import type { Id } from "../_generated/dataModel";
import { buildFallbackResponseFromTools } from "./helpers/streamResponseBuilder";
import { ASSISTANT_ONBOARDING_THREAD_TITLE, USER_ONBOARDING_THREAD_TITLE } from "./threads";
import { USER_PROFILE_ONBOARDING_IDENTITY } from "./onboarding/userProfile";
import { buildAssistantOnboardingSystemPrompt } from "./onboarding/assistantRules";

const AI_CREDITS_UPGRADE_MESSAGE =
  "Unfortunately, you've run out of free AI credits. Please upgrade your plan to continue.";

const MAX_DAILY_MEMORY_PROMPT_CHARS = 4000;

const isLegacyStyleThreadId = (threadId: string) =>
  threadId.startsWith("thread-") || threadId.startsWith("thread_");

const resolveAgentThreadIdForMessage = async (
  ctx: ActionCtx,
  providedThreadId: string,
  userClerkId: string
): Promise<string> => {
  if (!isLegacyStyleThreadId(providedThreadId)) {
    return providedThreadId;
  }

  const mapping = await ctx.runQuery(internalAny.ai.threads.getThreadForResponses, {
    threadId: providedThreadId,
  });

  if (mapping?.agentThreadId) {
    return mapping.agentThreadId;
  }

  const agentThreadId = await createThread(ctx, components.agent, {
    userId: userClerkId,
  });

  await ctx.runMutation(internalAny.ai.threads.saveAgentThreadMapping, {
    threadId: providedThreadId,
    agentThreadId,
  });

  return agentThreadId;
};

const persistSyntheticAssistantMessage = async (
  ctx: ActionCtx,
  args: {
    providedThreadId: string;
    userClerkId: string;
    text: string;
    agentThreadId?: string;
  }
): Promise<string> => {
  const targetAgentThreadId =
    args.agentThreadId ??
    (await resolveAgentThreadIdForMessage(ctx, args.providedThreadId, args.userClerkId));

  await ctx.runMutation(components.agent.messages.addMessages, {
    threadId: targetAgentThreadId,
    userId: args.userClerkId,
    messages: [
      {
        message: {
          role: "assistant",
          content: args.text,
        },
        text: args.text,
        status: "success",
        finishReason: "stop",
      },
    ],
  });

  return targetAgentThreadId;
};

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
    fileIds: v.optional(v.array(v.union(v.id("files"), v.string()))),
    origin: v.optional(v.union(v.literal("telegram"), v.literal("web"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const agentModeIdentifier = "convex_agent_stream";

    console.log("🚀 [STREAMING START]", {
      threadId: args.threadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      message: args.message.substring(0, 100) + (args.message.length > 100 ? "..." : ""),
      hasFiles: !!(args.fileId || args.fileIds),
      timestamp: new Date().toISOString(),
    });

    try {
      const providedThreadId = args.threadId;
      const isLegacyThreadId = isLegacyStyleThreadId(providedThreadId);

      console.log("📝 [THREAD INFO]", {
        providedThreadId,
        isLegacyThreadId,
      });

      // AUTO-REJECT LOGIC:
      // If there are any pending function calls from previous turns, reject them now.
      // This allows the user to "cancel" a pending action simply by sending a new message.
      const pendingCalls = await ctx.runQuery(apiAny.ai.threads.listPendingItems, {
        threadId: providedThreadId,
      });

      if (pendingCalls.length > 0) {
        // Filter to only actual pending items to avoid touching history
        const actuallyPending = pendingCalls.filter((c: { status?: string }) => c.status === "pending");

        if (actuallyPending.length > 0) {
          console.log("🚫 [AUTO-REJECT] Found pending calls, rejecting them before new message", {
            count: actuallyPending.length,
            callIds: actuallyPending.map((c: { callId: string }) => c.callId),
          });

          // Group by responseId for efficient batch updates
          const pendingByResponse = new Map<string, Array<{ callId: string; result?: string | null }>>();
          for (const call of actuallyPending) {
            const list = pendingByResponse.get(call.responseId) || [];
            list.push({ callId: call.callId, result: null }); // null result = reject
            pendingByResponse.set(call.responseId, list);
          }

          // Execute rejections
          for (const [responseId, results] of pendingByResponse.entries()) {
            await ctx.runMutation(apiAny.ai.threads.markFunctionCallsAsConfirmed, {
              threadId: providedThreadId,
              responseId,
              results: results.map((r) => ({ ...r, status: "rejected" })) as any,
            });
          }
        }
      }

      // Streaming start

      const threadMeta = await ctx.runQuery(internalAny.ai.threads.getThreadForResponses, {
        threadId: providedThreadId,
      });
      const isUserProfileOnboardingThread =
        threadMeta?.title === USER_ONBOARDING_THREAD_TITLE;

      // Resolve teamId from project
      const projectForTeam = await ctx.runQuery(apiAny.projects.getProject, {
        projectId: args.projectId,
      });
      const teamId = projectForTeam?.teamId ?? null;
      if (!teamId) {
        throw new Error("Unable to resolve teamId");
      }

      // Get project's SOUL (per-assistant personality)
      let projectSoul = (projectForTeam as any)?.soul || "";

      const contextStateLines: string[] = [];

      if (isUserProfileOnboardingThread) {
        projectSoul = USER_PROFILE_ONBOARDING_IDENTITY;
        contextStateLines.push("USER_PROFILE_ONBOARDING: true");
      }

      // Inject messaging connection context so the assistant is aware of external channels (e.g. Telegram)
      try {
        const channels = await ctx.runQuery(apiAny.messaging.channels.listChannelsForProject, {
          projectId: args.projectId,
        });

        const active = channels.filter((c: any) => c.isActive);
        const activePlatforms = Array.from(new Set(active.map((c: any) => c.platform)));
        const telegramBotUsername = (projectForTeam as any)?.telegramBotUsername;
        const whatsappNumber = (projectForTeam as any)?.whatsappNumber;
        const telegramConfigured = !!(projectForTeam as any)?.telegramBotToken || !!telegramBotUsername;
        const whatsappConfigured = !!whatsappNumber;

        contextStateLines.push(
          `CONNECTED_MESSAGING_CHANNELS: ${activePlatforms.length > 0 ? activePlatforms.join(", ") : "none"}`
        );
        contextStateLines.push(
          `TELEGRAM_BOT_CONFIGURED: ${telegramConfigured ? "true" : "false"}`
        );
        contextStateLines.push(
          `TELEGRAM_BOT_USERNAME: ${telegramBotUsername ? telegramBotUsername : "unset"}`
        );
        contextStateLines.push(
          `WHATSAPP_CONFIGURED: ${whatsappConfigured ? "true" : "false"}`
        );
        contextStateLines.push(
          `WHATSAPP_NUMBER: ${whatsappNumber ? whatsappNumber : "unset"}`
        );
        contextStateLines.push(
          `PROJECT_ID: ${args.projectId}`
        );
      } catch (e) {
        // Non-fatal. The assistant can still function without this context.
        console.warn("⚠️ [MESSAGING CHANNEL CONTEXT FAILED]", e);
      }

      // Add message origin so the AI knows where this message came from
      if (args.origin === "telegram") {
        contextStateLines.push("MESSAGE_ORIGIN: telegram (this message was sent by the user via Telegram, not the web UI)");
      }

      // Add onboarding prompt only in the dedicated assistant onboarding thread
      const isAssistantOnboardingThread =
        threadMeta?.title === ASSISTANT_ONBOARDING_THREAD_TITLE;

      if (isAssistantOnboardingThread) {
        const presetId = (projectForTeam as any)?.assistantPreset || "custom";
        projectSoul = buildAssistantOnboardingSystemPrompt(presetId);
        contextStateLines.push("ASSISTANT_ONBOARDING: pending");
      }

      const contextState = contextStateLines.join("\n");

      const aiAccess = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccessByProject, {
        projectId: args.projectId,
      });

      console.log("🔐 [AI ACCESS CHECK]", {
        allowed: aiAccess.allowed,
        message: aiAccess.message,
      });

      if (!aiAccess.allowed) {
        console.error("❌ [AI ACCESS DENIED]", aiAccess.message);
        const quotaMessage = AI_CREDITS_UPGRADE_MESSAGE;
        await persistSyntheticAssistantMessage(ctx, {
          providedThreadId,
          userClerkId: args.userClerkId,
          text: quotaMessage,
        });
        await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
          threadId: providedThreadId,
          lastMessageAt: Date.now(),
          lastMessagePreview: quotaMessage,
          lastMessageRole: "assistant",
          messageCountDelta: 1,
        });
        await ctx.runMutation(internalAny.ai.system.appendDailyMemory, {
          content: `**User**: ${args.message}\n**Assistant**: ${quotaMessage}\n---\n`,
          threadId: providedThreadId,
          projectId: args.projectId,
        });
        return null;
      }

      // Snapshot loaded on-demand
      let snapshot: ProjectContextSnapshot | null = null;

      const ensureSnapshot = async (): Promise<ProjectContextSnapshot> => {
        if (!snapshot) {
          snapshot = (await ctx.runQuery(
            internalAny.ai.longContextQueries.getProjectContextSnapshot,
            { projectId: args.projectId }
          )) as unknown as ProjectContextSnapshot;
        }
        return snapshot!;
      };

      // 1. Fetch System Context (Agents, Memory) - SOUL now comes from project
      const systemContext = await ctx.runQuery(internalAny.ai.system.getSystemContext, {
        projectId: args.projectId,
      });

      // 2. Build User Context
      const teamMembers = await ctx.runQuery(internalAny.teams.getTeamMembersWithUserDetails, {
        projectId: args.projectId,
      });
      const teamMembersContext = buildTeamMembersContext(teamMembers);

      const team = await ctx.runQuery(apiAny.teams.getTeamById, { teamId: teamId! });
      const timezone = team?.timezone;
      const { currentDate, currentDateTime } = getCurrentDateTime(timezone);

      // Create a user context string
      const currentUserSection = args.userClerkId
        ? `\nCURRENT USER ID: ${args.userClerkId}`
        : "";

      let userProfileSection = "\nUSER PROFILE (from onboarding):\n- not provided";
      try {
        const userDoc = await ctx.runQuery(apiAny.users.getByClerkId, {
          clerkUserId: args.userClerkId,
        });

        const lines: string[] = [];
        if (userDoc?.preferredLanguage) lines.push(`Preferred language: ${userDoc.preferredLanguage}`);
        if (userDoc?.preferredName) lines.push(`Preferred name: ${userDoc.preferredName}`);
        if (typeof userDoc?.age === "number") lines.push(`Age: ${userDoc.age}`);
        if (userDoc?.gender) {
          const genderValue =
            userDoc.gender === "other" && userDoc.genderOther
              ? `other (${userDoc.genderOther})`
              : userDoc.gender;
          lines.push(`Gender: ${genderValue}`);
        }
        if (userDoc?.workMode) {
          const workModeValue =
            userDoc.workMode === "other" && userDoc.workModeOther
              ? `other (${userDoc.workModeOther})`
              : userDoc.workMode;
          lines.push(`Work mode: ${workModeValue}`);
        }

        if (lines.length > 0) {
          userProfileSection = `\nUSER PROFILE (from onboarding):\n${lines.map((l) => `- ${l}`).join("\n")}`;
        }
      } catch (e) {
        console.warn("⚠️ [USER PROFILE CONTEXT FAILED]", e);
      }

      const userContext = `
${teamMembersContext}
${currentUserSection}
${userProfileSection}
`;

      // 3. Build Project Context
      const projectContextSnapshot = await ensureSnapshot();
      const formattedProjectContext = buildCompactContextFromSnapshot(projectContextSnapshot);

      const memorySections: string[] = [];
      if (systemContext.longTermMemory) {
        memorySections.push(`# LONG-TERM MEMORY\n${systemContext.longTermMemory}`);
      }
      const dailyMemoryForPrompt = systemContext.todayMemory
        ? systemContext.todayMemory.length > MAX_DAILY_MEMORY_PROMPT_CHARS
          ? `...[older daily memory truncated]\n${systemContext.todayMemory.slice(-MAX_DAILY_MEMORY_PROMPT_CHARS)}`
          : systemContext.todayMemory
        : "";
      if (dailyMemoryForPrompt) {
        memorySections.push(`# DAILY MEMORY (${currentDate})\n${dailyMemoryForPrompt}`);
      }
      const memoryBlock = memorySections.join("\n\n");

      // 4. Build System Prompt - use project's SOUL as identity
      const systemInstructions = buildSoulfulPrompt({
        identity: projectSoul, // Per-project SOUL
        workspace: systemContext.workspace,
        userContext: userContext,
        memory: memoryBlock,
        contextState,
        projectContext: formattedProjectContext,
        dateTime: `${currentDateTime} (${currentDate}) ${timezone ? `Timezone: ${timezone}` : ""}`,
      });

      console.log("📋 [SYSTEM PROMPT BUILT]", {
        soulLength: projectSoul.length,
        memoryLength: memoryBlock.length,
        totalLength: systemInstructions.length,
      });

      // Prepare user message
      let userPrompt = args.message;
      let userMessageContent:
        | string
        | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: string; mediaType?: string }
          | { type: "file"; data: string; mediaType: string }
        > = userPrompt;
      if (args.fileIds && args.fileIds.length > 0) {
        const result = await prepareMessageWithFiles({
          ctx,
          fileIds: args.fileIds as string[],
          baseMessage: args.message,
        });
        userPrompt = result.message;
        userMessageContent = result.content;
      } else if (args.fileId) {
        const result = await prepareMessageWithFile({
          ctx,
          fileId: args.fileId as string,
          baseMessage: args.message,
        });
        userPrompt = result.message;
        userMessageContent = result.content;
      }

      console.log("📨 [USER MESSAGE]", {
        messageLength: userPrompt.length,
        hasMultipartContent: Array.isArray(userMessageContent),
        fileIds: args.fileIds?.length || 0,
        fileId: args.fileId || null,
      });

      // Create agent
      const agent = createVibePlannerAgent(systemInstructions, {
        projectId: args.projectId as string,
        actorUserId: args.userClerkId,
        threadId: providedThreadId,
        latestUserMessage: userPrompt,
        runAction: ctx.runAction,
        runMutation: ctx.runMutation,
        runQuery: ctx.runQuery,
        loadSnapshot: ensureSnapshot,
      });

      console.log("🤖 [AGENT CREATED]");

      // Determine the agent thread ID
      let agentThreadId: string | undefined;

      if (isLegacyThreadId) {
        // Legacy thread ID - look up or create mapping
        const mapping: any = await ctx.runQuery(internalAny.ai.threads.getThreadForResponses, {
          threadId: providedThreadId
        });
        if (mapping && mapping.agentThreadId) {
          agentThreadId = mapping.agentThreadId;
          console.log("🔗 [FOUND EXISTING MAPPING]", {
            legacyThreadId: providedThreadId,
            agentThreadId,
          });
        } else {
          // Create new agent thread for legacy ID
          console.log("🆕 [CREATE NEW AGENT THREAD]");
          const createResult = await agent.createThread(ctx, {
            userId: args.userClerkId,
          });
          agentThreadId = createResult.threadId;

          console.log("💾 [SAVE THREAD MAPPING]", {
            legacyThreadId: providedThreadId,
            agentThreadId: agentThreadId,
          });

          await ctx.runMutation(internalAny.ai.threads.saveAgentThreadMapping, {
            threadId: providedThreadId,
            agentThreadId: agentThreadId
          });
        }
      } else {
        // Not a legacy ID - providedThreadId IS the agent thread ID
        // (created via createThread in the mutation)
        agentThreadId = providedThreadId;
        console.log("✅ [USING DIRECT AGENT THREAD ID]", {
          agentThreadId,
        });
      }

      console.log("🔗 [FINAL THREAD ID]", {
        agentThreadId,
        providedThreadId,
      });

      // Stream via Convex Agent (saves deltas for subscriptions)

      console.log("🌊 [START STREAMING]", {
        agentThreadId,
        userId: args.userClerkId,
      });

      // REPLAY LOGIC:
      // Fetch confirmed/rejected calls to feed back into agent history
      const replayCalls = (await ctx.runQuery(internalAny.ai.threads.getPendingFunctionCalls, {
        threadId: providedThreadId,
      })) as any[];

      const toolResultMessages: any[] = [];
      const replayedCallIds: string[] = [];

      if (replayCalls && replayCalls.length > 0) {
        console.log("🔄 [REPLAY] Found calls to replay", { count: replayCalls.length });

        const toolResults = replayCalls.map((call) => {
          replayedCallIds.push(call._id);
          return {
            type: "tool-result",
            toolCallId: call.callId,
            toolName: call.functionName,
            result:
              call.status === "rejected"
                ? JSON.stringify({ error: "User rejected this action." })
                : call.result,
          };
        });

        toolResultMessages.push({
          role: "tool" as const,
          content: toolResults,
        });
      }

      let response;
      try {
        response = await agent.streamText(
          ctx,
          { userId: args.userClerkId, threadId: agentThreadId },
          {
            system: systemInstructions,
            messages: [
              ...toolResultMessages,
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
        console.log("✅ [STREAMING INITIATED]");

        // Mark calls as replayed to prevent duplicate processing
        if (replayedCallIds.length > 0) {
          await ctx.runMutation(internalAny.ai.threads.markFunctionCallsAsReplayed, {
            callIds: replayedCallIds as any,
          });
        }
      } catch (err) {
        console.error("❌ [STREAMING FAILED]", err);
        throw err;
      }

      // Get final result - need to extract from steps when tools are used
      const usage = await response.usage;

      const totalInputTokens = (usage as any)?.inputTokens || (usage as any)?.promptTokens || 0;
      const totalOutputTokens = (usage as any)?.outputTokens || (usage as any)?.completionTokens || 0;

      console.log("📊 [TOKEN USAGE]", {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      });

      // Extract the latest text from steps (avoid concatenating duplicates)
      const steps = await response.steps;

      console.log("🔄 [PROCESSING STEPS]", {
        stepsCount: steps?.length || 0,
      });

      let fullResponse = "";
      let hasSyntheticAssistantMessage = false;

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
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          console.log(`📋 [STEP ${i + 1}/${steps.length}]`, {
            hasToolCalls: !!step.toolCalls,
            toolCallsCount: step.toolCalls?.length || 0,
            toolNames: step.toolCalls?.map((tc: any) => tc.toolName || tc.name) || [],
            hasToolResults: !!step.toolResults,
            toolResultsCount: step.toolResults?.length || 0,
            hasText: !!step.text,
            textLength: step.text?.length || 0,
          });
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

      // RETRY: If the agent returned an empty response (corrupted thread state),
      // create a fresh agent thread and retry once.
      if (!fullResponse && totalOutputTokens === 0 && allToolCalls.length === 0) {
        console.warn("⚠️ [EMPTY RESPONSE] Agent returned nothing — creating fresh thread and retrying");

        const freshThread = await agent.createThread(ctx, {
          userId: args.userClerkId,
        });
        agentThreadId = freshThread.threadId;

        // Update the mapping so future messages use the new thread
        if (isLegacyThreadId) {
          await ctx.runMutation(internalAny.ai.threads.saveAgentThreadMapping, {
            threadId: providedThreadId,
            agentThreadId,
          });
        }

        try {
          response = await agent.streamText(
            ctx,
            { userId: args.userClerkId, threadId: agentThreadId },
            {
              system: systemInstructions,
              messages: [
                { role: "user" as const, content: userMessageContent },
              ],
              toolChoice: "auto" as const,
            },
            {
              saveStreamDeltas: {
                chunking: "word",
              },
            },
          );
          console.log("✅ [RETRY STREAMING INITIATED]");

          // Re-extract response data from retry
          const retryUsage = await response.usage;
          const retrySteps = await response.steps;

          const retryExtractStepText = (step: any): string => {
            let text = "";
            if (typeof step?.text === "string") text = step.text;
            if (step?.content && Array.isArray(step.content)) {
              const ct = step.content
                .filter((p: any) => p?.type === "text" && typeof p.text === "string")
                .map((p: any) => p.text)
                .join("");
              if (ct.length > 0) text = ct;
            }
            return text;
          };

          fullResponse = "";
          if (retrySteps && Array.isArray(retrySteps)) {
            for (const step of retrySteps) {
              const t = retryExtractStepText(step);
              if (t && t.trim().length > 0) fullResponse = t;
              if (step.toolCalls && Array.isArray(step.toolCalls)) allToolCalls.push(...step.toolCalls);
              if (step.toolResults && Array.isArray(step.toolResults)) {
                for (const r of step.toolResults) {
                  allToolResults.push(r);
                  const rid = (r as any)?.toolCallId || (r as any)?.id;
                  if (rid) toolResultMap.set(rid, r);
                }
              }
            }
          }
          if (!fullResponse) fullResponse = await response.text;

          console.log("🔄 [RETRY RESULT]", {
            responseLength: fullResponse.length,
            outputTokens: (retryUsage as any)?.outputTokens || 0,
          });
        } catch (retryErr) {
          console.error("❌ [RETRY STREAMING FAILED]", retryErr);
        }

        // If retry also returned nothing, the issue is likely external (API key, billing, quota)
        if (!fullResponse) {
          console.error(
            "🚨 [AI PROVIDER ERROR] Both original and retry calls returned 0 tokens. " +
            "This usually means the OpenAI API key is invalid, billing has run out, or the model is unavailable. " +
            "Check your OpenAI dashboard at https://platform.openai.com/usage"
          );
          fullResponse = AI_CREDITS_UPGRADE_MESSAGE;
          hasSyntheticAssistantMessage = true;
        }
      }

      // If still empty, but we had tool calls, derive fallback from tool results
      if (!fullResponse && allToolCalls.length > 0) {
        const toolSummary = buildFallbackResponseFromTools(allToolCalls, allToolResults);
        if (toolSummary) {
          fullResponse = toolSummary;
        } else {
          fullResponse = "✅ Operation completed";
        }
        hasSyntheticAssistantMessage = true;
      }

      if (!fullResponse) {
        fullResponse = AI_CREDITS_UPGRADE_MESSAGE;
        hasSyntheticAssistantMessage = true;
      }

      console.log("💬 [FINAL RESPONSE]", {
        responseLength: fullResponse.length,
        responsePreview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? "..." : ""),
        toolCallsCount: allToolCalls.length,
      });

      if (allToolCalls.length > 0) {

        console.log("🔧 [PROCESSING TOOL CALLS]", {
          toolCallsCount: allToolCalls.length,
          toolNames: allToolCalls.map((tc: any) => tc.toolName || tc.name).filter(Boolean),
        });

        // Tools that should NOT create pending items (read-only/search tools)
        const readOnlyTools = new Set([
          'search_tasks',
          'load_full_project_context',
          'web_search',
          'remember',
          'add_diary_entry',
        ]);

        const functionCalls: Array<{
          callId: string;
          functionName: string;
          arguments: string;
        }> = [];

        // Fallback map so delete/edit tools still create pending items even if parsing fails
        const toolNameDefaults: Record<string, { type: string; operation?: string }> = {
          delete_task: { type: 'task', operation: 'delete' },
          edit_task: { type: 'task', operation: 'edit' },
          create_multiple_tasks: { type: 'task', operation: 'bulk_create' },
          set_habit_completion: { type: 'habit', operation: 'complete' },
          clear_habit_reminders: { type: 'habit', operation: 'bulk_edit' },
          set_habit_reminder: { type: 'habit', operation: 'edit' },
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
            } catch {
              // Could not parse tool result
            }
          }

          // Fallback payload based on tool name/args when parsing fails or lacks type/operation
          if (!payload || !payload.type || !payload.operation) {
            const defaults = toolNameDefaults[toolName];
            const normalizedArgs = typeof toolArgs === 'string'
              ? (() => { try { return JSON.parse(toolArgs); } catch { return toolArgs; } })()
              : toolArgs;

            // Handle case where parsing returns a string (double JSON stringified)
            const finalArgs = typeof normalizedArgs === 'string'
              ? (() => { try { return JSON.parse(normalizedArgs); } catch { return normalizedArgs; } })()
              : normalizedArgs;

            payload = {
              ...(payload && typeof payload === 'object' ? payload : {}),
              type: payload?.type ?? defaults?.type ?? toolName,
              operation: payload?.operation ?? defaults?.operation,
              data: payload?.data ?? finalArgs ?? {},
            };
          } else if (!payload.data) {
            payload.data = toolArgs ?? {};
          }

          // Only persist if we have at least a type
          if (payload?.type) {
            functionCalls.push({
              callId: toolCallId,
              functionName: toolName,
              arguments: JSON.stringify(payload),
            });
          }
        }

        const pendingCalls = await ctx.runQuery(apiAny.ai.threads.listPendingItems, {
          threadId: providedThreadId,
        });

        const shouldReplacePending =
          pendingCalls.length === 1 &&
          functionCalls.length === 1;

        if (shouldReplacePending) {
          const pendingCall = pendingCalls[0];
          const safeParse = (value?: string) => {
            if (!value) return null;
            try {
              return JSON.parse(value);
            } catch {
              return null;
            }
          };
          const pendingPayload = safeParse(pendingCall.arguments);
          const nextPayload = safeParse(functionCalls[0].arguments);

          const isPendingCreateTask =
            pendingPayload?.type === "task" && pendingPayload?.operation === "create";

          if (isPendingCreateTask && nextPayload?.type === "task") {
            const pendingData = (pendingPayload?.data ?? {}) as Record<string, unknown>;
            const nextData = (nextPayload?.data ?? {}) as Record<string, unknown>;
            const mergedData = { ...pendingData, ...nextData } as Record<string, unknown>;
            delete mergedData.taskId;

            const mergedPayload = {
              ...pendingPayload,
              type: "task",
              operation: "create",
              data: mergedData,
            };

            functionCalls[0] = {
              ...functionCalls[0],
              functionName: "create_task",
              arguments: JSON.stringify(mergedPayload),
            };

            const groupedResults = new Map<string, { callId: string; result: string | undefined }[]>();
            const responseId = pendingCall.responseId;
            groupedResults.set(responseId, [
              { callId: pendingCall.callId, result: undefined },
            ]);

            for (const [responseId, results] of groupedResults.entries()) {
              await ctx.runMutation(apiAny.ai.threads.markFunctionCallsAsConfirmed, {
                threadId: providedThreadId,
                responseId,
                results,
              });
            }
          }
        }

        // Save action function calls to database for confirmation UI
        // Filter out read-only tools that don't require confirmation
        const READ_ONLY_TOOLS = new Set([
          "search_items",
          "search_tasks",
          "load_full_project_context",
          "web_search",
          "remember",
          "add_diary_entry",
        ]);

        const actionFunctionCalls = functionCalls.filter(
          (fc) => !READ_ONLY_TOOLS.has(fc.functionName)
        );

        if (actionFunctionCalls.length > 0) {
          const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          console.log("💾 [SAVE FUNCTION CALLS]", {
            responseId,
            functionCallsCount: actionFunctionCalls.length,
            functionNames: actionFunctionCalls.map((fc) => fc.functionName),
            filteredOutCount: functionCalls.length - actionFunctionCalls.length,
          });

          await ctx.runMutation(internalAny.ai.threads.saveFunctionCalls, {
            threadId: providedThreadId,
            projectId: args.projectId,
            responseId,
            functionCalls: actionFunctionCalls,
          });

          // Auto-confirm and execute immediately (approval flow disabled).
          try {
            await ctx.runMutation(internalAny.ai.threads.autoConfirmFunctionCalls, {
              threadId: providedThreadId,
              projectId: args.projectId,
              responseId,
              actorUserId: args.userClerkId,
              functionCalls: actionFunctionCalls,
            });
          } catch (error) {
            console.error("❌ [AUTO-CONFIRM FAILED]", error);
          }
        } else {

          console.log("⚠️ [NO FUNCTION CALLS TO SAVE]", {
            allToolCallsCount: allToolCalls.length,
            message: "Tool calls did not generate pending items (read-only or parsing failed)",
          });


        }
      }

      if (hasSyntheticAssistantMessage && fullResponse.length > 0) {
        try {
          agentThreadId = await persistSyntheticAssistantMessage(ctx, {
            providedThreadId,
            userClerkId: args.userClerkId,
            text: fullResponse,
            agentThreadId,
          });
        } catch (syntheticPersistError) {
          console.error("❌ [SYNTHETIC MESSAGE PERSIST FAILED]", syntheticPersistError);
        }
      }

      // Calculate token usage
      const syntheticUsage = hasSyntheticAssistantMessage;
      const estimatedInputTokens = Math.ceil(userPrompt.length / 4);
      const estimatedOutputTokens = Math.ceil(fullResponse.length / 4);
      const usageInputTokens = totalInputTokens || (syntheticUsage ? 0 : estimatedInputTokens);
      const usageOutputTokens = totalOutputTokens || (syntheticUsage ? 0 : estimatedOutputTokens);
      const tokenUsage = {
        inputTokens: usageInputTokens,
        outputTokens: usageOutputTokens,
        totalTokens: usageInputTokens + usageOutputTokens,
        estimatedCostUSD: calculateCost(AI_MODEL,
          usageInputTokens,
          usageOutputTokens
        ),
      };

      const responseTime = Date.now() - startTime;

      console.log("📝 [UPDATE THREAD SUMMARY]", {
        threadId: providedThreadId,
        responsePreview: fullResponse.substring(0, 50) + "...",
      });

      await ctx.runMutation(internalAny.ai.threads.updateThreadSummary, {
        threadId: providedThreadId,
        lastMessageAt: Date.now(),
        lastMessagePreview: fullResponse,
        lastMessageRole: "assistant",
        messageCountDelta: 1,
      });

      console.log("💰 [SAVE TOKEN USAGE]", {
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        estimatedCostUSD: tokenUsage.estimatedCostUSD,
        responseTimeMs: responseTime,
      });

      // Append to Daily Memory (scoped to project)
      await ctx.runMutation(internalAny.ai.system.appendDailyMemory, {
        content: `**User**: ${userPrompt}\n**Assistant**: ${fullResponse}\n---\n`,
        threadId: providedThreadId,
        projectId: args.projectId,
      });

      // Save usage statistics
      await ctx.runMutation(internalAny.ai.usage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: teamId as Id<"teams">,
        userClerkId: args.userClerkId,
        threadId: providedThreadId,
        model: AI_MODEL,
        feature: "assistant",
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        contextSize: systemInstructions.length + userPrompt.length,
        mode: agentModeIdentifier,
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: true,
      });

      // Streaming completed
      console.log("✅ [STREAMING COMPLETED]", {
        threadId: providedThreadId,
        responseTimeMs: responseTime,
        success: true,
      });

      return null;
    } catch (error) {
      console.error("❌ [STREAMING ERROR]", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        threadId: args.threadId,
      });
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
    fileIds: v.optional(v.array(v.union(v.id("files"), v.string()))),
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
    console.log("🎬 [START STREAMING CHAT ACTION]", {
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      hasThreadId: !!args.threadId,
      messageLength: args.message.length,
    });

    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        console.error("❌ [UNAUTHORIZED] No identity");
        throw new Error("Unauthorized");
      }

      if (identity.subject !== args.userClerkId) {
        console.error("❌ [FORBIDDEN] Identity mismatch");
        throw new Error("Forbidden");
      }

      const project = await ctx.runQuery(apiAny.projects.getProject, { projectId: args.projectId });
      if (!project) {
        throw new Error("Project not found");
      }

      const membership = await ctx.runQuery(apiAny.teams.getCurrentUserTeamMember, {
        teamId: project.teamId,
      });

      if (!membership || membership.isActive === false) {
        throw new Error("Forbidden");
      }

      // Generate threadId if not provided
      const providedThreadId = typeof args.threadId === "string" && args.threadId.trim().length > 0
        ? args.threadId
        : `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      console.log("📅 [SCHEDULE STREAMING]", {
        providedThreadId,
        isNewThread: !args.threadId,
      });

      // Call the mutation to initialize and schedule streaming
      // Type annotation to break circular reference
      await ctx.scheduler.runAfter(0, internalAny.ai.streaming.internalDoStreaming, {
        message: args.message,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
        threadId: providedThreadId,
        fileId: args.fileId,
        fileIds: args.fileIds,
      });

      console.log("✅ [STREAMING SCHEDULED]", {
        threadId: providedThreadId,
      });

      return {
        threadId: providedThreadId,
        agentThreadId: undefined,
        success: true,
      };
    } catch (error) {
      console.error("❌ [ERROR SCHEDULING STREAMING]", {
        error: error instanceof Error ? error.message : String(error),
        threadId: args.threadId,
      });
      return {
        threadId: args.threadId || "",
        agentThreadId: undefined,
        success: false,
        error: (error as Error).message,
      };
    }
  },
});
