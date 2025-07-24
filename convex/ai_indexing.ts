"use node";
import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { rag } from "./rag";

type IndexResult = { success: boolean; message: string };

export const indexProject = internalAction({
    args: {
        projectId: v.id("projects"),
    },
    returns: v.object({ success: v.boolean(), message: v.string() }),
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

        const namespace = project._id.toString();
        
        // Clear existing RAG data for this project (re-indexing)
        try {
            const existingEntries = await rag.list(ctx, { 
                paginationOpts: { cursor: null, numItems: 1000 }
            });
            
            // Filter entries for this project's namespace
            const projectEntries = existingEntries.page.filter(entry => 
                entry.metadata?.projectId === project._id.toString()
            );
            
            for (const entry of projectEntries) {
                await rag.delete(ctx, { entryId: entry.entryId });
            }
        } catch (error) {
            console.log("No existing entries to clear:", error);
        }

        try {
            // 1. Index Project Name and Description
            const projectText = `Project Name: ${project.name}\nProject Description: ${project.description}`;
            await rag.add(ctx, {
                namespace,
                text: projectText,
                metadata: {
                    type: "project",
                    projectId: project._id,
                    title: project.name,
                }
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

                await rag.add(ctx, {
                    namespace,
                    text: taskText,
                    metadata: {
                        type: "task",
                        projectId: project._id,
                        taskId: task._id,
                        title: task.title,
                        status: task.status,
                        priority: task.priority || "medium",
                    }
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
                
                await rag.add(ctx, {
                    namespace,
                    text: itemText,
                    metadata: {
                        type: "shopping_item",
                        projectId: project._id,
                        itemId: item._id,
                        title: item.name,
                        status: item.realizationStatus,
                        priority: item.priority || "medium",
                    }
                });
            }

            // 4. Index team members
            const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersForIndexing, { projectId: args.projectId });
            for (const member of teamMembers) {
                const memberText = `Team Member: User ID ${member.clerkUserId} (${member.role})`;
                await rag.add(ctx, {
                    namespace,
                    text: memberText,
                    metadata: {
                        type: "team_member",
                        projectId: project._id,
                        userId: member.clerkUserId,
                        role: member.role,
                    }
                });
            }

            // 5. Index surveys
            const surveys = await ctx.runQuery(internal.surveys.getSurveysForIndexing, { projectId: args.projectId });
            for (const survey of surveys) {
                const surveyFields = {
                    Title: survey.title,
                    Description: survey.description,
                    Status: survey.status,
                    "Target Audience": survey.targetAudience,
                    "Is Required": survey.isRequired ? "Yes" : "No",
                    "Allow Multiple Responses": survey.allowMultipleResponses ? "Yes" : "No",
                    "Start Date": survey.startDate ? new Date(survey.startDate).toLocaleDateString() : undefined,
                    "End Date": survey.endDate ? new Date(survey.endDate).toLocaleDateString() : undefined,
                    "Created At": new Date(survey._creationTime).toLocaleDateString(),
                };
                const surveyText = "Survey Context: \n" + Object.entries(surveyFields)
                    .filter(([, value]) => value)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n");

                await rag.add(ctx, {
                    namespace,
                    text: surveyText,
                    metadata: {
                        type: "survey",
                        projectId: project._id,
                        surveyId: survey._id,
                        title: survey.title,
                        status: survey.status,
                        targetAudience: survey.targetAudience,
                    }
                });
            }

            // 6. Index survey responses with answers
            const surveyResponses = await ctx.runQuery(internal.surveys.getSurveyResponsesForIndexing, { projectId: args.projectId });
            for (const response of surveyResponses) {
                const responseFields = {
                    "Survey Title": response.surveyTitle,
                    "Respondent": response.respondentId,
                    "Response Date": new Date(response._creationTime).toLocaleDateString(),
                    "Is Complete": response.isComplete ? "Yes" : "No",
                    "Answers": response.answers.map((answer: any) => {
                        let answerText = `Q: ${answer.questionText}\nA: `;
                        
                        if (answer.answerType === "text") {
                            answerText += answer.textAnswer;
                        } else if (answer.answerType === "choice") {
                            answerText += answer.choiceAnswers?.join(", ");
                        } else if (answer.answerType === "rating") {
                            answerText += `${answer.ratingAnswer}/5`;
                        } else if (answer.answerType === "boolean") {
                            answerText += answer.booleanAnswer ? "Yes" : "No";
                        } else if (answer.answerType === "number") {
                            answerText += answer.numberAnswer;
                        }
                        
                        return answerText;
                    }).join("\n---\n"),
                };
                
                const responseText = "Survey Response Context: \n" + Object.entries(responseFields)
                    .filter(([, value]) => value)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n");

                await rag.add(ctx, {
                    namespace,
                    text: responseText,
                    metadata: {
                        type: "survey_response",
                        projectId: project._id,
                        surveyId: response.surveyId,
                        responseId: response._id,
                        title: `Response to ${response.surveyTitle}`,
                        respondentId: response.respondentId,
                        isComplete: response.isComplete,
                    }
                });
            }

            const totalItems = 1 + tasks.length + shoppingListItems.length + teamMembers.length + surveys.length + surveyResponses.length;
            
            await ctx.runMutation(internal.projects.updateProjectIndexingStatus, {
                projectId: args.projectId,
                status: "done",
            });

            await ctx.runMutation(internal.projects.updateProjectIndexingMetadata, {
                projectId: args.projectId,
                lastIndexedAt: Date.now(),
                indexedItemsCount: totalItems,
            });

            const successMessage: string = `Indexed project ${project.name}, ${tasks.length} tasks, ${shoppingListItems.length} shopping items, ${teamMembers.length} team members, and ${surveys.length} surveys. Total: ${totalItems} items.`;
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

export const resetIndexingStatus = action({
    args: {
        projectId: v.id("projects"),
    },
    returns: v.object({ success: v.boolean(), message: v.string() }),
    handler: async (ctx, args): Promise<IndexResult> => {
        await ctx.runMutation(internal.projects.updateProjectIndexingStatus, {
            projectId: args.projectId,
            status: "idle",
        });
        return { success: true, message: "Indexing status reset to idle" };
    },
});

export const getIndexingStatus = action({
    args: {
        projectId: v.id("projects"),
    },
    returns: v.union(v.string(), v.null()),
    handler: async (ctx, args): Promise<string | null> => {
        const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
        return project?.aiIndexingStatus || null;
    },
});

export const resetAllStuckIndexing = action({
    args: {
        clerkOrgId: v.string(),
    },
    returns: v.object({ success: v.boolean(), message: v.string(), resetCount: v.number() }),
    handler: async (ctx, args): Promise<{ success: boolean; message: string; resetCount: number }> => {
        // Find projects stuck in indexing status for more than 10 minutes
        const projects = await ctx.runQuery(api.projects.listProjectsByClerkOrg, { clerkOrgId: args.clerkOrgId });
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        
        const stuckProjects = projects.filter((p: Doc<"projects">) => 
            p.aiIndexingStatus === "indexing" && 
            p._creationTime < tenMinutesAgo
        );
        
        let resetCount = 0;
        
        for (const project of stuckProjects) {
            await ctx.runMutation(internal.projects.updateProjectIndexingStatus, {
                projectId: project._id,
                status: "idle",
            });
            resetCount++;
        }
        
        return { 
            success: true, 
            message: `Reset ${resetCount} stuck indexing processes`, 
            resetCount 
        };
    },
});

// ====== INCREMENTAL INDEXING FUNCTIONS ======

export const indexSingleTask = internalAction({
    args: {
        taskId: v.id("tasks"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const task = await ctx.runQuery(internal.tasks.getTaskById, { taskId: args.taskId });
        if (!task) return;

        const namespace = args.projectId.toString();
        
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

        await rag.add(ctx, {
            namespace,
            text: taskText,
            metadata: {
                type: "task",
                projectId: args.projectId,
                taskId: args.taskId,
                title: task.title,
                status: task.status,
                priority: task.priority || "medium",
            }
        });
    },
});

export const removeSingleTask = internalAction({
    args: {
        taskId: v.id("tasks"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        // Find and remove the task from RAG
        const existingEntries = await rag.list(ctx, { 
            paginationOpts: { cursor: null, numItems: 1000 }
        });
        
        const taskEntries = existingEntries.page.filter(entry => 
            entry.metadata?.projectId === args.projectId.toString() &&
            entry.metadata?.type === "task" &&
            entry.metadata?.taskId === args.taskId.toString()
        );
        
        for (const entry of taskEntries) {
            await rag.delete(ctx, { entryId: entry.entryId });
        }
    },
});

export const indexSingleShoppingItem = internalAction({
    args: {
        itemId: v.id("shoppingListItems"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const item = await ctx.runQuery(internal.shopping.getShoppingItemById, { itemId: args.itemId });
        if (!item) return;

        const namespace = args.projectId.toString();
        
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

        await rag.add(ctx, {
            namespace,
            text: itemText,
            metadata: {
                type: "shopping_item",
                projectId: args.projectId,
                itemId: args.itemId,
                title: item.name,
                status: item.realizationStatus,
                priority: item.priority || "medium",
            }
        });
    },
});

export const removeSingleShoppingItem = internalAction({
    args: {
        itemId: v.id("shoppingListItems"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const existingEntries = await rag.list(ctx, { 
            paginationOpts: { cursor: null, numItems: 1000 }
        });
        
        const itemEntries = existingEntries.page.filter(entry => 
            entry.metadata?.projectId === args.projectId.toString() &&
            entry.metadata?.type === "shopping_item" &&
            entry.metadata?.itemId === args.itemId.toString()
        );
        
        for (const entry of itemEntries) {
            await rag.delete(ctx, { entryId: entry.entryId });
        }
    },
});

export const indexSingleSurvey = internalAction({
    args: {
        surveyId: v.id("surveys"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const survey = await ctx.runQuery(internal.surveys.getSurveyById, { surveyId: args.surveyId });
        if (!survey) return;

        const namespace = args.projectId.toString();
        
        const surveyFields = {
            Title: survey.title,
            Description: survey.description,
            Status: survey.status,
            "Target Audience": survey.targetAudience,
            "Is Required": survey.isRequired ? "Yes" : "No",
            "Allow Multiple Responses": survey.allowMultipleResponses ? "Yes" : "No",
            "Start Date": survey.startDate ? new Date(survey.startDate).toLocaleDateString() : undefined,
            "End Date": survey.endDate ? new Date(survey.endDate).toLocaleDateString() : undefined,
            "Created At": new Date(survey._creationTime).toLocaleDateString(),
        };
        
        const surveyText = "Survey Context: \n" + Object.entries(surveyFields)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\n");

        await rag.add(ctx, {
            namespace,
            text: surveyText,
            metadata: {
                type: "survey",
                projectId: args.projectId,
                surveyId: args.surveyId,
                title: survey.title,
                status: survey.status,
                targetAudience: survey.targetAudience,
            }
        });
    },
});

export const removeSingleSurvey = internalAction({
    args: {
        surveyId: v.id("surveys"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const existingEntries = await rag.list(ctx, { 
            paginationOpts: { cursor: null, numItems: 1000 }
        });
        
        const surveyEntries = existingEntries.page.filter(entry => 
            entry.metadata?.projectId === args.projectId.toString() &&
            entry.metadata?.type === "survey" &&
            entry.metadata?.surveyId === args.surveyId.toString()
        );
        
        for (const entry of surveyEntries) {
            await rag.delete(ctx, { entryId: entry.entryId });
        }
    },
});

// ====== FILE INDEXING ======

export const indexSingleFile = internalAction({
    args: {
        fileId: v.id("files"),
        projectId: v.id("projects"),
        extractedText: v.string(),
    },
    handler: async (ctx, args) => {
        const file = await ctx.runQuery(api.files.getFileById, { fileId: args.fileId });
        if (!file) return;

        const namespace = args.projectId.toString();
        
        const fileText = `File: ${file.name}\nType: ${file.mimeType}\nContent: ${args.extractedText}`;

        await rag.add(ctx, {
            namespace,
            text: fileText,
            metadata: {
                type: "file",
                projectId: args.projectId,
                fileId: args.fileId,
                title: file.name,
                mimeType: file.mimeType,
                fileType: file.fileType,
            }
        });
    },
});

export const removeSingleFile = internalAction({
    args: {
        fileId: v.id("files"),
        projectId: v.id("projects"),
    },
    handler: async (ctx, args) => {
        const existingEntries = await rag.list(ctx, { 
            paginationOpts: { cursor: null, numItems: 1000 }
        });
        
        const fileEntries = existingEntries.page.filter(entry => 
            entry.metadata?.projectId === args.projectId.toString() &&
            entry.metadata?.type === "file" &&
            entry.metadata?.fileId === args.fileId.toString()
        );
        
        for (const entry of fileEntries) {
            await rag.delete(ctx, { entryId: entry.entryId });
        }
    },
});

// ====== SMART INCREMENTAL UPDATE ======

export const updateAIKnowledge = action({
    args: { projectId: v.id("projects") },
    returns: v.object({
        updatedTasks: v.number(),
        updatedItems: v.number(),
        updatedSurveys: v.number(),
        message: v.string(),
    }),
    handler: async (ctx, args) => {
        // 🔒 CHECK SUBSCRIPTION: AI features require Pro+ subscription
        const subscriptionCheck = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
            projectId: args.projectId 
        });
        
        if (!subscriptionCheck.allowed) {
            throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI knowledge updates.");
        }

        const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
        if (!project) {
            throw new Error("Project not found.");
        }
        if (!project.aiLastIndexedAt) {
            throw new Error("Project needs full indexing first. Use 'Index Project' button.");
        }

        const lastIndexed = project.aiLastIndexedAt;
        let updatedCount = { tasks: 0, items: 0, surveys: 0 };

        // 1. Update changed tasks
        const changedTasks = await ctx.runQuery(internal.tasks.getTasksChangedAfter, { 
            projectId: args.projectId, 
            since: lastIndexed 
        });
        
        for (const task of changedTasks) {
            await ctx.runAction(internal.ai_indexing.indexSingleTask, {
                taskId: task._id,
                projectId: args.projectId
            });
        }
        updatedCount.tasks = changedTasks.length;

        // 2. Update changed shopping items  
        const changedItems = await ctx.runQuery(internal.shopping.getItemsChangedAfter, {
            projectId: args.projectId,
            since: lastIndexed
        });
        
        for (const item of changedItems) {
            await ctx.runAction(internal.ai_indexing.indexSingleShoppingItem, {
                itemId: item._id,
                projectId: args.projectId
            });
        }
        updatedCount.items = changedItems.length;

        // 3. Update changed surveys
        const changedSurveys = await ctx.runQuery(internal.surveys.getSurveysChangedAfter, {
            projectId: args.projectId,
            since: lastIndexed
        });
        
        for (const survey of changedSurveys) {
            await ctx.runAction(internal.ai_indexing.indexSingleSurvey, {
                surveyId: survey._id,
                projectId: args.projectId
            });
        }
        updatedCount.surveys = changedSurveys.length;

        const totalUpdated = updatedCount.tasks + updatedCount.items + updatedCount.surveys;

        // 4. Update timestamp
        await ctx.runMutation(internal.projects.updateProjectIndexingMetadata, {
            projectId: args.projectId,
            lastIndexedAt: Date.now(),
            indexedItemsCount: totalUpdated
        });
        
        return { 
            updatedTasks: updatedCount.tasks,
            updatedItems: updatedCount.items,
            updatedSurveys: updatedCount.surveys,
            message: totalUpdated > 0 
                ? `Updated ${totalUpdated} items in AI knowledge base`
                : "No changes detected since last update"
        };
    },
});