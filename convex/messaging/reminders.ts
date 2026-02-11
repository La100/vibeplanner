import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const internalAny = require("../_generated/api").internal as any;
import { getNextReminderSchedule, normalizeReminderPlan } from "./reminderUtils";

const clearReminderScheduleState = async (ctx: any, habitId: Id<"habits">) => {
  await ctx.db.patch(habitId, {
    scheduledReminderId: undefined,
    nextReminderAt: undefined,
  } as any);
};

const cancelExistingHabitReminderIfAny = async (
  ctx: any,
  habit: any,
  habitId: Id<"habits">
) => {
  const scheduledReminderId = (habit as any).scheduledReminderId as string | undefined;
  if (!scheduledReminderId) return false;

  try {
    await ctx.scheduler.cancel(scheduledReminderId as any);
  } catch (error) {
    // Scheduler jobs can already be running/completed when we attempt to cancel.
    console.warn("[HABIT REMINDER] Failed to cancel scheduled job", {
      habitId,
      scheduledReminderId,
      error: String(error),
    });
  }

  return true;
};

export const scheduleTelegramReminder = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    message: v.string(),
    delayMinutes: v.optional(v.number()),
    runAt: v.optional(v.number()), // ms since epoch
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", args.actorUserId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    const delayMs = args.runAt ? Math.max(args.runAt - now, 0) : Math.max((args.delayMinutes ?? 0) * 60 * 1000, 0);

    let channel = await ctx.db
      .query("messagingChannels")
      .withIndex("by_user", (q) => q.eq("userClerkId", args.actorUserId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .filter((q) => q.eq(q.field("platform"), "telegram"))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!channel) {
      const channels = await ctx.db
        .query("messagingChannels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .filter((q) => q.eq(q.field("platform"), "telegram"))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      if (channels.length === 1) {
        channel = channels[0];
      }
    }

    if (!channel) {
      throw new Error("No active Telegram channel connected for this user.");
    }

    const text = args.message.trim();
    const finalText = text.startsWith("⏰") ? text : `⏰ ${text}`;

    await ctx.scheduler.runAfter(delayMs, internalAny.messaging.telegramActions.sendTelegramMessage, {
      projectId: args.projectId as Id<"projects">,
      chatId: channel.externalUserId,
      text: finalText,
    });

    return {
      success: true,
      scheduledFor: now + delayMs,
      chatId: channel.externalUserId,
    };
  },
});

export const scheduleHabitReminder = internalMutation({
  args: {
    habitId: v.id("habits"),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit) {
      throw new Error("Habit not found");
    }
    const reminderPlan = normalizeReminderPlan((habit as any).reminderPlan);
    const hadScheduledJob = await cancelExistingHabitReminderIfAny(ctx, habit, args.habitId);

    if ((!habit.reminderTime && reminderPlan.length === 0) || !habit.isActive) {
      if (hadScheduledJob || (habit as any).nextReminderAt !== undefined) {
        await clearReminderScheduleState(ctx, args.habitId);
      }
      return { scheduled: false };
    }

    const project = await ctx.db.get(habit.projectId);
    if (!project) {
      console.log("[HABIT REMINDER] Project not found; skipping scheduling", {
        habitId: args.habitId,
        projectId: habit.projectId,
      });
      if (hadScheduledJob || (habit as any).nextReminderAt !== undefined) {
        await clearReminderScheduleState(ctx, args.habitId);
      }
      return { scheduled: false };
    }
    const team = project ? await ctx.db.get(project.teamId) : null;
    const timeZone = team?.timezone;

    const nextSchedule = getNextReminderSchedule({
      timeZone,
      reminderTime: habit.reminderTime,
      scheduleDays: habit.scheduleDays,
      reminderPlan,
    });

    if (!nextSchedule) {
      console.log("[HABIT REMINDER] No next timestamp", {
        habitId: args.habitId,
        reminderTime: habit.reminderTime,
        scheduleDays: habit.scheduleDays,
        reminderPlan,
        timeZone,
      });
      if (hadScheduledJob || (habit as any).nextReminderAt !== undefined) {
        await clearReminderScheduleState(ctx, args.habitId);
      }
      return { scheduled: false };
    }

    const delayMs = Math.max(nextSchedule.timestamp - Date.now(), 0);
    console.log("[HABIT REMINDER] Scheduling", {
      habitId: args.habitId,
      reminderTime: nextSchedule.reminderTime,
      source: nextSchedule.source,
      date: nextSchedule.date,
      phaseLabel: nextSchedule.planEntry?.phaseLabel,
      scheduleDays: habit.scheduleDays,
      timeZone,
      scheduledFor: nextSchedule.timestamp,
      delayMs,
    });
    const scheduledReminderId = await ctx.scheduler.runAfter(delayMs, internalAny.messaging.remindersActions.sendHabitReminder, {
      habitId: args.habitId,
      expectedReminderAt: nextSchedule.timestamp,
    });
    await ctx.db.patch(args.habitId, {
      scheduledReminderId,
      nextReminderAt: nextSchedule.timestamp,
    } as any);

    return {
      scheduled: true,
      scheduledFor: nextSchedule.timestamp,
      source: nextSchedule.source,
      date: nextSchedule.date,
      scheduledReminderId,
    };
  },
});

export const unscheduleHabitReminder = internalMutation({
  args: {
    habitId: v.id("habits"),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.db.get(args.habitId);
    if (!habit) {
      return { unscheduled: false, reason: "habit_not_found" };
    }

    const hadScheduledJob = await cancelExistingHabitReminderIfAny(ctx, habit, args.habitId);
    if (hadScheduledJob || (habit as any).nextReminderAt !== undefined) {
      await clearReminderScheduleState(ctx, args.habitId);
    }

    return { unscheduled: hadScheduledJob };
  },
});
