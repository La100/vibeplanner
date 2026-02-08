/**
 * Function Call Handler
 *
 * Handles all function calls from OpenAI and prepares pending items
 */

import type { ProjectContextSnapshot, TeamMember, PendingItem } from "../types";

export interface FunctionCallResult {
  pendingItems: PendingItem[];
  finalResponse: string;
  actionSummaries: string[];
}

// Helper to resolve team member assignment
const resolveTeamMember = (identifier: string | undefined, teamMembers: TeamMember[]) => {
  if (!identifier) return null;

  const member = teamMembers.find((m) =>
    m.name === identifier ||
    m.email === identifier ||
    m.clerkUserId === identifier
  );

  return member ? {
    clerkUserId: member.clerkUserId,
    name: member.name || member.email,
  } : null;
};

export const processFunctionCalls = async (
  functionCalls: any[],
  aiResponse: string,
  teamMembers: TeamMember[],
  getSnapshot: () => Promise<ProjectContextSnapshot>,
  responseId: string,
): Promise<FunctionCallResult> => {
  const pendingItems: PendingItem[] = [];
  const actionSummaries: string[] = [];
  let finalResponse = aiResponse;

  for (const functionCall of functionCalls) {
    const functionArgs = JSON.parse(functionCall.arguments);
    const funcCallDataPayload = {
      callId: functionCall.call_id,
      functionName: functionCall.name,
      arguments: functionCall.arguments,
    };

    switch (functionCall.name) {
      // ============================================
      // NEW GENERIC OPERATIONS
      // ============================================
      case "create_item":
        {
          const { type, data } = functionArgs;

          // Handle team member assignment for tasks
          if (type === "task" && data.assignedTo) {
            const resolved = resolveTeamMember(data.assignedTo, teamMembers);
            if (resolved) {
              data.assignedTo = resolved.clerkUserId;
              data.assignedToName = resolved.name;
            } else {
              data.assignedTo = null;
            }
          }

          pendingItems.push({
            type,
            operation: "create",
            data,
            functionCall: funcCallDataPayload,
            responseId,
          });

          const itemName = data.title || data.name || "item";
          actionSummaries.push(`${type}: "${itemName}"`);
          finalResponse = `I'll create a ${type}: "${itemName}". ${aiResponse}`;
        }
        break;

      case "create_multiple_items":
        {
          const { type, items } = functionArgs;

          items.forEach((itemData: any) => {
            // Handle team member assignment for tasks
            if (type === "task" && itemData.assignedTo) {
              const resolved = resolveTeamMember(itemData.assignedTo, teamMembers);
              if (resolved) {
                itemData.assignedTo = resolved.clerkUserId;
                itemData.assignedToName = resolved.name;
              } else {
                itemData.assignedTo = null;
              }
            }

            pendingItems.push({
              type,
              operation: "create",
              data: itemData,
              functionCall: funcCallDataPayload,
              responseId,
            });
          });

          actionSummaries.push(`${items.length} ${type}s`);
          finalResponse = `I'll create ${items.length} ${type}s for you. ${aiResponse}`;
        }
        break;

      case "update_item":
        {
          const { type, itemId, data } = functionArgs;
          const snapshot = await getSnapshot();

          // Handle team member assignment for tasks
          if (type === "task" && data.assignedTo) {
            const resolved = resolveTeamMember(data.assignedTo, teamMembers);
            if (resolved) {
              data.assignedTo = resolved.clerkUserId;
              data.assignedToName = resolved.name;
            } else {
              data.assignedTo = null;
            }
          }

          // Find original item based on type
          let originalItem: any = { _id: itemId };
          if (type === "task") {
            originalItem = snapshot.tasks.find((t) => t._id === itemId) || { _id: itemId };
          }

          pendingItems.push({
            type,
            operation: "edit",
            data: { ...data, itemId },
            updates: data,
            originalItem,
            functionCall: funcCallDataPayload,
            responseId,
          });

          finalResponse = `I'll update the ${type}. ${aiResponse}`;
        }
        break;

      case "update_multiple_items":
        {
          const { type, updates } = functionArgs;
          const snapshot = await getSnapshot();

          for (const update of updates) {
            const { itemId, data } = update;

            // Handle team member assignment for tasks
            if (type === "task" && data.assignedTo) {
              const resolved = resolveTeamMember(data.assignedTo, teamMembers);
              if (resolved) {
                data.assignedTo = resolved.clerkUserId;
                data.assignedToName = resolved.name;
              } else {
                data.assignedTo = null;
              }
            }

            // Find original item based on type
            let originalItem: any = { _id: itemId };
            if (type === "task") {
              originalItem = snapshot.tasks.find((t) => t._id === itemId) || { _id: itemId };
            }

            pendingItems.push({
              type,
              operation: "edit",
              data: { ...data, itemId },
              updates: data,
              originalItem,
              functionCall: funcCallDataPayload,
              responseId,
            });
          }

          finalResponse = `I'll update ${updates.length} ${type}s for you. ${aiResponse}`;
        }
        break;

      case "delete_item":
        {
          const { type, itemId, name, reason } = functionArgs;

          pendingItems.push({
            type,
            operation: "delete",
            data: { itemId, name, reason },
            functionCall: funcCallDataPayload,
            responseId,
          });

          finalResponse = name
            ? `I'll delete the ${type} "${name}". ${aiResponse}`
            : `I'll delete the ${type}. ${aiResponse}`;
        }
        break;

      // ============================================
      // LEGACY OPERATIONS (backward compatibility)
      // ============================================
      case "create_task":
        {
          // Resolve assignedTo name/email to Clerk ID
          if (functionArgs.assignedTo) {
            const assignedUser = teamMembers.find((m) =>
              m.name === functionArgs.assignedTo ||
              m.email === functionArgs.assignedTo ||
              m.clerkUserId === functionArgs.assignedTo
            );
            if (assignedUser) {
              functionArgs.assignedToName = assignedUser.name || assignedUser.email;
              functionArgs.assignedTo = assignedUser.clerkUserId;
            } else {
              functionArgs.assignedTo = null;
            }
          }

          pendingItems.push({
            type: "task",
            operation: "create",
            data: functionArgs,
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          actionSummaries.push(`task: "${functionArgs.title}"`);
          finalResponse = `I'll create a task: "${functionArgs.title}". ${aiResponse}`;
        }
        break;

      case "create_multiple_tasks":
        {
          const tasks = Array.isArray(functionArgs.tasks)
            ? functionArgs.tasks
            : Array.isArray(functionArgs.items)
              ? functionArgs.items
              : [];

          tasks.forEach((task: any) => {
            if (task.assignedTo) {
              const assignedUser = teamMembers.find((m) =>
                m.name === task.assignedTo ||
                m.email === task.assignedTo ||
                m.clerkUserId === task.assignedTo
              );
              if (assignedUser) {
                task.assignedToName = assignedUser.name || assignedUser.email;
                task.assignedTo = assignedUser.clerkUserId;
              } else {
                task.assignedTo = null;
              }
            }

            pendingItems.push({
              type: "task",
              operation: "create",
              data: task,
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          });
        }
        const taskCount = (Array.isArray(functionArgs.tasks) ? functionArgs.tasks : functionArgs.items || []).length;
        actionSummaries.push(`${taskCount} tasks`);
        finalResponse = `I'll create ${taskCount} tasks for you. ${aiResponse}`;
        break;

      case "edit_task":
        {
          const { taskId: editTaskId, ...taskUpdates } = functionArgs;
          const snapshot = await getSnapshot();
          const originalTask = snapshot.tasks.find((t) => t._id === editTaskId);

          if (taskUpdates.assignedTo) {
            const assignedUser = teamMembers.find(m =>
              m.name === taskUpdates.assignedTo ||
              m.email === taskUpdates.assignedTo ||
              m.clerkUserId === taskUpdates.assignedTo
            );
            if (assignedUser) {
              taskUpdates.assignedToName = assignedUser.name || assignedUser.email;
              taskUpdates.assignedTo = assignedUser.clerkUserId;
            } else {
              taskUpdates.assignedTo = null;
            }
          }

          pendingItems.push({
            type: "task",
            operation: "edit",
            data: functionArgs,
            updates: taskUpdates,
            originalItem: originalTask || { _id: editTaskId },
            functionCall: funcCallDataPayload,
            responseId: responseId,
          });
          finalResponse = `I'll update the task. ${aiResponse}`;
        }
        break;

      case "edit_multiple_tasks":
        {
          const snapshot = await getSnapshot();
          for (const task of functionArgs.tasks as Array<any>) {
            const { taskId: bulkEditTaskId, ...bulkTaskUpdates } = task;
            const originalBulkTask = snapshot.tasks.find((t) => t._id === bulkEditTaskId);

            if (bulkTaskUpdates.assignedTo) {
              const assignedUser = teamMembers.find(m =>
                m.name === bulkTaskUpdates.assignedTo ||
                m.email === bulkTaskUpdates.assignedTo ||
                m.clerkUserId === bulkTaskUpdates.assignedTo
              );
              if (assignedUser) {
                bulkTaskUpdates.assignedToName = assignedUser.name || assignedUser.email;
                bulkTaskUpdates.assignedTo = assignedUser.clerkUserId;
              } else {
                bulkTaskUpdates.assignedTo = null;
              }
            }

            pendingItems.push({
              type: "task",
              operation: "edit",
              data: task,
              updates: bulkTaskUpdates,
              originalItem: originalBulkTask || { _id: bulkEditTaskId },
              functionCall: funcCallDataPayload,
              responseId: responseId,
            });
          }
        }
        finalResponse = `I'll update ${functionArgs.tasks.length} tasks for you. ${aiResponse}`;
        break;

      case "delete_task":
        pendingItems.push({
          type: "task",
          operation: "delete",
          data: { taskId: functionArgs.taskId, reason: functionArgs.reason },
          functionCall: funcCallDataPayload,
          responseId: responseId,
        });
        finalResponse = `I'll delete the task. ${aiResponse}`;
        break;


      default:
        console.warn("Unhandled function call:", functionCall.name);
        break;
    }
  }

  return {
    pendingItems,
    finalResponse,
    actionSummaries,
  };
};
