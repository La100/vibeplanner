"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Id } from "./_generated/dataModel";

// Validate API key
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Build MEGA context for 1M context window - load ALL project data
async function buildFullProjectContext(ctx: any, projectId: Id<"projects">): Promise<{systemPrompt: string, megaContext: string}> {
  const project = await ctx.runQuery(api.projects.getProject, { projectId });
  if (!project) {
    throw new Error("Project not found");
  }

  // Get ALL project data - no truncation, full content
  let tasks: any[] = [];
  let shoppingList: any[] = [];
  let surveys: any[] = [];
  let surveyResponses: any[] = [];
  let files: any[] = [];
  let notes: any[] = [];
  let teamMembers: any[] = [];
  let fileContents: any[] = [];

  try {
    tasks = await ctx.runQuery(api.tasks.listProjectTasks, { projectId }) || [];
  } catch (error) {
    console.warn("Error fetching tasks:", error);
  }

  try {
    shoppingList = await ctx.runQuery(api.shopping.listShoppingListItems, { projectId }) || [];
  } catch (error) {
    console.warn("Error fetching shopping list:", error);
  }

  try {
    surveys = await ctx.runQuery(api.surveys.getSurveysByProject, { projectId }) || [];
  } catch (error) {
    console.warn("Error fetching surveys:", error);
  }

  try {
    surveyResponses = await ctx.runQuery(internal.surveys.getSurveyResponsesForIndexing, { projectId }) || [];
  } catch (error) {
    console.warn("Error fetching survey responses:", error);
  }

  try {
    const projectContent = await ctx.runQuery(api.files.getProjectContent, { projectId });
    files = projectContent?.files || [];
    // Get full file contents if available
    for (const file of files) {
      try {
        let content = "";
        if (file.extractedText) {
          content += file.extractedText;
        }
        if (file.pdfAnalysis) {
          content += content ? "\n\nPDF ANALYSIS:\n" + file.pdfAnalysis : file.pdfAnalysis;
        }
        if (content) {
          fileContents.push({
            ...file,
            fullContent: content
          });
        }
      } catch (error) {
        console.warn(`Error fetching content for file ${file.name}:`, error);
      }
    }
  } catch (error) {
    console.warn("Error fetching files:", error);
  }

  try {
    notes = await ctx.runQuery(internal.notes.getNotesForIndexing, { projectId }) || [];
  } catch (error) {
    console.warn("Error fetching notes:", error);
  }

  try {
    teamMembers = await ctx.runQuery(internal.teams.getTeamMembersForIndexing, { projectId }) || [];
  } catch (error) {
    console.warn("Error fetching team members:", error);
  }

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Build MEGA context - utilize full 1M tokens
  const megaContext = `# VIBEPLANNER PROJECT KNOWLEDGE BASE
## Current Date: ${currentDate}

## PROJECT OVERVIEW
- **Project Name**: "${project.name}"
- **Status**: ${project.status}
- **Customer**: ${project.customer || 'Not specified'}
- **Location**: ${project.location || 'Not specified'} 
- **Budget**: ${project.budget ? `${project.budget} ${project.currency || 'USD'}` : 'Not specified'}
- **Description**: ${project.description || 'No description provided'}
- **Created**: ${new Date(project._creationTime).toLocaleDateString()}
- **Last Updated**: ${new Date(project.updatedAt || project._creationTime).toLocaleDateString()}

## COMPLETE TASKS DATABASE (${tasks.length} tasks)
${tasks.length > 0 ? tasks.map((task: any) => `
### TASK: "${task.title}" [ID: ${task._id}]
- **Status**: ${task.status.toUpperCase()}
- **Priority**: ${task.priority || 'Not set'}
- **Assigned To**: ${task.assignedToName || 'Unassigned'}
- **Due Date**: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
- **Cost**: ${task.cost ? `$${task.cost}` : 'Not specified'}
- **Tags**: ${task.tags && task.tags.length > 0 ? task.tags.join(', ') : 'None'}
- **Created**: ${new Date(task._creationTime).toLocaleDateString()}
- **Description**: ${task.description || 'No description'}
- **Full Content**: ${task.content ? task.content.replace(/<[^>]*>/g, '') : 'No additional content'}
- **Comments**: ${task.comments || 'No comments'}
`).join('\n') : 'No tasks found.'}

## COMPLETE SHOPPING LIST DATABASE (${shoppingList.length} items)
${shoppingList.length > 0 ? shoppingList.map((item: any) => `
### ITEM: "${item.name}" [ID: ${item._id}]
- **Quantity**: ${item.quantity}
- **Status**: ${item.realizationStatus}
- **Priority**: ${item.priority || 'Not set'}
- **Category**: ${item.category || 'Uncategorized'}
- **Supplier**: ${item.supplier || 'Not specified'}
- **Catalog Number**: ${item.catalogNumber || 'Not specified'}
- **Dimensions**: ${item.dimensions || 'Not specified'}
- **Unit Price**: ${item.unitPrice ? `$${item.unitPrice}` : 'Not specified'}
- **Total Price**: ${item.totalPrice ? `$${item.totalPrice}` : 'Not specified'}
- **Buy Before**: ${item.buyBefore ? new Date(item.buyBefore).toLocaleDateString() : 'No deadline'}
- **Notes**: ${item.notes || 'No notes'}
- **Created**: ${new Date(item._creationTime).toLocaleDateString()}
`).join('\n') : 'No shopping list items found.'}

## COMPLETE NOTES DATABASE (${notes.length} notes)
${notes.length > 0 ? notes.map((note: any) => `
### NOTE: "${note.title}" [ID: ${note._id}]
- **Created**: ${new Date(note.createdAt).toLocaleDateString()}
- **Last Updated**: ${new Date(note.updatedAt).toLocaleDateString()}
- **Full Content**: ${note.content ? note.content.replace(/<[^>]*>/g, '') : 'No content'}
`).join('\n') : 'No notes found.'}

## COMPLETE SURVEYS DATABASE (${surveys.length} surveys)
${surveys.length > 0 ? surveys.map((survey: any) => `
### SURVEY: "${survey.title}" [ID: ${survey._id}]
- **Status**: ${survey.status}
- **Description**: ${survey.description || 'No description'}
- **Target Audience**: ${survey.targetAudience}
- **Required**: ${survey.isRequired ? 'Yes' : 'No'}
- **Multiple Responses**: ${survey.allowMultipleResponses ? 'Allowed' : 'Not allowed'}
- **Start Date**: ${survey.startDate ? new Date(survey.startDate).toLocaleDateString() : 'Not set'}
- **End Date**: ${survey.endDate ? new Date(survey.endDate).toLocaleDateString() : 'Not set'}
- **Created**: ${new Date(survey._creationTime).toLocaleDateString()}
- **Questions**: ${survey.questions ? JSON.stringify(survey.questions, null, 2) : 'No questions'}
`).join('\n') : 'No surveys found.'}

## COMPLETE SURVEY RESPONSES DATABASE (${surveyResponses.length} responses)
${surveyResponses.length > 0 ? surveyResponses.map((response: any) => `
### RESPONSE TO: "${response.surveyTitle}" [ID: ${response._id}]
- **Respondent**: ${response.respondentId}
- **Date**: ${new Date(response._creationTime).toLocaleDateString()}
- **Complete**: ${response.isComplete ? 'Yes' : 'No'}
- **Detailed Answers**:
${response.answers && response.answers.length > 0 ? response.answers.map((answer: any) => {
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
  return `  Q: ${answer.questionText}\n  A: ${answerText}`;
}).join('\n') : '  No answers provided'}
`).join('\n') : 'No survey responses found.'}

## COMPLETE FILES DATABASE (${fileContents.length} files)
${fileContents.length > 0 ? fileContents.map((file: any) => `
### FILE: "${file.name}" [ID: ${file._id}]
- **Type**: ${file.mimeType}
- **Size**: ${(file.size / 1024).toFixed(2)} KB
- **Uploaded**: ${new Date(file._creationTime).toLocaleDateString()}
- **Full Extracted Content**: 
${file.fullContent || 'Content extraction not available'}
`).join('\n') : 'No files with content found.'}

## TEAM MEMBERS (${teamMembers.length} members)
${teamMembers.length > 0 ? teamMembers.map((member: any) => `
- **User ID**: ${member.clerkUserId}
- **Role**: ${member.role}
- **Joined**: ${new Date(member._creationTime).toLocaleDateString()}
`).join('\n') : 'No team members found.'}

## AI ASSISTANT INSTRUCTIONS
You are the AI assistant for this VibePlanner interior design project. You have complete access to ALL project data above - every task, note, shopping item, survey response, and file content. 

**Core Capabilities:**
1. **Project Analysis**: Analyze patterns, progress, bottlenecks across all data
2. **Design Consulting**: Provide interior design advice based on project specifics
3. **Project Management**: Help with task prioritization, timeline management, budget tracking
4. **Client Communication**: Draft communications based on project status and client needs
5. **Procurement Support**: Optimize shopping lists, find alternatives, track suppliers
6. **Team Coordination**: Assist with task assignments and workload distribution

**Response Guidelines:**
- Always reference specific data from the knowledge base above
- Provide actionable insights with exact numbers, dates, and details
- Focus on interior design workflows and best practices
- Be comprehensive but concise in your responses
- Cross-reference data between different sections (tasks vs shopping vs surveys)

This is your complete, up-to-date knowledge base for this project. Use it to provide the most accurate and helpful responses.`;

  const systemPrompt = `You are an expert AI assistant for VibePlanner, specializing in interior design project management. You have complete access to all project data and should provide comprehensive, actionable insights based on the full knowledge base provided.`;

  return { systemPrompt, megaContext };
}

// Main chat function with Gemini
export const chatWithAgent = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.optional(v.string())
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args) => {
    // 🔒 CHECK SUBSCRIPTION
    const subscriptionCheck: any = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
      projectId: args.projectId 
    });
    
    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription.");
    }

    const { systemPrompt, megaContext } = await buildFullProjectContext(ctx, args.projectId);
    
    // Get or create thread
    let threadId = args.threadId;
    if (!threadId) {
      threadId = `agent_thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
      
      await ctx.runMutation(internal.ai_database.createThreadInDB, {
        threadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });
    }

    // Get conversation history
    const messages = await ctx.runQuery(internal.ai_database.getThreadMessages, { threadId });
    
    // Format messages for Gemini - proper role mapping
    const conversationHistory = messages
      .filter((msg: any) => msg.role !== "system")
      .map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user", // Map assistant to model, user to user
        parts: [{ text: msg.content }]
      }));

    try {
      // Use the new GoogleGenAI SDK format
      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        }
      ];

      let finalResponse: string;

      // Always use fresh mega context - no caching!
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          {
            role: "user",
            parts: [{ text: megaContext }] // Fresh context every time
          },
          ...conversationHistory,
          {
            role: "user", 
            parts: [{ text: args.message }]
          }
        ],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 8000,
          temperature: 0.7,
          safetySettings
        }
      });
      
      finalResponse = result.text || "";
      
      if (!finalResponse) {
        throw new Error("Empty response from Gemini API");
      }

      // Save the conversation
      const updatedMessages = [
        ...messages,
        { role: "user" as const, content: args.message },
        { role: "assistant" as const, content: finalResponse }
      ];

      await ctx.runMutation(internal.ai_database.saveThreadMessages, {
        threadId,
        messages: updatedMessages,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });

      return {
        response: finalResponse,
        threadId
      };
      
    } catch (error: unknown) {
      console.error("Gemini API error:", error);
      
      // Handle specific Gemini errors with proper type checking
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);
      
      if (errorMessage.includes("API_KEY") || errorString.includes("403")) {
        throw new Error("AI service configuration error. Please contact support.");
      } else if (errorMessage.includes("quota") || errorString.includes("quota")) {
        throw new Error("AI service quota exceeded. Please try again later.");
      } else if (errorMessage.includes("SAFETY") || errorString.includes("SAFETY") || 
                 errorMessage.includes("content_filter") || errorString.includes("content_filter") ||
                 errorMessage.includes("policy") || errorString.includes("blocked")) {
        throw new Error("Message was filtered by AI safety policies. Please try rephrasing your question.");
      } else if (errorMessage.includes("system_instruction")) {
        throw new Error("AI service configuration error. Please try again.");
      } else if (errorString.includes("400")) {
        throw new Error("Invalid request format. Please try again or contact support.");
      } else {
        throw new Error(`AI service error: ${errorMessage || "Unknown error"}. Please try again.`);
      }
    }
  }
});

// Streaming version of chatWithAgent for real-time responses
export const chatWithAgentStream = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.optional(v.string())
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args) => {
    // 🔒 CHECK SUBSCRIPTION
    const subscriptionCheck: any = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
      projectId: args.projectId 
    });
    
    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription.");
    }

    const { systemPrompt, megaContext } = await buildFullProjectContext(ctx, args.projectId);
    
    // Get or create thread
    let threadId = args.threadId;
    if (!threadId) {
      threadId = `agent_thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
      
      await ctx.runMutation(internal.ai_database.createThreadInDB, {
        threadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });
    }

    // Get conversation history
    const messages = await ctx.runQuery(internal.ai_database.getThreadMessages, { threadId });
    
    // Format messages for Gemini - proper role mapping
    const conversationHistory = messages
      .filter((msg: any) => msg.role !== "system")
      .map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user", // Map assistant to model, user to user
        parts: [{ text: msg.content }]
      }));

    try {
      // Use the new GoogleGenAI SDK format with streaming
      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        }
      ];

      let finalResponse: string = "";

      // Always use fresh mega context - no caching! + streaming
      const result = await genAI.models.generateContentStream({
        model: "gemini-2.5-pro",
        contents: [
          {
            role: "user",
            parts: [{ text: megaContext }] // Fresh context every time
          },
          ...conversationHistory,
          {
            role: "user", 
            parts: [{ text: args.message }]
          }
        ],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 8000,
          temperature: 0.7,
          safetySettings
        }
      });
      
      // Process streaming response
      for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
          finalResponse += chunkText;
        }
      }
      
      if (!finalResponse) {
        throw new Error("Empty response from Gemini API");
      }

      // Save the conversation
      const updatedMessages = [
        ...messages,
        { role: "user" as const, content: args.message },
        { role: "assistant" as const, content: finalResponse }
      ];

      await ctx.runMutation(internal.ai_database.saveThreadMessages, {
        threadId,
        messages: updatedMessages,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });

      return {
        response: finalResponse,
        threadId
      };
      
    } catch (error: unknown) {
      console.error("Gemini API error:", error);
      
      // Handle specific Gemini errors with proper type checking
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = JSON.stringify(error);
      
      if (errorMessage.includes("API_KEY") || errorString.includes("403")) {
        throw new Error("AI service configuration error. Please contact support.");
      } else if (errorMessage.includes("quota") || errorString.includes("quota")) {
        throw new Error("AI service quota exceeded. Please try again later.");
      } else if (errorMessage.includes("SAFETY") || errorString.includes("SAFETY") || 
                 errorMessage.includes("content_filter") || errorString.includes("content_filter") ||
                 errorMessage.includes("policy") || errorString.includes("blocked")) {
        throw new Error("Message was filtered by AI safety policies. Please try rephrasing your question.");
      } else if (errorMessage.includes("system_instruction")) {
        throw new Error("AI service configuration error. Please try again.");
      } else if (errorString.includes("400")) {
        throw new Error("Invalid request format. Please try again or contact support.");
      } else {
        throw new Error(`AI service error: ${errorMessage || "Unknown error"}. Please try again.`);
      }
    }
  }
});

// Create a new thread
export const createThread = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // 🔒 CHECK SUBSCRIPTION
    const subscriptionCheck: any = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
      projectId: args.projectId 
    });
    
    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription.");
    }

    const { systemPrompt, megaContext } = await buildFullProjectContext(ctx, args.projectId);
    
    // Create a unique thread ID
    const threadId = `agent_thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
    
    // Save thread to database
    await ctx.runMutation(internal.ai_database.createThreadInDB, {
      threadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
    });

    return threadId;
  },
});

