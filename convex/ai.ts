"use node";
import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { Doc, Id } from "./_generated/dataModel";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type IndexResult = { success: boolean; message: string };

export const indexProject = internalAction({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args): Promise<IndexResult> => {
        const project: Doc<"projects"> | null = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
        if (!project) {
            const message = "Project not found for indexing";
            console.error(message, args.projectId);
            return { success: false, message };
        }

        await ctx.runMutation(internal.projects.updateProjectIndexingStatus, {
            projectId: args.projectId,
            status: "indexing",
        });

        try {
            // 1. Index Project Name and Description
            const projectText = `Project Name: ${project.name}\nProject Description: ${project.description}`;
            let embedding = await getEmbedding(projectText);
            await ctx.runMutation(internal.ai_v8.addProjectEmbedding, {
                projectId: project._id,
                embedding: embedding,
                text: projectText,
            });

            // 2. Index all tasks in the project
            const tasks: Doc<"tasks">[] = await ctx.runQuery(internal.tasks.getTasksForIndexing, { projectId: args.projectId });

            for (const task of tasks) {
                const taskFields = {
                    Title: task.title,
                    Description: task.description,
                    Status: task.status,
                    Priority: task.priority,
                    "Due Date": task.dueDate ? new Date(task.dueDate).toLocaleDateString() : undefined,
                    Tags: task.tags?.join(", "),
                    "Created At": new Date(task._creationTime).toLocaleDateString(),
                };
                const taskText = "Task Context: \n" + Object.entries(taskFields)
                    .filter(([, value]) => value)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n");

                embedding = await getEmbedding(taskText);
                await ctx.runMutation(internal.ai_v8.addProjectEmbedding, {
                    projectId: project._id,
                    embedding: embedding,
                    text: taskText,
                });
            }

            // 3. Index shopping list items
            const shoppingListItems = await ctx.runQuery(internal.shopping.getShoppingListForIndexing, { projectId: args.projectId });
            for (const item of shoppingListItems) {
                const itemFields = {
                    Name: item.name,
                    Quantity: item.quantity,
                    "Unit Price": item.unitPrice,
                    "Total Price": item.totalPrice,
                    Supplier: item.supplier,
                    "Catalog Number": item.catalogNumber,
                    Category: item.category,
                    Notes: item.notes,
                    Status: item.realizationStatus,
                    Priority: item.priority,
                    "Buy Before": item.buyBefore ? new Date(item.buyBefore).toLocaleDateString() : undefined,
                    "Created At": new Date(item._creationTime).toLocaleDateString(),
                };
                const itemText = "Shopping List Item Context: \n" + Object.entries(itemFields)
                    .filter(([, value]) => value)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n");
                embedding = await getEmbedding(itemText);
                await ctx.runMutation(internal.ai_v8.addProjectEmbedding, { projectId: project._id, embedding: embedding, text: itemText });
            }

            // 4. Index team members
            const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersForIndexing, { projectId: args.projectId });
            for (const member of teamMembers) {
                const memberText = `Team Member: User ID ${member.clerkUserId} (${member.role})`;
                embedding = await getEmbedding(memberText);
                await ctx.runMutation(internal.ai_v8.addProjectEmbedding, { projectId: project._id, embedding: embedding, text: memberText });
            }

            await ctx.runMutation(internal.projects.updateProjectIndexingStatus, {
                projectId: args.projectId,
                status: "done",
            });

            const successMessage: string = `Indexed project ${project.name}, ${tasks.length} tasks, ${shoppingListItems.length} shopping items, and ${teamMembers.length} team members.`;
            console.log(successMessage);
            return { success: true, message: successMessage };

        } catch (error) {
            console.error("Indexing failed:", error);
            await ctx.runMutation(internal.projects.updateProjectIndexingStatus, {
                projectId: args.projectId,
                status: "idle",
            });
            return { success: false, message: "Indexing failed. Please try again." };
        }
    },
});

export const initIndex = action({
    args: {
        projectId: v.id("projects"),
    },
    handler: async (ctx, args): Promise<IndexResult> => {
        return await ctx.runAction(internal.ai.indexProject, {
            projectId: args.projectId,
        });
    },
});

export const chat = action({
    args: {
        projectId: v.id("projects"),
        message: v.string(),
    },
    handler: async (ctx, args): Promise<string | null> => {
        const embedding = await getEmbedding(args.message);

        const searchResults = await ctx.vectorSearch("projectEmbeddings", "by_embedding", {
            vector: embedding,
            limit: 256,
            filter: (q) => q.eq("projectId", args.projectId),
        });

        const context: string = (await Promise.all(
            searchResults.map(async (result) => ctx.runQuery(internal.ai_v8.getEmbeddingText, { id: result._id }))
        )).join("\n---\n");

        const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const prompt: string = `
        You are an AI assistant for the project management tool VibePlanner.
        The current date is ${currentDate}.
        You are helping a user with their project.
        The user's question is: "${args.message}"
        Here is some context from the project that might be relevant:
        ---
        ${context}
        ---
        Based on the context, please provide a helpful response.
        If the context is not relevant, try to answer the question to the best of your ability,
        but mention that you couldn't find relevant information in the project.
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
        });

        return response.choices[0].message.content;
    },
});


async function getEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 256,
    });
    return response.data[0].embedding;
}

