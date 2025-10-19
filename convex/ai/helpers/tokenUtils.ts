/**
 * Token Usage Utils
 *
 * Utilities for calculating token usage and costs
 */

import type { AITokenUsage } from "../types";

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

  // GPT-5 pricing: $1.25/1M input tokens, $10/1M output tokens
  const inputCost = (tokenUsage.inputTokens / 1000000) * 1.25;
  const outputCost = (tokenUsage.outputTokens / 1000000) * 10;
  tokenUsage.estimatedCostUSD = inputCost + outputCost;

  return tokenUsage;
};
