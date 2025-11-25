"use node";

/**
 * File Processor Helper
 *
 * Responsible for converting uploaded files (Excel, text files) into text that can be safely passed
 * to the language model. PDFs are handled natively by the agent via file URLs.
 */

export const processFileForAI = async (
  file: any,
  fileUrl: string,
  userMessage: string,
): Promise<string> => {
  let augmentedMessage = userMessage;

  const isExcelFile =
    file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimeType === "application/vnd.ms-excel" ||
    file.mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12" ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls") ||
    file.name.endsWith(".xlsm");

  if (isExcelFile) {
    console.log("📊 Processing spreadsheet for preview...");
    try {
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download spreadsheet: ${fileResponse.status}`);
      }

      const fileBuffer = await fileResponse.arrayBuffer();
      const xlsxModule = await import("xlsx");
      const XLSX = (xlsxModule as any).default ?? xlsxModule;
      const workbook = XLSX.read(Buffer.from(fileBuffer), { type: "buffer" });

      if (!workbook.SheetNames?.length) {
        augmentedMessage = `${userMessage}\n\n📎 ATTACHED EXCEL: "${file.name}" (no sheets detected).`;
        return augmentedMessage;
      }

      const maxSheets = 3;
      const maxRowsPerSheet = 40;
      const sheetSummaries = workbook.SheetNames.slice(0, maxSheets).map((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
        const renderedRows = rows
          .map((row) =>
            (row ?? [])
              .map((cell) =>
                typeof cell === "string" ? cell : cell === null || cell === undefined ? "" : String(cell),
              )
              .join("\t"),
          )
          .filter((line: string) => line.trim().length > 0);

        const preview = renderedRows.slice(0, maxRowsPerSheet).join("\n");
        const truncatedRowsNotice =
          renderedRows.length > maxRowsPerSheet
            ? `\n...[${renderedRows.length - maxRowsPerSheet} more rows truncated]`
            : "";

        return `[Sheet: ${sheetName}]\n${preview || "(empty sheet)"}${truncatedRowsNotice}`;
      });

      const truncatedSheetNotice =
        workbook.SheetNames.length > maxSheets
          ? `\n...[${workbook.SheetNames.length - maxSheets} more sheet(s) truncated]`
          : "";

      augmentedMessage = `${userMessage}\n\n[EXCEL PREVIEW: ${file.name} - ${workbook.SheetNames.length} sheet(s)]\n${sheetSummaries.join(
        "\n\n",
      )}${truncatedSheetNotice}`;
      return augmentedMessage;
    } catch (error) {
      console.error("Failed to process spreadsheet content:", error);
      augmentedMessage = `${userMessage}\n\n📎 ATTACHED EXCEL: "${file.name}" (${file.mimeType}) — unable to read contents automatically.`;
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
