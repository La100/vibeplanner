"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, 
  Paperclip, 
  X
} from "lucide-react";
import { toast } from "sonner";

interface MessageInputProps {
  channelId: Id<"chatChannels">;
  placeholder?: string;
  replyToMessage?: {
    _id: Id<"chatMessages">;
    content: string;
    authorName: string;
  };
  onCancelReply?: () => void;
}

export function MessageInput({ 
  channelId, 
  placeholder = "Type a message...",
  replyToMessage,
  onCancelReply 
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const sendMessage = useMutation(api.chatMessages.sendMessage);
  const generateChatUploadUrl = useMutation(api.files.generateChatUploadUrl);
  const addChatFile = useMutation(api.files.addChatFile);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && !selectedFile) || isSending) return;

    setIsSending(true);
    try {
      let fileUrl = "";
      let fileName = "";
      let fileData: { fileId: Id<"files">, fileUrl: string } | null = null;

      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true);
        
        // Generate upload URL
        const uploadData = await generateChatUploadUrl({
          channelId,
          fileName: selectedFile.name,
        });

        // Upload file to R2
        const uploadResponse = await fetch(uploadData.url, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        // Add file to database
        fileData = await addChatFile({
          channelId,
          fileKey: uploadData.key,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        });

        fileUrl = fileData.fileUrl;
        fileName = selectedFile.name;
        setIsUploading(false);
      }

      // Send message
      await sendMessage({
        channelId,
        content: trimmedMessage || `📎 ${fileName}`,
        replyToId: replyToMessage?._id,
        messageType: selectedFile ? "file" : "text",
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        fileId: fileData?.fileId,
      });
      
      setMessage("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onCancelReply) {
        onCancelReply();
      }
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      toast.error("Failed to send message");
      console.error(error);
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
        className="hidden"
      />

      {/* Reply indicator */}
      {replyToMessage && (
        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Replying to {replyToMessage.authorName}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {replyToMessage.content}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
          <span className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFile}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Message input */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? "Add a message (optional)" : placeholder}
            className="min-h-[40px] max-h-[150px] resize-none"
            disabled={isSending || isUploading}
          />
          

        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSending || isUploading}
            onClick={handleAttachmentClick}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={handleSendMessage}
            disabled={(!message.trim() && !selectedFile) || isSending || isUploading}
            size="sm"
            className="px-3"
          >
            {isSending || isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Help text */}
      <div className="text-xs text-muted-foreground">
        Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Enter</kbd> to send, 
        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded ml-1">Shift + Enter</kbd> for new line
      </div>
    </div>
  );
} 