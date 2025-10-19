 "use node";

/**
 * File Processor Helper
 *
 * Responsible for converting uploaded files into text that can be safely passed
 * to the language model.
 */

export const processFileForAI = async (
  file: any,
  fileUrl: string,
  userMessage: string,
): Promise<string> => {
  let augmentedMessage = userMessage;

  // Attempt to extract PDF text
  if (file.mimeType === "application/pdf") {
    console.log("📄 Processing PDF file for text extraction...");
    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download PDF: ${fileResponse.status}`);
      }

      const fileBuffer = await fileResponse.arrayBuffer();
      const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
      const parsed = await pdfParse(Buffer.from(fileBuffer));
      const extractedText = (parsed?.text || "").trim();

      if (extractedText) {
        const normalized = extractedText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
        const truncated =
          normalized.length > 15000 ? `${normalized.slice(0, 15000)}\n...[truncated]` : normalized;
        augmentedMessage = `${userMessage}\n\n[PDF EXTRACT: ${file.name}]\n${truncated}`;
        return augmentedMessage;
      }
    } catch (error) {
      console.error("Failed to extract PDF content:", error);
      augmentedMessage = `${userMessage}\n\n📎 ATTACHED PDF: "${file.name}" (could not auto-extract text). Please specify which sections you need help with.`;
      return augmentedMessage;
    }
  }

  // Handle text-like files
  if (
    file.mimeType?.includes("text/") ||
    file.mimeType?.includes("application/json") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".json") ||
    file.name.endsWith(".csv")
  ) {
    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch text file: ${fileResponse.status}`);
      }
      const textContent = await fileResponse.text();
      const truncated =
        textContent.length > 10000
          ? `${textContent.slice(0, 10000)}\n...[truncated]`
          : textContent;
      augmentedMessage = `${userMessage}\n\n[FILE CONTENT: ${file.name}]\n${truncated}`;
      return augmentedMessage;
    } catch (error) {
      console.error("Failed to read text file contents:", error);
      augmentedMessage = `${userMessage}\n\n📎 ATTACHED FILE: "${file.name}" (${file.mimeType}) — unable to read contents automatically.`;
      return augmentedMessage;
    }
  }

  // Fallback for other file types
  const fileTypeDescription = file.mimeType || "unknown file type";
  augmentedMessage = `${userMessage}\n\n📎 ATTACHED FILE: "${file.name}" (${fileTypeDescription}, ${(file.size / 1024).toFixed(
    1,
  )} KB). I can't read this file type automatically, but I can help if you describe what you need from it.`;
  return augmentedMessage;
};

export const getFileUrl = async (
  file: any,
  ctx: any,
): Promise<string | null> => {
  try {
    const { r2 } = await import("../../files");
    const fileUrl = await r2.getUrl(file.storageId as string, {
      expiresIn: 60 * 60 * 2, // 2 hours
    });
    console.log(`🔗 Generated R2 signed URL for file: ${file.name}`);
    return fileUrl;
  } catch (error) {
    console.error("Failed to get R2 signed URL:", error);
    try {
      const fileUrl = await ctx.storage.getUrl(file.storageId);
      console.log(`🔗 Using Convex storage URL fallback: ${file.name}`);
      return fileUrl;
    } catch (fallbackError) {
      console.error("Both R2 and Convex storage URL generation failed:", fallbackError);
      return null;
    }
  }
};
