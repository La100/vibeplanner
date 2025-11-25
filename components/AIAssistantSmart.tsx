"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { useProject } from '@/components/providers/ProjectProvider';
import { Loader2, Paperclip, X, Building, FileText, Image, File, Plus, ArrowUpRight, Square, MessageSquare } from "lucide-react";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";
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
  startDate?: string;
  endDate?: string;
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

type ContactInput = {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  website?: string;
  taxId?: string;
  type: "contractor" | "supplier" | "subcontractor" | "other";
  notes?: string;
};

type ChatHistoryEntry = {
  role: 'user' | 'assistant';
  content: string;
  messageIndex?: number;
  mode?: "full" | "recent";
  tokenUsage?: { totalTokens: number; estimatedCostUSD: number };
  fileInfo?: { name: string; size: number; type: string; id: string };
};

const normalizeModeForDisplay = (mode?: string | null): "full" | "recent" | undefined => {
  if (!mode) {
    return undefined;
  }

  const normalized = mode.toLowerCase();
  if (
    normalized === "full" ||
    normalized.includes("advanced") ||
    normalized.includes("long") ||
    normalized.includes("rag")
  ) {
    return "full";
  }

  if (normalized === "recent") {
    return "recent";
  }

  return "recent";
};

const computeNextMessageIndex = (history: ChatHistoryEntry[]) =>
  history.reduce(
    (max, entry) => (typeof entry.messageIndex === "number" ? Math.max(max, entry.messageIndex) : max),
    -1
  ) + 1;

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

      if (item.operation === "bulk_edit") {
        const changeSummary = Array.isArray(item.data?.changeSummary)
          ? (item.data!.changeSummary as string[])
          : [];

        const count =
          Array.isArray(item.selection?.taskIds)
            ? (item.selection!.taskIds as string[]).length
            : Array.isArray(item.data?.tasks)
            ? (item.data!.tasks as unknown[]).length
            : 0;

        const summaryPreview =
          changeSummary.length > 0
            ? changeSummary.slice(0, 3).join(" • ")
            : (() => {
                const updatesSource = item.updates || (item.data?.updates as Record<string, unknown>) || {};
                const updateKeys = Object.keys(updatesSource).filter((key) => updatesSource[key] !== undefined);
                if (updateKeys.length === 0) {
                  return "Review bulk changes before confirming.";
                }
                const labels = updateKeys.map((key) => {
                  switch (key) {
                    case "status":
                      return `Status → ${updatesSource[key]}`;
                    case "priority":
                      return `Priority → ${updatesSource[key]}`;
                    case "assignedTo":
                      return "Assigned user updated";
                    case "tags":
                      return Array.isArray(updatesSource[key])
                        ? `Tags → ${(updatesSource[key] as string[]).join(", ")}`
                        : "Tags updated";
                    case "title":
                      return `Title → ${updatesSource[key]}`;
                    case "description":
                      return "Description updated";
                    default:
                      return `${key} updated`;
                  }
                });
                return labels.join(" • ");
              })();

        return {
          ...item,
          display: {
            title: `Bulk edit ${count || "selected"} task${count === 1 ? "" : "s"}`,
            description: summaryPreview,
          },
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

const sanitizeContactData = (data: Record<string, unknown>): ContactInput => {
  const name =
    typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : "Untitled Contact";

  const allowedTypes = new Set(["contractor", "supplier", "subcontractor", "other"]);
  const typeCandidate = typeof data.type === "string" ? data.type.toLowerCase().trim() : "";
  const type = (allowedTypes.has(typeCandidate) ? typeCandidate : "other") as ContactInput["type"];

  const optionalStringFields: Array<keyof Omit<ContactInput, "name" | "type">> = [
    "companyName",
    "email",
    "phone",
    "address",
    "city",
    "postalCode",
    "website",
    "taxId",
    "notes",
  ];

  const sanitized: ContactInput = { name, type };

  for (const field of optionalStringFields) {
    const value = data[field];
    if (typeof value === "string" && value.trim().length > 0) {
      sanitized[field] = value.trim();
    }
  }

  return sanitized;
};

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

  const taskDetails = Array.isArray(item.data?.taskDetails)
    ? (item.data!.taskDetails as Array<{
        taskId: string;
        original?: Record<string, unknown>;
        updates: Record<string, unknown>;
        changeSummary?: string;
      }>)
    : [];

  if (taskDetails.length > 0) {
    return taskDetails.map((detail) => {
      const taskId = detail.taskId;
      const original = detail.original || {};
      const updates = detail.updates || {};
      const taskTitle =
        (original?.title as string) ||
        (item.data?.title as string) ||
        (item.originalItem?.title as string) ||
        "Task";
      const description =
        detail.changeSummary ||
        Object.entries(updates)
          .map(([key, value]) => `${key} → ${String(value)}`)
          .join(" • ") ||
        "Review task changes before confirming.";

      return {
        type: 'task' as const,
        operation: 'edit' as const,
        data: {
          ...original,
          ...updates,
          taskId,
        },
        updates,
        originalItem: original,
        selection: {
          applyToAll: false,
          taskIds: [taskId],
        },
        display: {
          title: `Update task: ${taskTitle}`,
          description,
        },
        functionCall: item.functionCall,
        responseId: item.responseId,
      } satisfies PendingItem;
    });
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
  const { project, team } = useProject();
  const greetingName =
    user?.firstName ||
    user?.fullName?.split(" ")[0] ||
    project?.name ||
    "there";
  
  // Check if AI is enabled for this project
  const aiSettings = useQuery(
    api.ai.settings.getAISettings,
    project ? { projectId: project._id } : "skip"
  );
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [initialThreadSelectionDone, setInitialThreadSelectionDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentMode, setCurrentMode] = useState<'full' | 'recent' | null>(null);
  const [sessionTokens, setSessionTokens] = useState({ total: 0, cost: 0 });
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]); // New unified system
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [showConfirmationGrid, setShowConfirmationGrid] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userThreads = useQuery(
    api.ai.threads.listThreadsForUser,
    project && user?.id
      ? { projectId: project._id, userClerkId: user.id }
      : "skip"
  );
  const persistedMessages = useQuery(
    api.ai.threads.listThreadMessages,
    project && threadId && user?.id
      ? { threadId, projectId: project._id, userClerkId: user.id }
      : "skip"
  );
  const quickPrompts = [
    {
      label: "Plan",
      prompt: "Sketch a focused renovation plan for this week with the key tasks and owners.",
    },
    {
      label: "Budget",
      prompt: "Review our remodeling budget and flag any cost overruns we should tackle.",
    },
    {
      label: "Supplies",
      prompt: "Prepare a materials shopping list for the upcoming work sessions.",
    },
    {
      label: "Update",
      prompt: "Draft a client update summarizing today’s progress on the remodel.",
    },
    {
      label: "Risks",
      prompt: "List potential blockers that might delay the renovation timeline.",
    },
  ];
  
  const handleQuickPromptClick = (prompt: string) => {
    setMessage(prompt);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleThreadSelect = (selectedThreadId: string) => {
    if (selectedThreadId === threadId) {
      return;
    }
    handleStopResponse();
    setInitialThreadSelectionDone(true);
    setThreadId(selectedThreadId);
    setChatHistory([]);
    setMessage("");
    setSelectedFile(null);
    setUploadedFileId(null);
    setPendingItems([]);
    setCurrentItemIndex(0);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(false);
    setEditingItemIndex(null);
    setSessionTokens({ total: 0, cost: 0 });
    setCurrentMode(null);
    setIsUploading(false);
  };

  const handleStopResponse = useCallback(() => {
    // Clear any pending stream update timeout
    if (streamUpdateTimeoutRef.current) {
      clearTimeout(streamUpdateTimeoutRef.current);
      streamUpdateTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && abortControllerRef.current) {
        event.preventDefault();
        handleStopResponse();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleStopResponse]);

  // Removed auto-loading of last thread - always start with empty chat
  useEffect(() => {
    if (!initialThreadSelectionDone) {
      setInitialThreadSelectionDone(true);
    }
  }, [initialThreadSelectionDone]);

  useEffect(() => {
    if (!persistedMessages) {
      return;
    }

    setChatHistory((prev) => {
      const maxPrevIndex = prev.reduce(
        (max, entry) => (typeof entry.messageIndex === "number" ? Math.max(max, entry.messageIndex) : max),
        -1
      );
      const maxServerIndex = persistedMessages.reduce(
        (max, entry) => Math.max(max, entry.messageIndex),
        -1
      );

      if (maxServerIndex < maxPrevIndex) {
        return prev;
      }

      const formatted: ChatHistoryEntry[] = persistedMessages.map((entry) => {
        const metadata = entry.metadata;
        const fileInfo =
          metadata?.fileId
            ? {
                id: metadata.fileId,
                name: metadata.fileName ?? "Attachment",
                type: metadata.fileType ?? "application/octet-stream",
                size: metadata.fileSize ?? 0,
              }
            : undefined;

        return {
          role: entry.role,
          content: entry.content,
          messageIndex: entry.messageIndex,
          mode: normalizeModeForDisplay(metadata?.mode),
          tokenUsage: entry.tokenUsage
            ? {
                totalTokens: entry.tokenUsage.totalTokens,
                estimatedCostUSD: entry.tokenUsage.estimatedCostUSD,
              }
            : undefined,
          fileInfo,
        };
      });

      const sanitized = formatted.filter(
        (entry) => entry.role !== "assistant" || (entry.content?.trim?.().length ?? 0) > 0
      );

      const isSame =
        prev.length === sanitized.length &&
        prev.every((current, index) => {
          const next = sanitized[index];
          if (!next) {
            return false;
          }

          const currentFileId = current.fileInfo?.id ?? null;
          const nextFileId = next.fileInfo?.id ?? null;
          const currentTokens = current.tokenUsage?.totalTokens ?? null;
          const nextTokens = next.tokenUsage?.totalTokens ?? null;
          const currentCost = current.tokenUsage?.estimatedCostUSD ?? null;
          const nextCost = next.tokenUsage?.estimatedCostUSD ?? null;

          return (
            current.role === next.role &&
            current.content === next.content &&
            current.messageIndex === next.messageIndex &&
            current.mode === next.mode &&
            currentFileId === nextFileId &&
            currentTokens === nextTokens &&
            currentCost === nextCost
          );
        });

      if (isSame) {
        return prev;
      }

      return sanitized;
    });
  }, [persistedMessages]);

  useEffect(() => {
    if (!persistedMessages) {
      return;
    }

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (streamUpdateTimeoutRef.current) {
        clearTimeout(streamUpdateTimeoutRef.current);
        streamUpdateTimeoutRef.current = null;
      }
    };
  }, []);

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
  const userInitial =
    (
      user?.firstName?.[0] ??
      user?.fullName?.[0] ??
      user?.emailAddresses?.[0]?.emailAddress?.[0] ??
      project?.name?.[0] ??
      "U"
    )
      ?.toUpperCase?.() ?? "U";
  
  const TypingIndicator = () => (
    <div className="flex items-center justify-start">
      <span className="sr-only">Assistant is typing</span>
      <div className="relative flex h-4 w-4 items-center justify-center">
        <span className="absolute h-4 w-4 animate-ping rounded-full bg-primary/30" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/50" />
      </div>
    </div>
  );
  
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
      <div className="mt-2 rounded-lg border border-border bg-card p-2">
        <div className="flex items-start gap-2">
          {fileInfo.type.startsWith('image/') && fileWithURL?.url ? (
            <div className="flex-shrink-0">
              <img
                src={fileWithURL.url}
                alt={fileInfo.name}
                className="h-14 w-14 rounded-md border border-border/60 object-cover"
                onError={(e) => {
                  // Fallback to icon on error
                  e.currentTarget.style.display = 'none';
                  const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                  if (nextElement) {
                    nextElement.style.display = 'flex';
                  }
                }}
              />
              <div className="hidden h-14 w-14 items-center justify-center rounded-md border border-border bg-muted">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <FileIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground" title={fileInfo.name}>
              {fileInfo.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {(fileInfo.size / 1024 / 1024).toFixed(1)} MB
            </p>
            <p className="text-xs capitalize text-muted-foreground/80">
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
  
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 240;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [message]);

  // Use the RAG AI system
  const createConfirmedTask = useAction(api.ai.confirmedActions.createConfirmedTask);
  const createConfirmedNote = useAction(api.ai.confirmedActions.createConfirmedNote);
  const createConfirmedShoppingItem = useAction(api.ai.confirmedActions.createConfirmedShoppingItem);
  const createConfirmedSurvey = useAction(api.ai.confirmedActions.createConfirmedSurvey);
  const createConfirmedContact = useAction(api.ai.confirmedActions.createConfirmedContact);
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

  // Query for shopping sections
  const shoppingSections = useQuery(
    api.shopping.getShoppingListSections,
    project?._id ? { projectId: project._id } : "skip"
  );
  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);
  const bulkEditConfirmedTasks = useAction(api.ai.actions.bulkEditConfirmedTasks);
  const createThread = useMutation(api.ai.threads.getOrCreateThreadPublic);
  const markFunctionCallsAsConfirmed = useMutation(api.ai.threads.markFunctionCallsAsConfirmed);

  const handleSendMessage = async () => {
    if (!project || (!message.trim() && !selectedFile) || !user?.id) return;
    if (!aiEnabled) {
      toast.info("Enable the AI assistant to start chatting.");
      return;
    }

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
        setSelectedFile(null);
        setMessage("");
        setIsUploading(false);
      } else {
        setChatHistory((prev) => {
          const nextIndex = computeNextMessageIndex(prev);
          return [...prev, { role: "user", content: userMessage, messageIndex: nextIndex }];
        });
        setMessage("");
      }

      setChatHistory((prev) => {
        const nextIndex = computeNextMessageIndex(prev);
        return [...prev, { role: "assistant", content: "", mode: currentMode ?? undefined, messageIndex: nextIndex }];
      });

      abortControllerRef.current = new AbortController();

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
        signal: abortControllerRef.current!.signal,
      });

      if (!response.body) {
        throw new Error("Streaming response body is missing");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pendingItemsFromStream: PendingItem[] = [];
      let pendingItemsMode: "full" | "recent" | null = null;
      let runningResponse = "";
      let latestTokenUsage: { totalTokens: number; estimatedCostUSD: number } | null = null;
      let partialLine = "";
      
      // Batch updates to prevent "Maximum update depth exceeded" error
      // Use a ref-based throttling mechanism to avoid infinite update loops
      const scheduleUpdate = () => {
        // Clear any existing timeout
        if (streamUpdateTimeoutRef.current) {
          clearTimeout(streamUpdateTimeoutRef.current);
        }
        
        // Schedule a new update with a small delay (throttling)
        streamUpdateTimeoutRef.current = setTimeout(() => {
          setChatHistory((prev) => {
            // Check if there's actually a last entry to update
            if (prev.length === 0) {
              return prev;
            }
            
            const lastIndex = prev.length - 1;
            const lastEntry = prev[lastIndex];
            
            // Only update if content actually changed
            if (lastEntry.content === runningResponse) {
              return prev;
            }
            
            const updated = [...prev];
            updated[lastIndex] = {
              ...lastEntry,
              content: runningResponse,
            };
            return updated;
          });
          streamUpdateTimeoutRef.current = null;
        }, 50); // Throttle to ~20 updates per second max
      };

      const handleStreamEvent = (event: { type?: string; [key: string]: unknown }) => {
        switch (event.type) {
          case "token": {
            if (typeof event.delta === "string") {
              runningResponse += event.delta;
              scheduleUpdate();
            }
            break;
          }
          case "metadata": {
            if (typeof event.mode === "string") {
              const normalizedMode = normalizeModeForDisplay(event.mode);
              pendingItemsMode = normalizedMode ?? null;
              setCurrentMode(normalizedMode ?? null);
            } else {
              pendingItemsMode = null;
              setCurrentMode(null);
            }
            const tokenUsageData =
              event.tokenUsage && typeof event.tokenUsage === "object"
                ? event.tokenUsage as { totalTokens?: number; estimatedCostUSD?: number }
                : undefined;
            if (
              tokenUsageData &&
              typeof tokenUsageData.totalTokens === "number" &&
              typeof tokenUsageData.estimatedCostUSD === "number"
            ) {
              const { totalTokens, estimatedCostUSD } = tokenUsageData;
              latestTokenUsage = {
                totalTokens,
                estimatedCostUSD,
              };
              setSessionTokens((prev) => ({
                total: prev.total + totalTokens,
                cost: prev.cost + estimatedCostUSD,
              }));
            }
            if (typeof event.threadId === "string") {
              setThreadId(event.threadId);
            }
            break;
          }
          case "pendingItems": {
            if (Array.isArray(event.items)) {
              pendingItemsFromStream = expandBulkEditItems(
                normalizePendingItems(event.items as PendingItem[])
              );
            }
            break;
          }
          case "error": {
            const message = typeof event.message === "string" ? event.message : "Streaming error";
            throw new Error(message);
          }
          default: {
            break;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const combined = partialLine + chunk;
        const fragments = combined.split("\n");
        partialLine = fragments.pop() ?? "";
        const lines = fragments.filter((line) => line.trim().length > 0);

        for (const line of lines) {
          const event = JSON.parse(line);
          handleStreamEvent(event);
        }
      }

      if (partialLine.trim().length > 0) {
        try {
          const event = JSON.parse(partialLine);
          handleStreamEvent(event);
        } catch (error) {
          console.error("Failed to parse final stream chunk", error);
        }
      }

      // Clear any pending stream update timeout before final update
      if (streamUpdateTimeoutRef.current) {
        clearTimeout(streamUpdateTimeoutRef.current);
        streamUpdateTimeoutRef.current = null;
      }

      setCurrentMode(pendingItemsMode);

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
        // Expand bulk_create into individual items for grid display
        const expandedItems: PendingItem[] = [];
        for (const item of pendingItemsFromStream) {
          if (item.operation === 'bulk_create') {
            // Extract individual items from bulk operation
            if (item.type === 'task' && item.data.tasks) {
              const tasks = item.data.tasks as Array<Record<string, unknown>>;
              tasks.forEach((taskData) => {
                expandedItems.push({
                  type: 'task',
                  operation: 'create',
                  data: taskData,
                  functionCall: item.functionCall,
                  responseId: item.responseId,
                });
              });
            } else if (item.type === 'shopping' && item.data.items) {
              const items = item.data.items as Array<Record<string, unknown>>;
              items.forEach((shoppingData) => {
                expandedItems.push({
                  type: 'shopping',
                  operation: 'create',
                  data: shoppingData,
                  functionCall: item.functionCall,
                  responseId: item.responseId,
                });
              });
            } else if (item.type === 'note' && item.data.notes) {
              const notes = item.data.notes as Array<Record<string, unknown>>;
              notes.forEach((noteData) => {
                expandedItems.push({
                  type: 'note',
                  operation: 'create',
                  data: noteData,
                  functionCall: item.functionCall,
                  responseId: item.responseId,
                });
              });
            } else if (item.type === 'survey' && item.data.surveys) {
              const surveys = item.data.surveys as Array<Record<string, unknown>>;
              surveys.forEach((surveyData) => {
                expandedItems.push({
                  type: 'survey',
                  operation: 'create',
                  data: surveyData,
                  functionCall: item.functionCall,
                  responseId: item.responseId,
                });
              });
            } else {
              // If we can't expand it, keep it as is
              expandedItems.push(item);
            }
          } else {
            // Not a bulk_create, keep as is
            expandedItems.push(item);
          }
        }

        setPendingItems(expandedItems);
        setCurrentItemIndex(0);

        const firstItem = expandedItems[0];
        const initialOperation = firstItem?.operation;
        const shouldShowGrid =
          expandedItems.length > 1 ||
          firstItem.operation === "bulk_edit";

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
      // Clear any pending stream update timeout on error
      if (streamUpdateTimeoutRef.current) {
        clearTimeout(streamUpdateTimeoutRef.current);
        streamUpdateTimeoutRef.current = null;
      }
      
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatHistory((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          const last = updated[lastIndex];
          if (last?.role === "assistant") {
            updated[lastIndex] = {
              ...last,
              content: last.content || "Response stopped.",
            };
          }
          return updated;
        });
      } else {
        console.error("Error sending message:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        setChatHistory((prev) => prev.slice(0, -1));
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, I encountered an error: ${errorMessage}` },
        ]);
        toast.error("Failed to send message");
      }
    } finally {
      setIsLoading(false);
      setIsUploading(false);
      abortControllerRef.current = null;
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
          case 'shopping': {
            const updates = { ...(currentItem.updates as Record<string, unknown>) };
            const fallbackCategory =
              updates["category"] ??
              (currentItem.data ? (currentItem.data as Record<string, unknown>)["category"] : undefined);
            const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

            if (targetSectionName && !updates["sectionId"]) {
              const sectionId = await findOrCreateSection(targetSectionName);
              if (sectionId) {
                updates["sectionId"] = sectionId;
              }
            }

            delete updates["sectionName"];

            result = await editConfirmedShoppingItem({
              itemId: currentItem.originalItem?._id as Id<"shoppingListItems">,
              updates,
            });
            break;
          }
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
      } else if (currentItem.operation === 'bulk_edit' || currentItem.operation === 'bulk_create') {
        // Use the shared confirmSingleItem function for bulk operations
        result = await confirmSingleItem(currentItem);
      } else {
        // Handle create operations
        switch (currentItem.type) {
          case 'task':
            // Clean data - remove technical fields that are only for UI display
            const cleanTaskData = { ...(currentItem.data as Record<string, unknown>) };
            delete (cleanTaskData as Record<string, unknown>).assignedToName;
            
            result = await createConfirmedTask({
              projectId: project._id,
              taskData: cleanTaskData as { title: string; status?: "todo" | "in_progress" | "review" | "done"; description?: string; assignedTo?: string | null; priority?: "low" | "medium" | "high" | "urgent"; startDate?: string; endDate?: string; tags?: string[]; cost?: number; }
            });
            break;
          case 'note':
            result = await createConfirmedNote({
              projectId: project._id,
              noteData: currentItem.data as { title: string; content: string; }
            });
            break;
          case 'shopping': {
            const rawShoppingData = currentItem.data as ShoppingItemInput;
            const { sectionName, ...shoppingItemData } = rawShoppingData;
            const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

            if (targetSectionName && !shoppingItemData.sectionId) {
              const sectionId = await findOrCreateSection(targetSectionName);
              if (sectionId) {
                shoppingItemData.sectionId = sectionId;
              }
            }

            result = await createConfirmedShoppingItem({
              projectId: project._id,
              itemData: shoppingItemData as {
                name: string;
                quantity: number;
                notes?: string;
                priority?: "low" | "medium" | "high" | "urgent";
                buyBefore?: string;
                supplier?: string;
                category?: string;
                unitPrice?: number;
                sectionId?: Id<"shoppingListSections">;
              },
            });
            break;
          }
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
          case 'contact': {
            const teamSlug = resolveTeamSlug();
            if (!teamSlug) {
              throw new Error("Missing team slug for contact creation");
            }
            result = await createConfirmedContact({
              teamSlug,
              contactData: sanitizeContactData(currentItem.data),
            });
            break;
          }
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

        // Add success message to chat with ID for reference
        let successMessage = `✅ ${result.message}`;

        // Include ID in the message so AI can reference it later
        if ('taskId' in result && result.taskId) {
          successMessage += ` (Task ID: ${result.taskId})`;
        } else if ('noteId' in result && result.noteId) {
          successMessage += ` (Note ID: ${result.noteId})`;
        } else if ('itemId' in result && result.itemId) {
          successMessage += ` (Shopping Item ID: ${result.itemId})`;
        } else if ('surveyId' in result && result.surveyId) {
          successMessage += ` (Survey ID: ${result.surveyId})`;
        } else if ('contactId' in result && result.contactId) {
          successMessage += ` (Contact ID: ${result.contactId})`;
        }

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage
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
      const createdItemsDetails: string[] = [];

      for (const item of pendingItems) {
        try {
          const result = await confirmSingleItem(item);
          successCount++;

          // Collect created item details with IDs
          if (result.success) {
            if ('taskId' in result && result.taskId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Task "${title}" (ID: ${result.taskId})`);
            } else if ('noteId' in result && result.noteId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Note "${title}" (ID: ${result.noteId})`);
            } else if ('itemId' in result && result.itemId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Shopping item "${name}" (ID: ${result.itemId})`);
            } else if ('surveyId' in result && result.surveyId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Survey "${title}" (ID: ${result.surveyId})`);
            } else if ('contactId' in result && result.contactId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Contact "${name}" (ID: ${result.contactId})`);
            }
          }

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

        // Add success message to chat with all created item IDs
        let successMessage = `✅ Successfully created ${successCount} items${failureCount > 0 ? ` (${failureCount} failed)` : ''}`;
        if (createdItemsDetails.length > 0) {
          successMessage += '\n\nCreated items:\n' + createdItemsDetails.join('\n');
        }

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage
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

      // Build success message with ID
      let successMessage = result.message || `${item.type} created successfully`;
      if ('taskId' in result && result.taskId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Task "${title}" created (ID: ${result.taskId})`;
      } else if ('noteId' in result && result.noteId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Note "${title}" created (ID: ${result.noteId})`;
      } else if ('itemId' in result && result.itemId) {
        const name = (item.data as { name?: string }).name || 'Unnamed';
        successMessage = `Shopping item "${name}" created (ID: ${result.itemId})`;
      } else if ('surveyId' in result && result.surveyId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Survey "${title}" created (ID: ${result.surveyId})`;
      } else if ('contactId' in result && result.contactId) {
        const name = (item.data as { name?: string }).name || 'Unnamed';
        successMessage = `Contact "${name}" created (ID: ${result.contactId})`;
      }

      toast.success(successMessage);

      // Add to chat history with ID
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `✅ ${successMessage}`
      }]);

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

  const resolveTeamSlug = () => {
    if (team?.slug && team.slug.length > 0) {
      return team.slug;
    }
    const projectTeamSlug = (project as unknown as { teamSlug?: string } | null)?.teamSlug;
    if (projectTeamSlug && projectTeamSlug.length > 0) {
      return projectTeamSlug;
    }
    return undefined;
  };

  // Helper to pick the best section label (prefer explicit sectionName, fall back to category)
  const resolveSectionName = (rawSectionName?: unknown, rawCategory?: unknown): string | undefined => {
    const normalizedSection =
      typeof rawSectionName === "string" ? rawSectionName.trim() : "";
    if (normalizedSection.length > 0) {
      return normalizedSection;
    }

    const normalizedCategory = typeof rawCategory === "string" ? rawCategory.trim() : "";
    return normalizedCategory.length > 0 ? normalizedCategory : undefined;
  };

  // Helper function to find or create a shopping section by name
  const findOrCreateSection = async (sectionName: string): Promise<Id<"shoppingListSections"> | undefined> => {
    if (!sectionName || !project) return undefined;

    // Find existing section by name (case-insensitive)
    const existingSection = shoppingSections?.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );

    if (existingSection) {
      return existingSection._id;
    }

    // Create new section if it doesn't exist
    try {
      const newSectionId = await createShoppingSection({
        projectId: project._id,
        name: sectionName,
      });
      return newSectionId;
    } catch (error) {
      console.error("Failed to create section:", error);
      return undefined;
    }
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
                  startDate?: string;
                  endDate?: string;
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
              const { sectionName, ...shoppingItemData } = shoppingData;
              const targetSectionName = resolveSectionName(sectionName, shoppingData.category);

              if (targetSectionName && !shoppingItemData.sectionId) {
                const sectionId = await findOrCreateSection(targetSectionName);
                if (sectionId) {
                  shoppingItemData.sectionId = sectionId;
                }
              }

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
        case 'contact': {
          const contacts = Array.isArray(
            (item.data as { contacts?: Array<Record<string, unknown>> }).contacts
          )
            ? ((item.data as { contacts?: Array<Record<string, unknown>> }).contacts as Array<
                Record<string, unknown>
              >)
            : [];

          if (contacts.length === 0) {
            throw new Error("No contacts provided for bulk creation");
          }

          const teamSlug = resolveTeamSlug();
          if (!teamSlug) {
            throw new Error("Missing team slug for contact creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const contact of contacts) {
            try {
              const contactResult = await createConfirmedContact({
                teamSlug,
                contactData: sanitizeContactData(contact),
              });

              if (contactResult.success && contactResult.contactId) {
                createdIds.push(contactResult.contactId);
              } else if (!contactResult.success) {
                errors.push(contactResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${contacts.length} contacts successfully${
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
        case 'shopping': {
          const updates = { ...(item.updates as Record<string, unknown>) };
          const fallbackCategory =
            updates["category"] ?? (item.data ? (item.data as Record<string, unknown>)["category"] : undefined);
          const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

          if (targetSectionName && !updates["sectionId"]) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              updates["sectionId"] = sectionId;
            }
          }

          delete updates["sectionName"];

          result = await editConfirmedShoppingItem({
            itemId: item.originalItem?._id as Id<"shoppingListItems">,
            updates,
          });
          break;
        }
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

          if (Object.keys(updates).length > 0) {
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
          } else if (Array.isArray(item.data?.tasks)) {
            const tasks = item.data.tasks as Array<Record<string, unknown>>;
            if (tasks.length === 0) {
              throw new Error("No tasks provided for bulk edit");
            }

            let updatedCount = 0;
            const errors: string[] = [];

            for (const taskUpdate of tasks) {
              try {
                const { taskId, ...updatesForTask } = taskUpdate as {
                  taskId?: string;
                  [key: string]: unknown;
                };
                if (!taskId) {
                  continue;
                }

                const cleanUpdates = { ...updatesForTask } as Record<string, unknown>;
                delete cleanUpdates.assignedToName;

                const editResult = await editConfirmedTask({
                  taskId: taskId as Id<"tasks">,
                  updates: cleanUpdates as {
                    title?: string;
                    description?: string;
                    content?: string;
                    status?: 'todo' | 'in_progress' | 'review' | 'done';
                    assignedTo?: string | null;
                    priority?: 'low' | 'medium' | 'high' | 'urgent';
                    startDate?: string;
                    endDate?: string;
                    tags?: string[];
                    cost?: number;
                  },
                });

                if (editResult.success) {
                  updatedCount++;
                } else {
                  errors.push(editResult.message);
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(message);
              }
            }

            result = {
              success: errors.length === 0,
              message: errors.length === 0
                ? `Updated ${updatedCount}/${tasks.length} tasks successfully`
                : `Updated ${updatedCount}/${tasks.length} tasks with errors: ${errors.slice(0, 3).join(', ')}`,
            };
          } else {
            throw new Error("No updates provided for bulk edit");
          }
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
              startDate?: string;
              endDate?: string;
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
        case 'shopping': {
          const rawShoppingData = item.data as ShoppingItemInput;
          const { sectionName, ...shoppingItemData } = rawShoppingData;
          const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

          if (targetSectionName && !shoppingItemData.sectionId) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              shoppingItemData.sectionId = sectionId;
            }
          }

          result = await createConfirmedShoppingItem({
            projectId: project._id,
            itemData: shoppingItemData as {
              name: string;
              quantity: number;
              notes?: string;
              priority?: "low" | "medium" | "high" | "urgent";
              buyBefore?: string;
              supplier?: string;
              category?: string;
              unitPrice?: number;
              sectionId?: Id<"shoppingListSections">;
            },
          });
          break;
        }
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
        case 'contact': {
          const teamSlug = resolveTeamSlug();
          if (!teamSlug) {
            throw new Error("Missing team slug for contact creation");
          }
          result = await createConfirmedContact({
            teamSlug,
            contactData: sanitizeContactData(item.data),
          });
          break;
        }
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
    handleStopResponse();

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
    setCurrentMode(null);
    setInitialThreadSelectionDone(true);
    setMessage("");
    setSelectedFile(null);
    setUploadedFileId(null);
    setIsUploading(false);
    toast.success("Chat cleared!");
  };

  // ProjectProvider handles loading state, so project should always be available here

  const threadList = userThreads ?? [];
  const isThreadListLoading = Boolean(project && user?.id) && userThreads === undefined;
  const hasThreads = threadList.length > 0;
  const activeThreadExists = Boolean(
    threadId && threadList.some((thread) => thread.threadId === threadId)
  );
  const mobileSelectValue = activeThreadExists ? (threadId as string) : "";
  const chatIsLoading = Boolean(threadId) && persistedMessages === undefined;

  const aiEnabled = aiSettings?.isEnabled ?? true;
  const isStartingFresh = !threadId && initialThreadSelectionDone;
  const showEmptyState = !chatIsLoading && aiEnabled && chatHistory.length === 0;
  const emptyStateTitle = !hasThreads
    ? `Hi ${greetingName},`
    : isStartingFresh
    ? "Start a new renovation chat"
    : "Select a renovation chat";
  const emptyStateDescription = !hasThreads
    ? "Bring your renovation plans, punch lists, and suppliers into one place."
    : isStartingFresh
    ? "Send the first update to kick off this renovation thread."
    : "Browse your saved renovation chats or launch a fresh one for a new project area.";

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
    <>
      <div className="flex h-full min-h-0 bg-background text-foreground">
      {/* Sidebar with chat history (desktop) */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border/60 bg-card/20 transition-all duration-200 md:flex md:sticky md:self-start md:top-4 md:max-h-[calc(100vh-2rem)] xl:top-8 xl:max-h-[calc(100vh-4rem)]",
          showHistory ? "w-72 lg:w-80" : "w-0"
        )}
      >

        <div
          className={cn(
            "border-b border-border/60 px-4 py-5",
            showHistory ? "block" : "hidden"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Project chats</p>
                <p className="text-xs text-muted-foreground">All your renovation threads</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(false)}
              className="h-7 w-7 rounded-full border border-border"
            >
              <span className="sr-only">Collapse chat history</span>
              ×
            </Button>
          </div>
          <Button
            onClick={handleNewChat}
            size="sm"
            disabled={!aiEnabled}
            className="mt-4 w-full justify-center"
          >
            Start new chat
          </Button>
        </div>
        <div className={cn("flex-1 overflow-y-auto", showHistory ? "block" : "hidden")}>
          {isThreadListLoading ? (
            <div className="px-4 py-6 text-xs text-muted-foreground">Loading chat history…</div>
          ) : hasThreads ? (
            <div className="divide-y divide-border/60">
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
                const messageLabel = thread.messageCount === 1 ? "message" : "messages";
                const relativeTime = formatDistanceToNow(
                  new Date(thread.lastMessageAt ?? Date.now()),
                  { addSuffix: true }
                );

                return (
                  <button
                    key={thread.threadId}
                    onClick={() => handleThreadSelect(thread.threadId)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors focus:outline-none",
                      isActive ? "bg-primary/10" : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{thread.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{preview}</p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                        {relativeTime}
                      </span>
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground/80">
                      {thread.messageCount > 0 ? (
                        <>
                          {thread.messageCount} {messageLabel} • Last{" "}
                          {thread.lastMessageRole === "assistant" ? "assistant" : "you"}
                        </>
                      ) : (
                        <>No messages yet</>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-6 text-xs text-muted-foreground">
              No renovation chats yet. Start one and it will appear here.
            </div>
          )}
        </div>
      </aside>

      {/* Main conversation area */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory((prev) => !prev)}
            className="h-8 w-8 rounded-full border border-border"
          >
            <span className="sr-only">Toggle chat history</span>
            {showHistory ? "×" : "☰"}
          </Button>
          {hasThreads ? (
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="mobile-thread-select">
                Renovation chat
              </label>
              <select
                id="mobile-thread-select"
                value={mobileSelectValue}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    return;
                  }
                  handleThreadSelect(value);
                }}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>
                  Select a conversation…
                </option>
                {threadList.map((thread) => (
                  <option key={thread.threadId} value={thread.threadId}>
                    {thread.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex-1 text-sm font-semibold text-foreground">New renovation chat</div>
          )}
          <Button onClick={handleNewChat} variant="outline" size="sm" disabled={!aiEnabled}>
            New chat
          </Button>
        </div>

        {/* Desktop toolbar */}
        <div className="absolute left-6 top-6 hidden items-center gap-3 z-20 md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory((prev) => !prev)}
            className="h-9 w-9 rounded-lg border border-border bg-card shadow-md hover:bg-muted transition-all"
            title={showHistory ? "Zamknij historię czatów" : "Otwórz historię czatów"}
          >
            <span className="sr-only">Toggle chat history</span>
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Right side toolbar */}
        <div className="absolute right-6 top-6 hidden items-center gap-3 text-xs text-muted-foreground md:flex">
          {sessionTokens.total > 0 && (
            <span>{sessionTokens.total.toLocaleString()} tokens (~${sessionTokens.cost.toFixed(4)})</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {chatIsLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading conversation…
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col space-y-6 py-14">
              {!aiEnabled && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
                  <h3 className="text-lg font-semibold tracking-tight">Enable AI Assistant</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Turn on the AI assistant in project settings to start chatting about tasks, notes, shopping lists, and surveys.
                  </p>
                </div>
              )}

              {showEmptyState ? (
                <div className="rounded-2xl border border-border bg-card/60 p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-lg text-muted-foreground">
                    ✶
                  </div>
                  <div className="mt-6 space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight">{emptyStateTitle}</h1>
                    <p className="text-sm text-muted-foreground">{emptyStateDescription}</p>
                  </div>
                  <div className="mt-6 grid gap-3 text-left text-sm text-muted-foreground">
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-3">
                      • Ask about schedules, dependencies, or the next milestones for this renovation.
                    </div>
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-3">
                      • Attach floor plans, invoices, or site photos—I'll surface the details that matter.
                    </div>
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 px-4 py-3">
                      • Use the quick actions below to spin up budgets, shopping lists, or site updates.
                    </div>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
                    {quickPrompts.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => handleQuickPromptClick(item.prompt)}
                        className="rounded-full border border-transparent bg-muted/40 px-3 py-1.5 transition hover:border-border hover:bg-muted"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatHistory.map((chat, index) => {
                    if (chat.role === "assistant" && chat.content === "") {
                      return (
                        <div key={index} className="flex justify-start">
                          <TypingIndicator />
                        </div>
                      );
                    }

                    const isUser = chat.role === "user";

                    return (
                      <div
                        key={index}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex max-w-full items-start gap-3 ${
                            isUser ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold uppercase ${
                              isUser
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {isUser ? userInitial : "✶"}
                          </div>

                          <div
                            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                              isUser
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-card text-foreground"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{chat.content}</p>
                            {chat.fileInfo && (
                              <div className="mt-3">
                                <FileThumbnail fileInfo={chat.fileInfo} />
                              </div>
                            )}
                            {chat.role === "assistant" && (chat.mode || chat.tokenUsage) && (
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {chat.mode && (
                                  <Badge variant="outline" className="border-border bg-muted/60 text-[11px] text-muted-foreground">
                                    {chat.mode === "full" ? "Complete project data" : "Recent context search"}
                                  </Badge>
                                )}
                                {chat.tokenUsage && (
                                  <Badge variant="outline" className="border-border bg-muted/60 text-[11px] text-muted-foreground">
                                    {chat.tokenUsage.totalTokens.toLocaleString()} tokens (${chat.tokenUsage.estimatedCostUSD.toFixed(4)})
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          )}
        </div>

        <div className="bg-background px-6 pb-10 pt-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-sm">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.xlsm,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf"
            className="hidden"
          />

          {selectedFile && (
            <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                <span className="flex-1 truncate">{selectedFile.name}</span>
                <span className="text-xs">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  className="h-6 w-6 rounded-full p-0 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted"
                onClick={handleAttachmentClick}
                disabled={isLoading || isUploading || !aiEnabled}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading && !isUploading && aiEnabled) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={selectedFile ? "Add a message (optional)" : "Ask about renovation tasks, materials, or next steps..."}
              disabled={isUploading || !aiEnabled}
              rows={1}
              className="flex-1 resize-none border-none bg-transparent p-0 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {isLoading && !isUploading ? (
              <Button
                onClick={handleStopResponse}
                size="icon"
                className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                title="Stop response"
              >
                <Square className="h-4 w-4" />
                <span className="sr-only">Stop response</span>
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={isUploading || !aiEnabled || (!message.trim() && !selectedFile)}
                size="icon"
                className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
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
        onEdit={handleContentEdit}
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
