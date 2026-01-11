
export const AI_MODEL = "gpt-5.2";


export const AI_CONFIG = {
  model: AI_MODEL,
  temperature: 1,
  maxSteps: 5,
};


export function calculateCost(_model: string, inputTokens: number, outputTokens: number): number {
  // GPT-4o pricing: $2.50 per 1M input tokens, $10 per 1M output tokens
  const inputCost = (inputTokens / 1_000_000) * 2.5;
  const outputCost = (outputTokens / 1_000_000) * 10;
  return inputCost + outputCost;
}
