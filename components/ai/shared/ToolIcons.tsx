/**
 * Tool Icons & Labels for AI Assistant
 * 
 * Maps tool names to appropriate icons and human-readable labels
 * for the step-by-step UI display.
 */

import {
  Database,
  Search,
  FileText,
  ShoppingCart,
  Users,
  Plus,
  FilePlus,
  ShoppingBag,
  Pencil,
  Trash,
  ClipboardList,
  Package,
  UserPlus,
  ListTodo,
  FolderOpen,
  MessageSquarePlus,
  Edit3,
  Layers,
  Hammer,
  HardHat,
  type LucideIcon,
} from "lucide-react";

export interface ToolConfig {
  icon: LucideIcon;
  label: string;
  description: string;
  category: "context" | "search" | "create" | "edit" | "delete";
  color: string;
}

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  // Context loading
  load_full_project_context: {
    icon: Database,
    label: "Loading Project Context",
    description: "Loading complete project data",
    category: "context",
    color: "text-purple-500",
  },

  // Search tools
  search_tasks: {
    icon: Search,
    label: "Searching Tasks",
    description: "Looking for matching tasks",
    category: "search",
    color: "text-blue-500",
  },
  search_notes: {
    icon: FileText,
    label: "Searching Notes",
    description: "Looking for matching notes",
    category: "search",
    color: "text-blue-500",
  },
  search_shopping_items: {
    icon: ShoppingCart,
    label: "Searching Shopping List",
    description: "Looking for shopping items",
    category: "search",
    color: "text-blue-500",
  },
  search_contacts: {
    icon: Users,
    label: "Searching Contacts",
    description: "Looking for matching contacts",
    category: "search",
    color: "text-blue-500",
  },
  search_surveys: {
    icon: ClipboardList,
    label: "Searching Surveys",
    description: "Looking for matching surveys",
    category: "search",
    color: "text-blue-500",
  },
  search_labor_items: {
    icon: Hammer,
    label: "Searching Labor Items",
    description: "Looking for labor/work items",
    category: "search",
    color: "text-blue-500",
  },

  // Create tools - single items
  create_task: {
    icon: Plus,
    label: "Creating Task",
    description: "Adding a new task",
    category: "create",
    color: "text-green-500",
  },
  create_note: {
    icon: FilePlus,
    label: "Creating Note",
    description: "Adding a new note",
    category: "create",
    color: "text-green-500",
  },
  create_shopping_item: {
    icon: ShoppingBag,
    label: "Adding to Shopping List",
    description: "Adding a shopping item",
    category: "create",
    color: "text-green-500",
  },
  create_shopping_section: {
    icon: FolderOpen,
    label: "Creating Shopping Section",
    description: "Adding a new section",
    category: "create",
    color: "text-green-500",
  },
  create_contact: {
    icon: UserPlus,
    label: "Creating Contact",
    description: "Adding a new contact",
    category: "create",
    color: "text-green-500",
  },
  create_survey: {
    icon: MessageSquarePlus,
    label: "Creating Survey",
    description: "Adding a new survey",
    category: "create",
    color: "text-green-500",
  },
  create_labor_item: {
    icon: Hammer,
    label: "Creating Labor Item",
    description: "Adding a work item",
    category: "create",
    color: "text-green-500",
  },
  create_labor_section: {
    icon: HardHat,
    label: "Creating Labor Section",
    description: "Adding a new labor section",
    category: "create",
    color: "text-green-500",
  },

  // Create tools - bulk
  create_multiple_tasks: {
    icon: ListTodo,
    label: "Creating Multiple Tasks",
    description: "Adding multiple tasks",
    category: "create",
    color: "text-green-500",
  },
  create_multiple_notes: {
    icon: Layers,
    label: "Creating Multiple Notes",
    description: "Adding multiple notes",
    category: "create",
    color: "text-green-500",
  },
  create_multiple_shopping_items: {
    icon: Package,
    label: "Adding Multiple Shopping Items",
    description: "Adding multiple items to list",
    category: "create",
    color: "text-green-500",
  },
  create_multiple_surveys: {
    icon: ClipboardList,
    label: "Creating Multiple Surveys",
    description: "Adding multiple surveys",
    category: "create",
    color: "text-green-500",
  },
  create_multiple_labor_items: {
    icon: HardHat,
    label: "Creating Multiple Labor Items",
    description: "Adding multiple work items",
    category: "create",
    color: "text-green-500",
  },

  // Edit tools - single items
  edit_task: {
    icon: Pencil,
    label: "Editing Task",
    description: "Modifying a task",
    category: "edit",
    color: "text-amber-500",
  },
  edit_note: {
    icon: Edit3,
    label: "Editing Note",
    description: "Modifying a note",
    category: "edit",
    color: "text-amber-500",
  },
  edit_shopping_item: {
    icon: Pencil,
    label: "Editing Shopping Item",
    description: "Modifying a shopping item",
    category: "edit",
    color: "text-amber-500",
  },
  edit_shopping_section: {
    icon: Pencil,
    label: "Editing Shopping Section",
    description: "Renaming a section",
    category: "edit",
    color: "text-amber-500",
  },
  edit_survey: {
    icon: Edit3,
    label: "Editing Survey",
    description: "Modifying a survey",
    category: "edit",
    color: "text-amber-500",
  },
  edit_labor_item: {
    icon: Pencil,
    label: "Editing Labor Item",
    description: "Modifying a work item",
    category: "edit",
    color: "text-amber-500",
  },
  edit_labor_section: {
    icon: Pencil,
    label: "Editing Labor Section",
    description: "Renaming a labor section",
    category: "edit",
    color: "text-amber-500",
  },

  // Edit tools - bulk
  edit_multiple_tasks: {
    icon: ListTodo,
    label: "Editing Multiple Tasks",
    description: "Modifying multiple tasks",
    category: "edit",
    color: "text-amber-500",
  },
  edit_multiple_notes: {
    icon: Layers,
    label: "Editing Multiple Notes",
    description: "Modifying multiple notes",
    category: "edit",
    color: "text-amber-500",
  },
  edit_multiple_shopping_items: {
    icon: Package,
    label: "Editing Multiple Shopping Items",
    description: "Modifying multiple items",
    category: "edit",
    color: "text-amber-500",
  },
  edit_multiple_surveys: {
    icon: ClipboardList,
    label: "Editing Multiple Surveys",
    description: "Modifying multiple surveys",
    category: "edit",
    color: "text-amber-500",
  },
  edit_multiple_labor_items: {
    icon: HardHat,
    label: "Editing Multiple Labor Items",
    description: "Modifying multiple work items",
    category: "edit",
    color: "text-amber-500",
  },

  // Delete tools
  delete_task: {
    icon: Trash,
    label: "Deleting Task",
    description: "Removing a task",
    category: "delete",
    color: "text-red-500",
  },
  delete_note: {
    icon: Trash,
    label: "Deleting Note",
    description: "Removing a note",
    category: "delete",
    color: "text-red-500",
  },
  delete_shopping_item: {
    icon: Trash,
    label: "Deleting Shopping Item",
    description: "Removing a shopping item",
    category: "delete",
    color: "text-red-500",
  },
  delete_shopping_section: {
    icon: Trash,
    label: "Deleting Shopping Section",
    description: "Removing a section",
    category: "delete",
    color: "text-red-500",
  },
  delete_contact: {
    icon: Trash,
    label: "Deleting Contact",
    description: "Removing a contact",
    category: "delete",
    color: "text-red-500",
  },
  delete_survey: {
    icon: Trash,
    label: "Deleting Survey",
    description: "Removing a survey",
    category: "delete",
    color: "text-red-500",
  },
  delete_labor_item: {
    icon: Trash,
    label: "Deleting Labor Item",
    description: "Removing a work item",
    category: "delete",
    color: "text-red-500",
  },
  delete_labor_section: {
    icon: Trash,
    label: "Deleting Labor Section",
    description: "Removing a labor section",
    category: "delete",
    color: "text-red-500",
  },
};

/**
 * Get tool configuration by name
 * Returns a default config if tool is not found
 */
export function getToolConfig(toolName: string): ToolConfig {
  const config = TOOL_CONFIGS[toolName];
  if (config) return config;

  // Default fallback for unknown tools
  return {
    icon: Database,
    label: toolName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `Executing ${toolName}`,
    category: "context",
    color: "text-gray-500",
  };
}

/**
 * Get category-based styling
 */
export function getCategoryStyles(category: ToolConfig["category"]) {
  switch (category) {
    case "context":
      return {
        bgColor: "bg-purple-50 dark:bg-purple-950/30",
        borderColor: "border-purple-200 dark:border-purple-800",
        dotColor: "bg-purple-500",
      };
    case "search":
      return {
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        borderColor: "border-blue-200 dark:border-blue-800",
        dotColor: "bg-blue-500",
      };
    case "create":
      return {
        bgColor: "bg-green-50 dark:bg-green-950/30",
        borderColor: "border-green-200 dark:border-green-800",
        dotColor: "bg-green-500",
      };
    case "edit":
      return {
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        borderColor: "border-amber-200 dark:border-amber-800",
        dotColor: "bg-amber-500",
      };
    case "delete":
      return {
        bgColor: "bg-red-50 dark:bg-red-950/30",
        borderColor: "border-red-200 dark:border-red-800",
        dotColor: "bg-red-500",
      };
  }
}


