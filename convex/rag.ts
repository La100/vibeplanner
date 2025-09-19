import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal queries: Pobierz dane do indeksowania
export const getProjectTasks = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Add assignedToName for each task
    return await Promise.all(
      tasks.map(async (task) => {
        let assignedToName: string | undefined;
        if (task.assignedTo) {
          const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!)).unique();
          if (user) { assignedToName = user.name || user.email; }
        }
        return { ...task, assignedToName };
      })
    );
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
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    // Add assignedToName
    let assignedToName: string | undefined;
    if (task.assignedTo) {
      const user = await ctx.db.query("users").withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!)).unique();
      if (user) { assignedToName = user.name || user.email; }
    }
    return { ...task, assignedToName };
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

export const getContactById = internalQuery({
  args: { contactId: v.id("contacts") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contactId);
  },
});

export const getSurveyById = internalQuery({
  args: { surveyId: v.id("surveys") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.surveyId);
  },
});

export const getSurveyQuestionsById = internalQuery({
  args: { surveyId: v.id("surveys") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("surveyQuestions")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .order("asc")
      .collect();
  },
});