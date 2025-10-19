import { query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

interface DebugCounts {
  tasks: number;
  notes: number;
  shoppingItems: number;
  contacts: number;
  surveys: number;
}

interface DebugSample {
  tasks: any[];
  notes: any[];
  shoppingItems: any[];
  contacts: any[];
  surveys: any[];
}

interface DebugResult {
  counts: DebugCounts;
  summary: string;
  sample: DebugSample;
}

/**
 * Debug helper – inspect the live project context that feeds the AI assistant.
 */
export const inspectProjectContext = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    counts: v.object({
      tasks: v.number(),
      notes: v.number(),
      shoppingItems: v.number(),
      contacts: v.number(),
      surveys: v.number(),
    }),
    summary: v.string(),
    sample: v.object({
      tasks: v.any(),
      notes: v.any(),
      shoppingItems: v.any(),
      contacts: v.any(),
      surveys: v.any(),
    }),
  }),
  handler: async (ctx, args): Promise<DebugResult> => {
    const snapshot = await ctx.runQuery(internal.ai.longContextQueries.getProjectContextSnapshot, {
      projectId: args.projectId,
    });

    return {
      counts: {
        tasks: snapshot.tasks.length,
        notes: snapshot.notes.length,
        shoppingItems: snapshot.shoppingItems.length,
        contacts: snapshot.contacts.length,
        surveys: snapshot.surveys.length,
      },
      summary: snapshot.summary,
      sample: {
        tasks: snapshot.tasks.slice(0, 3),
        notes: snapshot.notes.slice(0, 3),
        shoppingItems: snapshot.shoppingItems.slice(0, 3),
        contacts: snapshot.contacts.slice(0, 3),
        surveys: snapshot.surveys.slice(0, 3),
      },
    };
  },
});
