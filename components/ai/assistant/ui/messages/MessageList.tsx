"use client";

import { ArrowDownIcon } from "lucide-react";
import type { UIMessage } from "@convex-dev/agent/react";
import type { PendingContentItem } from "../../data/types";
import { useMessages } from "../../data/hooks/useMessages";
import { Greeting } from "./Greeting";
import { PreviewMessage } from "./Message";
import { ThinkingMessage } from "./ThinkingMessage";
import { cn } from "@/lib/utils";

type MessagesProps = {
  messages: UIMessage[];
  status: "ready" | "submitted" | "streaming" | "error";
  pendingUserMessage?: {
    text: string;
    attachments: Array<{
      name: string;
      size: number;
      type: string;
      previewUrl?: string;
    }>;
  } | null;
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
  localMessageAttachments?: Record<string, Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>>;
  pendingItems?: PendingContentItem[];
};

export function Messages({
  messages,
  status,
  pendingUserMessage,
  onConfirmItem,
  onRejectItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing,
  localMessageAttachments,
  pendingItems,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({ status, messagesLength: messages.length });

  const shouldDockMessages =
    messages.length > 0 || Boolean(pendingUserMessage) || hasSentMessage;

  return (
    <div className="relative flex-1">
      <div
        className="absolute inset-0 touch-pan-y overflow-y-auto"
        ref={messagesContainerRef}
      >
        <div
          className={cn(
            "mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-2 py-4 md:gap-6 md:px-4",
            shouldDockMessages && "min-h-full justify-end"
          )}
        >
          {messages.length === 0 && !pendingUserMessage && !hasSentMessage && <Greeting />}

          {messages.map((message, index) => {
            const messageKey = message.key ?? message.id ?? `${message.order}-${index}`;

            return (
              <PreviewMessage
                key={messageKey}
                message={message}
                isLoading={status === "streaming" && messages.length - 1 === index}
                localAttachments={localMessageAttachments?.[message.key]}
                onConfirmItem={onConfirmItem}
                onRejectItem={onRejectItem}
                onUpdateItem={onUpdateItem}
                onConfirmAll={onConfirmAll}
                onRejectAll={onRejectAll}
                isProcessing={isProcessing}
                pendingItems={pendingItems}
              />
            );
          })}

          {/* Only show pending message if it's not already in the list (dedup by content/timing) */
            pendingUserMessage &&
            !messages.some((m) => m.role === "user" && m.text === pendingUserMessage.text) && (
              <PreviewMessage
                key="pending-user-message"
                message={
                  {
                    id: "pending-user-message",
                    key: "pending-user-message",
                    role: "user",
                    content: pendingUserMessage.text,
                    text: pendingUserMessage.text,
                    parts: [
                      {
                        type: "text",
                        text: pendingUserMessage.text,
                      },
                    ],
                    order: messages.length,
                    stepOrder: messages.length,
                    status: "success",
                    _creationTime: Date.now(),
                  } as UIMessage
                }
                isLoading={false}
                localAttachments={pendingUserMessage.attachments}
              />
            )}

          {status === "submitted" && (messages.length > 0 || pendingUserMessage || hasSentMessage) && (
            <ThinkingMessage />
          )}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </div>
      </div>

      <button
        aria-label="Scroll to bottom"
        className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background p-2 shadow-lg transition-all hover:bg-muted ${isAtBottom
          ? "pointer-events-none scale-0 opacity-0"
          : "pointer-events-auto scale-100 opacity-100"
          }`}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-4" />
      </button>
    </div>
  );
}
