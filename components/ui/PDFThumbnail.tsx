"use client";

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText } from 'lucide-react';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFThumbnailProps {
  url: string;
  className?: string;
  onClick?: () => void;
}

export default function PDFThumbnail({ url, className = '', onClick }: PDFThumbnailProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError(false);
  }

  function onDocumentLoadError() {
    setLoading(false);
    setError(true);
  }

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className} ${onClick ? 'cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <FileText className="h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-lg bg-white ${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading=""
        error=""
      >
        <Page 
          pageNumber={1} 
          width={120}
          loading=""
          error=""
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
      
      {numPages > 1 && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
          {numPages} pages
        </div>
      )}
    </div>
  );
} 