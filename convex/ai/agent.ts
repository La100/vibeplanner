/**
 * VibePlanner AI Agent - Convex Agent Implementation
 *
 * This replaces the manual OpenAI Responses API implementation with @convex-dev/agent
 * while preserving all custom tools and functionality.
 *
 * NOTE: All tools are now imported from tools.ts (single source of truth)
 */

import { components } from "../_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { AI_MODEL, AI_CONFIG } from "./config";
import type { ProjectContextSnapshot } from "./types";
import { createAgentTools } from "./tools";

// Types for agent configuration
interface UsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface AgentContextArgs {
  threadId?: string;
  inputMessages: Array<{ role: "user" | "assistant"; content: string }>;
  inputPrompt: Array<{ role: "user" | "assistant"; content: string }>;
  existingResponses: Array<{ role: "user" | "assistant"; content: string }>;
}

// RunAction type matches ctx.runAction signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunActionFn = (action: any, args: any) => Promise<any>;

interface AgentOptions {
  usageHandler?: (ctx: unknown, usageData: UsageData) => Promise<void>;
  projectId?: string;
  runAction?: RunActionFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
  loadThreadMessages?: (threadId: string) => Promise<Array<{ role: "user" | "assistant"; content: string }>>;
}

/**
 * Create the VibePlanner AI Agent with all tools and advanced features
 *
 * Features:
 * - All 27 custom tools
 * - Context from custom aiMessages table via contextHandler (single source of truth)
 * - Usage tracking callbacks
 * - Rate limiting support
 * - RAG integration ready
 * 
 * Context Management:
 * - We use contextHandler to load messages from our custom aiMessages table
 * - This means our custom tables are the ONLY storage for conversation history
 * - Agent's internal storage is not used (recentMessages: 0)
 * - No vector/text search enabled (project context handled via load_full_project_context tool)
 * 
 * See: https://docs.convex.dev/agents/context
 */
export const createVibePlannerAgent = (
  instructions: string,
  options?: AgentOptions
) => {
  // Agent configuration with proper typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentConfig: Record<string, any> = {
    name: "VibePlanner Assistant",
    languageModel: openai(AI_MODEL),
    instructions,
    maxSteps: AI_CONFIG.maxSteps,

    // Context options - we use contextHandler so disable agent's internal message retrieval
    // See: https://docs.convex.dev/agents/context
    contextOptions: {
      // Don't include tool messages in context (cleaner conversation flow)
      excludeToolMessages: true,
      // Set to 0 - we load messages via contextHandler from our custom tables
      recentMessages: 0,
      // Search options - disabled since we use custom tools for project data search
      searchOptions: {
        limit: 0,
        textSearch: false,
        vectorSearch: false,
      },
      // Don't search other threads - each project conversation is independent
      searchOtherThreads: false,
    },

    // Custom context handler - loads conversation history from our aiMessages table
    // This makes our custom tables the single source of truth for messages
    contextHandler: async (_ctx: unknown, args: AgentContextArgs) => {
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
      
      // Load previous messages from our custom storage if available
      if (options?.loadThreadMessages && args.threadId) {
        try {
          const threadMessages = await options.loadThreadMessages(args.threadId);
          messages.push(...threadMessages);
        } catch (e) {
          console.log("⚠️ Could not load thread messages from custom storage:", e);
        }
      }
      
      // Add the current input (new message from user)
      // args contains: search, recent, inputMessages, inputPrompt, existingResponses
      return [
        ...messages,
        ...args.inputMessages,
        ...args.inputPrompt,
        ...args.existingResponses,
      ];
    },

    // Import all tools from tools.ts (single source of truth)
    tools: createAgentTools({
      projectId: options?.projectId,
      runAction: options?.runAction,
      loadSnapshot: options?.loadSnapshot,
    }),
  };


  // Add usage handler if provided
  if (options?.usageHandler) {
    agentConfig.usageHandler = options.usageHandler;
  }

  // Cast to satisfy Agent constructor while preserving flexibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Agent(components.agent, agentConfig as any);
};
