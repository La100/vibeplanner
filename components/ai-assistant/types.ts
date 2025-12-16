/**
 * AI Assistant Types
 * 
 * All TypeScript types and interfaces used by the AI Assistant feature.
 */

import type { Id } from "@/convex/_generated/dataModel";

// ==================== PENDING ITEM TYPES ====================

export type PendingItemType =
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

export type PendingOperation = 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create';

export type PendingItem = {
  type: PendingItemType;
  operation?: PendingOperation;
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

// ==================== INPUT TYPES ====================

export type TaskInput = {
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

export type BulkTaskData = {
  tasks?: TaskInput[];
};

export type NoteInput = {
  title: string;
  content: string;
};

export type BulkNoteData = {
  notes?: NoteInput[];
};

export type ShoppingItemInput = {
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

export type BulkShoppingData = {
  items?: ShoppingItemInput[];
};

export type BulkSurveyData = {
  surveys?: Array<Record<string, unknown>>;
};

export type ContactInput = {
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

// ==================== CHAT TYPES ====================

export type ChatHistoryEntry = {
  role: 'user' | 'assistant';
  content: string;
  messageIndex?: number;
  mode?: "full" | "recent";
  tokenUsage?: { totalTokens: number; estimatedCostUSD: number };
  fileInfo?: { name: string; size: number; type: string; id: string };
  status?: "streaming" | "finished" | "aborted";
};

export type SessionTokens = {
  total: number;
  cost: number;
};

// ==================== SURVEY TYPES ====================

export type SurveyQuestion = {
  questionId?: string;
  questionText: string;
  questionType: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file";
  options?: string[];
  isRequired?: boolean;
  order?: number;
};

export type SurveyData = {
  title: string;
  description?: string;
  isRequired?: boolean;
  allowMultipleResponses?: boolean;
  startDate?: string;
  endDate?: string;
  targetAudience?: "all_customers" | "specific_customers" | "team_members";
  targetCustomerIds?: string[];
  questions?: SurveyQuestion[];
};

// ==================== CONFIRMATION RESULT TYPES ====================

export type ConfirmationResult = {
  success: boolean;
  message: string;
  taskId?: string;
  noteId?: string;
  itemId?: string;
  surveyId?: string;
  contactId?: string;
};

// ==================== HOOK RETURN TYPES ====================

export type UseAIChatReturn = {
  message: string;
  setMessage: (msg: string) => void;
  chatHistory: ChatHistoryEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryEntry[]>>;
  isLoading: boolean;
  currentMode: "full" | "recent" | null;
  sessionTokens: SessionTokens;
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  handleSendMessage: () => Promise<void>;
  handleStopResponse: () => void;
  handleClearChat: () => Promise<void>;
  handleNewChat: () => void;
  handleThreadSelect: (threadId: string) => void;
};

export type UsePendingItemsReturn = {
  pendingItems: PendingItem[];
  setPendingItems: React.Dispatch<React.SetStateAction<PendingItem[]>>;
  currentItemIndex: number;
  setCurrentItemIndex: (index: number) => void;
  isConfirmationDialogOpen: boolean;
  setIsConfirmationDialogOpen: (open: boolean) => void;
  showConfirmationGrid: boolean;
  setShowConfirmationGrid: (show: boolean) => void;
  isCreatingContent: boolean;
  isBulkProcessing: boolean;
  handleContentConfirm: () => Promise<void>;
  handleContentCancel: () => void;
  handleContentEdit: (data: Record<string, unknown>) => void;
  handleContentDialogClose: () => void;
  handleConfirmAll: () => Promise<void>;
  handleConfirmItem: (index: number) => Promise<void>;
  handleRejectItem: (index: number) => Promise<void>;
  handleRejectAll: () => Promise<void>;
  handleEditItem: (index: number) => void;
};

export type UseFileUploadReturn = {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  uploadedFileId: string | null;
  isUploading: boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: () => void;
  handleAttachmentClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

// ==================== QUICK PROMPT TYPE ====================

export type QuickPrompt = {
  label: string;
  prompt: string;
};








