"use client";

/**
 * Chat Message List Component
 * 
 * Displays the list of messages in the conversation.
 */

import { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  onConfirmItem?: (index: number) => void;
  onRejectItem?: (index: number) => void;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => void;
  onRejectAll?: () => void;
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
    <>
      <AnimatePresence initial={false}>
        {uiMessages.map((msg, index) => {
          // Pass confirmation handlers only to the last assistant message
          const isLastAssistantMessage =
            msg.role === "assistant" &&
            (index === uiMessages.length - 1 ||
              (index === uiMessages.length - 2 && uiMessages[uiMessages.length - 1]?.role === "user"));

          return (
            <motion.div
              key={msg.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={messagesEndRef} className="h-4" />
    </>
  );
}

export default ChatMessageList;

