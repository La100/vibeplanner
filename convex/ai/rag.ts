"use node";

/**
 * VibePlanner AI Chat System - OpenAI Integration
 *
 * This is the main AI system for VibePlanner using OpenAI's Responses API.
 * Supports file uploads, RAG search, and function calling.
 *
 * UI Component: /components/AIAssistantSmart.tsx
 * AI Page: /app/[slug]/[projectSlug]/ai/page.tsx
 * Custom Prompts: /convex/aiPrompts.ts
 */

// WAŻNE: Sprawdzamy czy mamy klucz OpenAI
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

import { components, internal, api } from "../_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";

// Konfiguracja RAG z OpenAI embeddings + GPT-5 - wszystko na OpenAI, stabilnie!
export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.textEmbedding("text-embedding-3-small"),
  embeddingDimension: 1536, // Dimension for text-embedding-3-small
  // Filtry dla różnych typów danych i projektów
  filterNames: ["sourceType", "projectId", "teamId"],
});

// Typy źródeł danych do indeksowania
export type SourceType = 
  | "task" 
  | "note" 
  | "shopping_item" 
  | "contact" 
  | "survey" 
| "survey_response";

// Funkcja pomocnicza do tworzenia namespace per projekt
export function getProjectNamespace(projectId: string): string {
  return `project_${projectId}`;
}

// Funkcja pomocnicza do tworzenia klucza dla każdego elementu
export function createContentKey(sourceType: SourceType, sourceId: string): string {
  return `${sourceType}_${sourceId}`;
}

// Public action: Indeksuj wszystkie dane projektu (called from UI)
export const indexAllProjectData = action({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Indeksuj wszystkie typy danych równolegle
    await Promise.all([
      ctx.runAction(internal.ai.rag.indexProjectTasks, { projectId: args.projectId }),
      ctx.runAction(internal.ai.rag.indexProjectNotes, { projectId: args.projectId }),
      ctx.runAction(internal.ai.rag.indexProjectShoppingItems, { projectId: args.projectId }),
      ctx.runAction(internal.ai.rag.indexProjectContacts, { projectId: args.projectId }),
      ctx.runAction(internal.ai.rag.indexProjectSurveys, { projectId: args.projectId }),
      ctx.runAction(internal.ai.rag.indexProjectSurveyResponses, { projectId: args.projectId }),
    ]);

    return null;
  },
});

// Internal action: Indeksuj tasks projektu
export const indexProjectTasks = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tasks = await ctx.runQuery(internal.rag.getProjectTasks, { projectId: args.projectId });
    const namespace = getProjectNamespace(args.projectId);

    for (const task of tasks) {
      const content = [
        `Task: ${task.title}`,
        task.description ? `Description: ${task.description}` : '',
        task.content ? `Content: ${task.content}` : '',
        `Status: ${task.status}`,
        task.priority ? `Priority: ${task.priority}` : '',
        task.assignedToName ? `Assigned to: ${task.assignedToName}` : 'Unassigned',
        task.dueDate ? `Due date: ${new Date(task.dueDate).toLocaleDateString()}` : '',
        task.cost ? `Cost: $${task.cost}` : '',
        task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
      ].filter(Boolean).join('\n');

      await rag.add(ctx, {
        namespace,
        key: createContentKey("task", task._id),
        text: content,
        filterValues: [
          { name: "sourceType", value: "task" },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: task.teamId },
        ],
      });
    }

    return null;
  },
});

// Internal action: Indeksuj notes projektu
export const indexProjectNotes = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notes = await ctx.runQuery(internal.rag.getProjectNotes, { projectId: args.projectId });
    const namespace = getProjectNamespace(args.projectId);

    for (const note of notes) {
      const content = [
        `Note: ${note.title}`,
        `Content: ${note.content}`,
      ].join('\n');

      await rag.add(ctx, {
        namespace,
        key: createContentKey("note", note._id),
        text: content,
        filterValues: [
          { name: "sourceType", value: "note" },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: note.teamId },
        ],
      });
    }

    return null;
  },
});

// Internal action: Indeksuj shopping items projektu
export const indexProjectShoppingItems = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const items = await ctx.runQuery(internal.rag.getProjectShoppingItems, { projectId: args.projectId });
    const namespace = getProjectNamespace(args.projectId);

    for (const item of items) {
      const content = [
        `Shopping Item: ${item.name}`,
        item.notes ? `Notes: ${item.notes}` : '',
        item.category ? `Category: ${item.category}` : '',
        item.supplier ? `Supplier: ${item.supplier}` : '',
        item.dimensions ? `Dimensions: ${item.dimensions}` : '',
        `Status: ${item.realizationStatus}`,
        `Quantity: ${item.quantity}`,
      ].filter(Boolean).join('\n');

      await rag.add(ctx, {
        namespace,
        key: createContentKey("shopping_item", item._id),
        text: content,
        filterValues: [
          { name: "sourceType", value: "shopping_item" },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: item.teamId },
        ],
      });
    }

    return null;
  },
});

// Internal action: Indeksuj contacts projektu
export const indexProjectContacts = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const contacts = await ctx.runQuery(internal.rag.getProjectContacts, { projectId: args.projectId });
    const namespace = getProjectNamespace(args.projectId);

    for (const contact of contacts) {
      const content = [
        `Contact: ${contact.name}`,
        contact.companyName ? `Company: ${contact.companyName}` : '',
        contact.email ? `Email: ${contact.email}` : '',
        contact.phone ? `Phone: ${contact.phone}` : '',
        contact.address ? `Address: ${contact.address}` : '',
        `Type: ${contact.type}`,
        contact.notes ? `Notes: ${contact.notes}` : '',
      ].filter(Boolean).join('\n');

      await rag.add(ctx, {
        namespace,
        key: createContentKey("contact", contact._id),
        text: content,
        filterValues: [
          { name: "sourceType", value: "contact" },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: contact.teamId },
        ],
      });
    }

    return null;
  },
});

// Internal action: Indeksuj surveys projektu
export const indexProjectSurveys = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const surveys = await ctx.runQuery(internal.rag.getProjectSurveys, { projectId: args.projectId });
    const namespace = getProjectNamespace(args.projectId);

    for (const survey of surveys) {
      const content = [
        `Survey: ${survey.title}`,
        survey.description ? `Description: ${survey.description}` : '',
        `Status: ${survey.status}`,
        `Target: ${survey.targetAudience}`,
      ].filter(Boolean).join('\n');

      await rag.add(ctx, {
        namespace,
        key: createContentKey("survey", survey._id),
        text: content,
        filterValues: [
          { name: "sourceType", value: "survey" },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: survey.teamId },
        ],
      });
    }

    return null;
  },
});

// Internal action: Indeksuj survey responses projektu
export const indexProjectSurveyResponses = internalAction({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const surveyResponses = await ctx.runQuery(internal.surveys.getSurveyResponsesForIndexing, { projectId: args.projectId });
    const namespace = getProjectNamespace(args.projectId);

    for (const response of surveyResponses) {
      const content = [
        `Survey Response: ${response.surveyTitle}`,
        `Respondent ID: ${response.respondentId}`,
        response.submittedAt ? `Submitted: ${new Date(response.submittedAt).toLocaleDateString()}` : '',
        `Status: ${response.isComplete ? 'Complete' : 'In Progress'}`,
        `Answers:`,
        ...response.answers.map((answer: any) => {
          let answerText = '';
          if (answer.textAnswer) answerText = answer.textAnswer;
          else if (answer.choiceAnswers) answerText = answer.choiceAnswers.join(', ');
          else if (answer.ratingAnswer !== undefined) answerText = answer.ratingAnswer.toString();
          else if (answer.numberAnswer !== undefined) answerText = answer.numberAnswer.toString();
          else answerText = 'No answer';

          return `- ${answer.questionText}: ${answerText}`;
        }),
      ].filter(Boolean).join('\n');

      await rag.add(ctx, {
        namespace,
        key: createContentKey("survey_response", response._id),
        text: content,
        filterValues: [
          { name: "sourceType", value: "survey_response" },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: response.teamId },
        ],
      });
    }

    return null;
  },
});

// RAG Search funkcja - główna funkcja do wyszukiwania kontekstu dla AI
export const ragSearch = action({
  args: { 
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    text: v.string(),
    results: v.array(v.any()),
    entries: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    // Sprawdź czy AI jest włączony dla tego projektu
    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, { projectId: args.projectId });
    if (!aiSettings?.isEnabled) {
      return {
        text: "AI RAG is not enabled for this project. Please enable it first.",
        results: [],
        entries: [],
      };
    }

    const namespace = getProjectNamespace(args.projectId);
    const limit = args.limit || 10;

    try {
      const searchResults = await rag.search(ctx, {
        namespace,
        query: args.query,
        limit,
        vectorScoreThreshold: 0.3, // Przywracamy normalny threshold
        filters: [
          { name: "projectId", value: args.projectId },
        ],
      });

      // Filter out deleted entries from results
      if (searchResults.results) {
        searchResults.results = searchResults.results.filter((result: any) => {
          // Check if any content indicates this is deleted
          const isDeleted = result.content?.some((content: any) => {
            return (
              content.metadata?.isDeleted ||
              content.metadata?.entityType?.startsWith('deleted_') ||
              content.text?.startsWith('[DELETED]')
            );
          });
          return !isDeleted; // Keep only non-deleted entries
        });
      }

      // Rebuild text from filtered results
      if (searchResults.results) {
        searchResults.text = searchResults.results.map((r: any) => {
          // W Convex RAG, tekst jest w r.content[].text
          return r.content?.map((c: any) => c.text).join('\n') || '';
        }).join('\n\n');
      }

      return searchResults;
    } catch (error) {
      console.error("RAG search error:", error);
      return {
        text: "Search failed. Please try again.",
        results: [],
        entries: [],
      };
    }
  },
});

// Funkcje do aktualizacji indeksów przy zmianie danych
export const updateTaskIndex = internalAction({
  args: { 
    taskId: v.id("tasks"),
    operation: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.operation === "delete") {
      // Usuń z indeksu
      const key = createContentKey("task", args.taskId);
      // RAG component automatycznie usuwa przy użyciu klucza
      return null;
    }

    // Pobierz task
    const task = await ctx.runQuery(internal.rag.getTaskById, { taskId: args.taskId });
    if (!task) return null;

    // Sprawdź czy AI jest włączony dla tego projektu
    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, { projectId: task.projectId });
    if (!aiSettings?.isEnabled) return null;

    const namespace = getProjectNamespace(task.projectId);
    const content = [
      `Task: ${task.title}`,
      task.description ? `Description: ${task.description}` : '',
      task.content ? `Content: ${task.content}` : '',
      `Status: ${task.status}`,
      task.priority ? `Priority: ${task.priority}` : '',
      task.tags.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    await rag.add(ctx, {
      namespace,
      key: createContentKey("task", task._id),
      text: content,
      filterValues: [
        { name: "sourceType", value: "task" },
        { name: "projectId", value: task.projectId },
        { name: "teamId", value: task.teamId },
      ],
    });

    return null;
  },
});

export const updateNoteIndex = internalAction({
  args: { 
    noteId: v.id("notes"),
    operation: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.operation === "delete") {
      return null; // RAG component automatycznie usuwa
    }

    const note = await ctx.runQuery(internal.rag.getNoteById, { noteId: args.noteId });
    if (!note) return null;

    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, { projectId: note.projectId });
    if (!aiSettings?.isEnabled) return null;

    const namespace = getProjectNamespace(note.projectId);
    const content = [
      `Note: ${note.title}`,
      `Content: ${note.content}`,
    ].join('\n');

    await rag.add(ctx, {
      namespace,
      key: createContentKey("note", note._id),
      text: content,
      filterValues: [
        { name: "sourceType", value: "note" },
        { name: "projectId", value: note.projectId },
        { name: "teamId", value: note.teamId },
      ],
    });

    return null;
  },
});

export const updateShoppingItemIndex = internalAction({
  args: { 
    itemId: v.id("shoppingListItems"),
    operation: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.operation === "delete") {
      return null;
    }

    const item = await ctx.runQuery(internal.rag.getShoppingItemById, { itemId: args.itemId });
    if (!item) return null;

    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, { projectId: item.projectId });
    if (!aiSettings?.isEnabled) return null;

    const namespace = getProjectNamespace(item.projectId);
    const content = [
      `Shopping Item: ${item.name}`,
      item.notes ? `Notes: ${item.notes}` : '',
      item.category ? `Category: ${item.category}` : '',
      item.supplier ? `Supplier: ${item.supplier}` : '',
      `Status: ${item.realizationStatus}`,
      `Quantity: ${item.quantity}`,
    ].filter(Boolean).join('\n');

    await rag.add(ctx, {
      namespace,
      key: createContentKey("shopping_item", item._id),
      text: content,
      filterValues: [
        { name: "sourceType", value: "shopping_item" },
        { name: "projectId", value: item.projectId },
        { name: "teamId", value: item.teamId },
      ],
    });

    return null;
  },
});

// RAG Chat funkcja - główna funkcja chat z RAG search
export const chatWithRAGAgent = action({
  args: {
    threadId: v.optional(v.string()),
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    fileId: v.optional(v.union(v.id("files"), v.string(), v.null())),
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
    tokenUsage: v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    }),
    mode: v.string(),
    contextSize: v.number(),
    pendingItems: v.optional(v.array(v.object({
      type: v.union(v.literal("task"), v.literal("note"), v.literal("shopping"), v.literal("survey"), v.literal("contact")),
      operation: v.union(v.literal("create"), v.literal("edit"), v.literal("delete")),
      data: v.any(),
    }))),
  }),
  handler: async (ctx, args): Promise<{
    response: string;
    threadId: string;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUSD: number;
    };
    mode: string;
    contextSize: number;
    pendingItems?: Array<{
      type: "task" | "note" | "shopping" | "survey";
      operation: "create" | "edit";
      data: any;
    }>;
  }> => {
    console.log("🚀 RAG Action called with fileId:", args.fileId);
    // Sprawdź czy AI jest włączony dla tego projektu
    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, { projectId: args.projectId });
    if (!aiSettings?.isEnabled) {
      throw new Error("AI is not enabled for this project. Please enable it first.");
    }

    // Wyszukaj kontekst za pomocą RAG (tylko jeśli indexing jest włączony)
    let ragResults: any = { text: "", results: [], entries: [] };
    if (aiSettings?.indexingEnabled) {
      ragResults = await ctx.runAction(api.ai.rag.ragSearch, {
        projectId: args.projectId,
        query: args.message,
        limit: 100,
      });
    }

    // Pobierz system prompt (custom lub default)
    const customPrompt = await ctx.runQuery(internal.ai.promptDb.getActiveCustomPromptInternal, {
      projectId: args.projectId,
    });

    const systemPrompt: string = customPrompt ||
      await ctx.runQuery(api.ai.promptDb.getDefaultPromptTemplate, {});

    // Ensure thread exists and get/create thread ID
    let actualThreadId = args.threadId;
    if (!actualThreadId) {
      actualThreadId = `thread_${args.projectId}_${Date.now()}`;
    }
    
    // Ensure thread exists in database
    await ctx.runMutation(internal.ai.threads.getOrCreateThread, {
      threadId: actualThreadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
    });

    // Get team members with user details for AI context
    const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
      projectId: args.projectId,
    });
    
    // Debug: Found team members for AI context
    // console.log(`Found ${teamMembers.length} team members for project ${args.projectId}`);

    // Pobierz historię konwersacji
    let conversationHistory: string = "";
    const threadMessages = await ctx.runQuery(internal.ai.threads.getThreadMessages, { 
      threadId: actualThreadId,
      limit: 10 
    });
    
    if (threadMessages.length > 0) {
      conversationHistory = threadMessages.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n') + '\n\n';
    }

    // Utwórz kontekst z RAG results
    let ragContext: string = ragResults.text || "No relevant context found.";

    // Special case: If user asks for "all tasks" or task count, provide complete context
    if (args.message.toLowerCase().match(/wszystki.*task|wszystkie.*zadani|ile.*task|ile.*zadani|łącznie.*task|razem.*task/)) {
      try {
        const allTasks = await ctx.runQuery(internal.rag.getProjectTasks, {
          projectId: args.projectId
        });

        console.log(`📊 Loading all ${allTasks.length} tasks for complete overview`);

        const allTasksContext = `\n## ALL PROJECT TASKS (${allTasks.length} total)\n${allTasks.map((task: any, index: number) =>
          `${index + 1}. **"${task.title}"** [ID: ${task._id}]\n   - Status: ${task.status} | Priority: ${task.priority || 'none'}\n   - Assigned: ${task.assignedToName || 'Unassigned'}\n   - Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}\n   - Cost: ${task.cost ? `$${task.cost}` : 'N/A'}`
        ).join('\n')}\n`;

        ragContext = allTasksContext + "\n\n" + ragContext;
      } catch (error) {
        console.warn("Error loading all tasks:", error);
      }
    }

    // SPECIAL CASE: For delete operations, add full project data with IDs
    if (args.message.toLowerCase().includes('delete') ||
        args.message.toLowerCase().includes('remove') ||
        args.message.toLowerCase().includes('usuń') ||
        args.message.toLowerCase().includes('usun')) {

      try {
        // Get ALL shopping items with IDs for deletion context
        const allShoppingItems = await ctx.runQuery(api.shopping.listShoppingListItems, {
          projectId: args.projectId
        });

        // Get ALL tasks with IDs
        const allTasks = await ctx.runQuery(api.tasks.listProjectTasks, {
          projectId: args.projectId
        });

        // Get ALL notes with IDs
        const allNotes = await ctx.runQuery(internal.notes.getNotesForIndexing, {
          projectId: args.projectId
        });

        // Get ALL surveys with IDs
        const allSurveys = await ctx.runQuery(internal.rag.getProjectSurveys, {
          projectId: args.projectId
        });

        // Get ALL contacts with IDs
        const allContacts = await ctx.runQuery(internal.rag.getProjectContacts, {
          projectId: args.projectId
        });

        const deleteContext = `\n\nCOMPLETE PROJECT DATA FOR DELETION (use these exact IDs):\n\nSHOPPING ITEMS:\n${allShoppingItems.map(item =>
  `- ID: "${item._id}" | Name: "${item.name}" | Quantity: ${item.quantity} | Status: ${item.realizationStatus}`
).join('\n')}\n\nTASKS:\n${allTasks.map(task =>
  `- ID: "${task._id}" | Title: "${task.title}" | Status: ${task.status} | Priority: ${task.priority || 'none'}`
).join('\n')}\n\nNOTES:\n${allNotes.map(note =>
  `- ID: "${note._id}" | Title: "${note.title}" | Updated: ${new Date(note.updatedAt).toLocaleDateString()}`
).join('\n')}\n\nSURVEYS:\n${allSurveys.map(survey =>
  `- ID: "${survey._id}" | Title: "${survey.title}" | Status: ${survey.status} | Target: ${survey.targetAudience}`
).join('\n')}\n\nCONTACTS:\n${allContacts.map(contact =>
  `- ID: "${contact._id}" | Name: "${contact.name}" | Company: ${contact.companyName || 'N/A'} | Type: ${contact.type}`
).join('\n')}\n\nCRITICAL FOR DELETION: Always use the exact ID from above list (like "${allShoppingItems[0]?._id}"), NEVER use names!\n`;

        ragContext = deleteContext + "\n\n" + ragContext;
      } catch (error) {
        console.warn("Error loading delete context:", error);
      }
    }

    // Dodaj aktualną datę do kontekstu
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentDateTime = new Date().toLocaleString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Create team members list for AI - just names
    const teamMembersContext = teamMembers.length > 0
      ? `\n\nTEAM MEMBERS:\n${teamMembers.map(member =>
          `- ${member.name || member.email}`
        ).join('\n')}`
      : '';

    const fullPrompt = `${systemPrompt}\n\nCURRENT DATE AND TIME: ${currentDateTime} (${currentDate})\nWhen setting due dates, use this as reference for "today", "tomorrow", "next week", etc.${teamMembersContext}\n\nCONVERSATION HISTORY:\n${conversationHistory}RELEVANT CONTEXT:\n${ragContext}\n\nUSER MESSAGE: ${args.message}`;

     // Wywołaj OpenAI GPT-5 z function calling
     const startTime = Date.now();
     
     try {
       // Używamy OpenAI GPT-5 bezpośrednio - stabilne i niezawodne z function calling
       const OpenAI = await import("openai");
       const openaiClient = new OpenAI.default({
         apiKey: process.env.OPENAI_API_KEY,
       });
       
       // Definiuj dostępne funkcje
       const functions = [
         {
           name: "create_task",
           description: "Create a new task in the project",
           parameters: {
             type: "object",
             properties: {
               title: { type: "string", description: "Task title" },
               description: { type: "string", description: "Task description" },
               content: { type: "string", description: "Rich text content" },
               priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" },
               status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Task status", default: "todo" },
               assignedTo: { type: "string", description: "Team member name or email from TEAM MEMBERS list" },
               dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
               tags: { type: "array", items: { type: "string" }, description: "Task tags for categorization" }
             },
             required: ["title"]
           }
         },
         {
           name: "create_multiple_tasks",
           description: "Create multiple tasks at once (use when creating 2+ tasks)",
           parameters: {
             type: "object",
             properties: {
               tasks: {
                 type: "array",
                 description: "Array of tasks to create",
                 items: {
                   type: "object",
                   properties: {
                     title: { type: "string", description: "Task title" },
                     description: { type: "string", description: "Task description" },
                     content: { type: "string", description: "Rich text content" },
                     priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" },
                     status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Task status", default: "todo" },
                     assignedTo: { type: "string", description: "Team member name or email from TEAM MEMBERS list" },
                     dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
                     tags: { type: "array", items: { type: "string" }, description: "Task tags for categorization" }
                   },
                   required: ["title"]
                 }
               }
             },
             required: ["tasks"]
           }
         },
         {
           name: "create_note",
           description: "Create a new note in the project",
           parameters: {
             type: "object",
             properties: {
               title: { type: "string", description: "Note title" },
               content: { type: "string", description: "Note content" }
             },
             required: ["title", "content"]
           }
         },
         {
           name: "create_shopping_item",
           description: "Create a new shopping list item",
           parameters: {
             type: "object",
             properties: {
               name: { type: "string", description: "Item name" },
               notes: { type: "string", description: "Additional notes or description" },
               quantity: { type: "number", description: "Quantity needed", default: 1 },
               priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Item priority" },
               buyBefore: { type: "string", description: "Buy before date in ISO format (YYYY-MM-DD)" },
               supplier: { type: "string", description: "Supplier or store name" },
               category: { type: "string", description: "Item category (e.g., Electronics, Furniture)" },
               dimensions: { type: "string", description: "Item dimensions or size" },
               unitPrice: { type: "number", description: "Price per unit" },
               totalPrice: { type: "number", description: "Total price (quantity × unit price)" },
               productLink: { type: "string", description: "Link to product page" },
               catalogNumber: { type: "string", description: "Product catalog/model number" },
               sectionId: { type: "string", description: "Shopping list section ID" },
               sectionName: { type: "string", description: "Shopping list section name (e.g., Kitchen, Bathroom)" }
             },
             required: ["name", "quantity"]
           }
         },
         {
           name: "create_survey",
           description: "Create a new survey for the project",
           parameters: {
             type: "object",
             properties: {
               title: { type: "string", description: "Survey title" },
               description: { type: "string", description: "Survey description" },
               isRequired: { type: "boolean", description: "Whether survey is required for customers", default: false },
               allowMultipleResponses: { type: "boolean", description: "Allow multiple responses from same person", default: false },
               startDate: { type: "string", description: "Survey start date in ISO format (YYYY-MM-DD)" },
               endDate: { type: "string", description: "Survey end date in ISO format (YYYY-MM-DD)" },
               targetAudience: {
                 type: "string",
                 enum: ["all_customers", "specific_customers", "team_members"],
                 description: "Who should take this survey",
                 default: "all_customers"
               },
               targetCustomerIds: {
                 type: "array",
                 items: { type: "string" },
                 description: "Specific customer IDs (only if targetAudience is 'specific_customers')"
               },
               questions: {
                 type: "array",
                 description: "Array of survey questions to create",
                 items: {
                   type: "object",
                   properties: {
                     questionText: { type: "string", description: "The question text" },
                     questionType: {
                       type: "string",
                       enum: ["text_short", "text_long", "multiple_choice", "single_choice", "rating", "yes_no", "number", "file"],
                       description: "Type of question",
                       default: "text_short"
                     },
                     options: {
                       type: "array",
                       items: { type: "string" },
                       description: "Options for multiple_choice or single_choice questions"
                     },
                     isRequired: { type: "boolean", description: "Whether this question is required", default: true }
                   },
                   required: ["questionText", "questionType"]
                 }
               }
             },
             required: ["title"]
           }
         },
         {
           name: "create_contact",
           description: "Create a new contact (contractor, supplier, etc.)",
           parameters: {
             type: "object",
             properties: {
               name: { type: "string", description: "Contact name" },
               companyName: { type: "string", description: "Company name" },
               email: { type: "string", description: "Email address" },
               phone: { type: "string", description: "Phone number" },
               address: { type: "string", description: "Physical address" },
               city: { type: "string", description: "City" },
               postalCode: { type: "string", description: "Postal code" },
               website: { type: "string", description: "Website URL" },
               taxId: { type: "string", description: "Tax ID or company registration number" },
               type: {
                 type: "string",
                 enum: ["contractor", "supplier", "subcontractor", "other"],
                 description: "Contact type",
                 default: "contractor"
               },
               notes: { type: "string", description: "Additional notes about the contact" }
             },
             required: ["name", "type"]
           }
         },
         {
           name: "delete_task",
           description: "Delete/remove a task from the project",
           parameters: {
             type: "object",
             properties: {
               taskId: { type: "string", description: "Task ID to delete" },
               reason: { type: "string", description: "Optional reason for deletion" }
             },
             required: ["taskId"]
           }
         },
         {
           name: "delete_note",
           description: "Delete/remove a note from the project",
           parameters: {
             type: "object",
             properties: {
               noteId: { type: "string", description: "Note ID to delete" },
               reason: { type: "string", description: "Optional reason for deletion" }
             },
             required: ["noteId"]
           }
         },
         {
           name: "delete_shopping_item",
           description: "Delete/remove an item from the shopping list",
           parameters: {
             type: "object",
             properties: {
               itemId: { type: "string", description: "Shopping item ID to delete" },
               reason: { type: "string", description: "Optional reason for deletion" }
             },
             required: ["itemId"]
           }
         },
         {
           name: "delete_survey",
           description: "Delete/remove a survey from the project",
           parameters: {
             type: "object",
             properties: {
               surveyId: { type: "string", description: "Survey ID to delete" },
               title: { type: "string", description: "Survey title for confirmation dialog" },
               reason: { type: "string", description: "Optional reason for deletion" }
             },
             required: ["surveyId", "title"]
           }
         },
         {
           name: "delete_contact",
           description: "Delete/remove a contact from the project",
           parameters: {
             type: "object",
             properties: {
               contactId: { type: "string", description: "Contact ID to delete" },
               reason: { type: "string", description: "Optional reason for deletion" }
             },
             required: ["contactId"]
           }
         }
       ];

       // Prepare messages with optional file support
       const messages: any[] = [];

       if (args.fileId) {
         console.log(`🔍 Processing file: ${args.fileId}`);
         // Get file information
         // Handle both string and Id types for fileId
        const fileId = typeof args.fileId === 'string' ? args.fileId as any : args.fileId;
        const file = await ctx.runQuery(api.files.getFileById, { fileId });
         if (file) {
           console.log(`📁 File details: name=${file.name}, mimeType=${file.mimeType}, size=${file.size}`);

           // Get proper signed URL for the file using the same logic as in files.ts
           let fileUrl: string | null = null;

           try {
             // Use the same R2 URL generation logic as in getProjectFiles
             const { r2 } = await import("../files");
             fileUrl = await r2.getUrl(file.storageId as string, {
               expiresIn: 60 * 60 * 2, // 2 hours
             });
             console.log(`🔗 Generated R2 signed URL for file: ${file.name}`);
           } catch (error) {
             console.error("Failed to get R2 signed URL:", error);
             // Try fallback to Convex storage if it's not an R2 key
             try {
               fileUrl = await ctx.storage.getUrl(file.storageId);
               console.log(`🔗 Using Convex storage URL fallback: ${file.name}`);
             } catch (fallbackError) {
               console.error("Both R2 and Convex storage URL generation failed:", fallbackError);
               fileUrl = null;
             }
           }
           if (fileUrl) {
             // For images, add to message content as image_url
             if (file.mimeType?.startsWith('image/')) {
               messages.push({
                 role: "user",
                 content: [
                   { type: "input_text", text: fullPrompt },
                   {
                     type: "input_image",
                     image_url: fileUrl
                   }
                 ]
               });
             }
             // For PDFs, try to use OpenAI's native PDF support
             else if (file.mimeType === 'application/pdf') {
               console.log("📄 Processing PDF file...");
               try {
                 // Download the PDF file from R2
                 console.log("⬇️ Downloading PDF from R2...");
                 const fileResponse = await fetch(fileUrl);
                 console.log("📥 PDF download status:", fileResponse.status);

                 if (!fileResponse.ok) {
                   throw new Error(`Failed to download PDF: ${fileResponse.status}`);
                 }

                 // Use OpenAI's native PDF support (2025)
                 console.log("📤 Uploading PDF to OpenAI Files API...");
                 const fileBuffer = await fileResponse.arrayBuffer();

                 // Upload to OpenAI Files API using native PDF support
                 const formData = new FormData();
                 formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), file.name);
                 formData.append('purpose', 'assistants');

                 const uploadResponse = await fetch('https://api.openai.com/v1/files', {
                   method: 'POST',
                   headers: {
                     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                   },
                   body: formData,
                 });

                 const uploadResult = await uploadResponse.json();
                 console.log("📤 OpenAI upload result:", uploadResult);

                 if (uploadResult.id) {
                   console.log("✅ PDF uploaded successfully, using Responses API file input");
                   // Use Responses API format for PDF files - correct format
                   messages.push({
                     role: "user",
                     content: [
                       { type: "input_text", text: fullPrompt },
                       {
                         type: "input_file",
                         file_id: uploadResult.id
                       }
                     ]
                   });
                 } else {
                   throw new Error(`Failed to upload to OpenAI: ${uploadResult.error?.message || 'Unknown error'}`);
                 }
               } catch (error) {
                 console.error("Error processing PDF with OpenAI:", error);
                 // Fallback to URL reference if upload fails
                 const filePrompt = `${fullPrompt}\n\n📎 ATTACHED PDF: "${file.name}" - Could not upload to OpenAI, but I can see it's a PDF document. Please let me know what specific information you'd like me to help you with regarding this file.`;
                 messages.push({ role: "user", content: [{ type: "input_text", text: filePrompt }] });
               }
             }
             // For text files, try to read content directly
             else if (file.mimeType?.includes('text/') ||
                      file.mimeType?.includes('application/json') ||
                      file.name.endsWith('.md') ||
                      file.name.endsWith('.txt') ||
                      file.name.endsWith('.json') ||
                      file.name.endsWith('.csv')) {
               try {
                 console.log("📄 Processing text-based file...");
                 const fileResponse = await fetch(fileUrl);
                 if (fileResponse.ok) {
                   const textContent = await fileResponse.text();
                   const filePrompt = `${fullPrompt}\n\n📎 ATTACHED FILE: "${file.name}" (${file.mimeType})\n\nFILE CONTENT:\n${textContent.substring(0, 10000)}${textContent.length > 10000 ? '...(truncated)' : ''}`;
                   messages.push({ role: "user", content: [{ type: "input_text", text: filePrompt }] });
                 } else {
                   throw new Error(`Failed to read file content: ${fileResponse.status}`);
                 }
               } catch (error) {
                 console.error("Error reading text file:", error);
                 const filePrompt = `${fullPrompt}\n\n📎 ATTACHED FILE: ${file.name} (${file.mimeType}) - Error reading file content. Please acknowledge the attachment.`;
                 messages.push({ role: "user", content: [{ type: "input_text", text: filePrompt }] });
               }
             }
             // For other files, mention in text with more details
             else {
               let fileTypeDescription = "Unknown file type";
               if (file.mimeType?.includes('video/')) fileTypeDescription = "Video file";
               else if (file.mimeType?.includes('audio/')) fileTypeDescription = "Audio file";
               else if (file.mimeType?.includes('application/vnd.ms-excel') || file.mimeType?.includes('spreadsheet')) fileTypeDescription = "Spreadsheet";
               else if (file.mimeType?.includes('application/msword') || file.mimeType?.includes('document')) fileTypeDescription = "Document";

               const filePrompt = `${fullPrompt}\n\n📎 ATTACHED FILE: "${file.name}" (${fileTypeDescription}, ${(file.size / 1024).toFixed(1)} KB)\n\nI've received your ${fileTypeDescription.toLowerCase()}. While I can't analyze the specific content of this file type directly, I can help you with questions about it or provide guidance on how to work with such files in your project.`;
               messages.push({ role: "user", content: filePrompt });
             }
           } else {
             messages.push({ role: "user", content: [{ type: "input_text", text: fullPrompt }] });
           }
         } else {
           messages.push({ role: "user", content: [{ type: "input_text", text: fullPrompt }] });
         }
       } else {
         messages.push({ role: "user", content: [{ type: "input_text", text: fullPrompt }] });
       }

       // Use Responses API for file support and tools
       const result = await openaiClient.responses.create({
         model: "gpt-5",
         input: messages,
         tools: functions.map(func => ({
           type: "function" as const,
           name: func.name,
           parameters: func.parameters,
           description: func.description,
           strict: false
         })),
         temperature: 1,
       });

       // Extract response from Responses API format
       const aiResponse = result.output_text || "";
       // Find function calls in Responses API output
       const functionCalls = result.output?.filter(item => item.type === "function_call");
       const responseTime = Date.now() - startTime;
       
       const tokenUsage = {
         inputTokens: result.usage?.input_tokens || Math.floor(fullPrompt.length / 4),
         outputTokens: result.usage?.output_tokens || Math.floor(aiResponse.length / 4),
         totalTokens: result.usage?.total_tokens || 0,
         estimatedCostUSD: 0,
       };
       
       if (!tokenUsage.totalTokens) {
         tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
       }
       
       // GPT-5 pricing: $1.25/1M input tokens, $10/1M output tokens
       const inputCost = (tokenUsage.inputTokens / 1000000) * 1.25;
       const outputCost = (tokenUsage.outputTokens / 1000000) * 10;
       tokenUsage.estimatedCostUSD = inputCost + outputCost;
      
       // Obsłuż function calls z Responses API
       let finalResponse = aiResponse;
       let pendingItems: any[] = [];

       if (functionCalls && functionCalls.length > 0) {
         try {
           // Process first function call
           const functionCall = functionCalls[0];
           const functionArgs = JSON.parse(functionCall.arguments);

           switch (functionCall.name) {
             case "create_task":
               // Resolve assignedTo name/email to Clerk ID
               if (functionArgs.assignedTo) {
                 const assignedUser = teamMembers.find(m =>
                   m.name === functionArgs.assignedTo ||
                   m.email === functionArgs.assignedTo ||
                   m.clerkUserId === functionArgs.assignedTo // fallback for direct ID
                 );
                 if (assignedUser) {
                   functionArgs.assignedToName = assignedUser.name || assignedUser.email;
                   functionArgs.assignedTo = assignedUser.clerkUserId; // Convert to Clerk ID for database
                 } else {
                   // If not found, clear the assignment
                   functionArgs.assignedTo = null;
                 }
               }
               
               pendingItems.push({
                 type: "task",
                 operation: "create",
                 data: functionArgs
               });
               finalResponse = `I'll create a task: "${functionArgs.title}". ${aiResponse}`;
               break;
             case "create_multiple_tasks":
               // Add all tasks to pending items with user name resolution
               functionArgs.tasks.forEach((task: any) => {
                 // Resolve assignedTo name/email to Clerk ID
                 if (task.assignedTo) {
                   const assignedUser = teamMembers.find(m =>
                     m.name === task.assignedTo ||
                     m.email === task.assignedTo ||
                     m.clerkUserId === task.assignedTo // fallback for direct ID
                   );
                   if (assignedUser) {
                     task.assignedToName = assignedUser.name || assignedUser.email;
                     task.assignedTo = assignedUser.clerkUserId; // Convert to Clerk ID for database
                   } else {
                     // If not found, clear the assignment
                     task.assignedTo = null;
                   }
                 }
                 
                 pendingItems.push({
                   type: "task",
                   operation: "create",
                   data: task
                 });
               });
               finalResponse = `I'll create ${functionArgs.tasks.length} tasks for you. ${aiResponse}`;
               break;
             case "create_note":
               pendingItems.push({
                 type: "note", 
                 operation: "create",
                 data: functionArgs
               });
               finalResponse = `I'll create a note: "${functionArgs.title}". ${aiResponse}`;
               break;
             case "create_shopping_item":
               pendingItems.push({
                 type: "shopping",
                 operation: "create", 
                 data: functionArgs
               });
               finalResponse = `I'll add "${functionArgs.name}" to shopping list. ${aiResponse}`;
               break;
             case "create_survey":
               pendingItems.push({
                 type: "survey",
                 operation: "create",
                 data: functionArgs
               });
               finalResponse = `I'll create survey: "${functionArgs.title}". ${aiResponse}`;
               break;
             case "create_contact":
               pendingItems.push({
                 type: "contact",
                 operation: "create",
                 data: functionArgs
               });
               finalResponse = `I'll create contact: "${functionArgs.name}" (${functionArgs.type}). ${aiResponse}`;
               break;
             case "delete_task":
               pendingItems.push({
                 type: "task",
                 operation: "delete",
                 data: { taskId: functionArgs.taskId, reason: functionArgs.reason }
               });
               finalResponse = `I'll delete the task. ${aiResponse}`;
               break;
             case "delete_note":
               pendingItems.push({
                 type: "note",
                 operation: "delete",
                 data: { noteId: functionArgs.noteId, reason: functionArgs.reason }
               });
               finalResponse = `I'll delete the note. ${aiResponse}`;
               break;
             case "delete_shopping_item":
               pendingItems.push({
                 type: "shopping",
                 operation: "delete",
                 data: { itemId: functionArgs.itemId, reason: functionArgs.reason }
               });
               finalResponse = `I'll remove the item from shopping list. ${aiResponse}`;
               break;
             case "delete_survey":
               pendingItems.push({
                 type: "survey",
                 operation: "delete",
                 data: {
                   surveyId: functionArgs.surveyId,
                   title: functionArgs.title,
                   reason: functionArgs.reason
                 }
               });
               finalResponse = `I'll delete the survey "${functionArgs.title}". ${aiResponse}`;
               break;
             case "delete_contact":
               pendingItems.push({
                 type: "contact",
                 operation: "delete",
                 data: { contactId: functionArgs.contactId, reason: functionArgs.reason }
               });
               finalResponse = `I'll delete the contact. ${aiResponse}`;
               break;
           }
         } catch (error) {
           console.error("Error parsing function call:", error);
         }
       }

       // Zapisz użycie tokenów
       await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
         projectId: args.projectId,
         teamId: aiSettings.teamId,
         userClerkId: args.userClerkId,
         threadId: args.threadId,
         model: "gpt-5",
         requestType: "chat",
         inputTokens: tokenUsage.inputTokens,
         outputTokens: tokenUsage.outputTokens,
         totalTokens: tokenUsage.totalTokens,
         contextSize: ragContext.length,
         mode: aiSettings?.indexingEnabled ? "rag" : "basic",
         estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
         responseTimeMs: responseTime,
         success: true,
       });

       // Zapisz wiadomości do historii thread'a
       await ctx.runMutation(internal.ai.threads.saveMessagesToThread, {
         threadId: actualThreadId,
         projectId: args.projectId,
         userMessage: args.message,
         assistantMessage: finalResponse,
         tokenUsage,
         ragContext: ragContext,
       });

       return {
         response: finalResponse,
         threadId: actualThreadId,
         tokenUsage,
         mode: aiSettings?.indexingEnabled ? "rag" : "basic",
         contextSize: ragContext.length,
         pendingItems: pendingItems,
       };
      
    } catch (error) {
      console.error("OpenAI GPT-5 call failed:", error);
      
      // Fallback do mock response w przypadku błędu
      const mockResponse = `I encountered an error processing your request: ${args.message}. Please try again. Context available: ${ragContext.substring(0, 100)}...`;
      const responseTime = Date.now() - startTime;

      const tokenUsage = {
        inputTokens: Math.floor(fullPrompt.length / 4), // Rough estimate
        outputTokens: Math.floor(mockResponse.length / 4),
        totalTokens: 0,
        estimatedCostUSD: 0,
      };
      tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
      tokenUsage.estimatedCostUSD = 0; // No cost for error

      // Zapisz użycie tokenów z oznaczeniem błędu
      await ctx.runMutation(internal.ai.usage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: aiSettings.teamId,
        userClerkId: args.userClerkId,
        threadId: args.threadId,
        model: "gpt-5-fallback",
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        contextSize: ragContext.length,
        mode: "rag",
        estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
        responseTimeMs: responseTime,
        success: false,
      });

      return {
        response: mockResponse,
        threadId: args.threadId || "new-thread-id",
        tokenUsage,
        mode: "rag",
        contextSize: ragContext.length,
        pendingItems: [],
      };
    }
  },
});

export const updateSurveyIndex = internalAction({
  args: { 
    surveyId: v.id("surveys"),
    operation: v.union(v.literal("create"), v.literal("update"), v.literal("delete")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.operation === "delete") {
      return null;
    }

    const survey = await ctx.runQuery(internal.rag.getSurveyById, { surveyId: args.surveyId });
    if (!survey) return null;

    const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, { projectId: survey.projectId });
    if (!aiSettings?.isEnabled) return null;

    const namespace = getProjectNamespace(survey.projectId);
    const content = [
      `Survey: ${survey.title}`,
      survey.description ? `Description: ${survey.description}` : '',
      `Status: ${survey.status}`,
      `Target: ${survey.targetAudience}`,
      `Required: ${survey.isRequired ? 'Yes' : 'No'}`,
      `Multiple Responses: ${survey.allowMultipleResponses ? 'Yes' : 'No'}`,
    ].filter(Boolean).join('\n');

    await rag.add(ctx, {
      namespace,
      key: createContentKey("survey", survey._id),
      text: content,
      filterValues: [
        { name: "sourceType", value: "survey" },
        { name: "projectId", value: survey.projectId },
        { name: "teamId", value: survey.teamId },
      ],
    });

    return null;
  },
});

// ====== CONFIRMED ACTIONS ======
// These functions handle confirmed AI suggestions to create/edit various project items

export const createConfirmedTask = action({
  args: {
    projectId: v.id("projects"),
    taskData: v.object({
      title: v.string(),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      description: v.optional(v.string()),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      dueDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      cost: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Get project to obtain teamId
      const project: any = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
      if (!project) {
        throw new Error("Project not found");
      }

      // Convert dueDate string to number if provided
      let dueDateNumber: number | undefined;
      if (args.taskData.dueDate) {
        dueDateNumber = new Date(args.taskData.dueDate).getTime();
      }

      const taskId: any = await ctx.runMutation(api.tasks.createTask, {
        projectId: args.projectId,
        teamId: project.teamId,
        title: args.taskData.title,
        description: args.taskData.description,
        assignedTo: args.taskData.assignedTo,
        priority: args.taskData.priority || "medium",
        status: args.taskData.status || "todo",
        dueDate: dueDateNumber,
        tags: args.taskData.tags || [],
        cost: args.taskData.cost,
      });

      return {
        success: true,
        taskId,
        message: "Task created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create task: ${error}`,
      };
    }
  },
});

export const createConfirmedNote = action({
  args: {
    projectId: v.id("projects"),
    noteData: v.object({
      title: v.string(),
      content: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    noteId: v.optional(v.id("notes")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const noteId: any = await ctx.runMutation(api.notes.createNote, {
        projectId: args.projectId,
        title: args.noteData.title,
        content: args.noteData.content,
      });

      return {
        success: true,
        noteId,
        message: "Note created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create note: ${error}`,
      };
    }
  },
});

export const createConfirmedShoppingItem = action({
  args: {
    projectId: v.id("projects"),
    itemData: v.object({
      name: v.string(),
      quantity: v.number(),
      notes: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      buyBefore: v.optional(v.string()),
      supplier: v.optional(v.string()),
      category: v.optional(v.string()),
      unitPrice: v.optional(v.number()),
      sectionId: v.optional(v.id("shoppingListSections")),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    itemId: v.optional(v.id("shoppingListItems")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert buyBefore string to number if provided
      let buyBeforeNumber: number | undefined;
      if (args.itemData.buyBefore) {
        buyBeforeNumber = new Date(args.itemData.buyBefore).getTime();
      }

      const itemId: any = await ctx.runMutation(api.shopping.createShoppingListItem, {
        projectId: args.projectId,
        name: args.itemData.name,
        quantity: args.itemData.quantity,
        notes: args.itemData.notes,
        priority: args.itemData.priority || "medium",
        buyBefore: buyBeforeNumber,
        supplier: args.itemData.supplier,
        category: args.itemData.category,
        unitPrice: args.itemData.unitPrice,
        realizationStatus: "PLANNED", // Default status for AI-created items
        sectionId: args.itemData.sectionId,
      });

      return {
        success: true,
        itemId,
        message: "Shopping item created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create shopping item: ${error}`,
      };
    }
  },
});

export const createConfirmedSurvey = action({
  args: {
    projectId: v.id("projects"),
    surveyData: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      isRequired: v.optional(v.boolean()),
      allowMultipleResponses: v.optional(v.boolean()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      targetAudience: v.optional(v.union(v.literal("all_customers"), v.literal("specific_customers"), v.literal("team_members"))),
      targetCustomerIds: v.optional(v.array(v.string())),
      questions: v.optional(v.array(v.object({
        questionText: v.string(),
        questionType: v.union(v.literal("text_short"), v.literal("text_long"), v.literal("multiple_choice"), v.literal("single_choice"), v.literal("rating"), v.literal("yes_no"), v.literal("number"), v.literal("file")),
        options: v.optional(v.array(v.string())),
        isRequired: v.optional(v.boolean()),
      }))),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    surveyId: v.optional(v.id("surveys")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert date strings to numbers if provided
      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.surveyData.startDate) {
        startDateNumber = new Date(args.surveyData.startDate).getTime();
      }
      if (args.surveyData.endDate) {
        endDateNumber = new Date(args.surveyData.endDate).getTime();
      }

      const surveyId: any = await ctx.runMutation(api.surveys.createSurvey, {
        projectId: args.projectId,
        title: args.surveyData.title,
        description: args.surveyData.description,
        isRequired: args.surveyData.isRequired || false,
        targetAudience: (args.surveyData.targetAudience as "all_customers" | "specific_customers" | "team_members") || "all_customers",
        allowMultipleResponses: args.surveyData.allowMultipleResponses || false,
        startDate: startDateNumber,
        endDate: endDateNumber,
        targetCustomerIds: args.surveyData.targetCustomerIds,
      });

      // Create questions if provided
      if (args.surveyData.questions && args.surveyData.questions.length > 0) {
        for (let i = 0; i < args.surveyData.questions.length; i++) {
          const question = args.surveyData.questions[i];
          await ctx.runMutation(api.surveys.createSurveyQuestion, {
            surveyId,
            questionText: question.questionText,
            questionType: question.questionType as "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file",
            options: question.options,
            isRequired: question.isRequired ?? true,
            order: i + 1, // Questions numbered from 1
          });
        }
      }

      const questionCount = args.surveyData.questions?.length || 0;
      const message = questionCount > 0
        ? `Survey created successfully with ${questionCount} questions`
        : "Survey created successfully";

      return {
        success: true,
        surveyId,
        message,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create survey: ${error}`,
      };
    }
  },
});

export const createConfirmedContact = action({
  args: {
    teamSlug: v.string(),
    contactData: v.object({
      name: v.string(),
      companyName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      website: v.optional(v.string()),
      taxId: v.optional(v.string()),
      type: v.union(v.literal("contractor"), v.literal("supplier"), v.literal("subcontractor"), v.literal("other")),
      notes: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    contactId: v.optional(v.id("contacts")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const contactId: any = await ctx.runMutation(api.contacts.createContact, {
        teamSlug: args.teamSlug,
        name: args.contactData.name,
        companyName: args.contactData.companyName,
        email: args.contactData.email,
        phone: args.contactData.phone,
        address: args.contactData.address,
        city: args.contactData.city,
        postalCode: args.contactData.postalCode,
        website: args.contactData.website,
        taxId: args.contactData.taxId,
        type: args.contactData.type,
        notes: args.contactData.notes,
      });

      return {
        success: true,
        contactId,
        message: "Contact created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create contact: ${error}`,
      };
    }
  },
});

// ====== EDIT CONFIRMED ACTIONS ======
// Note: These functions are temporarily simplified to avoid complex type mapping
// TODO: Implement proper update functions that match the actual mutation signatures

// ====== THREAD MANAGEMENT FOR RESPONSES API ======

export const createThread = action({
  args: {
    projectId: v.id("projects"),
    userClerkId: v.string(), // Add missing validator
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Generate unique thread ID
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Create thread in database using the consistent thread manager
    await ctx.runMutation(internal.ai.threads.getOrCreateThread, {
      threadId,
      projectId: args.projectId,
      userClerkId: identity.subject,
    });

    return threadId;
  },
});

export const editConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      dueDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      cost: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert dueDate string to number if provided
      let dueDateNumber: number | undefined;
      if (args.updates.dueDate) {
        dueDateNumber = new Date(args.updates.dueDate).getTime();
      }

      await ctx.runMutation(api.tasks.updateTask, {
        taskId: args.taskId,
        title: args.updates.title,
        description: args.updates.description,
        status: args.updates.status,
        assignedTo: args.updates.assignedTo,
        priority: args.updates.priority,
        dueDate: dueDateNumber,
        tags: args.updates.tags,
        cost: args.updates.cost,
      });

      return {
        success: true,
        message: "Task updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update task: ${error}`,
      };
    }
  },
});

export const editConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    updates: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Get current note to preserve existing values if not updating
      const currentNote = await ctx.runQuery(api.notes.getNote, { noteId: args.noteId });
      if (!currentNote) {
        return {
          success: false,
          message: "Note not found",
        };
      }

      await ctx.runMutation(api.notes.updateNote, {
        noteId: args.noteId,
        title: args.updates.title || currentNote.title,
        content: args.updates.content || currentNote.content,
      });

      return {
        success: true,
        message: "Note updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update note: ${error}`,
      };
    }
  },
});

export const editConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    updates: v.object({
      name: v.optional(v.string()),
      notes: v.optional(v.string()),
      buyBefore: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      imageUrl: v.optional(v.string()),
      productLink: v.optional(v.string()),
      supplier: v.optional(v.string()),
      catalogNumber: v.optional(v.string()),
      category: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      quantity: v.optional(v.number()),
      unitPrice: v.optional(v.number()),
      realizationStatus: v.optional(v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED"))),
      sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
      assignedTo: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert buyBefore string to number if provided
      let buyBeforeNumber: number | undefined;
      if (args.updates.buyBefore) {
        buyBeforeNumber = new Date(args.updates.buyBefore).getTime();
      }

      await ctx.runMutation(api.shopping.updateShoppingListItem, {
        itemId: args.itemId,
        name: args.updates.name,
        notes: args.updates.notes,
        buyBefore: buyBeforeNumber,
        priority: args.updates.priority,
        imageUrl: args.updates.imageUrl,
        productLink: args.updates.productLink,
        supplier: args.updates.supplier,
        catalogNumber: args.updates.catalogNumber,
        category: args.updates.category,
        dimensions: args.updates.dimensions,
        quantity: args.updates.quantity,
        unitPrice: args.updates.unitPrice,
        realizationStatus: args.updates.realizationStatus,
        sectionId: args.updates.sectionId,
        assignedTo: args.updates.assignedTo,
      });

      return {
        success: true,
        message: "Shopping item updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update shopping item: ${error}`,
      };
    }
  },
});

export const editConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      isRequired: v.optional(v.boolean()),
      allowMultipleResponses: v.optional(v.boolean()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      targetAudience: v.optional(v.union(
        v.literal("all_customers"),
        v.literal("specific_customers"),
        v.literal("team_members")
      )),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert date strings to numbers if provided
      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.updates.startDate) {
        startDateNumber = new Date(args.updates.startDate).getTime();
      }
      if (args.updates.endDate) {
        endDateNumber = new Date(args.updates.endDate).getTime();
      }

      await ctx.runMutation(api.surveys.updateSurvey, {
        surveyId: args.surveyId,
        title: args.updates.title,
        description: args.updates.description,
        isRequired: args.updates.isRequired,
        allowMultipleResponses: args.updates.allowMultipleResponses,
        startDate: startDateNumber,
        endDate: endDateNumber,
        targetAudience: args.updates.targetAudience as "all_customers" | "specific_customers" | "team_members" | undefined,
      });

      return {
        success: true,
        message: "Survey updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update survey: ${error}`,
      };
    }
  },
});

// ====== DELETE CONFIRMED ACTIONS ======
// These functions handle confirmed AI suggestions to delete various project items

export const deleteConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.tasks.deleteTask, {
        taskId: args.taskId,
      });

      return {
        success: true,
        message: "Task deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete task: ${error}`,
      };
    }
  },
});

export const deleteConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.notes.deleteNote, {
        noteId: args.noteId,
      });

      return {
        success: true,
        message: "Note deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete note: ${error}`,
      };
    }
  },
});

export const deleteConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.shopping.deleteShoppingListItem, {
        itemId: args.itemId,
      });

      return {
        success: true,
        message: "Shopping item deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete shopping item: ${error}`,
      };
    }
  },
});

export const deleteConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    title: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.surveys.deleteSurvey, {
        surveyId: args.surveyId,
      });

      return {
        success: true,
        message: `Survey "${args.title}" deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete survey: ${error}`,
      };
    }
  },
});

export const deleteConfirmedContact = action({
  args: {
    contactId: v.id("contacts"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.contacts.deleteContact, {
        contactId: args.contactId,
      });

      return {
        success: true,
        message: "Contact deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete contact: ${error}`,
      };
    }
  },
});

// ====== AUTO-INDEXING SYSTEM ======
// Smart index update that handles create/update/delete operations automatically

export const smartIndexUpdate = internalAction({
  args: {
    projectId: v.id("projects"),
    entityType: v.union(v.literal("task"), v.literal("note"), v.literal("shopping_item"), v.literal("contact"), v.literal("survey"), v.literal("survey_response")),
    entityId: v.string(),
    operation: v.union(v.literal("create"), v.literal("update"), v.literal("delete"))
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Check if auto-indexing is enabled for this project
      const aiSettings = await ctx.runQuery(internal.ai.settings.getAISettingsInternal, {
        projectId: args.projectId
      });

      if (!aiSettings?.isEnabled || !aiSettings?.indexingEnabled) {
        console.log(`Auto-indexing disabled for project ${args.projectId}, skipping`);
        return null;
      }

      const namespace = getProjectNamespace(args.projectId);
      const key = createContentKey(args.entityType, args.entityId);

      if (args.operation === "delete") {
        // For delete operations, use Convex RAG's replacement mechanism
        // Add a "deleted" entry with the same key to replace the old one
        try {
          const deletedContent = `[DELETED] This ${args.entityType} was removed from project: ${args.entityId}`;

          await rag.add(ctx, {
            namespace,
            key, // Same key = automatic replacement of old content
            text: deletedContent,
            filterValues: [
              { name: "sourceType", value: `deleted_${args.entityType}` },
              { name: "projectId", value: args.projectId },
              { name: "teamId", value: aiSettings.teamId },
            ],
            metadata: {
              entityType: `deleted_${args.entityType}`,
              entityId: args.entityId,
              lastUpdated: Date.now(),
              operation: "delete",
              isDeleted: true
            }
          });

          console.log(`✅ Marked as deleted in RAG index: ${key}`);
        } catch (error) {
          console.warn(`Failed to mark as deleted in RAG index: ${key}`, error);
        }
        return null;
      }

      // Get fresh content for create/update operations
      const content = await getFreshEntityContent(ctx, args.entityType, args.entityId, args.projectId);
      if (!content) {
        console.warn(`No content found for ${args.entityType} ${args.entityId}, skipping index`);
        return null;
      }

      // Add/Replace content - Convex handles lifecycle automatically via key-based replacement
      const result = await rag.add(ctx, {
        namespace,
        key, // Same key = automatic replacement of old content
        text: content,
        filterValues: [
          { name: "sourceType", value: args.entityType },
          { name: "projectId", value: args.projectId },
          { name: "teamId", value: aiSettings.teamId },
        ],
        metadata: {
          entityType: args.entityType,
          entityId: args.entityId,
          lastUpdated: Date.now(),
          operation: args.operation
        }
      });

      // Log the result for monitoring
      if (result.replacedEntry) {
        console.log(`✅ Replaced content in index: ${key}`);
      } else {
        console.log(`✅ Added new content to index: ${key}`);
      }

      // Update lastAutoIndexAt timestamp
      await ctx.runMutation(internal.ai.settings.updateLastAutoIndex, {
        projectId: args.projectId
      });

    } catch (error) {
      console.error(`Error in smartIndexUpdate for ${args.entityType} ${args.entityId}:`, error);
      // Don't throw - we don't want to break the main operation if indexing fails
    }

    return null;
  }
});

// Helper function to get fresh content for any entity type
async function getFreshEntityContent(ctx: any, entityType: string, entityId: string, projectId?: string): Promise<string | null> {
  try {
    switch (entityType) {
      case "task":
        const task = await ctx.runQuery(internal.rag.getTaskById, { taskId: entityId });
        if (!task) return null;
        return [
          `Task: ${task.title}`,
          task.description ? `Description: ${task.description}` : '',
          task.content ? `Content: ${task.content}` : '',
          `Status: ${task.status}`,
          task.priority ? `Priority: ${task.priority}` : '',
          task.assignedToName ? `Assigned to: ${task.assignedToName}` : 'Unassigned',
          task.tags?.length > 0 ? `Tags: ${task.tags.join(', ')}` : '',
          task.cost ? `Cost: $${task.cost}` : '',
          task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : '',
        ].filter(Boolean).join('\n');

      case "note":
        const note = await ctx.runQuery(internal.rag.getNoteById, { noteId: entityId });
        if (!note) return null;
        return [
          `Note: ${note.title}`,
          `Content: ${note.content}`,
        ].join('\n');

      case "shopping_item":
        const item = await ctx.runQuery(internal.rag.getShoppingItemById, { itemId: entityId });
        if (!item) return null;
        return [
          `Shopping Item: ${item.name}`,
          item.notes ? `Notes: ${item.notes}` : '',
          item.category ? `Category: ${item.category}` : '',
          item.supplier ? `Supplier: ${item.supplier}` : '',
          item.dimensions ? `Dimensions: ${item.dimensions}` : '',
          `Status: ${item.realizationStatus}`,
          `Quantity: ${item.quantity}`,
          item.unitPrice ? `Unit Price: $${item.unitPrice}` : '',
          item.totalPrice ? `Total Price: $${item.totalPrice}` : '',
        ].filter(Boolean).join('\n');

      case "contact":
        const contact = await ctx.runQuery(internal.rag.getContactById, { contactId: entityId });
        if (!contact) return null;
        return [
          `Contact: ${contact.name}`,
          contact.companyName ? `Company: ${contact.companyName}` : '',
          contact.email ? `Email: ${contact.email}` : '',
          contact.phone ? `Phone: ${contact.phone}` : '',
          contact.address ? `Address: ${contact.address}` : '',
          `Type: ${contact.type}`,
          contact.notes ? `Notes: ${contact.notes}` : '',
        ].filter(Boolean).join('\n');

      case "survey":
        const survey = await ctx.runQuery(internal.rag.getSurveyById, { surveyId: entityId });
        if (!survey) return null;

        // Get survey questions for better search context
        const questions = await ctx.runQuery(internal.rag.getSurveyQuestionsById, { surveyId: entityId });

        let content = [
          `Survey: ${survey.title}`,
          survey.description ? `Description: ${survey.description}` : '',
          `Status: ${survey.status}`,
          `Target: ${survey.targetAudience}`,
          `Required: ${survey.isRequired ? 'Yes' : 'No'}`,
          `Multiple Responses: ${survey.allowMultipleResponses ? 'Yes' : 'No'}`,
        ].filter(Boolean);

        // Add questions to searchable content
        if (questions && questions.length > 0) {
          content.push(`Questions (${questions.length}):`);
          questions.forEach((q: any, index: number) => {
            content.push(`${index + 1}. ${q.questionText} (${q.questionType}${q.isRequired ? ', required' : ''})`);
            if (q.options && q.options.length > 0) {
              content.push(`   Options: ${q.options.join(', ')}`);
            }
          });
        }

        return content.join('\n');

      case "survey_response":
        // For survey responses, we need to get the full response with answers
        if (!projectId) return null;
        const surveyResponse = await ctx.runQuery(internal.surveys.getSurveyResponsesForIndexing, {
          projectId: projectId
        });
        const matchingResponse = surveyResponse.find((r: any) => r._id === entityId);
        if (!matchingResponse) return null;

        const responseContent = [
          `Survey Response: ${matchingResponse.surveyTitle}`,
          `Respondent ID: ${matchingResponse.respondentId}`,
          matchingResponse.submittedAt ? `Submitted: ${new Date(matchingResponse.submittedAt).toLocaleDateString()}` : '',
          `Status: ${matchingResponse.isComplete ? 'Complete' : 'In Progress'}`,
          `Answers:`,
          ...matchingResponse.answers.map((answer: any) => {
            let answerText = '';
            if (answer.textAnswer) answerText = answer.textAnswer;
            else if (answer.choiceAnswers) answerText = answer.choiceAnswers.join(', ');
            else if (answer.ratingAnswer !== undefined) answerText = answer.ratingAnswer.toString();
            else if (answer.numberAnswer !== undefined) answerText = answer.numberAnswer.toString();
            else answerText = 'No answer';

            return `- ${answer.questionText}: ${answerText}`;
          }),
        ].filter(Boolean);

        return responseContent.join('\n');

      default:
        console.warn(`Unknown entity type: ${entityType}`);
        return null;
    }
  } catch (error) {
    console.error(`Error fetching content for ${entityType} ${entityId}:`, error);
    return null;
  }
}
