"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { shouldSendNow } from "./reminderUtils";
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
    if (!habit) {
      console.log("[HABIT REMINDER] Habit not found", { habitId: args.habitId });
      return { skipped: true, reason: "habit_not_found" };
    }
    if (!habit.isActive || !habit.reminderTime) {
      console.log("[HABIT REMINDER] Inactive or missing reminder", {
        habitId: habit._id,
        isActive: habit.isActive,
        reminderTime: habit.reminderTime,
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

    if (!shouldSendNow({ timeZone, reminderTime: habit.reminderTime, scheduleDays: habit.scheduleDays })) {
      console.log("[HABIT REMINDER] Not scheduled now", {
        habitId: habit._id,
        reminderTime: habit.reminderTime,
        scheduleDays: habit.scheduleDays,
        timeZone,
      });
      await ctx.runMutation(internalAny.messaging.reminders.scheduleHabitReminder, {
        habitId: args.habitId,
      });
      return { skipped: true, reason: "not_scheduled_now" };
    }

    const { currentDate } = getCurrentDateTime(timeZone);
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
    const text = details
      ? `⏰ Przypomnienie: ${habitName}\n\n${details}`
      : `⏰ Przypomnienie: ${habitName}`;

    console.log("[HABIT REMINDER] Sending Telegram message", {
      habitId: habit._id,
      projectId: habit.projectId,
      reminderTime: habit.reminderTime,
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
