"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { rag } from "./rag";
import OpenAI from "openai";
import { Id } from "./_generated/dataModel";


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Define a type for chat messages
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// Database functions for persistent thread storage
const getThreadFromDB = async (ctx: ActionCtx, threadId: string): Promise<ChatMessage[]> => {
  const messages = await ctx.runQuery(internal.ai_database.getThreadMessages, { threadId });
  return messages.map((msg: { role: "user" | "assistant" | "system", content: string }) => ({
    role: msg.role,
    content: msg.content,
  }));
};

const saveThreadToDB = async (ctx: ActionCtx, threadId: string, messages: ChatMessage[], projectId: Id<"projects">, userClerkId: string) => {
  await ctx.runMutation(internal.ai_database.saveThreadMessages, {
    threadId,
    messages,
    projectId,
    userClerkId,
  });
};

// Get project context for the agent
async function getProjectContext(ctx: ActionCtx, projectId: Id<"projects">): Promise<string> {
  const project = await ctx.runQuery(api.projects.getProject, { projectId });
  if (!project) {
    throw new Error("Project not found");
  }

  // --- PRECISE DATA FETCHING ---
  const tasks = await ctx.runQuery(api.tasks.listProjectTasks, { projectId });
  const shoppingList = await ctx.runQuery(api.shopping.listShoppingListItems, { projectId });
  const surveys = await ctx.runQuery(api.surveys.getSurveysByProject, { projectId });
  const surveyResponses = await ctx.runQuery(internal.surveys.getSurveyResponsesForIndexing, { projectId });
  const projectContent = await ctx.runQuery(api.files.getProjectContent, { projectId });
  const files = projectContent.files;

  // --- CONTEXT FORMATTING ---
  let dataContext = "";

  if (tasks.length > 0) {
    dataContext += `\nTASKS (${tasks.length} total):\n`;
    tasks.forEach(task => {
      const taskDetails = [
        `[${task.status.toUpperCase()}] "${task.title}"`,
        task.assignedToName ? `Assigned: ${task.assignedToName}` : 'Unassigned',
        task.priority ? `Priority: ${task.priority}` : 'No priority',
        task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : 'No deadline',
        task.cost ? `Cost: $${task.cost}` : null,
        task.tags && task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : null
      ].filter(Boolean).join(', ');
      
      dataContext += `- ${taskDetails}\n`;
      
      if (task.description) {
        dataContext += `  Description: ${task.description}\n`;
      }
      if (task.content) {
        dataContext += `  Details: ${task.content.replace(/<[^>]*>/g, '').substring(0, 200)}${task.content.length > 200 ? '...' : ''}\n`;
      }
    });
  }

  if (shoppingList.length > 0) {
    dataContext += `\nSHOPPING LIST (${shoppingList.length} total):\n`;
    shoppingList.forEach(item => {
      const itemDetails = [
        `"${item.name}"`,
        `Qty: ${item.quantity}`,
        `Status: ${item.realizationStatus}`,
        item.priority ? `Priority: ${item.priority}` : null,
        item.category ? `Category: ${item.category}` : null,
        item.supplier ? `Supplier: ${item.supplier}` : null,
        item.catalogNumber ? `Cat#: ${item.catalogNumber}` : null,
        item.dimensions ? `Dimensions: ${item.dimensions}` : null,
        item.unitPrice ? `Unit: $${item.unitPrice}` : null,
        item.totalPrice ? `Total: $${item.totalPrice}` : null,
        item.buyBefore ? `Buy by: ${new Date(item.buyBefore).toLocaleDateString()}` : null,
        item.notes ? `Notes: ${item.notes}` : null
      ].filter(Boolean).join(', ');
      
      dataContext += `- ${itemDetails}\n`;
    });
  }

  if (surveys.length > 0) {
    dataContext += `\nSURVEYS (${surveys.length} total):\n`;
    surveys.forEach(survey => {
      dataContext += `- ${survey.title} (Status: ${survey.status}, Target: ${survey.targetAudience})\n`;
    });
  }

  if (surveyResponses.length > 0) {
    dataContext += `\nSURVEY RESPONSES (${surveyResponses.length} total):\n`;
    surveyResponses.forEach((response: any) => {
      dataContext += `- Survey: "${response.surveyTitle}" | Respondent: ${response.respondentId} | Complete: ${response.isComplete ? 'Yes' : 'No'}\n`;
      if (response.answers && response.answers.length > 0) {
        response.answers.forEach((answer: any) => {
          let answerText = '';
          if (answer.answerType === "text") {
            answerText = answer.textAnswer;
          } else if (answer.answerType === "choice") {
            answerText = answer.choiceAnswers?.join(", ");
          } else if (answer.answerType === "rating") {
            answerText = `${answer.ratingAnswer}/5`;
          } else if (answer.answerType === "boolean") {
            answerText = answer.booleanAnswer ? "Yes" : "No";
          } else if (answer.answerType === "number") {
            answerText = answer.numberAnswer;
          }
          dataContext += `  Q: ${answer.questionText}\n  A: ${answerText}\n`;
        });
      }
    });
  }

  if (files.length > 0) {
    dataContext += `\nFILES (${files.length} total):\n`;
    files.forEach(file => {
      dataContext += `- ${file.name} (Type: ${file.mimeType}, Size: ${(file.size / 1024).toFixed(2)} KB)\n`;
    });
  }

  if (dataContext === "") {
    dataContext = "No tasks, shopping list items, or surveys found for this project.";
  }

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return `You are an AI assistant for VibePlanner - a comprehensive project management platform for interior design teams and their clients.\n\nPROJECT CONTEXT:\n- Date: ${currentDate}\n- Project: "${project.name}" (${project.status})\n- Customer: ${project.customer || 'Not specified'}\n- Location: ${project.location || 'Not specified'}\n- Budget: ${project.budget ? `${project.budget} ${project.currency || 'USD'}` : 'Not specified'}\n\nAVAILABLE PROJECT DATA:\n${dataContext}\n\nINSTRUCTIONS:\n1. **Focus on interior design workflows.** Help with space planning, material selection, procurement, client communication, and project coordination.\n2. **Answer based ONLY on the AVAILABLE PROJECT DATA.** Do not invent or assume information about products, suppliers, or project details.\n3. **Be specific and actionable.** When asked about numbers, provide exact counts. For shopping items, include supplier info, catalog numbers, and pricing when available.\n4. **Use the actual project data.** Reference specific tasks, furniture/materials, client feedback from surveys, and project timelines.\n5. **Be design-focused and professional.** Understand interior design terminology, procurement processes, and client relationship management.\n\nAnswer questions using the project data above. Help optimize interior design workflows and client satisfaction.`;
}

// Start a new conversation thread
export const createThread = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // 🔒 CHECK SUBSCRIPTION: AI features require Pro+ subscription
    const subscriptionCheck = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
      projectId: args.projectId 
    });
    
    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI assistant.");
    }

    const systemPrompt = await getProjectContext(ctx, args.projectId);
    
    // Create a unique thread ID
    const threadId = `thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
    
    // Save thread to database
    await ctx.runMutation(internal.ai_database.createThreadInDB, {
      threadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
      systemPrompt
    });

    return threadId;
  },
});

// Chat with optional threadId - creates new thread if not provided
export const chat = action({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Get fresh project context
    const systemPrompt = await getProjectContext(ctx, args.projectId);
    
    // Get or create thread
    let threadId = args.threadId;
    if (!threadId) {
      // Create new thread
      threadId = `thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
      await ctx.runMutation(internal.ai_database.createThreadInDB, {
        threadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
        systemPrompt
      });
    }
    
    // Get thread history from database
    let messages: ChatMessage[] = await getThreadFromDB(ctx, threadId);
    
    // Update system message with fresh context
    messages = [{ role: "system", content: systemPrompt }, ...messages.filter(m => m.role !== "system")];
    
    // Add user message
    messages.push({ role: "user", content: args.message });
    
    // Generate response
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
    });
    
    const assistantMessage = response.choices[0].message.content || "";
    
    // Add assistant response to thread
    messages.push({ role: "assistant", content: assistantMessage });
    
    // Save updated thread to database
    await saveThreadToDB(ctx, threadId, messages, args.projectId, args.userClerkId);
    
    return assistantMessage;
  },
});

// Chat with full response object (response + threadId)
export const chatWithThread = action({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args): Promise<{response: string, threadId: string}> => {
    // 🔒 CHECK SUBSCRIPTION: AI features require Pro+ subscription
    const subscriptionCheck = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
      projectId: args.projectId 
    });
    
    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription. Please upgrade your plan to use AI assistant.");
    }

    const systemPrompt = await getProjectContext(ctx, args.projectId);
    
    let threadId = args.threadId;
    if (!threadId) {
      threadId = `thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
      await ctx.runMutation(internal.ai_database.createThreadInDB, {
        threadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
        systemPrompt
      });
    }
    
    let messages: ChatMessage[] = await getThreadFromDB(ctx, threadId);
    messages = [{ role: "system", content: systemPrompt }, ...messages.filter(m => m.role !== "system")];
    
    // Add user message
    messages.push({ role: "user", content: args.message });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      max_tokens: 4000,
    });
    
    const assistantMessage = response.choices[0].message.content || "";
    messages.push({ role: "assistant", content: assistantMessage });
    await saveThreadToDB(ctx, threadId, messages, args.projectId, args.userClerkId);
    
    return {
      response: assistantMessage,
      threadId: threadId,
    };
  },
});

// Simple chat function for backwards compatibility
export const simpleChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const systemPrompt = await getProjectContext(ctx, args.projectId);
    
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: args.message }
    ];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
    });
    
    return response.choices[0].message.content || "";
  },
});

// Get conversation history
export const getThreadHistory = action({
  args: {
    threadId: v.string(),
  },
  returns: v.array(v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
  })),
  handler: async (ctx, args): Promise<{ role: "user" | "assistant"; content: string; timestamp: number; }[]> => {
    const messages = await getThreadFromDB(ctx, args.threadId);

    return messages
      .filter((msg): msg is ChatMessage & { role: "user" | "assistant" } => msg.role !== "system")
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: Date.now(),
      }));
  },
});

// Delete a conversation thread
export const deleteThread = action({
  args: {
    threadId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    await ctx.runMutation(internal.ai_database.deleteThreadFromDB, {
      threadId: args.threadId
    });
    return true;
  },
});

// List all threads for a project
export const listThreads = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.array(v.object({
    threadId: v.string(),
    title: v.optional(v.string()),
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })),
  handler: async (ctx, args): Promise<{ threadId: string; title?: string; createdAt: number; lastMessageAt?: number; }[]> => {
    const threads = await ctx.runQuery(internal.ai_database.getThreadsForProject, {
      projectId: args.projectId,
      userClerkId: args.userClerkId
    });
    return threads;
  },
});

// Update project context in existing thread
export const refreshThreadContext = action({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const systemPrompt = await getProjectContext(ctx, args.projectId);
    const messages = await getThreadFromDB(ctx, args.threadId);
    
    // Update system message
    const updatedMessages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages.filter(m => m.role !== "system")];
    
    // Get thread info for saving
    const threadInfo = await ctx.runQuery(internal.ai_database.getThreadInfo, {
      threadId: args.threadId
    });
    
    if (threadInfo) {
      await saveThreadToDB(ctx, args.threadId, updatedMessages, threadInfo.projectId, threadInfo.userClerkId);
    }
    
    return true;
  },
});

