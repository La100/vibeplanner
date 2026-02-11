import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

const apiAny = require("./_generated/api").api as any;
const internalAny = require("./_generated/api").internal as any;

// Utility function to check project read access
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
    .unique();

  if (!membership || !membership.isActive) return false;

  if (membership.role === 'admin' || membership.role === 'member') {
    return true;
  }

  return false;
};

const getProjectAccessForUser = async (
  ctx: any,
  projectId: Id<"projects">,
  clerkUserId: string
) => {
  const project = await ctx.db.get(projectId);
  if (!project) return null;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", clerkUserId)
    )
    .unique();

  if (!membership || !membership.isActive) return null;
  if (membership.role !== "admin" && membership.role !== "member") return null;

  return { project, membership };
};

// Utility function to check task read/write access
const hasTaskAccess = async (ctx: any, taskId: Id<"tasks">, requireWriteAccess = false): Promise<boolean> => {
  const task = await ctx.db.get(taskId);
  if (!task) return false;
  return await hasProjectAccess(ctx, task.projectId, requireWriteAccess);
}

const fetchUsersByClerkIds = async (
  ctx: any,
  clerkUserIds: Iterable<string | null | undefined>
) => {
  const uniqueIds = [...new Set([...clerkUserIds].filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map<string, any>();

  const users = await Promise.all(
    uniqueIds.map((clerkUserId) =>
      ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
        .unique()
    )
  );

  const byClerkId = new Map<string, any>();
  for (const user of users) {
    if (user) byClerkId.set(user.clerkUserId, user);
  }
  return byClerkId;
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
      })
    ),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    let tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Apply filters
    if (args.filters) {
      tasks = tasks.filter((task) => {
        const { status, priority, searchQuery, assignedTo } = args.filters!;
        if (status && status.length > 0 && !status.includes(task.status)) return false;
        if (priority && priority.length > 0 && task.priority && !priority.includes(task.priority)) return false;
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (assignedTo && assignedTo.length > 0 && (!task.assignedTo || !assignedTo.includes(task.assignedTo))) return false;
        return true;
      });
    }

    // Apply sorting
    if (args.sortBy) {
      tasks.sort((a, b) => {
        const sortKey = args.sortBy === "createdAt" ? "_creationTime" : args.sortBy;
        const fieldA = a[sortKey as keyof typeof a] as any;
        const fieldB = b[sortKey as keyof typeof b] as any;
        if (fieldA == null && fieldB == null) return 0;
        if (fieldA == null) return args.sortOrder === 'desc' ? 1 : -1;
        if (fieldB == null) return args.sortOrder === 'desc' ? -1 : 1;
        let comparison = 0;
        if (fieldA > fieldB) comparison = 1;
        else if (fieldA < fieldB) comparison = -1;
        return args.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    const usersByClerkId = await fetchUsersByClerkIds(
      ctx,
      tasks.flatMap((task) => [task.assignedTo ?? null, task.createdBy])
    );

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const commentCountByTaskId = new Map<string, number>();
    for (const comment of comments) {
      if (!comment.taskId) continue;
      const taskId = String(comment.taskId);
      commentCountByTaskId.set(taskId, (commentCountByTaskId.get(taskId) ?? 0) + 1);
    }

    return tasks.map((task) => {
      const assignedUser = task.assignedTo ? usersByClerkId.get(task.assignedTo) : undefined;
      const createdByUser = usersByClerkId.get(task.createdBy);
      const commentCount = commentCountByTaskId.get(String(task._id)) ?? 0;

      return {
        ...task,
        assignedToName: assignedUser?.name,
        assignedToImageUrl: assignedUser?.imageUrl,
        createdByName: createdByUser?.name,
        commentCount,
      };
    });
  },
});

export const listProjectTasksForAI = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("tasks"),
      projectId: v.id("projects"),
      assignedTo: v.union(v.string(), v.null()),
    })
  ),
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return tasks.map((task) => ({
      _id: task._id,
      projectId: task.projectId,
      assignedTo: task.assignedTo ?? null,
    }));
  },
});

export const getTaskForAI = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tasks"),
      projectId: v.id("projects"),
      assignedTo: v.union(v.string(), v.null()),
    })
  ),
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    return {
      _id: task._id,
      projectId: task.projectId,
      assignedTo: task.assignedTo ?? null,
    };
  },
});

export const listProjectTasksInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("tasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      title: v.string(),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("done"),
      ),
      priority: v.optional(
        v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("urgent"),
          v.null(),
        ),
      ),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      createdBy: v.string(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      cost: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
  ),
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return tasks;
  },
});

export const getTaskInternal = internalQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tasks"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      title: v.string(),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("done"),
      ),
      priority: v.optional(
        v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
          v.literal("urgent"),
          v.null(),
        ),
      ),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      createdBy: v.string(),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      cost: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    })
  ),
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return null;

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    return task;
  },
});

export const getTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return null;
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const usersByClerkId = await fetchUsersByClerkIds(ctx, [task.assignedTo ?? null, task.createdBy]);
    const assignedUser = task.assignedTo ? usersByClerkId.get(task.assignedTo) : undefined;
    const createdByUser = usersByClerkId.get(task.createdBy);

    return {
      ...task,
      assignedToName: assignedUser?.name ?? assignedUser?.email,
      assignedToImageUrl: assignedUser?.imageUrl,
      createdByName: createdByUser?.name
    };
  },
});

export const getCommentsForTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId);
    if (!hasAccess) return [];
    const comments = await ctx.db.query("comments").withIndex("by_task", (q) => q.eq("taskId", args.taskId)).order("desc").collect();
    const usersByClerkId = await fetchUsersByClerkIds(
      ctx,
      comments.map((comment) => comment.authorId)
    );

    return comments.map((comment) => {
      const author = usersByClerkId.get(comment.authorId);
      return { ...comment, authorName: author?.name, authorImageUrl: author?.imageUrl };
    });
  }
});

export const listTeamTasks = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const projectById = new Map(projects.map((project) => [String(project._id), project]));

    const tasksWithProjects = tasks.map((task) => {
      const project = projectById.get(String(task.projectId));
      return {
        ...task,
        projectName: project?.name || "Unknown Project",
        projectSlug: project?.slug || "",
      };
    });

    return tasksWithProjects;
  }
});

export const getTasksForIndexing = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});


// ====== MUTATIONS ======

export const createTask = mutation({
  args: {
    title: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    cost: v.optional(v.number()),
    content: v.optional(v.string()),
    sectionId: v.optional(v.union(v.id("taskSections"), v.null())),
    link: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const hasAccess = await hasProjectAccess(ctx, args.projectId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      teamId: args.teamId,
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      assignedTo: args.assignedTo,
      createdBy: identity.subject,
      startDate: args.startDate,
      endDate: args.endDate,
      cost: args.cost,
      updatedAt: Date.now(),
      content: args.content ?? undefined,
      link: args.link,
    });

    return taskId;
  },
});

export const createTaskInternal = internalMutation({
  args: {
    title: v.string(),
    projectId: v.id("projects"),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    cost: v.optional(v.number()),
    content: v.optional(v.string()),
    actorUserId: v.string(),
    link: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await getProjectAccessForUser(ctx, args.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    const taskId = await ctx.db.insert("tasks", {
      projectId: args.projectId,
      teamId: access.project.teamId,
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      assignedTo: args.assignedTo,
      createdBy: args.actorUserId,
      startDate: args.startDate,
      endDate: args.endDate,
      cost: args.cost,
      updatedAt: Date.now(),
      content: args.content ?? undefined,
      link: args.link,
    });

    return taskId;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"), v.null())),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    cost: v.optional(v.number()),
    content: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const { taskId, ...updates } = args;
    const updatePayload = { ...updates, updatedAt: Date.now() };
    const assignedToProvided = Object.prototype.hasOwnProperty.call(updates, "assignedTo");
    const nextAssignedTo = assignedToProvided ? (updates.assignedTo ?? null) : (task.assignedTo ?? null);
    const prevAssignedTo = task.assignedTo ?? null;
    const targetUserId = nextAssignedTo ?? task.createdBy;

    await ctx.db.patch(taskId, updatePayload as Partial<Doc<"tasks">>);

  },
});

export const updateTaskInternal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"), v.null())),
    assignedTo: v.optional(v.union(v.string(), v.null())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    cost: v.optional(v.number()),
    content: v.optional(v.string()),
    actorUserId: v.string(),
    link: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const access = await getProjectAccessForUser(ctx, task.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    const { taskId, actorUserId, ...updates } = args;
    const updatePayload = { ...updates, updatedAt: Date.now() };
    const assignedToProvided = Object.prototype.hasOwnProperty.call(updates, "assignedTo");
    const nextAssignedTo = assignedToProvided ? (updates.assignedTo ?? null) : (task.assignedTo ?? null);
    const prevAssignedTo = task.assignedTo ?? null;
    const targetUserId = nextAssignedTo ?? task.createdBy;

    await ctx.db.patch(taskId, updatePayload as Partial<Doc<"tasks">>);

  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
  },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const originalStatus = task.status;
    if (originalStatus === args.status) return;
    await ctx.db.patch(args.taskId, { status: args.status, updatedAt: Date.now() });
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    await ctx.db.delete(args.taskId);


  },
});

export const deleteTaskInternal = internalMutation({
  args: {
    taskId: v.id("tasks"),
    actorUserId: v.string(),
  },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    const access = await getProjectAccessForUser(ctx, task.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    await ctx.db.delete(args.taskId);


  },
});

export const assignTask = mutation({
  args: { taskId: v.id("tasks"), userId: v.optional(v.string()) },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const originalAssignee = task.assignedTo;
    if (originalAssignee === args.userId) return;
    await ctx.db.patch(args.taskId, { assignedTo: args.userId });

  },
});

export const updateTaskContent = mutation({
  args: { taskId: v.id("tasks"), content: v.string() },
  async handler(ctx, args) {
    const hasAccess = await hasTaskAccess(ctx, args.taskId, true);
    if (!hasAccess) throw new Error("Permission denied.");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { content: args.content, updatedAt: Date.now() });
  }
});

// ====== ACTIONS ======

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateTaskDetailsFromPrompt = action({
  args: {
    prompt: v.string(),
    projectId: v.id("projects"),
    timezoneOffsetInMinutes: v.number(),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args): Promise<any> => {
    // 🔒 CHECK SUBSCRIPTION: AI features require Pro+ subscription
    const subscriptionCheck = await ctx.runQuery(internalAny.stripe.checkAIFeatureAccessByProject, {
      projectId: args.projectId
    });

    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI task generation.");
    }

    const teamMembers: any[] = await ctx.runQuery(internalAny.teams.getTeamMembersForIndexing, { projectId: args.projectId });
    const memberList = teamMembers.map((m: any) => ({
      name: m.name || m.email || 'Unknown User',
      email: m.email,
      id: m.clerkUserId
    }));

    const offsetHours = -args.timezoneOffsetInMinutes / 60;
    const offsetSign = offsetHours >= 0 ? "+" : "-";
    const offsetString = `UTC${offsetSign}${String(Math.floor(Math.abs(offsetHours))).padStart(2, '0')}:${String(Math.abs(args.timezoneOffsetInMinutes) % 60).padStart(2, '0')}`;

    let taskContext = "";
    if (args.taskId) {
      const task = await ctx.runQuery(apiAny.tasks.getTask, { taskId: args.taskId });
      if (task) {
        taskContext = `
The user is editing an existing task. Here is the current state of the task:
- Current Title: ${task.title}
- Current Description: ${task.description || 'N/A'}
- Current Status: ${task.status}
- Current Priority: ${task.priority || 'N/A'}
- Current Assignee: ${task.assignedToName || 'N/A'}
- Current Cost: ${task.cost || 'N/A'}

Your objective is to intelligently modify this task based on the user's prompt. For example, if the user says 'add X to the description', you must append 'X' to the current description. Do not just replace fields unless the user's intent is clearly to replace.
`;
      }
    }

    const systemPrompt: string = `
You are an intelligent assistant for a project management app.
Parse the user's request to extract task properties into a JSON object.
Today's date is ${new Date().toISOString().split('T')[0]}.
The user's local timezone is ${offsetString}. Please interpret all times in the user's prompt (e.g., "at 3 PM", "15:00") as being in this user's local timezone.
${taskContext}
The available properties are:
- title: string
- description: string
- priority: 'low' | 'medium' | 'high' | 'urgent' | null. To remove priority, return null.
- status: 'todo' | 'in_progress' | 'done'
- startDate: ISO 8601 date-time string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). IMPORTANT: After interpreting the time in the user's local timezone, convert it to UTC for the final ISO string. If the user does NOT provide a specific time, the time part of the string MUST be set to midnight UTC (T00:00:00.000Z).
- endDate: ISO 8601 date-time string (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). IMPORTANT: After interpreting the time in the user's local timezone, convert it to UTC for the final ISO string. If the user does NOT provide a specific time, the time part of the string MUST be set to midnight UTC (T00:00:00.000Z).
- cost: number
- assignedTo: string (must be one of the user IDs from the provided list)

The title is a short, concise summary. The description contains all other details, notes, and context.
Do NOT include dates or times in the title unless the user explicitly asks for them there; keep date/time details in the description.
If a single date or deadline is mentioned, set both startDate and endDate to that date. For date ranges like "from Monday to Friday", set startDate to Monday and endDate to Friday.

Here are the available team members for assignment. When assigning a task, match the name or email mentioned in the prompt to one of these users and return their ID (clerkUserId).
For example, if the prompt mentions "assign to John" or "assign to john@example.com", find the matching user in this list and use their 'id' value for the assignedTo field.
IMPORTANT: The assignedTo field must contain the user's ID (from the 'id' field below), NOT their name or email.

Team Members:
${JSON.stringify(memberList, null, 2)}

Analyze the following prompt and return ONLY the JSON object.
Prompt: "${args.prompt}"
`;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
      });

      const jsonResponse: string | null = response.choices[0].message.content;
      if (!jsonResponse) {
        throw new Error("AI did not return a response.");
      }

      return JSON.parse(jsonResponse);

    } catch (error) {
      console.error("Error parsing task from AI:", error);
      throw new Error("Failed to generate task details from prompt.");
    }
  },
});

// ====== HELPER FUNCTIONS FOR INCREMENTAL INDEXING ======

export const getTaskById = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getTasksChangedAfter = internalQuery({
  args: {
    projectId: v.id("projects"),
    since: v.number()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.or(
        q.gt(q.field("_creationTime"), args.since),
        q.gt(q.field("updatedAt"), args.since)
      ))
      .collect();
  },
});
