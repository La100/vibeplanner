import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Utility function to check project access
const hasProjectAccess = async (ctx: any, projectId: Id<"projects">, requireWriteAccess = false): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const project = await ctx.db.get(projectId);
    if (!project) return false;

    const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q: any) =>
            q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
        )
        .filter((q: any) => q.eq(q.field("isActive"), true))
        .first();

    if (!membership) return false;
    
    if (membership.role === 'customer') {
        if (requireWriteAccess) return false;
        return membership.projectIds?.includes(projectId) ?? false;
    }

    const validRoles = requireWriteAccess ? ["admin", "member"] : ["admin", "member", "customer"];
    return validRoles.includes(membership.role);
};

// ====== QUERIES ======

export const getProjectCalendarEvents = query({
  args: { 
    projectId: v.id("projects"),
    dateRange: v.optional(v.object({
      startDate: v.number(),
      endDate: v.number()
    }))
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return { tasks: [], shoppingItems: [], todos: [] };

    // Get tasks with dates
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Filter tasks based on date range if provided
    // A task is included if it has either startDate or endDate
    let tasksWithDates = allTasks.filter(task => 
      task.startDate || task.endDate
    );

    if (args.dateRange) {
      tasksWithDates = tasksWithDates.filter(task => {
        // Use endDate if available, otherwise startDate
        const taskDate = task.endDate || task.startDate;
        if (!taskDate) return false;
        
        return (
          taskDate <= args.dateRange!.endDate &&
          taskDate >= args.dateRange!.startDate
        );
      });
    }

    // Get shopping items with buyBefore dates
    const allShoppingItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    let shoppingItemsWithDates = allShoppingItems.filter(item => item.buyBefore);

    if (args.dateRange) {
      shoppingItemsWithDates = shoppingItemsWithDates.filter(item => {
        if (!item.buyBefore) return false;
        return (
          item.buyBefore >= args.dateRange!.startDate &&
          item.buyBefore <= args.dateRange!.endDate
        );
      });
    }

    // Get tasks without dates for todos
    const todosWithoutDates = allTasks.filter(task => 
      !task.startDate && !task.endDate
    );

    // Enrich tasks with user data
    const enrichedTasks = await Promise.all(
      tasksWithDates.map(async (task) => {
        let assignedToName: string | undefined;
        let assignedToImageUrl: string | undefined;
        
        if (task.assignedTo) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!))
            .unique();
          if (user) {
            assignedToName = user.name;
            assignedToImageUrl = user.imageUrl;
          }
        }

        const createdByUser = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.createdBy))
          .unique();

        return {
          ...task,
          assignedToName,
          assignedToImageUrl,
          createdByName: createdByUser?.name,
        };
      })
    );

    // Enrich shopping items with user data
    const enrichedShoppingItems = await Promise.all(
      shoppingItemsWithDates.map(async (item) => {
        let assignedToName: string | undefined;
        let assignedToImageUrl: string | undefined;
        
        if (item.assignedTo) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", item.assignedTo!))
            .unique();
          if (user) {
            assignedToName = user.name;
            assignedToImageUrl = user.imageUrl;
          }
        }

        const createdByUser = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", item.createdBy))
          .unique();

        // Get section name if exists
        let sectionName: string | undefined;
        if (item.sectionId) {
          const section = await ctx.db.get(item.sectionId);
          sectionName = section?.name;
        }

        return {
          ...item,
          assignedToName,
          assignedToImageUrl,
          createdByName: createdByUser?.name,
          sectionName,
        };
      })
    );

    // Enrich todos
    const enrichedTodos = await Promise.all(
      todosWithoutDates.map(async (todo) => {
        let assignedToName: string | undefined;
        let assignedToImageUrl: string | undefined;
        
        if (todo.assignedTo) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", todo.assignedTo!))
            .unique();
          if (user) {
            assignedToName = user.name;
            assignedToImageUrl = user.imageUrl;
          }
        }

        return {
          ...todo,
          assignedToName,
          assignedToImageUrl,
        };
      })
    );

    return {
      tasks: enrichedTasks,
      shoppingItems: enrichedShoppingItems,
      todos: enrichedTodos,
    };
  },
});

export const getUpcomingEvents = query({
  args: { 
    projectId: v.id("projects"),
    daysAhead: v.optional(v.number()) // default 7 days
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const now = Date.now();
    const daysAhead = args.daysAhead || 7;
    const endDate = now + (daysAhead * 24 * 60 * 60 * 1000);

    // Get data directly instead of calling another query
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const allShoppingItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const tasksWithDates = allTasks.filter(task => {
      // Use endDate if available, otherwise startDate
      const taskDate = task.endDate || task.startDate;
      if (!taskDate) return false;
      
      return (
        taskDate <= endDate &&
        taskDate >= now
      );
    });

    const shoppingItemsWithDates = allShoppingItems.filter(item => {
      if (!item.buyBefore) return false;
      return item.buyBefore >= now && item.buyBefore <= endDate;
    });

    // Combine and sort all events by date
    const allEvents = [
      ...tasksWithDates.map(task => ({
        type: "task" as const,
        id: task._id,
        title: task.title,
        date: (task.endDate || task.startDate)!,
        priority: task.priority || "medium",
        status: task.status,
        data: task
      })),
      ...shoppingItemsWithDates.map(item => ({
        type: "shopping" as const,
        id: item._id,
        title: item.name,
        date: item.buyBefore!,
        priority: item.priority || "medium",
        status: item.realizationStatus,
        data: item
      }))
    ].sort((a, b) => a.date - b.date);

    return allEvents;
  },
});

export const getOverdueEvents = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const now = Date.now();

    // Get data directly
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const allShoppingItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get overdue items (not completed/done)
    const overdueEvents = [
      ...allTasks
        .filter(task => {
          if (task.status === "done") return false;
          const taskDate = task.endDate || task.startDate;
          return taskDate && taskDate < now;
        })
        .map(task => ({
          type: "task" as const,
          id: task._id,
          title: task.title,
          date: (task.endDate || task.startDate)!,
          priority: task.priority || "medium",
          status: task.status,
          data: task
        })),
      ...allShoppingItems
        .filter(item => 
          item.realizationStatus !== "COMPLETED" && 
          item.realizationStatus !== "CANCELLED" &&
          item.buyBefore && item.buyBefore < now
        )
        .map(item => ({
          type: "shopping" as const,
          id: item._id,
          title: item.name,
          date: item.buyBefore!,
          priority: item.priority || "medium",
          status: item.realizationStatus,
          data: item
        }))
    ].sort((a, b) => a.date - b.date);

    return overdueEvents;
  },
});

// ====== MUTATIONS ======

export const updateTaskDates = mutation({
  args: {
    taskId: v.id("tasks"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const hasAccess = await hasProjectAccess(ctx, task.projectId, true);
    if (!hasAccess) throw new Error("Permission denied");

    await ctx.db.patch(args.taskId, { 
      startDate: args.startDate,
      endDate: args.endDate 
    });

    return { success: true };
  },
});

export const updateShoppingItemBuyBefore = mutation({
  args: {
    itemId: v.id("shoppingListItems"),
    buyBefore: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Shopping item not found");

    const hasAccess = await hasProjectAccess(ctx, item.projectId, true);
    if (!hasAccess) throw new Error("Permission denied");

    await ctx.db.patch(args.itemId, { buyBefore: args.buyBefore });

    return { success: true };
  },
});