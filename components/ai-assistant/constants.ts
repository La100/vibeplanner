/**
 * AI Assistant Constants
 * 
 * Static configuration and constant values for the AI Assistant.
 */

import type { PendingItemType, QuickPrompt } from "./types";

// ==================== PENDING ITEM TYPES ====================

export const PENDING_ITEM_TYPES: PendingItemType[] = [
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

// ==================== QUICK PROMPTS ====================

export const QUICK_PROMPTS: QuickPrompt[] = [
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
    prompt: "Draft a client update summarizing today's progress on the remodel.",
  },
  {
    label: "Risks",
    prompt: "List potential blockers that might delay the renovation timeline.",
  },
];

// ==================== TOOL NAME MAPPINGS ====================

export const TOOL_NAME_MAPPING: Record<string, { type: PendingItemType; operation: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create' }> = {
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

// ==================== ALLOWED SHOPPING FIELDS ====================

export const ALLOWED_SHOPPING_FIELDS = [
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

// ==================== CONTACT TYPES ====================

export const ALLOWED_CONTACT_TYPES = new Set(["contractor", "supplier", "subcontractor", "other"]);

export const OPTIONAL_CONTACT_STRING_FIELDS: Array<keyof Omit<import("./types").ContactInput, "name" | "type">> = [
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

// ==================== FILE UPLOAD ====================

export const MAX_FILE_SIZE_MB = 512;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ACCEPTED_FILE_TYPES = "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.xlsm,.txt,.json,.jsonl,.csv,.md,.py,.js,.ts,.html,.css,.xml,.rtf";








