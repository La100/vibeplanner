/**
 * VibePlanner AI Tools - Shared tool definitions
 *
 * This file is the SINGLE SOURCE OF TRUTH for all AI tools.
 * It exports:
 * 1. Tool schemas (Zod) - used by both streaming and agent implementations
 * 2. createStreamingTools() - for AI SDK streamText
 * 3. createAgentTools() - for Convex Agent
 *
 * Tools return JSON structures for confirmation UI, not direct actions.
 */

import { z } from "zod";
import type { Id } from "../_generated/dataModel";
import type { ProjectContextSnapshot } from "./types";

// RunAction type matches ctx.runAction signature
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunActionFn = (action: any, args: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunMutationFn = (mutation: any, args: any) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunQueryFn = (query: any, args: any) => Promise<any>;

// Search result types (matches what internal.ai.search returns)
interface TaskSearchResult {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedToName?: string;
  startDate?: string;
  endDate?: string;
}

// ============================================
// TOOL SCHEMAS - OPTIMIZED VERSION
// ============================================

// Item type enum
const itemTypeEnum = z.enum(["task", "habit"]);

type ItemType = z.infer<typeof itemTypeEnum>;

// Field definitions for each type
const taskFields = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional().describe("Task description"),
  content: z.string().optional().describe("Rich text content"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Task priority"),
  status: z.enum(["todo", "in_progress", "done"]).optional().describe("Task status"),
  assignedTo: z.string().optional().describe("Clerk ID of the team member (format: user_xxxxx)"),
  assignedToName: z.string().optional().describe("Display name of the assigned team member"),
  startDate: z.string().optional().describe("Start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"),
  endDate: z.string().optional().describe("End date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)"),
  link: z.string().optional().describe("Optional link to workout video or resource"),
});

const weekdayEnum = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
const reminderPlanEntrySchema = z.object({
  date: z.string().describe("Calendar date in YYYY-MM-DD format (project timezone day)."),
  reminderTime: z.string().describe("Reminder time in local HH:mm format for this date."),
  minStartTime: z.string().optional().describe("Optional 'not earlier than' time in HH:mm for this date."),
  phaseLabel: z.string().optional().describe("Optional phase label, e.g. D1-2."),
});

const habitFields = z.object({
  name: z.string().describe("Habit name"),
  description: z.string().optional().describe("Habit description"),
  targetValue: z.number().optional().describe("Numeric target value"),
  unit: z.string().optional().describe("Unit for target value (e.g., kcal, min)"),
  frequency: z.enum(["daily", "weekly"]).optional().describe("Habit frequency"),
  scheduleDays: z.array(weekdayEnum).optional().describe("Days of week for this habit, e.g. ['mon', 'wed', 'fri']"),
  reminderTime: z.string().optional().describe("Reminder time in local HH:mm format"),
  reminderPlan: z
    .array(reminderPlanEntrySchema)
    .optional()
    .describe("Optional per-date reminder plan for phased schedules (e.g., D1-2 15:00, D3-4 17:00)."),
  source: z.enum(["user", "assistant", "gymbro_onboarding"]).optional().describe("Creation source"),
});

// Generic create schema
export const createItemSchema = z.object({
  type: z.literal("task").describe("Type of item to create"),
  data: taskFields.describe("Task data"),
});

export const createHabitSchema = z.object({
  data: habitFields.describe("Habit data"),
});

export const createMultipleHabitsSchema = z.object({
  habits: z.array(habitFields).describe("Array of habits to create"),
});

export const createMultipleItemsSchema = z.object({
  type: itemTypeEnum.describe("Type of items to create"),
  items: z.array(z.union([taskFields, habitFields])).describe("Array of items to create"),
});

export const setHabitCompletionSchema = z.object({
  habitId: z.string().optional().describe("Habit ID to update"),
  habitName: z.string().optional().describe("Habit name if ID is unknown"),
  date: z.string().optional().describe("Date in YYYY-MM-DD format (project-local). Defaults to today."),
  completed: z.boolean().optional().describe("Set true to mark done, false to mark not done. Omit to toggle."),
  value: z.number().optional().describe("Numeric value to log (e.g., 2100 for kcal, 120 for protein grams, 3 for liters water)"),
});

export const clearHabitRemindersSchema = z.object({
  scope: z.enum(["all", "matching"]).optional().describe("Use 'all' to clear reminders for every habit."),
  habitNames: z.array(z.string()).optional().describe("Habit names to clear reminders for (case-insensitive, partial match)."),
  habitIds: z.array(z.string()).optional().describe("Habit IDs to clear reminders for."),
});

export const setHabitReminderSchema = z.object({
  habitId: z.string().optional().describe("Habit ID to update"),
  habitName: z.string().optional().describe("Habit name if ID is unknown"),
  reminderTime: z.string().describe("Reminder time in local HH:mm format (e.g. 07:30). Use empty string to clear."),
});

// Generic update schema
export const updateItemSchema = z.object({
  type: itemTypeEnum.describe("Type of item to update"),
  itemId: z.string().describe("ID of the item to update"),
  data: z.union([taskFields.partial(), habitFields.partial()]).describe("Fields to update"),
});

export const updateMultipleItemsSchema = z.object({
  type: itemTypeEnum.describe("Type of items to update"),
  updates: z.array(z.object({
    itemId: z.string(),
    data: z.union([taskFields.partial(), habitFields.partial()]),
  })).describe("Array of items to update with their IDs"),
});

// Generic delete schema
export const deleteItemSchema = z.object({
  type: itemTypeEnum.describe("Type of item to delete"),
  itemId: z.string().describe("ID of the item to delete"),
  name: z.string().optional().describe("Item name for display purposes"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Generic search schema
export const searchItemsSchema = z.object({
  type: z.enum(["task"]).describe("Type of items to search"),
  query: z.string().optional().describe("Search query"),
  filters: z.object({
    status: z.enum(["todo", "in_progress", "done"]).optional().describe("Filter by status"),
    assignedTo: z.string().optional().describe("Filter by assignee Clerk ID"),
    startDateFrom: z.number().optional().describe("Start of date range (ms since epoch, UTC)"),
    startDateTo: z.number().optional().describe("End of date range (ms since epoch, UTC)"),
    endDateFrom: z.number().optional().describe("Start of end-date range (ms since epoch, UTC)"),
    endDateTo: z.number().optional().describe("End of end-date range (ms since epoch, UTC)"),
  }).optional().describe("Type-specific filters"),
  limit: z.number().optional().default(10).describe("Maximum number of results"),
});

// Keep specific schemas for backward compatibility and specific use cases
export const loadFullProjectContextSchema = z.object({
  reason: z.string().optional().describe("Why you need the full context"),
});

export const webSearchSchema = z.object({
  query: z.string().describe("Web search query"),
  searchContextSize: z.enum(["low", "medium", "high"]).optional().describe("How much context to use for search"),
  location: z.object({
    city: z.string().optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
  }).optional().describe("Approximate user location for localized results"),
});

const rememberSchema = z.object({
  items: z
    .array(z.string())
    .min(1)
    .describe("Short, stable facts/preferences/priorities to remember long-term (1 sentence each)"),
});

const telegramConfigSchema = z.object({
  botToken: z.string().describe("Telegram bot token from @BotFather"),
  botUsername: z
    .string()
    .optional()
    .describe("Telegram bot username without @ (optional but recommended)"),
});

const telegramReminderSchema = z.object({
  message: z.string().describe("Reminder message to send on Telegram"),
  delayMinutes: z.number().optional().describe("Minutes from now to send the reminder"),
  runAt: z.number().optional().describe("Absolute time (ms since epoch) to send the reminder"),
});

const getDayOverviewSchema = z.object({
  date: z.string().describe("Date in YYYY-MM-DD format. Use this to check what tasks, habits, and diary entries are on a specific day."),
});

const addDiaryEntrySchema = z.object({
  content: z.string().describe("The diary entry text. Prefer the user's exact words; do not embellish, paraphrase heavily, or invent details."),
  date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
  mood: z.enum(["great", "good", "neutral", "bad", "terrible"]).optional()
    .describe("Optional mood for the day, inferred from user's message."),
});

const approvePairingCodeSchema = z.object({
  pairingCode: z.string().describe("8-character pairing code from Telegram"),
});

const saveUserProfileSchema = z.object({
  preferredName: z.string().optional().describe("How the assistant should address the user (name/nickname)."),
  preferredLanguage: z.string().optional().describe("Preferred language for assistants (e.g. English, Polish, en, pl)."),
  age: z.number().int().min(0).max(125).nullable().optional().describe("User age as a number, or null if not provided."),
  gender: z.enum(["female", "male"]).optional().describe("User gender."),
  genderOther: z.string().optional().describe("If gender is 'other', the user-provided value."),
  workMode: z.enum(["office", "home", "hybrid", "other"]).optional().describe("Where the user works from most of the time."),
  workModeOther: z.string().optional().describe("If workMode is 'other', the user-provided value."),
  complete: z.boolean().optional().describe("Set true when the onboarding flow is finished."),
});

// ============================================
// AI SDK TOOLS (for streaming)
// ============================================

// Types for tool options
interface StreamingToolOptions {
  projectId?: string;
  actorUserId?: string;
  runAction?: RunActionFn;
  runMutation?: RunMutationFn;
  runQuery?: RunQueryFn;
  loadSnapshot?: () => Promise<ProjectContextSnapshot>;
}

/**
 * Helper function to map item types to their operation types for the response
 */
function getOperationType(type: ItemType): string {
  const typeMap: Record<ItemType, string> = {
    task: "task",
    habit: "habit",
  };
  return typeMap[type];
}

async function runOpenAIWebSearch(args: z.infer<typeof webSearchSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      error: "missing_openai_api_key",
      message: "OPENAI_API_KEY is not configured.",
    };
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });

  const toolLocation = args.location
    ? {
      type: "approximate" as const,
      city: args.location.city ?? null,
      region: args.location.region ?? null,
      country: args.location.country ?? null,
      timezone: args.location.timezone ?? null,
    }
    : null;

  const response = await openai.responses.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4o-mini",
    input: `Search the web for: ${args.query}\nReturn a concise answer for the user. Include citations when relevant.`,
    tools: [
      {
        type: "web_search_preview",
        search_context_size: args.searchContextSize ?? "medium",
        user_location: toolLocation,
      },
    ],
    tool_choice: { type: "web_search_preview" },
  });

  const outputText = response.output_text || "";
  const citations: Array<{ title: string; url: string }> = [];
  const outputItems = (response as unknown as { output?: Array<any> }).output;
  if (Array.isArray(outputItems)) {
    for (const item of outputItems) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content?.type === "output_text" && Array.isArray(content.annotations)) {
            for (const annotation of content.annotations) {
              if (annotation?.type === "url_citation") {
                citations.push({
                  title: annotation.title || annotation.url || "Source",
                  url: annotation.url || "",
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    query: args.query,
    answer: outputText.trim(),
    citations,
  };
}

/**
 * Create tools in AI SDK format for use with streamText
 * Using inputSchema (AI SDK v5) instead of parameters
 */
export function createStreamingTools(options?: StreamingToolOptions) {
  return {
    // User profile onboarding tool (shared across assistants)
    save_user_profile: {
      description: "Save basic user profile onboarding answers (preferred name, age, gender, work mode) so all assistants can personalize responses.",
      inputSchema: saveUserProfileSchema,
      execute: async (args: z.infer<typeof saveUserProfileSchema>) => {
        if (!options?.actorUserId || !options?.runMutation) {
          return JSON.stringify({ error: "User profile save not available - context missing" });
        }

        try {
          const internalAny = require("../_generated/api").internal as any;
          await options.runMutation(internalAny.users.saveUserOnboardingProfileInternal, {
            clerkUserId: options.actorUserId,
            preferredName: args.preferredName,
            preferredLanguage: args.preferredLanguage,
            age: args.age,
            gender: args.gender,
            genderOther: args.genderOther,
            workMode: args.workMode,
            workModeOther: args.workModeOther,
            complete: args.complete ?? false,
          });
          return JSON.stringify({ success: true });
        } catch (error) {
          console.error("Failed to save user profile:", error);
          return JSON.stringify({ error: "Failed to save user profile", details: (error as Error).message });
        }
      },
    },

    // Onboarding completion tool
    complete_onboarding: {
      description: "Complete onboarding after you have asked the key questions and presented the initial plan. This also seeds default health habits if missing.",
      inputSchema: z.object({
        skipTelegram: z
          .boolean()
          .optional()
          .describe(
            "Set true ONLY if the user explicitly refuses Telegram reminders twice. Otherwise, onboarding should not be completed until Telegram is connected."
          ),
      }),
      execute: async (args: { skipTelegram?: boolean }) => {
        if (!options?.projectId || !options?.runMutation) {
          return JSON.stringify({ error: "Onboarding completion not available - context missing" });
        }

        try {
          // Use require pattern to avoid type instantiation depth error with Convex generics
          const apiAny = require("../_generated/api").api as any;
          const internalAny = require("../_generated/api").internal as any;

          const shouldSkipTelegram = !!args?.skipTelegram;

          // Enforce Telegram setup before closing onboarding (unless explicitly skipped).
          // This prevents the UI from jumping to the dashboard immediately after the plan is approved.
          if (!shouldSkipTelegram) {
            if (!options.runQuery) {
              return JSON.stringify({
                error: "telegram_check_unavailable",
                message:
                  "Telegram setup is required before completing onboarding, but query context is unavailable. Please continue onboarding and connect Telegram, or retry later.",
              });
            }

            const project = await options.runQuery(apiAny.projects.getProject, {
              projectId: options.projectId as Id<"projects">,
            });

            const telegramConfigured = !!project?.telegramBotToken && !!project?.telegramBotUsername;

            let telegramConnectedForUser = false;
            if (options.actorUserId) {
              const channel = await options.runQuery(internalAny.messaging.channels.getActiveTelegramChannelForUser, {
                projectId: options.projectId as Id<"projects">,
                userClerkId: options.actorUserId,
              });
              telegramConnectedForUser = !!channel;
            }

            if (!telegramConfigured || !telegramConnectedForUser) {
              return JSON.stringify({
                error: "telegram_required",
                message:
                  "Before completing onboarding, connect Telegram (configure bot + approve pairing code). If the user refuses Telegram reminders twice, call complete_onboarding with skipTelegram=true.",
                telegram: {
                  configured: telegramConfigured,
                  connectedForCurrentUser: telegramConnectedForUser,
                  missing: {
                    botCredentials: !telegramConfigured,
                    pairing: telegramConfigured && !telegramConnectedForUser,
                  },
                },
              });
            }
          }

          // Habits are created by the AI during onboarding — seeding removed
          // to avoid duplicates with AI-created personalized habits.

          if (options.actorUserId) {
            await options.runMutation(internalAny.projects.completeOnboardingInternal, {
              projectId: options.projectId as Id<"projects">,
              actorUserId: options.actorUserId,
            });
          } else {
            await options.runMutation(apiAny.projects.completeOnboarding, {
              projectId: options.projectId as Id<"projects">,
            });
          }

          return JSON.stringify({ success: true, message: "Onboarding completed successfully." });
        } catch (error) {
          console.error("Failed to complete onboarding:", error);
          return JSON.stringify({ error: "Failed to complete onboarding", details: (error as Error).message });
        }
      }
    },

    // Generic CRUD operations
    create_item: {
      description: "Stage creation of a task (pending until /approve). Use when the user asks to create a task or when you propose tasks for approval.",
      inputSchema: createItemSchema,
      execute: async (args: z.infer<typeof createItemSchema>) => {
        // Validate that we have minimum required fields
        const data = args.data as Record<string, unknown>;
        const hasTitle = data.title && typeof data.title === 'string' && data.title.trim().length > 0;
        const hasName = data.name && typeof data.name === 'string' && data.name.trim().length > 0;

        // Require at least title or name
        if (!hasTitle && !hasName) {
          return JSON.stringify({
            error: "Cannot create item without title or name",
            message: "Please provide item details before creating"
          });
        }

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "create",
          data: args.data
        });
      },
    },

    create_habit: {
      description: "Stage creation of a habit (pending until /approve). Use for habit tracking and routines when approved or proposed.",
      inputSchema: createHabitSchema,
      execute: async (args: z.infer<typeof createHabitSchema>) => {
        const data = args.data as Record<string, unknown>;
        const hasName = data.name && typeof data.name === "string" && data.name.trim().length > 0;
        if (!hasName) {
          return JSON.stringify({
            error: "Cannot create habit without a name",
            message: "Please provide habit details before creating",
          });
        }

        return JSON.stringify({
          type: "habit",
          operation: "create",
          data: args.data,
        });
      },
    },

    set_habit_completion: {
      description: "Mark a habit as done/undone for a specific date. Use when the user says they completed or missed a habit.",
      inputSchema: setHabitCompletionSchema,
      execute: async (args: z.infer<typeof setHabitCompletionSchema>) => {
        let habitId = args.habitId?.trim();
        let habitName = args.habitName?.trim();

        if (!habitId && habitName && options?.loadSnapshot) {
          try {
            const snapshot = await options.loadSnapshot();
            const normalized = habitName.toLowerCase();
            const exactMatch = snapshot.habits.find(
              (habit) => habit.name?.toLowerCase() === normalized
            );
            const partialMatch = snapshot.habits.find((habit) =>
              habit.name?.toLowerCase().includes(normalized)
            );
            const resolved = exactMatch ?? partialMatch;
            if (resolved) {
              habitId = resolved._id;
              habitName = resolved.name;
            }
          } catch (error) {
            console.warn("Failed to resolve habit by name:", error);
          }
        }

        if (habitId && !habitName && options?.loadSnapshot) {
          try {
            const snapshot = await options.loadSnapshot();
            const resolved = snapshot.habits.find((habit) => habit._id === habitId);
            if (resolved) habitName = resolved.name;
          } catch (error) {
            console.warn("Failed to resolve habit name by id:", error);
          }
        }

        if (!habitId) {
          return JSON.stringify({
            error: "Habit not found",
            message: "Please specify a valid habit to update",
            data: { habitName: args.habitName },
          });
        }

        return JSON.stringify({
          type: "habit",
          operation: "complete",
          data: {
            habitId,
            name: habitName,
            date: args.date,
            completed: args.completed,
            value: args.value,
          },
        });
      },
    },

    clear_habit_reminders: {
      description: "Clear habit reminder times (turn off Telegram reminders). Use when the user asks to disable habit reminders.",
      inputSchema: clearHabitRemindersSchema,
      execute: async (args: z.infer<typeof clearHabitRemindersSchema>) => {
        if (!options?.loadSnapshot) {
          return JSON.stringify({
            error: "Habit reminders cannot be cleared without project context",
          });
        }

        const snapshot = await options.loadSnapshot();
        const habits = snapshot.habits ?? [];

        let targetHabits = habits;
        const nameFilters = (args.habitNames ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean);
        const idFilters = new Set((args.habitIds ?? []).map((id) => id.trim()).filter(Boolean));

        if (args.scope !== "all" || nameFilters.length > 0 || idFilters.size > 0) {
          targetHabits = habits.filter((habit) => {
            if (idFilters.size > 0 && idFilters.has(habit._id)) return true;
            if (nameFilters.length === 0) return false;
            const habitName = (habit.name ?? "").toLowerCase();
            return nameFilters.some((name) => habitName.includes(name));
          });
        }

        if (targetHabits.length === 0) {
          return JSON.stringify({
            error: "No matching habits found",
            message: "Please specify which habits to clear reminders for",
          });
        }

        return JSON.stringify({
          type: "habit",
          operation: "bulk_edit",
          data: {
            items: targetHabits.map((habit) => ({
              itemId: habit._id,
              updates: {
                reminderTime: "",
              },
            })),
          },
        });
      },
    },

    set_habit_reminder: {
      description: "Set or clear a habit reminder time. Use when the user asks to set a reminder for a habit.",
      inputSchema: setHabitReminderSchema,
      execute: async (args: z.infer<typeof setHabitReminderSchema>) => {
        let habitId = args.habitId?.trim();
        let habitName = args.habitName?.trim();

        if (!habitId && habitName && options?.loadSnapshot) {
          try {
            const snapshot = await options.loadSnapshot();
            const normalized = habitName.toLowerCase();
            const exactMatch = snapshot.habits.find(
              (habit) => habit.name?.toLowerCase() === normalized
            );
            const partialMatch = snapshot.habits.find((habit) =>
              habit.name?.toLowerCase().includes(normalized)
            );
            const resolved = exactMatch ?? partialMatch;
            if (resolved) {
              habitId = resolved._id;
              habitName = resolved.name;
            }
          } catch (error) {
            console.warn("Failed to resolve habit by name:", error);
          }
        }

        if (!habitId) {
          return JSON.stringify({
            error: "Habit not found",
            message: "Please specify a valid habit to update",
            data: { habitName: args.habitName },
          });
        }

        return JSON.stringify({
          type: "habit",
          operation: "edit",
          data: { itemId: habitId },
          updates: {
            reminderTime: args.reminderTime,
          },
          originalItem: { _id: habitId, name: habitName },
        });
      },
    },

    create_multiple_habits: {
      description: "Stage creation of multiple habits at once (2+ habits), pending /approve.",
      inputSchema: createMultipleHabitsSchema,
      execute: async (args: z.infer<typeof createMultipleHabitsSchema>) => {
        if (!args.habits || args.habits.length === 0) {
          return JSON.stringify({
            error: "No habits provided",
            message: "Please provide at least one habit to create",
          });
        }

        return JSON.stringify({
          type: "habit",
          operation: "bulk_create",
          data: { habits: args.habits },
        });
      },
    },

    create_multiple_items: {
      description: "Stage creation of multiple tasks/habits at once (2+ items), pending /approve.",
      inputSchema: createMultipleItemsSchema,
      execute: async (args: z.infer<typeof createMultipleItemsSchema>) => {
        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "bulk_create",
          data: { items: args.items }
        });
      },
    },

    update_item: {
      description: "Stage an update to an existing task/habit (pending /approve). Provide the type, item ID, and fields to update.",
      inputSchema: updateItemSchema,
      execute: async (args: z.infer<typeof updateItemSchema>) => {
        const typeToTable: Record<string, string> = {
          task: "tasks",
        };

        // Fetch original item from database to show in edit form
        let originalItem: { title?: string; name?: string; _id?: string } | null = null;
        let debugInfo: any = {};

        debugInfo.error = "Original item lookup disabled";

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "edit",
          data: { itemId: args.itemId },
          updates: args.data,
          originalItem: originalItem || { _id: args.itemId },
          debug: debugInfo
        });
      },
    },

    update_multiple_items: {
      description: "Stage updates to multiple tasks/habits at once (2+ items), pending /approve.",
      inputSchema: updateMultipleItemsSchema,
      execute: async (args: z.infer<typeof updateMultipleItemsSchema>) => {
        // Fetch original items from database for bulk edit
        const originalItems: any[] = [];
        // Original item lookup disabled for bulk edit.

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "bulk_edit",
          data: {
            items: originalItems.length > 0
              ? originalItems.map(item => ({
                itemId: item._id,
                originalItem: item,
                updates: item.updates
              }))
              : args.updates.map(u => ({
                itemId: u.itemId,
                originalItem: {},
                updates: u.data
              }))
          }
        });
      },
    },

    delete_item: {
      description: "Stage deletion of a task/habit from the project (pending /approve). Provide the type and item ID.",
      inputSchema: deleteItemSchema,
      execute: async (args: z.infer<typeof deleteItemSchema>) => {
        // Fetch original item to show full details in delete confirmation
        let originalItem: { title?: string; name?: string; _id?: string } | null = null;
        // Original item lookup disabled for delete.

        return JSON.stringify({
          type: getOperationType(args.type),
          operation: "delete",
          data: { itemId: args.itemId, name: args.name, reason: args.reason },
          originalItem: { _id: args.itemId, title: args.name, name: args.name },
        });
      },
    },

    // Generic search operation
    search_items: {
      description: "Search for and list tasks in the project. Use this tool when the user asks to see, list, show, or find existing tasks (including date-specific queries like 'jutro'). This is a READ-ONLY operation - it does not create or modify anything.",
      inputSchema: searchItemsSchema,
      execute: async (args: z.infer<typeof searchItemsSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }

        try {
          const { internal } = require("../_generated/api") as any;

          // Route to appropriate search function based on type
          const searchFn = internal.ai.search.searchTasks;
          const result = await options.runAction(searchFn, {
            projectId: options.projectId as Id<"projects">,
            query: args.query,
            limit: args.limit,
            ...args.filters,
          });

          return JSON.stringify(result);
        } catch (error) {
          console.error(`❌ Search failed for type '${args.type}':`, error);
          return JSON.stringify({
            error: `Failed to search ${args.type}s`,
            details: (error as Error).message
          });
        }
      },
    },

    // Full project context loading tool
    load_full_project_context: {
      description: "Load complete project overview including ALL tasks. Use this when you need comprehensive context about the entire project (e.g., for summaries or complex queries). This is more expensive than targeted searches, so use it wisely. The context is cached, so multiple calls are efficient.",
      inputSchema: loadFullProjectContextSchema,
      execute: async () => {
        if (!options?.loadSnapshot) {
          return JSON.stringify({
            error: "Full context loading not available",
            suggestion: "Try using search_items instead"
          });
        }

        try {
          const snapshot = await options.loadSnapshot();
          const { buildContextFromSnapshot } = await import("./helpers/contextBuilder");
          const formattedContext = buildContextFromSnapshot(snapshot);

          let finalContext = formattedContext;
          if (finalContext.length > 500000) {
            finalContext = finalContext.substring(0, 500000) + "\n...[TRUNCATED due to size]...";
          }

          return JSON.stringify({
            success: true,
            context: finalContext,
            counts: {
              tasks: snapshot.tasks.length,
              habits: snapshot.habits.length,
            },
            summary: snapshot.summary,
            message: "Full project context loaded successfully. Use the 'context' field for detailed data.",
          });
        } catch (error) {
          console.error("Error loading full project context:", error);
          return JSON.stringify({
            error: "Failed to load full project context",
            details: (error as Error).message,
          });
        }
      },
    },

    get_day_overview: {
      description: "Get a full overview of a specific day: all tasks (scheduled or due), habits (scheduled + completion status), and diary entry. Use when the user asks what's on a given day, what they have planned, or to check a date. READ-ONLY.",
      inputSchema: getDayOverviewSchema,
      execute: async (args: z.infer<typeof getDayOverviewSchema>) => {
        if (!options?.projectId || !options?.runQuery) {
          return JSON.stringify({ error: "Day overview not available - missing project context" });
        }

        try {
          const { internal } = require("../_generated/api") as any;
          const result = await options.runQuery(
            internal.calendar.getDayOverviewInternal,
            {
              projectId: options.projectId as Id<"projects">,
              date: args.date,
            }
          );

          const taskCount = result.tasks?.length ?? 0;
          const habitCount = result.habits?.length ?? 0;
          const hasDiary = !!result.diary;

          return JSON.stringify({
            success: true,
            ...result,
            summary: `${args.date}: ${taskCount} task(s), ${habitCount} habit(s)${hasDiary ? ", diary entry" : ""}`,
          });
        } catch (error) {
          console.error("Failed to get day overview:", error);
          return JSON.stringify({
            error: "day_overview_failed",
            message: (error as Error).message || "Failed to load day overview",
          });
        }
      },
    },

    web_search: {
      description: "Search the web for up-to-date information and return a concise answer with sources. READ-ONLY.",
      inputSchema: webSearchSchema,
      execute: async (args: z.infer<typeof webSearchSchema>) => {
        try {
          const result = await runOpenAIWebSearch(args);
          return JSON.stringify(result);
        } catch (error) {
          console.error("❌ Web search failed:", error);
          return JSON.stringify({
            error: "web_search_failed",
            message: (error as Error).message || "Failed to complete web search",
          });
        }
      },
    },

    remember: {
      description:
        "Store stable facts/preferences/priorities in long-term memory. Use for persistent info only.",
      inputSchema: rememberSchema,
      execute: async (args: z.infer<typeof rememberSchema>) => {
        if (!options?.projectId || !options?.runMutation) {
          return JSON.stringify({
            error: "memory_unavailable",
            message: "Long-term memory is not available without project context.",
          });
        }

        const items = args.items
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        if (items.length === 0) {
          return JSON.stringify({
            error: "no_memory_items",
            message: "No valid memory items provided.",
          });
        }

        const { internal } = require("../_generated/api") as any;

        for (const item of items) {
          await options.runMutation(internal.ai.system.appendLongTermMemory, {
            projectId: options.projectId as Id<"projects">,
            content: item,
          });
        }

        return JSON.stringify({
          success: true,
          stored: items.length,
          message: "Saved to long-term memory.",
        });
      },
    },

    add_diary_entry: {
      description:
        "Add a diary/journal entry for the user. Use this when the user shares personal reflections, " +
        "mood updates, daily summaries, feelings, experiences, or anything diary-worthy. " +
        "Examples: 'today was a good day', 'I felt stressed at work', 'had a great workout'. " +
        "The entry is appended to the day's diary -- it won't overwrite existing entries.",
      inputSchema: addDiaryEntrySchema,
      execute: async (args: z.infer<typeof addDiaryEntrySchema>) => {
        if (!options?.projectId || !options?.runMutation) {
          return JSON.stringify({
            error: "diary_unavailable",
            message: "Diary is not available without project context.",
          });
        }
        if (!options?.actorUserId) {
          return JSON.stringify({
            error: "diary_unavailable",
            message: "Diary requires an authenticated user.",
          });
        }

        const content = args.content?.trim();
        if (!content) {
          return JSON.stringify({
            error: "empty_diary_entry",
            message: "Diary entry content cannot be empty.",
          });
        }

        try {
          const internalAny = require("../_generated/api").internal as any;
          await options.runMutation(internalAny.diary.upsertDiaryEntryInternal, {
            projectId: options.projectId as Id<"projects">,
            actorUserId: options.actorUserId,
            date: args.date,
            content,
            mood: args.mood,
          });

          return JSON.stringify({
            success: true,
            message: "Diary entry saved.",
            date: args.date ?? "today",
            mood: args.mood,
          });
        } catch (error) {
          console.error("Failed to add diary entry:", error);
          return JSON.stringify({
            error: "diary_entry_failed",
            message: (error as Error).message || "Failed to save diary entry.",
          });
        }
      },
    },

    configure_telegram: {
      description:
        "Configure Telegram integration for the current project by saving bot credentials. Use when the user provides a bot token or asks to connect Telegram. Do not echo secrets.",
      inputSchema: telegramConfigSchema,
      execute: async (args: z.infer<typeof telegramConfigSchema>) => {
        if (!options?.projectId || !options?.runMutation) {
          return JSON.stringify({
            error: "telegram_config_unavailable",
            message: "Telegram configuration is not available without project context.",
          });
        }
        if (!options?.actorUserId) {
          return JSON.stringify({
            error: "telegram_config_unavailable",
            message: "Telegram configuration requires an authenticated user.",
          });
        }

        const token = args.botToken?.trim();
        if (!token) {
          return JSON.stringify({
            error: "missing_bot_token",
            message: "Telegram bot token is required to connect Telegram.",
          });
        }

        const usernameRaw = args.botUsername?.trim();
        const username = usernameRaw ? usernameRaw.replace(/^@/, "") : undefined;

        try {
          const internalAny = require("../_generated/api").internal as any;
          await options.runMutation(internalAny.projects.updateProjectTelegramConfigInternal, {
            projectId: options.projectId as Id<"projects">,
            actorUserId: options.actorUserId,
            telegramBotToken: token,
            ...(username ? { telegramBotUsername: username } : {}),
          });

          return JSON.stringify({
            success: true,
            message: "Telegram bot credentials saved. Webhook configuration has been queued.",
            botUsername: username ?? null,
          });
        } catch (error) {
          console.error("❌ Telegram configuration failed:", error);
          return JSON.stringify({
            error: "telegram_config_failed",
            message: (error as Error).message || "Failed to configure Telegram.",
          });
        }
      },
    },

    approve_pairing_code: {
      description:
        "Approve a pending Telegram pairing request using the pairing code. Use when the user pastes a pairing code from Telegram.",
      inputSchema: approvePairingCodeSchema,
      execute: async (args: z.infer<typeof approvePairingCodeSchema>) => {
        if (!options?.projectId || !options?.runMutation) {
          return JSON.stringify({
            error: "pairing_code_unavailable",
            message: "Pairing approval is not available without project context.",
          });
        }
        if (!options?.actorUserId) {
          return JSON.stringify({
            error: "pairing_code_unavailable",
            message: "Pairing approval requires an authenticated user.",
          });
        }

        try {
          const internalAny = require("../_generated/api").internal as any;
          const result = await options.runMutation(internalAny.messaging.pairingRequests.approvePairingCodeInternal, {
            projectId: options.projectId as Id<"projects">,
            pairingCode: args.pairingCode,
            actorUserId: options.actorUserId,
          });

          if (result?.success) {
            return JSON.stringify({
              success: true,
              message: "Telegram pairing approved.",
            });
          }

          // If pairing was already approved, treat as success
          if (result?.status === "approved") {
            return JSON.stringify({
              success: true,
              message: "Telegram pairing was already approved. The user is connected and can send messages.",
            });
          }

          return JSON.stringify({
            error: "pairing_code_failed",
            message: `Pairing request not pending (${result?.status ?? "unknown"}).`,
          });
        } catch (error) {
          return JSON.stringify({
            error: "pairing_code_failed",
            message: (error as Error).message || "Failed to approve pairing code.",
          });
        }
      },
    },

    schedule_telegram_reminder: {
      description:
        "Schedule a Telegram reminder for the current user. Use for requests like 'remind me in 15 minutes' or 'send a Telegram reminder at 18:00'.",
      inputSchema: telegramReminderSchema,
      execute: async (args: z.infer<typeof telegramReminderSchema>) => {
        if (!options?.projectId || !options?.runMutation) {
          return JSON.stringify({
            error: "telegram_reminder_unavailable",
            message: "Telegram reminders are not available without project context.",
          });
        }
        if (!options?.actorUserId) {
          return JSON.stringify({
            error: "telegram_reminder_unavailable",
            message: "Telegram reminders require an authenticated user.",
          });
        }

        const message = args.message?.trim();
        if (!message) {
          return JSON.stringify({
            error: "missing_message",
            message: "Please provide a reminder message.",
          });
        }

        if (!args.delayMinutes && !args.runAt) {
          return JSON.stringify({
            error: "missing_time",
            message: "Please provide delayMinutes or runAt for the reminder.",
          });
        }

        try {
          const internalAny = require("../_generated/api").internal as any;
          const result = await options.runMutation(internalAny.messaging.reminders.scheduleTelegramReminder, {
            projectId: options.projectId as Id<"projects">,
            actorUserId: options.actorUserId,
            message,
            delayMinutes: args.delayMinutes,
            runAt: args.runAt,
          });

          return JSON.stringify({
            success: true,
            scheduledFor: result?.scheduledFor,
          });
        } catch (error) {
          console.error("❌ Telegram reminder scheduling failed:", error);
          return JSON.stringify({
            error: "telegram_reminder_failed",
            message: (error as Error).message || "Failed to schedule Telegram reminder.",
          });
        }
      },
    },
  };
}

// ============================================
// AGENT TOOLS (for Convex Agent)
// ============================================

/**
 * Create tools for Convex Agent - identical to streaming tools
 * This ensures both implementations use the same tool definitions
 */
export function createAgentTools(options?: StreamingToolOptions) {
  // Return the same tools as createStreamingTools
  // Convex Agent and AI SDK use the same tool format
  return createStreamingTools(options);
}
