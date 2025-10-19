/**
 * AI Configuration
 *
 * Central configuration for AI models and settings
 */

/**
 * Default AI model to use
 */
export const AI_MODEL = "gpt-5-nano";

/**
 * AI model configuration
 */
export const AI_CONFIG = {
  model: AI_MODEL,
  temperature: 1,
  maxSteps: 5,
};

/**
 * Calculate estimated cost in USD for token usage
 * Simple estimation - can be updated when pricing is available
 */
export function calculateCost(_model: string, inputTokens: number, outputTokens: number): number {
  // Rough estimate - update when official pricing is available
  return ((inputTokens + outputTokens) / 1000000) * 5;
}
