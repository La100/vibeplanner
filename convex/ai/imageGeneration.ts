"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { GoogleGenAI } from "@google/genai";

/**
 * Gemini Image Generation for Architectural Visualizations
 * Uses Gemini 3 Pro Image model with official SDK and chat history
 */

const GEMINI_MODEL = "gemini-3-pro-image-preview";

// System prompt for architectural visualizations
const VISUALIZATION_SYSTEM_PROMPT = `You are an expert architectural visualization artist. When generating images:
- Create photorealistic, high-quality architectural renders
- Pay attention to lighting, materials, and atmosphere
- Include realistic textures and environmental details
- Consider time of day, weather, and seasonal elements
- Ensure proper scale and perspective
- Add subtle details like furniture, plants, and people where appropriate
- When user asks to modify or refine an image, keep the same general style but apply the requested changes`;

// History message type
const historyMessageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("model")),
  text: v.string(),
  hasImage: v.optional(v.boolean()),
});

/**
 * Generate architectural visualization using Gemini API with chat history
 */
// Reference image type
const referenceImageValidator = v.object({
  base64: v.string(),
  mimeType: v.string(),
  name: v.string(),
});

export const generateVisualization = action({
  args: {
    prompt: v.string(),
    referenceImages: v.optional(v.array(referenceImageValidator)),
    projectId: v.id("projects"),
    history: v.optional(v.array(historyMessageValidator)),
  },
  returns: v.object({
    success: v.boolean(),
    imageBase64: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    textResponse: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY is not configured. Please add it to your environment variables.",
      };
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const startTime = Date.now();

      // Build contents array with proper structure for multi-turn
      type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
      type ContentItem = { role: "user" | "model"; parts: Part[] };
      
      const contents: ContentItem[] = [];
      
      // Add history as previous turns
      // Note: Only include user messages to avoid "thought_signature" errors
      // with Gemini models that have thinking capabilities. Model responses
      // would require a thought signature that we don't have access to.
      if (args.history && args.history.length > 0) {
        for (const msg of args.history) {
          // Only include user messages in history
          if (msg.role === "user") {
            contents.push({
              role: "user",
              parts: [{ text: msg.text }],
            });
          }
        }
      }
      
      // Build current user message parts
      const currentParts: Part[] = [{ text: args.prompt }];
      
      // Add all reference images
      if (args.referenceImages && args.referenceImages.length > 0) {
        for (const img of args.referenceImages) {
          currentParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        }
      }
      
      contents.push({ role: "user", parts: currentParts });

      // Generate with full conversation context
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const duration = Date.now() - startTime;

      // Log usage information
      const usageMetadata = response.usageMetadata;
      console.log("=== GEMINI IMAGE GENERATION (Chat Mode) ===");
      console.log("Model:", GEMINI_MODEL);
      console.log("User prompt:", args.prompt);
      console.log("History length:", args.history?.length || 0, "messages");
      console.log("Reference images:", args.referenceImages?.length || 0);
      console.log("Duration:", duration, "ms");
      console.log("Prompt tokens:", usageMetadata?.promptTokenCount || "N/A");
      console.log("Response tokens:", usageMetadata?.candidatesTokenCount || "N/A");
      console.log("Total tokens:", usageMetadata?.totalTokenCount || "N/A");
      console.log("============================================");

      if (!response.candidates || response.candidates.length === 0) {
        return {
          success: false,
          error: "No response generated from Gemini API",
        };
      }

      // Extract image and text from response
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      let textResponse: string | undefined;

      for (const part of response.candidates[0].content?.parts || []) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
        }
        if (part.text) {
          textResponse = part.text;
        }
      }

      if (!imageBase64) {
        return {
          success: false,
          error: "No image was generated. The model may have returned only text.",
          textResponse,
        };
      }

      // Log image info
      const imageSizeKB = Math.round((imageBase64.length * 3) / 4 / 1024);
      console.log("Generated image size:", imageSizeKB, "KB");
      console.log("Image MIME type:", mimeType);

      return {
        success: true,
        imageBase64,
        mimeType: mimeType || "image/png",
        textResponse,
      };
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return {
        success: false,
        error: `Failed to generate visualization: ${(error as Error).message}`,
      };
    }
  },
});

/**
 * Save generated image to R2 storage and files table
 */
export const saveGeneratedImage = action({
  args: {
    imageBase64: v.string(),
    mimeType: v.string(),
    fileName: v.string(),
    projectId: v.id("projects"),
    prompt: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    fileId: v.optional(v.id("files")),
    fileUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    fileId?: Id<"files">;
    fileUrl?: string;
    error?: string;
  }> => {
    try {
      // Get project and team info
      const project: { teamId: Id<"teams">; teamSlug: string; projectSlug: string } | null = 
        await ctx.runQuery(internal.ai.imageGenerationHelpers.getProjectInfo, {
          projectId: args.projectId,
        });

      if (!project) {
        return { success: false, error: "Project not found" };
      }

      // Convert base64 to binary
      const binaryData = Buffer.from(args.imageBase64, "base64");

      // Determine file extension from mime type
      const extension = args.mimeType.split("/")[1] || "png";
      const uuid = crypto.randomUUID();
      const fileKey: string = `${project.teamSlug}/${project.projectSlug}/ai-visualizations/${uuid}-${args.fileName}.${extension}`;

      // Get upload URL from R2
      const uploadData: { url: string } = await ctx.runMutation(internal.ai.imageGenerationHelpers.generateR2UploadUrl, {
        key: fileKey,
      });

      // Upload to R2
      const uploadResponse: Response = await fetch(uploadData.url, {
        method: "PUT",
        body: binaryData,
        headers: {
          "Content-Type": args.mimeType,
        },
      });

      if (!uploadResponse.ok) {
        return {
          success: false,
          error: `Failed to upload image: ${uploadResponse.status}`,
        };
      }

      // Save file record to database
      const fileId: Id<"files"> = await ctx.runMutation(internal.ai.imageGenerationHelpers.createFileRecord, {
        projectId: args.projectId,
        teamId: project.teamId,
        fileName: `${args.fileName}.${extension}`,
        fileKey,
        mimeType: args.mimeType,
        size: binaryData.length,
        description: `AI Generated: ${args.prompt.substring(0, 200)}`,
      });

      // Get the file URL
      const fileUrl: string | null = await ctx.runQuery(internal.ai.imageGenerationHelpers.getFileUrl, {
        fileKey,
      });

      return {
        success: true,
        fileId,
        fileUrl: fileUrl ?? undefined,
      };
    } catch (error) {
      console.error("Error saving generated image:", error);
      return {
        success: false,
        error: `Failed to save image: ${(error as Error).message}`,
      };
    }
  },
});
