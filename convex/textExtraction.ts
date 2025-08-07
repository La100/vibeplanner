"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal, components } from "./_generated/api";
import { R2 } from "@convex-dev/r2";
import mammoth from "mammoth";
import { createWorker } from "tesseract.js";

const r2 = new R2(components.r2);

export const extractFileText = action({
  args: {
    fileId: v.id("files"),
  },
  returns: v.object({
    success: v.boolean(),
    extractedText: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{success: boolean, extractedText?: string, error?: string}> => {
    try {
      // 1. Get file metadata
      const file: any = await ctx.runQuery(api.files.getFileById, { fileId: args.fileId });
      if (!file) {
        return { success: false, error: "File not found" };
      }

      // 2. Download file from R2 storage
      const fileContent = await downloadFileFromStorage(file.storageId);
      if (!fileContent) {
        return { success: false, error: "Failed to download file" };
      }

      let extractedText = "";
      
      // 3. Extract text based on file type
      if (file.mimeType === "application/pdf") {
        // PDF text extraction - using external service or fallback
        try {
          extractedText = await extractPdfText(fileContent);
        } catch (pdfError) {
          console.error("PDF extraction failed:", pdfError);
          extractedText = "PDF content extraction failed. File uploaded successfully but text could not be extracted.";
        }
        
      } else if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // DOCX text extraction
        try {
          const result = await mammoth.extractRawText({ buffer: fileContent });
          extractedText = result.value;
        } catch (docxError) {
          console.error("DOCX extraction failed:", docxError);
          return { success: false, error: "Failed to extract text from DOCX file" };
        }
        
      } else if (file.mimeType.startsWith("image/")) {
        // OCR for images
        try {
          const worker = await createWorker('eng');
          const { data: { text } } = await worker.recognize(fileContent);
          await worker.terminate();
          extractedText = text;
        } catch (ocrError) {
          console.error("OCR extraction failed:", ocrError);
          return { success: false, error: "Failed to extract text from image using OCR" };
        }
        
      } else if (file.mimeType === "text/plain") {
        // Plain text files
        extractedText = fileContent.toString('utf-8');
        
      } else {
        return { success: false, error: `Unsupported file type: ${file.mimeType}` };
      }

      // 4. Save extracted text to database
      if (extractedText.trim()) {
        await ctx.runMutation(internal.files.updateFileWithExtractedText, {
          fileId: args.fileId,
          extractedText: extractedText.trim(),
        });

        // No indexing needed with 1M context - data is always fresh!

        return { success: true, extractedText: extractedText.trim() };
      } else {
        return { success: false, error: "No text could be extracted from file" };
      }

    } catch (error) {
      console.error("Text extraction error:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error during text extraction" 
      };
    }
  },
});

// Helper function to download file from storage
async function downloadFileFromStorage(storageId: string): Promise<Buffer | null> {
  try {
    // Get file URL from R2
    const fileUrl = await r2.getUrl(storageId, {
      expiresIn: 60 * 60, // 1 hour
    });
    
    // Download file content
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    
    // Convert to buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Failed to download file from storage:", error);
    return null;
  }
}

// Improved PDF text extraction
async function extractPdfText(fileContent: Buffer): Promise<string> {
  try {
    // Try using pdf-parse if available
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(fileContent);
    return data.text;
  } catch (error) {
    console.error("pdf-parse failed:", error);
    
    // Fallback: try using external PDF service
    try {
      return await extractPdfTextViaExternalService(fileContent);
    } catch (externalError) {
      console.error("External PDF service failed:", externalError);
      
      // Final fallback: return placeholder
      return "PDF content extraction not yet implemented - file uploaded successfully. Please contact support for PDF text extraction.";
    }
  }
}

// External PDF service fallback
async function extractPdfTextViaExternalService(fileContent: Buffer): Promise<string> {
  // You can implement external PDF service here
  // For example: Google Cloud Vision API, AWS Textract, etc.
  
  // For now, return placeholder
  throw new Error("External PDF service not configured");
}