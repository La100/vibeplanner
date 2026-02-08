"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppendMessage, ThreadMessageLike, Attachment } from "@assistant-ui/react";
import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import type { AttachmentAdapter } from "@assistant-ui/react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";

import { Thread } from "@/components/assistant-ui/thread";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { apiAny } from "@/lib/convexApiAny";
import { cn } from "@/lib/utils";
import { useChat } from "@/components/ai/assistant/data/hooks";
import { ACCEPTED_FILE_TYPES } from "@/components/ai/assistant/config";
import type { UIMessage } from "@convex-dev/agent/react";
import { MessageSquare, RotateCcw } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

const PRESET_IMAGES: Record<string, string> = {
  gymbro: "/assistants/gymbro/image.jpg",
  martin: "/assistants/martin/image.png",
  buddha: "/assistants/buddha/image.jpeg",
  marcus: "/assistants/marcus/image.webp",
  startup: "/assistants/startup/image.png",
};

const ONBOARDING_INTRO_ASSISTANT = "[SYSTEM: START_ONBOARDING]";
const ONBOARDING_INTRO_USER_PROFILE = "[SYSTEM: START_USER_PROFILE_ONBOARDING]";

type ThreadRole = "assistant" | "user" | "system";
type ThreadContentPart = Exclude<ThreadMessageLike["content"], string>[number];

type ReadonlyJSONObject = { readonly [key: string]: ReadonlyJSONValue };
type ReadonlyJSONValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyJSONObject
  | ReadonlyJSONValue[];

type AssistantChatProps = {
  projectId: Id<"projects">;
  intro?: string;
  showHeader?: boolean;
  className?: string;
  threadKind?: "assistant" | "user_onboarding" | "assistant_onboarding";
  assistantName?: string;
  assistantImageUrl?: string;
  assistantPreset?: string;
};

const toText = (content: ThreadMessageLike["content"]) => {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
};

const normalizeText = (text: string) => text.trim().replace(/\s+/g, " ");

type MessageConversionOptions = {
  hideToolCalls?: boolean;
};

const toThreadMessageLikeFromUI = (
  msg: UIMessage,
  status?: "running" | "complete",
  options?: MessageConversionOptions,
): ThreadMessageLike => {
  const role = (msg.role ?? "assistant") as ThreadRole;
  const parts = Array.isArray(msg.parts) ? (msg.parts as Array<Record<string, unknown>>) : [];
  const content: ThreadContentPart[] = [];
  const record = msg as unknown as Record<string, unknown>;
  const messageId =
    (typeof record.key === "string" && record.key) ||
    (typeof record._id === "string" && record._id) ||
    undefined;

  for (const part of parts) {
    const type = String(part.type ?? "");
    if (type === "text" && typeof part.text === "string") {
      content.push({ type: "text", text: part.text });
      continue;
    }

    if (type.startsWith("tool-result:")) {
      if (options?.hideToolCalls) {
        continue;
      }
      const toolCallId = type.replace("tool-result:", "");
      const toolName =
        (typeof part.toolName === "string" && part.toolName) ||
        (typeof part.name === "string" && part.name) ||
        "tool";
      let result: unknown = undefined;
      if (typeof part.result === "string") {
        try {
          result = JSON.parse(part.result);
        } catch {
          result = part.result;
        }
      }
      const args =
        typeof part.args === "object" && part.args
          ? (part.args as ReadonlyJSONObject)
          : undefined;

      content.push({
        type: "tool-call",
        toolCallId,
        toolName,
        args,
        argsText:
          (typeof part.argsText === "string" && part.argsText) ||
          (typeof part.args === "object" ? JSON.stringify(part.args) : ""),
        result,
        isError:
          typeof result === "object" &&
          result !== null &&
          "error" in (result as Record<string, unknown>),
      });
      continue;
    }
  }

  if (content.length === 0) {
    const fallbackText =
      typeof msg.text === "string"
        ? msg.text
        : typeof record.content === "string"
          ? record.content
          : "";
    if (fallbackText) {
      content.push({ type: "text", text: fallbackText });
    }
  }

  if (role === "assistant") {
    return {
      id: messageId,
      role,
      content,
      status:
        status === "running"
          ? { type: "running" }
          : { type: "complete", reason: "stop" },
      metadata: { custom: {} },
    };
  }

  return {
    id: messageId,
    role,
    content,
    metadata: { custom: {} },
  };
};

const makeLocalMessage = (
  role: ThreadRole,
  text: string,
  attachments?: ThreadMessageLike["attachments"],
): ThreadMessageLike => {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const content: ThreadContentPart[] = text ? [{ type: "text", text }] : [];
  return {
    id,
    role,
    content,
    attachments,
    status:
      role === "assistant" ? { type: "complete", reason: "stop" } : undefined,
    metadata: { custom: {} },
  };
};

export default function AssistantChat({
  projectId,
  intro,
  showHeader = true,
  className,
  threadKind = "assistant",
  assistantName,
  assistantImageUrl,
  assistantPreset,
}: AssistantChatProps) {
  const { user } = useUser();

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  const {
    uiMessages,
    isLoading,
    isStreaming,
    chatIsLoading,
    threadId,
    handleNewChat,
    handleSendMessage,
    handleStopResponse,
  } = useChat({
    projectId,
    userClerkId: user?.id,
    threadKind,
  });

  const [optimisticMessages, setOptimisticMessages] = useState<ThreadMessageLike[]>([]);
  const introSentRef = useRef(false);

  const isBooting = !threadId || chatIsLoading;
  const hideToolCalls = threadKind === "user_onboarding";
  const normalizedIntro = useMemo(
    () => (intro ? normalizeText(intro) : ""),
    [intro],
  );
  const introStorageKey = useMemo(
    () => (threadId ? `onboarding_intro_sent:${threadId}` : ""),
    [threadId],
  );

  const attachmentAdapter = useMemo<AttachmentAdapter>(() => {
    return {
      accept: ACCEPTED_FILE_TYPES,
      async add({ file }) {
        const isImage = file.type.startsWith("image/");
        return {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: isImage ? "image" : "file",
          name: file.name,
          contentType: file.type || "application/octet-stream",
          file,
          status: { type: "requires-action", reason: "composer-send" },
        };
      },
      async remove(attachment: Attachment) {
        void attachment;
        return;
      },
      async send(attachment) {
        return {
          ...attachment,
          status: { type: "complete" },
          content: [],
        };
      },
    };
  }, []);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      if (!user?.id) return;
      const files =
        message.attachments
          ?.map((attachment) => attachment.file)
          .filter((file): file is File => !!file) ?? [];

      const promptText = toText(message.content) || "";

      if (promptText || files.length > 0) {
        setOptimisticMessages((prev) => [
          ...prev,
          makeLocalMessage("user", promptText, message.attachments),
        ]);
      }

      await handleSendMessage(
        files,
        [],
        () => {},
        () => {},
        async (args) => {
          const result = await generateUploadUrl({
            projectId: args.projectId,
            fileName: args.fileName,
            origin: args.origin as "general" | "ai",
          });
          return { url: result.url, key: result.key };
        },
        addFile,
        promptText,
      );
    },
    [addFile, generateUploadUrl, handleSendMessage, user?.id],
  );

  type StoreMessage =
    | { kind: "ui"; message: UIMessage }
    | { kind: "optimistic"; message: ThreadMessageLike };

  const convertedMessages = useMemo<StoreMessage[]>(
    () => {
      return uiMessages
        .filter((message) => {
          const converted = toThreadMessageLikeFromUI(message, "complete", { hideToolCalls });
          const messageText = normalizeText(toText(converted.content));
          if (hideToolCalls && converted.content.length === 0) return false;
          if (!messageText) return true;
          if (normalizedIntro && messageText === normalizedIntro) return false;
          if (messageText.includes(ONBOARDING_INTRO_ASSISTANT)) return false;
          if (messageText.includes(ONBOARDING_INTRO_USER_PROFILE)) return false;
          return true;
        })
        .map((message) => ({ kind: "ui", message }));
    },
    [hideToolCalls, normalizedIntro, uiMessages],
  );

  const storeMessages = useMemo<StoreMessage[]>(() => {
    const converted = convertedMessages;

    if (optimisticMessages.length === 0) {
      return converted;
    }

    const lastOptimistic = optimisticMessages[optimisticMessages.length - 1];
    const optimisticText = normalizeText(toText(lastOptimistic.content));
    const hasUserMessage = converted.some((msg) => {
      if (msg.kind !== "ui") return false;
      if ((msg.message.role ?? "assistant") !== "user") return false;
      const messageText = normalizeText(
        toText(toThreadMessageLikeFromUI(msg.message, "complete", { hideToolCalls }).content),
      );
      return messageText === optimisticText;
    });

    const optimisticBlock = hasUserMessage
      ? converted
      : [
          ...converted,
          ...optimisticMessages.map(
            (message): StoreMessage => ({ kind: "optimistic", message }),
          ),
        ];

    return optimisticBlock;
  }, [convertedMessages, hideToolCalls, optimisticMessages]);

  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    const lastOptimistic = optimisticMessages[optimisticMessages.length - 1];
    const optimisticText = normalizeText(toText(lastOptimistic.content));
    const hasUserMessage = convertedMessages.some(
      (msg) =>
        msg.kind === "ui" &&
        (msg.message.role ?? "assistant") === "user" &&
        normalizeText(toText(toThreadMessageLikeFromUI(msg.message, "complete", { hideToolCalls }).content)) === optimisticText,
    );
    if (hasUserMessage) {
      setOptimisticMessages([]);
    }
  }, [convertedMessages, hideToolCalls, optimisticMessages]);

  useEffect(() => {
    if (!intro || introSentRef.current) return;
    if (chatIsLoading || isLoading || !user?.id) return;
    if (uiMessages.length > 0) return;
    if (!threadId) return;
    if (introStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(introStorageKey);
      if (stored === "1") {
        introSentRef.current = true;
        return;
      }
    }
    introSentRef.current = true;

    handleSendMessage(
      [],
      [],
      () => {},
      () => {},
      async (args) => {
        const result = await generateUploadUrl({
          projectId: args.projectId,
          fileName: args.fileName,
          origin: args.origin as "general" | "ai",
        });
        return { url: result.url, key: result.key };
      },
      addFile,
      intro,
    )
      .then(() => {
        if (introStorageKey && typeof window !== "undefined") {
          window.localStorage.setItem(introStorageKey, "1");
        }
      })
      .catch(() => {
        introSentRef.current = false;
      });
  }, [
    addFile,
    chatIsLoading,
    generateUploadUrl,
    handleSendMessage,
    intro,
    introStorageKey,
    isLoading,
    threadId,
    uiMessages.length,
    user?.id,
  ]);

  const convertMessage = useMemo(
    () =>
      (message: StoreMessage, index: number): ThreadMessageLike => {
        if (message.kind === "optimistic") return message.message;

        const role = (message.message.role ?? "assistant") as ThreadRole;
        const isLast = index === storeMessages.length - 1;
        const isRunningAssistant = role === "assistant" && isStreaming && isLast;

        return toThreadMessageLikeFromUI(
          message.message,
          isRunningAssistant ? "running" : "complete",
          { hideToolCalls },
        );
      },
    [hideToolCalls, isStreaming, storeMessages.length],
  );

  const store = useMemo(
    () => ({
      isRunning: isStreaming || isLoading,
      isLoading: isBooting,
      messages: storeMessages,
      convertMessage,
      onNew,
      onCancel: async () => {
        handleStopResponse();
      },
      adapters: {
        attachments: attachmentAdapter,
      },
    }),
    [
      attachmentAdapter,
      isBooting,
      handleStopResponse,
      isLoading,
      isStreaming,
      onNew,
      storeMessages,
      convertMessage,
    ],
  );

  const runtime = useExternalStoreRuntime(store);

  const handleReset = useCallback(async () => {
    setOptimisticMessages([]);
    await handleNewChat();
  }, [handleNewChat]);

  const headerName = assistantName || "Assistant";
  const resolvedAssistantImageUrl =
    assistantImageUrl || PRESET_IMAGES[assistantPreset ?? ""] || undefined;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
        {showHeader && (
          <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              {headerName}
            </div>
            <TooltipIconButton
              tooltip="Reset chat"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={handleReset}
              disabled={isStreaming || isLoading}
            >
              <RotateCcw className="h-4 w-4" />
            </TooltipIconButton>
          </div>
        )}
        <div className="relative flex-1 min-h-0">
          <div
            className={`flex h-full min-h-0 flex-1 transition-opacity duration-300 ${isBooting ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            <Thread
              showWelcome={!isBooting && !intro}
              assistantImageUrl={resolvedAssistantImageUrl}
              assistantFallback={headerName.charAt(0) || "A"}
              userImageUrl={user?.imageUrl || undefined}
              userFallback={
                user?.fullName?.charAt(0) ||
                user?.firstName?.charAt(0) ||
                user?.primaryEmailAddress?.emailAddress?.charAt(0) ||
                "U"
              }
            />
          </div>
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground transition-opacity duration-300 ${isBooting ? "opacity-100" : "opacity-0"}`}
            aria-hidden={!isBooting}
          >
            Loading conversation…
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
