declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export interface PDFJSLibrary {
    getDocument(options: any): { promise: Promise<any> };
    GlobalWorkerOptions: { workerSrc?: string };
  }

  const pdfjs: PDFJSLibrary;
  export default pdfjs;
}
