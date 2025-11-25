 "use node";

import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { getFileUrl, processFileForAI } from "./helpers/fileProcessor";

type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mediaType?: string }
  | { type: "file"; data: string; mediaType: string };

type PrepareFileMessageArgs = {
  ctx: ActionCtx;
  fileId: string;
  baseMessage: string;
};

export type FileMetadataForHistory = {
  fileId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
};

export type PreparedFileMessage = {
  message: string;
  content: MessageContentPart[];
  fileMetadata?: FileMetadataForHistory;
};

export async function prepareMessageWithFile({
  ctx,
  fileId,
  baseMessage,
}: PrepareFileMessageArgs): Promise<PreparedFileMessage> {
  let message = baseMessage;
  let content: MessageContentPart[] = [{ type: "text", text: message }];

  try {
    const file = await ctx.runQuery(api.files.getFileById, { fileId: fileId as any });
    if (!file) {
      return { message, content };
    }

    const fileMetadata: FileMetadataForHistory = {
      fileId,
      fileName: file.name,
      fileType: file.mimeType ?? undefined,
      fileSize: typeof file.size === "number" ? file.size : undefined,
    };

    const fileUrl = await getFileUrl(file, ctx);
    if (!fileUrl) {
      message = `${message}\n\n[User attached file: ${file.name} (${file.mimeType}) - unable to generate download URL.]`;
      return { message, content: [{ type: "text", text: message }], fileMetadata };
    }

    if (file.mimeType?.startsWith("image/")) {
      const sizeKb = typeof file.size === "number" ? `${(file.size / 1024).toFixed(1)} KB` : "unknown size";
      message = `${message}\n\n[User attached image: ${file.name} (${file.mimeType}, ${sizeKb})]`;
      content = [
        { type: "image", image: fileUrl, mediaType: file.mimeType },
        { type: "text", text: message },
      ];
      return { message, content, fileMetadata };
    }

    // For PDFs and other files, pass URL directly to agent instead of extracting text
    // The agent/LLM will handle the file natively via OpenAI's file API
    const isPdf = file.mimeType === "application/pdf" || file.name?.toLowerCase()?.endsWith(".pdf");
    
    if (isPdf) {
      // Pass PDF URL directly to agent - let OpenAI handle it natively
      content = [
        { type: "file", data: fileUrl, mediaType: file.mimeType || "application/pdf" },
        { type: "text", text: message || `User attached PDF: ${file.name}` },
      ];
      message = message || `User attached PDF: ${file.name}`;
      return { message, content, fileMetadata };
    }

    // For Excel and text files, still use processFileForAI for preview/context
    // (these are working and provide useful previews)
    const isExcelFile =
      file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimeType === "application/vnd.ms-excel" ||
      file.mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12" ||
      file.name?.endsWith(".xlsx") ||
      file.name?.endsWith(".xls") ||
      file.name?.endsWith(".xlsm");
    
    const isTextFile =
      file.mimeType?.includes("text/") ||
      file.mimeType?.includes("application/json") ||
      file.name?.endsWith(".md") ||
      file.name?.endsWith(".txt") ||
      file.name?.endsWith(".json") ||
      file.name?.endsWith(".csv");

    if (isExcelFile || isTextFile) {
      // Keep Excel/text processing for previews
      message = await processFileForAI(file, fileUrl, message);
      return { message, content: [{ type: "text", text: message }], fileMetadata };
    }

    // For other file types, pass URL as file type
    // Ensure we always provide a mediaType (required by FilePart)
    const mediaType = file.mimeType || "application/octet-stream";
    content = [
      { type: "file", data: fileUrl, mediaType },
      { type: "text", text: message || `User attached file: ${file.name}` },
    ];
    message = message || `User attached file: ${file.name}`;
    return { message, content, fileMetadata };
  } catch (error) {
    console.error("Failed to prepare AI message with file:", error);
    message = `${message}\n\n[User attached file: ${fileId} - processing failed, please ask for specific content.]`;
    return { message, content: [{ type: "text", text: message }] };
  }
}
