"use node";

// WAŻNE: Sprawdzamy czy mamy klucz OpenAI
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

import { components, internal, api } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";

// Konfiguracja RAG z OpenAI embeddings + GPT-4o - wszystko na OpenAI, stabilnie!
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
      ctx.runAction(internal.ragActions.indexProjectTasks, { projectId: args.projectId }),
      ctx.runAction(internal.ragActions.indexProjectNotes, { projectId: args.projectId }),
      ctx.runAction(internal.ragActions.indexProjectShoppingItems, { projectId: args.projectId }),
      ctx.runAction(internal.ragActions.indexProjectContacts, { projectId: args.projectId }),
      ctx.runAction(internal.ragActions.indexProjectSurveys, { projectId: args.projectId }),
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
    const aiSettings = await ctx.runQuery(internal.aiSettings.getAISettingsInternal, { projectId: args.projectId });
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
        vectorScoreThreshold: 0.3, // Tylko wyniki z dobrym score
        filters: [
          { name: "projectId", value: args.projectId },
        ],
      });

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
    const aiSettings = await ctx.runQuery(internal.aiSettings.getAISettingsInternal, { projectId: task.projectId });
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

    const aiSettings = await ctx.runQuery(internal.aiSettings.getAISettingsInternal, { projectId: note.projectId });
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

    const aiSettings = await ctx.runQuery(internal.aiSettings.getAISettingsInternal, { projectId: item.projectId });
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
      type: v.union(v.literal("task"), v.literal("note"), v.literal("shopping"), v.literal("survey")),
      operation: v.union(v.literal("create"), v.literal("edit")),
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
    // Sprawdź czy AI jest włączony dla tego projektu
    const aiSettings = await ctx.runQuery(internal.aiSettings.getAISettingsInternal, { projectId: args.projectId });
    if (!aiSettings?.isEnabled) {
      throw new Error("AI RAG is not enabled for this project. Please enable it first.");
    }

    // Wyszukaj kontekst za pomocą RAG
    const ragResults: any = await ctx.runAction(api.ragActions.ragSearch, {
      projectId: args.projectId,
      query: args.message,
      limit: 10,
    });

    // Pobierz system prompt (custom lub default)
    const customPrompt = await ctx.runQuery(internal.aiPrompts.getActiveCustomPromptInternal, {
      projectId: args.projectId,
    });
    
    const systemPrompt: string = customPrompt || 
      await ctx.runQuery(api.aiPrompts.getDefaultPromptTemplate, {});

    // Ensure thread exists and get/create thread ID
    let actualThreadId = args.threadId;
    if (!actualThreadId) {
      actualThreadId = `thread_${args.projectId}_${Date.now()}`;
    }
    
    // Ensure thread exists in database
    await ctx.runMutation(internal.aiThreads.getOrCreateThread, {
      threadId: actualThreadId,
      projectId: args.projectId,
      userClerkId: args.userClerkId,
    });

    // Get team members with user details for AI context
    const teamMembers = await ctx.runQuery(internal.teams.getTeamMembersWithUserDetails, {
      projectId: args.projectId,
    });
    
    console.log(`Debug: Found ${teamMembers.length} team members for project ${args.projectId}:`, 
      teamMembers.map(m => ({ name: m.name, email: m.email, clerkUserId: m.clerkUserId }))
    );

    // Pobierz historię konwersacji
    let conversationHistory: string = "";
    const threadMessages = await ctx.runQuery(internal.aiThreads.getThreadMessages, { 
      threadId: actualThreadId,
      limit: 10 
    });
    
    if (threadMessages.length > 0) {
      conversationHistory = threadMessages.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n') + '\n\n';
    }

    // Utwórz kontekst z RAG results
    const ragContext: string = ragResults.text || "No relevant context found.";
    
    // Dodaj aktualną datę do kontekstu
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentDateTime = new Date().toLocaleString('en-US', { 
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Create team members list for AI
    const teamMembersContext = teamMembers.length > 0 
      ? `\n\nAVAILABLE TEAM MEMBERS FOR ASSIGNMENT:\n${teamMembers.map(member => 
          `- Name: "${member.name || member.email}" → Clerk ID: "${member.clerkUserId}"`
        ).join('\n')}\n\nCRITICAL: For assignedTo field, you MUST use the Clerk ID (like "${teamMembers[0]?.clerkUserId}"), NEVER use names like "Karolina" or "John". Always match the name to the correct Clerk ID from the list above!`
      : '';

    const fullPrompt = `${systemPrompt}\n\nCURRENT DATE AND TIME: ${currentDateTime} (${currentDate})\nWhen setting due dates, use this as reference for "today", "tomorrow", "next week", etc.${teamMembersContext}\n\nCONVERSATION HISTORY:\n${conversationHistory}RELEVANT CONTEXT:\n${ragContext}\n\nUSER MESSAGE: ${args.message}`;

     // Wywołaj OpenAI GPT-4o z function calling
     const startTime = Date.now();
     
     try {
       // Używamy OpenAI GPT-4o bezpośrednio - stabilne i niezawodne z function calling
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
               assignedTo: { type: "string", description: "Team member Clerk user ID (NOT name!) - must be exact ID from AVAILABLE TEAM MEMBERS list like 'user_abc123', never use names like 'Karolina'" },
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
                     assignedTo: { type: "string", description: "Team member Clerk user ID (NOT name!) - must be exact ID from AVAILABLE TEAM MEMBERS list" },
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
         }
       ];

       const result = await openaiClient.chat.completions.create({
         model: "gpt-4o",
         messages: [{ role: "user", content: fullPrompt }],
         functions: functions,
         function_call: "auto",
         max_tokens: 4000,
         temperature: 0.7,
       });

       const aiResponse = result.choices[0]?.message?.content || "";
       const functionCall = result.choices[0]?.message?.function_call;
       const responseTime = Date.now() - startTime;
       
       const tokenUsage = {
         inputTokens: result.usage?.prompt_tokens || Math.floor(fullPrompt.length / 4),
         outputTokens: result.usage?.completion_tokens || Math.floor(aiResponse.length / 4),
         totalTokens: result.usage?.total_tokens || 0,
         estimatedCostUSD: 0,
       };
       
       if (!tokenUsage.totalTokens) {
         tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
       }
       
       // GPT-4o pricing: $5/1M input tokens, $15/1M output tokens
       const inputCost = (tokenUsage.inputTokens / 1000000) * 5;
       const outputCost = (tokenUsage.outputTokens / 1000000) * 15;
       tokenUsage.estimatedCostUSD = inputCost + outputCost;
      
       // Obsłuż function call jeśli istnieje
       let finalResponse = aiResponse;
       let pendingItems: any[] = [];

       if (functionCall) {
         try {
           const functionArgs = JSON.parse(functionCall.arguments);
           
           switch (functionCall.name) {
             case "create_task":
               // Resolve assignedTo Clerk ID to user name
               if (functionArgs.assignedTo) {
                 const assignedUser = teamMembers.find(m => m.clerkUserId === functionArgs.assignedTo);
                 if (assignedUser) {
                   functionArgs.assignedToName = assignedUser.name || assignedUser.email;
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
                 // Resolve assignedTo Clerk ID to user name
                 if (task.assignedTo) {
                   const assignedUser = teamMembers.find(m => m.clerkUserId === task.assignedTo);
                   if (assignedUser) {
                     task.assignedToName = assignedUser.name || assignedUser.email;
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
           }
         } catch (error) {
           console.error("Error parsing function call:", error);
         }
       }

       // Zapisz użycie tokenów
       await ctx.runMutation(internal.aiTokenUsage.saveTokenUsage, {
         projectId: args.projectId,
         teamId: aiSettings.teamId,
         userClerkId: args.userClerkId,
         threadId: args.threadId,
         model: "gpt-4o",
         requestType: "chat",
         inputTokens: tokenUsage.inputTokens,
         outputTokens: tokenUsage.outputTokens,
         totalTokens: tokenUsage.totalTokens,
         contextSize: ragContext.length,
         mode: "rag",
         estimatedCostCents: Math.round(tokenUsage.estimatedCostUSD * 100),
         responseTimeMs: responseTime,
         success: true,
       });

       // Zapisz wiadomości do historii thread'a
       await ctx.runMutation(internal.aiThreads.saveMessagesToThread, {
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
         mode: "rag",
         contextSize: ragContext.length,
         pendingItems: pendingItems,
       };
      
    } catch (error) {
      console.error("OpenAI GPT-4o call failed:", error);
      
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
      await ctx.runMutation(internal.aiTokenUsage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: aiSettings.teamId,
        userClerkId: args.userClerkId,
        threadId: args.threadId,
        model: "gpt-4o-fallback",
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

    const aiSettings = await ctx.runQuery(internal.aiSettings.getAISettingsInternal, { projectId: survey.projectId });
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
      isRequired: v.boolean(),
      targetAudience: v.union(v.literal("all_customers"), v.literal("specific_customers"), v.literal("team_members")),
      questions: v.array(v.string()),
      description: v.optional(v.string()),
      allowMultipleResponses: v.optional(v.boolean()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    surveyId: v.optional(v.id("surveys")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const surveyId: any = await ctx.runMutation(api.surveys.createSurvey, {
        projectId: args.projectId,
        title: args.surveyData.title,
        description: args.surveyData.description,
        isRequired: args.surveyData.isRequired,
        targetAudience: args.surveyData.targetAudience as "all_customers" | "specific_customers" | "team_members",
        allowMultipleResponses: args.surveyData.allowMultipleResponses || false,
      });

      return {
        success: true,
        surveyId,
        message: "Survey created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create survey: ${error}`,
      };
    }
  },
});

// ====== EDIT CONFIRMED ACTIONS ======
// Note: These functions are temporarily simplified to avoid complex type mapping
// TODO: Implement proper update functions that match the actual mutation signatures

export const editConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    updates: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // For now, return a message that this feature needs to be implemented properly
    return {
      success: false,
      message: "Task editing via AI is not yet implemented - please edit tasks manually",
    };
  },
});

export const editConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    updates: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // For now, return a message that this feature needs to be implemented properly
    return {
      success: false,
      message: "Note editing via AI is not yet implemented - please edit notes manually",
    };
  },
});

export const editConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    updates: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // For now, return a message that this feature needs to be implemented properly
    return {
      success: false,
      message: "Shopping item editing via AI is not yet implemented - please edit items manually",
    };
  },
});

export const editConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    updates: v.any(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // For now, return a message that this feature needs to be implemented properly
    return {
      success: false,
      message: "Survey editing via AI is not yet implemented - please edit surveys manually",
    };
  },
});
