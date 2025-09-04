/**
 * Helper function to estimate Gemini costs
 * Based on current Gemini 2.5 Pro pricing
 */
export function estimateGeminiCost(inputTokens: number, outputTokens: number): number {
  // Gemini 2.5 Pro pricing (as of 2024)
  // Input: $1.25 per 1M tokens
  // Output: $5.00 per 1M tokens
  const inputCostPerMillion = 1.25;
  const outputCostPerMillion = 5.00;
  
  const inputCostUSD = (inputTokens / 1_000_000) * inputCostPerMillion;
  const outputCostUSD = (outputTokens / 1_000_000) * outputCostPerMillion;
  
  return Math.round((inputCostUSD + outputCostUSD) * 100); // Return cents
}

/**
 * Helper function to extract token counts from Gemini response
 */
export function extractTokenUsage(result: any): { inputTokens: number, outputTokens: number, totalTokens: number } {
  // Try different possible locations for usage metadata
  const usage = result.usageMetadata || result.usage || result.metadata?.usage;
  
  if (usage) {
    return {
      inputTokens: usage.promptTokenCount || usage.inputTokens || 0,
      outputTokens: usage.candidatesTokenCount || usage.outputTokens || 0,
      totalTokens: usage.totalTokenCount || usage.totalTokens || 0,
    };
  }
  
  // Fallback: estimate based on text length
  const inputText = JSON.stringify(result.request || "");
  const outputText = result.text || "";
  
  // Rough estimation: 1 token ≈ 4 characters
  const estimatedInputTokens = Math.ceil(inputText.length / 4);
  const estimatedOutputTokens = Math.ceil(outputText.length / 4);
  
  return {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
    totalTokens: estimatedInputTokens + estimatedOutputTokens,
  };
}







