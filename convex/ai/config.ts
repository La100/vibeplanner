
export const AI_MODEL = "gpt-5.2";


export const AI_INPUT_COST_PER_1M = 1.75; // $1.75 per 1M input tokens
export const AI_OUTPUT_COST_PER_1M = 14; // $14 per 1M output tokens

export const AI_CONFIG = {
  model: AI_MODEL,
  temperature: 1,
  maxSteps: 5,
};


export function calculateCost(_model: string, inputTokens: number, outputTokens: number): number {
  // Org-wide pricing: $1.75 per 1M input tokens, $14 per 1M output tokens
  const inputCost = (inputTokens / 1_000_000) * AI_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * AI_OUTPUT_COST_PER_1M;
  return inputCost + outputCost;
}
