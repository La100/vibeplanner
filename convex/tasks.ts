import { v } from "convex/values";
import { api } from "./_generated/api";
import { query, mutation, internalMutation, action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Utility function to check project access
const hasProjectAccess = async (ctx: any, projectId: Id<"projects">): Promise<boolean> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }

  const project = await ctx.db.get(projectId);
  if (!project) {
    return false;
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) {
    return false;
  }
  
  if (membership.role === 'client') {
    return membership.projectIds?.includes(projectId) ?? false;
  }

  return ["admin", "member", "viewer"].includes(membership.role);
};

// ====== QUERIES ======

export const listProjectTasks = query({
  args: {
    projectId: v.id("projects"),
    filters: v.optional(
      v.object({
        status: v.optional(v.array(v.string())),
        priority: v.optional(v.array(v.string())),
        searchQuery: v.optional(v.string()),
        assignedTo: v.optional(v.array(v.string())),
        tags: v.optional(v.array(v.string())),
      })
    ),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) {
      return [];
    }

    let tasksQuery = ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    let tasks = await tasksQuery.collect();

    // Apply filters
    if (args.filters) {
      tasks = tasks.filter((task) => {
        const { status, priority, searchQuery, assignedTo, tags } = args.filters!;
        if (status && status.length > 0 && !status.includes(task.status)) {
          return false;
        }
        if (priority && priority.length > 0 && task.priority && !priority.includes(task.priority)) {
          return false;
        }
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        if (assignedTo && assignedTo.length > 0 && task.assignedTo && !assignedTo.includes(task.assignedTo)) {
            return false;
        }
        if (tags && tags.length > 0) {
          if (!task.tags || task.tags.length === 0) return false;
          if (!tags.some(filterTag => task.tags.includes(filterTag))) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply sorting
    if (args.sortBy) {
        tasks.sort((a, b) => {
            const fieldA = a[args.sortBy as keyof typeof a];
            const fieldB = b[args.sortBy as keyof typeof b];

            // Handle undefined or null values
            if (fieldA == null && fieldB == null) return 0;
            if (fieldA == null) return args.sortOrder === 'desc' ? 1 : -1;
            if (fieldB == null) return args.sortOrder === 'desc' ? -1 : 1;

            let comparison = 0;
            if (fieldA > fieldB) {
                comparison = 1;
            } else if (fieldA < fieldB) {
                comparison = -1;
            }

            return args.sortOrder === 'desc' ? -comparison : comparison;
        });
    }

    const tasksWithDetails = await Promise.all(
      tasks.map(async (task) => {
        let assignedToName: string | undefined = "Unassigned";
        let assignedToImageUrl: string | undefined = undefined;
        let createdByName: string | undefined = "Unknown";
        
        const commentCount = (await ctx.db.query("comments").withIndex("by_task", q => q.eq("taskId", task._id)).collect()).length;

        if (task.assignedTo) {
          const assignedUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) =>
              q.eq("clerkUserId", task.assignedTo!)
            )
            .unique();
          if (assignedUser) {
            assignedToName = assignedUser.name;
            assignedToImageUrl = assignedUser.imageUrl;
        }
        }
        
        const createdByUser = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) =>
            q.eq("clerkUserId", task.createdBy)
          )
          .unique();

        if (createdByUser) {
          createdByName = createdByUser.name;
        }

        return {
          ...task,
          assignedToName,
          assignedToImageUrl,
          createdByName,
          commentCount,
        };
      })
    );

    return tasksWithDetails;
  },
});

export const getCommentsForTask = query({
    args: { taskId: v.id("tasks") },
    async handler(ctx, args) {
        const comments = await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
            .order("desc")
            .collect();
        
        return Promise.all(
            comments.map(async (comment) => {
                const author = await ctx.db
                    .query("users")
                    .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", comment.authorId))
                    .unique();
                return {
                    ...comment,
                    authorName: author?.name,
                    authorImageUrl: author?.imageUrl,
                };
            })
        );
    }
});

export const getProjectTasksWithDates = query({
  args: { 
    projectId: v.id("projects"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    let query = ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId));
    
    const tasks = await query.collect();
    
    // Filtruj zadania z datami w zakresie
    return tasks.filter(task => {
      if (!task.endDate) return false;
      if (args.startDate && task.endDate < args.startDate) return false;
      if (args.endDate && task.endDate > args.endDate) return false;
      return true;
    });
  }
});

export const listTeamTasks = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();
    
    // Pobierz informacje o projektach dla zadań
    const tasksWithProjects = await Promise.all(
      tasks.map(async (task) => {
        const project = await ctx.db.get(task.projectId);
        return {
          ...task,
          projectName: project?.name || "Unknown Project",
          projectSlug: project?.slug || "",
        };
      })
    );
    
    return tasksWithProjects;
  }
});

export const getTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    let assignedToName: string | undefined;
    let assignedToImageUrl: string | undefined;

    if (task.assignedTo) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!))
        .unique();
      assignedToName = user?.name ?? user?.email;
      assignedToImageUrl = user?.imageUrl;
    }

    return { ...task, assignedToName, assignedToImageUrl };
  }
});

export const getTaskById = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    let assignedToName: string | undefined;
    let assignedToImageUrl: string | undefined;

    if (task.assignedTo) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!))
        .unique();
      assignedToName = user?.name ?? user?.email;
      assignedToImageUrl = user?.imageUrl;
    }

    return { ...task, assignedToName, assignedToImageUrl };
  }
});

// ====== MUTATIONS ======

export const createTask = mutation({
  args: {
    title: v.string(),
    projectId: v.id("projects"),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      content: args.content,
      projectId: args.projectId,
      teamId: project.teamId,
      status: args.status || "todo",
      priority: args.priority,
      assignedTo: args.assignedTo,
      createdBy: identity.subject,
      startDate: args.startDate,
      endDate: args.endDate,
      dueDate: args.dueDate,
      estimatedHours: args.estimatedHours,
      tags: args.tags || [],
      cost: args.cost,
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done")
    ),
  },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { status: args.status });
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { taskId, ...rest } = args;
    await ctx.db.patch(taskId, rest);
  }
});

export const updateTaskDates = mutation({
  args: {
    taskId: v.id("tasks"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const { taskId, startDate, endDate } = args;
    await ctx.db.patch(taskId, { startDate, endDate });
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId);
  },
});

export const addComment = mutation({
    args: {
        taskId: v.id("tasks"),
        content: v.string(),
    },
    async handler(ctx, args) {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const task = await ctx.db.get(args.taskId);
        if (!task) {
            throw new Error("Task not found");
        }

        await ctx.db.insert("comments", {
            content: args.content,
            authorId: identity.subject,
            taskId: args.taskId,
            teamId: task.teamId,
            isEdited: false,
        });
    }
});

export const updateProjectTaskStatusSettings = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    }),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.projectId, { taskStatusSettings: args.settings });
  }
});

// ====== ACTIONS ======

export const parseTaskFromChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Implement AI parsing logic here
    // This is a placeholder for a call to an external AI service
    const result = {
      isTask: true,
      title: "Design review",
      description: "Review the new design mockups for the homepage.",
      priority: "high",
      status: "todo",
      startDate: new Date().toISOString(),
      endDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString(),
      cost: 150,
    };
    return result;
  },
}); 