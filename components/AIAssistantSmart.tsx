"use client";

/**
 * AI Assistant Smart Component
 * 
 * Main UI component for the AI Assistant feature.
 * Business logic is extracted to hooks in components/ai-assistant/hooks/
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
  RefreshCcw,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type PendingContentItem } from "@/components/AIConfirmationGrid";
import { AISubscriptionWall } from "@/components/AISubscriptionWall";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";

// Import from reorganized modules
import { useAIChat } from "@/components/ai-assistant/useAIChat";
import { usePendingItems } from "@/components/ai-assistant/usePendingItems";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/components/ai-assistant/constants";
import type { PendingItem } from "@/components/ai-assistant/types";
import { WorkflowWizard } from "@/components/ai-assistant/WorkflowWizard";
import { ChatSidebar, type ThreadListItem } from "@/components/ai-assistant/ChatSidebar";
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
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import type { ChatStatus, FileUIPart } from "ai";
import type { UIMessage } from "@convex-dev/agent/react";
import { getWorkflow, getWorkflowStep } from "@/convex/ai/workflows/loader";
import { createWorkflowContextSection } from "@/convex/ai/helpers/workflowContextBuilder";
import { Messages } from "@/components/ai-chatbot/messages";

const UPDATE_KEYWORDS = [
  "assign",
  "przypisz",
  "do mnie",
  "ustaw",
  "termin",
  "deadline",
  "due",
  "priorytet",
  "priority",
  "tag",
];

const CREATE_KEYWORDS = [
  "dodaj",
  "utworz",
  "stworz",
  "create",
  "add",
  "nowy",
  "kolejny",
  "another",
  "next",
];

const isTaskCreatePending = (item: PendingItem): boolean => {
  const type = item.type;
  const operation = item.operation ?? (type === "create_task" ? "create" : undefined);
  return (type === "task" || type === "create_task") && operation === "create";
};

const shouldKeepPendingItemsForFollowup = (message: string, items: PendingItem[]): boolean => {
  if (!message) return false;
  const unresolvedItems = items.filter((item) => !item.status);
  if (unresolvedItems.length !== 1) return false;
  if (!isTaskCreatePending(unresolvedItems[0])) return false;

  const lower = message.toLowerCase();
  const hasUpdateKeyword = UPDATE_KEYWORDS.some((keyword) => lower.includes(keyword));
  const hasCreateKeyword = CREATE_KEYWORDS.some((keyword) => lower.includes(keyword));
  return hasUpdateKeyword && !hasCreateKeyword;
};

const AIAssistantSmart = () => {
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

  // Workflow wizard state
  const [showWorkflowWizard, setShowWorkflowWizard] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<{
    workflowId: string;
    currentStepId: string;
    previousResponses: Record<string, string>;
  } | null>(null);

  // Check if team has AI access
  const aiAccess = useQuery(apiAny.stripe.checkTeamAIAccess, team?._id ? { teamId: team._id } : "skip");

  // Mutations for file upload (passed to useAIChat)
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  // ==================== HOOKS ====================

  // Chat hook - manages messages, threads, and sending
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    chatHistory,
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
    handleClearChat,
    handleNewChat,
    handleThreadSelect: selectThread,
    // Streaming-related
    uiMessages,
    isStreaming,
    messageMetadataByIndex,
  } = useAIChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  // Pending items hook - manages AI suggestions and confirmations
  const {
    pendingItems,
    currentItemIndex,
    setCurrentItemIndex,
    isConfirmationDialogOpen,
    setIsConfirmationDialogOpen,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    showConfirmationGrid,
    setShowConfirmationGrid,
    isCreatingContent,
    isBulkProcessing,
    handleContentConfirm,
    handleContentCancel,
    handleContentEdit,
    handleContentDialogClose,
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

  useEffect(() => {
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
  }, [threadId]);

  useEffect(() => {
    if (!pendingUserMessage || pendingMessageCountRef.current === null) return;
    if (uiMessages.length > pendingMessageCountRef.current) {
      setPendingUserMessage(null);
      pendingMessageCountRef.current = null;
    }
  }, [uiMessages.length, pendingUserMessage]);

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

  const handleClearChatClick = async () => {
    suppressSessionSyncRef.current = true;
    suppressedSessionParamRef.current = sessionParam;
    await handleClearChat();
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

    const shouldKeepPendingItems = shouldKeepPendingItemsForFollowup(trimmedMessage, pendingItems);
    if (pendingItems.some((item) => !item.status) && !shouldKeepPendingItems) {
      const rejectedCount = await handleAutoRejectPendingItems();
      if (rejectedCount > 0) {
        const messageText = `❌ Odrzucono ${rejectedCount} propozycj${rejectedCount === 1 ? "e" : "i"} automatycznie po wyslaniu nowej wiadomosci.`;
        const timestamp = Date.now();
        setLocalMessages((prev) => [
          ...prev,
          {
            id: `local-auto-reject-${timestamp}`,
            key: `local-auto-reject-${timestamp}`,
            role: "assistant",
            content: messageText,
            text: messageText,
            parts: [{ type: "text", text: messageText }],
            order: (uiMessages?.length ?? 0) + prev.length,
            stepOrder: (uiMessages?.length ?? 0) + prev.length,
            status: "success",
            _creationTime: timestamp,
          } as UIMessage,
        ]);
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
      setPendingUserMessage({
        text: optimisticMessageText,
        attachments: payload.files.map((file, index) => ({
          name: file.filename || `attachment-${index + 1}`,
          size: 0,
          type: file.mediaType || "application/octet-stream",
          previewUrl: file.url,
        })),
      });
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

  // ==================== WORKFLOW HANDLERS ====================

  const handleStartWorkflow = async (workflowId: string, stepId: string, hasFile: boolean) => {
    const workflow = getWorkflow(workflowId);
    const step = getWorkflowStep(workflowId, stepId);

    if (!workflow || !step) return;

    // Set active workflow state
    setActiveWorkflow({
      workflowId,
      currentStepId: stepId,
      previousResponses: {},
    });

    // If step has a prompt, send it as a message
    if (step.prompt) {
      // Build workflow context (used for debugging purposes)
      createWorkflowContextSection(
        workflowId,
        stepId,
        {},
        hasFile
      );

      // Create the message with workflow context prefix
      const workflowMessage = `[WORKFLOW: ${workflow.name} - ${step.name}]\n\n${step.prompt}`;

      await handlePromptSubmit({ text: workflowMessage, files: [] });
    }

    // Close wizard panel after starting (keeps workflow active)
    setShowWorkflowWizard(false);
  };

  const handleWorkflowStepChange = (stepId: string) => {
    if (!activeWorkflow) return;

    setActiveWorkflow(prev => prev ? {
      ...prev,
      currentStepId: stepId,
    } : null);
  };

  const handleCloseWorkflow = () => {
    setShowWorkflowWizard(false);
    setActiveWorkflow(null);
  };

  // ==================== RENDER HELPERS ====================

  const WorkflowWizardPanel = () => {
    const controller = usePromptInputController();

    return (
      <Sheet open={showWorkflowWizard} onOpenChange={setShowWorkflowWizard}>
        <SheetContent side="right" className="w-full sm:w-[450px] p-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Renovation Workflow</SheetTitle>
          </SheetHeader>
          <WorkflowWizard
            onStartWorkflow={handleStartWorkflow}
            onStepChange={handleWorkflowStepChange}
            onClose={handleCloseWorkflow}
            uploadedFileIds={[]}
            hasUploadedFile={controller.attachments.files.length > 0}
            onFileUploadRequest={controller.attachments.openFileDialog}
            isAIResponding={isLoading || isStreaming}
          />
        </SheetContent>
      </Sheet>
    );
  };

  const submitStatus = (isStreaming ? "streaming" : isLoading ? "submitted" : "ready") as ChatStatus;
  const allMessages = [...(uiMessages ?? []), ...localMessages];

  // ==================== MAIN RENDER ====================

  const shouldShowChatLoading = chatIsLoading && uiMessages.length === 0;

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
        <ChatSidebar
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
            {threadId && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearChatClick}
                className="h-10 w-10 rounded-full"
                title="Wyczyść bieżącą rozmowę"
              >
                <span className="sr-only">Clear chat</span>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-1 min-h-0 flex-col">
            {shouldShowChatLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading conversation…
              </div>
            ) : (
              <Messages
                messages={allMessages}
                status={submitStatus}
                pendingUserMessage={pendingUserMessage}
                pendingItems={pendingItems as PendingContentItem[]}
                onConfirmItem={handleConfirmItem}
                onRejectItem={handleRejectItem}
                onEditItem={(idx) => {
                  handleEditItem(idx);
                  setShowConfirmationGrid(false);
                  setIsConfirmationDialogOpen(true);
                  setCurrentItemIndex(idx);
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
        /* Re-added UniversalConfirmationDialog to support editing from inline items */
        pendingItems[currentItemIndex] && (
          <UniversalConfirmationDialog
            isOpen={isConfirmationDialogOpen}
            onClose={handleContentDialogClose}
            onConfirm={handleContentConfirm}
            onCancel={handleContentCancel}
            onEdit={handleContentEdit}
            contentItem={pendingItems[currentItemIndex]}
            isLoading={isCreatingContent}
            itemNumber={currentItemIndex + 1}
            totalItems={pendingItems.length}
          />
        )}

      <WorkflowWizardPanel />
    </PromptInputProvider>
  );
};

export default AIAssistantSmart;
