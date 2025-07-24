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

export const resetIndexingForProject = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    return await ctx.runAction(api.ai_indexing.resetIndexingStatus, {
      projectId: args.projectId,
    });
  },
});

export const resetAllIndexing = action({
  args: {
    clerkOrgId: v.string(),
  },
  returns: v.object({ success: v.boolean(), message: v.string(), resetCount: v.number() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string; resetCount: number }> => {
    return await ctx.runAction(api.ai_indexing.resetAllStuckIndexing, {
      clerkOrgId: args.clerkOrgId,
    });
  },
});

export const startIndexing = action({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    return await ctx.runAction(api.ai_new.initIndex, {
      projectId: args.projectId,
    });
  },
});