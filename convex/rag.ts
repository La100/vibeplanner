import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { GoogleGenAI } from "@google/genai";

// Use Gemini embedding model to match our Gemini 2.5 Pro chat model
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Create Gemini embedding model compatible with Convex RAG
const geminiEmbeddingModel = {
  specificationVersion: "v1" as const,
  provider: "google",
  modelId: "text-embedding-004",
  maxEmbeddingsPerCall: 100, // Gemini batch limit
  supportsParallelCalls: true,
  
  async doEmbed({ values }: { values: string[] }) {
    const embeddings = await Promise.all(
      values.map(async (text) => {
        const result = await genAI.models.embedContent({
          model: "text-embedding-004",
          contents: text,
        });
        // Gemini API returns 'embeddings' array, take first one
        return result.embeddings?.[0]?.values || [];
      })
    );
    return { embeddings };
  },
  
  // Legacy method for backward compatibility
  async embed(values: string[]) {
    const result = await this.doEmbed({ values });
    return result;
  },
};

export const rag = new RAG(components.rag, {
  textEmbeddingModel: geminiEmbeddingModel,
  embeddingDimension: 768, // Gemini text-embedding-004 dimension
});