import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

const fetchUsersByClerkIds = async (ctx: any, clerkUserIds: Iterable<string | null | undefined>) => {
  const uniqueIds = [...new Set([...clerkUserIds].filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map<string, any>();

  const users = await Promise.all(
    uniqueIds.map((clerkUserId) =>
      ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
        .unique()
    )
  );

  const byClerkId = new Map<string, any>();
  for (const user of users) {
    if (user) byClerkId.set(user.clerkUserId, user);
  }
  return byClerkId;
};

// Internal queries: Pobierz dane do indeksowania
export const getProjectTasks = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const usersByClerkId = await fetchUsersByClerkIds(
      ctx,
      tasks.map((task) => task.assignedTo ?? null)
    );

    return tasks.map((task) => {
      const assignedUser = task.assignedTo ? usersByClerkId.get(task.assignedTo) : undefined;
      return { ...task, assignedToName: assignedUser?.name || assignedUser?.email };
    });
  },
});

// Helper queries
export const getTaskById = internalQuery({
  args: { taskId: v.id("tasks") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const usersByClerkId = await fetchUsersByClerkIds(ctx, [task.assignedTo ?? null]);
    const assignedUser = task.assignedTo ? usersByClerkId.get(task.assignedTo) : undefined;
    return { ...task, assignedToName: assignedUser?.name || assignedUser?.email };
  },
});
