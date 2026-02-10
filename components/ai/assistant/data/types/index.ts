/**
 * AI Assistant Types
 *
 * Consolidated TypeScript types and interfaces for the AI Assistant feature.
 * This file combines types from ai-assistant/types.ts and AIConfirmationGrid.tsx
 */

import type React from "react";

// ==================== PENDING ITEM TYPES ====================

/**
 * Canonical pending item types.
 * The operation (create/edit/delete/bulk_*) is specified in PendingOperation.
 * Legacy tool names like 'create_task' are normalized to 'task' + operation='create'
 */
export type PendingItemType =
  | 'task'
  | 'habit'
  ;

/**
 * Legacy type names that map to canonical types.
 * Used during normalization in utils
 */
export type LegacyPendingItemType =
  | 'create_task'
  | 'create_multiple_tasks'
  | 'create_habit'
  | 'create_multiple_habits'
  | 'create_item'
  | 'create_multiple_items'
  ;

/**
 * All possible types including legacy names.
 * Used for type guards and input validation.
 */
export type AnyPendingItemType = PendingItemType | LegacyPendingItemType;

/**
 * Also exported as PendingContentType for backwards compatibility
 */
export type PendingContentType = AnyPendingItemType;

/**
 * Operation types for pending items
 */
export type PendingOperation = 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create' | 'complete';

/**
 * Approval state for pending items (used in UI flow)
 */
export type PendingApprovalState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error";

/**
 * Display information for pending item UI
 */
export interface PendingDisplay {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  details?: React.ReactNode;
  diff?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Main pending item structure
 */
export type PendingItem = {
  /** Canonical or legacy type before normalization */
  type: AnyPendingItemType;
  /** Operation to perform */
  operation: PendingOperation;
  /** Client-side id for UI transitions */
  clientId?: string;
  /** Resolved state for inline confirmations */
  status?: "confirmed" | "rejected";
  /** Approval state for UI flow */
  approvalState?: PendingApprovalState;
  /** Reason for approval state */
  approvalReason?: string;
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
    id?: string;
    currentTitle?: string;
    originalTitle?: string;
    newTitle: string;
  }>;
  /** Display info for UI */
  display?: PendingDisplay;
  /** Original function call info from AI */
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  /** Response ID for tracking */
  responseId?: string;
};

/**
 * Also exported as PendingContentItem for backwards compatibility
 */
export type PendingContentItem = PendingItem;

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
  cost?: number;
};

export type HabitInput = {
  name: string;
  description?: string;
  targetValue?: number;
  unit?: string;
  frequency?: "daily" | "weekly";
  scheduleDays?: string[];
  reminderTime?: string;
  reminderPlan?: Array<{
    date: string;
    reminderTime: string;
    minStartTime?: string;
    phaseLabel?: string;
  }>;
  source?: "user" | "assistant" | "gymbro_onboarding";
};

export type BulkTaskData = {
  tasks?: TaskInput[];
};

// ==================== CONFIRMATION RESULT TYPES ====================

export type ConfirmationResult = {
  success: boolean;
  message: string;
  taskId?: string;
  itemId?: string;
};

// ==================== QUICK PROMPT TYPE ====================

// ==================== COMPONENT PROP TYPES ====================

export interface ConfirmationGridProps {
  pendingItems: PendingContentItem[];
  onConfirmAll: () => Promise<void>;
  onConfirmItem: (index: number) => Promise<void>;
  onRejectItem: (index: number) => void;
  onRejectAll: () => void;
  onEditItem?: (index: number) => void;
  onUpdateItem?: (index: number, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
}
