/**
 * AI Assistant Types
 * 
 * All TypeScript types and interfaces used by the AI Assistant feature.
 */

import type { Id } from "@/convex/_generated/dataModel";

// ==================== PENDING ITEM TYPES ====================

/**
 * Canonical pending item types.
 * The operation (create/edit/delete/bulk_*) is specified in PendingOperation.
 * Legacy tool names like 'create_task' are normalized to 'task' + operation='create'
 */
export type PendingItemType =
  | 'task'
  | 'note'
  | 'shopping'
  | 'survey'
  | 'contact'
  | 'shoppingSection'
  | 'labor'
  | 'laborSection';

/**
 * Legacy type names that map to canonical types.
 * Used during normalization in utils.ts
 */
export type LegacyPendingItemType =
  | 'create_task'
  | 'create_note'
  | 'create_shopping_item'
  | 'create_survey'
  | 'create_contact'
  | 'create_multiple_tasks'
  | 'create_multiple_notes'
  | 'create_multiple_shopping_items'
  | 'create_multiple_surveys'
  | 'create_labor_item'
  | 'create_labor_section'
  | 'create_multiple_labor_items';

/**
 * All possible types including legacy names.
 * Used for type guards and input validation.
 */
export type AnyPendingItemType = PendingItemType | LegacyPendingItemType;

export type PendingOperation = 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create';

export type PendingItem = {
  /** Canonical type - always normalized (task, note, shopping, etc.) */
  type: PendingItemType;
  /** Operation to perform */
  operation: PendingOperation;
  /** Client-side id for UI transitions */
  clientId?: string;
  /** Resolved state for inline confirmations */
  status?: "confirmed" | "rejected";
  /** Primary data payload */
  data: Record<string, unknown>;
  /** For edit operations - the specific updates */
  updates?: Record<string, unknown>;
  /** Original item data (for edit/delete operations) */
  originalItem?: Record<string, unknown>;
  /** Selection criteria (for bulk operations) */
  selection?: Record<string, unknown>;
  /** For bulk title edits */
  titleChanges?: Array<{
    taskId?: string;
    currentTitle?: string;
    originalTitle?: string;
    newTitle: string;
  }>;
  /** Display info for UI */
  display?: {
    title: string;
    description: string;
  };
  /** Original function call info from AI */
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  /** Response ID for tracking */
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

export type LaborItemInput = {
  name: string;
  quantity: number;
  unit?: string;
  notes?: string;
  unitPrice?: number;
  sectionId?: Id<'laborSections'>;
  sectionName?: string;
  assignedTo?: string;
};

export type BulkLaborData = {
  items?: LaborItemInput[];
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
  filesInfo?: Array<{ name: string; size: number; type: string; id: string }>;
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
  laborItemId?: string;
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
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
  uploadedFileIds: string[];
  isUploading: boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: (index: number) => void;
  handleAttachmentClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

// ==================== QUICK PROMPT TYPE ====================

export type QuickPrompt = {
  label: string;
  prompt: string;
};

















