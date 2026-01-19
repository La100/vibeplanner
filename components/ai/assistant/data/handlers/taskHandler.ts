/**
 * Task Confirmation Handler
 * 
 * Handles confirmation of task-related pending items.
 */

import type { PendingItem, TaskInput } from "../types";
import type { ConfirmContext, ConfirmResult } from "./types";

interface TaskMutations {
  createConfirmedTask: (args: { projectId: string; taskData: TaskInput }) => Promise<{ success: boolean; message: string; taskId?: string }>;
  editConfirmedTask: (args: { taskId: string; updates: Partial<TaskInput> }) => Promise<{ success: boolean; message: string }>;
  deleteTask: (args: { taskId: string }) => Promise<void>;
}

export function createTaskHandler(mutations: TaskMutations) {
  return async (item: PendingItem, context: ConfirmContext): Promise<ConfirmResult> => {
    const { projectId } = context;
    const { operation, data } = item;

    switch (operation) {
      case "create": {
        const taskData = data as TaskInput;
        const cleanTaskData = { ...taskData };
        delete (cleanTaskData as Record<string, unknown>).assignedToName;

        const result = await mutations.createConfirmedTask({
          projectId,
          taskData: cleanTaskData,
        });

        return {
          success: result.success,
          message: result.message,
          id: result.taskId,
        };
      }

      case "edit": {
        const editData = data as { taskId: string } & Partial<TaskInput>;
        const { taskId, ...updates } = editData;

        if (!taskId) {
          return { success: false, message: "No task ID provided for edit" };
        }

        const result = await mutations.editConfirmedTask({
          taskId,
          updates,
        });

        return {
          success: result.success,
          message: result.message,
        };
      }

      case "delete": {
        const deleteData = data as { taskId: string };
        
        if (!deleteData.taskId) {
          return { success: false, message: "No task ID provided for deletion" };
        }

        await mutations.deleteTask({ taskId: deleteData.taskId });
        return { success: true, message: "Task deleted successfully" };
      }

      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }
  };
}


