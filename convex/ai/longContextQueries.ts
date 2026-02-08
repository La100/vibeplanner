import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentDateTime } from "./helpers/contextBuilder";

export const getProjectContextSnapshot = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    project: v.union(v.null(), v.object({
      _id: v.id("projects"),
      name: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("planning"),
        v.literal("active"),
        v.literal("on_hold"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      location: v.optional(v.string()),
      teamId: v.id("teams"),
      assistantPreset: v.optional(v.string()),
      assistantOnboardingStatus: v.optional(v.union(v.literal("pending"), v.literal("completed"))),
    })),
    tasks: v.array(v.object({
      _id: v.id("tasks"),
      title: v.string(),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("done"),
      ),
      priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
      )),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      assignedToName: v.optional(v.string()),
      startDate: v.optional(v.number()),
      endDate: v.optional(v.number()),
      cost: v.optional(v.number()),
    })),
    habits: v.array(v.object({
      _id: v.id("habits"),
      name: v.string(),
      description: v.optional(v.string()),
      targetValue: v.optional(v.number()),
      unit: v.optional(v.string()),
      frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
      scheduleDays: v.optional(v.array(v.string())),
      reminderTime: v.optional(v.string()),
      isActive: v.boolean(),
      completedToday: v.optional(v.boolean()),
      completionValue: v.optional(v.number()),
    })),
    files: v.array(v.any()),
    diaryEntries: v.array(v.object({
      date: v.string(),
      content: v.string(),
      mood: v.optional(v.string()),
      source: v.union(v.literal("user"), v.literal("assistant")),
    })),
    summary: v.string(),
  }),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);

    const team = project ? await ctx.db.get(project.teamId) : null;
    const { currentDate } = getCurrentDateTime(team?.timezone);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const habitCompletions = habits.length > 0
      ? await ctx.db
          .query("habitCompletions")
          .withIndex("by_project_and_date", (q) => q.eq("projectId", args.projectId).eq("date", currentDate))
          .collect()
      : [];
    const habitCompletionMap = new Map<string, { completed: true; value?: number }>();
    for (const completion of habitCompletions) {
      habitCompletionMap.set(String(completion.habitId), {
        completed: true,
        value: (completion as any).value as number | undefined,
      });
    }

    // Fetch recent diary entries (last 7 days)
    const allDiaryEntries = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const recentDiaryEntries = allDiaryEntries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);

    const uniqueAssignees = Array.from(
      new Set(tasks.map((task) => task.assignedTo).filter((id): id is string => Boolean(id))),
    );
    const assigneeNameMap = new Map<string, string>();
    if (uniqueAssignees.length > 0) {
      const users = await Promise.all(
        uniqueAssignees.map((clerkUserId) =>
          ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
            .unique(),
        ),
      );
      users.forEach((user, index) => {
        if (user) {
          assigneeNameMap.set(uniqueAssignees[index], user.name || user.email || uniqueAssignees[index]);
        }
      });
    }

    const summaryLines: Array<string> = [];
    summaryLines.push(`Tasks: ${tasks.length}`);
    summaryLines.push(`Habits: ${habits.length}`);
    summaryLines.push(`Diary entries: ${allDiaryEntries.length}`);

    return {
      project: project ? {
        _id: project._id,
        name: project.name,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        location: project.location,
        teamId: project.teamId,
        assistantPreset: (project as any).assistantPreset,
        assistantOnboardingStatus: (project as any).assistantOnboarding?.status,
      } : null,
      tasks: tasks.map(t => ({
        _id: t._id,
        title: t.title,
        description: t.description,
        content: t.content,
        status: t.status,
        priority: t.priority ?? undefined,
        assignedTo: t.assignedTo,
        assignedToName: t.assignedTo ? assigneeNameMap.get(t.assignedTo) : undefined,
        startDate: t.startDate,
        endDate: t.endDate,
        cost: t.cost,
      })),
      habits: habits.map((habit) => ({
        _id: habit._id,
        name: habit.name || (habit as any).title || "Habit",
        description: habit.description,
        targetValue: habit.targetValue,
        unit: habit.unit,
        frequency: habit.frequency,
        scheduleDays: habit.scheduleDays,
        reminderTime: habit.reminderTime,
        isActive: habit.isActive,
        completedToday: habitCompletionMap.has(String(habit._id)),
        completionValue: habitCompletionMap.get(String(habit._id))?.value,
      })),
      files: [],
      diaryEntries: recentDiaryEntries.map((entry) => ({
        date: entry.date,
        content: entry.content,
        mood: entry.mood,
        source: entry.source,
      })),
      summary: summaryLines.join(" | "),
    };
  },
});
