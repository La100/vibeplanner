// Centralized AI pricing configuration
// All costs are in USD

// === API COSTS (what we pay) ===
// GPT-5 Mini
export const GPT_INPUT_COST_PER_1M = 1.25; // $1.25 per 1M input tokens
export const GPT_OUTPUT_COST_PER_1M = 10.0; // $10 per 1M output tokens

// Gemini 3 Pro Image (4K = 2000 output tokens at $30/1M)
export const GEMINI_OUTPUT_COST_PER_1M = 30.0; // $30 per 1M output tokens (for images)
export const GEMINI_4K_IMAGE_TOKENS = 2000; // 4K image = 2000 output tokens
export const GEMINI_4K_IMAGE_COST_USD = (GEMINI_4K_IMAGE_TOKENS / 1_000_000) * GEMINI_OUTPUT_COST_PER_1M; // ~$0.06

// === CREDIT SYSTEM ===
// 1 credit = 5 cents ($0.05)
export const CENTS_PER_CREDIT = 5;
export const MARGIN_MULTIPLIER = 5; // 5x markup on API costs

// === HELPER FUNCTIONS ===

// Convert API cost in cents to credits (with margin, rounded up)
export const centsToCredits = (cents: number): number => {
  const centsWithMargin = cents * MARGIN_MULTIPLIER;
  return Math.ceil(centsWithMargin / CENTS_PER_CREDIT);
};

// Convert credits to display value in cents (for user)
export const creditsToCents = (credits: number): number => {
  return credits * CENTS_PER_CREDIT;
};

// Calculate GPT chat cost in cents (API cost, no margin)
export const calculateGPTCostCents = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * GPT_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * GPT_OUTPUT_COST_PER_1M;
  return Math.round((inputCost + outputCost) * 100);
};

// Calculate credits for GPT chat (with margin, rounded up)
export const calculateGPTCredits = (inputTokens: number, outputTokens: number): number => {
  const costCents = calculateGPTCostCents(inputTokens, outputTokens);
  return centsToCredits(costCents);
};

// Credits for one 4K image generation (with margin)
// API cost: ~6 cents, with 5x margin = 30 cents = 6 credits
export const GEMINI_4K_IMAGE_CREDITS = centsToCredits(Math.round(GEMINI_4K_IMAGE_COST_USD * 100)); // = 6 credits

// === PLAN CREDITS ===
// AI Pro ($39/month): $10 budget = 1000 cents / 5 = 200 credits
// AI Scale ($99/month): $50 budget = 5000 cents / 5 = 1000 credits
export const AI_PRO_MONTHLY_CREDITS = 200;
export const AI_SCALE_MONTHLY_CREDITS = 1000;
export const PRO_MONTHLY_CREDITS = 200; // Same as AI Pro
export const ENTERPRISE_MONTHLY_CREDITS = 500;

// === LEGACY COMPATIBILITY (for transition) ===
// These are kept for backward compatibility during migration
export const PROVIDER_TOKEN_COST_USD = 0.0000025;
export const TOKEN_PRICE_USD = PROVIDER_TOKEN_COST_USD * 15;
export const GEMINI_IMAGE_2K_PRICE_USD = 0.06; // Updated to real 4K cost

export const tokensFromCents = (cents?: number) =>
  Math.floor(((cents || 0) / 100) / TOKEN_PRICE_USD);

export const centsFromTokens = (tokens: number) =>
  Math.max(1, Math.round(tokens * TOKEN_PRICE_USD * 100));

export const tokensForGeminiImage = Math.ceil(GEMINI_IMAGE_2K_PRICE_USD / TOKEN_PRICE_USD);
