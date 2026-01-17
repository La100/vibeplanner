"use client";

/**
 * Chat Input Component (Vercel AI Chatbot Style)
 *
 * Message input area with Vercel-inspired design but maintaining our functionality.
 */

import { RefObject, useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Paperclip,
  X,
  FileText,
  ArrowUp,
  Square,
} from "lucide-react";
import { ACCEPTED_FILE_TYPES } from "./constants";

interface ChatInputVercelProps {
  message: string;
  setMessage: (message: string) => void;
  selectedFiles: File[];
  isLoading: boolean;
  isUploading: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSendMessage: () => void;
  onStopResponse: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onAttachmentClick: () => void;
  onPasteFiles?: (files: File[]) => void;
  showAttachments?: boolean;
}

export function ChatInputVercel({
  message,
  setMessage,
  selectedFiles,
  isLoading,
  isUploading,
  inputRef,
  fileInputRef,
  onSendMessage,
  onStopResponse,
  onFileSelect,
  onRemoveFile,
  onAttachmentClick,
  onPasteFiles,
  showAttachments = true,
}: ChatInputVercelProps) {
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  // Generate preview URLs for images
  useEffect(() => {
    const nextUrls: Record<string, string> = {};

    selectedFiles.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      nextUrls[key] = URL.createObjectURL(file);
    });

    Object.entries(previewUrlsRef.current).forEach(([key, url]) => {
      if (!(key in nextUrls)) {
        URL.revokeObjectURL(url);
      }
    });

    previewUrlsRef.current = nextUrls;
    setPreviewUrls(nextUrls);
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Handle paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!onPasteFiles) return;
      if (isLoading || isUploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const fileName = file.name || `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`;
            const renamedFile = new File([file], fileName, { type: file.type, lastModified: file.lastModified || Date.now() });
            files.push(renamedFile);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onPasteFiles(files);
      }
    };

    const textarea = inputRef.current;
    if (textarea) {
      textarea.addEventListener('paste', handlePaste);
      return () => {
        textarea.removeEventListener('paste', handlePaste);
      };
    }
  }, [inputRef, onPasteFiles, isLoading, isUploading]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
      const scrollHeight = inputRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, 200); // Max 200px
      inputRef.current.style.height = `${newHeight}px`;
    }
  }, [inputRef]);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) {
        return;
      }

      if (e.shiftKey) {
        return;
      }

      e.preventDefault();

      if (!isLoading && !isUploading && (message.trim() || selectedFiles.length > 0)) {
        onSendMessage();
      }
    }
  };

  return (
    <div className="relative flex w-full flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        onChange={onFileSelect}
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        multiple
      />

      <form
        className={cn(
          "w-full overflow-hidden rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200",
          "focus-within:border-border hover:border-muted-foreground/50"
        )}
        onSubmit={(e) => {
          e.preventDefault();
          if (!message.trim() && selectedFiles.length === 0) {
            return;
          }
          if (isLoading) {
            onStopResponse();
          } else if (!isUploading) {
            onSendMessage();
          }
        }}
      >
        {/* Attachments preview */}
        {showAttachments && selectedFiles.length > 0 && (
          <div className="flex flex-row items-end gap-2 overflow-x-scroll mb-3">
            {selectedFiles.map((file, index) => {
              const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
              const previewUrl = previewUrls[fileKey];

              return (
                <div
                  key={`${file.name}-${index}`}
                  className="relative flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-2 min-w-[120px]"
                >
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    className="absolute right-1 top-1 z-10 rounded-full bg-background p-1 shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-20 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded bg-muted">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-xs font-medium">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Input area */}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isUploading ? "Uploading..." : "Send a message..."}
            disabled={isUploading}
            rows={1}
            className={cn(
              "grow resize-none border-0 border-none bg-transparent p-2 text-base outline-none ring-0",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
              "max-h-[200px] overflow-y-auto"
            )}
            style={{ height: "44px" }}
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-t-0 p-0 pt-2">
          <div className="flex items-center gap-0 sm:gap-0.5">
            {showAttachments && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
                disabled={isLoading || isUploading}
                onClick={onAttachmentClick}
              >
                <Paperclip className="h-4 w-4" style={{ width: 14, height: 14 }} />
              </Button>
            )}
          </div>

          {isLoading ? (
            <Button
              type="button"
              onClick={onStopResponse}
              className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={(!message.trim() && selectedFiles.length === 0) || isUploading}
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default ChatInputVercel;
