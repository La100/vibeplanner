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
