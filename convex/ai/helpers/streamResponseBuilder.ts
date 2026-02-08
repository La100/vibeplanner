/**
 * Stream Response Builder Helpers
 * 
 * Utility functions for parsing and summarizing tool results
 * from AI streaming responses.
 */

// ==================== TYPES ====================

export type ToolCallRecord = {
  toolName?: string;
  name?: string;
  args?: unknown;
};

export type ToolResultRecord = {
  result?: unknown;
  output?: unknown;
};

// ==================== JSON PARSING ====================

export const safeParseJSON = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

// ==================== TASK SUMMARIZATION ====================

export const summarizeTasksFromSearch = (data: any): string | null => {
  if (!data) return null;
  const total =
    typeof data.total === "number"
      ? data.total
      : typeof data.found === "number"
      ? data.found
      : Array.isArray(data.tasks)
      ? data.tasks.length
      : null;

  if (total === null) {
    return null;
  }

  const parts: string[] = [`Znalazłem ${total} zadań w projekcie.`];

  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    const statusCounts = data.tasks.reduce(
      (acc: Record<string, number>, task: any) => {
        const status = typeof task.status === "string" ? task.status : "nieznany";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {},
    );

    const statusSummary = Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ");

    if (statusSummary.length > 0) {
      parts.push(`Statusy → ${statusSummary}.`);
    }

    const examples = data.tasks.slice(0, 3);
    if (examples.length > 0) {
      const exampleLines = examples
        .map((task: any) => {
          const title = typeof task.title === "string" ? task.title : "bez tytułu";
          const status = typeof task.status === "string" ? task.status : "nieznany";
          return `• ${title} (${status})`;
        })
        .join("\n");
      parts.push(`Przykłady:\n${exampleLines}`);
    }
  }

  return parts.join(" ");
};

// ==================== PROJECT SUMMARIZATION ====================

export const summarizeProjectCounts = (data: any): string | null => {
  if (!data || !data.counts) return null;
  const counts = data.counts;
  if (typeof counts.tasks !== "number") return null;

  const parts: string[] = [`Masz ${counts.tasks} zadań w tym projekcie.`];

  return parts.join(" ");
};

// ==================== WEB SEARCH SUMMARIZATION ====================

export const summarizeWebSearch = (data: any): string | null => {
  if (!data || typeof data !== "object") return null;
  const answer = typeof data.answer === "string" ? data.answer.trim() : "";
  const citations = Array.isArray(data.citations) ? data.citations : [];
  if (!answer) return null;

  if (citations.length === 0) {
    return answer;
  }

  const sources = citations
    .slice(0, 5)
    .map((c: any) => (typeof c?.url === "string" ? c.url : null))
    .filter(Boolean)
    .join("\n");

  if (!sources) return answer;
  return `${answer}\n\nSources:\n${sources}`;
};

// ==================== FALLBACK RESPONSE BUILDER ====================

export const buildFallbackResponseFromTools = (
  toolCalls: ToolCallRecord[],
  toolResults: ToolResultRecord[],
): string | null => {
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const toolName = toolCalls[i]?.toolName || toolCalls[i]?.name;
    if (!toolName) continue;

    const rawResult =
      toolResults[i]?.result ?? toolResults[i]?.output ?? toolResults[i];
    const parsedResult = safeParseJSON(rawResult);

    if (toolName === "search_tasks") {
      const summary = summarizeTasksFromSearch(parsedResult);
      if (summary) {
        return summary;
      }
    }

    if (toolName === "load_full_project_context") {
      const summary = summarizeProjectCounts(parsedResult);
      if (summary) {
        return summary;
      }
    }

    if (toolName === "web_search") {
      const summary = summarizeWebSearch(parsedResult);
      if (summary) {
        return summary;
      }
    }

    
  }

  return null;
};













