"use node";

/**
 * DEPRECATED: Większość confirmed actions przeniesiono do confirmedActions.ts
 * 
 * Ten plik zachowuje tylko bulkEditConfirmedTasks używany przez frontend.
 * Wszystkie inne create/edit/delete actions są teraz w confirmedActions.ts
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Doc } from "../_generated/dataModel";
const apiAny = require("../_generated/api").api as any;
const internalAny = require("../_generated/api").internal as any;

export const bulkEditConfirmedTasks = action({
  args: {
    projectId: v.id("projects"),
    selection: v.object({
      taskIds: v.optional(v.array(v.string())),
      applyToAll: v.optional(v.boolean()),
    }),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("done"),
      )),
      priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      )),
      assignedTo: v.optional(v.union(v.string(), v.null())),
    }),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    updatedCount: v.number(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized");
      }

      const runQuery = ctx.runQuery as any;
      const projectTasks = await runQuery(internalAny.tasks.listProjectTasksInternal, {
        projectId: args.projectId,
      }) as Doc<"tasks">[];

      let assignedToValue: string | null | undefined;
      if (args.updates.assignedTo !== undefined) {
        if (args.updates.assignedTo === null) {
          assignedToValue = null;
        } else {
          const clerkUserId = args.updates.assignedTo;
          const userDoc = await runQuery(apiAny.users.getByClerkId, {
            clerkUserId,
          }) as Doc<"users"> | null;
          if (!userDoc) {
            throw new Error(`User with Clerk ID ${args.updates.assignedTo} not found`);
          }
          if (!userDoc.clerkUserId) {
            throw new Error(`User ${userDoc._id} is missing clerkUserId`);
          }
          assignedToValue = userDoc.clerkUserId;
        }
      }

      let targetTasks: Doc<"tasks">[] = projectTasks;
      const applyToAll = args.selection.applyToAll === true;
      if (!applyToAll) {
        const ids = new Set(
          (args.selection.taskIds ?? [])
            .map((id) => id?.toString())
            .filter((id): id is string => Boolean(id)),
        );
        targetTasks = projectTasks.filter((task: any) => ids.has(task._id));
      }

      if (targetTasks.length === 0) {
        return {
          success: true,
          updatedCount: 0,
          message: "No tasks matched the selection",
        };
      }

      type UpdateFields = Pick<
      Doc<"tasks">,
      "title" | "description" | "status" | "priority" | "assignedTo"
    >;
      const updatesToApply: Partial<UpdateFields> = {};
      if (args.updates.title !== undefined) updatesToApply.title = args.updates.title;
      if (args.updates.description !== undefined) updatesToApply.description = args.updates.description;
      if (args.updates.status !== undefined) updatesToApply.status = args.updates.status;
      if (args.updates.priority !== undefined) updatesToApply.priority = args.updates.priority;
      if (assignedToValue !== undefined) updatesToApply.assignedTo = assignedToValue;

      if (Object.keys(updatesToApply).length === 0) {
        return {
          success: false,
          updatedCount: 0,
          message: "No fields were provided for update",
        };
      }

      let updatedCount = 0;
      const errors: string[] = [];

      for (const task of targetTasks) {
        try {
          await ctx.runMutation(apiAny.tasks.updateTask, {
            taskId: task._id,
            ...updatesToApply,
          });
          updatedCount++;
        } catch (taskError) {
          errors.push(`Task ${task._id}: ${taskError}`);
        }
      }

      const errorMessage = errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : '';
      return {
        success: errors.length === 0,
        updatedCount,
        message: `Updated ${updatedCount} tasks successfully${errorMessage}`,
      };
    } catch (error) {
      return {
        success: false,
        updatedCount: 0,
        message: `Failed to update tasks: ${error}`,
      };
    }
  },
});
