/**
 * Context Builder Helper
 *
 * Builds context strings from project snapshots for AI prompts
 */

import type { ProjectContextSnapshot, TeamMember, ShoppingSectionContext } from "../types";

export const buildContextFromSnapshot = (snapshot: ProjectContextSnapshot): string => {
  const parts: string[] = [];

  if (snapshot.project) {
    parts.push(`PROJECT: ${snapshot.project.name} (${snapshot.project.status})`);
  }

  if (snapshot.tasks.length > 0) {
    parts.push(`\nTASKS (${snapshot.tasks.length}):`);
    snapshot.tasks.forEach((task) => {
      parts.push(`- "${task.title}" [${task._id}] - ${task.status} | ${task.priority || "none"}`);
    });
  }

  if (snapshot.notes.length > 0) {
    parts.push(`\nNOTES (${snapshot.notes.length}):`);
    snapshot.notes.forEach((note) => {
      parts.push(`- "${note.title}" [${note._id}]`);
    });
  }

  if (snapshot.shoppingItems.length > 0) {
    parts.push(`\nSHOPPING (${snapshot.shoppingItems.length}):`);
    snapshot.shoppingItems.forEach((item) => {
      parts.push(`- "${item.name}" [${item._id}] - Qty: ${item.quantity} | ${item.realizationStatus}`);
    });
  }

  if (snapshot.contacts.length > 0) {
    parts.push(`\nCONTACTS (${snapshot.contacts.length}):`);
    snapshot.contacts.forEach((contact) => {
      parts.push(`- "${contact.name}" [${contact._id}] - ${contact.type}`);
    });
  }

  if (snapshot.surveys.length > 0) {
    parts.push(`\nSURVEYS (${snapshot.surveys.length}):`);
    snapshot.surveys.forEach((survey) => {
      parts.push(`- "${survey.title}" [${survey._id}] - ${survey.status}`);
      if (survey.questions.length > 0) {
        survey.questions.forEach((question) => {
          const optionsSummary = question.options && question.options.length > 0
            ? ` | options: ${question.options.join(", ")}`
            : "";
          parts.push(
            `    • ${question.questionText} (${question.questionType}) [${question._id}]${optionsSummary}`,
          );
        });
      }
    });
  }

  return parts.join('\n');
};

export const buildTeamMembersContext = (teamMembers: TeamMember[]): string => {
  if (teamMembers.length === 0) {
    return "";
  }

  const list = teamMembers
    .map((member) => `- ${member.name || member.email || "Unknown"}`)
    .join('\n');

  return `\n\nTEAM MEMBERS:\n${list}`;
};

export const buildSystemInstructions = (
  systemPrompt: string,
  currentDateTime: string,
  currentDate: string,
  teamMembersContext: string,
): string => {
  return `${systemPrompt}

CURRENT DATE AND TIME: ${currentDateTime} (${currentDate})
When setting due dates, use this as reference for "today", "tomorrow", "next week", etc.${teamMembersContext}

When the user asks for multiple types of content, prepare a balanced mix across tasks, notes, shopping items/sections, surveys, and contacts unless they explicitly specify quantities for each.`;
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
    {
      label: "notes",
      keywords: ["note", "notes", "notatek", "notatki", "notatka"],
    },
    {
      label: "shopping items",
      keywords: ["shopping item", "shopping items", "pozycji", "pozycje", "zakup", "zakupów"],
    },
    {
      label: "shopping sections",
      keywords: ["shopping section", "shopping sections", "sekcja", "sekcje", "sekcji"],
    },
    {
      label: "surveys",
      keywords: ["survey", "surveys", "ankieta", "ankiety"],
    },
    {
      label: "contacts",
      keywords: ["contact", "contacts", "kontakt", "kontakty"],
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

export const getCurrentDateTime = (): { currentDate: string; currentDateTime: string } => {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const currentDateTime = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return { currentDate, currentDateTime };
};
