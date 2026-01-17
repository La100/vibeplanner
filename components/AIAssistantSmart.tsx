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
import {
  Loader2,
  MessageSquare,
  Sparkles,
  RefreshCcw,
  Plus,
  ChevronDown,
  Workflow
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { useFileUpload } from "@/components/ai-assistant/useFileUpload";
import { QUICK_PROMPTS } from "@/components/ai-assistant/constants";
import { WorkflowWizard } from "@/components/ai-assistant/WorkflowWizard";
import { ChatSidebar, type ThreadListItem } from "@/components/ai-assistant/ChatSidebar";
import { ChatInputVercel } from "@/components/ai-assistant/ChatInputVercel";
import { ChatMessageList } from "@/components/ai-assistant/ChatMessageList";
import { SuggestedActions } from "@/components/ai-assistant/SuggestedActions";
import { ThinkingIndicator } from "@/components/ai-assistant/ThinkingIndicator";
import { getWorkflow, getWorkflowStep } from "@/convex/ai/workflows/loader";
import { createWorkflowContextSection } from "@/convex/ai/helpers/workflowContextBuilder";

const AIAssistantSmart = () => {
  const { user } = useUser();
  const { project, team } = useProject();
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const pendingUserMessageUserCountRef = useRef<number | null>(null);
  const [localMessageAttachments, setLocalMessageAttachments] = useState<Record<string, Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }>>>({});
  const pendingAttachmentsRef = useRef<Array<{
    name: string;
    size: number;
    type: string;
    previewUrl?: string;
  }> | null>(null);
  const attachmentUrlsRef = useRef<Set<string>>(new Set());
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

  // File input ref (shared between upload hook and component)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations for file upload (passed to useAIChat)
  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  // ==================== HOOKS ====================

  // Chat hook - manages messages, threads, and sending
  const {
    message,
    setMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    chatHistory,
    setChatHistory,
    isLoading,
    setIsLoading,
    threadId,
    showHistory,
    setShowHistory,
    threadList,
    isThreadListLoading,
    hasThreads,
    showEmptyState,
    chatIsLoading,
    messagesEndRef,
    inputRef,
    handleSendMessage: sendMessageWithFile,
    handleStopResponse,
    handleClearChat,
    handleNewChat,
    handleThreadSelect: selectThread,
    handleQuickPromptClick,
    // Streaming-related
    uiMessages,
    isStreaming,
    messageMetadataByIndex,
  } = useAIChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  // File upload hook
  const {
    selectedFiles,
    setSelectedFiles,
    uploadedFileIds,
    isUploading,
    handleFileSelect,
    handleRemoveFile,
  } = useFileUpload();

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
    setSelectedFiles([]);
  }, [sessionParam, threadId, selectThread, resetPendingState, setSelectedFiles]);

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
    if (!pendingUserMessage) {
      pendingUserMessageUserCountRef.current = null;
      return;
    }
    const userMessages = uiMessages.filter((msg) => msg.role === "user");
    if (pendingUserMessageUserCountRef.current === null) {
      pendingUserMessageUserCountRef.current = userMessages.length;
      return;
    }
    if (userMessages.length <= pendingUserMessageUserCountRef.current) return;
    const lastUserMessage = [...uiMessages].reverse().find((msg) => msg.role === "user");
    if (!lastUserMessage?.text) return;
    if (lastUserMessage.text.trim() === pendingUserMessage.trim()) {
      setPendingUserMessage(null);
    }
  }, [uiMessages, pendingUserMessage]);

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
    const urlsRef = attachmentUrlsRef.current;
    return () => {
      urlsRef.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.clear();
    };
  }, []);

  useEffect(() => {
    setLocalMessageAttachments((prev) => {
      Object.values(prev).flat().forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
          attachmentUrlsRef.current.delete(attachment.previewUrl);
        }
      });
      return {};
    });
  }, [threadId]);

  const handleThreadSelect = (selectedThreadId: string) => {
    selectThread(selectedThreadId);
    resetPendingState();
    setSelectedFiles([]);
    setPendingUserMessage(null);
    setHasSentMessage(true);
  };

  const handleNewChatClick = () => {
    suppressSessionSyncRef.current = true;
    suppressedSessionParamRef.current = sessionParam;
    handleNewChat();
    resetPendingState();
    setSelectedFiles([]);
    setPendingUserMessage(null);
    setHasSentMessage(false);
    lastSessionParamRef.current = sessionParam;
    updateSessionParam(undefined);
  };

  const handleClearChatClick = async () => {
    suppressSessionSyncRef.current = true;
    suppressedSessionParamRef.current = sessionParam;
    await handleClearChat();
    setPendingUserMessage(null);
    setHasSentMessage(false);
    lastSessionParamRef.current = sessionParam;
    updateSessionParam(undefined);
  };

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    const fileLabel = selectedFiles.length > 0
      ? `📎 Attached: ${selectedFiles.map((file) => file.name).join(", ")}`
      : "";
    if (selectedFiles.length > 0) {
      const attachments = selectedFiles.map((file) => {
        const isImage = file.type.startsWith("image/");
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
        if (previewUrl) {
          attachmentUrlsRef.current.add(previewUrl);
        }
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
        };
      });
      pendingAttachmentsRef.current = attachments;
    } else {
      pendingAttachmentsRef.current = null;
    }
    // Set both states immediately to prevent flashing
    setPendingUserMessage(trimmedMessage || fileLabel || null);
    pendingUserMessageUserCountRef.current = uiMessages.filter((msg) => msg.role === "user").length;
    setHasSentMessage(true);
    setIsLoading(true);

    await sendMessageWithFile(
      selectedFiles,
      uploadedFileIds,
      () => {}, // Loading already set above
      () => {
        setSelectedFiles([]);
      },
      async (args) => {
        const result = await generateUploadUrl({
          projectId: args.projectId,
          fileName: args.fileName,
          origin: args.origin as "general" | "ai",
        });
        return { url: result.url, key: result.key };
      },
      addFile as (args: { projectId: Id<"projects">; fileKey: string; fileName: string; fileType: string; fileSize: number; origin: string }) => Promise<string>
    );
    setSelectedFiles([]);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
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
        hasFile || selectedFiles.length > 0
      );

      // Create the message with workflow context prefix
      const workflowMessage = `[WORKFLOW: ${workflow.name} - ${step.name}]\n\n${step.prompt}`;

      setMessage(workflowMessage);

      // Trigger send
      setTimeout(() => {
        handleSendMessage();
      }, 100);
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

  const renderInputArea = () => (
    <>
      {/* Suggested actions - shown only on empty state */}
      {shouldShowEmptyState && selectedFiles.length === 0 && (
        <div className="mb-4">
          <SuggestedActions
            onSuggestionClick={handleQuickPromptClick}
            suggestions={QUICK_PROMPTS.slice(0, 4)}
          />
        </div>
      )}

      <ChatInputVercel
        message={message}
        setMessage={setMessage}
        selectedFiles={selectedFiles}
        isLoading={isLoading}
        isUploading={isUploading}
        inputRef={inputRef}
        fileInputRef={fileInputRef}
        onSendMessage={handleSendMessage}
        onStopResponse={handleStopResponse}
        onFileSelect={handleFileSelect}
        onRemoveFile={handleRemoveFile}
        onAttachmentClick={handleAttachmentClick}
        onPasteFiles={(files) => {
          // Handle pasted files by simulating file input change
          const event = {
            target: {
              files: files,
            },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleFileSelect(event);
        }}
      />
    </>
  );

  // ==================== MAIN RENDER ====================

  const shouldShowEmptyState = showEmptyState && !pendingUserMessage && !hasSentMessage && !isLoading && !isStreaming;
  const shouldShowChatLoading = chatIsLoading && uiMessages.length === 0 && !pendingUserMessage;

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
    <>
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

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-40 relative">
            {shouldShowChatLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading conversation…
              </div>
            ) : shouldShowEmptyState ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4">
                  {/* Optional badge for free plan */}
                  {aiAccess?.currentPlan === "free" && (
                    <Badge variant="outline" className="mb-8 rounded-full px-4 py-1.5 border-amber-200 bg-amber-50 text-amber-700 gap-2 hover:bg-amber-100 transition-colors cursor-pointer shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Upgrade Plan
                    </Badge>
                  )}

                  {/* Welcome heading - Vercel style */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center space-y-4 mb-12"
                  >
                    <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
                      Hello! How can I help you today?
                    </h1>
                  </motion.div>

                  {/* Extra options - kept below for workflow access */}
                  <div className="w-full flex flex-col items-center">
                    <div className="flex items-center gap-4 mb-6">
                      <Button
                        variant="ghost"
                        className="text-muted-foreground gap-2 hover:text-foreground transition-colors group"
                        onClick={() => setShowTemplates(!showTemplates)}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", showTemplates && "rotate-180")} />
                        More templates
                      </Button>
                      <div className="w-px h-6 bg-border/50" />
                      <Button
                        variant="outline"
                        className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5 transition-colors"
                        onClick={() => setShowWorkflowWizard(true)}
                      >
                        <Workflow className="h-4 w-4 text-primary" />
                        Renovation Workflow
                      </Button>
                    </div>

                    <AnimatePresence>
                      {showTemplates && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -20 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -20 }}
                          className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-hidden px-4 sm:px-0 pb-8"
                        >
                          {QUICK_PROMPTS.slice(4).map((item) => (
                            <button
                              key={item.label}
                              onClick={() => handleQuickPromptClick(item.prompt)}
                              className={cn(
                                "text-left p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card hover:border-primary/20 transition-all duration-200 group/item shadow-sm"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-3.5 w-3.5 text-primary/70 group-hover/item:text-primary transition-colors" />
                                <span className="font-medium text-sm text-foreground/80 group-hover/item:text-foreground">{item.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 group-hover/item:text-foreground/70">{item.prompt}</p>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl pt-6 pb-6">
                <div className="flex flex-col gap-6">
                  {/* Always show ChatMessageList if there are messages */}
                  {uiMessages.length > 0 && (
                    <ChatMessageList
                      uiMessages={uiMessages}
                      messagesEndRef={messagesEndRef}
                      messageMetadataByIndex={messageMetadataByIndex}
                      localMessageAttachments={localMessageAttachments}
                      pendingItems={pendingItems as PendingContentItem[]}
                      isBulkProcessing={isBulkProcessing}
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
                    />
                  )}

                  {/* Show pending message only if NOT in uiMessages yet */}
                  {pendingUserMessage && uiMessages.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col gap-4 items-end"
                    >
                      <div className="max-w-[85%]">
                        <div className="bg-foreground text-background px-6 py-4 rounded-3xl shadow-lg">
                          <p className="text-base leading-relaxed whitespace-pre-wrap">
                            {pendingUserMessage}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Show thinking indicator when waiting for response to start (submitted but not streaming yet) */}
                  {isLoading && !isStreaming && <ThinkingIndicator />}
                </div>
              </div>
            )}
          </div>

          {/* Input Area - Vercel style with transition */}
          <motion.div
            initial={false}
            animate={{
              position: shouldShowEmptyState ? "absolute" : "sticky",
              bottom: shouldShowEmptyState ? "50%" : 0,
              transform: shouldShowEmptyState ? "translateY(50%)" : "translateY(0)",
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className={cn(
              "left-0 right-0 z-10 mx-auto flex w-full gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4",
              shouldShowEmptyState ? "max-w-3xl" : "sticky"
            )}
          >
            <div className="w-full max-w-4xl mx-auto">
              {renderInputArea()}
            </div>
          </motion.div>
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

      {/* Workflow Wizard Sheet */}
      <Sheet open={showWorkflowWizard} onOpenChange={setShowWorkflowWizard}>
        <SheetContent side="right" className="w-full sm:w-[450px] p-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Renovation Workflow</SheetTitle>
          </SheetHeader>
          <WorkflowWizard
            onStartWorkflow={handleStartWorkflow}
            onStepChange={handleWorkflowStepChange}
            onClose={handleCloseWorkflow}
            uploadedFileIds={uploadedFileIds}
            hasUploadedFile={selectedFiles.length > 0 || uploadedFileIds.length > 0}
            onFileUploadRequest={handleAttachmentClick}
            isAIResponding={isLoading || isStreaming}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AIAssistantSmart;
