// Centralized AI pricing configuration
// Token-based system - direct token usage tracking

// === API COSTS (what we pay) ===
// GPT-5 Mini
export const GPT_INPUT_COST_PER_1M = 1.25; // $1.25 per 1M input tokens
export const GPT_OUTPUT_COST_PER_1M = 10.0; // $10 per 1M output tokens

// Gemini 3 Pro Image (4K image)
export const GEMINI_OUTPUT_COST_PER_1M = 30.0; // $30 per 1M output tokens (for images)
export const GEMINI_4K_IMAGE_COST_USD = 0.06; // ~$0.06 per 4K image

// === TOKEN EQUIVALENTS ===
// For simplicity, we count 1 image generation as equivalent to tokens
export const GEMINI_4K_IMAGE_TOKENS = 10000; // 10k tokens per 4K image

// === PLAN TOKENS ===
// Direct token allocations per plan
export const AI_PRO_MONTHLY_TOKENS = 5000000; // 5M tokens
export const AI_SCALE_MONTHLY_TOKENS = 25000000; // 25M tokens
export const PRO_MONTHLY_TOKENS = 5000000; // 5M tokens (same as AI Pro)
export const ENTERPRISE_MONTHLY_TOKENS = 12500000; // 12.5M tokens

// === HELPER FUNCTIONS ===

// Calculate GPT chat cost in USD (for reference/analytics)
export const calculateGPTCostUSD = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * GPT_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * GPT_OUTPUT_COST_PER_1M;
  return inputCost + outputCost;
};

// Calculate GPT chat cost in cents (for reference/analytics)
export const calculateGPTCostCents = (inputTokens: number, outputTokens: number): number => {
  return Math.round(calculateGPTCostUSD(inputTokens, outputTokens) * 100);
};

// Format tokens for display (e.g., "5.2M tokens")
export const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
};
