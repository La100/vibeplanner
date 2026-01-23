import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// ====== QUERIES ======

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

    // Filter to only show App Items (Task, Shopping, Labor)
    // We only want events that have a sourceType
    filteredEvents = filteredEvents.filter((e) => e.sourceType !== undefined && e.sourceType !== null);

    return filteredEvents;
  },
});

// ====== MUTATIONS ======

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
      sourceType: v.optional(v.union(
        v.literal("task"),
        v.literal("shopping"),
        v.literal("labor")
      )),
    })),
  },
  handler: async (ctx, args) => {
    for (const event of args.events) {
      // Check if event exists
      const existing = await ctx.db
        .query("googleCalendarEvents")
        .withIndex("by_google_event_id", (q) => q.eq("googleEventId", event.googleEventId))
        .first();

      // Look up source type from links if not provided
      let sourceType = event.sourceType;
      if (!sourceType) {
        const link = await ctx.db
          .query("googleCalendarLinks")
          .withIndex("by_google_event_id", (q) => q.eq("googleEventId", event.googleEventId))
          .first();
        sourceType = link?.sourceType;
      }

      const eventData = {
        ...event,
        sourceType,
        lastSyncAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, eventData);
      } else {
        await ctx.db.insert("googleCalendarEvents", eventData);
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



