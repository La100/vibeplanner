/**
 * Confirmed Actions - Tasks
 * 
 * Task CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { ensureProjectAccess } from "./helpers";
const apiAny = require("../../_generated/api").api as any;

export const createConfirmedTask = action({
  args: {
    projectId: v.id("projects"),
    taskData: v.object({
      title: v.string(),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"))),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      cost: v.optional(v.number()),
      link: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const { project } = await ensureProjectAccess(ctx, args.projectId, true);
      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.taskData.startDate) {
        startDateNumber = new Date(args.taskData.startDate).getTime();
      }
      if (args.taskData.endDate) {
        endDateNumber = new Date(args.taskData.endDate).getTime();
      }

      const taskId: any = await ctx.runMutation(apiAny.tasks.createTask, {
        projectId: args.projectId,
        teamId: project.teamId,
        title: args.taskData.title,
        description: args.taskData.description,
        content: args.taskData.content,
        assignedTo: args.taskData.assignedTo,
        priority: args.taskData.priority || "medium",
        status: args.taskData.status || "todo",
        startDate: startDateNumber,
        endDate: endDateNumber,
        cost: args.taskData.cost,
        link: args.taskData.link,
      });

      return {
        success: true,
        taskId,
        message: "Task created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create task: ${error}`,
      };
    }
  },
});

export const editConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"))),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      cost: v.optional(v.number()),
      link: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const task = await ctx.runQuery(apiAny.tasks.getTask, { taskId: args.taskId });
      if (!task) {
        throw new Error("Task not found");
      }
      await ensureProjectAccess(ctx, task.projectId, true);

      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.updates.startDate) {
        startDateNumber = new Date(args.updates.startDate).getTime();
      }
      if (args.updates.endDate) {
        endDateNumber = new Date(args.updates.endDate).getTime();
      }

      await ctx.runMutation(apiAny.tasks.updateTask, {
        taskId: args.taskId,
        title: args.updates.title,
        description: args.updates.description,
        content: args.updates.content,
        status: args.updates.status,
        assignedTo: args.updates.assignedTo,
        priority: args.updates.priority,
        startDate: startDateNumber,
        endDate: endDateNumber,
        cost: args.updates.cost,
        link: args.updates.link,
      });

      return {
        success: true,
        message: "Task updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update task: ${error}`,
      };
    }
  },
});

export const deleteConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const task = await ctx.runQuery(apiAny.tasks.getTask, { taskId: args.taskId });
      if (!task) {
        throw new Error("Task not found");
      }
      await ensureProjectAccess(ctx, task.projectId, true);

      await ctx.runMutation(apiAny.tasks.deleteTask, {
        taskId: args.taskId,
      });

      return {
        success: true,
        message: "Task deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete task: ${error}`,
      };
    }
  },
});














