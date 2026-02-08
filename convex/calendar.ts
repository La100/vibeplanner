import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

const internalAny = require("./_generated/api").internal as any;

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

  if (membership.role === 'admin' || membership.role === 'member') {
    return true;
  }

  return false;
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
    if (!hasAccess) return { tasks: [], todos: [] };

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

    const tasksWithDates = allTasks.filter(task => {
      // Use endDate if available, otherwise startDate
      const taskDate = task.endDate || task.startDate;
      if (!taskDate) return false;

      return (
        taskDate <= endDate &&
        taskDate >= now
      );
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
        }))
    ].sort((a, b) => a.date - b.date);

    return overdueEvents;
  },
});

export const getProjectCalendarData = query({
  args: {
    projectId: v.id("projects"),
    month: v.string(), // "YYYY-MM" format
  },
  async handler(ctx, args) {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return { tasks: [], habits: [], habitCompletions: {} as Record<string, string[]>, diaryEntries: [] };

    const [yearStr, monthStr] = args.month.split("-");
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;
    const firstDay = new Date(Date.UTC(year, monthIdx, 1));
    const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0));
    const startTimestamp = firstDay.getTime();
    const endTimestamp = lastDay.getTime() + 86399999; // end of last day
    const startDateStr = args.month + "-01";
    const endDateStr = args.month + "-" + String(lastDay.getUTCDate()).padStart(2, "0");

    // --- Tasks ---
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const tasksInRange = allTasks.filter((task) => {
      const s = task.startDate;
      const e = task.endDate;
      if (!s && !e) return false;
      // Task overlaps month if: taskStart <= monthEnd AND taskEnd >= monthStart
      const taskStart = s || e!;
      const taskEnd = e || s!;
      return taskStart <= endTimestamp && taskEnd >= startTimestamp;
    });

    const enrichedTasks = await Promise.all(
      tasksInRange.map(async (task) => {
        let assignedToName: string | undefined;
        if (task.assignedTo) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!))
            .unique();
          if (user) assignedToName = user.name;
        }
        return {
          _id: task._id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          startDate: task.startDate,
          endDate: task.endDate,
          assignedToName,
        };
      })
    );

    // --- Habits ---
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const activeHabits = habits
      .filter((h) => h.isActive)
      .map((h) => ({
        _id: h._id,
        name: (h as any).name || (h as any).title || "Habit",
        scheduleDays: h.scheduleDays,
        frequency: h.frequency,
        isActive: h.isActive,
      }));

    // --- Habit Completions for the month ---
    const completionsByHabitId: Record<string, string[]> = {};
    // Fetch completions for each date in the range (using index)
    // We iterate day by day since the index is by_project_and_date with exact date match
    const dayCount = lastDay.getUTCDate();
    for (let d = 1; d <= dayCount; d++) {
      const dateStr = args.month + "-" + String(d).padStart(2, "0");
      const completions = await ctx.db
        .query("habitCompletions")
        .withIndex("by_project_and_date", (q: any) =>
          q.eq("projectId", args.projectId).eq("date", dateStr)
        )
        .collect();
      for (const c of completions) {
        const hid = String(c.habitId);
        if (!completionsByHabitId[hid]) completionsByHabitId[hid] = [];
        completionsByHabitId[hid].push(dateStr);
      }
    }

    // --- Diary Entries ---
    const allDiaryEntries = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const diaryEntries = allDiaryEntries
      .filter((e) => e.date >= startDateStr && e.date <= endDateStr)
      .map((e) => ({
        _id: e._id,
        date: e.date,
        mood: e.mood,
        contentPreview: e.content.length > 80 ? e.content.slice(0, 80) + "..." : e.content,
        source: e.source,
      }));

    return {
      tasks: enrichedTasks,
      habits: activeHabits,
      habitCompletions: completionsByHabitId,
      diaryEntries,
    };
  },
});

// ====== INTERNAL QUERIES (for AI tools) ======

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const getDayOverviewInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
    date: v.string(), // "YYYY-MM-DD"
  },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) return { date: args.date, tasks: [], habits: [], diary: null };

    // --- Tasks for this date ---
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const dateStart = new Date(args.date + "T00:00:00Z").getTime();
    const dateEnd = dateStart + 86399999;

    const dayTasks = allTasks.filter((task) => {
      const s = task.startDate;
      const e = task.endDate;
      if (!s && !e) return false;
      const taskStart = s || e!;
      const taskEnd = e || s!;
      return taskStart <= dateEnd && taskEnd >= dateStart;
    }).map((t) => ({
      _id: String(t._id),
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate,
      endDate: t.endDate,
    }));

    // --- Habits scheduled for this day + completions ---
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const dayOfWeek = DOW_KEYS[new Date(args.date + "T00:00:00").getDay()];

    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_project_and_date", (q: any) =>
        q.eq("projectId", args.projectId).eq("date", args.date)
      )
      .collect();

    const completionMap = new Map<string, number | undefined>();
    for (const c of completions) {
      completionMap.set(String(c.habitId), (c as any).value);
    }

    const dayHabits = habits
      .filter((h) => {
        if (!h.isActive) return false;
        if (!h.scheduleDays || h.scheduleDays.length === 0) return true;
        return h.scheduleDays.includes(dayOfWeek);
      })
      .map((h) => ({
        _id: String(h._id),
        name: (h as any).name || (h as any).title || "Habit",
        completed: completionMap.has(String(h._id)),
        value: completionMap.get(String(h._id)),
      }));

    // --- Diary entry ---
    const diaryEntry = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project_and_date", (q) =>
        q.eq("projectId", args.projectId).eq("date", args.date)
      )
      .first();

    return {
      date: args.date,
      tasks: dayTasks,
      habits: dayHabits,
      diary: diaryEntry
        ? { content: diaryEntry.content, mood: diaryEntry.mood, source: diaryEntry.source }
        : null,
    };
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
