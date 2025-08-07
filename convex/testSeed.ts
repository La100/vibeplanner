import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

type SeedResult = {
  tasksCreated: number;
  shoppingItemsCreated: number;
  surveysCreated: number;
  sectionsCreated: number;
};

export const seedGangProject = action({
  args: {},
  returns: v.object({
    tasksCreated: v.float64(),
    shoppingItemsCreated: v.float64(),
    surveysCreated: v.float64(),
    sectionsCreated: v.float64(),
  }),
  handler: async (ctx): Promise<SeedResult> => {
    return await ctx.runAction(api.seedDummyData.seedInteriorDesignProject, {
      teamSlug: "hooli",
      projectSlug: "bert",
    });
  },
});

// Legacy functions - no longer needed with 1M context
export const resetIndexingForProject = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    return { success: true, message: "No indexing needed with 1M context" };
  },
});

export const resetAllIndexing = action({
  args: {
    clerkOrgId: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string(), resetCount: v.number() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; resetCount: number }> => {
    return { success: true, message: "No indexing needed with 1M context", resetCount: 0 };
  },
});

export const startIndexing = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    return { success: true, message: "No indexing needed with 1M context" };
  },
});