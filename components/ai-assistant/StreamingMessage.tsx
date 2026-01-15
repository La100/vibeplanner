/**
 * StreamingMessage Component
 * 
 * Displays AI assistant messages with step-by-step visualization.
 * Shows tool calls, reasoning, and text in a timeline format.
 * Includes inline confirmation cards for pending items.
 */

"use client";

import React, { memo } from "react";
import { z } from "zod";
import type { UIMessage } from "@convex-dev/agent/react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageStepList, type MessagePart } from "./MessageSteps";
import { InlineConfirmationList } from "./InlineConfirmation";
import type { PendingContentItem, PendingContentType } from "@/components/AIConfirmationGrid";

// ==================== ZOD SCHEMAS FOR TOOL RESULT VALIDATION ====================

/** Schema for validating tool result data */
const toolResultDataSchema = z.record(z.unknown());

/** Schema for validating a single pending action from tool result */
const pendingActionSchema = z.object({
  type: z.string(),
  operation: z.enum(["create", "edit", "delete", "bulk_create", "bulk_edit"]),
  data: toolResultDataSchema,
}).passthrough();

/** Schema for bulk task data */
const bulkTasksSchema = z.object({
  type: z.literal("task"),
  operation: z.literal("bulk_create"),
  data: z.object({
    tasks: z.array(toolResultDataSchema),
  }),
});

/** Schema for bulk notes data */
const bulkNotesSchema = z.object({
  type: z.literal("note"),
  operation: z.literal("bulk_create"),
  data: z.object({
    notes: z.array(toolResultDataSchema),
  }),
});

/** Schema for bulk shopping items data */
const bulkShoppingSchema = z.object({
  type: z.string(),
  operation: z.literal("bulk_create"),
  data: z.object({
    items: z.array(toolResultDataSchema),
  }),
});

/** Safe JSON parse with validation */
function safeParseToolResult(result: string): z.infer<typeof pendingActionSchema> | null {
  try {
    const parsed = JSON.parse(result);
    const validated = pendingActionSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function toPendingContentType(type: string): PendingContentType {
  return type as PendingContentType;
}

interface StreamingMessageProps {
  message: UIMessage;
  showMode?: boolean;
  metadata?: {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    mode?: string;
  };
  localAttachments?: Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>;
  // Inline confirmation props (optional)
  pendingItems?: PendingContentItem[];
  onConfirmItem?: (index: number) => Promise<void>;
  onRejectItem?: (index: number) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
}

function UserAttachmentPreview({
  metadata,
  localAttachments,
}: {
  metadata?: {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  };
  localAttachments?: Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>;
}) {
  const file = useQuery(
    apiAny.files.getFileWithURL,
    metadata?.fileId ? { fileId: metadata.fileId as Id<"files"> } : "skip"
  );

  if (localAttachments && localAttachments.length > 0) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {localAttachments.map((attachment) => (
          <div
            key={`${attachment.name}-${attachment.size}`}
            className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border/50"
          >
            {attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="h-8 w-8 rounded-md object-cover border border-border/60"
              />
            ) : (
              <FileText className="h-8 w-8 text-primary" />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-medium max-w-[120px] truncate">
                {attachment.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {(attachment.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!metadata?.fileId || !file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const sizeLabel = typeof file.size === "number" ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-border/50">
        {isImage && file.url ? (
          <img
            src={file.url}
            alt={file.name}
            className="h-8 w-8 rounded-md object-cover border border-border/60"
          />
        ) : (
          <FileText className="h-8 w-8 text-primary" />
        )}
        <div className="flex flex-col">
          <span className="text-xs font-medium max-w-[120px] truncate">{file.name}</span>
          {sizeLabel && (
            <span className="text-[10px] text-muted-foreground">{sizeLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Extract pending items from tool call results in the message
 * Uses Zod validation for type safety
 */
function extractPendingItemsFromMessage(message: UIMessage): PendingContentItem[] {
  const items: PendingContentItem[] = [];

  if (!message.parts) return items;

  for (const part of message.parts) {
    // Check for tool results that contain confirmation data
    if (part.type.startsWith("tool-result:")) {
      const resultPart = part as { type: string; result?: string };
      if (!resultPart.result) continue;

      // Use safe parse with Zod validation
      const parsed = safeParseToolResult(resultPart.result);
      if (!parsed) continue;

      // Check if this is a create/edit/delete action result
      if (parsed.type && parsed.operation && parsed.data) {
        // Handle bulk operations with Zod validation
        if (parsed.operation === "bulk_create") {
          // Try bulk tasks
          const bulkTasks = bulkTasksSchema.safeParse(parsed);
          if (bulkTasks.success) {
            for (const task of bulkTasks.data.data.tasks) {
              items.push({
                type: "task",
                operation: "create",
                data: task as Record<string, unknown>,
              });
            }
            continue;
          }

          // Try bulk notes
          const bulkNotes = bulkNotesSchema.safeParse(parsed);
          if (bulkNotes.success) {
            for (const note of bulkNotes.data.data.notes) {
              items.push({
                type: "note",
                operation: "create",
                data: note as Record<string, unknown>,
              });
            }
            continue;
          }

          // Try bulk shopping items
          const bulkShopping = bulkShoppingSchema.safeParse(parsed);
          if (bulkShopping.success) {
            for (const item of bulkShopping.data.data.items) {
              items.push({
                type: toPendingContentType(parsed.type),
                operation: "create",
                data: item as Record<string, unknown>,
              });
            }
            continue;
          }
        }

        // Single item operation
        items.push({
          type: toPendingContentType(parsed.type),
          operation: parsed.operation,
          data: parsed.data as Record<string, unknown>,
        });
      }
    }
  }

  return items;
}

/**
 * Parse UIMessage parts into our MessagePart format
 * 
 * Chain of Thought streaming:
 * - Text that appears BEFORE tool calls is treated as "reasoning" (AI thinking)
 * - Text that appears AFTER all tool calls is treated as "text" (final response)
 * - This creates the streaming chain-of-thought effect
 */
function parseMessageParts(message: UIMessage): MessagePart[] {
  const rawParts: MessagePart[] = [];

  if (!message.parts || message.parts.length === 0) {
    // If no parts, just use the text
    if (message.text) {
      rawParts.push({ type: "text", text: message.text });
    }
    return rawParts;
  }

  // First pass: collect all parts in order
  for (const part of message.parts) {
    // Tool call parts from Convex Agent
    if (part.type.startsWith("tool-call:")) {
      const toolName = part.type.replace("tool-call:", "");
      const toolPart = part as { type: string; args?: Record<string, unknown>; toolCallId?: string };

      rawParts.push({
        type: `tool-${toolName}`,
        toolName,
        args: toolPart.args,
      });
    }
    // Tool result parts
    else if (part.type.startsWith("tool-result:")) {
      const toolName = part.type.replace("tool-result:", "");
      const resultPart = part as { type: string; result?: string };

      // Find matching tool call and update it
      const existingToolPart = rawParts.find(
        (p) => p.type === `tool-${toolName}` && !p.result
      );
      if (existingToolPart) {
        existingToolPart.result = resultPart.result;
      } else {
        // Tool result without a matching call (shouldn't happen but handle gracefully)
        rawParts.push({
          type: `tool-${toolName}`,
          toolName,
          result: resultPart.result,
        });
      }
    }
    // Reasoning parts (native from models that support it like Claude)
    else if (part.type === "reasoning") {
      const reasoningPart = part as { type: string; text?: string };
      if (reasoningPart.text) {
        rawParts.push({
          type: "reasoning",
          text: reasoningPart.text,
        });
      }
    }
    // Text parts
    else if (part.type === "text") {
      const textPart = part as { type: string; text?: string };
      if (textPart.text) {
        rawParts.push({
          type: "text",
          text: textPart.text,
        });
      }
    }
  }

  // If we still have no parts but have text, add it
  if (rawParts.length === 0 && message.text) {
    rawParts.push({ type: "text", text: message.text });
  }

  // Second pass: Convert text before tool calls to "reasoning" for chain-of-thought effect
  // This makes AI's thinking visible during streaming
  const hasToolCalls = rawParts.some(p => p.type.startsWith("tool-"));

  if (hasToolCalls) {
    // Find the index of the first tool call
    const firstToolIndex = rawParts.findIndex(p => p.type.startsWith("tool-"));

    // Convert text parts BEFORE first tool call to "reasoning"
    for (let i = 0; i < firstToolIndex; i++) {
      const part = rawParts[i];
      if (part.type === "text" && part.text) {
        part.type = "reasoning";
      }
    }

    // Text AFTER last tool call stays as "text" (final response)
    // Nothing to change here
  }

  return rawParts;
}

/**
 * StreamingMessage - Renders a single message with step-by-step visualization
 * Memoized to prevent unnecessary re-renders when parent components update
 */
export const StreamingMessage = memo(function StreamingMessage({
  message,
  showMode = true,
  metadata,
  localAttachments,
  pendingItems: externalPendingItems,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing = false,
}: StreamingMessageProps) {
  const isUser = message.role === "user";
  const isCurrentlyStreaming = message.status === "streaming";

  // User messages - simple bubble
  if (isUser) {
    return (
      <div className="flex flex-col gap-4 items-end">
        <div className="max-w-[85%]">
          <div className="bg-muted/30 text-foreground px-5 py-3.5 rounded-2xl border border-border/60 shadow-sm">
            <UserAttachmentPreview metadata={metadata} localAttachments={localAttachments} />
            <p className="text-base leading-relaxed whitespace-pre-wrap">
              {message.text}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Parse message parts for step-by-step display
  const messageParts = parseMessageParts(message);
  const showStepLayout = showMode;

  // Extract inline pending items from message OR use external ones
  const inlineItems = externalPendingItems ?? extractPendingItemsFromMessage(message);
  const hasConfirmations = inlineItems.length > 0 && !isCurrentlyStreaming;

  // Assistant message
  return (
    <div className="flex flex-col gap-4 items-start">
      <div className="w-full max-w-4xl">
        {/* Show loading indicator when streaming just started with no content */}
        {isCurrentlyStreaming && messageParts.length === 0 ? (
          <div className="flex items-center gap-3 pl-4 py-4">
            <div className="h-3 w-3 rounded-full bg-foreground animate-pulse" />
            <div className="h-3 w-3 rounded-full bg-foreground/60 animate-pulse" style={{ animationDelay: "150ms" }} />
            <div className="h-3 w-3 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
        ) : showStepLayout ? (
          // Step-by-step view for assistant responses
          <div className="relative w-full">
            <div className="relative z-10 py-2">
              <MessageStepList
                parts={messageParts}
                isStreaming={isCurrentlyStreaming}
              />

              {/* Inline confirmations */}
              {hasConfirmations && onConfirmItem && onRejectItem && (
                <div className="mt-4 pt-4">
                  <InlineConfirmationList
                    items={inlineItems}
                    onConfirmItem={onConfirmItem}
                    onRejectItem={onRejectItem}
                    onEditItem={onEditItem}
                    onConfirmAll={onConfirmAll}
                    onRejectAll={onRejectAll}
                    onUpdateItem={onUpdateItem}
                    isProcessing={isProcessing}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          // Simple text response (no steps)
          <div className={cn(
            "relative overflow-hidden",
            hasConfirmations ? "rounded-2xl bg-muted/20 border border-border/50" : "rounded-3xl bg-transparent"
          )}>
            <div className={cn("relative z-10", hasConfirmations ? "p-6" : "p-4 sm:p-6")}>
              {/* Show dots if text is just "Thinking..." or similar */}
              {(message.text?.toLowerCase().includes("thinking") && message.text.length < 20) || !message.text ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-3 w-3 rounded-full bg-foreground animate-pulse" />
                  <div className="h-3 w-3 rounded-full bg-foreground/60 animate-pulse" style={{ animationDelay: "150ms" }} />
                  <div className="h-3 w-3 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <div className="prose prose-neutral dark:prose-invert max-w-none leading-relaxed text-base text-foreground/90">
                  <div
                    className={cn(
                      "whitespace-pre-wrap",
                      isCurrentlyStreaming && "animate-pulse-subtle"
                    )}
                  >
                    {message.text || ""}
                    {isCurrentlyStreaming && message.text && (
                      <span className="inline-block w-2 h-5 ml-1 bg-primary/60 animate-blink" />
                    )}
                  </div>
                </div>
              )}

              {/* Inline confirmations for simple text responses */}
              {hasConfirmations && onConfirmItem && onRejectItem && (
                <div className="mt-6 pt-6 border-t border-border/50">
                  <InlineConfirmationList
                    items={inlineItems}
                    onConfirmItem={onConfirmItem}
                    onRejectItem={onRejectItem}
                    onEditItem={onEditItem}
                    onConfirmAll={onConfirmAll}
                    onRejectAll={onRejectAll}
                    onUpdateItem={onUpdateItem}
                    isProcessing={isProcessing}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Streaming status indicator */}
        {message.status === "failed" && (
          <div className="mt-2 ml-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
              Response failed
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

StreamingMessage.displayName = "StreamingMessage";

/**
 * StreamingMessageList - Renders a list of messages with streaming support
 */
interface StreamingMessageListProps {
  messages: UIMessage[];
  showMode?: boolean;
  // Confirmation handlers for the last message (if it has pending items)
  pendingItems?: PendingContentItem[];
  onConfirmItem?: (index: number) => Promise<void>;
  onRejectItem?: (index: number) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
}

export const StreamingMessageList = memo(function StreamingMessageList({
  messages,
  showMode = true,
  pendingItems,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing,
}: StreamingMessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg, index) => {
        // Only pass confirmation handlers to the last assistant message
        const isLastAssistant =
          msg.role === "assistant" &&
          index === messages.length - 1 ||
          (index === messages.length - 2 && messages[messages.length - 1]?.role === "user");

        return (
          <StreamingMessage
            key={msg.key}
            message={msg}
            showMode={showMode}
            pendingItems={isLastAssistant ? pendingItems : undefined}
            onConfirmItem={isLastAssistant ? onConfirmItem : undefined}
            onRejectItem={isLastAssistant ? onRejectItem : undefined}
            onEditItem={isLastAssistant ? onEditItem : undefined}
            onUpdateItem={isLastAssistant ? onUpdateItem : undefined}
            onConfirmAll={isLastAssistant ? onConfirmAll : undefined}
            onRejectAll={isLastAssistant ? onRejectAll : undefined}
            isProcessing={isLastAssistant ? isProcessing : undefined}
          />
        );
      })}
    </div>
  );
});

StreamingMessageList.displayName = "StreamingMessageList";

export default StreamingMessage;
