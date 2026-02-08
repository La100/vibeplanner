/**
 * AI Assistant Constants
 *
 * Static configuration and constant values for the AI Assistant.
 */

import type { PendingItemType, AnyPendingItemType } from "../data/types";

// ==================== PENDING ITEM TYPES ====================

/** All valid pending item types including legacy names (for backwards compatibility) */
export const PENDING_ITEM_TYPES: AnyPendingItemType[] = [
  "task",
  "habit",
  "create_task",
  "create_multiple_tasks",
  "create_habit",
  "create_multiple_habits",
  "create_item",
  "create_multiple_items",
];

// ==================== TOOL NAME MAPPINGS ====================

export const TOOL_NAME_MAPPING: Record<string, { type: PendingItemType; operation: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create' | 'complete' }> = {
  edit_task: { type: "task", operation: "edit" },
  edit_multiple_tasks: { type: "task", operation: "bulk_edit" },
  delete_task: { type: "task", operation: "delete" },
  edit_habit: { type: "habit", operation: "edit" },
  delete_habit: { type: "habit", operation: "delete" },
  set_habit_completion: { type: "habit", operation: "complete" },
  set_habit_reminder: { type: "habit", operation: "edit" },
  clear_habit_reminders: { type: "habit", operation: "bulk_edit" },
};

// ==================== FILE UPLOAD ====================

export const MAX_FILE_SIZE_MB = 512;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.xlsm,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf";
