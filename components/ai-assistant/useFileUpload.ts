/**
 * useFileUpload Hook
 * 
 * Manages file selection and upload state for the AI Assistant.
 */

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { MAX_FILE_SIZE_BYTES } from "./constants";
import type { UseFileUploadReturn } from "./types";

export const useFileUpload = (): UseFileUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error("File size must be less than 512MB");
        return;
      }
      setSelectedFile(file);
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setUploadedFileId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleAttachmentClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    selectedFile,
    setSelectedFile,
    uploadedFileId,
    isUploading,
    handleFileSelect,
    handleRemoveFile,
    handleAttachmentClick,
    fileInputRef,
    // Expose setters for parent component to control
    setUploadedFileId: (id: string | null) => setUploadedFileId(id),
    setIsUploading: (uploading: boolean) => setIsUploading(uploading),
  } as UseFileUploadReturn & {
    setUploadedFileId: (id: string | null) => void;
    setIsUploading: (uploading: boolean) => void;
  };
};

export default useFileUpload;








