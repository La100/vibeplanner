/**
 * Tool Icons & Labels for AI Assistant
 * 
 * Maps tool names to appropriate icons and human-readable labels
 * for the step-by-step UI display.
 */

import {
  Database,
  Search,
  Plus,
  Pencil,
  Trash,
  ListTodo,
  Flame,
  MessageCircle,
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
    label: "Loading Assistant Context",
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
  web_search: {
    icon: Search,
    label: "Web Search",
    description: "Searching the web",
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

  // Create tools - bulk
  create_multiple_tasks: {
    icon: ListTodo,
    label: "Creating Multiple Tasks",
    description: "Adding multiple tasks",
    category: "create",
    color: "text-green-500",
  },

  create_habit: {
    icon: Flame,
    label: "Creating Habit",
    description: "Adding a new habit",
    category: "create",
    color: "text-green-500",
  },

  create_multiple_habits: {
    icon: Flame,
    label: "Creating Multiple Habits",
    description: "Adding multiple habits",
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

  edit_habit: {
    icon: Pencil,
    label: "Editing Habit",
    description: "Modifying a habit",
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

  // Delete tools
  delete_task: {
    icon: Trash,
    label: "Deleting Task",
    description: "Removing a task",
    category: "delete",
    color: "text-red-500",
  },

  delete_habit: {
    icon: Trash,
    label: "Deleting Habit",
    description: "Removing a habit",
    category: "delete",
    color: "text-red-500",
  },

  configure_telegram: {
    icon: MessageCircle,
    label: "Connecting Telegram",
    description: "Saving bot credentials",
    category: "edit",
    color: "text-amber-500",
  },

  schedule_telegram_reminder: {
    icon: MessageCircle,
    label: "Scheduling Reminder",
    description: "Queueing Telegram reminder",
    category: "create",
    color: "text-green-500",
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
