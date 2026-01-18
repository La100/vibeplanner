"use client";

/**
 * Chat Message List Component
 * 
 * Displays the list of messages in the conversation.
 */

import { RefObject } from "react";
import type { UIMessage } from "@convex-dev/agent/react";
import { StreamingMessage } from "./StreamingMessage";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";

interface ChatMessageListProps {
  uiMessages: UIMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  messageMetadataByIndex?: Map<number, {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    mode?: string;
  }>;
  localMessageAttachments?: Record<string, Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>>;
  pendingItems?: PendingContentItem[];
  isBulkProcessing?: boolean;
  onConfirmItem?: (index: number) => Promise<void>;
  onRejectItem?: (index: number) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number, updates: Partial<PendingContentItem>) => void;
}

export function ChatMessageList({
  uiMessages,
  messagesEndRef,
  messageMetadataByIndex,
  localMessageAttachments,
  pendingItems,
  isBulkProcessing,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
}: ChatMessageListProps) {
  return (
    <div className="flex flex-col gap-8 px-2 sm:px-4">
      {uiMessages.map((msg, index) => {
        // Pass confirmation handlers only to the last assistant message
        const isLastAssistantMessage =
          msg.role === "assistant" &&
          (index === uiMessages.length - 1 ||
            (index === uiMessages.length - 2 && uiMessages[uiMessages.length - 1]?.role === "user"));
        const messageKey = msg.id ?? msg.key ?? `${msg.order}-${index}`;

        return (
          <div key={messageKey}>
            <StreamingMessage
              message={msg}
              showMode={true}
              metadata={messageMetadataByIndex?.get(msg.order)}
              localAttachments={localMessageAttachments?.[msg.key]}
              pendingItems={isLastAssistantMessage ? pendingItems : undefined}
              onConfirmItem={isLastAssistantMessage ? onConfirmItem : undefined}
              onRejectItem={isLastAssistantMessage ? onRejectItem : undefined}
              onEditItem={isLastAssistantMessage ? onEditItem : undefined}
              onUpdateItem={isLastAssistantMessage ? onUpdateItem : undefined}
              onConfirmAll={isLastAssistantMessage ? onConfirmAll : undefined}
              onRejectAll={isLastAssistantMessage ? onRejectAll : undefined}
              isProcessing={isLastAssistantMessage ? isBulkProcessing : undefined}
            />
          </div>
        );
      })}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
}

export default ChatMessageList;
