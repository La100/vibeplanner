"use client";

/**
 * AI Assistant Smart Component
 * 
 * Main UI component for the AI Assistant feature.
 * Business logic is extracted to hooks in components/ai-assistant/hooks/
 */

import { useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { 
  Loader2, 
  Paperclip, 
  X, 
  FileText, 
  ArrowUp, 
  Square, 
  MessageSquare, 
  Sparkles, 
  RefreshCcw, 
  Trash2, 
  Plus 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";
import { AIConfirmationGrid, type PendingContentItem } from "@/components/AIConfirmationGrid";
import { AISubscriptionWall } from "@/components/AISubscriptionWall";

// Import from reorganized modules
import { useAIChat } from "@/components/ai-assistant/useAIChat";
import { usePendingItems } from "@/components/ai-assistant/usePendingItems";
import { useFileUpload } from "@/components/ai-assistant/useFileUpload";
import { QUICK_PROMPTS, ACCEPTED_FILE_TYPES } from "@/components/ai-assistant/constants";

const formatTokens = (tokens?: number) => {
  if (!tokens) return "0";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return tokens.toString();
};

const AIAssistantSmart = () => {
  const { user } = useUser();
  const { project, team } = useProject();

  // Check if team has AI access
  const aiAccess = useQuery(api.stripe.checkTeamAIAccess, team?._id ? { teamId: team._id } : "skip");
  
  // File input ref (shared between upload hook and component)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations for file upload (passed to useAIChat)
  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);

  // ==================== HOOKS ====================
  
  // Chat hook - manages messages, threads, and sending
  const {
    message,
    setMessage,
    chatHistory,
    setChatHistory,
    isLoading,
    setIsLoading,
    sessionTokens,
    threadId,
    showHistory,
    setShowHistory,
    threadList,
    isThreadListLoading,
    hasThreads,
    showEmptyState,
    chatIsLoading,
    previousThreadsCount,
    messagesEndRef,
    inputRef,
    handleSendMessage: sendMessageWithFile,
    handleStopResponse,
    handleClearChat,
    handleClearPreviousThreads,
    handleNewChat,
    handleThreadSelect: selectThread,
    handleQuickPromptClick,
  } = useAIChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  // File upload hook
  const {
    selectedFile,
    setSelectedFile,
    uploadedFileId,
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
    resetPendingState,
  } = usePendingItems({
    projectId: project?._id,
    teamSlug: team?.slug,
    threadId,
    setChatHistory,
  });

  // ==================== HANDLERS ====================

  const handleThreadSelect = (selectedThreadId: string) => {
    selectThread(selectedThreadId);
    resetPendingState();
        setSelectedFile(null);
  };

  const handleNewChatClick = () => {
    handleNewChat();
    resetPendingState();
    setSelectedFile(null);
  };

  const handleSendMessage = async () => {
    await sendMessageWithFile(
      selectedFile,
      uploadedFileId,
      () => setIsLoading(true),
      () => {
        setSelectedFile(null);
        setIsLoading(false);
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
    setSelectedFile(null);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  // ==================== RENDER HELPERS ====================

  const renderInputArea = () => (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
      className={cn(
        "relative rounded-[2rem] p-1.5 sm:p-2",
        "bg-background border border-border/50 shadow-sm",
        "transition-all duration-300",
        "focus-within:ring-1 focus-within:ring-primary/20",
        "hover:border-primary/20"
      )}
    >
      <AnimatePresence>
        {selectedFile && (
          <motion.div 
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: -10, height: "auto" }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="absolute bottom-full left-4 mb-2 flex items-center gap-2"
          >
             <div className="relative group">
                <div className="flex items-center gap-2 bg-background/80 p-2 rounded-xl border border-border/50 shadow-sm">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium max-w-[120px] truncate">{selectedFile.name}</span>
                    <span className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive -mr-1"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 sm:gap-3 pl-2 sm:pl-4 pr-2 sm:pr-3 py-2 sm:py-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
        />
        
        <div className="flex items-center gap-2 pb-1">
          <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={handleAttachmentClick}
              disabled={isLoading || isUploading}
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
        </div>

        <div className="w-px h-8 bg-border/50 mb-1.5 hidden sm:block" />

        <textarea
           ref={inputRef}
           value={message}
           onChange={(e) => setMessage(e.target.value)}
           onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading && !isUploading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
           placeholder={isUploading ? "Uploading..." : "Ask about your project..."}
           rows={1}
           disabled={isUploading}
           className={cn(
              "flex-1 resize-none bg-transparent",
              "text-sm sm:text-base placeholder:text-muted-foreground/50",
              "focus:outline-none",
              "py-2.5 px-2",
              "max-h-[200px] min-h-[44px]"
           )}
        />

        <Button
           onClick={isLoading && !isUploading ? handleStopResponse : handleSendMessage}
           disabled={isUploading || (!message.trim() && !selectedFile && !isLoading)}
           size="icon"
           className={cn(
             "h-10 w-10 rounded-full",
             isLoading && !isUploading ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background",
             "shadow-md transition-all duration-200 hover:scale-105 active:scale-95",
             "disabled:opacity-50 disabled:hover:scale-100"
           )}
        >
           {isUploading ? (
             <Loader2 className="h-5 w-5 animate-spin" />
           ) : isLoading ? (
             <Square className="h-4 w-4 fill-current" />
           ) : (
             <ArrowUp className="h-5 w-5" />
           )}
        </Button>
      </div>
    </motion.div>
  );

  // ==================== MAIN RENDER ====================

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (
      aiAccess.remainingBudgetCents === 0 ||
      (typeof (aiAccess.subscriptionLimits as { aiImageGenerationsLimit?: number })?.aiImageGenerationsLimit === "number" &&
        (aiAccess.aiImageCount || 0) >= (aiAccess.subscriptionLimits as { aiImageGenerationsLimit?: number }).aiImageGenerationsLimit!) ||
      (aiAccess.message || "").toLowerCase().includes("wyczerpano")
    )
  );

  // Show limit block if quota exhausted, otherwise paywall if no access
  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (isQuotaBlocked) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 bg-background/50">
          <Card className="max-w-lg w-full border-border/50 shadow-2xl rounded-3xl overflow-hidden bg-card/80 backdrop-blur-xl">
            <CardHeader className="space-y-4 pb-2">
              <Badge variant="secondary" className="w-fit bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-0 px-3 py-1 rounded-full">
                AI limit reached
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-display tracking-tight">AI allocation used</CardTitle>
                <CardDescription className="text-base">{aiAccess.message}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tokens</div>
                <div className="text-2xl font-semibold font-display tracking-tight">{formatTokens(aiAccess.totalTokensUsed)}</div>
                {aiAccess.billingWindowStart && (
                  <div className="text-xs text-muted-foreground">
                    Since {new Date(aiAccess.billingWindowStart).toLocaleDateString()}
                  </div>
                )}
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
      {aiAccess?.hasAccess && (
        <div className="w-full px-4 sm:px-6 lg:px-8 mt-3 flex justify-end">
          <div className="inline-flex items-center gap-3 rounded-full border border-border/50 bg-muted/25 px-4 py-2 shadow-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1 text-foreground">
                <span className="text-sm font-semibold font-display leading-none">{formatTokens(aiAccess.totalTokensUsed)}</span>
                <span className="uppercase tracking-wide text-[10px] text-muted-foreground">tokens</span>
              </div>
              {/* Optional: Show spend progress if limit exists */}
              {(() => {
                const limits = aiAccess.subscriptionLimits as { aiMonthlySpendLimitCents?: number } | undefined;
                const spendLimit = limits?.aiMonthlySpendLimitCents;
                return typeof spendLimit === "number" ? (
                  <div className="h-1 rounded-full bg-muted overflow-hidden w-24">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500/70 to-purple-500/70 rounded-full"
                      style={{
                        width: `${Math.min(100, ((aiAccess.aiSpendCents || 0) / spendLimit) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden md:flex-row-reverse">
        {/* Sidebar with chat history (desktop) */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col bg-muted/20 border-l border-border/50 overflow-hidden transition-[width] duration-300 ease-out md:flex md:sticky md:self-start md:top-4 md:h-full",
            showHistory ? "w-80" : "w-0"
          )}
        >
          <div
            className={cn(
              "flex flex-col h-full transition-all duration-200 ease-out",
              showHistory ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
            )}
          >
            <div className="flex items-center justify-between p-4 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Project chats</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setShowHistory(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close sidebar</span>
              </Button>
            </div>

            <div className="px-4 pb-4">
              <Button 
                onClick={handleNewChatClick} 
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
                    const previewRaw = (thread.lastMessagePreview ?? "").replace(/\s+/g, " ").trim();
                    const preview =
                      previewRaw.length > 0
                        ? previewRaw
                        : thread.messageCount === 0
                        ? "No messages yet."
                        : thread.lastMessageRole === "assistant"
                        ? "Assistant replied."
                        : "You replied.";
                    const relativeTime = formatDistanceToNow(
                      new Date(thread.lastMessageAt ?? Date.now()),
                      { addSuffix: true }
                    );

                    return (
                      <Button
                        key={thread.threadId}
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
                          {preview}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="bg-muted/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No chats yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a new conversation to get help with your project.</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </aside>

        {/* Main conversation area */}
        <div className="relative flex flex-1 flex-col min-h-0">
          
          {/* Mobile header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 md:hidden z-20 bg-background/50 backdrop-blur sticky top-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full -ml-2 text-muted-foreground hover:text-foreground">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle history</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
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

            <span className="font-semibold text-sm">AI Assistant</span>

            <Button onClick={handleNewChatClick} variant="ghost" size="icon" className="h-9 w-9 rounded-full -mr-2 text-muted-foreground hover:text-foreground">
              <Plus className="h-5 w-5" />
              <span className="sr-only">New chat</span>
            </Button>
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
            {previousThreadsCount > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearPreviousThreads}
                className="h-10 w-10 rounded-full"
              >
                <span className="sr-only">Clear previous chats</span>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {sessionTokens.cost > 0 && (
              <span className="text-xs text-muted-foreground">
                Estimated cost: ${sessionTokens.cost.toFixed(4)}
              </span>
            )}
            {threadId && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleClearChat}
                className="h-10 w-10 rounded-full"
              >
                <span className="sr-only">Clear chat</span>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6">
            {chatIsLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading conversation…
              </div>
            ) : (
              <div className={cn(
                  "mx-auto flex max-w-4xl flex-col space-y-4",
                  showEmptyState ? "min-h-full justify-center items-center gap-4 pt-6 pb-6" : "pt-6 pb-4"
                )}>
                {showEmptyState ? (
                   <div className="flex flex-col items-center justify-center w-full">
                      {/* Hero Section */}
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-3 text-center mb-4"
                      >
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground font-display">
                          AI Assistant
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed px-4">
                           Manage your project with <span className="italic font-serif text-foreground">intelligence</span>. 
                           From planning to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-semibold">execution</span>.
                        </p>
                      </motion.div>

                      {/* Quick Prompts */}
                        <div className="w-full overflow-x-auto pb-4 -mx-6 px-6 sm:mx-0 sm:px-0 sm:overflow-visible sm:pb-0 scrollbar-none snap-x snap-mandatory">
                          <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl w-full mx-auto min-w-max sm:min-w-0"
                          >
                           {QUICK_PROMPTS.slice(0, 3).map((item) => (
                               <button
                                 key={item.label}
                                 onClick={() => handleQuickPromptClick(item.prompt)}
                                 className={cn(
                                   "group relative overflow-hidden rounded-3xl text-left transition-all duration-300 h-32 p-5 w-[280px] sm:w-auto snap-center shrink-0",
                                   "bg-card/50 hover:bg-card border border-border/50 hover:border-primary/20 shadow-sm hover:shadow-xl hover:-translate-y-1"
                                 )}
                               >
                               <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                               
                               <div className="relative z-10 flex flex-col h-full justify-between">
                                 <div className="flex items-center gap-3">
                                   <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center shadow-sm text-primary">
                                      <Sparkles className="h-4 w-4" />
                                   </div>
                                   <span className="font-medium text-foreground">{item.label}</span>
                                 </div>
                                 <p className="text-sm text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors whitespace-normal">
                                   {item.prompt}
                                 </p>
                               </div>
                             </button>
                           ))}
                          </motion.div>
                        </div>
                   </div>
                ) : (
                  <>
                    <AnimatePresence initial={false}>
                    {chatHistory.map((chat, index) => {
                      const isUser = chat.role === "user";
                      
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                          className={cn("flex flex-col gap-4", isUser ? "items-end" : "items-start")}
                        >
                          {isUser ? (
                            <div className="max-w-[85%]">
                               <div className="bg-foreground text-background px-6 py-4 rounded-3xl rounded-tr-sm shadow-lg">
                                 <p className="text-lg leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                               </div>
                               {chat.fileInfo && (
                                <div className="mt-2 justify-end flex">
                                  <div className="bg-card border border-border rounded-xl p-2 text-xs flex items-center gap-2 max-w-[200px]">
                                     <FileText className="h-4 w-4" />
                                     <span className="truncate">{chat.fileInfo.name}</span>
                                  </div>
                                </div>
                               )}
                            </div>
                          ) : (
                            <div className="w-full max-w-4xl">
                               {chat.content === "" && !chat.fileInfo ? (
                                  <div className="flex items-center gap-2 pl-4">
                                     <div className="h-2.5 w-2.5 rounded-full bg-foreground animate-pulse" />
                                  </div>
                               ) : (
                               <div className="relative rounded-3xl bg-transparent overflow-hidden">
                                  <div className="relative z-10 p-8">
                                      <div className="prose prose-neutral dark:prose-invert max-w-none leading-relaxed text-lg text-foreground/90">
                                          <div dangerouslySetInnerHTML={{ __html: chat.content.replace(/\n/g, '<br/>') }} />
                                      </div>

                                      {chat.tokenUsage && (
                                        <div className="mt-6 flex items-center gap-2">
                                          <Badge variant="outline" className="bg-background/50 backdrop-blur border-border/50 text-xs text-muted-foreground font-normal">
                                            Estimated cost: ${chat.tokenUsage.estimatedCostUSD.toFixed(4)}
                                          </Badge>
                                          {chat.mode && (
                                            <Badge variant="outline" className="bg-background/50 backdrop-blur border-border/50 text-xs text-muted-foreground font-normal">
                                              {chat.mode === "full" ? "Full Context" : "Recent Context"}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                  </div>
                               </div>
                               )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} className="h-4" />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div
            className={cn(
              "w-full px-2 sm:px-6 py-4 sm:py-6 z-50 mt-auto"
            )}
          >
            <div className="max-w-3xl mx-auto">
               {renderInputArea()}
            </div>
          </div>

        </div>
      </div>

    {/* Confirmation Grid Modal for Multiple Items */}
    {showConfirmationGrid && (
      <Dialog open={showConfirmationGrid} onOpenChange={setShowConfirmationGrid}>
        <DialogContent
          className="flex flex-col overflow-hidden p-4 sm:p-8"
          style={{
            width: "min(95vw, 1280px)",
            height: "min(95vh, 900px)",
            maxWidth: "95vw",
            maxHeight: "95vh",
            margin: "auto",
          }}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Review AI Suggestions</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <AIConfirmationGrid
              pendingItems={pendingItems as PendingContentItem[]}
              onConfirmAll={handleConfirmAll}
              onConfirmItem={handleConfirmItem}
              onRejectItem={handleRejectItem}
              onRejectAll={handleRejectAll}
              onEditItem={(index) => {
                handleEditItem(index);
                setShowConfirmationGrid(false);
                setIsConfirmationDialogOpen(true);
                setCurrentItemIndex(index);
              }}
              isProcessing={isBulkProcessing}
            />
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Universal Confirmation Dialog for Single Items */}
    {pendingItems.length > 0 && !showConfirmationGrid && (
      <UniversalConfirmationDialog
        isOpen={isConfirmationDialogOpen}
        onClose={handleContentDialogClose}
        onConfirm={handleContentConfirm}
        onCancel={handleContentCancel}
        onEdit={(updatedItem) => handleContentEdit(updatedItem as unknown as Record<string, unknown>)}
        contentItem={pendingItems[currentItemIndex] as PendingContentItem}
        isLoading={isCreatingContent}
        itemNumber={currentItemIndex + 1}
        totalItems={pendingItems.length}
      />
    )}
    </>
  );
};

export default AIAssistantSmart;
