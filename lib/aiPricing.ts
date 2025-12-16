// Centralized AI pricing configuration
// Adjust PROVIDER_TOKEN_COST_USD when provider rates change.
export const PROVIDER_TOKEN_COST_USD = 0.0000025; // e.g., $2.50 per 1M tokens
export const MARGIN_MULTIPLIER = 15; // 5x markup

// Final price per token charged to users
export const TOKEN_PRICE_USD = PROVIDER_TOKEN_COST_USD * MARGIN_MULTIPLIER;

// Known provider image pricing (Nano Banana Pro 2K)
export const GEMINI_IMAGE_2K_PRICE_USD = 0.139; // per 2048x2048 image

export const tokensFromCents = (cents?: number) =>
  Math.floor(((cents || 0) / 100) / TOKEN_PRICE_USD);

export const centsFromTokens = (tokens: number) =>
  Math.max(1, Math.round(tokens * TOKEN_PRICE_USD * 100));

export const tokensForGeminiImage = Math.ceil(GEMINI_IMAGE_2K_PRICE_USD / TOKEN_PRICE_USD);
