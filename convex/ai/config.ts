
export const AI_MODEL = "gpt-5-mini";


export const AI_CONFIG = {
  model: AI_MODEL,
  temperature: 1,
  maxSteps: 5,
};


export function calculateCost(_model: string, inputTokens: number, outputTokens: number): number {
  // Pricing: $1.25 per 1M input tokens, $10 per 1M output tokens (matches GPT-5 baseline used elsewhere)
  const inputCost = (inputTokens / 1_000_000) * 1.25;
  const outputCost = (outputTokens / 1_000_000) * 10;
  return inputCost + outputCost;
}
