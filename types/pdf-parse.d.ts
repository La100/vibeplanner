declare module "pdf-parse/lib/pdf-parse.js" {
  export interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown> | null;
    metadata: unknown;
    text: string;
    version: string | null;
  }

  export type PDFParseFn = (
    data: Buffer | Uint8Array | ArrayBuffer,
    options?: Record<string, unknown>,
  ) => Promise<PDFParseResult>;

  const pdfParse: PDFParseFn;
  export default pdfParse;
}
