"use client";

import {
  useCallback,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Paperclip, Send, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  selectedFiles: File[];
  isLoading?: boolean;
  isUploading?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onSendMessage: () => void;
  onStopResponse: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
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
  const canSubmit = message.trim().length > 0 && !isLoading && !isUploading;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      onSendMessage();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        onSendMessage();
      }
    }
  };

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!onPasteFiles) return;
      const files = Array.from(event.clipboardData.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      onPasteFiles(files);
    },
    [onPasteFiles]
  );

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />

      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground"
            >
              <span className="max-w-[140px] truncate">{file.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => onRemoveFile(index)}
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onAttachmentClick}
          aria-label="Add attachment"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Textarea
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isUploading ? "Uploading..." : "Describe your visualization..."}
          className={cn(
            "min-h-[52px] resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0"
          )}
          rows={1}
        />

        {isLoading ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onStopResponse}
            aria-label="Stop generation"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9"
            disabled={!canSubmit}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isUploading && (
        <p className="text-xs text-muted-foreground">Uploading attachments...</p>
      )}
    </form>
  );
}

export default ChatInput;
