import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ====== TOKEN USAGE TRACKING ======

/**
 * Save AI token usage statistics
 * Called internally after each AI request
 */
export const saveTokenUsage = internalMutation({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    
    model: v.string(),
    requestType: v.union(v.literal("chat"), v.literal("embedding"), v.literal("other")),
    
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    
    contextSize: v.optional(v.number()),
    mode: v.optional(v.string()),
    estimatedCostCents: v.optional(v.number()),
    responseTimeMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiTokenUsage", {
      ...args
    });
  },
});

/**
 * Get token usage statistics for a project
 */
export const getProjectTokenUsage = query({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()), // Last N days, default 30
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const days = args.days || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.gte(q.field("_creationTime"), cutoffTime))
      .collect();

    // Calculate totals
    const totalInputTokens = usage.reduce((sum, record) => sum + record.inputTokens, 0);
    const totalOutputTokens = usage.reduce((sum, record) => sum + record.outputTokens, 0);
    const totalTokens = usage.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalCostCents = usage.reduce((sum, record) => sum + (record.estimatedCostCents || 0), 0);
    const totalRequests = usage.length;
    const successfulRequests = usage.filter(r => r.success).length;

    // Calculate by mode
    const fullModeUsage = usage.filter(r => r.mode === "full");
    const smartModeUsage = usage.filter(r => r.mode === "smart");

    // Daily breakdown
    const dailyUsage = usage.reduce((acc, record) => {
      const date = new Date(record._creationTime).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costCents: 0
        };
      }
      acc[date].requests++;
      acc[date].inputTokens += record.inputTokens;
      acc[date].outputTokens += record.outputTokens;
      acc[date].totalTokens += record.totalTokens;
      acc[date].costCents += record.estimatedCostCents || 0;
      return acc;
    }, {} as Record<string, any>);

    return {
      summary: {
        totalRequests,
        successfulRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalCostCents,
        totalCostUSD: totalCostCents / 100,
        averageTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
        averageCostPerRequest: totalRequests > 0 ? totalCostCents / totalRequests : 0,
      },
      byMode: {
        full: {
          requests: fullModeUsage.length,
          tokens: fullModeUsage.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: fullModeUsage.reduce((sum, r) => sum + (r.estimatedCostCents || 0), 0),
        },
        smart: {
          requests: smartModeUsage.length,
          tokens: smartModeUsage.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: smartModeUsage.reduce((sum, r) => sum + (r.estimatedCostCents || 0), 0),
        }
      },
      dailyBreakdown: Object.values(dailyUsage).sort((a: any, b: any) => b.date.localeCompare(a.date)),
      recentRequests: usage
        .sort((a, b) => b._creationTime - a._creationTime)
        .slice(0, 10)
        .map(record => ({
          date: new Date(record._creationTime).toISOString(),
          mode: record.mode,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          totalTokens: record.totalTokens,
          costCents: record.estimatedCostCents,
          success: record.success,
          responseTime: record.responseTimeMs,
        }))
    };
  },
});

/**
 * Get team-wide token usage statistics
 */
export const getTeamTokenUsage = query({
  args: {
    teamId: v.id("teams"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // TODO: Check if user has access to team

    const days = args.days || 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.gte(q.field("_creationTime"), cutoffTime))
      .collect();

    const totalTokens = usage.reduce((sum, record) => sum + record.totalTokens, 0);
    const totalCostCents = usage.reduce((sum, record) => sum + (record.estimatedCostCents || 0), 0);

    // By project breakdown
    const byProject = usage.reduce((acc, record) => {
      const projectId = record.projectId;
      if (!acc[projectId]) {
        acc[projectId] = {
          projectId,
          requests: 0,
          tokens: 0,
          costCents: 0,
        };
      }
      acc[projectId].requests++;
      acc[projectId].tokens += record.totalTokens;
      acc[projectId].costCents += record.estimatedCostCents || 0;
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRequests: usage.length,
      totalTokens,
      totalCostCents,
      totalCostUSD: totalCostCents / 100,
      byProject: Object.values(byProject).sort((a: any, b: any) => b.tokens - a.tokens),
    };
  },
});


