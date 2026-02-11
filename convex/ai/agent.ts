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

// RunAction type matches ctx.runAction signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunActionFn = (action: any, args: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunMutationFn = (mutation: any, args: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunQueryFn = (query: any, args: any) => Promise<any>;

interface AgentOptions {
  projectId?: string;
  actorUserId?: string;
  runAction?: RunActionFn;
  runMutation?: RunMutationFn;
  runQuery?: RunQueryFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
}

/**
 * Create the VibePlanner AI Agent with all tools and advanced features
 *
 * Features:
 * - All 27 custom tools
 * - Uses Convex Agent threads/messages for context
 * - Project context handled via load_full_project_context tool
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

    // Context options - we use contextHandler to load messages from custom tables
    // See: https://docs.convex.dev/agents/context
    contextOptions: {
      // Keep tool payloads out of context to reduce token overhead on long threads.
      // The assistant should summarize relevant tool outcomes in normal assistant turns.
      excludeToolMessages: true,
    },

    // Import all tools from tools.ts (single source of truth)
    tools: createAgentTools({
      projectId: options?.projectId,
      actorUserId: options?.actorUserId,
      runAction: options?.runAction,
      runMutation: options?.runMutation,
      runQuery: options?.runQuery,
      loadSnapshot: options?.loadSnapshot,
    }),
  };

  // Cast to satisfy Agent constructor while preserving flexibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Agent(components.agent, agentConfig as any);
};
