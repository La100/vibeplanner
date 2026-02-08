import { internalAction, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Search tools for AI Agent
 * These allow the AI to search for tasks on-demand
 * instead of loading all data upfront
 */

export const searchTasks = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done")
    )),
    assignedTo: v.optional(v.string()),
    startDateFrom: v.optional(v.number()),
    startDateTo: v.optional(v.number()),
    endDateFrom: v.optional(v.number()),
    endDateTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    tasks: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all tasks for the project
    const internalAny = require("../_generated/api").internal as any;
    const allTasks = await ctx.runQuery(internalAny.rag.getProjectTasks, {
      projectId: args.projectId,
    }) as any[];

    let filteredTasks: any[] = allTasks;

    // Filter by status if provided
    if (args.status) {
      filteredTasks = filteredTasks.filter((task: any) => task.status === args.status);
    }

    // Filter by assignee if provided
    if (args.assignedTo) {
      filteredTasks = filteredTasks.filter((task: any) => task.assignedTo === args.assignedTo);
    }

    // Filter by date range if provided (matches if task overlaps range)
    if (
      typeof args.startDateFrom === "number" ||
      typeof args.startDateTo === "number" ||
      typeof args.endDateFrom === "number" ||
      typeof args.endDateTo === "number"
    ) {
      const rangeStart =
        typeof args.startDateFrom === "number"
          ? args.startDateFrom
          : typeof args.endDateFrom === "number"
          ? args.endDateFrom
          : null;
      const rangeEnd =
        typeof args.endDateTo === "number"
          ? args.endDateTo
          : typeof args.startDateTo === "number"
          ? args.startDateTo
          : null;

      filteredTasks = filteredTasks.filter((task: any) => {
        const taskStart = typeof task.startDate === "number" ? task.startDate : null;
        const taskEnd = typeof task.endDate === "number" ? task.endDate : null;
        if (taskStart == null && taskEnd == null) return false;

        const effectiveStart = taskStart ?? taskEnd;
        const effectiveEnd = taskEnd ?? taskStart;

        if (rangeStart != null && effectiveEnd != null && effectiveEnd < rangeStart) return false;
        if (rangeEnd != null && effectiveStart != null && effectiveStart > rangeEnd) return false;
        return true;
      });
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredTasks = filteredTasks.filter((task: any) => {
        const titleMatch = task.title?.toLowerCase().includes(queryLower);
        const descMatch = task.description?.toLowerCase().includes(queryLower);
        const assigneeMatch = task.assignedToName?.toLowerCase().includes(queryLower);
        return titleMatch || descMatch || assigneeMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredTasks.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredTasks.slice(0, limit);

    return {
      count: results.length,
      total: filteredTasks.length,
      tasks: results,
    };
  },
});

/**
 * Get a single item by ID - used for edit operations to fetch original data
 */
export const getItemById = internalQuery({
  args: {
    tableName: v.string(),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Direct DB lookup is faster and avoids auth issues in nested queries
      // We trust the calling function (listPendingItems) to verify access if needed
      // or we accept that AI needs to see the item to edit it.
      const item = await ctx.db.get(args.itemId as any);
      return item;
    } catch (error) {
      console.error(`Failed to fetch ${args.tableName} item ${args.itemId}:`, error);
      return null;
    }
  },
});
