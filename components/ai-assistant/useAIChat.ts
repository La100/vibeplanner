/**
 * useAIChat Hook
 * 
 * Manages chat state, message sending, and thread operations for the AI Assistant.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatHistoryEntry, SessionTokens } from "./types";
import { computeNextMessageIndex } from "./utils";

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
  
  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  
  // Actions
  handleSendMessage: (
    selectedFile: File | null,
    uploadedFileId: string | null,
    onUploadStart: () => void,
    onUploadComplete: (fileId: string) => void,
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

  // Queries
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

  const savedMessages = useQuery(
    api.ai.threads.listThreadMessages,
    threadId && projectId && userClerkId 
      ? { threadId, projectId, userClerkId } 
      : "skip"
  );

  // Mutations
  const clearThread = useMutation(api.ai.threads.clearThreadForUser);
  const clearPreviousThreads = useMutation(api.ai.threads.clearPreviousThreadsForUser);
  const createThread = useMutation(api.ai.threads.getOrCreateThreadPublic);

  // Computed values
  const threadList = userThreads ?? [];
  const isThreadListLoading = userThreads === undefined;
  const hasThreads = threadList.length > 0;
  const showEmptyState = chatHistory.length === 0 && !isLoading;
  const chatIsLoading = Boolean(threadId) && persistedMessages === undefined;
  const previousThreadsCount = threadList.filter(t => t.threadId !== threadId).length;
  const mobileSelectValue = threadId ?? "";

  // Load saved messages into chat history
  useEffect(() => {
    if (!savedMessages || savedMessages.length === 0) return;

    const historyFromSaved: ChatHistoryEntry[] = savedMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      mode: msg.metadata?.mode as 'full' | 'recent' | undefined,
      messageIndex: msg.messageIndex,
      tokenUsage: msg.tokenUsage,
    }));

    setChatHistory((prev) => {
      const hasMoreMessages = historyFromSaved.length > prev.length;
      if (hasMoreMessages) {
        return historyFromSaved;
      }

      const lastSaved = historyFromSaved[historyFromSaved.length - 1];
      const lastLocal = prev[prev.length - 1];
      if (lastSaved && lastLocal && lastSaved.content !== lastLocal.content) {
        return historyFromSaved;
      }

      return prev;
    });
  }, [savedMessages]);

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

  // Update current mode from chat history
  useEffect(() => {
    if (chatHistory.length === 0) {
      if (currentMode !== null) {
        setCurrentMode(null);
      }
      return;
    }

    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const entry = chatHistory[i];
      if (entry.role === "assistant" && entry.mode) {
        if (entry.mode !== currentMode) {
          setCurrentMode(entry.mode);
        }
        return;
      }
    }
  }, [chatHistory, currentMode]);

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
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isLoading]);

  // Handle escape key to stop response
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && abortControllerRef.current) {
        event.preventDefault();
        abortControllerRef.current.abort();
        setIsLoading(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Actions
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleStopResponse = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const handleThreadSelect = useCallback((selectedThreadId: string) => {
    if (selectedThreadId === threadId) {
      return;
    }
    handleStopResponse();
    setInitialThreadSelectionDone(true);
    setThreadId(selectedThreadId);
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, [threadId, handleStopResponse]);

  const handleNewChat = useCallback(() => {
    handleStopResponse();
    setThreadId(undefined);
    setChatHistory([]);
    setMessage("");
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
  }, [handleStopResponse]);

  const handleClearChat = useCallback(async () => {
    if (!threadId || !projectId || !userClerkId) return;

    try {
      await clearThread({ threadId, projectId, userClerkId });
      setChatHistory([]);
      setSessionTokens({ total: 0, cost: 0 });
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

  const handleSendMessage = useCallback(async (
    selectedFile: File | null,
    uploadedFileId: string | null,
    onUploadStart: () => void,
    onUploadComplete: (fileId: string) => void,
    generateUploadUrl: (args: { projectId: Id<"projects">; fileName: string; origin: string }) => Promise<{ url: string; key: string }>,
    addFile: (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>
  ) => {
    if (!projectId || (!message.trim() && !selectedFile) || !userClerkId) return;

    const userMessage = message.trim();
    let currentThreadId = threadId;
    const hadFile = Boolean(selectedFile);

    setIsLoading(true);

    try {
      // Create thread if needed
      if (!currentThreadId) {
        currentThreadId = await createThread({
          projectId,
          userClerkId,
        });
        setThreadId(currentThreadId);
      }

      let currentFileId = uploadedFileId;

      // Handle file upload
      if (selectedFile) {
        onUploadStart();
        const uploadData = await generateUploadUrl({
          projectId,
          fileName: selectedFile.name,
          origin: "ai",
        });

        const uploadResult = await fetch(uploadData.url, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });

        if (!uploadResult.ok) {
          throw new Error("Upload failed");
        }

        const fileId = await addFile({
          projectId,
          fileKey: uploadData.key,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          origin: "ai",
        });

        currentFileId = fileId;
        onUploadComplete(fileId);

        const userContent = userMessage || `📎 Attached: ${selectedFile.name}`;
        setChatHistory((prev) => {
          const nextIndex = computeNextMessageIndex(prev);
          return [
            ...prev,
            {
              role: "user",
              content: userContent,
              messageIndex: nextIndex,
              fileInfo: {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
                id: fileId,
              },
            },
          ];
        });
        setMessage("");
      } else {
        setChatHistory((prev) => {
          const nextIndex = computeNextMessageIndex(prev);
          return [...prev, { role: "user", content: userMessage, messageIndex: nextIndex }];
        });
        setMessage("");
      }

      // Add placeholder for assistant response
      setChatHistory((prev) => {
        const nextIndex = computeNextMessageIndex(prev);
        return [...prev, { role: "assistant", content: "Thinking...", mode: currentMode ?? undefined, messageIndex: nextIndex }];
      });

      abortControllerRef.current = new AbortController();

      // Send request
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          projectId,
          userClerkId,
          threadId: currentThreadId,
          fileId: hadFile ? currentFileId ?? undefined : undefined,
        }),
        signal: abortControllerRef.current!.signal,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to get response");
      }

      // Update thread ID if needed
      if (result.threadId && result.threadId !== currentThreadId) {
        setThreadId(result.threadId);
      }

      // Update chat history with the response
      setChatHistory((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex]?.role === "assistant") {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: result.response || "Done.",
            tokenUsage: result.tokenUsage,
          };
        }
        return updated;
      });

    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatHistory((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === "assistant") {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: "Response stopped.",
            };
          }
          return updated;
        });
      } else {
        console.error("Error sending message:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setChatHistory((prev) => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (updated[lastIndex]?.role === "assistant") {
            updated[lastIndex] = {
              ...updated[lastIndex],
              content: `Sorry, I encountered an error: ${errorMessage}`,
            };
          }
          return updated;
        });
        toast.error("Failed to send message");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [projectId, userClerkId, message, threadId, currentMode, createThread]);

  return {
    // State
    message,
    setMessage,
    chatHistory,
    setChatHistory,
    isLoading,
    setIsLoading,
    currentMode,
    sessionTokens,
    threadId,
    setThreadId,
    showHistory,
    setShowHistory,
    
    // Computed
    threadList,
    isThreadListLoading,
    hasThreads,
    showEmptyState,
    chatIsLoading,
    previousThreadsCount,
    mobileSelectValue,
    
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








