/**
 * AI Assistant Utility Functions
 * 
 * Helper functions for normalizing, sanitizing, and processing AI data.
 */

import type {
  PendingItem,
  AnyPendingItemType,
  TaskInput,
} from "../types";
import {
  PENDING_ITEM_TYPES,
  TOOL_NAME_MAPPING,
} from "../../config/constants";

// ==================== TYPE GUARDS ====================

export const isPendingItemType = (value: unknown): value is AnyPendingItemType =>
  typeof value === "string" && PENDING_ITEM_TYPES.includes(value as AnyPendingItemType);

// ==================== PENDING ITEM NORMALIZERS ====================

export const normalizePendingItems = (items: PendingItem[]): PendingItem[] =>
  items.map((originalItem) => {
    const normalizeTypeAndOperation = (item: PendingItem) => {
      let type: string = item.type;
      let operation = item.operation;

      if (TOOL_NAME_MAPPING[type]) {
        const mapped = TOOL_NAME_MAPPING[type];
        type = mapped.type;
        operation = operation ?? mapped.operation;
      }

      switch (type) {
        case "create_item":
          type = "task";
          operation = operation ?? "create";
          break;
        case "create_task":
          type = "task";
          operation = operation ?? "create";
          break;
        case "create_habit":
          type = "habit";
          operation = operation ?? "create";
          break;
        case "create_multiple_items":
          type = (item.data?.type as string) || "task";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_tasks":
          type = "task";
          operation = operation ?? "bulk_create";
          break;
        case "create_multiple_habits":
          type = "habit";
          operation = operation ?? "bulk_create";
          break;
        default:
          break;
      }

      const finalType = isPendingItemType(type) ? type : item.type;
      const finalOperation = operation ?? item.operation ?? "create";

      // Auto-detect bulk data that was mistakenly categorized as single create
      if (finalOperation === "create" && item.data) {
        const data = item.data as Record<string, unknown>;
        const hasBulkTasks = Array.isArray(data.tasks) || (Array.isArray(data.items) && finalType === "task");
        const hasBulkHabits = Array.isArray(data.habits) || (Array.isArray(data.items) && finalType === "habit");

        if (hasBulkTasks || hasBulkHabits) {
          return {
            ...item,
            type: finalType,
            operation: "bulk_create",
          } satisfies PendingItem;
        }
      }

      return {
        ...item,
        type: finalType,
        operation: finalOperation,
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

    if (item.type === "habit") {
      if (item.operation === "bulk_create") {
        const habits = Array.isArray(item.data?.habits)
          ? (item.data!.habits as Array<{ name?: string }>)
          : Array.isArray(item.data?.items)
            ? (item.data!.items as Array<{ name?: string }>)
            : [];
        const preview = habits
          .slice(0, 3)
          .map((habit) => habit.name || "Untitled Habit")
          .join(" • ");
        const remaining = Math.max(habits.length - 3, 0);

        return {
          ...item,
          display: {
            title: `Create ${habits.length} habit${habits.length === 1 ? "" : "s"}`,
            description:
              habits.length === 0
                ? "Review habits before confirming."
                : [preview, remaining > 0 ? `+${remaining} more` : null]
                  .filter(Boolean)
                  .join(" • "),
          },
        };
      }

      const name = (item.data?.name as string) || (item.originalItem?.name as string) || "Habit";
      item = {
        ...item,
        display: {
          title:
            item.operation === "delete"
              ? `Delete habit: ${name}`
              : item.operation === "edit"
                ? `Update habit: ${name}`
                : `Create habit: ${name}`,
          description: (item.data?.description as string) || "Review habit details before confirming.",
        },
      };
    }

    return item;
  });

// ==================== BULK ITEM EXPANSION ====================

export const expandBulkEditItems = (items: PendingItem[]): PendingItem[] => {
  return items.flatMap<PendingItem>((item) => {
    if (item.operation === 'bulk_create') {
      const tasks = Array.isArray(item.data?.tasks)
        ? (item.data.tasks as TaskInput[])
        : Array.isArray(item.data?.items) && item.type === 'task'
          ? (item.data.items as TaskInput[])
          : [];

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

      if (item.type === 'habit') {
        const habits = Array.isArray(item.data?.habits)
          ? (item.data.habits as Array<Record<string, unknown>>)
          : Array.isArray(item.data?.items)
            ? (item.data.items as Array<Record<string, unknown>>)
            : [];

        if (habits.length > 0) {
          return habits.map((habit) => ({
            type: 'habit' as const,
            operation: 'create' as const,
            data: habit,
            display: {
              title: (habit.name as string) || 'Untitled Habit',
              description: (habit.description as string) || 'New habit',
            },
            functionCall: item.functionCall,
            responseId: item.responseId,
          } satisfies PendingItem));
        }
      }

      return item;
    }

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

    return item;
  });
};

// ==================== BULK OPERATION HELPERS ====================

export const extractBulkSelection = (item: PendingItem) => {
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

export const extractBulkUpdates = (item: PendingItem) => {
  const source = item.updates || (item.data?.updates as Record<string, unknown>) || {};
  const updates = { ...source } as Record<string, unknown>;
  delete updates.assignedToName;
  return updates;
};

 
