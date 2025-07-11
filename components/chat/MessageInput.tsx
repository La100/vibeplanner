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
  Smile,
  AtSign
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
  const sendMessage = useMutation(api.chatMessages.sendMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({
        channelId,
        content: trimmedMessage,
        replyToId: replyToMessage?._id,
      });
      
      setMessage("");
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

  return (
    <div className="space-y-3">
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
            ×
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
            placeholder={placeholder}
            className="min-h-[40px] max-h-[150px] resize-none pr-12"
            disabled={isSending}
          />
          
          {/* Emoji and mention buttons */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={isSending}
            >
              <Smile className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={isSending}
            >
              <AtSign className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={isSending}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isSending}
            size="sm"
            className="px-3"
          >
            {isSending ? (
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