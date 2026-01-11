import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

// ====== QUERIES ======

// Get user's Google Calendar connection status
export const getConnectionStatus = query({
  args: { 
    teamId: v.id("teams") 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user_and_team", (q) => 
        q.eq("clerkUserId", identity.subject).eq("teamId", args.teamId)
      )
      .first();

    if (!token) {
      return { isConnected: false, email: null };
    }

    return {
      isConnected: token.isConnected,
      email: token.email,
      lastSyncAt: token.lastSyncAt,
    };
  },
});

// Get Google Calendar events for a project
export const getProjectEvents = query({
  args: {
    projectId: v.id("projects"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const eventsQuery = ctx.db
      .query("googleCalendarEvents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId));

    const events = await eventsQuery.collect();

    // Filter by date range if provided
    let filteredEvents = events;
    if (args.startDate && args.endDate) {
      filteredEvents = events.filter(
        (e) => e.startTime >= args.startDate! && e.startTime <= args.endDate!
      );
    }

    return filteredEvents;
  },
});

// Get all team members' calendar connections
export const getTeamCalendarConnections = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tokens = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Get user info for each token
    const connections = await Promise.all(
      tokens.map(async (token) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", token.clerkUserId))
          .first();

        return {
          clerkUserId: token.clerkUserId,
          email: token.email,
          isConnected: token.isConnected,
          userName: user?.name || "Unknown",
          userImageUrl: user?.imageUrl,
          lastSyncAt: token.lastSyncAt,
        };
      })
    );

    return connections;
  },
});

// Internal query to get token data
export const getTokenData = internalQuery({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user_and_team", (q) => 
        q.eq("clerkUserId", args.clerkUserId).eq("teamId", args.teamId)
      )
      .first();

    return token;
  },
});

// ====== MUTATIONS ======

// Store OAuth tokens
export const storeTokens = internalMutation({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    email: v.optional(v.string()),
    calendarId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if token already exists
    const existing = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user_and_team", (q) => 
        q.eq("clerkUserId", args.clerkUserId).eq("teamId", args.teamId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        email: args.email,
        calendarId: args.calendarId,
        isConnected: true,
        lastSyncAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("googleCalendarTokens", {
      clerkUserId: args.clerkUserId,
      teamId: args.teamId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      email: args.email,
      calendarId: args.calendarId,
      isConnected: true,
      lastSyncAt: Date.now(),
    });
  },
});

// Disconnect Google Calendar
export const disconnect = mutation({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const token = await ctx.db
      .query("googleCalendarTokens")
      .withIndex("by_user_and_team", (q) => 
        q.eq("clerkUserId", identity.subject).eq("teamId", args.teamId)
      )
      .first();

    if (token) {
      await ctx.db.delete(token._id);
    }

    return { success: true };
  },
});

// Store synced events
export const storeEvents = internalMutation({
  args: {
    events: v.array(v.object({
      googleEventId: v.string(),
      projectId: v.id("projects"),
      teamId: v.id("teams"),
      createdByClerkUserId: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      startTime: v.number(),
      endTime: v.number(),
      allDay: v.boolean(),
      location: v.optional(v.string()),
      attendees: v.optional(v.array(v.object({
        email: v.string(),
        name: v.optional(v.string()),
        responseStatus: v.optional(v.string()),
      }))),
      htmlLink: v.optional(v.string()),
      status: v.optional(v.string()),
      colorId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    for (const event of args.events) {
      // Check if event exists
      const existing = await ctx.db
        .query("googleCalendarEvents")
        .withIndex("by_google_event_id", (q) => q.eq("googleEventId", event.googleEventId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...event,
          lastSyncAt: Date.now(),
        });
      } else {
        await ctx.db.insert("googleCalendarEvents", {
          ...event,
          lastSyncAt: Date.now(),
        });
      }
    }
  },
});

// Delete event from database
export const deleteEvent = internalMutation({
  args: {
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("googleCalendarEvents")
      .withIndex("by_google_event_id", (q) => q.eq("googleEventId", args.googleEventId))
      .first();

    if (event) {
      await ctx.db.delete(event._id);
    }
  },
});


