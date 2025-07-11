import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const addProjectEmbedding = internalMutation({
    args: {
        projectId: v.id("projects"),
        embedding: v.array(v.float64()),
        text: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("projectEmbeddings", {
            projectId: args.projectId,
            embedding: args.embedding,
            text: args.text,
        });
    },
});

export const getEmbeddingText = internalQuery({
    args: {
        id: v.id("projectEmbeddings"),
    },
    handler: async (ctx, args): Promise<string> => {
        const embedding = await ctx.db.get(args.id);
        return embedding?.text ?? "";
    },
}); 