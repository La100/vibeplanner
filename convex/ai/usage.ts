import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getBillingWindow } from "../stripe";
import { AI_INPUT_COST_PER_1M, AI_OUTPUT_COST_PER_1M } from "./config";

const estimateCostUSD = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * AI_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * AI_OUTPUT_COST_PER_1M;
  return inputCost + outputCost;
};

const estimateCostCents = (inputTokens: number, outputTokens: number): number => {
  return Math.round(estimateCostUSD(inputTokens, outputTokens) * 100);
};

// ====== TOKEN USAGE TRACKING ======

/**
 * Save AI token usage statistics
 * Called internally after each AI request
 */
export const saveTokenUsage = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    
    model: v.string(),
    feature: v.optional(v.union(
      v.literal("assistant"),
      v.literal("visualizations"),
      v.literal("other")
    )),
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
    const resolvedFeature =
      args.feature ||
      (args.requestType === "chat" ? "assistant" : "other");

    // Insert usage record
    const usageId = await ctx.db.insert("aiTokenUsage", {
      ...args,
      feature: resolvedFeature,
    });

    // Decrement aiTokens from user (primary) + team (backward compat)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.userClerkId))
      .unique();
    if (user && user.aiTokens !== undefined) {
      const newBalance = Math.max(0, (user.aiTokens || 0) - args.totalTokens);
      await ctx.db.patch(user._id, { aiTokens: newBalance });
    }
    // Dual-write: also update team for backward compat
    const team = await ctx.db.get(args.teamId);
    if (team && team.aiTokens !== undefined) {
      const newBalance = Math.max(0, (team.aiTokens || 0) - args.totalTokens);
      await ctx.db.patch(args.teamId, { aiTokens: newBalance });
    }

    return usageId;
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
    const inputCostUSD = (totalInputTokens / 1_000_000) * AI_INPUT_COST_PER_1M;
    const outputCostUSD = (totalOutputTokens / 1_000_000) * AI_OUTPUT_COST_PER_1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    const totalCostCents = Math.round(totalCostUSD * 100);
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
      acc[date].costCents += estimateCostCents(record.inputTokens, record.outputTokens);
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
        totalCostUSD,
        inputCostUSD,
        outputCostUSD,
        averageTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
        averageCostPerRequest: totalRequests > 0 ? totalCostCents / totalRequests : 0,
      },
      byMode: {
        full: {
          requests: fullModeUsage.length,
          tokens: fullModeUsage.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: fullModeUsage.reduce((sum, r) => sum + estimateCostCents(r.inputTokens, r.outputTokens), 0),
        },
        smart: {
          requests: smartModeUsage.length,
          tokens: smartModeUsage.reduce((sum, r) => sum + r.totalTokens, 0),
          cost: smartModeUsage.reduce((sum, r) => sum + estimateCostCents(r.inputTokens, r.outputTokens), 0),
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
          costCents: estimateCostCents(record.inputTokens, record.outputTokens),
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

    const totalInputTokens = usage.reduce((sum, record) => sum + record.inputTokens, 0);
    const totalOutputTokens = usage.reduce((sum, record) => sum + record.outputTokens, 0);
    const totalTokens = usage.reduce((sum, record) => sum + record.totalTokens, 0);
    const inputCostUSD = (totalInputTokens / 1_000_000) * AI_INPUT_COST_PER_1M;
    const outputCostUSD = (totalOutputTokens / 1_000_000) * AI_OUTPUT_COST_PER_1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    const totalCostCents = Math.round(totalCostUSD * 100);

    // By project breakdown
    const byProject = usage.reduce((acc, record) => {
      const projectId = record.projectId ?? "unknown";
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
      acc[projectId].costCents += estimateCostCents(record.inputTokens, record.outputTokens);
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRequests: usage.length,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCostCents,
      totalCostUSD,
      inputCostUSD,
      outputCostUSD,
      byProject: Object.values(byProject).sort((a: any, b: any) => b.tokens - a.tokens),
    };
  },
});

/**
 * Get team token usage breakdown by feature for current billing period
 */
export const getTeamUsageBreakdown = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error("Team not found");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    // Get billing window from user (primary source)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    const { start, end } = getBillingWindow(user ?? team);

    const usage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) =>
        q.and(
          q.gte(q.field("_creationTime"), start),
          q.lte(q.field("_creationTime"), end)
        )
      )
      .collect();

    const totals = usage.reduce(
      (acc, record) => {
        const feature =
          record.feature ||
          (record.requestType === "chat" ? "assistant" : "other");
        acc.totalTokens += record.totalTokens;
        acc.totalInputTokens += record.inputTokens;
        acc.totalOutputTokens += record.outputTokens;
        acc.byFeature[feature] = (acc.byFeature[feature] || 0) + record.totalTokens;
        return acc;
      },
      {
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        byFeature: {
          assistant: 0,
          visualizations: 0,
          other: 0,
        } as Record<string, number>,
      }
    );

    const inputCostUSD = (totals.totalInputTokens / 1_000_000) * AI_INPUT_COST_PER_1M;
    const outputCostUSD = (totals.totalOutputTokens / 1_000_000) * AI_OUTPUT_COST_PER_1M;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    const totalCostCents = Math.round(totalCostUSD * 100);

    return {
      periodStart: start,
      periodEnd: end,
      totalTokens: totals.totalTokens,
      totalInputTokens: totals.totalInputTokens,
      totalOutputTokens: totals.totalOutputTokens,
      inputCostUSD,
      outputCostUSD,
      totalCostUSD,
      totalCostCents,
      byFeature: totals.byFeature,
    };
  },
});
