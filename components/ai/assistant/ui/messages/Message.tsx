"use client";

import { memo, useMemo } from "react";
import { z } from "zod";
import type { UIMessage } from "@convex-dev/agent/react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { MessageContent } from "@/components/ai/primitives/message";
import { MessageResponse } from "@/components/ai/primitives/message";
import { InlineConfirmationList } from "../confirmations/InlineConfirmation";
import type { PendingContentItem, PendingContentType } from "../../data/types";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai/primitives/chain-of-thought";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai/primitives/reasoning";
import { getToolConfig } from "@/components/ai/shared/ToolIcons";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const toolResultDataSchema = z.record(z.unknown());
const titleChangeSchema = z.object({
  taskId: z.string().optional(),
  currentTitle: z.string().optional(),
  originalTitle: z.string().optional(),
  newTitle: z.string(),
});
const pendingActionSchema = z.object({
  type: z.string(),
  operation: z.enum(["create", "edit", "delete", "bulk_create", "bulk_edit"]),
  data: toolResultDataSchema,
  status: z.string().optional(),
  outcome: z.unknown().optional(),
  updates: toolResultDataSchema.optional(),
  originalItem: toolResultDataSchema.optional(),
  selection: toolResultDataSchema.optional(),
  titleChanges: z.array(titleChangeSchema).optional(),
}).passthrough();

const bulkTasksSchema = z.object({
  type: z.literal("task"),
  operation: z.literal("bulk_create"),
  data: z.object({
    tasks: z.array(toolResultDataSchema),
  }),
});

const bulkNotesSchema = z.object({
  type: z.literal("note"),
  operation: z.literal("bulk_create"),
  data: z.object({
    notes: z.array(toolResultDataSchema),
  }),
});

const bulkShoppingSchema = z.object({
  type: z.string(),
  operation: z.literal("bulk_create"),
  data: z.object({
    items: z.array(toolResultDataSchema),
  }),
});

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

type UIMessagePart = NonNullable<UIMessage["parts"]>[number];

const hasText = (part: UIMessagePart): part is UIMessagePart & { text: string } =>
  typeof (part as { text?: unknown }).text === "string";

function extractPendingItemsFromMessage(message: UIMessage): PendingContentItem[] {
  const items: PendingContentItem[] = [];
  if (!message.parts) return items;

  for (const part of message.parts) {
    if (part.type.startsWith("tool-result:")) {
      const resultPart = part as { type: string; result?: string };
      if (!resultPart.result) continue;

      const parsed = safeParseToolResult(resultPart.result);
      if (!parsed) continue;

      // Skip if the tool result contains an error
      const hasError = typeof parsed === "object" && parsed !== null && "error" in parsed;
      if (hasError) continue;

      if (parsed.type && parsed.operation && parsed.data) {
        const callId = part.type.replace("tool-result:", "");
        const status =
          parsed.status === "confirmed" || parsed.status === "rejected"
            ? parsed.status
            : undefined;

        if (parsed.operation === "bulk_create") {
          const bulkTasks = bulkTasksSchema.safeParse(parsed);
          if (bulkTasks.success) {
            for (const task of bulkTasks.data.data.tasks) {
              items.push({
                type: "task",
                operation: "create",
                data: task as Record<string, unknown>,
                functionCall: { callId, functionName: "", arguments: "" },
                status,
              });
            }
            continue;
          }

          const bulkNotes = bulkNotesSchema.safeParse(parsed);
          if (bulkNotes.success) {
            for (const note of bulkNotes.data.data.notes) {
              items.push({
                type: "note",
                operation: "create",
                data: note as Record<string, unknown>,
                functionCall: { callId, functionName: "", arguments: "" },
                status,
              });
            }
            continue;
          }

          const bulkShopping = bulkShoppingSchema.safeParse(parsed);
          if (bulkShopping.success) {
            for (const item of bulkShopping.data.data.items) {
              items.push({
                type: "shopping",
                operation: "create",
                data: item as Record<string, unknown>,
                functionCall: { callId, functionName: "", arguments: "" },
                status,
              });
            }
            continue;
          }
        }

        items.push({
          type: toPendingContentType(parsed.type),
          operation: parsed.operation,
          data: parsed.data,
          updates: parsed.updates as Record<string, unknown>,
          originalItem: parsed.originalItem as Record<string, unknown>,
          selection: parsed.selection as Record<string, unknown>,
          titleChanges: parsed.titleChanges as Array<{
            taskId?: string;
            currentTitle?: string;
            originalTitle?: string;
            newTitle: string;
          }>,
          functionCall: { callId, functionName: "", arguments: "" },
          status,
        });
      }
    }
  }

  return items;
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
              <div className="h-8 w-8 rounded-md border border-border/60 bg-muted" />
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
          <div className="h-8 w-8 rounded-md border border-border/60 bg-muted" />
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

type PreviewMessageProps = {
  message: UIMessage;
  isLoading: boolean;
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
  onConfirmItem?: (index: number | string) => Promise<void>;
  onRejectItem?: (index: number | string) => void | Promise<void>;
  onEditItem?: (index: number | string) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number | string, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
};

export const PurePreviewMessage = ({
  message,
  isLoading,
  metadata,
  localAttachments,
  pendingItems,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing,
}: PreviewMessageProps & { pendingItems?: PendingContentItem[] }) => {
  const isUser = message.role === "user";
  const textFromParts =
    message.parts?.find(
      (part): part is UIMessagePart & { type: "text"; text: string } =>
        part.type === "text" && hasText(part)
    )?.text ?? "";
  const messageText = message.text || textFromParts;

  const reasoningText = useMemo(() => {
    return (
      message.parts
        ?.filter(
          (part): part is UIMessagePart & { text: string } =>
            part.type === "reasoning" && hasText(part)
        )
        .map((part) => part.text)
        .join("\n\n") ?? ""
    ).trim();
  }, [message.parts]);

  const toolParts = useMemo(
    () => message.parts?.filter((part) => part.type.startsWith("tool-") && ("toolName" in part || "name" in part)) ?? [],
    [message.parts]
  );

  // Extract items and merge with local pending state for optimistic updates
  const inlineItems = useMemo(() => {
    const items = extractPendingItemsFromMessage(message);
    if (!pendingItems || pendingItems.length === 0) return items;

    return items.map(item => {
      // Find matching local item by callId
      const localItem = pendingItems.find(
        p => p.functionCall?.callId === item.functionCall?.callId
      );

      // If local item has a status (confirmed/rejected), use it
      if (localItem?.status) {
        return {
          ...item,
          status: localItem.status
        };
      }
      return item;
    });
  }, [message, pendingItems]);

  const hasConfirmations = inlineItems.length > 0 && !isLoading;

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": isUser,
          "justify-start": !isUser,
        })}
      >
        {!isUser && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <Sparkles className="size-4" />
          </div>
        )}

        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": true,
            "w-full": !isUser,
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]": isUser,
          })}
        >
          {isUser && (
            <UserAttachmentPreview metadata={metadata} localAttachments={localAttachments} />
          )}

          {reasoningText && !isUser && (
            <Reasoning isStreaming={isLoading} defaultOpen={isLoading}>
              <ReasoningTrigger />
              <ReasoningContent>{reasoningText}</ReasoningContent>
            </Reasoning>
          )}

          {!isUser && toolParts.length > 0 && (
            <ChainOfThought defaultOpen={isLoading}>
              <ChainOfThoughtHeader>Chain of Thought</ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                {toolParts.map((part, index) => {
                  const toolName = (part as { toolName?: string; name?: string }).toolName || (part as { toolName?: string; name?: string }).name;
                  const config = toolName ? getToolConfig(toolName) : null;
                  return (
                    <ChainOfThoughtStep
                      key={`${part.type}-${index}`}
                      icon={config?.icon}
                      label={config?.label ?? toolName ?? "Tool"}
                      status={isLoading && index === toolParts.length - 1 ? "active" : "complete"}
                    />
                  );
                })}
              </ChainOfThoughtContent>
            </ChainOfThought>
          )}

          {messageText && (
            <MessageContent
              className={cn({
                "wrap-break-word w-fit rounded-2xl px-3 py-2 text-right text-white": isUser,
                "bg-transparent px-0 py-0 text-left": !isUser,
              })}
              style={isUser ? { backgroundColor: "#006cff" } : undefined}
            >
              <MessageResponse>{messageText}</MessageResponse>
            </MessageContent>
          )}

          {hasConfirmations && onConfirmItem && onRejectItem && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(PurePreviewMessage);
