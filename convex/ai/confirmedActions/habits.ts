/**
 * Confirmed Actions - Habits
 *
 * Habit CRUD operations that require user confirmation from AI suggestions.
 */

import { action } from "../../_generated/server";
import { v } from "convex/values";
import { ensureProjectAccess } from "./helpers";
const apiAny = require("../../_generated/api").api as any;

export const createConfirmedHabit = action({
  args: {
    projectId: v.id("projects"),
    habitData: v.object({
      name: v.string(),
      description: v.optional(v.string()),
      targetValue: v.optional(v.number()),
      unit: v.optional(v.string()),
      frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
      scheduleDays: v.optional(v.array(v.string())),
      reminderTime: v.optional(v.string()),
      source: v.optional(v.union(v.literal("user"), v.literal("assistant"), v.literal("gymbro_onboarding"))),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    habitId: v.optional(v.id("habits")),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; habitId?: any; message: string }> => {
    try {
      const { project } = await ensureProjectAccess(ctx, args.projectId, true);
      const habitId: any = await ctx.runMutation(apiAny.habits.createHabit, {
        projectId: args.projectId,
        name: args.habitData.name,
        description: args.habitData.description,
        targetValue: args.habitData.targetValue,
        unit: args.habitData.unit,
        frequency: args.habitData.frequency,
        scheduleDays: args.habitData.scheduleDays,
        reminderTime: args.habitData.reminderTime,
        source: args.habitData.source ?? "assistant",
      });

      return {
        success: true,
        habitId,
        message: `Habit created successfully for ${project.name}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create habit: ${error}`,
      };
    }
  },
});
