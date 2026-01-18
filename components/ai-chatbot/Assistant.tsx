"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Messages } from "@/components/ai-chatbot/messages";
import { useAIChat } from "@/components/ai-assistant/useAIChat";
import { usePendingItems } from "@/components/ai-assistant/usePendingItems";
import { AISubscriptionWall } from "@/components/AISubscriptionWall";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "@/components/ai-assistant/constants";
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
} from "@/components/ai-elements/prompt-input";
import type { ChatStatus, FileUIPart } from "ai";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";

const AIAssistantVercel = () => {
  const { user } = useUser();
  const { project, team } = useProject();
  const [isUploading, setIsUploading] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<{
    text: string;
    submittedAt: number;
    attachments: Array<{
      name: string;
      size: number;
      type: string;
      previewUrl?: string;
    }>;
  } | null>(null);
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

  const aiAccess = useQuery(
    apiAny.stripe.checkTeamAIAccess,
    team?._id ? { teamId: team._id } : "skip"
  );

  const generateUploadUrl = useMutation(apiAny.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(apiAny.files.addFile);

  const {
    setChatHistory,
    isLoading,
    threadId,
    handleSendMessage: sendMessageWithFile,
    handleStopResponse,
    uiMessages,
    isStreaming,
    messageMetadataByIndex,
  } = useAIChat({
    projectId: project?._id,
    userClerkId: user?.id,
  });

  const {
    pendingItems,
    currentItemIndex,
    setCurrentItemIndex,
    isConfirmationDialogOpen,
    setIsConfirmationDialogOpen,
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
  } = usePendingItems({
    projectId: project?._id,
    teamSlug: team?.slug,
    threadId,
    setChatHistory,
  });

  useEffect(() => {
    if (!pendingUserMessage) return;
    const pendingText = pendingUserMessage.text.trim();
    const submittedAt = pendingUserMessage.submittedAt;
    const hasUserMessage = uiMessages.some((msg) => {
      if (msg.role !== "user") return false;
      const msgText = (msg.text || "").trim();
      if (!msgText || msgText !== pendingText) return false;
      return typeof msg._creationTime === "number" && msg._creationTime >= submittedAt - 1000;
    });

    if (hasUserMessage) {
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
    setLocalMessageAttachments((prev) => {
      Object.values(prev).flat().forEach((attachment) => {
        if (attachment.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      return {};
    });
  }, [threadId]);

  const makeAttachmentLabel = (files: Array<{ filename?: string; name?: string }>) => {
    const names = files.map(
      (file, index) => file.filename || file.name || `attachment-${index + 1}`
    );
    if (names.length === 0) return "";
    return `Attached: ${names.join(", ")}`;
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

    const optimisticText = trimmedMessage || makeAttachmentLabel(payload.files);
    if (optimisticText) {
      setPendingUserMessage({
        text: optimisticText,
        submittedAt: Date.now(),
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
      ? makeAttachmentLabel(uploadFiles)
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
    } finally {
      setIsUploading(false);
    }
  };

  const submitStatus = (isStreaming ? "streaming" : isLoading ? "submitted" : "ready") as ChatStatus;

  const shouldShowChatLoading = false;

  const isQuotaBlocked = !!(
    aiAccess &&
    !aiAccess.hasAccess &&
    (
      aiAccess.remainingTokens === 0 ||
      (aiAccess.message || "").toLowerCase().includes("wyczerpano")
    )
  );

  if (aiAccess !== undefined && !aiAccess.hasAccess && team?._id) {
    if (isQuotaBlocked) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 bg-background/50">
          <div className="max-w-lg w-full rounded-3xl border border-border/50 bg-card/80 p-8 text-center">
            <h2 className="text-lg font-semibold">No AI tokens available</h2>
            <p className="mt-2 text-sm text-muted-foreground">{aiAccess.message}</p>
          </div>
        </div>
      );
    }

    return <AISubscriptionWall teamId={team._id} teamSlug={team.slug} />;
  }

  if (aiAccess === undefined && team?._id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-muted-foreground">Checking access...</span>
        </div>
      </div>
    );
  }

  return (
    <PromptInputProvider>
      <div className="relative flex h-[calc(100vh-4rem)] flex-col bg-background text-foreground">
        <div className="flex flex-1 min-h-0 flex-col">
          {shouldShowChatLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading conversation…
            </div>
          ) : (
            <Messages
              messages={uiMessages}
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

      {pendingItems[currentItemIndex] && (
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
    </PromptInputProvider>
  );
};

export default AIAssistantVercel;
