"use client";

/**
 * AI Assistant Component
 *
 * Main UI component for the AI Assistant feature.
 * Uses hooks from data layer and UI components from ui layer.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from "sonner";
import {
  Loader2,
  MessageSquare,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// AI Assistant - Data Layer
import { useChat } from "./data/hooks";
import { usePendingItems } from "./data/hooks";
import { type PendingContentItem, type ThreadListItem } from "./data/types";
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "./config";

// AI Assistant - UI Layer
import { MessageList } from "./ui/messages";
import { Sidebar } from "./ui";


// AI Assistant - Shared
import { AISubscriptionWall } from "@/components/ai/shared";

// AI Primitives
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai/primitives/prompt-input";

// External dependencies
import type { ChatStatus, FileUIPart } from "ai";
import type { UIMessage } from "@convex-dev/agent/react";

const AIAssistant = () => {
  const { user } = useUser();
  const { project, team } = useProject();
  const [pendingUserMessage, setPendingUserMessage] = useState<{
    text: string;
    attachments: Array<{
      name: string;
      size: number;
      type: string;
      previewUrl?: string;
    }>;
  } | null>(null);
  const [localMessages, setLocalMessages] = useState<UIMessage[]>([]);
  const [localMessageAttachments, setLocalMessageAttachments] = useState<Record<string, Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>>>({});
  const [isUploading, setIsUploading] = useState(false);
  const pendingAttachmentsRef = useRef<Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }> | null>(null);
  const pendingMessageCountRef = useRef<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const sessionParam = searchParams.get("session");
  const lastSessionParamRef = useRef<string | null>(null);
  const suppressSessionSyncRef = useRef(false);
  const suppressedSessionParamRef = useRef<string | null>(null);

  // Check if team has AI access
  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, team?._id ? { teamId: team._id } : "skip");

  // Mutations for file upload (passed to useAIChat)
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  // ==================== HOOKS ====================

  // Chat hook - manages messages, threads, and sending
  const {
    setChatHistory,
    isLoading,
    threadId,
    showHistory,
    setShowHistory,
    threadList,
    isThreadListLoading,
    hasThreads,
    chatIsLoading,
    handleSendMessage: sendMessageWithFile,
    handleStopResponse,

    handleNewChat,
    handleThreadSelect: selectThread,
    // Streaming-related
    uiMessages,
    isStreaming,
    messageMetadataByIndex,
  } = useChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  // Pending items hook - manages AI suggestions and confirmations
  const {
    pendingItems,
    setCurrentItemIndex,
    setIsConfirmationDialogOpen,
    setShowConfirmationGrid,
    isBulkProcessing,
    handleConfirmAll,
    handleConfirmItem,
    handleRejectItem,
    handleRejectAll,
    handleAutoRejectPendingItems,
    handleEditItem,
    handleUpdatePendingItem,
    resetPendingState,
  } = usePendingItems({
    projectId: project?._id,
    teamSlug: team?.slug,
    threadId,
    setChatHistory,
  });

  // ==================== HANDLERS ====================

  const updateSessionParam = useCallback((nextThreadId?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextThreadId) {
      params.set("session", nextThreadId);
    } else {
      params.delete("session");
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (suppressSessionSyncRef.current) {
      if (sessionParam !== suppressedSessionParamRef.current) {
        suppressSessionSyncRef.current = false;
        suppressedSessionParamRef.current = null;
        lastSessionParamRef.current = null;
      }
      return;
    }
    if (!sessionParam || sessionParam === threadId) return;
    if (lastSessionParamRef.current === sessionParam) return;
    lastSessionParamRef.current = sessionParam;
    selectThread(sessionParam);
    resetPendingState();
  }, [sessionParam, threadId, selectThread, resetPendingState]);

  useEffect(() => {
    if (!threadId) return;
    if (sessionParam === threadId) {
      lastSessionParamRef.current = threadId;
      return;
    }
    lastSessionParamRef.current = threadId;
    updateSessionParam(threadId);
  }, [threadId, sessionParam, updateSessionParam]);

  useEffect(() => {
    if (!pendingAttachmentsRef.current || uiMessages.length === 0) return;
    const lastUserMessage = [...uiMessages].reverse().find((msg) => msg.role === "user");
    if (!lastUserMessage || localMessageAttachments[lastUserMessage.key]) return;
    setLocalMessageAttachments((prev) => ({
      ...prev,
      [lastUserMessage.key]: pendingAttachmentsRef.current ?? [],
    }));
    pendingAttachmentsRef.current = null;
  }, [uiMessages, localMessageAttachments]);

  // Track previous threadId to detect thread switches (not new thread creation)
  const prevThreadIdRef = useRef<string | undefined>(threadId);

  useEffect(() => {
    // Only clear when switching to a DIFFERENT thread (not when setting initial threadId)
    const isThreadSwitch = prevThreadIdRef.current !== undefined &&
      prevThreadIdRef.current !== threadId;

    if (isThreadSwitch) {
      setLocalMessageAttachments((prev) => {
        Object.values(prev).flat().forEach((attachment) => {
          if (attachment.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
        });
        return {};
      });
      setPendingUserMessage(null);
      pendingMessageCountRef.current = null;
      setLocalMessages([]);
    }

    prevThreadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    if (!pendingUserMessage || pendingMessageCountRef.current === null) return;

    // Clear pending message when we have actual messages from streaming
    // Check if we have at least one more message AND if there's a new user message
    const hasNewMessages = uiMessages.length > pendingMessageCountRef.current;
    const lastMessage = uiMessages[uiMessages.length - 1];
    const hasUserMessage = lastMessage?.role === "user" ||
      (uiMessages.length > 0 &&
        uiMessages.some((msg, idx) => idx > pendingMessageCountRef.current! && msg.role === "user"));

    if (hasNewMessages && hasUserMessage) {
      // Use setTimeout to ensure smooth transition without visual gap
      const timeoutId = setTimeout(() => {
        setPendingUserMessage(null);
        pendingMessageCountRef.current = null;
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [uiMessages.length, uiMessages, pendingUserMessage]);

  const handleThreadSelect = (selectedThreadId: string) => {
    selectThread(selectedThreadId);
    resetPendingState();
  };

  const handleNewChatClick = () => {
    suppressSessionSyncRef.current = true;
    suppressedSessionParamRef.current = sessionParam;
    handleNewChat();
    resetPendingState();
    lastSessionParamRef.current = sessionParam;
    updateSessionParam(undefined);
  };



  const convertPromptFiles = async (files: FileUIPart[]) => {
    const uploadFiles: File[] = [];
    const attachments: Array<{
      name: string;
      size: number;
      type: string;
      previewUrl?: string;
    }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file.url) continue;

      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const name = file.filename || `attachment-${index + 1}`;
        const type = file.mediaType || blob.type || "application/octet-stream";
        const converted = new File([blob], name, { type });
        uploadFiles.push(converted);
        attachments.push({
          name: converted.name,
          size: converted.size,
          type: converted.type,
          previewUrl: converted.type.startsWith("image/") ? file.url : undefined,
        });
      } catch {
        continue;
      }
    }

    return { uploadFiles, attachments };
  };

  const handlePromptSubmit = async (payload: { text: string; files: FileUIPart[] }) => {
    const trimmedMessage = payload.text.trim();
    if (!trimmedMessage && payload.files.length === 0) {
      return;
    }

    if (pendingItems.some((item) => !item.status)) {
      const rejectedCount = await handleAutoRejectPendingItems();
      if (rejectedCount > 0) {
        // Silently rejected - no user notification needed per request
      }
    }

    const optimisticFileNames = payload.files.map((file, index) => (
      file.filename || `attachment-${index + 1}`
    ));
    const optimisticMessageText = trimmedMessage || (
      optimisticFileNames.length > 0 ? `📎 Attached: ${optimisticFileNames.join(", ")}` : ""
    );
    if (optimisticMessageText) {
      pendingMessageCountRef.current = uiMessages.length;
      const pendingMsg = {
        text: optimisticMessageText,
        attachments: payload.files.map((file, index) => ({
          name: file.filename || `attachment-${index + 1}`,
          size: 0,
          type: file.mediaType || "application/octet-stream",
          previewUrl: file.url,
        })),
      };
      setPendingUserMessage(pendingMsg);
    }

    const { uploadFiles, attachments } = await convertPromptFiles(payload.files);
    const fileLabel = uploadFiles.length > 0
      ? `📎 Attached: ${uploadFiles.map((file) => file.name).join(", ")}`
      : "";

    if (!trimmedMessage && uploadFiles.length === 0) {
      return;
    }

    pendingAttachmentsRef.current = attachments.length > 0 ? attachments : null;

    try {
      await sendMessageWithFile(
        uploadFiles,
        [],
        () => setIsUploading(true),
        () => setIsUploading(false),
        async (args) => {
          const result = await generateUploadUrl({
            projectId: args.projectId,
            fileName: args.fileName,
            origin: args.origin as "general" | "ai",
          });
          return { url: result.url, key: result.key };
        },
        addFile as (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>,
        trimmedMessage || fileLabel
      );
    } catch {
      setPendingUserMessage(null);
      pendingMessageCountRef.current = null;
    } finally {
      setIsUploading(false);
    }
  };

  const submitStatus = (isStreaming ? "streaming" : isLoading ? "submitted" : "ready") as ChatStatus;
  const allMessages = [...(uiMessages ?? []), ...localMessages];

  // Calculate if the pending message is now redundant because it appeared in uiMessages
  const hasNewMessages = pendingMessageCountRef.current !== null && uiMessages.length > pendingMessageCountRef.current;
  const effectivePendingUserMessage = hasNewMessages ? null : pendingUserMessage;

  // ==================== MAIN RENDER ====================

  const shouldShowChatLoading = chatIsLoading && uiMessages.length === 0 && !effectivePendingUserMessage;

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("wyczerpano")
    )
  );

  // Show limit block if quota exhausted, otherwise paywall if no access
  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (isQuotaBlocked) {
      const remainingTokens = aiAccess.remainingTokens ?? 0;

      return (
        <div className="flex min-h-screen items-center justify-center px-4 bg-background/50">
          <Card className="max-w-lg w-full border-border/50 shadow-2xl rounded-3xl overflow-hidden bg-card/80 backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-2">
              <Badge variant="secondary" className="w-fit bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-0 px-3 py-1 rounded-full">
                Tokens exhausted
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-display tracking-tight">No AI tokens available</CardTitle>
                <CardDescription className="text-base">{aiAccess.message}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Remaining tokens</span>
                  <span className="text-sm font-semibold text-foreground">
                    {remainingTokens.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                    style={{ width: "100%" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact your administrator to add more tokens.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  // Show loading state while checking access
  if (aiAccess === undefined && team?._id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  return (
    <PromptInputProvider>
      <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden md:flex-row-reverse">
        {/* Sidebar with chat history (desktop) */}
        <Sidebar
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          isThreadListLoading={isThreadListLoading}
          hasThreads={hasThreads}
          threadList={threadList as ThreadListItem[]}
          currentThreadId={threadId}
          onThreadSelect={handleThreadSelect}
          onNewChat={handleNewChatClick}
        />

        {/* Main conversation area */}
        <div className="relative flex flex-1 flex-col min-h-0">

          {/* Mobile header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 md:hidden z-20 bg-background/50 backdrop-blur sticky top-0">
            <Button onClick={handleNewChatClick} variant="ghost" size="icon" className="h-9 w-9 rounded-full -ml-2 text-muted-foreground hover:text-foreground">
              <Plus className="h-5 w-5" />
              <span className="sr-only">New chat</span>
            </Button>

            <span className="font-semibold text-sm">AI Assistant</span>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full -mr-2 text-muted-foreground hover:text-foreground">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle history</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
                <SheetHeader className="p-4 border-b border-border/50 text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Project chats
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-4">
                    <Button
                      onClick={() => {
                        handleNewChatClick();
                        // Close sheet logic would go here if controlled, but we rely on simple click for now
                      }}
                      className="w-full justify-start pl-3"
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Chat
                    </Button>
                  </div>
                  <Separator className="opacity-50" />
                  <ScrollArea className="flex-1">
                    {isThreadListLoading ? (
                      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <span className="text-xs">Loading history...</span>
                      </div>
                    ) : hasThreads ? (
                      <div className="flex flex-col p-2 gap-1">
                        {threadList.map((thread) => {
                          const isActive = thread.threadId === threadId;
                          const relativeTime = formatDistanceToNow(
                            new Date(thread.lastMessageAt ?? Date.now()),
                            { addSuffix: true }
                          );

                          return (
                            <SheetTrigger asChild key={thread.threadId}>
                              <Button
                                variant={isActive ? "secondary" : "ghost"}
                                className={cn(
                                  "w-full justify-start h-auto py-3 px-3 flex-col items-start gap-1",
                                  isActive ? "bg-secondary" : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => handleThreadSelect(thread.threadId)}
                              >
                                <div className="flex w-full justify-between items-baseline gap-2">
                                  <span className="font-medium text-sm truncate">{thread.title}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{relativeTime}</span>
                                </div>
                                <span className="text-xs text-muted-foreground line-clamp-1 text-left w-full font-normal opacity-90">
                                  {thread.lastMessagePreview || "No messages yet."}
                                </span>
                              </Button>
                            </SheetTrigger>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="bg-muted/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium">No chats yet</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Right side toolbar */}
          <div className="absolute right-6 top-6 hidden items-center gap-3 md:flex z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className="h-9 w-9 rounded-full border border-border bg-card shadow-md hover:bg-muted transition-all"
              title={showHistory ? "Zamknij historię czatów" : "Otwórz historię czatów"}
            >
              <span className="sr-only">Toggle chat history</span>
              <MessageSquare className="h-5 w-5" />
            </Button>

          </div>

          <div className="flex flex-1 min-h-0 flex-col">
            {shouldShowChatLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading conversation…
              </div>
            ) : (
              <MessageList
                messages={allMessages}
                status={submitStatus}
                pendingUserMessage={effectivePendingUserMessage}
                pendingItems={pendingItems as PendingContentItem[]}
                onConfirmItem={handleConfirmItem}
                onRejectItem={handleRejectItem}
                onEditItem={(idx) => {
                  handleEditItem(idx);
                  setShowConfirmationGrid(false);
                  setIsConfirmationDialogOpen(true);
                  const resolvedIndex =
                    typeof idx === "number"
                      ? idx
                      : pendingItems.findIndex((item) => item.functionCall?.callId === idx);
                  if (resolvedIndex >= 0) {
                    setCurrentItemIndex(resolvedIndex);
                  }
                }}
                onConfirmAll={handleConfirmAll}
                onRejectAll={handleRejectAll}
                onUpdateItem={handleUpdatePendingItem}
                isProcessing={isBulkProcessing}
                messageMetadataByIndex={messageMetadataByIndex}
                localMessageAttachments={localMessageAttachments}
              />
            )}

            <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background px-4 pb-4 pt-3">
              <div className="mx-auto w-full max-w-4xl">
                <PromptInput
                  accept={ACCEPTED_FILE_TYPES}
                  multiple
                  maxFiles={10}
                  maxFileSize={MAX_FILE_SIZE_BYTES}
                  onError={(err) => toast.error(err.message)}
                  onSubmit={handlePromptSubmit}
                >
                  <PromptInputBody>
                    <PromptInputAttachments>
                      {(file) => <PromptInputAttachment data={file} />}
                    </PromptInputAttachments>
                    <PromptInputTextarea
                      placeholder={isUploading ? "Uploading..." : "Send a message..."}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputActionMenu>
                        <PromptInputActionMenuTrigger />
                        <PromptInputActionMenuContent>
                          <PromptInputActionAddAttachments />
                        </PromptInputActionMenuContent>
                      </PromptInputActionMenu>
                    </PromptInputTools>
                    <PromptInputSubmit
                      status={submitStatus}
                      onStop={handleStopResponse}
                      disabled={isUploading}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Note: Confirmation dialogs removed - inline confirmations now handle all pending items display */
        /* Re-added ConfirmationDialog to support editing from inline items */
      }

    </PromptInputProvider>
  );
};

export default AIAssistant;
