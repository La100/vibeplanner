import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

type IndexResult = { success: boolean; message: string };

// Main entry point for AI indexing
export const initIndex = action({
    args: {
        projectId: v.id("projects"),
    },
    returns: v.object({ success: v.boolean(), message: v.string() }),
    handler: async (ctx, args): Promise<IndexResult> => {
        // 🔒 CHECK SUBSCRIPTION: AI features require Pro+ subscription
        const subscriptionCheck = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
            projectId: args.projectId 
        });
        
        if (!subscriptionCheck.allowed) {
            return {
                success: false,
                message: subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI indexing."
            };
        }

        return await ctx.runAction(internal.ai_indexing.indexProject, {
            projectId: args.projectId,
        });
    },
});

// Re-export key functions for backwards compatibility
export { 
    createThread,
    chat,
    chatWithThread,
    simpleChat,
    getThreadHistory,
    deleteThread,
    listThreads,
    refreshThreadContext 
} from "./ai_agent_simple";
export { 
    updateAIKnowledge,
    resetIndexingStatus,
    getIndexingStatus,
    resetAllStuckIndexing 
} from "./ai_indexing";

