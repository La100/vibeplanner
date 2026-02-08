"use client";
/**
 * usePendingItems Hook
 * 
 * Manages pending AI suggestions and their confirmation/rejection flow.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  PendingItem,
  BulkTaskData,
  HabitInput,
} from "../types";
import {
  isPendingItemType,
  normalizePendingItems,
  expandBulkEditItems,
  extractBulkSelection,
  extractBulkUpdates,
} from "../utils";

interface UsePendingItemsProps {
  projectId: Id<"projects"> | undefined;
  threadId: string | undefined;
}

interface UsePendingItemsReturn {
  pendingItems: PendingItem[];
  isBulkProcessing: boolean;
  handleConfirmAll: () => Promise<void>;
  handleConfirmItem: (index: number | string) => Promise<void>;
  handleRejectItem: (index: number | string) => Promise<void>;
  handleRejectAll: () => Promise<void>;
  handleAutoRejectPendingItems: () => Promise<number>;
  handleUpdatePendingItem: (index: number | string, updates: Partial<PendingItem>) => void;
  resetPendingState: () => void;
}

export const usePendingItems = ({
  projectId,
  threadId,
}: UsePendingItemsProps): UsePendingItemsReturn => {
  // State
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Queries
  const pendingFunctionCalls = useQuery(
    apiAny.ai.threads.listPendingItems,
    threadId ? { threadId } : "skip"
  );

  // Mutations
  const markFunctionCallsAsConfirmed = useMutation(apiAny.ai.threads.markFunctionCallsAsConfirmed);
  const deleteTask = useMutation(apiAny.tasks.deleteTask);
  const deleteHabit = useMutation(apiAny.habits.deleteHabit);
  const updateHabit = useMutation(apiAny.habits.updateHabit);
  const toggleHabitCompletion = useMutation(apiAny.habits.toggleHabitCompletion);

  // Actions
  const createConfirmedTask = useAction(apiAny.ai.confirmedActions.createConfirmedTask);
  const createConfirmedHabit = useAction(apiAny.ai.confirmedActions.createConfirmedHabit);
  const editConfirmedTask = useAction(apiAny.ai.confirmedActions.editConfirmedTask);
  const bulkEditConfirmedTasks = useAction(apiAny.ai.actions.bulkEditConfirmedTasks);

  // Load pending items from DB
  useEffect(() => {
    // Don't restore pending items when threadId is undefined (e.g., after "New Chat")
    if (!threadId) {
      return;
    }

    if (pendingFunctionCalls && pendingFunctionCalls.length > 0) {
      const actionableCalls = pendingFunctionCalls.filter(
        (call) => call.status !== "confirmed" && call.status !== "rejected" && call.status !== "replayed"
      );

      if (actionableCalls.length === 0) {
        setPendingItems([]);
        return;
      }

      const pendingItemsFromDB = actionableCalls.map((call) => {
        try {
          const parsed = JSON.parse(call.arguments);
          const parsedTypeValue = typeof parsed?.type === "string" ? parsed.type : undefined;
          const parsedType = isPendingItemType(parsedTypeValue) ? parsedTypeValue : undefined;
          const functionCallType = isPendingItemType(call.functionName) ? call.functionName : undefined;

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
            status: (call.status === "confirmed" || call.status === "rejected") ? call.status : undefined,
          };
        } catch (e) {
          console.error("Failed to parse pending item:", e);
          return null;
        }
      }) as Array<PendingItem | null>;

      const normalizedPendingItems = pendingItemsFromDB.filter((i): i is PendingItem => i !== null);

      if (normalizedPendingItems.length > 0) {
        const expanded = expandBulkEditItems(normalizePendingItems(normalizedPendingItems));
        const withClientIds = expanded.map((item, index) => ({
          ...item,
          clientId: item.clientId ?? `${item.functionCall?.callId ?? "pending"}-${index}`,
        }));

        setPendingItems(prev => {
          const prevMap = new Map(prev.map(p => [p.clientId, p]));

          // 1. Process new items from server (preserving local confirmation status if they exist in prev)
          const newItems = withClientIds.map(newItem => {
            const prevItem = prevMap.get(newItem.clientId!);
            if (prevItem && (prevItem.status === 'confirmed' || prevItem.status === 'rejected')) {
              return { ...newItem, status: prevItem.status };
            }
            return newItem;
          });

          // 2. Find resolved items in prev that are NOT in newItems (preserved items)
          const newIds = new Set(newItems.map(i => i.clientId));
          const preservedItems = prev.filter((p) => {
            if (p.status !== "confirmed" && p.status !== "rejected") return false;
            if (!p.clientId) return true;
            return !newIds.has(p.clientId);
          });

          // 3. Combine
          return [...newItems, ...preservedItems];
        });
      }
    } else if (pendingFunctionCalls && pendingFunctionCalls.length === 0 && pendingItems.length > 0) {
      // If server returns empty, clear any stale pending items
      setPendingItems([]);
    }
  }, [threadId, pendingFunctionCalls, pendingItems.length]);

  const scheduleResolvedRemoval = useCallback((clientId?: string) => {
    // Intentionally left blank - keep resolved items visible in the UI.
    void clientId;
  }, []);

  // Helper functions
  // Confirm single item helper
  const confirmSingleItem = useCallback(async (item: PendingItem) => {
    if (!projectId) throw new Error("No project available");

    let result;

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
                projectId,
                taskData: cleanTaskData as {
                  title: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  description?: string;
                  assignedTo?: string | null;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  startDate?: string;
                  endDate?: string;
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
            message: `Created ${createdIds.length}/${tasks.length} tasks successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        case 'habit': {
          const data = item.data as { habits?: HabitInput[]; items?: HabitInput[] };
          const habits = Array.isArray(data.habits)
            ? data.habits
            : Array.isArray(data.items)
              ? data.items
              : [];

          if (habits.length === 0) {
            throw new Error("No habits provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const habitData of habits) {
            try {
              const habitResult = await createConfirmedHabit({
                projectId,
                habitData: habitData as HabitInput,
              });

              if (habitResult.success && habitResult.habitId) {
                createdIds.push(habitResult.habitId);
              } else if (!habitResult.success) {
                errors.push(habitResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${habits.length} habits successfully${errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
              }`,
          };
          break;
        }
        default:
          throw new Error(`Unsupported bulk create type: ${item.type}`);
      }
    } else if (item.operation === 'delete') {
      switch (item.type) {
        case 'task': {
          // Support both legacy format (taskId) and new format (itemId)
          const taskId = (item.data.taskId ?? item.data.itemId) as Id<"tasks">;
          if (!taskId) {
            throw new Error("Missing taskId or itemId for task deletion");
          }
          await deleteTask({ taskId });
          result = { success: true, message: "Task deleted successfully" };
          break;
        }
        case 'habit': {
          const habitId = (item.data.habitId ?? item.data.itemId) as Id<"habits">;
          if (!habitId) {
            throw new Error("Missing habitId or itemId for habit deletion");
          }
          await deleteHabit({ habitId });
          result = { success: true, message: "Habit deleted successfully" };
          break;
        }
        default:
          throw new Error(`Unknown content type for deletion: ${item.type}`);
      }
    } else if (item.operation === 'edit') {
      switch (item.type) {
        case 'task': {
          const cleanUpdates = { ...(item.updates as Record<string, unknown>) };
          delete cleanUpdates.assignedToName;

          result = await editConfirmedTask({
            taskId: item.originalItem?._id as Id<"tasks">,
            updates: cleanUpdates
          });
          break;
        }
        case 'habit': {
          const habitId = (item.data?.habitId ?? item.data?.itemId ?? item.originalItem?._id) as Id<"habits">;
          if (!habitId) {
            throw new Error("Missing habitId for habit edit");
          }
          await updateHabit({
            habitId,
            ...(item.updates as Record<string, unknown>),
          } as Parameters<typeof updateHabit>[0]);
          result = { success: true, message: "Habit updated successfully" };
          break;
        }
        default:
          throw new Error(`Unknown content type for editing: ${item.type}`);
      }
    } else if (item.operation === 'complete') {
      if (item.type !== 'habit') {
        throw new Error(`Completion is only supported for habits (got: ${item.type})`);
      }

      const habitId = (item.data?.habitId ?? item.data?.itemId) as Id<"habits">;
      if (!habitId) {
        throw new Error("Missing habitId for habit completion");
      }

      const date = item.data?.date as string | undefined;
      const rawCompleted = item.data?.completed as unknown;
      const completed = typeof rawCompleted === "boolean" ? rawCompleted : undefined;
      const rawValue = item.data?.value as unknown;
      const value = typeof rawValue === "number" ? rawValue : undefined;
      await toggleHabitCompletion({ habitId, date, completed, value });

      const message =
        completed === false
          ? "Habit marked incomplete"
          : completed === true
            ? "Habit marked complete"
            : "Habit completion toggled";

      result = { success: true, message };
    } else if (item.operation === 'bulk_edit' && item.type === 'habit') {
      const items = item.data?.items as Array<{ itemId?: string; updates?: Record<string, unknown> }> | undefined;
      if (!items || items.length === 0) {
        throw new Error("No habits provided for bulk edit");
      }

      const errors: string[] = [];
      let updatedCount = 0;

      for (const habitUpdate of items) {
        try {
          const habitId = habitUpdate.itemId ?? (habitUpdate.updates?.itemId as string | undefined);
          if (!habitId) {
            throw new Error("Missing habitId");
          }
          const updates = { ...(habitUpdate.updates ?? {}) };
          await updateHabit({
            habitId: habitId as Id<"habits">,
            ...(updates as Record<string, unknown>),
          } as Parameters<typeof updateHabit>[0]);
          updatedCount++;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      result = {
        success: errors.length === 0,
        message: errors.length === 0
          ? `Updated ${updatedCount}/${items.length} habits successfully`
          : `Updated ${updatedCount}/${items.length} habits with errors: ${errors.slice(0, 3).join(', ')}`,
      };
    } else {
      // Create operations
      switch (item.type) {
        case 'task':
        case 'create_task':
          if (item.operation === 'bulk_edit') {
            const selection = extractBulkSelection(item);
            const updates = extractBulkUpdates(item);

            if (Object.keys(updates).length > 0) {
              result = await bulkEditConfirmedTasks({
                projectId,
                selection,
                updates: updates as {
                  title?: string;
                  description?: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  assignedTo?: string | null;
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
                  if (!taskId) continue;

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
            delete cleanTaskData.assignedToName;
            result = await createConfirmedTask({
              projectId,
              taskData: cleanTaskData as {
                title: string;
                status?: 'todo' | 'in_progress' | 'review' | 'done';
                description?: string;
                assignedTo?: string | null;
                priority?: 'low' | 'medium' | 'high' | 'urgent';
                startDate?: string;
                endDate?: string;
                cost?: number;
              },
            });
          }
          break;
        case 'habit': {
          if (item.operation === 'bulk_edit') {
            throw new Error("Bulk edit for habits is not supported yet");
          }
          result = await createConfirmedHabit({
            projectId,
            habitData: item.data as HabitInput,
          });
          break;
        }
        default:
          throw new Error(`Unknown content type: ${item.type}`);
      }
    }

    return result;
  }, [
    projectId,
    createConfirmedTask,
    createConfirmedHabit,
    editConfirmedTask,
    bulkEditConfirmedTasks,
    deleteTask,
    deleteHabit,
    updateHabit,
    toggleHabitCompletion,
  ]);

  // Handlers - Helper functions defined first to avoid ReferenceErrors
  const handleConfirmItem = useCallback(async (indexOrCallId: number | string) => {
    // Resolve index if callId is passed
    let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
    if (typeof indexOrCallId === 'string') {
      index = pendingItems.findIndex(i => i.functionCall?.callId === indexOrCallId);
    }

    // If not found in pending items, we might be clicking a "retry" on a historical item
    // For now, we only support confirming current pending items.
    // If the item is not in pendingItems, it might be that the view thinks it is, but state is cleared.
    if (index === -1) {
      console.warn("Item not found in pending items");
      return;
    }

    const item = pendingItems[index];
    try {
      const result = await confirmSingleItem(item);

      if (item.functionCall && item.responseId && threadId) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId,
            responseId: item.responseId,
            results: [{
              callId: item.functionCall.callId,
              result: JSON.stringify({
                ...item,
                status: 'confirmed',
                outcome: result
              }),
            }]
          });
        } catch (e) {
          console.error("Failed to mark function call as confirmed", e);
        }
      }

      const resolvedId = item.clientId;
      setPendingItems((prev) =>
        prev.map((entry) =>
          entry.clientId === resolvedId ? { ...entry, status: "confirmed" } : entry
        )
      );

      let successMessage = result.message || `${item.type} created successfully`;
      if ('taskId' in result && result.taskId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Task "${title}" created`;
      }
      if ('habitId' in result && result.habitId) {
        const name = (item.data as { name?: string }).name || 'Untitled';
        successMessage = `Habit "${name}" created`;
      }

      toast.success(successMessage);

      scheduleResolvedRemoval(resolvedId);
    } catch (error) {
      toast.error(`Failed to create ${item.type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pendingItems, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, scheduleResolvedRemoval]);

  const handleRejectItem = useCallback(async (indexOrCallId: number | string) => {
    // Resolve index
    let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
    if (typeof indexOrCallId === 'string') {
      index = pendingItems.findIndex(i => i.functionCall?.callId === indexOrCallId);
    }

    if (index === -1) {
      console.warn("Item not found in pending items");
      return;
    }

    const item = pendingItems[index];
    const resolvedId = item.clientId;
    setPendingItems((prev) =>
      prev.map((entry) =>
        entry.clientId === resolvedId ? { ...entry, status: "rejected" } : entry
      )
    );

    toast.info(`${item.type} creation cancelled`);

    if (item.functionCall && item.responseId && threadId) {
      try {
        await markFunctionCallsAsConfirmed({
          threadId,
          responseId: item.responseId,
          results: [{
            callId: item.functionCall.callId,
            status: 'rejected',
            result: "User rejected this action."
          }],
        });
      } catch (error) {
        console.error("Failed to mark function call as rejected", error);
      }
    }

    scheduleResolvedRemoval(resolvedId);
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, scheduleResolvedRemoval]);

  const handleRejectAll = useCallback(async () => {
    const itemsToReject = [...pendingItems];
    const resolvedIds = itemsToReject.map((item) => item.clientId).filter(Boolean) as string[];
    setPendingItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: "rejected",
      }))
    );
    toast.info("All item creations cancelled");

    if (threadId) {
      const groupedResults = new Map<string, { callId: string; result: string | undefined; status?: "rejected" }[]>();
      for (const item of itemsToReject) {
        if (item.functionCall && item.responseId) {
          if (!groupedResults.has(item.responseId)) {
            groupedResults.set(item.responseId, []);
          }
          groupedResults.get(item.responseId)!.push({
            callId: item.functionCall.callId,
            result: "User rejected this action.",
            status: 'rejected',
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

    resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, scheduleResolvedRemoval]);

  const handleAutoRejectPendingItems = useCallback(async () => {
    const itemsToReject = pendingItems.filter(
      (item) => item.status !== "confirmed" && item.status !== "rejected"
    );
    if (itemsToReject.length === 0) return 0;

    const resolvedIds = itemsToReject.map((item) => item.clientId).filter(Boolean) as string[];
    setPendingItems((prev) =>
      prev.map((item) =>
        resolvedIds.includes(item.clientId ?? "") ? { ...item, status: "rejected" } : item
      )
    );
    if (threadId) {
      const groupedResults = new Map<string, { callId: string; result: string | undefined; status?: "rejected" }[]>();
      for (const item of itemsToReject) {
        if (item.functionCall && item.responseId) {
          if (!groupedResults.has(item.responseId)) {
            groupedResults.set(item.responseId, []);
          }
          groupedResults.get(item.responseId)!.push({
            callId: item.functionCall.callId,
            result: "User rejected this action.",
            status: 'rejected',
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
          console.error("Failed to auto-reject function calls", error);
        }
      }
    }

    resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
    return itemsToReject.length;
  }, [
    pendingItems,
    threadId,
    markFunctionCallsAsConfirmed,
    scheduleResolvedRemoval,
  ]);

  const handleConfirmAll = useCallback(async () => {
    setIsBulkProcessing(true);
    try {
      const resolvedIds = pendingItems.map((item) => item.clientId).filter(Boolean) as string[];
      let successCount = 0;
      let failureCount = 0;
      const resultsByResponseId = new Map<string, { callId: string; result: string }[]>();
      const createdItemsDetails: string[] = [];

      for (const item of pendingItems) {
        try {
          const result = await confirmSingleItem(item);
          successCount++;

          if (result.success) {
            if ('taskId' in result && result.taskId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Task "${title}"`);
            }
          }

          if (item.functionCall && item.responseId && result) {
            if (!resultsByResponseId.has(item.responseId)) {
              resultsByResponseId.set(item.responseId, []);
            }
            resultsByResponseId.get(item.responseId)!.push({
              callId: item.functionCall.callId,
              result: JSON.stringify({
                ...item,
                status: 'confirmed',
                outcome: result
              }),
            });
          }
        } catch (error) {
          console.error(`Failed to create ${item.type}:`, error);
          failureCount++;
        }
      }

      if (threadId) {
        for (const [responseId, results] of resultsByResponseId.entries()) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId,
              responseId,
              results,
            });
          } catch (e) {
            console.error("Failed to mark function calls as confirmed", e);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} items${failureCount > 0 ? `, ${failureCount} failed` : ''}`);

      }

      if (failureCount > 0 && successCount === 0) {
        toast.error(`Failed to create all ${failureCount} items`);
      }

      setPendingItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: "confirmed",
        }))
      );
      resolvedIds.forEach((id) => scheduleResolvedRemoval(id));
    } catch {
      toast.error("Failed to process items");
    } finally {
      setIsBulkProcessing(false);
    }
  }, [pendingItems, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, scheduleResolvedRemoval]);

  const resetPendingState = useCallback(() => {
    setPendingItems([]);
  }, []);

  const handleUpdatePendingItem = useCallback((indexOrCallId: number | string, updates: Partial<PendingItem>) => {
    setPendingItems((prev) => {
      let index = typeof indexOrCallId === 'number' ? indexOrCallId : -1;
      if (typeof indexOrCallId === 'string') {
        index = prev.findIndex(i => i.functionCall?.callId === indexOrCallId);
      }

      if (index >= 0 && index < prev.length) {
        const newItems = [...prev];
        newItems[index] = { ...newItems[index], ...updates };
        return newItems;
      }
      return prev;
    });
  }, []);

  return {
    pendingItems,
    isBulkProcessing,
    handleConfirmAll,
    handleConfirmItem,
    handleRejectItem,
    handleRejectAll,
    handleAutoRejectPendingItems,
    handleUpdatePendingItem,
    resetPendingState,
  };
};

export default usePendingItems;
