"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Gemini AI for direct PDF analysis
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// PDF Analysis with Vertex AI
export const analyzePDF: any = action({
  args: {
    fileId: v.id("files"),
    projectId: v.id("projects"),
  },
  returns: v.object({
    success: v.boolean(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx: any, args: any): Promise<any> => {
    try {
      // Get file details
      const file: any = await ctx.runQuery(api.files.getFileById, { fileId: args.fileId });
      if (!file) {
        return { success: false, error: "File not found" };
      }

      if (file.mimeType !== 'application/pdf') {
        return { success: false, error: "File is not a PDF" };
      }

      // Initialize Vertex AI
      const vertexAI = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id',
        location: 'us-central1'
      });

      const generativeModel = vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash-001',
      });

      // Construct file URI from R2 storage
      const fileUri: string = `${process.env.R2_PUBLIC_URL}/${file.storageId}`;
      
      if (!process.env.R2_PUBLIC_URL) {
        return { success: false, error: "R2_PUBLIC_URL not configured" };
      }

      const filePart: any = {
        fileData: {
          fileUri: fileUri,
          mimeType: 'application/pdf',
        },
      };

      const textPart = {
        text: `You are a professional document analysis specialist for VibePlanner, an interior design project management platform.

Please analyze this PDF document and provide:

1. **Document Summary**: A comprehensive summary of the main content and purpose
2. **Key Information**: Extract any relevant details for interior design projects such as:
   - Specifications, measurements, dimensions
   - Materials, colors, finishes
   - Product details, model numbers, pricing
   - Installation requirements or instructions
   - Design concepts or inspiration
   - Client requirements or feedback
3. **Action Items**: Any tasks, deadlines, or follow-ups mentioned
4. **Important Notes**: Critical information that should be highlighted

Format your response in clear sections with headers. Focus on information that would be useful for interior design project management.`,
      };

      const request: any = {
        contents: [{ role: 'user', parts: [filePart, textPart] }],
      };

      const resp: any = await generativeModel.generateContent(request);
      const contentResponse: any = await resp.response;
      
      // Extract the text content
      const summary: string = contentResponse.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to extract summary";

      // Store the analysis result in the file record
      await ctx.runMutation(internal.files.updateFileAnalysis, {
        fileId: args.fileId,
        analysis: summary,
      });

      return {
        success: true,
        summary: summary,
      };

    } catch (error) {
      console.error("PDF Analysis error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

// PDF Analysis with Gemini using R2 files - more reliable alternative
export const analyzePDFWithGemini: any = action({
  args: {
    fileId: v.id("files"),
    projectId: v.id("projects"),
  },
  returns: v.object({
    success: v.boolean(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx: any, args: any): Promise<any> => {
    try {
      // Get file details
      const file: any = await ctx.runQuery(api.files.getFileById, { fileId: args.fileId });
      if (!file) {
        return { success: false, error: "File not found" };
      }

      if (file.mimeType !== 'application/pdf') {
        return { success: false, error: "File is not a PDF" };
      }

      if (!process.env.R2_PUBLIC_URL) {
        return { success: false, error: "R2_PUBLIC_URL not configured" };
      }

      // Construct file URI from R2 storage
      const fileUrl: string = `${process.env.R2_PUBLIC_URL}/${file.storageId}`;

      // Fetch PDF from R2
      const response = await fetch(fileUrl);
      if (!response.ok) {
        return { success: false, error: "Failed to fetch PDF from R2" };
      }

      // Convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      const prompt = `You are a professional document analysis specialist for VibePlanner, an interior design project management platform.

Please analyze this PDF document and provide:

1. **Document Summary**: A comprehensive summary of the main content and purpose
2. **Key Information**: Extract any relevant details for interior design projects such as:
   - Specifications, measurements, dimensions
   - Materials, colors, finishes
   - Product details, model numbers, pricing
   - Installation requirements or instructions
   - Design concepts or inspiration
   - Client requirements or feedback
3. **Action Items**: Any tasks, deadlines, or follow-ups mentioned
4. **Important Notes**: Critical information that should be highlighted

Format your response in clear sections with headers. Focus on information that would be useful for interior design project management.`;

      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash-001",
        contents: [{
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: "application/pdf"
              }
            },
            { text: prompt }
          ]
        }]
      });

      const response_text = result.text || "Unable to analyze PDF";

      // Store the analysis result in the file record
      await ctx.runMutation(internal.files.updateFileAnalysis, {
        fileId: args.fileId,
        analysis: response_text,
      });

      return {
        success: true,
        summary: response_text,
      };

    } catch (error) {
      console.error("PDF Analysis error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

// Alternative: Direct PDF analysis with file upload
export const analyzePDFDirect: any = action({
  args: {
    projectId: v.id("projects"),
    pdfContent: v.string(), // Base64 encoded PDF content
    fileName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx: any, args: any): Promise<any> => {
    try {
      // For direct analysis without GCS storage
      // This would require uploading the PDF to GCS first
      // Then using the GCS URI for analysis
      
      // TODO: Implement direct PDF upload to GCS and analysis
      return {
        success: false,
        error: "Direct PDF analysis not yet implemented - use file upload first",
      };

    } catch (error) {
      console.error("Direct PDF Analysis error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});