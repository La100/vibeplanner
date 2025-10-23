 "use node";

import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { getFileUrl, processFileForAI } from "./helpers/fileProcessor";

type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mediaType?: string };

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

    message = await processFileForAI(file, fileUrl, message);
    return { message, content: [{ type: "text", text: message }], fileMetadata };
  } catch (error) {
    console.error("Failed to prepare AI message with file:", error);
    message = `${message}\n\n[User attached file: ${fileId} - processing failed, please ask for specific content.]`;
    return { message, content: [{ type: "text", text: message }] };
  }
}
