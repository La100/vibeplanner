"use client";

/**
 * Chat Input Component
 * 
 * Message input area with file upload support.
 */

import { RefObject, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface ChatInputProps {
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
}

export function ChatInput({
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
}: ChatInputProps) {
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

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
            // Create a new File object with a proper name if the pasted file doesn't have one
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

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        opacity: { duration: 0.2 }
      }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className={cn(
        "relative rounded-2xl px-6 py-5",
        "min-h-[110px]",
        "bg-background",
        "border border-border/70",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_12px_28px_rgba(0,0,0,0.08)]",
        "transition-all duration-300",
        "focus-within:ring-1 focus-within:ring-foreground/20",
        "hover:border-foreground/20",
        "flex flex-col gap-4"
      )}>
        <AnimatePresence>
          {selectedFiles.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, height: 0 }}
               animate={{ opacity: 1, height: "auto" }}
               exit={{ opacity: 0, height: 0 }}
               className="flex flex-wrap items-center gap-2 mb-2"
             >
               {selectedFiles.map((file, index) => {
                 const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                 const previewUrl = previewUrls[fileKey];

                 return (
                <div key={`${file.name}-${index}`} className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border/50">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-8 w-8 rounded-md object-cover border border-border/60"
                    />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium max-w-[120px] truncate">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive -mr-1"
                    onClick={() => onRemoveFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
               );
              })}
             </motion.div>
          )}
        </AnimatePresence>

        <textarea
           ref={inputRef}
           value={message}
           onChange={(e) => setMessage(e.target.value)}
           onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading && !isUploading) {
                e.preventDefault();
                onSendMessage();
              }
            }}
           placeholder={isUploading ? "Uploading..." : "Ask about your project..."}
           rows={1}
           disabled={isUploading}
           className={cn(
              "w-full resize-none bg-transparent",
              "text-lg leading-relaxed placeholder:text-muted-foreground/50",
              "focus:outline-none",
              "min-h-[64px]"
           )}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={onFileSelect}
              accept={ACCEPTED_FILE_TYPES}
              className="hidden"
              multiple
            />
            
            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground transition-colors bg-background/70 border border-border/60 shadow-sm hover:bg-background"
                onClick={onAttachmentClick}
                disabled={isLoading || isUploading}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
          </div>

          <Button
             onClick={isLoading && !isUploading ? onStopResponse : onSendMessage}
             disabled={isUploading || (!message.trim() && selectedFiles.length === 0 && !isLoading)}
             size="icon"
             className={cn(
               "h-11 w-11 rounded-xl",
               isLoading && !isUploading ? "bg-foreground text-background" : "bg-foreground text-background",
               "shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition-all duration-200 hover:scale-105 active:scale-95",
               "disabled:opacity-50 disabled:hover:scale-100"
             )}
          >
             {isUploading ? (
               <Loader2 className="h-4 w-4 animate-spin" />
             ) : isLoading ? (
               <Square className="h-3 w-3 fill-current" />
             ) : (
               <ArrowUp className="h-4 w-4" />
             )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default ChatInput;
