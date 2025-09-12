import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal queries: Pobierz dane do indeksowania
export const getProjectTasks = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getProjectNotes = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getProjectShoppingItems = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getProjectContacts = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Pobierz kontakty przypisane do projektu
    const projectContacts = await ctx.db
      .query("projectContacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const contacts = [];
    for (const pc of projectContacts) {
      const contact = await ctx.db.get(pc.contactId);
      if (contact) {
        contacts.push(contact);
      }
    }
    return contacts;
  },
});

export const getProjectSurveys = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("surveys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Helper queries
export const getTaskById = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const getNoteById = internalQuery({
  args: { noteId: v.id("notes") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.noteId);
  },
});

export const getShoppingItemById = internalQuery({
  args: { itemId: v.id("shoppingListItems") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const getSurveyById = internalQuery({
  args: { surveyId: v.id("surveys") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.surveyId);
  },
});