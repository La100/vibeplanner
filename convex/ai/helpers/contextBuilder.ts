/**
 * Context Builder Helper
 *
 * Builds context strings from project snapshots for AI prompts
 */

import type { ProjectContextSnapshot, TeamMember } from "../types";

type BuildContextOptions = {
  maxTaskDescriptionChars?: number;
  maxHabitDescriptionChars?: number;
  maxDiaryContentChars?: number;
  reminderPlanPreviewLimit?: number;
};

const DEFAULT_CONTEXT_OPTIONS: Required<BuildContextOptions> = {
  maxTaskDescriptionChars: 200,
  maxHabitDescriptionChars: 400,
  maxDiaryContentChars: 300,
  reminderPlanPreviewLimit: 3,
};

export const buildContextFromSnapshot = (snapshot: ProjectContextSnapshot): string => {
  return buildContextFromSnapshotWithOptions(snapshot, DEFAULT_CONTEXT_OPTIONS);
};

function buildContextFromSnapshotWithOptions(
  snapshot: ProjectContextSnapshot,
  options: BuildContextOptions,
): string {
  const parts: string[] = [];
  const resolved = { ...DEFAULT_CONTEXT_OPTIONS, ...options };

  const truncate = (value: string, max = 200): string => {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
  };

  const formatDate = (value?: number): string | null => {
    if (typeof value !== "number") return null;
    return new Date(value).toISOString();
  };

  const formatDateRange = (start?: number, end?: number): string => {
    const startIso = formatDate(start);
    const endIso = formatDate(end);
    if (!startIso && !endIso) return "";
    if (startIso && endIso) return ` | start: ${startIso} | end: ${endIso}`;
    if (startIso) return ` | start: ${startIso}`;
    return ` | end: ${endIso}`;
  };

  if (snapshot.project) {
    parts.push(`PROJECT: ${snapshot.project.name} (${snapshot.project.status})`);
    if (snapshot.project.assistantPreset) {
      parts.push(`ASSISTANT PRESET: ${snapshot.project.assistantPreset}`);
    }
    if (snapshot.project.assistantOnboardingStatus) {
      parts.push(`ASSISTANT ONBOARDING: ${snapshot.project.assistantOnboardingStatus}`);
    }
  }

  if (snapshot.tasks.length > 0) {
    parts.push(`\nTASKS (${snapshot.tasks.length}):`);
    snapshot.tasks.forEach((task) => {
      const dateRange = formatDateRange(task.startDate, task.endDate);
      const assignee = task.assignedToName || task.assignedTo;
      const cost = typeof task.cost === "number" ? ` | cost: ${task.cost}` : "";
      const description = task.description
        ? ` | desc: ${truncate(task.description, resolved.maxTaskDescriptionChars)}`
        : "";
      parts.push(
        `- "${task.title}" [${task._id}] - ${task.status} | ${task.priority || "none"}${dateRange}${assignee ? ` | assigned: ${assignee}` : ""}${cost}${description}`,
      );
    });
  }

  if (snapshot.habits.length > 0) {
    parts.push(`\nHABITS (${snapshot.habits.length}):`);
    snapshot.habits.forEach((habit) => {
      const target = typeof habit.targetValue === "number"
        ? ` | target: ${habit.targetValue}${habit.unit ? ` ${habit.unit}` : ""}`
        : "";
      const frequency = habit.frequency ? ` | ${habit.frequency}` : "";
      const schedule = habit.scheduleDays?.length ? ` | days: ${habit.scheduleDays.join(", ")}` : "";
      const reminder = (habit.effectiveTodayReminderTime || habit.reminderTime)
        ? ` | reminder: ${habit.effectiveTodayReminderTime || habit.reminderTime}`
        : "";
      const phase = habit.todayPhaseLabel ? ` | phase: ${habit.todayPhaseLabel}` : "";
      const reminderPlanPreview = habit.reminderPlan?.length
        ? ` | plan: ${habit.reminderPlan
          .slice(0, resolved.reminderPlanPreviewLimit)
          .map((entry) => `${entry.date} ${entry.reminderTime}`)
          .join(", ")}${habit.reminderPlan.length > resolved.reminderPlanPreviewLimit ? ", ..." : ""}`
        : "";
      const status = habit.completedToday ? " | completed today" : "";
      const desc = habit.description
        ? ` | desc: ${truncate(habit.description, resolved.maxHabitDescriptionChars)}`
        : "";
      parts.push(
        `- "${habit.name}" [${habit._id}]${frequency}${schedule}${target}${reminder}${phase}${reminderPlanPreview}${status}${desc}`,
      );
    });
  }

  if (snapshot.diaryEntries && snapshot.diaryEntries.length > 0) {
    parts.push(`\nRECENT DIARY ENTRIES (${snapshot.diaryEntries.length}):`);
    snapshot.diaryEntries.forEach((entry) => {
      const moodTag = entry.mood ? ` [mood: ${entry.mood}]` : "";
      const sourceTag = entry.source === "assistant" ? " (AI)" : "";
      const contentPreview = truncate(entry.content, resolved.maxDiaryContentChars);
      parts.push(
        `- ${entry.date}${moodTag}${sourceTag}: ${contentPreview}`,
      );
    });
  }

  return parts.join('\n');
}

const COMPACT_TASK_LIMIT = 16;
const COMPACT_DONE_TASK_LIMIT = 4;
const COMPACT_HABIT_LIMIT = 12;
const COMPACT_DIARY_LIMIT = 3;

export const buildCompactContextFromSnapshot = (snapshot: ProjectContextSnapshot): string => {
  const openTasks = snapshot.tasks.filter((task) => task.status !== "done");
  const doneTasks = snapshot.tasks.filter((task) => task.status === "done");
  const activeHabits = snapshot.habits.filter((habit) => habit.isActive);

  const compactSnapshot: ProjectContextSnapshot = {
    ...snapshot,
    tasks: [
      ...openTasks.slice(0, COMPACT_TASK_LIMIT),
      ...doneTasks.slice(0, COMPACT_DONE_TASK_LIMIT),
    ],
    habits: activeHabits.slice(0, COMPACT_HABIT_LIMIT),
    diaryEntries: snapshot.diaryEntries.slice(0, COMPACT_DIARY_LIMIT),
  };

  const compactContext = buildContextFromSnapshotWithOptions(compactSnapshot, {
    maxTaskDescriptionChars: 120,
    maxHabitDescriptionChars: 180,
    maxDiaryContentChars: 160,
    reminderPlanPreviewLimit: 2,
  });

  const omittedTasks = Math.max(0, snapshot.tasks.length - compactSnapshot.tasks.length);
  const omittedHabits = Math.max(0, snapshot.habits.length - compactSnapshot.habits.length);
  const omittedDiary = Math.max(0, snapshot.diaryEntries.length - compactSnapshot.diaryEntries.length);

  const truncationHints: string[] = [];
  if (omittedTasks > 0) truncationHints.push(`tasks omitted: ${omittedTasks}`);
  if (omittedHabits > 0) truncationHints.push(`habits omitted: ${omittedHabits}`);
  if (omittedDiary > 0) truncationHints.push(`diary entries omitted: ${omittedDiary}`);

  const truncationLine = truncationHints.length
    ? `\nCONTEXT COMPACTED (${truncationHints.join(" | ")}). Use search tools for full details.`
    : "";

  return `${compactContext}\n\nPROJECT SUMMARY: ${snapshot.summary}${truncationLine}`;
};

export const buildTeamMembersContext = (teamMembers: TeamMember[]): string => {
  if (teamMembers.length === 0) {
    return "";
  }

  const list = teamMembers
    .map((member) => {
      const displayName = member.name || member.email || "Unknown";
      const clerkId = member.clerkUserId ? ` (Clerk ID: ${member.clerkUserId})` : "";
      return `- ${displayName}${clerkId}`;
    })
    .join('\n');

  return `\n\nTEAM MEMBERS:\n${list}`;
};

export const buildSystemInstructions = (
  systemPrompt: string,
  currentDateTime: string,
  currentDate: string,
  teamMembersContext: string,
  currentUserClerkId?: string,
  timezone?: string,
): string => {
  const currentUserSection = currentUserClerkId
    ? `\n\nCURRENT USER (who sent this message): Clerk ID ${currentUserClerkId}\nWhen the user says "assign to me" or "przypisz do mnie", use this Clerk ID in the assignedTo field.`
    : "";

  const timezoneInfo = timezone ? `\nTIMEZONE: ${timezone}` : "";

  return `${systemPrompt}
  
CURRENT DATE AND TIME: ${currentDateTime} (${currentDate})${timezoneInfo}

${teamMembersContext}${currentUserSection}

When the user asks for multiple items, focus only on tasks and stick to the quantities they specify.

CRITICAL INSTRUCTION ON TIMEZONES:
If a TIMEZONE is provided above, you MUST convert any user-requested local times to UTC before setting them in startDate/endDate.
The user's request is in LOCAL time. The stored time must be in UTC.
Example: User asks for "14:00" in "Europe/Warsaw" (UTC+1). You must set the ISO string to T13:00:00Z.
DO NOT use the local time as the UTC time. YOU MUST SUBTRACT THE OFFSET.`;
};

export const buildUserMessage = (contextSnapshot: string, message: string, summary: string | null): string => {
  const summarySection = summary ? `\n\nPARSED REQUEST SUMMARY:\n${summary}` : "";
  return `RELEVANT CONTEXT:\n${contextSnapshot}\n\nUSER MESSAGE: ${message}${summarySection}`;
};

export const buildCreationSummary = (message: string): string | null => {
  const patterns: Array<{
    label: string;
    keywords: string[];
  }> = [
      {
        label: "tasks",
        keywords: ["task", "tasks", "zadań", "zadania", "tasków"],
      },
      
    ];

  const lower = message.toLowerCase();
  const summary: string[] = [];

  const findCount = (base: string, keyword: string): number | null => {
    const keywordRegex = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regexes = [
      new RegExp(`(\\d+)\\s+${keywordRegex}`, "i"),
      new RegExp(`${keywordRegex}\\s+(\\d+)`, "i"),
      new RegExp(`(\\d+)\\s+${keywordRegex}\\w*`, "i"),
    ];

    for (const regex of regexes) {
      const match = base.match(regex);
      if (match && match[1]) {
        const value = parseInt(match[1], 10);
        if (!Number.isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  };

  patterns.forEach(({ label, keywords }) => {
    for (const keyword of keywords) {
      const count = findCount(lower, keyword.toLowerCase());
      if (count !== null) {
        summary.push(`- ${label}: ${count}`);
        break;
      }
    }
  });

  if (summary.length === 0) {
    return null;
  }

  return summary.join("\n");
};

export const getCurrentDateTime = (timezone?: string): { currentDate: string; currentDateTime: string } => {
  const now = new Date();

  if (timezone) {
    try {
      // Use Intl.DateTimeFormat to get date/time in specific timezone
      const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      };
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };

      // Format: YYYY-MM-DD
      const parts = new Intl.DateTimeFormat('en-CA', dateOptions).formatToParts(now);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;

      const currentDate = `${year}-${month}-${day}`;
      const currentDateTime = new Intl.DateTimeFormat('en-US', timeOptions).format(now);

      return { currentDate, currentDateTime };
    } catch (e) {
      console.warn(`Invalid timezone: ${timezone}, falling back to UTC/Server time`);
    }
  }

  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDateTime = now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return { currentDate, currentDateTime };
};
