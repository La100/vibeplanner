"use client";
/**
 * useAIChat Hook
 * 
 * Manages chat state, message sending, and thread operations for the AI Assistant.
 * Uses Convex Agent's streaming hooks for real-time message updates.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useUIMessages } from "@convex-dev/agent/react";

type UIMessagesResult = ReturnType<typeof useUIMessages>["results"];
type UIMessageItem = NonNullable<UIMessagesResult>[number];
type MessagePart = NonNullable<UIMessageItem["parts"]>[number];
type ToolResultPart = MessagePart & { result?: string };
type ToolCallishPart = MessagePart & {
  toolCallId?: string;
  callId?: string;
  id?: string;
  toolName?: string;
  name?: string;
};
type PersistentCall = {
  callId: string;
  status?: string;
  result?: string;
  arguments: string;
};

interface UseAIChatProps {
  projectId: Id<"projects"> | undefined;
  userClerkId: string | undefined;
  threadKind?: "assistant" | "user_onboarding" | "assistant_onboarding";
}

interface UseAIChatReturn {
  isLoading: boolean;
  threadId: string | undefined;
  isStreaming: boolean;
  chatIsLoading: boolean;

  // UIMessages from streaming
  uiMessages: UIMessagesResult;
  streamingStatus: "LoadingFirstPage" | "CanLoadMore" | "Exhausted";
  loadMoreMessages: (numItems: number) => void;

  // Actions
  handleSendMessage: (
    selectedFiles: File[],
    uploadedFileIds: string[],
    onUploadStart: () => void,
    onUploadComplete: (fileIds: string[]) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>,
    promptOverride?: string
  ) => Promise<void>;
  handleStopResponse: () => void;
  handleNewChat: () => void;
}

export const useAIChat = ({ projectId, userClerkId, threadKind }: UseAIChatProps): UseAIChatReturn => {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);

  // Anti-flicker: suppress messages briefly when switching threads to ensure 
  // useUIMessages clears its cache/stale data
  const [suppressMessages, setSuppressMessages] = useState(false);

  const setThreadIdWithSuppression = useCallback((id: string | undefined) => {
    setThreadId(id);
    // Only suppress if we are setting a valid ID (switching TO a thread)
    // If setting to undefined (clearing), shouldSubscribe becomes false anyway.
    if (id) {
      setSuppressMessages(true);
      // Short timeout to allow render cycle to clear/reset the hook
      setTimeout(() => setSuppressMessages(false), 50);
    }
  }, []);

  // Refs
  const isSendingRef = useRef(false);

  // ===========================================
  // Thread Query - Single Thread Mode
  // ===========================================

  const getAssistantThreadIdMutation = useMutation(apiAny.ai.threads.getProjectThread);
  const getUserOnboardingThreadIdMutation = useMutation(apiAny.ai.threads.getUserOnboardingThread);
  const getAssistantOnboardingThreadIdMutation = useMutation(apiAny.ai.threads.getAssistantOnboardingThread);

  const getThreadMutation = threadKind === "user_onboarding"
    ? getUserOnboardingThreadIdMutation
    : threadKind === "assistant_onboarding"
      ? getAssistantOnboardingThreadIdMutation
      : getAssistantThreadIdMutation;

  // Initialize thread on mount
  useEffect(() => {
    const initThread = async () => {
      if (projectId && userClerkId && !threadId) {
        try {
          const id = await getThreadMutation({
            projectId,
            userClerkId,
          });
          setThreadId(id);
        } catch (e) {
          console.error("Failed to init thread", e);
        }
      }
    };
    initThread();
  }, [projectId, userClerkId, threadId, getThreadMutation]);

  // CRITICAL: Subscribe strategy based on thread type
  // - Skip if no threadId (empty/new chat state)
  // - For existing threads: always subscribe
  // - Skip if explicitly suppressed (anti-flicker)
  const shouldSubscribe = Boolean(threadId) && !suppressMessages;

  // List persistent function calls (pending + confirmed/rejected)
  const persistentFunctionCalls = useQuery(
    apiAny.ai.threads.listPendingItems,
    shouldSubscribe ? { threadId: threadId! } : "skip"
  );

  const streamingHookResult = useUIMessages(
    apiAny.ai.streamingQueries.listThreadMessages,
    shouldSubscribe ? { threadId: threadId! } : "skip",
    { initialNumItems: 50, stream: true }
  );

  // Extract results - always from hook when subscribed
  const rawUiMessages = shouldSubscribe ? streamingHookResult.results : undefined;

  const stripThinking = useCallback((text: string) => {
    if (!text.includes("<thinking>")) return text;
    const withoutBlocks = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
    const withoutOpen = withoutBlocks.replace(/<thinking>[\s\S]*$/g, "");
    return withoutOpen.replace(/<\/thinking>/g, "");
  }, []);

  // Merge persistent status into UI messages
  const uiMessages = useMemo(() => {
    if (!rawUiMessages) return undefined;
    if (!persistentFunctionCalls) return rawUiMessages;

    const callMap = new Map<string, PersistentCall>(
      persistentFunctionCalls.map((c) => {
        const call = c as PersistentCall;
        return [call.callId, call];
      })
    );

    return rawUiMessages.map(msg => {
      if (!msg.parts) return msg;

      let parts = [...msg.parts];
      let hasUpdates = false;

      // 1. Update existing tool-results with persisted status
      parts = parts.map(part => {
        if (part.type.startsWith("tool-result")) {
          const callId = part.type.replace("tool-result:", "");
          const persistentCall = callMap.get(callId);

          const partWithResult = part as ToolResultPart;
          if (persistentCall?.status && partWithResult.result) {
            try {
              const currentResult = JSON.parse(partWithResult.result);
              if (currentResult.status !== persistentCall.status) {
                hasUpdates = true;
                const enrichedResult = {
                  ...currentResult,
                  status: persistentCall.status,
                  outcome: persistentCall.result ? JSON.parse(persistentCall.result) : undefined
                };
                return {
                  ...part,
                  result: JSON.stringify(enrichedResult)
                };
              }
            } catch {
              return part;
            }
          }
        }
        return part;
      });

      // 2. Inject missing tool-results for pending items
      const toolCallParts = parts.filter((p) => {
        const part = p as ToolCallishPart;
        const hasCallId = "toolCallId" in part || "callId" in part || "id" in part;
        const isToolCallType = typeof part.type === "string" && part.type.startsWith("tool-");
        return (isToolCallType || hasCallId) && !part.type.startsWith("tool-result");
      });

      for (const tc of toolCallParts) {
        const toolCallish = tc as ToolCallishPart;
        const callId = toolCallish.toolCallId || toolCallish.callId || toolCallish.id;

        if (callId) {
          const persistentCall = callMap.get(callId);
          const hasResult = parts.some(p => p.type === `tool-result:${callId}`);

          if (persistentCall && !hasResult && persistentCall.arguments) {
            hasUpdates = true;
            parts.push({
              type: `tool-result:${callId}`,
              toolCallId: callId,
              toolName: toolCallish.toolName || toolCallish.name,
              result: JSON.stringify({
                ...JSON.parse(persistentCall.arguments),
                status: persistentCall.status
              })
            } as MessagePart);
          }
        }
      }

      // 3. Strip any <thinking> tags or reasoning parts from text
      let partsChanged = false;
      const processedParts: MessagePart[] = [];

      for (const part of parts) {
        if (part.type === "reasoning") {
          partsChanged = true;
          hasUpdates = true;
          continue;
        }

        if (part.type === "text" && typeof (part as unknown as { text: string }).text === "string") {
          const rawText = (part as unknown as { text: string }).text as string;
          const cleaned = stripThinking(rawText).trimEnd();
          if (cleaned !== rawText) {
            partsChanged = true;
            hasUpdates = true;
          }
          if (cleaned.length > 0) {
            processedParts.push({
              ...part,
              text: cleaned,
            } as MessagePart);
          } else {
            partsChanged = true;
            hasUpdates = true;
          }
          continue;
        }

        processedParts.push(part);
      }

      if (partsChanged) {
        parts = processedParts;
      }

      if (!hasUpdates) return msg;

      // If we modified parts (either via tools/status or stripping thinking tags),
      // update the 'text' property to avoid rendering raw tags.
      if (partsChanged) {
        const newText = parts
          .filter(p => p.type === "text" && typeof (p as unknown as { text: string }).text === "string")
          .map(p => (p as unknown as { text: string }).text)
          .join("");

        return {
          ...msg,
          parts,
          text: newText,
        };
      }

      return {
        ...msg,
        parts
      };
    }).map((msg) => {
      if (!msg.parts && typeof (msg as { text?: unknown }).text === "string") {
        const rawText = (msg as { text: string }).text;
        const cleaned = stripThinking(rawText).trimEnd();
        if (cleaned !== rawText) {
          return {
            ...msg,
            text: cleaned,
          };
        }
      }
      return msg;
    });
  }, [rawUiMessages, persistentFunctionCalls, stripThinking]);

  const streamingStatus = shouldSubscribe ? streamingHookResult.status : "Exhausted";
  const loadMoreMessages = streamingHookResult.loadMore;

  // Streaming mutation
  const initiateStreamingMutation = useMutation(
    apiAny.ai.streamingQueries.initiateStreaming
  );

  // Abort streaming mutation
  const abortStreamMutation = useMutation(apiAny.ai.streamingQueries.abortStream);

  // Mutations
  const clearThread = useMutation(apiAny.ai.threads.clearThreadForUser);

  // Check if any message is currently streaming
  const isStreaming = useMemo(() => {
    return (uiMessages ?? []).some((m) => m.status === "streaming");
  }, [uiMessages]);

  const chatIsLoading = shouldSubscribe && streamingStatus === "LoadingFirstPage";
  const uiMessagesLength = uiMessages?.length ?? 0;

  // Track whether streaming ever started or any UI message arrived for current send
  const hasStreamedRef = useRef(false);
  useEffect(() => {
    if (isStreaming || uiMessagesLength > 0) {
      hasStreamedRef.current = true;
    }
  }, [isStreaming, uiMessagesLength]);

  // Handle escape key to stop response
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isStreaming) {
        event.preventDefault();
        handleStopResponse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Actions
  const handleStopResponse = useCallback(async () => {
    if (threadId) {
      try {
        const result = await abortStreamMutation({ threadId });
        if (result.success) {
          toast.info("Response stopped");
        }
      } catch (error) {
        console.error("Failed to abort stream:", error);
        toast.error("Failed to stop response");
      }
    }
    setIsLoading(false);
  }, [threadId, abortStreamMutation]);

  const handleNewChat = useCallback(async () => {
    if (!threadId || !projectId || !userClerkId) return;

    try {
      // Clear the current thread messages, but keep the same thread ID context
      // Actually, clearThreadForUser deletes the thread record which might break the stable ID logic?
      // No, clearThreadForUser deletes aiThreads entry.
      // But getProjectThread will recreate it if missing.
      // So calling clearThreadForUser(threadId) then setting state to clean works.

      await clearThread({ threadId, projectId, userClerkId });

      // Re-fetch or re-create thread immediately to keep the UI valid
      const newId = await getThreadMutation({
        projectId,
        userClerkId,
      });

      setThreadIdWithSuppression(newId);
      toast.success("Conversation reset");
    } catch (e) {
      console.error("Failed to reset chat", e);
      toast.error("Failed to reset conversation");
    }
  }, [threadId, projectId, userClerkId, clearThread, getThreadMutation, setThreadIdWithSuppression]);

  // ===========================================
  // MAIN SEND MESSAGE HANDLER - Uses streaming mutation
  // ===========================================
  const handleSendMessage = useCallback(async (
    selectedFiles: File[],
    uploadedFileIds: string[],
    onUploadStart: () => void,
    onUploadComplete: (fileIds: string[]) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>,
    promptOverride?: string
  ) => {
    // Ensure we have a thread ID before sending
    let currentThreadId = threadId;
    if (!currentThreadId && projectId && userClerkId) {
      try {
        currentThreadId = await getThreadMutation({ projectId, userClerkId });
        setThreadId(currentThreadId);
      } catch (e) {
        console.error("Failed to get thread ID", e);
        toast.error("Failed to start conversation");
        return;
      }
    }

    const promptText = (promptOverride ?? "").trim();
    if (
      !projectId ||
      (!promptText && selectedFiles.length === 0) ||
      !userClerkId ||
      isLoading ||
      isStreaming ||
      isSendingRef.current
    ) {
      return;
    }

    isSendingRef.current = true;

    const userMessage = promptText;
    const hasFiles = selectedFiles.length > 0;

    setIsLoading(true);

    try {

      const currentFileIds: string[] = [...uploadedFileIds];
      const uploadedFilesInfo: Array<{ name: string; size: number; type: string; id: string }> = [];

      // Handle file uploads
      if (selectedFiles.length > 0) {
        onUploadStart();

        for (const file of selectedFiles) {
          const uploadData = await generateUploadUrl({
            projectId,
            fileName: file.name,
            origin: "ai",
          });

          const uploadResult = await fetch(uploadData.url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!uploadResult.ok) {
            throw new Error(`Upload failed for ${file.name}`);
          }

          const fileId = await addFile({
            projectId,
            fileKey: uploadData.key,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            origin: "ai",
          });

          currentFileIds.push(fileId);
          uploadedFilesInfo.push({
            name: file.name,
            size: file.size,
            type: file.type,
            id: fileId,
          });
        }

        onUploadComplete(currentFileIds);
      }

      // Build the prompt
      const prompt = hasFiles && !userMessage
        ? `📎 Attached: ${selectedFiles.map(f => f.name).join(", ")}`
        : userMessage;

      // Use the streaming mutation - this will trigger optimistic update
      // and the useUIMessages hook will receive real-time updates
      await initiateStreamingMutation({
        threadId: currentThreadId,
        projectId,
        prompt,
        fileIds: hasFiles ? (currentFileIds as Id<"files">[]) : undefined,
      });

      // isLoading will be turned off when streaming completes
      // The streaming status is tracked via isStreaming computed value

    } catch (error) {
      console.error("❌ [CLIENT] Error sending message:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Failed to send message: ${errorMessage}`);
      setIsLoading(false);
      throw error;
    } finally {
      isSendingRef.current = false;
    }
  }, [projectId, userClerkId, threadId, initiateStreamingMutation, isLoading, isStreaming, getThreadMutation]);

  // Turn off isLoading when streaming finishes
  useEffect(() => {
    if (!isStreaming && isLoading && hasStreamedRef.current) {
      // Small delay to ensure final content is rendered
      const timeout = setTimeout(() => {
        setIsLoading(false);
        hasStreamedRef.current = false;
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, isLoading]);

  return {
    isLoading: isLoading || isStreaming,
    threadId,
    isStreaming,
    chatIsLoading,

    // UIMessages from streaming
    uiMessages: uiMessages ?? [],
    streamingStatus: streamingStatus as "LoadingFirstPage" | "CanLoadMore" | "Exhausted",
    loadMoreMessages,

    // Actions
    handleSendMessage,
    handleStopResponse,
    handleNewChat,
  };

};

export default useAIChat;
