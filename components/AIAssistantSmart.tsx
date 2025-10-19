"use client";

import { useState, useEffect, useRef } from "react";

// Helper function to safely extract survey data
const extractSurveyData = (data: Record<string, unknown>) => ({
  title: (data.title as string) || '',
  description: data.description as string | undefined,
  isRequired: data.isRequired as boolean | undefined,
  allowMultipleResponses: data.allowMultipleResponses as boolean | undefined,
  startDate: data.startDate as string | undefined,
  endDate: data.endDate as string | undefined,
  targetAudience: data.targetAudience as "all_customers" | "specific_customers" | "team_members" | undefined,
  targetCustomerIds: data.targetCustomerIds as string[] | undefined,
  questions: data.questions as Array<{
    questionId?: string;
    questionText: string;
    questionType: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file";
    options?: string[];
    isRequired?: boolean;
    order?: number;
  }> | undefined,
});
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { Send, RotateCcw, Loader2, Paperclip, X, Sparkles, Database, Zap, DollarSign, Building, FileText, Image, File } from "lucide-react";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";
import InlinePromptManager from "@/components/InlinePromptManager";
import { AIConfirmationGrid } from "@/components/AIConfirmationGrid";

type PendingItem = {
  type: 'task' | 'note' | 'shopping' | 'survey' | 'contact' | 'shoppingSection';
  operation?: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create';
  data: Record<string, unknown>;
  updates?: Record<string, unknown>;
  originalItem?: Record<string, unknown>;
  selection?: Record<string, unknown>;
  titleChanges?: Array<{
    taskId?: string;
    currentTitle?: string;
    originalTitle?: string;
    newTitle: string;
  }>;
  display?: {
    title: string;
    description: string;
  };
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  responseId?: string;
};

type TaskInput = {
  title: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done';
  description?: string;
  assignedTo?: string | null;
  assignedToName?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  tags?: string[];
  cost?: number;
};

type BulkTaskData = {
  tasks?: TaskInput[];
};

type NoteInput = {
  title: string;
  content: string;
};

type BulkNoteData = {
  notes?: NoteInput[];
};

type ShoppingItemInput = {
  name: string;
  quantity: number;
  notes?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  buyBefore?: string;
  supplier?: string;
  category?: string;
  unitPrice?: number;
  sectionId?: Id<'shoppingListSections'>;
  sectionName?: string;
};

type BulkShoppingData = {
  items?: ShoppingItemInput[];
};

type BulkSurveyData = {
  surveys?: Array<Record<string, unknown>>;
};

const normalizePendingItems = (items: PendingItem[]): PendingItem[] =>
  items.map((item) => {
    if (item.type === "task") {
      const selection = item.selection || item.data;
      const taskIds = (selection?.taskIds || item.data?.taskIds) as unknown;
      if (Array.isArray(taskIds)) {
        const normalizedIds = taskIds.map(String);
        item = {
          ...item,
          selection: { ...selection, taskIds: normalizedIds },
          data: { ...item.data, taskIds: normalizedIds },
        };
      }

      const title = (item.data?.title as string) || (item.originalItem?.title as string) || "Task";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete task: ${title}`
              : item.operation === "edit"
              ? `Update task: ${title}`
              : `Create task: ${title}`,
          description: (item.data?.description as string) || "Review task details before confirming.",
        },
      };
    }

    if (item.type === "note") {
      const title = (item.data?.title as string) || (item.originalItem?.title as string) || "Note";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete note: ${title}`
              : item.operation === "edit"
              ? `Update note: ${title}`
              : `Create note: ${title}`,
          description: (item.data?.content as string)?.slice(0, 120) || "Review note before confirming.",
        },
      };
    }

    if (item.type === "shopping") {
      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Shopping item";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete item: ${name}`
              : item.operation === "edit"
              ? `Update item: ${name}`
              : `Create item: ${name}`,
          description: `Quantity: ${item.data?.quantity ?? item.originalItem?.quantity ?? 1}`,
        },
      };
    }

    if (item.type === "survey") {
      const title = (item.data?.title as string) || (item.originalItem?.title as string) || "Survey";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete survey: ${title}`
              : item.operation === "edit"
              ? `Update survey: ${title}`
              : `Create survey: ${title}`,
          description: (item.data?.description as string) || "Review survey details before confirming.",
        },
      };
    }

    if (item.type === "contact") {
      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Contact";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete contact: ${name}`
              : item.operation === "edit"
              ? `Update contact: ${name}`
              : `Create contact: ${name}`,
          description: (item.data?.companyName as string) || (item.data?.email as string) || "Review contact details.",
        },
      };
    }

    return formatShoppingSectionDisplay(item);
  });

const formatShoppingSectionDisplay = (item: PendingItem): PendingItem => {
  if (item.type !== "shoppingSection") return item;

  const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Shopping Section";
  const originalName = item.originalItem?.name as string | undefined;

  return {
    ...item,
    display: {
      title:
        item.operation === "delete"
          ? `Delete section: ${name}`
          : item.operation === "edit"
          ? `Update section: ${name}`
          : `Create section: ${name}`,
      description:
        item.operation === "edit" && originalName && originalName !== name
          ? `Rename from "${originalName}" to "${name}"`
          : item.operation === "delete"
          ? "The section will be removed; assigned items stay unsectioned."
          : "New shopping list section",
    },
  } satisfies PendingItem;
};

const expandBulkEditItems = (items: PendingItem[]): PendingItem[] => {
  if (items.length !== 1) {
    return items;
  }

  const item = items[0];
  if (item.type !== 'task' || item.operation !== 'bulk_edit') {
    return items;
  }

  const titleChanges = item.titleChanges || (Array.isArray(item.data.titleChanges)
    ? (item.data.titleChanges as PendingItem['titleChanges'])
    : []);

  if (!titleChanges || titleChanges.length === 0) {
    return items;
  }

  const baseSelection = item.selection || item.data || {};
  const baseUpdates = item.updates || (item.data?.updates as Record<string, unknown>) || {};

  return titleChanges.map(change => {
    const taskIdList = change.taskId ? [change.taskId] : Array.isArray(baseSelection.taskIds) ? (baseSelection.taskIds as string[]) : [];
    return {
      type: 'task' as const,
      operation: 'bulk_edit' as const,
      data: {
        ...item.data,
        title: change.newTitle,
        previousTitle: change.originalTitle || change.currentTitle,
        taskId: change.taskId,
        titleChanges: [change],
        taskIds: taskIdList,
      },
      updates: {
        ...baseUpdates,
        title: change.newTitle,
      },
      originalItem: {
        title: change.originalTitle || change.currentTitle,
      },
      selection: {
        applyToAll: false,
        taskIds: taskIdList,
        reason: (baseSelection as { reason?: string }).reason,
      },
      titleChanges: [change],
    } satisfies PendingItem;
  });
};

const extractBulkSelection = (item: PendingItem) => {
  const source = item.selection || item.data;
  const taskIds = Array.isArray(source?.taskIds)
    ? (source!.taskIds as string[])
    : undefined;
  return {
    taskIds,
    applyToAll: Boolean(source?.applyToAll),
    reason: typeof source?.reason === 'string' ? (source!.reason as string) : undefined,
  };
};

const extractBulkUpdates = (item: PendingItem) => {
  const source = item.updates || (item.data?.updates as Record<string, unknown>) || {};
  const updates = { ...source } as Record<string, unknown>;
  delete updates.assignedToName;
  return updates;
};

const AIAssistantSmart = () => {
  const { user } = useUser();
  const { project } = useProject();
  
  // Check if AI is enabled for this project
  const aiSettings = useQuery(
    api.ai.settings.getAISettings,
    project ? { projectId: project._id } : "skip"
  );
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{
    role: 'user' | 'assistant';
    content: string;
    mode?: string;
    tokenUsage?: { totalTokens: number; estimatedCostUSD: number; };
    fileInfo?: { name: string; size: number; type: string; id: string; };
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [currentMode, setCurrentMode] = useState<'basic' | 'rag' | null>(null);
  const [sessionTokens, setSessionTokens] = useState({ total: 0, cost: 0 });
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]); // New unified system
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [showConfirmationGrid, setShowConfirmationGrid] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Helper function to get file thumbnail/preview
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return Image;
    if (fileType === 'application/pdf') return FileText;
    return File;
  };

  // Helper function to create thumbnail component
  const FileThumbnail = ({ fileInfo }: { fileInfo: { name: string; size: number; type: string; id: string; } }) => {
    const fileWithURL = useQuery(api.files.getFileWithURL, { fileId: fileInfo.id as Id<"files"> });
    const FileIcon = getFileIcon(fileInfo.type);

    return (
      <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-border/20">
        <div className="flex items-start gap-2">
          {fileInfo.type.startsWith('image/') && fileWithURL?.url ? (
            <div className="flex-shrink-0">
              <img
                src={fileWithURL.url}
                alt={fileInfo.name}
                className="w-16 h-16 object-cover rounded border"
                onError={(e) => {
                  // Fallback to icon on error
                  e.currentTarget.style.display = 'none';
                  const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextElement) {
                    nextElement.style.display = 'flex';
                  }
                }}
              />
              <div className="w-16 h-16 hidden bg-muted border rounded items-center justify-center">
                <FileIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 w-16 h-16 bg-muted border rounded flex items-center justify-center">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" title={fileInfo.name}>
              {fileInfo.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(fileInfo.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {fileInfo.type.split('/')[1] || fileInfo.type}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  // Use the RAG AI system
  const createConfirmedTask = useAction(api.ai.confirmedActions.createConfirmedTask);
  const createConfirmedNote = useAction(api.ai.confirmedActions.createConfirmedNote);
  const createConfirmedShoppingItem = useAction(api.ai.confirmedActions.createConfirmedShoppingItem);
  const createConfirmedSurvey = useAction(api.ai.confirmedActions.createConfirmedSurvey);
  const editConfirmedTask = useAction(api.ai.confirmedActions.editConfirmedTask);
  const editConfirmedNote = useAction(api.ai.confirmedActions.editConfirmedNote);
  const editConfirmedShoppingItem = useAction(api.ai.confirmedActions.editConfirmedShoppingItem);
  const editConfirmedSurvey = useAction(api.ai.confirmedActions.editConfirmedSurvey);
  // Delete mutations
  const deleteTask = useMutation(api.tasks.deleteTask);
  const deleteNote = useMutation(api.notes.deleteNote);
  const deleteShoppingItem = useMutation(api.shopping.deleteShoppingListItem);
  const createShoppingSection = useMutation(api.shopping.createShoppingListSection);
  const updateShoppingSection = useMutation(api.shopping.updateShoppingListSection);
  const deleteShoppingSection = useMutation(api.shopping.deleteShoppingListSection);
  const deleteSurvey = useMutation(api.surveys.deleteSurvey);
  const deleteContact = useMutation(api.contacts.deleteContact);
  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);
  const bulkEditConfirmedTasks = useAction(api.ai.actions.bulkEditConfirmedTasks);
  const createThread = useMutation(api.ai.threads.getOrCreateThreadPublic);
  const markFunctionCallsAsConfirmed = useMutation(api.ai.threads.markFunctionCallsAsConfirmed);

  const handleSendMessage = async () => {
    if (!project || (!message.trim() && !selectedFile) || !user?.id) return;

    const userMessage = message.trim();
    let currentThreadId = threadId;
    const hadFile = Boolean(selectedFile);

    setIsLoading(true);

    try {
      // If no thread exists, create one
      if (!currentThreadId) {
        currentThreadId = await createThread({
          projectId: project._id,
          userClerkId: user.id,
        });
        setThreadId(currentThreadId);
      }

      let currentFileId = uploadedFileId;

      if (selectedFile) {
        setIsUploading(true);
        const uploadData = await generateUploadUrl({
          projectId: project._id,
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
          projectId: project._id,
          fileKey: uploadData.key,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
          origin: "ai",
        });

        currentFileId = fileId;
        setUploadedFileId(fileId);

        const userContent = userMessage || `📎 Attached: ${selectedFile.name}`;
        setChatHistory((prev) => [
          ...prev,
          {
            role: "user",
            content: userContent,
            fileInfo: {
              name: selectedFile.name,
              size: selectedFile.size,
              type: selectedFile.type,
              id: fileId,
            },
          },
        ]);
        setSelectedFile(null);
        setMessage("");
        setIsUploading(false);
      } else {
        setChatHistory((prev) => [...prev, { role: "user", content: userMessage }]);
        setMessage("");
      }

      setChatHistory((prev) => [...prev, { role: "assistant", content: "", mode: currentMode ?? undefined }]);

      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          projectId: project._id,
          userClerkId: user.id,
          threadId: currentThreadId,
          fileId: hadFile ? currentFileId ?? undefined : undefined,
        }),
      });

      if (!response.body) {
        throw new Error("Streaming response body is missing");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pendingItemsFromStream: PendingItem[] = [];
      let pendingItemsMode: string | null = null;
      let runningResponse = "";
      let latestTokenUsage: { totalTokens: number; estimatedCostUSD: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          const event = JSON.parse(line);

          switch (event.type) {
            case "token": {
              runningResponse += event.delta;
              setChatHistory((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: runningResponse,
                };
                return updated;
              });
              break;
            }
            case "metadata": {
              if (event.mode) {
                pendingItemsMode = event.mode;
                setCurrentMode(event.mode as "basic" | "rag");
              }
              if (event.tokenUsage) {
                latestTokenUsage = event.tokenUsage;
                setSessionTokens((prev) => ({
                  total: prev.total + event.tokenUsage.totalTokens,
                  cost: prev.cost + event.tokenUsage.estimatedCostUSD,
                }));
              }
              if (event.threadId) {
                setThreadId(event.threadId);
              }
              break;
            }
            case "pendingItems": {
              pendingItemsFromStream = expandBulkEditItems(normalizePendingItems(event.items));
              break;
            }
            case "error": {
              throw new Error(event.message || "Streaming error");
            }
            default: {
              break;
            }
          }
        }
      }

      if (pendingItemsMode) {
        setCurrentMode(pendingItemsMode as "basic" | "rag");
      }

      setChatHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: runningResponse,
          mode: pendingItemsMode ?? updated[updated.length - 1].mode,
          tokenUsage: latestTokenUsage ?? updated[updated.length - 1].tokenUsage,
        };
        return updated;
      });

      if (pendingItemsFromStream.length > 0) {
        setPendingItems(pendingItemsFromStream);
        setCurrentItemIndex(0);

        const firstItem = pendingItemsFromStream[0];
        const initialOperation = firstItem?.operation;
        const shouldShowGrid =
          pendingItemsFromStream.length > 1 ||
          firstItem.operation === "bulk_edit" ||
          firstItem.operation === "bulk_create";

        if (shouldShowGrid) {
          setShowConfirmationGrid(true);
          setIsConfirmationDialogOpen(false);
        } else {
          setShowConfirmationGrid(false);
          const shouldExpandToDialog = initialOperation !== "bulk_edit";
          setIsConfirmationDialogOpen(shouldExpandToDialog);

          // For all other single item operations, show dialog
          setIsConfirmationDialogOpen(shouldExpandToDialog);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      setChatHistory((prev) => prev.slice(0, -1));
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I encountered an error: ${errorMessage}` },
      ]);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 512 * 1024 * 1024) {
        toast.error("File size must be less than 512MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedFileId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleContentConfirm = async () => {
    if (!project || pendingItems.length === 0) return;

    const currentItem = pendingItems[currentItemIndex];
    setIsCreatingContent(true);

    try {
      let result;

      // Call appropriate function based on operation type
      if (currentItem.operation === 'delete') {
        // Handle delete operations
        switch (currentItem.type) {
          case 'task':
            await deleteTask({ taskId: currentItem.data.taskId as Id<"tasks"> });
            result = { success: true, message: "Task deleted successfully" };
            break;
          case 'note':
            await deleteNote({ noteId: currentItem.data.noteId as Id<"notes"> });
            result = { success: true, message: "Note deleted successfully" };
            break;
          case 'shopping':
            await deleteShoppingItem({ itemId: currentItem.data.itemId as Id<"shoppingListItems"> });
            result = { success: true, message: "Shopping item deleted successfully" };
            break;
          case 'shoppingSection':
            await deleteShoppingSection({ sectionId: currentItem.data.sectionId as Id<"shoppingListSections"> });
            result = { success: true, message: "Shopping section deleted successfully" };
            break;
          case 'survey':
            await deleteSurvey({ surveyId: currentItem.data.surveyId as Id<"surveys"> });
            result = { success: true, message: "Survey deleted successfully" };
            break;
          case 'contact':
            await deleteContact({ contactId: currentItem.data.contactId as Id<"contacts"> });
            result = { success: true, message: "Contact deleted successfully" };
            break;
          default:
            throw new Error(`Unknown content type for deletion: ${currentItem.type}`);
        }
      } else if (currentItem.operation === 'edit') {
        // Handle edit operations
        switch (currentItem.type) {
          case 'task':
            // Clean updates - remove technical fields that are only for UI display
            const cleanUpdates = { ...(currentItem.updates as Record<string, unknown>) };
            delete (cleanUpdates as Record<string, unknown>).assignedToName;
            
            result = await editConfirmedTask({
              taskId: currentItem.originalItem?._id as Id<"tasks">,
              updates: cleanUpdates
            });
            break;
          case 'note':
            result = await editConfirmedNote({
              noteId: currentItem.originalItem?._id as Id<"notes">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
          case 'shopping':
            result = await editConfirmedShoppingItem({
              itemId: currentItem.originalItem?._id as Id<"shoppingListItems">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
          case 'shoppingSection':
            await updateShoppingSection({
              sectionId: currentItem.originalItem?._id as Id<"shoppingListSections">,
              name: currentItem.data.name as string,
            });
            result = { success: true, message: "Shopping section updated successfully" };
            break;
          case 'survey':
            result = await editConfirmedSurvey({
              surveyId: currentItem.originalItem?._id as Id<"surveys">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
        default:
          throw new Error(`Nieznany typ zawartości do edycji: ${currentItem.type}`);
        }
      } else if (currentItem.operation === 'bulk_edit') {
        if (currentItem.type !== 'task') {
          throw new Error('Bulk edit currently supported only for tasks');
        }

        const selection = extractBulkSelection(currentItem);
        const updates = extractBulkUpdates(currentItem);

        result = await bulkEditConfirmedTasks({
          projectId: project._id,
          selection,
          updates: updates as {
            title?: string;
            description?: string;
            status?: "todo" | "in_progress" | "review" | "done";
            priority?: "low" | "medium" | "high" | "urgent";
            assignedTo?: string | null;
            tags?: string[];
          },
          reason: selection.reason,
        });
      } else if (currentItem.operation === 'bulk_create') {
        if (currentItem.type !== 'task') {
          throw new Error('Bulk create currently supported only for tasks');
        }

        // Create all tasks from the bulk_create operation
        const tasks = (currentItem.data.tasks as Array<Record<string, unknown>>) || [];
        const createdIds: string[] = [];
        const errors: string[] = [];

        for (const taskData of tasks) {
          try {
            const cleanTaskData = { ...taskData };
            delete cleanTaskData.assignedToName;

            const taskResult = await createConfirmedTask({
              projectId: project._id,
              taskData: cleanTaskData as { title: string; status?: "todo" | "in_progress" | "review" | "done"; description?: string; assignedTo?: string | null; priority?: "low" | "medium" | "high" | "urgent"; dueDate?: string; tags?: string[]; cost?: number; }
            });

            if (taskResult.success && taskResult.taskId) {
              createdIds.push(taskResult.taskId);
            }
          } catch (error) {
            errors.push(`Failed to create task "${taskData.title}": ${error}`);
          }
        }

        result = {
          success: errors.length === 0,
          message: `Created ${createdIds.length}/${tasks.length} tasks successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''}`
        };
      } else {
        // Handle create operations
        switch (currentItem.type) {
          case 'task':
            // Clean data - remove technical fields that are only for UI display
            const cleanTaskData = { ...(currentItem.data as Record<string, unknown>) };
            delete (cleanTaskData as Record<string, unknown>).assignedToName;
            
            result = await createConfirmedTask({
              projectId: project._id,
              taskData: cleanTaskData as { title: string; status?: "todo" | "in_progress" | "review" | "done"; description?: string; assignedTo?: string | null; priority?: "low" | "medium" | "high" | "urgent"; dueDate?: string; tags?: string[]; cost?: number; }
            });
            break;
          case 'note':
            result = await createConfirmedNote({
              projectId: project._id,
              noteData: currentItem.data as { title: string; content: string; }
            });
            break;
          case 'shopping':
            const { sectionName, ...shoppingItemData } = currentItem.data as { sectionName?: string; [key: string]: unknown; };
            void sectionName; // Mark as intentionally unused
            result = await createConfirmedShoppingItem({
              projectId: project._id,
              itemData: shoppingItemData as { name: string; quantity: number; notes?: string; priority?: "low" | "medium" | "high" | "urgent"; buyBefore?: string; supplier?: string; category?: string; unitPrice?: number; sectionId?: Id<"shoppingListSections">; }
            });
            break;
          case 'shoppingSection':
            await createShoppingSection({
              projectId: project._id,
              name: currentItem.data.name as string,
            });
            result = { success: true, message: "Shopping section created successfully" };
            break;
          case 'survey':
            result = await createConfirmedSurvey({
              projectId: project._id,
              surveyData: extractSurveyData(currentItem.data)
            });
            break;
          default:
            throw new Error(`Nieznany typ zawartości: ${currentItem.type}`);
        }
      }

      if (result.success) {
        toast.success(result.message);
        
        if (currentItem.functionCall && currentItem.responseId && threadId) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId: threadId,
              responseId: currentItem.responseId,
              results: [{
                callId: currentItem.functionCall.callId,
                result: JSON.stringify(result),
              }]
            });
          } catch (e) {
            console.error("Failed to mark function call as confirmed", e);
          }
        }

        // Add success message to chat
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `✅ ${result.message}` 
        }]);

        // Move to next item or close dialog
        if (currentItemIndex < pendingItems.length - 1) {
          setCurrentItemIndex(prev => prev + 1);
        } else {
          setIsConfirmationDialogOpen(false);
          setPendingItems([]);
          setCurrentItemIndex(0);
        }
      }
    } catch (error) {
      console.error(`Error creating ${currentItem.type}:`, error);
      toast.error(`Failed to create ${currentItem.type}`);
    } finally {
      setIsCreatingContent(false);
    }
  };

  // Grid confirmation handlers
  const handleConfirmAll = async () => {
    setIsBulkProcessing(true);
    try {
      let successCount = 0;
      let failureCount = 0;
      const resultsByResponseId = new Map<string, { callId: string; result: string; }[]>();

      for (const item of pendingItems) {
        try {
          const result = await confirmSingleItem(item);
          successCount++;
          if (item.functionCall && item.responseId && result) {
            if (!resultsByResponseId.has(item.responseId)) {
              resultsByResponseId.set(item.responseId, []);
            }
            resultsByResponseId.get(item.responseId)!.push({
              callId: item.functionCall.callId,
              result: JSON.stringify(result),
            });
          }
        }
        catch (error) {
          console.error(`Failed to create ${item.type}:`, error);
          failureCount++;
        }
      }

      if (threadId) {
        for (const [responseId, results] of resultsByResponseId.entries()) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId: threadId,
              responseId: responseId,
              results: results,
            });
          } catch (e) {
            console.error("Failed to mark function calls as confirmed", e);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} items${failureCount > 0 ? `, ${failureCount} failed` : ''}`);
        
        // Add success message to chat
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `✅ Successfully created ${successCount} items${failureCount > 0 ? ` (${failureCount} failed)` : ''}` 
        }]);
      }

      if (failureCount > 0 && successCount === 0) {
        toast.error(`Failed to create all ${failureCount} items`);
      }

      setPendingItems([]);
      setShowConfirmationGrid(false);
    } catch {
      toast.error("Failed to process items");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleConfirmItem = async (index: number) => {
    const item = pendingItems[index];
    try {
      const result = await confirmSingleItem(item);
      
      if (item.functionCall && item.responseId && threadId) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId: threadId,
            responseId: item.responseId,
            results: [{
              callId: item.functionCall.callId,
              result: JSON.stringify(result),
            }]
          });
        } catch (e) {
          console.error("Failed to mark function call as confirmed", e);
        }
      }
      
      // Remove confirmed item from list
      setPendingItems(prev => prev.filter((_, i) => i !== index));
      
      toast.success(result.message || `${item.type} created successfully`);
      
      // Close grid if no more items
      if (pendingItems.length === 1) {
        setShowConfirmationGrid(false);
      }
    } catch (error) {
      toast.error(`Failed to create ${item.type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRejectItem = async (index: number) => {
    const item = pendingItems[index];
    setPendingItems(prev => prev.filter((_, i) => i !== index));
    
    // Close grid if no more items
    if (pendingItems.length === 1) {
      setShowConfirmationGrid(false);
    }
    
    toast.info(`${item.type} creation cancelled`);

    if (item.functionCall && item.responseId && threadId) {
      try {
        await markFunctionCallsAsConfirmed({
          threadId,
          responseId: item.responseId,
          results: [{
            callId: item.functionCall.callId,
            result: undefined,
          }],
        });
      } catch (error) {
        console.error("Failed to mark function call as rejected", error);
      }
    }

    // Append assistant message so the chat reflects the rejection
    setChatHistory(prev => [
      ...prev,
      {
        role: "assistant",
        content: `❌ Rejected ${item.type} suggestion${item.data?.title ? `: "${item.data.title}"` : ""}.`,
      },
    ]);
  };

  const handleRejectAll = async () => {
    const itemsToReject = [...pendingItems];
    setPendingItems([]);
    setShowConfirmationGrid(false);
    toast.info("All item creations cancelled");

    if (threadId) {
      const groupedResults = new Map<string, { callId: string; result: string | undefined }[]>();
      for (const item of itemsToReject) {
        if (item.functionCall && item.responseId) {
          if (!groupedResults.has(item.responseId)) {
            groupedResults.set(item.responseId, []);
          }
          groupedResults.get(item.responseId)!.push({
            callId: item.functionCall.callId,
            result: undefined,
          });
        }
      }

      for (const [responseId, results] of groupedResults.entries()) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId,
            responseId,
            results,
          });
        } catch (error) {
          console.error("Failed to mark function calls as rejected", error);
        }
      }
    }

    setChatHistory(prev => [
      ...prev,
      {
        role: "assistant",
        content: "❌ Rejected all pending AI suggestions.",
      },
    ]);
  };

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(true);
    setCurrentItemIndex(index);
  };

  // Helper function to confirm a single item
  const confirmSingleItem = async (item: PendingItem) => {
    if (!project) throw new Error("No project available");

    let result;

    // Call appropriate function based on operation type
    if (item.operation === 'bulk_create') {
      switch (item.type) {
        case 'task': {
          const data = item.data as BulkTaskData;
          const tasks = Array.isArray(data.tasks) ? data.tasks : [];

          if (tasks.length === 0) {
            throw new Error("No tasks provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const taskData of tasks) {
            try {
              const cleanTaskData = { ...taskData };
              delete (cleanTaskData as Record<string, unknown>).assignedToName;

              const taskResult = await createConfirmedTask({
                projectId: project._id,
                taskData: cleanTaskData as {
                  title: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  description?: string;
                  assignedTo?: string | null;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  dueDate?: string;
                  tags?: string[];
                  cost?: number;
                },
              });

              if (taskResult.success && taskResult.taskId) {
                createdIds.push(taskResult.taskId);
              } else if (!taskResult.success) {
                errors.push(taskResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${tasks.length} tasks successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'note': {
          const data = item.data as BulkNoteData;
          const notes = Array.isArray(data.notes) ? data.notes : [];

          if (notes.length === 0) {
            throw new Error("No notes provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const noteData of notes) {
            try {
              const noteResult = await createConfirmedNote({
                projectId: project._id,
                noteData: noteData as { title: string; content: string },
              });

              if (noteResult.success && noteResult.noteId) {
                createdIds.push(noteResult.noteId);
              } else if (!noteResult.success) {
                errors.push(noteResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${notes.length} notes successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'shopping': {
          const data = item.data as BulkShoppingData;
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length === 0) {
            throw new Error("No shopping items provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const shoppingData of items) {
            try {
              const { sectionName: _sectionName, ...shoppingItemData } = shoppingData;
              void _sectionName;

              const shoppingResult = await createConfirmedShoppingItem({
                projectId: project._id,
                itemData: shoppingItemData as {
                  name: string;
                  quantity: number;
                  notes?: string;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  buyBefore?: string;
                  supplier?: string;
                  category?: string;
                  unitPrice?: number;
                  sectionId?: Id<'shoppingListSections'>;
                },
              });

              if (shoppingResult.success && shoppingResult.itemId) {
                createdIds.push(shoppingResult.itemId);
              } else if (!shoppingResult.success) {
                errors.push(shoppingResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${items.length} shopping items successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'survey': {
          const data = item.data as BulkSurveyData;
          const surveys = Array.isArray(data.surveys) ? data.surveys : [];

          if (surveys.length === 0) {
            throw new Error("No surveys provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const surveyData of surveys) {
            try {
              const surveyResult = await createConfirmedSurvey({
                projectId: project._id,
                surveyData: extractSurveyData(surveyData as Record<string, unknown>),
              });

              if (surveyResult.success && surveyResult.surveyId) {
                createdIds.push(surveyResult.surveyId);
              } else if (!surveyResult.success) {
                errors.push(surveyResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${surveys.length} surveys successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        default:
          throw new Error(`Unsupported bulk create type: ${item.type}`);
      }
    } else if (item.operation === 'delete') {
      // Handle delete operations
      switch (item.type) {
        case 'task':
          await deleteTask({ taskId: item.data.taskId as Id<"tasks"> });
          result = { success: true, message: "Task deleted successfully" };
          break;
        case 'note':
          await deleteNote({ noteId: item.data.noteId as Id<"notes"> });
          result = { success: true, message: "Note deleted successfully" };
          break;
        case 'shopping':
          await deleteShoppingItem({ itemId: item.data.itemId as Id<"shoppingListItems"> });
          result = { success: true, message: "Shopping item deleted successfully" };
          break;
        case 'shoppingSection':
          await deleteShoppingSection({ sectionId: item.data.sectionId as Id<"shoppingListSections"> });
          result = { success: true, message: "Shopping section deleted successfully" };
          break;
        case 'survey':
          await deleteSurvey({ surveyId: item.data.surveyId as Id<"surveys"> });
          result = { success: true, message: "Survey deleted successfully" };
          break;
        case 'contact':
          await deleteContact({ contactId: item.data.contactId as Id<"contacts"> });
          result = { success: true, message: "Contact deleted successfully" };
          break;
        default:
          throw new Error(`Unknown content type for deletion: ${item.type}`);
      }
    } else if (item.operation === 'edit') {
      // Handle edit operations
      switch (item.type) {
        case 'task':
          // Clean updates - remove technical fields that are only for UI display
          const cleanUpdates = { ...(item.updates as Record<string, unknown>) };
          delete (cleanUpdates as Record<string, unknown>).assignedToName;
          
          result = await editConfirmedTask({
            taskId: item.originalItem?._id as Id<"tasks">,
            updates: cleanUpdates
          });
          break;
        case 'note':
          result = await editConfirmedNote({
            noteId: item.originalItem?._id as Id<"notes">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        case 'shopping':
          result = await editConfirmedShoppingItem({
            itemId: item.originalItem?._id as Id<"shoppingListItems">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        case 'shoppingSection':
          await updateShoppingSection({
            sectionId: item.originalItem?._id as Id<"shoppingListSections">,
            name: item.data.name as string,
          });
          result = { success: true, message: "Shopping section updated successfully" };
          break;
        case 'survey':
          result = await editConfirmedSurvey({
            surveyId: item.originalItem?._id as Id<"surveys">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        default:
          throw new Error(`Unknown content type for editing: ${item.type}`);
      }
    } else {
      // Handle create operations
      switch (item.type) {
      case 'task':
        if (item.operation === 'bulk_edit') {
          const selection = extractBulkSelection(item);
          const updates = extractBulkUpdates(item);

          result = await bulkEditConfirmedTasks({
            projectId: project._id,
            selection,
            updates: updates as {
              title?: string;
              description?: string;
              status?: 'todo' | 'in_progress' | 'review' | 'done';
              priority?: 'low' | 'medium' | 'high' | 'urgent';
              assignedTo?: string | null;
              tags?: string[];
            },
            reason: selection.reason,
          });
        } else {
          const cleanTaskData = { ...(item.data as Record<string, unknown>) };
          delete (cleanTaskData as Record<string, unknown>).assignedToName;
          result = await createConfirmedTask({
            projectId: project._id,
            taskData: cleanTaskData as {
              title: string;
              status?: 'todo' | 'in_progress' | 'review' | 'done';
              description?: string;
              assignedTo?: string | null;
              priority?: 'low' | 'medium' | 'high' | 'urgent';
              dueDate?: string;
              tags?: string[];
              cost?: number;
            },
          });
        }
        break;
        case 'note':
          result = await createConfirmedNote({
            projectId: project._id,
            noteData: item.data as { title: string; content: string; }
          });
          break;
        case 'shopping':
          const { sectionName: _sectionName, ...shoppingItemData } = item.data as { sectionName?: string; [key: string]: unknown; };
          void _sectionName; // Mark as intentionally unused
          result = await createConfirmedShoppingItem({
            projectId: project._id,
            itemData: shoppingItemData as { name: string; quantity: number; notes?: string; priority?: "low" | "medium" | "high" | "urgent"; buyBefore?: string; supplier?: string; category?: string; unitPrice?: number; sectionId?: Id<"shoppingListSections">; }
          });
          break;
        case 'shoppingSection':
          await createShoppingSection({
            projectId: project._id,
            name: item.data.name as string,
          });
          result = { success: true, message: "Shopping section created successfully" };
          break;
        case 'survey':
          result = await createConfirmedSurvey({
            projectId: project._id,
            surveyData: extractSurveyData(item.data)
          });
          break;
        default:
          throw new Error(`Unknown content type: ${item.type}`);
      }
    }

    if (!result.success) {
      throw new Error(result.message || "Failed to create item");
    }

    return result;
  };

  const handleContentCancel = () => {
    // If we came from grid edit, go back to grid
    if (editingItemIndex !== null) {
      setEditingItemIndex(null);
      setIsConfirmationDialogOpen(false);
      setShowConfirmationGrid(true);
      return;
    }
    
    // Move to next item or close dialog
    if (currentItemIndex < pendingItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      setIsConfirmationDialogOpen(false);
      setPendingItems([]);
      setCurrentItemIndex(0);
      toast.info("Content creation cancelled");
    }
  };

  const handleContentDialogClose = () => {
    // If we came from grid edit, go back to grid
    if (editingItemIndex !== null) {
      setEditingItemIndex(null);
      setIsConfirmationDialogOpen(false);
      setShowConfirmationGrid(true);
      return;
    }
    
    setIsConfirmationDialogOpen(false);
    setPendingItems([]);
    setCurrentItemIndex(0);
    toast.info("Content creation cancelled");
  };

  const handleContentEdit = (updatedItem: { type: 'task' | 'note' | 'shopping' | 'survey' | 'contact' | 'shoppingSection'; operation?: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create'; data: Record<string, unknown>; updates?: Record<string, unknown>; originalItem?: Record<string, unknown>; selection?: Record<string, unknown>; }) => {
    // Update the current item in pendingItems array
    setPendingItems(prev => {
      const updated = [...prev];
      updated[currentItemIndex] = updatedItem;
      return updated;
    });
    
    // If we came from grid edit, go back to grid
    if (editingItemIndex !== null) {
      setEditingItemIndex(null);
      setIsConfirmationDialogOpen(false);
      setShowConfirmationGrid(true);
      toast.info("Item updated - returning to grid");
    } else {
      toast.info("Element został zaktualizowany");
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };


  const handleNewChat = async () => {
    // Note: We only clear local state - thread messages are handled server-side
    // Reset local state
    setChatHistory([]);
    setThreadId(undefined);
    setPendingItems([]);
    setCurrentItemIndex(0);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(false);
    setEditingItemIndex(null);
    setSessionTokens({ total: 0, cost: 0 });
    toast.success("Chat cleared!");
  };

  // ProjectProvider handles loading state, so project should always be available here

  const aiEnabled = aiSettings?.isEnabled ?? true;

  if (aiSettings === undefined) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Building className="h-8 w-8 text-black animate-pulse" />
            <span className="text-2xl font-semibold text-foreground">VibePlanner</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-foreground rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold">AI Assistant (GPT-5)</h1>
              {currentMode && (
                <Badge variant={currentMode === 'rag' ? 'default' : 'secondary'} className="text-xs">
                  {currentMode === 'rag' ? (
                    <>
                      <Database className="h-3 w-3 mr-1" />
                      Full Mode
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Smart Mode
                    </>
                  )}
                </Badge>
              )}
              {sessionTokens.total > 0 && (
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {sessionTokens.total.toLocaleString()} tokens (~${sessionTokens.cost.toFixed(4)})
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {aiEnabled
                ? currentMode === 'rag'
                  ? "GPT-5 with project context"
                  : currentMode === 'basic'
                    ? "GPT-5 smart mode"
                    : "GPT-5 AI Assistant"
                : "Enable AI to start chatting with your project assistant"
              }
            </p>
          </div>

        <div className="flex items-center gap-2">
            <InlinePromptManager />
          <Button
            onClick={handleNewChat}
            variant="outline"
            size="sm"
            disabled={!aiEnabled}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            New Chat
          </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {!aiEnabled && (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-card border shadow-sm rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Enable AI Assistant</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Turn on the AI assistant in project settings to start chatting about tasks, notes, shopping lists, and surveys.
              </p>
            </div>
          )}

          {chatHistory.length === 0 && aiEnabled && (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-card border shadow-sm rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">GPT-5 AI Ready</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                Powered by GPT-5. Ask me about your project tasks, shopping lists, notes, surveys, or any questions about your project.
              </p>
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Small projects: Full data
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Large projects: Smart mode
                </div>
              </div>
            </div>
          )}
          
          {chatHistory.map((chat, index) => (
            <div key={index} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${
                chat.role === 'user' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'bg-card border shadow-sm'
              } rounded-xl px-4 py-3`}>
                {chat.content === '' && chat.role === 'assistant' ? (
                  // Show smart typing indicator
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {currentMode === 'rag' ? 'AI searching & analyzing...' : 'AI thinking...'}
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{chat.content}</p>
                    {chat.fileInfo && <FileThumbnail fileInfo={chat.fileInfo} />}
                    {chat.role === 'assistant' && (chat.mode || chat.tokenUsage) && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
                        {chat.mode && (
                          <Badge variant="outline" className="text-xs">
                            {chat.mode === 'full' ? (
                              <>
                                <Database className="h-2 w-2 mr-1" />
                                Complete project data
                              </>
                            ) : (
                              <>
                                <Zap className="h-2 w-2 mr-1" />
                                Recent + historical search
                              </>
                            )}
                          </Badge>
                        )}
                        {chat.tokenUsage && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <DollarSign className="h-2 w-2 mr-1" />
                            {chat.tokenUsage.totalTokens.toLocaleString()} tokens (${chat.tokenUsage.estimatedCostUSD.toFixed(4)})
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-background p-6">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,video/*,application/pdf,.doc,.docx,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf"
          className="hidden"
        />

        {/* Selected file preview */}
        {selectedFile && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              File will be uploaded to Gemini Files API for direct AI analysis
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isUploading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={selectedFile ? "Add a message (optional)" : "Ask me about tasks, budget, timeline, or say hello..."}
            disabled={isLoading || isUploading}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading || isUploading}
            onClick={handleAttachmentClick}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || isUploading || (!message.trim() && !selectedFile)}
            size="sm"
          >
            {isLoading || isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Grid Modal for Multiple Items */}
      {showConfirmationGrid && (
        <Dialog open={showConfirmationGrid} onOpenChange={setShowConfirmationGrid}>
          <DialogContent 
            className="overflow-hidden p-8"
            style={{
              width: '95vw',
              height: '95vh',
              maxWidth: 'none',
              maxHeight: 'none',
              margin: 'auto'
            }}
          >
            <DialogHeader>
              <DialogTitle>Review AI Suggestions</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 w-full h-full">
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
          onEdit={handleContentEdit}
          contentItem={pendingItems[currentItemIndex] as PendingContentItem}
          isLoading={isCreatingContent}
          itemNumber={currentItemIndex + 1}
          totalItems={pendingItems.length}
        />
      )}
    </div>
  );
};

export default AIAssistantSmart;
