/**
 * VibePlanner AI Tools - Shared tool definitions
 *
 * This file is the SINGLE SOURCE OF TRUTH for all AI tools.
 * It exports:
 * 1. Tool schemas (Zod) - used by both streaming and agent implementations
 * 2. createStreamingTools() - for AI SDK streamText
 * 3. createAgentTools() - for Convex Agent
 *
 * Tools return JSON structures for confirmation UI, not direct actions.
 */

import { z } from "zod";

// ============================================
// TOOL SCHEMAS
// ============================================

// Task tool schemas
export const createTaskSchema = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional().describe("Task description"),
  content: z.string().optional().describe("Rich text content"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Task priority"),
  status: z.enum(["todo", "in_progress", "review", "done"]).default("todo").describe("Task status"),
  assignedTo: z.string().optional().describe("Team member name or email from TEAM MEMBERS list"),
  startDate: z.string().optional().describe("Start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). For all-day events, use midnight UTC (T00:00:00.000Z). For specific times, include the time in UTC."),
  endDate: z.string().optional().describe("End date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). For all-day events, use midnight UTC (T00:00:00.000Z). For specific times, include the time in UTC. Can be same as startDate for single-point events/reminders."),
  tags: z.array(z.string()).optional().describe("Task tags for categorization"),
});

export const createMultipleTasksSchema = z.object({
  tasks: z.array(createTaskSchema).describe("Array of tasks to create"),
});

export const editTaskSchema = z.object({
  taskId: z.string().describe("Task ID to edit"),
  title: z.string().optional().describe("New task title"),
  description: z.string().optional().describe("New task description"),
  content: z.string().optional().describe("New rich text content"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New task priority"),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional().describe("New task status"),
  assignedTo: z.string().optional().describe("Team member name or email from TEAM MEMBERS list"),
  startDate: z.string().optional().describe("New start date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). For all-day events, use midnight UTC (T00:00:00.000Z). For specific times, include the time in UTC."),
  endDate: z.string().optional().describe("New end date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). For all-day events, use midnight UTC (T00:00:00.000Z). For specific times, include the time in UTC. Can be same as startDate for single-point events/reminders."),
  tags: z.array(z.string()).optional().describe("New task tags"),
});

export const editMultipleTasksSchema = z.object({
  tasks: z.array(editTaskSchema).describe("Array of tasks to edit with their updates"),
});

export const deleteTaskSchema = z.object({
  taskId: z.string().describe("Task ID to delete"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Note tool schemas
export const createNoteSchema = z.object({
  title: z.string().describe("Note title"),
  content: z.string().describe("Note content"),
});

export const createMultipleNotesSchema = z.object({
  notes: z.array(createNoteSchema).describe("Array of notes to create"),
});

export const editNoteSchema = z.object({
  noteId: z.string().describe("Note ID to edit"),
  title: z.string().optional().describe("New note title"),
  content: z.string().optional().describe("New note content"),
});

export const editMultipleNotesSchema = z.object({
  notes: z.array(editNoteSchema).describe("Array of notes to edit with their updates"),
});

export const deleteNoteSchema = z.object({
  noteId: z.string().describe("Note ID to delete"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Shopping tool schemas
export const createShoppingSectionSchema = z.object({
  name: z.string().describe("Section name"),
});

export const editShoppingSectionSchema = z.object({
  sectionId: z.string().describe("Section ID to edit"),
  name: z.string().describe("New section name"),
});

export const deleteShoppingSectionSchema = z.object({
  sectionId: z.string().describe("Section ID to delete"),
});

export const createShoppingItemSchema = z.object({
  name: z.string().describe("Item name"),
  notes: z.string().optional().describe("Additional notes or description"),
  quantity: z.number().default(1).describe("Quantity needed"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Item priority"),
  buyBefore: z.string().optional().describe("Buy before date in ISO format (YYYY-MM-DD)"),
  supplier: z.string().optional().describe("Supplier or store name"),
  category: z.string().optional().describe("Item category (e.g., Electronics, Furniture)"),
  dimensions: z.string().optional().describe("Item dimensions or size"),
  unitPrice: z.number().optional().describe("Price per unit"),
  totalPrice: z.number().optional().describe("Total price (quantity × unit price)"),
  productLink: z.string().optional().describe("Link to product page"),
  catalogNumber: z.string().optional().describe("Product catalog/model number"),
  sectionId: z.string().optional().describe("Shopping list section ID"),
  sectionName: z.string().optional().describe("Shopping list section name (e.g., Kitchen, Bathroom)"),
});

export const createMultipleShoppingItemsSchema = z.object({
  items: z.array(createShoppingItemSchema).describe("Array of shopping items to create"),
});

export const editShoppingItemSchema = z.object({
  itemId: z.string().describe("Shopping item ID to edit"),
  name: z.string().optional().describe("New item name"),
  notes: z.string().optional().describe("New notes"),
  quantity: z.number().optional().describe("New quantity"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().describe("New priority"),
  buyBefore: z.string().optional().describe("New buy before date"),
  supplier: z.string().optional().describe("New supplier"),
  category: z.string().optional().describe("New category"),
  unitPrice: z.number().optional().describe("New unit price"),
});

export const editMultipleShoppingItemsSchema = z.object({
  items: z.array(editShoppingItemSchema).describe("Array of shopping items to edit"),
});

export const deleteShoppingItemSchema = z.object({
  itemId: z.string().describe("Shopping item ID to delete"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Survey tool schemas
export const createSurveySchema = z.object({
  title: z.string().describe("Survey title"),
  description: z.string().optional().describe("Survey description"),
  isRequired: z.boolean().default(false).describe("Whether survey is required for customers"),
  allowMultipleResponses: z.boolean().default(false).describe("Allow multiple responses from same person"),
  startDate: z.string().optional().describe("Survey start date in ISO format (YYYY-MM-DD)"),
  endDate: z.string().optional().describe("Survey end date in ISO format (YYYY-MM-DD)"),
  targetAudience: z.enum(["all_customers", "specific_customers", "team_members"]).default("all_customers").describe("Who should take this survey"),
  targetCustomerIds: z.array(z.string()).optional().describe("Specific customer IDs (only if targetAudience is 'specific_customers')"),
  questions: z.array(z.object({
    questionText: z.string().describe("The question text"),
    questionType: z.enum(["text_short", "text_long", "multiple_choice", "single_choice", "rating", "yes_no", "number", "file"]).default("text_short").describe("Type of question"),
    options: z.array(z.string()).optional().describe("Options for multiple_choice or single_choice questions"),
    isRequired: z.boolean().default(true).describe("Whether this question is required"),
  })).optional().describe("Array of survey questions to create"),
});

export const createMultipleSurveysSchema = z.object({
  surveys: z.array(z.object({
    title: z.string().describe("Survey title"),
    description: z.string().optional().describe("Survey description"),
    isRequired: z.boolean().optional().describe("Whether survey is required"),
    targetAudience: z.enum(["all_customers", "specific_customers", "team_members"]).optional().describe("Target audience"),
  })).describe("Array of surveys to create"),
});

export const editSurveySchema = z.object({
  surveyId: z.string().describe("Survey ID to edit"),
  title: z.string().optional().describe("New survey title"),
  description: z.string().optional().describe("New survey description"),
  isRequired: z.boolean().optional().describe("Whether survey is required"),
  targetAudience: z.enum(["all_customers", "specific_customers", "team_members"]).optional().describe("New target audience"),
});

export const editMultipleSurveysSchema = z.object({
  surveys: z.array(editSurveySchema).describe("Array of surveys to edit"),
});

export const deleteSurveySchema = z.object({
  surveyId: z.string().describe("Survey ID to delete"),
  title: z.string().describe("Survey title for confirmation dialog"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Contact tool schemas
export const createContactSchema = z.object({
  name: z.string().describe("Contact name"),
  companyName: z.string().optional().describe("Company name"),
  email: z.string().optional().describe("Email address"),
  phone: z.string().optional().describe("Phone number"),
  address: z.string().optional().describe("Physical address"),
  city: z.string().optional().describe("City"),
  postalCode: z.string().optional().describe("Postal code"),
  website: z.string().optional().describe("Website URL"),
  taxId: z.string().optional().describe("Tax ID or company registration number"),
  type: z.enum(["contractor", "supplier", "subcontractor", "other"]).default("contractor").describe("Contact type"),
  notes: z.string().optional().describe("Additional notes about the contact"),
});

export const deleteContactSchema = z.object({
  contactId: z.string().describe("Contact ID to delete"),
  reason: z.string().optional().describe("Optional reason for deletion"),
});

// Search tool schemas
export const searchTasksSchema = z.object({
  query: z.string().optional().describe("Search query - can be title, description, assignee name, or any task details"),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional().describe("Filter by status"),
  limit: z.number().optional().default(10).describe("Maximum number of results to return"),
});

export const searchShoppingItemsSchema = z.object({
  query: z.string().optional().describe("Search query - can be item name, category, section, supplier, or any item details"),
  sectionName: z.string().optional().describe("Filter by section name"),
  limit: z.number().optional().default(10).describe("Maximum number of results to return"),
});

export const searchNotesSchema = z.object({
  query: z.string().optional().describe("Search query - can be note title or content keywords"),
  includeArchived: z.boolean().optional().describe("Include archived notes in the results"),
  limit: z.number().optional().default(10).describe("Maximum number of results to return"),
});

export const searchSurveysSchema = z.object({
  query: z.string().optional().describe("Search query - can be survey title or description keywords"),
  status: z.enum(["draft", "active", "closed"]).optional().describe("Filter by survey status"),
  limit: z.number().optional().default(10).describe("Maximum number of results to return"),
});

export const searchContactsSchema = z.object({
  query: z.string().optional().describe("Search query - can be contact name, company, email, phone, or notes"),
  contactType: z.enum(["contractor", "supplier", "subcontractor", "other"]).optional().describe("Filter by contact type"),
  limit: z.number().optional().default(10).describe("Maximum number of results to return"),
});

export const loadFullProjectContextSchema = z.object({
  reason: z.string().optional().describe("Why you need the full context (for logging and debugging)"),
});

// ============================================
// AI SDK TOOLS (for streaming)
// ============================================

/**
 * Create tools in AI SDK format for use with streamText
 * Using inputSchema (AI SDK v5) instead of parameters
 */
export function createStreamingTools(options?: {
  projectId?: string;
  runAction?: (action: any, args: any) => Promise<any>;
  loadSnapshot?: () => Promise<any>;
}) {
  return {
    // Task tools
    create_task: {
      description: "Create a new task in the project",
      inputSchema: createTaskSchema,
      execute: async (args: z.infer<typeof createTaskSchema>) => {
        return JSON.stringify({ type: "task", operation: "create", data: args });
      },
    },
    create_multiple_tasks: {
      description: "Create multiple tasks at once (use when creating 2+ tasks)",
      inputSchema: createMultipleTasksSchema,
      execute: async (args: z.infer<typeof createMultipleTasksSchema>) => {
        return JSON.stringify({ type: "task", operation: "bulk_create", data: args });
      },
    },
    edit_task: {
      description: "Edit/update an existing task in the project",
      inputSchema: editTaskSchema,
      execute: async (args: z.infer<typeof editTaskSchema>) => {
        return JSON.stringify({ type: "task", operation: "edit", data: args });
      },
    },
    edit_multiple_tasks: {
      description: "Edit/update multiple tasks at once (use when editing 2+ tasks)",
      inputSchema: editMultipleTasksSchema,
      execute: async (args: z.infer<typeof editMultipleTasksSchema>) => {
        return JSON.stringify({ type: "task", operation: "bulk_edit", data: args });
      },
    },
    delete_task: {
      description: "Delete/remove a task from the project",
      inputSchema: deleteTaskSchema,
      execute: async (args: z.infer<typeof deleteTaskSchema>) => {
        return JSON.stringify({ type: "task", operation: "delete", data: args });
      },
    },

    // Note tools
    create_note: {
      description: "Create a new note in the project",
      inputSchema: createNoteSchema,
      execute: async (args: z.infer<typeof createNoteSchema>) => {
        return JSON.stringify({ type: "note", operation: "create", data: args });
      },
    },
    create_multiple_notes: {
      description: "Create multiple notes at once (use when creating 2+ notes)",
      inputSchema: createMultipleNotesSchema,
      execute: async (args: z.infer<typeof createMultipleNotesSchema>) => {
        return JSON.stringify({ type: "note", operation: "bulk_create", data: args });
      },
    },
    edit_note: {
      description: "Edit/update an existing note in the project",
      inputSchema: editNoteSchema,
      execute: async (args: z.infer<typeof editNoteSchema>) => {
        return JSON.stringify({ type: "note", operation: "edit", data: args });
      },
    },
    edit_multiple_notes: {
      description: "Edit/update multiple notes at once (use when editing 2+ notes)",
      inputSchema: editMultipleNotesSchema,
      execute: async (args: z.infer<typeof editMultipleNotesSchema>) => {
        return JSON.stringify({ type: "note", operation: "bulk_edit", data: args });
      },
    },
    delete_note: {
      description: "Delete/remove a note from the project",
      inputSchema: deleteNoteSchema,
      execute: async (args: z.infer<typeof deleteNoteSchema>) => {
        return JSON.stringify({ type: "note", operation: "delete", data: args });
      },
    },

    // Shopping tools
    create_shopping_section: {
      description: "Create a new shopping list section",
      inputSchema: createShoppingSectionSchema,
      execute: async (args: z.infer<typeof createShoppingSectionSchema>) => {
        return JSON.stringify({ type: "shoppingSection", operation: "create", data: args });
      },
    },
    edit_shopping_section: {
      description: "Rename an existing shopping list section",
      inputSchema: editShoppingSectionSchema,
      execute: async (args: z.infer<typeof editShoppingSectionSchema>) => {
        return JSON.stringify({ type: "shoppingSection", operation: "edit", data: args });
      },
    },
    delete_shopping_section: {
      description: "Delete a shopping list section",
      inputSchema: deleteShoppingSectionSchema,
      execute: async (args: z.infer<typeof deleteShoppingSectionSchema>) => {
        return JSON.stringify({ type: "shoppingSection", operation: "delete", data: args });
      },
    },
    create_shopping_item: {
      description: "Create a new shopping list item",
      inputSchema: createShoppingItemSchema,
      execute: async (args: z.infer<typeof createShoppingItemSchema>) => {
        return JSON.stringify({ type: "shopping", operation: "create", data: args });
      },
    },
    create_multiple_shopping_items: {
      description: "Create multiple shopping items at once (use when creating 2+ items)",
      inputSchema: createMultipleShoppingItemsSchema,
      execute: async (args: z.infer<typeof createMultipleShoppingItemsSchema>) => {
        return JSON.stringify({ type: "shopping", operation: "bulk_create", data: args });
      },
    },
    edit_shopping_item: {
      description: "Edit/update an existing shopping item",
      inputSchema: editShoppingItemSchema,
      execute: async (args: z.infer<typeof editShoppingItemSchema>) => {
        return JSON.stringify({ type: "shopping", operation: "edit", data: args });
      },
    },
    edit_multiple_shopping_items: {
      description: "Edit/update multiple shopping items at once (use when editing 2+ items)",
      inputSchema: editMultipleShoppingItemsSchema,
      execute: async (args: z.infer<typeof editMultipleShoppingItemsSchema>) => {
        return JSON.stringify({ type: "shopping", operation: "bulk_edit", data: args });
      },
    },
    delete_shopping_item: {
      description: "Delete/remove an item from the shopping list",
      inputSchema: deleteShoppingItemSchema,
      execute: async (args: z.infer<typeof deleteShoppingItemSchema>) => {
        return JSON.stringify({ type: "shopping", operation: "delete", data: args });
      },
    },

    // Survey tools
    create_survey: {
      description: "Create a new survey for the project",
      inputSchema: createSurveySchema,
      execute: async (args: z.infer<typeof createSurveySchema>) => {
        return JSON.stringify({ type: "survey", operation: "create", data: args });
      },
    },
    create_multiple_surveys: {
      description: "Create multiple surveys at once (use when creating 2+ surveys)",
      inputSchema: createMultipleSurveysSchema,
      execute: async (args: z.infer<typeof createMultipleSurveysSchema>) => {
        return JSON.stringify({ type: "survey", operation: "bulk_create", data: args });
      },
    },
    edit_survey: {
      description: "Edit/update an existing survey",
      inputSchema: editSurveySchema,
      execute: async (args: z.infer<typeof editSurveySchema>) => {
        return JSON.stringify({ type: "survey", operation: "edit", data: args });
      },
    },
    edit_multiple_surveys: {
      description: "Edit/update multiple surveys at once (use when editing 2+ surveys)",
      inputSchema: editMultipleSurveysSchema,
      execute: async (args: z.infer<typeof editMultipleSurveysSchema>) => {
        return JSON.stringify({ type: "survey", operation: "bulk_edit", data: args });
      },
    },
    delete_survey: {
      description: "Delete/remove a survey from the project",
      inputSchema: deleteSurveySchema,
      execute: async (args: z.infer<typeof deleteSurveySchema>) => {
        return JSON.stringify({ type: "survey", operation: "delete", data: args });
      },
    },

    // Contact tools
    create_contact: {
      description: "Create a new contact (contractor, supplier, etc.)",
      inputSchema: createContactSchema,
      execute: async (args: z.infer<typeof createContactSchema>) => {
        return JSON.stringify({ type: "contact", operation: "create", data: args });
      },
    },
    delete_contact: {
      description: "Delete/remove a contact from the project",
      inputSchema: deleteContactSchema,
      execute: async (args: z.infer<typeof deleteContactSchema>) => {
        return JSON.stringify({ type: "contact", operation: "delete", data: args });
      },
    },

    // Search tools
    search_tasks: {
      description: "Search for tasks in the project. Use this when you need to find specific tasks or get information about existing tasks (e.g., to edit them, check their status, or reference them).",
      inputSchema: searchTasksSchema,
      execute: async (args: z.infer<typeof searchTasksSchema>) => {
        console.log("🔍 Tool 'search_tasks' invoked with:", args);
        if (!options?.projectId || !options?.runAction) {
          console.error("❌ Search not available - missing project context");
          return JSON.stringify({ error: "Search not available - missing project context" });
        }
        try {
          const { internal } = await import("../_generated/api");
          const result = await options.runAction(internal.ai.search.searchTasks, {
            projectId: options.projectId as any,
            ...args,
          });
          console.log(`✅ Tool 'search_tasks' completed. Found ${result.count} tasks.`);
          return JSON.stringify({
            found: result.count,
            total: result.total,
            tasks: result.tasks.map((t: any) => ({
              id: t._id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              assignedToName: t.assignedToName,
              startDate: t.startDate,
              endDate: t.endDate,
              tags: t.tags,
            })),
          });
        } catch (error) {
          console.error("❌ Tool 'search_tasks' failed:", error);
          return JSON.stringify({ error: "Failed to search tasks", details: (error as Error).message });
        }
      },
    },

    search_shopping_items: {
      description: "Search for shopping list items in the project. Use this when you need to find specific items or get information about existing shopping items.",
      inputSchema: searchShoppingItemsSchema,
      execute: async (args: z.infer<typeof searchShoppingItemsSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }
        const { internal } = await import("../_generated/api");
        const result = await options.runAction(internal.ai.search.searchShoppingItems, {
          projectId: options.projectId as any,
          ...args,
        });
        return JSON.stringify({
          found: result.count,
          total: result.total,
          items: result.items.map((item: any) => ({
            id: item._id,
            name: item.name,
            quantity: item.quantity,
            notes: item.notes,
            category: item.category,
            supplier: item.supplier,
            priority: item.priority,
            sectionId: item.sectionId,
            sectionName: item.sectionName,
          })),
        });
      },
    },

    search_notes: {
      description: "Search for project notes by title or content.",
      inputSchema: searchNotesSchema,
      execute: async (args: z.infer<typeof searchNotesSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }
        const { internal } = await import("../_generated/api");
        const result = await options.runAction(internal.ai.search.searchNotes, {
          projectId: options.projectId as any,
          ...args,
        });
        return JSON.stringify({
          found: result.count,
          total: result.total,
          notes: result.notes.map((note: any) => ({
            id: note._id,
            title: note.title,
            content: note.content,
            isArchived: note.isArchived ?? false,
            updatedAt: note.updatedAt,
            createdAt: note.createdAt,
          })),
        });
      },
    },

    search_surveys: {
      description: "Search for surveys in the project to review or edit them.",
      inputSchema: searchSurveysSchema,
      execute: async (args: z.infer<typeof searchSurveysSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }
        const { internal } = await import("../_generated/api");
        const result = await options.runAction(internal.ai.search.searchSurveys, {
          projectId: options.projectId as any,
          ...args,
        });
        return JSON.stringify({
          found: result.count,
          total: result.total,
          surveys: result.surveys.map((survey: any) => ({
            id: survey._id,
            title: survey.title,
            description: survey.description,
            status: survey.status,
            isRequired: survey.isRequired,
            allowMultipleResponses: survey.allowMultipleResponses,
            startDate: survey.startDate,
            endDate: survey.endDate,
          })),
        });
      },
    },

    search_contacts: {
      description: "Search for project contacts such as contractors or suppliers.",
      inputSchema: searchContactsSchema,
      execute: async (args: z.infer<typeof searchContactsSchema>) => {
        if (!options?.projectId || !options?.runAction) {
          return JSON.stringify({ error: "Search not available - missing project context" });
        }
        const { internal } = await import("../_generated/api");
        const result = await options.runAction(internal.ai.search.searchContacts, {
          projectId: options.projectId as any,
          ...args,
        });
        return JSON.stringify({
          found: result.count,
          total: result.total,
          contacts: result.contacts.map((contact: any) => ({
            id: contact._id,
            name: contact.name,
            companyName: contact.companyName,
            email: contact.email,
            phone: contact.phone,
            type: contact.type,
            notes: contact.notes,
          })),
        });
      },
    },

    // Full project context loading tool
    load_full_project_context: {
      description: "Load complete project overview including ALL tasks, notes, shopping items, contacts, and surveys. Use this when you need comprehensive context about the entire project (e.g., for summaries, complex queries spanning multiple areas, or when search results are insufficient). This is more expensive than targeted searches, so use it wisely. The context is cached, so multiple calls are efficient.",
      inputSchema: loadFullProjectContextSchema,
      execute: async (args: z.infer<typeof loadFullProjectContextSchema>) => {
        if (!options?.loadSnapshot) {
          return JSON.stringify({ 
            error: "Full context loading not available",
            suggestion: "Try using specific search tools instead (search_tasks, search_notes, etc.)"
          });
        }
        
        console.log(`🧠 AI requested full project context. Reason: ${args.reason || "not specified"}`);
        
        try {
          // Load snapshot (cached if already loaded)
          const snapshot = await options.loadSnapshot();
          
          // Format for AI consumption
          const { buildContextFromSnapshot } = await import("./helpers/contextBuilder");
          const formattedContext = buildContextFromSnapshot(snapshot);
          
          console.log("✅ Full project context loaded, returning to AI...");
          
          // Truncate if too large (approx 100k tokens safe limit for output, but let's be conservative)
          // 500,000 chars is roughly 125k tokens. 
          // If the context is massive, we should truncate it to avoid timeouts/errors.
          let finalContext = formattedContext;
          if (finalContext.length > 500000) {
             console.warn(`⚠️ Context too large (${finalContext.length} chars), truncating...`);
             finalContext = finalContext.substring(0, 500000) + "\n...[TRUNCATED due to size]...";
          }

          return JSON.stringify({
            success: true,
            context: finalContext,
            counts: {
              tasks: snapshot.tasks.length,
              notes: snapshot.notes.length,
              shoppingItems: snapshot.shoppingItems.length,
              contacts: snapshot.contacts.length,
              surveys: snapshot.surveys.length,
            },
            summary: snapshot.summary,
            message: "Full project context loaded successfully. Use the 'context' field for detailed data.",
          });
        } catch (error) {
          console.error("Error loading full project context:", error);
          return JSON.stringify({
            error: "Failed to load full project context",
            details: (error as Error).message,
          });
        }
      },
    },
  };
}

// ============================================
// AGENT TOOLS (for Convex Agent)
// ============================================

/**
 * Create tools for Convex Agent - identical to streaming tools
 * This ensures both implementations use the same tool definitions
 */
export function createAgentTools(options?: {
  projectId?: string;
  runAction?: (action: any, args: any) => Promise<any>;
  loadSnapshot?: () => Promise<any>;
}) {
  // Return the same tools as createStreamingTools
  // Convex Agent and AI SDK use the same tool format
  return createStreamingTools(options);
}
