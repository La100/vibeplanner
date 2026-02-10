"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { normalizeReminderPlan, resolveReminderForDate, shouldSendNow } from "./reminderUtils";
import { getCurrentDateTime } from "../ai/helpers/contextBuilder";

const internalAny = require("../_generated/api").internal as any;

export const sendHabitReminder = internalAction({
  args: {
    habitId: v.id("habits"),
  },
  handler: async (ctx, args) => {
    const habit = await ctx.runQuery(internalAny.habits.getHabitByIdInternal, {
      habitId: args.habitId,
    });
    const reminderPlan = normalizeReminderPlan((habit as any)?.reminderPlan);
    if (!habit) {
      console.log("[HABIT REMINDER] Habit not found", { habitId: args.habitId });
      return { skipped: true, reason: "habit_not_found" };
    }
    if (!habit.isActive || (!habit.reminderTime && reminderPlan.length === 0)) {
      console.log("[HABIT REMINDER] Inactive or missing reminder", {
        habitId: habit._id,
        isActive: habit.isActive,
        reminderTime: habit.reminderTime,
        reminderPlan,
      });
      return { skipped: true, reason: "inactive_or_missing_time" };
    }

    const project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, {
      projectId: habit.projectId,
    });
    if (!project) {
      console.log("[HABIT REMINDER] Project not found; skipping", {
        habitId: habit._id,
        projectId: habit.projectId,
      });
      return { skipped: true, reason: "project_not_found" };
    }
    const team = project ? await ctx.runQuery(internalAny.teams.getTeamById, { teamId: project.teamId }) : null;
    const timeZone = team?.timezone;
    const { currentDate } = getCurrentDateTime(timeZone);
    const effectiveTodayReminder = resolveReminderForDate({
      date: currentDate,
      reminderTime: habit.reminderTime,
      scheduleDays: habit.scheduleDays,
      reminderPlan,
    });
    if (!effectiveTodayReminder) {
      console.log("[HABIT REMINDER] No reminder config for today's date", {
        habitId: habit._id,
        date: currentDate,
        reminderTime: habit.reminderTime,
        reminderPlan,
      });
      await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
        habitId: args.habitId,
      });
      return { skipped: true, reason: "no_today_config" };
    }

    if (!shouldSendNow({
      timeZone,
      reminderTime: habit.reminderTime,
      scheduleDays: habit.scheduleDays,
      reminderPlan,
    })) {
      console.log("[HABIT REMINDER] Not scheduled now", {
        habitId: habit._id,
        reminderTime: effectiveTodayReminder.reminderTime,
        source: effectiveTodayReminder.source,
        phaseLabel: effectiveTodayReminder.planEntry?.phaseLabel,
        scheduleDays: habit.scheduleDays,
        reminderPlan,
        timeZone,
      });
      await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
        habitId: args.habitId,
      });
      return { skipped: true, reason: "not_scheduled_now" };
    }

    const completion = await ctx.runQuery(internalAny.habits.getHabitCompletionForDateInternal, {
      habitId: args.habitId,
      date: currentDate,
    });
    if (completion?.completed) {
      console.log("[HABIT REMINDER] Already completed for date", {
        habitId: habit._id,
        date: currentDate,
      });
      await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
        habitId: args.habitId,
      });
      return { skipped: true, reason: "already_completed" };
    }

    let channel = await ctx.runQuery(internalAny.messaging.channels.getActiveTelegramChannelForUser, {
      projectId: habit.projectId,
      userClerkId: habit.createdBy,
    });

    if (!channel) {
      const channels = await ctx.runQuery(internalAny.messaging.channels.listChannelsForProject, {
        projectId: habit.projectId,
      });
      const activeTelegram = channels.filter((c: any) => c.platform === "telegram" && c.isActive);
      if (activeTelegram.length === 1) {
        channel = activeTelegram[0];
      }
    }

    if (!channel) {
      console.log("[HABIT REMINDER] No active Telegram channel", {
        habitId: habit._id,
        projectId: habit.projectId,
      });
      await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
        habitId: args.habitId,
      });
      return { skipped: true, reason: "no_channel" };
    }

    const habitName = habit.name || habit.title || "Habit";
    const rawDetails = typeof habit.description === "string" ? habit.description.trim() : "";
    const maxDetailsLength = 800;
    const details = rawDetails.length > maxDetailsLength
      ? `${rawDetails.slice(0, maxDetailsLength - 1)}…`
      : rawDetails;
    const phaseLine = effectiveTodayReminder.planEntry?.phaseLabel
      ? `\nFaza: ${effectiveTodayReminder.planEntry.phaseLabel}`
      : "";
    const windowStartLine = effectiveTodayReminder.planEntry?.minStartTime
      ? `\nDziś okno od: ${effectiveTodayReminder.planEntry.minStartTime}`
      : "";
    const text = details
      ? `⏰ Przypomnienie: ${habitName}${phaseLine}${windowStartLine}\n\n${details}`
      : `⏰ Przypomnienie: ${habitName}${phaseLine}${windowStartLine}`;

    console.log("[HABIT REMINDER] Sending Telegram message", {
      habitId: habit._id,
      projectId: habit.projectId,
      reminderTime: effectiveTodayReminder.reminderTime,
      source: effectiveTodayReminder.source,
      phaseLabel: effectiveTodayReminder.planEntry?.phaseLabel,
      timeZone,
    });
    await ctx.runAction(internalAny.messaging.telegramActions.sendTelegramMessage, {
      projectId: habit.projectId,
      chatId: channel.externalUserId,
      text,
    });

    await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
      habitId: args.habitId,
    });

    return { success: true };
  },
});
