import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Search tools for AI Agent
 * These allow the AI to search for tasks, shopping items, etc. on-demand
 * instead of loading all data upfront
 */

export const searchTasks = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    tasks: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all tasks for the project
    const allTasks = await ctx.runQuery(internal.rag.getProjectTasks, {
      projectId: args.projectId,
    }) as any[];

    let filteredTasks: any[] = allTasks;

    // Filter by status if provided
    if (args.status) {
      filteredTasks = filteredTasks.filter((task: any) => task.status === args.status);
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredTasks = filteredTasks.filter((task: any) => {
        const titleMatch = task.title?.toLowerCase().includes(queryLower);
        const descMatch = task.description?.toLowerCase().includes(queryLower);
        const assigneeMatch = task.assignedToName?.toLowerCase().includes(queryLower);
        const tagsMatch = task.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower));
        return titleMatch || descMatch || assigneeMatch || tagsMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredTasks.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredTasks.slice(0, limit);

    return {
      count: results.length,
      total: filteredTasks.length,
      tasks: results,
    };
  },
});

export const searchShoppingItems = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    sectionName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    items: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all shopping items for the project
    const allItems = await ctx.runQuery(internal.rag.getProjectShoppingItems, {
      projectId: args.projectId,
    }) as any[];

    let filteredItems: any[] = allItems;

    // Filter by section if provided
    if (args.sectionName && args.sectionName.trim().length > 0) {
      // Get all sections
      const sections = await ctx.runQuery(api.shopping.getShoppingListSections, {
        projectId: args.projectId,
      });
      const section = sections.find((s: any) =>
        s.name.toLowerCase() === args.sectionName!.toLowerCase()
      );
      if (section) {
        filteredItems = filteredItems.filter((item: any) => item.sectionId === section._id);
      }
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => {
        const nameMatch = item.name?.toLowerCase().includes(queryLower);
        const notesMatch = item.notes?.toLowerCase().includes(queryLower);
        const categoryMatch = item.category?.toLowerCase().includes(queryLower);
        const supplierMatch = item.supplier?.toLowerCase().includes(queryLower);
        return nameMatch || notesMatch || categoryMatch || supplierMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredItems.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredItems.slice(0, limit);

    return {
      count: results.length,
      total: filteredItems.length,
      items: results,
    };
  },
});

export const searchNotes = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    notes: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const allNotes = await ctx.runQuery(internal.rag.getProjectNotes, {
      projectId: args.projectId,
    }) as any[];

    let filteredNotes: any[] = allNotes;

    if (!args.includeArchived) {
      filteredNotes = filteredNotes.filter((note: any) => !note.isArchived);
    }

    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredNotes = filteredNotes.filter((note: any) => {
        const titleMatch = note.title?.toLowerCase().includes(queryLower);
        const contentMatch = note.content?.toLowerCase().includes(queryLower);
        return titleMatch || contentMatch;
      });
    }

    filteredNotes.sort((a: any, b: any) => {
      const aTime = a.updatedAt || a.createdAt || a._creationTime || 0;
      const bTime = b.updatedAt || b.createdAt || b._creationTime || 0;
      return bTime - aTime;
    });

    const results = filteredNotes.slice(0, limit);

    return {
      count: results.length,
      total: filteredNotes.length,
      notes: results,
    };
  },
});

export const searchSurveys = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("closed")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    surveys: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const allSurveys = await ctx.runQuery(internal.rag.getProjectSurveys, {
      projectId: args.projectId,
    }) as any[];

    let filteredSurveys: any[] = allSurveys;

    if (args.status) {
      filteredSurveys = filteredSurveys.filter((survey: any) => survey.status === args.status);
    }

    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredSurveys = filteredSurveys.filter((survey: any) => {
        const titleMatch = survey.title?.toLowerCase().includes(queryLower);
        const descriptionMatch = survey.description?.toLowerCase().includes(queryLower);
        return titleMatch || descriptionMatch;
      });
    }

    filteredSurveys.sort((a: any, b: any) => {
      const aTime = a.updatedAt || a._creationTime || 0;
      const bTime = b.updatedAt || b._creationTime || 0;
      return bTime - aTime;
    });

    const results = filteredSurveys.slice(0, limit);

    return {
      count: results.length,
      total: filteredSurveys.length,
      surveys: results,
    };
  },
});

export const searchContacts = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    contactType: v.optional(v.union(
      v.literal("contractor"),
      v.literal("supplier"),
      v.literal("subcontractor"),
      v.literal("other")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    contacts: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const allContacts = await ctx.runQuery(internal.rag.getProjectContacts, {
      projectId: args.projectId,
    }) as any[];

    let filteredContacts: any[] = allContacts;

    if (args.contactType) {
      filteredContacts = filteredContacts.filter((contact: any) => contact.type === args.contactType);
    }

    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredContacts = filteredContacts.filter((contact: any) => {
        const nameMatch = contact.name?.toLowerCase().includes(queryLower);
        const companyMatch = contact.companyName?.toLowerCase().includes(queryLower);
        const emailMatch = contact.email?.toLowerCase().includes(queryLower);
        const phoneMatch = contact.phone?.toLowerCase().includes(queryLower);
        const notesMatch = contact.notes?.toLowerCase().includes(queryLower);
        return nameMatch || companyMatch || emailMatch || phoneMatch || notesMatch;
      });
    }

    filteredContacts.sort((a: any, b: any) => {
      const aTime = a._creationTime || 0;
      const bTime = b._creationTime || 0;
      if (aTime === bTime) {
        return (a.name || "").localeCompare(b.name || "");
      }
      return bTime - aTime;
    });

    const results = filteredContacts.slice(0, limit);

    return {
      count: results.length,
      total: filteredContacts.length,
      contacts: results,
    };
  },
});

export const searchLaborItems = internalAction({
  args: {
    projectId: v.id("projects"),
    query: v.optional(v.string()),
    sectionName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    total: v.number(),
    items: v.array(v.any()),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all labor items for the project
    const allItems = await ctx.runQuery(api.labor.getLaborItemsByProject, {
      projectId: args.projectId,
    }) as any[];

    let filteredItems: any[] = allItems;

    // Filter by section if provided
    if (args.sectionName && args.sectionName.trim().length > 0) {
      // Get all sections
      const sections = await ctx.runQuery(api.labor.getLaborSections, {
        projectId: args.projectId,
      });
      const section = sections.find((s: any) =>
        s.name.toLowerCase() === args.sectionName!.toLowerCase()
      );
      if (section) {
        filteredItems = filteredItems.filter((item: any) => item.sectionId === section._id);
      }
    }

    // Search by query if provided
    if (args.query && args.query.trim().length > 0) {
      const queryLower = args.query.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => {
        const nameMatch = item.name?.toLowerCase().includes(queryLower);
        const notesMatch = item.notes?.toLowerCase().includes(queryLower);
        const unitMatch = item.unit?.toLowerCase().includes(queryLower);
        return nameMatch || notesMatch || unitMatch;
      });
    }

    // Sort by creation time (most recent first)
    filteredItems.sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0));

    // Limit results
    const results = filteredItems.slice(0, limit);

    return {
      count: results.length,
      total: filteredItems.length,
      items: results,
    };
  },
});
