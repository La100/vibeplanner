/**
 * useAIChat Hook
 * 
 * Manages chat state, message sending, and thread operations for the AI Assistant.
 * Uses Convex Agent's streaming hooks for real-time message updates.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatHistoryEntry, SessionTokens } from "./types";
import {
  optimisticallySendMessage,
  useUIMessages,
  type UIMessage,
} from "@convex-dev/agent/react";

interface UseAIChatProps {
  projectId: Id<"projects"> | undefined;
  userClerkId: string | undefined;
}

interface UseAIChatReturn {
  // State
  message: string;
  setMessage: (msg: string) => void;
  chatHistory: ChatHistoryEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryEntry[]>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  currentMode: "full" | "recent" | null;
  sessionTokens: SessionTokens;
  threadId: string | undefined;
  setThreadId: (id: string | undefined) => void;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  isStreaming: boolean;
  
  // Computed
  threadList: Array<{
    threadId: string;
    title: string;
    lastMessageAt?: number;
    lastMessagePreview?: string;
    lastMessageRole?: string;
    messageCount: number;
  }>;
  isThreadListLoading: boolean;
  hasThreads: boolean;
  showEmptyState: boolean;
  chatIsLoading: boolean;
  previousThreadsCount: number;
  mobileSelectValue: string;
  
  // UIMessages from streaming
  uiMessages: UIMessage[];
  streamingStatus: "LoadingFirstPage" | "CanLoadMore" | "Exhausted";
  loadMoreMessages: (numItems: number) => void;
  messageMetadataByIndex: Map<number, {
    fileId?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    mode?: string;
  }>;
  
  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  
  // Actions
  handleSendMessage: (
    selectedFiles: File[],
    uploadedFileIds: string[],
    onUploadStart: () => void,
    onUploadComplete: (fileIds: string[]) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>
  ) => Promise<void>;
  handleStopResponse: () => void;
  handleClearChat: () => Promise<void>;
  handleClearPreviousThreads: () => Promise<void>;
  handleNewChat: () => void;
  handleThreadSelect: (selectedThreadId: string) => void;
  handleQuickPromptClick: (prompt: string) => void;
  scrollToBottom: () => void;
}

/**
 * Convert UIMessage to ChatHistoryEntry format for backward compatibility
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function uiMessageToChatEntry(msg: UIMessage): ChatHistoryEntry {
  return {
    role: msg.role as "user" | "assistant",
    content: msg.text || "",
    status: msg.status as "streaming" | "finished" | "aborted" | undefined,
    messageIndex: msg.order,
  };
}

export const useAIChat = ({ projectId, userClerkId }: UseAIChatProps): UseAIChatReturn => {
  // State
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [initialThreadSelectionDone, setInitialThreadSelectionDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentMode, setCurrentMode] = useState<'full' | 'recent' | null>(null);
  const [sessionTokens, setSessionTokens] = useState<SessionTokens>({ total: 0, cost: 0 });
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  // ===========================================
  // STREAMING: Use useUIMessages from @convex-dev/agent/react
  // Only call when we have a threadId to avoid issues
  // ===========================================
  const streamingHookResult = useUIMessages(
    api.ai.streamingQueries.listThreadMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 50, stream: true }
  );
  
  // Extract results safely - only when threadId exists
  const uiMessages = threadId ? streamingHookResult.results : undefined;
  const streamingStatus = threadId ? streamingHookResult.status : "Exhausted";
  const loadMoreMessages = streamingHookResult.loadMore;

  // Streaming mutation with optimistic updates
  const initiateStreamingMutation = useMutation(
    api.ai.streamingQueries.initiateStreaming
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.ai.streamingQueries.listThreadMessages)
  );

  // Abort streaming mutation
  const abortStreamMutation = useMutation(api.ai.streamingQueries.abortStream);

  // ===========================================
  // Legacy queries for thread list and persisted messages
  // ===========================================
  const userThreads = useQuery(
    api.ai.threads.listThreadsForUser,
    projectId && userClerkId
      ? { projectId, userClerkId }
      : "skip"
  );
  
  const persistedMessages = useQuery(
    api.ai.threads.listThreadMessages,
    projectId && threadId && userClerkId
      ? { threadId, projectId, userClerkId }
      : "skip"
  );

  // Mutations
  const clearThread = useMutation(api.ai.threads.clearThreadForUser);
  const clearPreviousThreads = useMutation(api.ai.threads.clearPreviousThreadsForUser);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const createThread = useMutation(api.ai.threads.getOrCreateThreadPublic);

  // Computed values
  const threadList = userThreads ?? [];
  const isThreadListLoading = userThreads === undefined;
  const hasThreads = threadList.length > 0;
  const previousThreadsCount = threadList.filter(t => t.threadId !== threadId).length;
  const mobileSelectValue = threadId ?? "";

  // Check if any message is currently streaming
  const isStreaming = useMemo(() => {
    return (uiMessages ?? []).some((m) => m.status === "streaming");
  }, [uiMessages]);

  // Determine if we should show empty state - only use uiMessages, not chatHistory to avoid loops
  const showEmptyState = useMemo(() => {
    const hasUIMessages = (uiMessages ?? []).length > 0;
    return !hasUIMessages && !isLoading && !isStreaming;
  }, [uiMessages, isLoading, isStreaming]);

  const chatIsLoading = Boolean(threadId) && persistedMessages === undefined;
  const messageMetadataByIndex = useMemo(() => {
    const map = new Map<number, {
      fileId?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
      mode?: string;
    }>();
    (persistedMessages ?? []).forEach((msg) => {
      if (msg.metadata) {
        map.set(msg.messageIndex, msg.metadata);
      }
    });
    return map;
  }, [persistedMessages]);

  // ===========================================
  // Sync persisted messages to chatHistory (only when no UIMessages)
  // This is for backward compatibility with threads that existed before streaming
  // ===========================================
  
  // Use ref to track previous state for comparison without causing infinite loops
  const prevPersistedLengthRef = useRef<number>(0);
  const prevChatHistoryLengthRef = useRef<number>(0);
  
  useEffect(() => {
    // Skip if we have UIMessages (streaming is active/has data)
    if (uiMessages && uiMessages.length > 0) return;
    
    const persistedLength = persistedMessages?.length ?? 0;
    
    if (persistedLength === 0) {
      // Clear chat history if no messages and we had some before
      if (prevChatHistoryLengthRef.current > 0) {
        setChatHistory([]);
        prevChatHistoryLengthRef.current = 0;
      }
      prevPersistedLengthRef.current = 0;
      return;
    }

    // Only update if persisted messages actually changed
    if (persistedLength === prevPersistedLengthRef.current) {
      return;
    }
    
    const historyFromSaved: ChatHistoryEntry[] = persistedMessages!.map((msg) => ({
      role: msg.role,
      content: msg.content,
      mode: msg.metadata?.mode as 'full' | 'recent' | undefined,
      messageIndex: msg.messageIndex,
      tokenUsage: msg.tokenUsage,
    }));

    setChatHistory(historyFromSaved);
    prevPersistedLengthRef.current = persistedLength;
    prevChatHistoryLengthRef.current = historyFromSaved.length;
  }, [persistedMessages, uiMessages, setChatHistory]);

  // Initial thread selection
  useEffect(() => {
    if (!initialThreadSelectionDone) {
      setInitialThreadSelectionDone(true);
    }
  }, [initialThreadSelectionDone]);

  // Calculate session token totals
  useEffect(() => {
    if (!persistedMessages) return;

    const totals = persistedMessages.reduce(
      (acc, entry) => {
        if (entry.role === "assistant" && entry.tokenUsage) {
          acc.total += entry.tokenUsage.totalTokens;
          acc.cost += entry.tokenUsage.estimatedCostUSD;
        }
        return acc;
      },
      { total: 0, cost: 0 }
    );

    setSessionTokens(totals);
  }, [persistedMessages]);

  // Update current mode from chat history (only when chatHistory changes)
  useEffect(() => {
    if (chatHistory.length === 0) {
      setCurrentMode(null);
      return;
    }

    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const entry = chatHistory[i];
      if (entry.role === "assistant" && entry.mode) {
        setCurrentMode(entry.mode);
        return;
      }
    }
  }, [chatHistory]); // Only depend on chatHistory

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 240;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  // Scroll to bottom on new messages
  // Use a ref to track last scroll to avoid excessive scrolling
  const lastScrollRef = useRef(0);
  const uiMessagesLength = uiMessages?.length ?? 0;
  
  useEffect(() => {
    // Only scroll when messages count changes, not during streaming updates
    if (uiMessagesLength > lastScrollRef.current) {
      lastScrollRef.current = uiMessagesLength;
      // Use setTimeout to defer scroll and avoid render loop
      const timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [uiMessagesLength]);

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
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

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

  const handleThreadSelect = useCallback((selectedThreadId: string) => {
    if (selectedThreadId === threadId) {
      return;
    }
    setInitialThreadSelectionDone(true);
    setThreadId(selectedThreadId);
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, [threadId]);

  const handleNewChat = useCallback(() => {
    setThreadId(undefined);
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, []);

  const handleClearChat = useCallback(async () => {
    if (!threadId || !projectId || !userClerkId) return;

    try {
      await clearThread({ threadId, projectId, userClerkId });
      setChatHistory([]);
      setSessionTokens({ total: 0, cost: 0 });
      setCurrentMode(null);
      // Reset threadId to start fresh - this forces useUIMessages to skip
      // and clears any cached/stale streaming data from the agent SDK
      setThreadId(undefined);
      toast.success("Chat cleared");
    } catch (error) {
      console.error("Failed to clear chat:", error);
      toast.error("Failed to clear chat");
    }
  }, [threadId, projectId, userClerkId, clearThread]);

  const handleClearPreviousThreads = useCallback(async () => {
    if (!projectId || !userClerkId) return;

    try {
      const result = await clearPreviousThreads({
        projectId,
        userClerkId,
        keepThreadId: threadId,
      });
      toast.success(`Cleared ${result.removedThreads} previous chat${result.removedThreads === 1 ? '' : 's'}`);
    } catch (error) {
      console.error("Failed to clear previous threads:", error);
      toast.error("Failed to clear previous chats");
    }
  }, [projectId, userClerkId, threadId, clearPreviousThreads]);

  const handleQuickPromptClick = useCallback((prompt: string) => {
    setMessage(prompt);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ===========================================
  // MAIN SEND MESSAGE HANDLER - Uses streaming mutation
  // ===========================================
  const handleSendMessage = useCallback(async (
    selectedFiles: File[],
    uploadedFileIds: string[],
    onUploadStart: () => void,
    onUploadComplete: (fileIds: string[]) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>
  ) => {
    if (
      !projectId ||
      (!message.trim() && selectedFiles.length === 0) ||
      !userClerkId ||
      isLoading ||
      isStreaming ||
      isSendingRef.current
    ) {
      return;
    }

    isSendingRef.current = true;

    const userMessage = message.trim();
    let currentThreadId = threadId;
    const hasFiles = selectedFiles.length > 0;

    setIsLoading(true);

    try {
      // Generate threadId if needed
      if (!currentThreadId) {
        currentThreadId = `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        setThreadId(currentThreadId);
      }

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

      // Clear message immediately for better UX
      setMessage("");

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
      console.error("Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast.error(`Failed to send message: ${errorMessage}`);
      setIsLoading(false);
    } finally {
      isSendingRef.current = false;
    }
  }, [projectId, userClerkId, message, threadId, initiateStreamingMutation, isLoading, isStreaming]);

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
    // State
    message,
    setMessage,
    chatHistory,
    setChatHistory,
    isLoading: isLoading || isStreaming,
    setIsLoading,
    currentMode,
    sessionTokens,
    threadId,
    setThreadId,
    showHistory,
    setShowHistory,
    isStreaming,
    
    // Computed
    threadList,
    isThreadListLoading,
    hasThreads,
    showEmptyState,
    chatIsLoading,
    previousThreadsCount,
    mobileSelectValue,
    
    // UIMessages from streaming
    uiMessages: uiMessages ?? [],
    streamingStatus: streamingStatus as "LoadingFirstPage" | "CanLoadMore" | "Exhausted",
    loadMoreMessages,
    messageMetadataByIndex,
    
    // Refs
    messagesEndRef,
    inputRef,
    abortControllerRef,
    
    // Actions
    handleSendMessage,
    handleStopResponse,
    handleClearChat,
    handleClearPreviousThreads,
    handleNewChat,
    handleThreadSelect,
    handleQuickPromptClick,
    scrollToBottom,
  };
};

export default useAIChat;
