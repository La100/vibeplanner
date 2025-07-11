
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get a user by their Clerk ID. 
 * Returns the user document or null if not found.
 */
export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    return user;
  },
});

/**
 * Get a list of users by their Clerk IDs.
 * Useful for fetching data for multiple users at once (e.g., team members, assignees).
 * @param clerkUserIds - An array of Clerk user IDs.
 * @returns A list of user documents.
 */
export const getByClerkIds = query({
    args: { clerkUserIds: v.array(v.string()) },
    async handler(ctx, args) {
        if (args.clerkUserIds.length === 0) {
            return [];
        }
        
        const users = await ctx.db
            .query("users")
            .filter(q => q.or(...args.clerkUserIds.map(id => q.eq(q.field("clerkUserId"), id))))
            .collect();
        
        return users;
    }
});
