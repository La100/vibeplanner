/**
 * Token Usage Utils
 *
 * Utilities for calculating token usage and costs
 */

import type { AITokenUsage } from "../types";
import { AI_INPUT_COST_PER_1M, AI_OUTPUT_COST_PER_1M } from "../config";

export const calculateTokenUsage = (
  result: any,
  userMessage: string,
  aiResponse: string,
): AITokenUsage => {
  const tokenUsage: AITokenUsage = {
    inputTokens: result.usage?.input_tokens || Math.floor(userMessage.length / 4),
    outputTokens: result.usage?.output_tokens || Math.floor(aiResponse.length / 4),
    totalTokens: result.usage?.total_tokens || 0,
    estimatedCostUSD: 0,
  };

  if (!tokenUsage.totalTokens) {
    tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
  }

  // Org-wide pricing: $1.75/1M input tokens, $14/1M output tokens
  const inputCost = (tokenUsage.inputTokens / 1_000_000) * AI_INPUT_COST_PER_1M;
  const outputCost = (tokenUsage.outputTokens / 1_000_000) * AI_OUTPUT_COST_PER_1M;
  tokenUsage.estimatedCostUSD = inputCost + outputCost;

  return tokenUsage;
};
