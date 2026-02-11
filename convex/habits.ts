import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getCurrentDateTime } from "./ai/helpers/contextBuilder";
import {
  deriveReminderPlanFromDescription,
  getReminderPlanEntryForDate,
  normalizeReminderPlan,
  resolveReminderForDate,
} from "./messaging/reminderUtils";
const internalAny = require("./_generated/api").internal as any;

const reminderPlanEntryValidator = v.object({
  date: v.string(),
  reminderTime: v.string(),
  minStartTime: v.optional(v.string()),
  phaseLabel: v.optional(v.string()),
});

const normalizeReminderPlanForStorage = (
  value?: Array<{ date: string; reminderTime: string; minStartTime?: string; phaseLabel?: string }> | null
) => normalizeReminderPlan(value as any);

const deriveReminderPlanIfNeeded = ({
  reminderPlan,
  description,
  startDate,
}: {
  reminderPlan?: Array<{ date: string; reminderTime: string; minStartTime?: string; phaseLabel?: string }> | null;
  description?: string;
  startDate: string;
}) => {
  const normalizedPlan = normalizeReminderPlanForStorage(reminderPlan);
  if (normalizedPlan.length > 0) return normalizedPlan;
  const derivedPlan = deriveReminderPlanFromDescription({
    description,
    startDate,
    maxDay: 30,
  });
  return derivedPlan.length > 0 ? derivedPlan : undefined;
};

const hasProjectAccess = async (ctx: any, projectId: Id<"projects">): Promise<boolean> => {
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
  return membership.role === "admin" || membership.role === "member";
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

const getProjectDate = async (ctx: any, projectId: Id<"projects">): Promise<string> => {
  const project = await ctx.db.get(projectId);
  if (!project) {
    const { currentDate } = getCurrentDateTime();
    return currentDate;
  }
  const team = await ctx.db.get(project.teamId);
  const { currentDate } = getCurrentDateTime(team?.timezone);
  return currentDate;
};

const applyHabitCompletion = async (
  ctx: any,
  habit: any,
  date: string,
  completed: boolean | undefined,
  completedBy: string,
  value?: number
) => {
  const existing = await ctx.db
    .query("habitCompletions")
    .withIndex("by_habit_and_date", (q: any) => q.eq("habitId", habit._id).eq("date", date))
    .first();

  // If value is provided but completed is undefined, treat as completed
  const effectiveCompleted = completed ?? (value !== undefined ? true : undefined);

  if (effectiveCompleted === undefined) {
    if (existing) {
      await ctx.db.delete(existing._id);
      return { completed: false, date };
    }

    await ctx.db.insert("habitCompletions", {
      habitId: habit._id,
      projectId: habit.projectId,
      teamId: habit.teamId,
      date,
      completedAt: Date.now(),
      completedBy,
      ...(value !== undefined ? { value } : {}),
    } as any);
    return { completed: true, date, value };
  }

  if (effectiveCompleted) {
    if (existing) {
      // Update value if provided on existing completion
      if (value !== undefined) {
        await ctx.db.patch(existing._id, { value, completedAt: Date.now() } as any);
      }
    } else {
      await ctx.db.insert("habitCompletions", {
        habitId: habit._id,
        projectId: habit.projectId,
        teamId: habit.teamId,
        date,
        completedAt: Date.now(),
        completedBy,
        ...(value !== undefined ? { value } : {}),
      } as any);
    }
    return { completed: true, date, value };
  }

  if (existing) {
    await ctx.db.delete(existing._id);
  }
  return { completed: false, date };
};

export const listProjectHabits = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    const today = await getProjectDate(ctx, args.projectId);

    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (habits.length === 0) return [];

    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_project_and_date", (q) => q.eq("projectId", args.projectId).eq("date", today))
      .collect();

    const completionMap = new Map<string, { completed: true; value?: number }>();
    for (const completion of completions) {
      completionMap.set(String(completion.habitId), {
        completed: true,
        value: (completion as any).value as number | undefined,
      });
    }

    return habits.map((habit) => {
      const reminderPlan = normalizeReminderPlan((habit as any).reminderPlan);
      const todayPlan = getReminderPlanEntryForDate(reminderPlan, today);
      return {
        ...habit,
        name: habit.name || (habit as any).title || "Habit",
        completedToday: completionMap.has(String(habit._id)),
        completionValue: completionMap.get(String(habit._id))?.value,
        reminderPlan,
        effectiveTodayReminderTime: todayPlan?.reminderTime ?? habit.reminderTime,
        todayPhaseLabel: todayPlan?.phaseLabel,
        today,
      };
    });
  },
});

export const createHabit = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    scheduleDays: v.optional(v.array(v.string())), // ["mon", "tue", ...]
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
    reminderTime: v.optional(v.string()),
    reminderPlan: v.optional(v.array(reminderPlanEntryValidator)),
    source: v.optional(v.union(v.literal("user"), v.literal("assistant"), v.literal("gymbro_onboarding"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) throw new Error("Access denied");
    const today = await getProjectDate(ctx, args.projectId);
    const reminderPlan = deriveReminderPlanIfNeeded({
      reminderPlan: args.reminderPlan,
      description: args.description,
      startDate: today,
    });

    const habitId = await ctx.db.insert("habits", {
      name: args.name,
      description: args.description,
      projectId: args.projectId,
      teamId: project.teamId,
      createdBy: identity.subject,
      scheduleDays: args.scheduleDays,
      targetValue: args.targetValue,
      unit: args.unit,
      frequency: args.frequency ?? "daily",
      reminderTime: args.reminderTime,
      reminderPlan,
      isActive: true,
      source: args.source ?? "user",
    } as any);

    if (args.reminderTime || (reminderPlan && reminderPlan.length > 0)) {
      try {
        await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
          habitId,
        });
      } catch (error) {
        console.error("Failed to schedule habit reminder:", error);
      }
    }

    if (args.source === "gymbro_onboarding") {
      await ctx.db.patch(project._id, {
        assistantOnboarding: {
          status: "completed",
          lastUpdated: Date.now(),
        },
      } as any);
    }

    return habitId;
  },
});

export const toggleHabitCompletion = mutation({
  args: {
    habitId: v.id("habits"),
    date: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    value: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const habit = await ctx.db.get(args.habitId);
    if (!habit) throw new Error("Habit not found");

    const hasAccess = await hasProjectAccess(ctx, habit.projectId);
    if (!hasAccess) throw new Error("Access denied");

    const date = args.date ?? (await getProjectDate(ctx, habit.projectId));
    return await applyHabitCompletion(ctx, habit, date, args.completed, identity.subject, args.value);
  },
});

export const setHabitCompletionInternal = internalMutation({
  args: {
    habitId: v.id("habits"),
    actorUserId: v.string(),
    date: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    value: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit) throw new Error("Habit not found");

    const access = await getProjectAccessForUser(ctx, habit.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    const date = args.date ?? (await getProjectDate(ctx, habit.projectId));
    return await applyHabitCompletion(ctx, habit, date, args.completed, args.actorUserId, args.value);
  },
});

export const getHabitCompletionForDateInternal = internalQuery({
  args: {
    habitId: v.id("habits"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const completion = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_and_date", (q: any) => q.eq("habitId", args.habitId).eq("date", args.date))
      .first();

    return { completed: !!completion, value: (completion as any)?.value as number | undefined };
  },
});

export const createHabitInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    scheduleDays: v.optional(v.array(v.string())),
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
    reminderTime: v.optional(v.string()),
    reminderPlan: v.optional(v.array(reminderPlanEntryValidator)),
    source: v.optional(v.union(v.literal("user"), v.literal("assistant"), v.literal("gymbro_onboarding"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForUser(ctx, args.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");
    const today = await getProjectDate(ctx, args.projectId);
    const reminderPlan = deriveReminderPlanIfNeeded({
      reminderPlan: args.reminderPlan,
      description: args.description,
      startDate: today,
    });

    const habitId = await ctx.db.insert("habits", {
      name: args.name,
      description: args.description,
      projectId: args.projectId,
      teamId: access.project.teamId,
      createdBy: args.actorUserId,
      scheduleDays: args.scheduleDays,
      targetValue: args.targetValue,
      unit: args.unit,
      frequency: args.frequency ?? "daily",
      reminderTime: args.reminderTime,
      reminderPlan,
      isActive: args.isActive ?? true,
      source: args.source ?? "assistant",
    } as any);

    if (args.reminderTime || (reminderPlan && reminderPlan.length > 0)) {
      try {
        await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
          habitId,
        });
      } catch (error) {
        console.error("Failed to schedule habit reminder:", error);
      }
    }

    if (args.source === "gymbro_onboarding") {
      await ctx.db.patch(access.project._id, {
        assistantOnboarding: {
          status: "completed",
          lastUpdated: Date.now(),
        },
      } as any);
    }

    return habitId;
  },
});

export const updateHabit = mutation({
  args: {
    habitId: v.id("habits"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    scheduleDays: v.optional(v.array(v.string())),
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
    reminderTime: v.optional(v.string()),
    reminderPlan: v.optional(v.array(reminderPlanEntryValidator)),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const habit = await ctx.db.get(args.habitId);
    if (!habit) throw new Error("Habit not found");

    const hasAccess = await hasProjectAccess(ctx, habit.projectId);
    if (!hasAccess) throw new Error("Access denied");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.scheduleDays !== undefined) patch.scheduleDays = args.scheduleDays;
    if (args.targetValue !== undefined) patch.targetValue = args.targetValue;
    if (args.unit !== undefined) patch.unit = args.unit;
    if (args.frequency !== undefined) patch.frequency = args.frequency;
    if (args.reminderTime !== undefined) patch.reminderTime = args.reminderTime;
    if (args.reminderPlan !== undefined) {
      const normalizedPlan = normalizeReminderPlanForStorage(args.reminderPlan);
      patch.reminderPlan = normalizedPlan.length > 0 ? normalizedPlan : undefined;
    } else if (args.description !== undefined) {
      const currentPlan = normalizeReminderPlanForStorage((habit as any).reminderPlan);
      if (currentPlan.length === 0) {
        const today = await getProjectDate(ctx, habit.projectId);
        const derivedPlan = deriveReminderPlanFromDescription({
          description: args.description,
          startDate: today,
          maxDay: 30,
        });
        if (derivedPlan.length > 0) {
          patch.reminderPlan = derivedPlan;
        }
      }
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.habitId, patch as any);
    }

    if (
      args.reminderTime !== undefined ||
      args.reminderPlan !== undefined ||
      args.scheduleDays !== undefined ||
      args.isActive !== undefined ||
      patch.reminderPlan !== undefined
    ) {
      try {
        await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
          habitId: args.habitId,
        });
      } catch (error) {
        console.error("Failed to reschedule habit reminder:", error);
      }
    }

    return { success: true };
  },
});

export const updateHabitInternal = internalMutation({
  args: {
    habitId: v.id("habits"),
    actorUserId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    scheduleDays: v.optional(v.array(v.string())),
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
    reminderTime: v.optional(v.string()),
    reminderPlan: v.optional(v.array(reminderPlanEntryValidator)),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit) throw new Error("Habit not found");

    const access = await getProjectAccessForUser(ctx, habit.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.scheduleDays !== undefined) patch.scheduleDays = args.scheduleDays;
    if (args.targetValue !== undefined) patch.targetValue = args.targetValue;
    if (args.unit !== undefined) patch.unit = args.unit;
    if (args.frequency !== undefined) patch.frequency = args.frequency;
    if (args.reminderTime !== undefined) patch.reminderTime = args.reminderTime;
    if (args.reminderPlan !== undefined) {
      const normalizedPlan = normalizeReminderPlanForStorage(args.reminderPlan);
      patch.reminderPlan = normalizedPlan.length > 0 ? normalizedPlan : undefined;
    } else if (args.description !== undefined) {
      const currentPlan = normalizeReminderPlanForStorage((habit as any).reminderPlan);
      if (currentPlan.length === 0) {
        const today = await getProjectDate(ctx, habit.projectId);
        const derivedPlan = deriveReminderPlanFromDescription({
          description: args.description,
          startDate: today,
          maxDay: 30,
        });
        if (derivedPlan.length > 0) {
          patch.reminderPlan = derivedPlan;
        }
      }
    }
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.habitId, patch as any);
    }

    if (
      args.reminderTime !== undefined ||
      args.reminderPlan !== undefined ||
      args.scheduleDays !== undefined ||
      args.isActive !== undefined ||
      patch.reminderPlan !== undefined
    ) {
      try {
        await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
          habitId: args.habitId,
        });
      } catch (error) {
        console.error("Failed to reschedule habit reminder:", error);
      }
    }

    return { success: true };
  },
});

export const getHabitByIdInternal = internalQuery({
  args: { habitId: v.id("habits") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.habitId);
  },
});

export const deleteHabit = mutation({
  args: {
    habitId: v.id("habits"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const habit = await ctx.db.get(args.habitId);
    if (!habit) throw new Error("Habit not found");

    const hasAccess = await hasProjectAccess(ctx, habit.projectId);
    if (!hasAccess) throw new Error("Access denied");

    try {
      await ctx.runMutation(internalAny.messaging.reminders.unscheduleHabitReminder, {
        habitId: args.habitId,
      });
    } catch (error) {
      console.error("Failed to unschedule habit reminder before delete:", error);
    }

    await ctx.db.delete(args.habitId);

    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_and_date", (q) => q.eq("habitId", args.habitId))
      .collect();

    for (const completion of completions) {
      await ctx.db.delete(completion._id);
    }

    return { success: true };
  },
});

export const deleteHabitInternal = internalMutation({
  args: {
    habitId: v.id("habits"),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit) throw new Error("Habit not found");

    const access = await getProjectAccessForUser(ctx, habit.projectId, args.actorUserId);
    if (!access) throw new Error("Permission denied.");

    try {
      await ctx.runMutation(internalAny.messaging.reminders.unscheduleHabitReminder, {
        habitId: args.habitId,
      });
    } catch (error) {
      console.error("Failed to unschedule habit reminder before internal delete:", error);
    }

    await ctx.db.delete(args.habitId);

    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_and_date", (q) => q.eq("habitId", args.habitId))
      .collect();

    for (const completion of completions) {
      await ctx.db.delete(completion._id);
    }

    return { success: true };
  },
});

export const seedHealthAssistantDefaults = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) throw new Error("Access denied");

    // Idempotent: create only if missing (by name)
    const existing = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const existingNames = new Set(existing.map((h: any) => (h.name || "").toLowerCase().trim()));

    const defaults: Array<{ name: string; description: string; frequency?: "daily" | "weekly"; targetValue?: number; unit?: string; source: any; }> = [
      {
        name: "Workout",
        description: "Complete your planned workout session.",
        frequency: "weekly",
        targetValue: 3,
        unit: "sessions",
        source: "assistant",
      },
      {
        name: "Steps",
        description: "Get your daily steps in.",
        frequency: "daily",
        targetValue: 8000,
        unit: "steps",
        source: "assistant",
      },
      {
        name: "Sleep",
        description: "Aim for consistent sleep.",
        frequency: "daily",
        targetValue: 7.5,
        unit: "hours",
        source: "assistant",
      },
      {
        name: "Protein",
        description: "Hit your protein target (roughly).",
        frequency: "daily",
        targetValue: 120,
        unit: "g",
        source: "assistant",
      },
      {
        name: "Water",
        description: "Drink enough water.",
        frequency: "daily",
        targetValue: 2.5,
        unit: "L",
        source: "assistant",
      },
    ];

    const created: string[] = [];

    for (const h of defaults) {
      const key = h.name.toLowerCase().trim();
      if (existingNames.has(key)) continue;

      const habitId = await ctx.db.insert("habits", {
        name: h.name,
        description: h.description,
        projectId: args.projectId,
        teamId: project.teamId,
        createdBy: identity.subject,
        targetValue: h.targetValue,
        unit: h.unit,
        frequency: h.frequency ?? "daily",
        isActive: true,
        source: h.source,
      } as any);

      created.push(habitId);
      existingNames.add(key);
    }

    return { createdCount: created.length };
  },
});

export const seedHealthAssistantDefaultsInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForUser(ctx, args.projectId, args.actorUserId);
    if (!access) throw new Error("Access denied");

    const existing = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const existingNames = new Set(existing.map((h: any) => (h.name || "").toLowerCase().trim()));

    const defaults: Array<{ name: string; description: string; frequency?: "daily" | "weekly"; targetValue?: number; unit?: string; source: any; }> = [
      {
        name: "Workout",
        description: "Complete your planned workout session.",
        frequency: "weekly",
        targetValue: 3,
        unit: "sessions",
        source: "assistant",
      },
      {
        name: "Steps",
        description: "Get your daily steps in.",
        frequency: "daily",
        targetValue: 8000,
        unit: "steps",
        source: "assistant",
      },
      {
        name: "Sleep",
        description: "Aim for consistent sleep.",
        frequency: "daily",
        targetValue: 7.5,
        unit: "hours",
        source: "assistant",
      },
      {
        name: "Protein",
        description: "Hit your protein target (roughly).",
        frequency: "daily",
        targetValue: 120,
        unit: "g",
        source: "assistant",
      },
      {
        name: "Water",
        description: "Drink enough water.",
        frequency: "daily",
        targetValue: 2.5,
        unit: "L",
        source: "assistant",
      },
    ];

    const created: string[] = [];

    for (const h of defaults) {
      const key = h.name.toLowerCase().trim();
      if (existingNames.has(key)) continue;

      const habitId = await ctx.db.insert("habits", {
        name: h.name,
        description: h.description,
        projectId: args.projectId,
        teamId: access.project.teamId,
        createdBy: args.actorUserId,
        targetValue: h.targetValue,
        unit: h.unit,
        frequency: h.frequency ?? "daily",
        isActive: true,
        source: h.source,
      } as any);

      created.push(habitId);
      existingNames.add(key);
    }

    return { createdCount: created.length };
  },
});

const shiftDate = (dateStr: string, deltaDays: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

const startOfWeekMonday = (dateStr: string): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday, 1 = Monday
  const offset = (dow + 6) % 7; // Monday -> 0, Sunday -> 6
  return shiftDate(dateStr, -offset);
};

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const dateToDowKey = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return DOW_KEYS[d.getUTCDay()];
};

const isScheduledForDate = (habit: any, dateStr: string) => {
  if (!habit?.isActive) return false;
  const reminderPlan = normalizeReminderPlanForStorage(habit?.reminderPlan);
  if (reminderPlan.length > 0) {
    const hasPlanEntry = !!getReminderPlanEntryForDate(reminderPlan, dateStr);
    if (hasPlanEntry) return true;
    if (habit.reminderTime) {
      return !!resolveReminderForDate({
        date: dateStr,
        reminderTime: habit.reminderTime,
        scheduleDays: habit.scheduleDays,
        reminderPlan,
      });
    }
    return false;
  }
  const schedule = habit.scheduleDays;
  if (!schedule || schedule.length === 0) return true;
  return schedule.includes(dateToDowKey(dateStr));
};

const formatDateInTimezone = (timestamp: number, timezone?: string): string => {
  if (timezone) {
    try {
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      };
      const parts = new Intl.DateTimeFormat("en-CA", dateOptions).formatToParts(
        new Date(timestamp)
      );
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;

      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.warn(`Invalid timezone: ${timezone}, falling back to UTC/Server time`);
    }
  }

  return new Date(timestamp).toISOString().slice(0, 10);
};

export const getHabitsWeek = query({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) {
      return { dates: [], habits: [], completionsByHabitId: {} as Record<string, string[]> };
    }

    const today = await getProjectDate(ctx, args.projectId);
    const n = Math.max(1, Math.min(args.days ?? 7, 14));
    const start = n === 7 ? startOfWeekMonday(today) : shiftDate(today, -(n - 1));

    const dates: string[] = [];
    for (let i = 0; i < n; i++) {
      dates.push(shiftDate(start, i));
    }

    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (habits.length === 0) {
      return { dates, habits: [], completionsByHabitId: {} as Record<string, string[]> };
    }

    const completionsByHabitId: Record<string, Set<string>> = {};
    const valuesByHabitId: Record<string, Record<string, number>> = {};
    for (const h of habits as any[]) {
      completionsByHabitId[h._id] = new Set();
    }

    const allCompletionsInRange = await ctx.db
      .query("habitCompletions")
      .withIndex("by_project_and_date", (q) =>
        q.eq("projectId", args.projectId).gte("date", dates[0]).lte("date", dates[dates.length - 1])
      )
      .collect();

    for (const completion of allCompletionsInRange as any[]) {
      if (!completionsByHabitId[completion.habitId]) {
        completionsByHabitId[completion.habitId] = new Set();
      }
      completionsByHabitId[completion.habitId].add(completion.date);
      if (completion.value !== undefined) {
        if (!valuesByHabitId[completion.habitId]) valuesByHabitId[completion.habitId] = {};
        valuesByHabitId[completion.habitId][completion.date] = completion.value;
      }
    }

    const completionsOut: Record<string, string[]> = {};
    for (const [habitId, set] of Object.entries(completionsByHabitId)) {
      completionsOut[habitId] = Array.from(set.values()).sort();
    }

    const completedSetToday = new Set(
      allCompletionsInRange
        .filter((completion: any) => completion.date === today)
        .map((completion: any) => completion.habitId)
    );

    return {
      dates,
      today,
      habits: (habits as any[]).map((habit) => ({
        ...habit,
        name: habit.name || habit.title || "Habit",
        reminderPlan: normalizeReminderPlanForStorage(habit.reminderPlan),
        completedToday: completedSetToday.has(habit._id),
        today,
      })),
      completionsByHabitId: completionsOut,
      valuesByHabitId,
    };
  },
});

export const getHabitsEffectivenessTimeline = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) {
      return {
        startDate: "",
        today: "",
        weeks: [],
        overall: { scheduled: 0, completed: 0, percent: 0 },
      };
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return {
        startDate: "",
        today: "",
        weeks: [],
        overall: { scheduled: 0, completed: 0, percent: 0 },
      };
    }

    const team = await ctx.db.get(project.teamId);
    const timezone = team?.timezone;
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const activeHabits = (habits as any[]).filter((habit) => habit.isActive);
    if (activeHabits.length === 0) {
      const today = await getProjectDate(ctx, args.projectId);
      const startDate = formatDateInTimezone(project._creationTime ?? Date.now(), timezone);
      const normalizedStart = startDate > today ? today : startDate;
      return {
        startDate: normalizedStart,
        today,
        weeks: [],
        overall: { scheduled: 0, completed: 0, percent: 0 },
      };
    }

    const today = await getProjectDate(ctx, args.projectId);
    const habitStartDates = new Map<string, string>();
    let earliestStart = formatDateInTimezone(project._creationTime ?? Date.now(), timezone);

    for (const habit of activeHabits) {
      const habitStart = formatDateInTimezone(
        habit._creationTime ?? project._creationTime ?? Date.now(),
        timezone
      );
      habitStartDates.set(habit._id, habitStart);
      if (habitStart < earliestStart) earliestStart = habitStart;
    }

    const normalizedStart = earliestStart > today ? today : earliestStart;
    const timelineStart = startOfWeekMonday(normalizedStart);
    const dates: string[] = [];
    for (let cursor = timelineStart; cursor <= today; cursor = shiftDate(cursor, 1)) {
      dates.push(cursor);
    }

    const activeHabitIds = new Set(activeHabits.map((habit) => habit._id));
    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_project_and_date", (q) =>
        q.eq("projectId", args.projectId).gte("date", timelineStart).lte("date", today)
      )
      .collect();

    const completionsByDate: Record<string, Set<string>> = {};
    for (const completion of completions as any[]) {
      if (!activeHabitIds.has(completion.habitId)) continue;
      if (!completionsByDate[completion.date]) {
        completionsByDate[completion.date] = new Set();
      }
      completionsByDate[completion.date].add(completion.habitId);
    }

    let overallScheduled = 0;
    let overallCompleted = 0;
    const days: {
      date: string;
      scheduled: number;
      completed: number;
      percent: number;
    }[] = [];

    for (const dateStr of dates) {
      let scheduled = 0;
      for (const habit of activeHabits) {
        const habitStart = habitStartDates.get(habit._id);
        if (habitStart && dateStr < habitStart) continue;
        if (isScheduledForDate(habit, dateStr)) scheduled += 1;
      }

      const completed = completionsByDate[dateStr]?.size ?? 0;
      overallScheduled += scheduled;
      overallCompleted += completed;
      const percent = scheduled ? Math.round((completed / scheduled) * 100) : 0;
      days.push({ date: dateStr, scheduled, completed, percent });
    }

    const overallPercent = overallScheduled
      ? Math.round((overallCompleted / overallScheduled) * 100)
      : 0;

    return {
      startDate: normalizedStart,
      today,
      days,
      overall: {
        scheduled: overallScheduled,
        completed: overallCompleted,
        percent: overallPercent,
      },
    };
  },
});
