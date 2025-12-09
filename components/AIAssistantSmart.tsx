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
import { Loader2, Paperclip, X, FileText, ArrowUp, Square, MessageSquare, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PendingContentItem } from "@/components/AIConfirmationGrid";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UniversalConfirmationDialog } from "@/components/UniversalConfirmationDialog";
import { AIConfirmationGrid } from "@/components/AIConfirmationGrid";

type PendingItem = {
  type: 
    | 'task' 
    | 'note' 
    | 'shopping' 
    | 'survey' 
    | 'contact' 
    | 'shoppingSection'
    | 'create_task'
    | 'create_note'
    | 'create_shopping_item'
    | 'create_survey'
    | 'create_contact'
    | 'create_multiple_tasks'
    | 'create_multiple_notes'
    | 'create_multiple_shopping_items'
    | 'create_multiple_surveys';
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

const pendingItemTypes: PendingItem["type"][] = [
  "task",
  "note",
  "shopping",
  "survey",
  "contact",
  "shoppingSection",
  "create_task",
  "create_note",
  "create_shopping_item",
  "create_survey",
  "create_contact",
  "create_multiple_tasks",
  "create_multiple_notes",
  "create_multiple_shopping_items",
  "create_multiple_surveys",
];

const isPendingItemType = (value: unknown): value is PendingItem["type"] =>
  typeof value === "string" && pendingItemTypes.includes(value as PendingItem["type"]);

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
  status?: "streaming" | "finished" | "aborted";
};

// Remove unknown shopping fields so Convex validators stay happy
const sanitizeShoppingItemData = (data: Record<string, unknown>) => {
  const allowedKeys = [
    "name",
    "quantity",
    "notes",
    "priority",
    "buyBefore",
    "supplier",
    "category",
    "unitPrice",
    "totalPrice",
    "sectionId",
  ] as const;

  const sanitized: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
};

const computeNextMessageIndex = (history: ChatHistoryEntry[]) =>
  history.reduce(
    (max, entry) => (typeof entry.messageIndex === "number" ? Math.max(max, entry.messageIndex) : max),
    -1
  ) + 1;

const normalizePendingItems = (items: PendingItem[]): PendingItem[] =>
  items.map((originalItem) => {
    // Normalize tool-based types (create_*, create_multiple_*) into canonical types and operations
    const normalizeTypeAndOperation = (item: PendingItem) => {
      let type = item.type;
      let operation = item.operation;

      // Map tool function names to canonical types/operations when the payload lacks them
      const toolNameMapping: Record<string, { type: PendingItem["type"]; operation: PendingItem["operation"] }> = {
        edit_task: { type: "task", operation: "edit" },
        edit_multiple_tasks: { type: "task", operation: "bulk_edit" },
        delete_task: { type: "task", operation: "delete" },
        edit_note: { type: "note", operation: "edit" },
        edit_multiple_notes: { type: "note", operation: "bulk_edit" },
        delete_note: { type: "note", operation: "delete" },
        edit_shopping_item: { type: "shopping", operation: "edit" },
        edit_multiple_shopping_items: { type: "shopping", operation: "bulk_edit" },
        delete_shopping_item: { type: "shopping", operation: "delete" },
        create_shopping_section: { type: "shoppingSection", operation: "create" },
        edit_shopping_section: { type: "shoppingSection", operation: "edit" },
        delete_shopping_section: { type: "shoppingSection", operation: "delete" },
        edit_survey: { type: "survey", operation: "edit" },
        edit_multiple_surveys: { type: "survey", operation: "bulk_edit" },
        delete_survey: { type: "survey", operation: "delete" },
        delete_contact: { type: "contact", operation: "delete" },
      };

      if (toolNameMapping[type]) {
        const mapped = toolNameMapping[type];
        type = mapped.type;
        operation = operation ?? mapped.operation;
      }

      switch (type) {
        case "create_task":
          type = "task";
          operation = operation ?? "create";
          break;
        case "create_note":
          type = "note";
          operation = operation ?? "create";
          break;
        case "create_shopping_item":
          type = "shopping";
          operation = operation ?? "create";
          break;
        case "create_survey":
          type = "survey";
          operation = operation ?? "create";
          break;
        case "create_contact":
          type = "contact";
          operation = operation ?? "create";
          break;
        case "create_multiple_tasks":
          type = "task";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_notes":
          type = "note";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_shopping_items":
          type = "shopping";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_surveys":
          type = "survey";
          operation = operation ?? "bulk_create";
          break;
        default:
          break;
      }

      return {
        ...item,
        type,
        operation: operation ?? item.operation ?? "create",
      } satisfies PendingItem;
    };

    let item = normalizeTypeAndOperation(originalItem);

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

      if (item.operation === "bulk_create") {
        const tasks = Array.isArray(item.data?.tasks)
          ? (item.data!.tasks as TaskInput[])
          : [];
        const preview = tasks
          .slice(0, 3)
          .map((task) => task.title || "Untitled Task")
          .join(" • ");
        const remaining = Math.max(tasks.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
            description:
              tasks.length === 0
                ? "Review tasks before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                    .filter(Boolean)
                    .join(" • "),
          },
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
      if (item.operation === "bulk_create") {
        const notes = Array.isArray(item.data?.notes)
          ? (item.data!.notes as NoteInput[])
          : [];
        const preview = notes
          .slice(0, 3)
          .map((note) => note.title || "Untitled Note")
          .join(" • ");
        const remaining = Math.max(notes.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${notes.length} note${notes.length === 1 ? "" : "s"}`,
            description:
              notes.length === 0
                ? "Review notes before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                    .filter(Boolean)
                    .join(" • "),
          },
        };
      }

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
      if (item.operation === "bulk_create") {
        const items = Array.isArray(item.data?.items)
          ? (item.data!.items as ShoppingItemInput[])
          : [];
        const preview = items
          .slice(0, 3)
          .map((shoppingItem) => shoppingItem.name || "Untitled Item")
          .join(" • ");
        const remaining = Math.max(items.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${items.length} shopping item${items.length === 1 ? "" : "s"}`,
            description:
              items.length === 0
                ? "Review shopping items before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                    .filter(Boolean)
                    .join(" • "),
          },
        };
      }

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
      if (item.operation === "bulk_create") {
        const surveys = Array.isArray(item.data?.surveys)
          ? (item.data!.surveys as Array<Record<string, unknown>>)
          : [];
        const preview = surveys
          .slice(0, 3)
          .map((survey) => (survey.title as string) || "Untitled Survey")
          .join(" • ");
        const remaining = Math.max(surveys.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${surveys.length} survey${surveys.length === 1 ? "" : "s"}`,
            description:
              surveys.length === 0
                ? "Review surveys before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                    .filter(Boolean)
                    .join(" • "),
          },
        };
      }

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
  // Process ALL items and expand bulk operations
  return items.flatMap<PendingItem>((item) => {
    // Format shopping sections with proper display
    if (item.type === 'shoppingSection') {
      return formatShoppingSectionDisplay(item);
    }

    // Handle bulk_create operations - expand into individual items
    if (item.operation === 'bulk_create') {
      const tasks = Array.isArray(item.data?.tasks) ? (item.data.tasks as TaskInput[]) : [];
      const notes = Array.isArray(item.data?.notes) ? (item.data.notes as NoteInput[]) : [];
      const shoppingItems = Array.isArray(item.data?.items) ? (item.data.items as ShoppingItemInput[]) : [];
      const surveys = Array.isArray(item.data?.surveys) ? (item.data.surveys as Array<Record<string, unknown>>) : [];

      if (tasks.length > 0) {
        return tasks.map((task) => ({
          type: 'task' as const,
          operation: 'create' as const,
          data: task,
          display: {
            title: task.title || 'Untitled Task',
            description: task.description || 'New task',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem));
      }

      if (notes.length > 0) {
        return notes.map((note) => ({
          type: 'note' as const,
          operation: 'create' as const,
          data: note,
          display: {
            title: note.title || 'Untitled Note',
            description: note.content ? note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '') : 'New note',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem));
      }

      if (shoppingItems.length > 0) {
        return shoppingItems.map((shoppingItem) => ({
          type: 'shopping' as const,
          operation: 'create' as const,
          data: shoppingItem,
          display: {
            title: shoppingItem.name || 'Untitled Item',
            description: [
              shoppingItem.notes,
              shoppingItem.sectionName && `Section: ${shoppingItem.sectionName}`,
              shoppingItem.category && `Category: ${shoppingItem.category}`,
              shoppingItem.quantity && shoppingItem.quantity > 1 && `Qty: ${shoppingItem.quantity}`,
            ].filter(Boolean).join(' • ') || 'New shopping item',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem));
      }

      if (surveys.length > 0) {
        return surveys.map((survey) => ({
          type: 'survey' as const,
          operation: 'create' as const,
          data: survey,
          display: {
            title: (survey.title as string) || 'Untitled Survey',
            description: (survey.description as string) || 'New survey',
          },
          functionCall: item.functionCall,
          responseId: item.responseId,
        } satisfies PendingItem));
      }

      // If bulk_create but no recognized array, return as-is
      return item;
    }

    // Handle bulk_edit operations for tasks
    if (item.type === 'task' && item.operation === 'bulk_edit') {
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

      if (titleChanges && titleChanges.length > 0) {
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
      }
    }

    // Return non-bulk items as-is
    return item;
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

  // Subscribe to saved messages from our custom aiMessages table
  const savedMessages = useQuery(
    api.ai.threads.listThreadMessages,
    threadId && project && user?.id ? { threadId, projectId: project._id, userClerkId: user.id } : "skip"
  );

  // Load saved messages into chat history when they change
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
      // If server has more messages or different content, update
      const hasMoreMessages = historyFromSaved.length > prev.length;
      if (hasMoreMessages) {
        return historyFromSaved;
      }

      // Check if last message changed
      const lastSaved = historyFromSaved[historyFromSaved.length - 1];
      const lastLocal = prev[prev.length - 1];
      if (lastSaved && lastLocal && lastSaved.content !== lastLocal.content) {
        return historyFromSaved;
      }

      return prev;
    });
  }, [savedMessages]);

  // Fetch pending items for confirmation
  const pendingFunctionCalls = useQuery(
    api.ai.threads.listPendingItems,
    threadId ? { threadId } : "skip"
  );

  useEffect(() => {
    if (pendingFunctionCalls && pendingFunctionCalls.length > 0) {
      const pendingItemsFromDB = pendingFunctionCalls.map<PendingItem | null>((call) => {
        try {
          const parsed = JSON.parse(call.arguments);
          const parsedTypeValue = typeof parsed?.type === "string" ? parsed.type : undefined;
          const parsedType = isPendingItemType(parsedTypeValue) ? parsedTypeValue : undefined;
          const functionCallType = isPendingItemType(call.functionName) ? call.functionName : undefined;
          // Determine structure based on how it was saved
          // If it was a tool call, arguments is the tool input
          return {
            type: parsedType ?? functionCallType ?? "task",
            operation: parsed.operation,
            data: parsed.data || parsed,
            updates: parsed.updates,
            originalItem: parsed.originalItem,
            selection: parsed.selection,
            titleChanges: parsed.titleChanges,
            functionCall: {
              callId: call.callId,
              functionName: call.functionName,
              arguments: call.arguments,
            },
            responseId: call.responseId,
          };
        } catch (e) {
          console.error("Failed to parse pending item:", e);
          return null;
        }
      }).filter((i): i is PendingItem => i !== null);

      if (pendingItemsFromDB.length > 0) {
        const expanded = expandBulkEditItems(normalizePendingItems(pendingItemsFromDB));
        setPendingItems(expanded);
        setCurrentItemIndex(0);

        const firstItem = expanded[0];
        const shouldShowGrid = expanded.length > 1 || firstItem.operation === "bulk_edit" || firstItem.operation === "bulk_create";

        if (shouldShowGrid) {
          setShowConfirmationGrid(true);
          setIsConfirmationDialogOpen(false);
        } else {
          setShowConfirmationGrid(false);
          // Only open dialog if not already open to avoid flickering
          setIsConfirmationDialogOpen(true);
        }
      }
    } else if (pendingFunctionCalls && pendingFunctionCalls.length === 0 && pendingItems.length > 0) {
      // If query returns empty but we have items, it means they were confirmed or we switched threads
      // Clear local items
      setPendingItems([]);
      setShowConfirmationGrid(false);
      setIsConfirmationDialogOpen(false);
    }
  }, [pendingFunctionCalls, pendingItems.length]);

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

  // Calculate session token totals from persisted messages
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
  const clearThread = useMutation(api.ai.threads.clearThreadForUser);

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

      // Add placeholder for assistant response
      setChatHistory((prev) => {
        const nextIndex = computeNextMessageIndex(prev);
        return [...prev, { role: "assistant", content: "Thinking...", mode: currentMode ?? undefined, messageIndex: nextIndex }];
      });

      abortControllerRef.current = new AbortController();

      // Simple request/response - no streaming
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          projectId: project._id,
          userClerkId: user.id,
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
          case 'create_task':
            // Clean updates - remove technical fields that are only for UI display
            const cleanUpdates = { ...(currentItem.updates as Record<string, unknown>) };
            delete (cleanUpdates as Record<string, unknown>).assignedToName;
            
            result = await editConfirmedTask({
              taskId: currentItem.originalItem?._id as Id<"tasks">,
              updates: cleanUpdates
            });
            break;
          case 'note':
          case 'create_note':
            result = await editConfirmedNote({
              noteId: currentItem.originalItem?._id as Id<"notes">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
      case 'shopping':
      case 'create_shopping_item': {
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

            // Drop any AI-added fields not supported by validator
            const sanitizedUpdates = sanitizeShoppingItemData(updates);

            result = await editConfirmedShoppingItem({
              itemId: currentItem.originalItem?._id as Id<"shoppingListItems">,
              updates: sanitizedUpdates,
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
          case 'create_survey':
            result = await editConfirmedSurvey({
              surveyId: currentItem.originalItem?._id as Id<"surveys">,
              updates: currentItem.updates as Record<string, unknown>
            });
            break;
        default:
          throw new Error(`Unknown content type for edit: ${currentItem.type}`);
        }
      } else if (currentItem.operation === 'bulk_edit' || currentItem.operation === 'bulk_create') {
        // Use the shared confirmSingleItem function for bulk operations
        result = await confirmSingleItem(currentItem);
      } else {
        // Handle create operations
        switch (currentItem.type) {
          case 'task':
          case 'create_task':
            // Clean data - remove technical fields that are only for UI display
            const cleanTaskData = { ...(currentItem.data as Record<string, unknown>) };
            delete (cleanTaskData as Record<string, unknown>).assignedToName;
            
            result = await createConfirmedTask({
              projectId: project._id,
              taskData: cleanTaskData as { title: string; status?: "todo" | "in_progress" | "review" | "done"; description?: string; assignedTo?: string | null; priority?: "low" | "medium" | "high" | "urgent"; startDate?: string; endDate?: string; tags?: string[]; cost?: number; }
            });
            break;
          case 'note':
          case 'create_note':
            result = await createConfirmedNote({
              projectId: project._id,
              noteData: currentItem.data as { title: string; content: string; }
            });
            break;
          case 'shopping':
          case 'create_shopping_item': {
            const rawShoppingData = currentItem.data as ShoppingItemInput;
            const { sectionName, ...shoppingItemData } = rawShoppingData;
            const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

            if (targetSectionName && !shoppingItemData.sectionId) {
              const sectionId = await findOrCreateSection(targetSectionName);
              if (sectionId) {
                shoppingItemData.sectionId = sectionId;
              }
            }

            const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData);

            result = await createConfirmedShoppingItem({
              projectId: project._id,
              itemData: sanitizedItemData as {
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
          case 'create_survey':
            result = await createConfirmedSurvey({
              projectId: project._id,
              surveyData: extractSurveyData(currentItem.data)
            });
            break;
          case 'contact':
          case 'create_contact': {
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
            throw new Error(`Unknown content type: ${currentItem.type}`);
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

        // Add success message to chat with item name only (no ID)
        const itemTitle = currentItem.data.title || currentItem.data.name || currentItem.data.content;
        const successMessage = itemTitle
          ? `✅ ${result.message}: ${itemTitle}`
          : `✅ ${result.message}`;

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

          // Collect created item details (names only, no IDs)
          if (result.success) {
            if ('taskId' in result && result.taskId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Task "${title}"`);
            } else if ('noteId' in result && result.noteId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Note "${title}"`);
            } else if ('itemId' in result && result.itemId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Shopping item "${name}"`);
            } else if ('surveyId' in result && result.surveyId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Survey "${title}"`);
            } else if ('contactId' in result && result.contactId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Contact "${name}"`);
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
        case 'create_multiple_tasks':
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
        case 'create_multiple_notes':
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
        case 'create_multiple_shopping_items':
        case 'shopping': {
          const data = item.data as BulkShoppingData;
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length === 0) {
            throw new Error("No shopping items provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          // Pre-create all unique sections to avoid duplicates
          const uniqueSectionNames = new Set<string>();
          for (const shoppingData of items) {
            const { sectionName } = shoppingData;
            const targetSectionName = resolveSectionName(sectionName, shoppingData.category);
            if (targetSectionName && !shoppingData.sectionId) {
              uniqueSectionNames.add(targetSectionName);
            }
          }

          // Create all sections upfront
          const sectionNameToId = new Map<string, Id<"shoppingListSections">>();
          for (const sectionName of uniqueSectionNames) {
            const sectionId = await findOrCreateSection(sectionName);
            if (sectionId) {
              sectionNameToId.set(sectionName, sectionId);
            }
          }

          // Now create items using pre-created section IDs
          for (const shoppingData of items) {
            try {
              const { sectionName, ...shoppingItemData } = shoppingData;
              const targetSectionName = resolveSectionName(sectionName, shoppingData.category);

              if (targetSectionName && !shoppingItemData.sectionId) {
                const sectionId = sectionNameToId.get(targetSectionName);
                if (sectionId) {
                  shoppingItemData.sectionId = sectionId;
                }
              }

              const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData as Record<string, unknown>);

              const shoppingResult = await createConfirmedShoppingItem({
                projectId: project._id,
                itemData: sanitizedItemData as {
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
        case 'create_contact':
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
        case 'create_multiple_surveys':
        case 'create_survey':
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

          const sanitizedUpdates = sanitizeShoppingItemData(updates);

          result = await editConfirmedShoppingItem({
            itemId: item.originalItem?._id as Id<"shoppingListItems">,
            updates: sanitizedUpdates,
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
      case 'create_task':
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
        case 'create_multiple_notes':
        case 'create_note':
        case 'note':
          result = await createConfirmedNote({
            projectId: project._id,
            noteData: item.data as { title: string; content: string; }
          });
          break;
        case 'create_multiple_shopping_items':
        case 'create_shopping_item':
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

          const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData);

          result = await createConfirmedShoppingItem({
            projectId: project._id,
            itemData: sanitizedItemData as {
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
        case 'create_multiple_surveys':
        case 'create_survey':
        case 'survey':
          result = await createConfirmedSurvey({
            projectId: project._id,
            surveyData: extractSurveyData(item.data)
          });
          break;
        case 'create_contact':
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

  const handleContentEdit = (updatedItem: PendingItem) => {
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
      toast.info("Item updated");
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

  const handleClearChat = async () => {
    handleStopResponse();

    setIsLoading(true);

    try {
      if (project && user?.id && threadId) {
        await clearThread({
          threadId,
          projectId: project._id,
          userClerkId: user.id,
        });
      }

      setChatHistory([]);
      setPendingItems([]);
      setCurrentItemIndex(0);
      setShowConfirmationGrid(false);
      setIsConfirmationDialogOpen(false);
      setEditingItemIndex(null);
      setSessionTokens({ total: 0, cost: 0 });
      setCurrentMode(null);
      setMessage("");
      setSelectedFile(null);
      setUploadedFileId(null);
      setIsUploading(false);

      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Failed to clear chat", error);
      toast.error("Could not clear chat history");
    } finally {
      setIsLoading(false);
    }
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

  const showEmptyState = !chatIsLoading && chatHistory.length === 0;

  const renderInputArea = () => (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
      className={cn(
        "relative rounded-[2rem] p-2",
        "bg-background/80 backdrop-blur-xl border border-white/20 shadow-2xl dark:border-white/10",
        "transition-all duration-300",
        "focus-within:ring-1 focus-within:ring-white/20"
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
                <div className="flex items-center gap-2 bg-background/90 backdrop-blur p-2 rounded-xl border shadow-lg">
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

      <div className="flex items-end gap-3 pl-4 pr-3 py-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.xlsm,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf"
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

        <Textarea
           ref={inputRef}
           value={message}
           onChange={(e) => setMessage(e.target.value)}
           onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isLoading && !isUploading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
           placeholder="Ask anything about your project..."
           rows={1}
           disabled={isUploading}
           className={cn(
              "flex-1 resize-none bg-transparent border-0",
              "text-base placeholder:text-muted-foreground/50",
              "focus:outline-none focus-visible:ring-0",
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

  return (
    <>
      <div className="flex min-h-screen bg-background text-foreground overflow-x-hidden">
        {/* Sidebar with chat history (desktop) */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-border/60 bg-card/20 overflow-hidden transition-[width] duration-300 ease-out md:flex md:sticky md:self-start md:top-4 md:max-h-[calc(100vh-2rem)] xl:top-8 xl:max-h-[calc(100vh-4rem)]",
            showHistory ? "w-72 lg:w-80" : "w-0"
          )}
        >

          <div
            className={cn(
              "border-b border-border/60 px-4 py-5 transition-all duration-200 ease-out",
              showHistory ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
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
              className="mt-4 w-full justify-center"
            >
              Start new chat
            </Button>
          </div>
          <div
            className={cn(
              "flex-1 overflow-y-auto transition-all duration-200 ease-out",
              showHistory ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
            )}
          >
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
                          <p className="mt-1 text-xs text-muted-foreground truncate whitespace-nowrap">{preview}</p>
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
        <div className="relative flex flex-1 flex-col">
          
          {/* Background Elements from Visualizations Page */}
          <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] pointer-events-none"></div>
          <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-100 blur-[100px] opacity-20 dark:bg-purple-900/20 pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-100 blur-[100px] opacity-20 dark:bg-blue-900/20 pointer-events-none"></div>

          {/* Mobile header */}
          <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3 md:hidden z-20 bg-background/50 backdrop-blur">
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
            <div className="flex items-center gap-2">
              <Button onClick={handleClearChat} variant="ghost" size="sm" disabled={!threadId}>
                Clear
              </Button>
              <Button onClick={handleNewChat} variant="outline" size="sm">
                New chat
              </Button>
            </div>
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
          <div className="absolute right-6 top-6 hidden items-center gap-3 md:flex z-20">
            {sessionTokens.cost > 0 && (
              <span className="text-xs text-muted-foreground">
                Estimated cost: ${sessionTokens.cost.toFixed(4)}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              disabled={!threadId}
            >
              Clear chat
            </Button>
          </div>

          <div className="flex-1 min-h-[70vh] overflow-y-auto px-6 pb-40 pt-10">
            {chatIsLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading conversation…
              </div>
            ) : (
              <div className={cn(
                  "mx-auto flex max-w-4xl flex-col space-y-8", // Increased width and spacing
                  showEmptyState ? "h-full justify-center" : "pt-24"
                )}>
                {showEmptyState ? (
                   <div className="flex flex-col items-center justify-center w-full">
                      {/* Hero Section - Visualizations Style */}
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-6 text-center mb-12"
                      >
                        <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-foreground font-display">
                          AI Assistant
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                           Manage your project with <span className="italic font-serif text-foreground">intelligence</span>. 
                           From planning to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 font-semibold">execution</span>.
                        </p>
                      </motion.div>

                        {/* Quick Prompts as Cards */}
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full mx-auto"
                        >
                           {quickPrompts.slice(0, 3).map((item) => (
                             <button
                               key={item.label}
                               onClick={() => handleQuickPromptClick(item.prompt)}
                               className={cn(
                                 "group relative overflow-hidden rounded-3xl text-left transition-all duration-300 h-40 p-6",
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
                                 <p className="text-sm text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors">
                                   {item.prompt}
                                 </p>
                               </div>
                             </button>
                           ))}
                        </motion.div>
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
                               <div className="relative rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden">
                                  <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background z-0"></div>
                                  <div className="relative z-10 p-8">
                                      <div className="prose prose-neutral dark:prose-invert max-w-none leading-relaxed text-lg text-foreground/90">
                                          <div dangerouslySetInnerHTML={{ __html: chat.content.replace(/\n/g, '<br/>') }} />
                                      </div>

                                      {/* Token stats badge */}
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

          {/* Floating Input Area */}
          <div
            className={cn(
              "absolute left-0 right-0 px-6 z-50 pointer-events-none",
              showEmptyState ? "bottom-8 sm:bottom-12 md:bottom-14" : "bottom-6 md:bottom-8"
            )}
          >
            <div className="max-w-3xl mx-auto pointer-events-auto">
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
