"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { google } from "googleapis";
import { clerkClient } from "@clerk/clerk-sdk-node";

const internalAny = internal as any;

// Helper to get Google OAuth token from Clerk
const getGoogleAuthToken = async (clerkUserId: string) => {
  try {
    const response = await clerkClient.users.getUserOauthAccessToken(
      clerkUserId,
      "oauth_google"
    );

    if (response.data.length === 0 || !response.data[0].token) {
      return null;
    }

    return response.data[0].token;
  } catch (error) {
    console.error("Error fetching Google token from Clerk:", error);
    return null;
  }
};

const getOAuth2Client = async (clerkUserId: string) => {
  const token = await getGoogleAuthToken(clerkUserId);
  if (!token) return null;

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return oauth2Client;
};

const isAllDayTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  );
};

const toDateString = (timestamp: number) => {
  return new Date(timestamp).toISOString().split("T")[0];
};

const addDays = (timestamp: number, days: number) => {
  return timestamp + days * 24 * 60 * 60 * 1000;
};

// ====== ACTIONS (Google API calls) ======

// Sync events from Google Calendar
export const syncEvents = action({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    timeMin: v.optional(v.number()),
    timeMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const oauth2Client = await getOAuth2Client(identity.subject);

    if (!oauth2Client) {
      throw new Error("Google Calendar not connected via Clerk");
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Default to next 30 days if not specified
    const timeMin = args.timeMin
      ? new Date(args.timeMin).toISOString()
      : new Date().toISOString();
    const timeMax = args.timeMax
      ? new Date(args.timeMax).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 100,
      });

      const events = response.data.items || [];

      // Transform and store events
      const transformedEvents = events.map((event) => ({
        googleEventId: event.id!,
        projectId: args.projectId,
        teamId: args.teamId,
        createdByClerkUserId: identity.subject,
        title: event.summary || "Untitled Event",
        description: event.description || undefined,
        startTime: event.start?.dateTime
          ? new Date(event.start.dateTime).getTime()
          : event.start?.date
            ? new Date(event.start.date).getTime()
            : Date.now(),
        endTime: event.end?.dateTime
          ? new Date(event.end.dateTime).getTime()
          : event.end?.date
            ? new Date(event.end.date).getTime()
            : Date.now(),
        allDay: !!event.start?.date,
        location: event.location || undefined,
        attendees: event.attendees?.map((a) => ({
          email: a.email || "",
          name: a.displayName || undefined,
          responseStatus: a.responseStatus || undefined,
        })),
        htmlLink: event.htmlLink || undefined,
        status: event.status || undefined,
        colorId: event.colorId || undefined,
      }));

      // We still use the existing storeEvents mutation to save to our DB
      await ctx.runMutation(internal.googleCalendarDb.storeEvents, {
        events: transformedEvents,
      });

      return { success: true, count: transformedEvents.length };
    } catch (error: any) {
      console.error("Error syncing events:", error);
      const errorMessage = error.message || JSON.stringify(error);
      throw new Error(`Failed to sync Google Calendar events: ${errorMessage}`);
    }
  },
});

// Create event in Google Calendar
export const createEvent = action({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    allDay: v.optional(v.boolean()),
    location: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())), // Array of emails
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const oauth2Client = await getOAuth2Client(identity.subject);
    if (!oauth2Client) {
      throw new Error("Google Calendar not connected via Clerk");
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const event: any = {
      summary: args.title,
      description: args.description,
      location: args.location,
    };

    if (args.allDay) {
      event.start = { date: new Date(args.startTime).toISOString().split("T")[0] };
      event.end = { date: new Date(args.endTime).toISOString().split("T")[0] };
    } else {
      event.start = { dateTime: new Date(args.startTime).toISOString() };
      event.end = { dateTime: new Date(args.endTime).toISOString() };
    }

    if (args.attendees && args.attendees.length > 0) {
      event.attendees = args.attendees.map((email) => ({ email }));
    }

    try {
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
        sendUpdates: "all",
      });

      // Store in our database
      await ctx.runMutation(internal.googleCalendarDb.storeEvents, {
        events: [
          {
            googleEventId: response.data.id!,
            projectId: args.projectId,
            teamId: args.teamId,
            createdByClerkUserId: identity.subject,
            title: args.title,
            description: args.description,
            startTime: args.startTime,
            endTime: args.endTime,
            allDay: args.allDay || false,
            location: args.location,
            attendees: args.attendees?.map((email) => ({ email })),
            htmlLink: response.data.htmlLink || undefined,
            status: response.data.status || undefined,
          },
        ],
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error("Error creating event:", error);
      throw new Error("Failed to create Google Calendar event");
    }
  },
});

// Update event in Google Calendar
export const updateEvent = action({
  args: {
    googleEventId: v.string(),
    teamId: v.id("teams"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const oauth2Client = await getOAuth2Client(identity.subject);
    if (!oauth2Client) {
      throw new Error("Google Calendar not connected via Clerk");
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Get existing event
    const existingEvent = await calendar.events.get({
      calendarId: "primary",
      eventId: args.googleEventId,
    });

    const updatedEvent: any = {
      summary: args.title || existingEvent.data.summary,
      description: args.description ?? existingEvent.data.description,
      location: args.location ?? existingEvent.data.location,
    };

    if (args.startTime && args.endTime) {
      if (args.allDay) {
        updatedEvent.start = { date: new Date(args.startTime).toISOString().split("T")[0] };
        updatedEvent.end = { date: new Date(args.endTime).toISOString().split("T")[0] };
      } else {
        updatedEvent.start = { dateTime: new Date(args.startTime).toISOString() };
        updatedEvent.end = { dateTime: new Date(args.endTime).toISOString() };
      }
    } else {
      updatedEvent.start = existingEvent.data.start;
      updatedEvent.end = existingEvent.data.end;
    }

    try {
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: args.googleEventId,
        requestBody: updatedEvent,
      });

      return { success: true, eventId: response.data.id };
    } catch (error) {
      console.error("Error updating event:", error);
      throw new Error("Failed to update Google Calendar event");
    }
  },
});

// Delete event from Google Calendar
export const deleteGoogleEvent = action({
  args: {
    googleEventId: v.string(),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const oauth2Client = await getOAuth2Client(identity.subject);
    if (!oauth2Client) {
      throw new Error("Google Calendar not connected via Clerk");
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: args.googleEventId,
      });

      // Delete from our database
      await ctx.runMutation(internal.googleCalendarDb.deleteEvent, {
        googleEventId: args.googleEventId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting event:", error);
      throw new Error("Failed to delete Google Calendar event");
    }
  },
});

// ====== INTERNAL ACTIONS (Task/Shopping sync) ======

// Helper for internal actions to get client
const getAuthorizedClientForInternal = async (clerkUserId: string) => {
  return await getOAuth2Client(clerkUserId);
};

export const syncTaskEvent = internalAction({
  args: {
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    attendees: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const oauth2Client = await getAuthorizedClientForInternal(args.clerkUserId);
    if (!oauth2Client) return { skipped: true, reason: "not_connected" };

    const startTs = args.startDate ?? args.endDate;
    const endTs = args.endDate ?? args.startDate;
    if (!startTs || !endTs) {
      await ctx.runAction(internalAny.googleCalendar.deleteGoogleEventForSource, {
        sourceType: "task",
        sourceId: args.taskId,
        clerkUserId: args.clerkUserId,
        teamId: args.teamId,
      });
      return { skipped: true, reason: "missing_dates" };
    }

    const allDay = isAllDayTimestamp(startTs) && isAllDayTimestamp(endTs);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const existingLink = await ctx.runQuery(internalAny.googleCalendarLinks.getLinkBySource, {
      sourceType: "task",
      sourceId: args.taskId,
      clerkUserId: args.clerkUserId,
    });

    const requestBody: any = {
      summary: args.title,
      description: args.description,
    };

    if (allDay) {
      requestBody.start = { date: toDateString(startTs) };
      requestBody.end = { date: toDateString(addDays(endTs, 1)) };
    } else {
      requestBody.start = { dateTime: new Date(startTs).toISOString() };
      requestBody.end = { dateTime: new Date(endTs).toISOString() };
    }

    if (args.attendees && args.attendees.length > 0) {
      requestBody.attendees = args.attendees.map((email) => ({ email }));
    }

    try {
      if (existingLink) {
        const response = await calendar.events.update({
          calendarId: "primary",
          eventId: existingLink.googleEventId,
          requestBody,
        });

        await ctx.runMutation(internalAny.googleCalendarLinks.upsertLink, {
          sourceType: "task",
          sourceId: args.taskId,
          projectId: args.projectId,
          teamId: args.teamId,
          clerkUserId: args.clerkUserId,
          googleEventId: response.data.id!,
        });

        return { success: true, eventId: response.data.id };
      }

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody,
      });

      await ctx.runMutation(internalAny.googleCalendarLinks.upsertLink, {
        sourceType: "task",
        sourceId: args.taskId,
        projectId: args.projectId,
        teamId: args.teamId,
        clerkUserId: args.clerkUserId,
        googleEventId: response.data.id!,
      });

      return { success: true, eventId: response.data.id };
    } catch (error) {
      console.error("Error syncing task to Google Calendar:", error);
      return { success: false };
    }
  },
});

export const syncShoppingItemEvent = internalAction({
  args: {
    itemId: v.id("shoppingListItems"),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    name: v.string(),
    notes: v.optional(v.string()),
    buyBefore: v.optional(v.number()),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const oauth2Client = await getAuthorizedClientForInternal(args.clerkUserId);
    if (!oauth2Client) return { skipped: true, reason: "not_connected" };

    if (!args.buyBefore) {
      await ctx.runAction(internalAny.googleCalendar.deleteGoogleEventForSource, {
        sourceType: "shopping",
        sourceId: args.itemId,
        clerkUserId: args.clerkUserId,
        teamId: args.teamId,
      });
      return { skipped: true, reason: "missing_date" };
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const existingLink = await ctx.runQuery(internalAny.googleCalendarLinks.getLinkBySource, {
      sourceType: "shopping",
      sourceId: args.itemId,
      clerkUserId: args.clerkUserId,
    });

    const requestBody: any = {
      summary: `Shopping: ${args.name}`,
      description: args.notes
        ? `Quantity: ${args.quantity}\n${args.notes}`
        : `Quantity: ${args.quantity}`,
      start: { date: toDateString(args.buyBefore) },
      end: { date: toDateString(addDays(args.buyBefore, 1)) },
    };

    try {
      if (existingLink) {
        const response = await calendar.events.update({
          calendarId: "primary",
          eventId: existingLink.googleEventId,
          requestBody,
        });

        await ctx.runMutation(internalAny.googleCalendarLinks.upsertLink, {
          sourceType: "shopping",
          sourceId: args.itemId,
          projectId: args.projectId,
          teamId: args.teamId,
          clerkUserId: args.clerkUserId,
          googleEventId: response.data.id!,
        });

        return { success: true, eventId: response.data.id };
      }

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody,
      });

      await ctx.runMutation(internalAny.googleCalendarLinks.upsertLink, {
        sourceType: "shopping",
        sourceId: args.itemId,
        projectId: args.projectId,
        teamId: args.teamId,
        clerkUserId: args.clerkUserId,
        googleEventId: response.data.id!,
      });

      return { success: true, eventId: response.data.id };
    } catch (error) {
      console.error("Error syncing shopping item to Google Calendar:", error);
      return { success: false };
    }
  },
});

export const syncLaborEvent = internalAction({
  args: {
    itemId: v.id("laborItems"),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    name: v.string(),
    notes: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    quantity: v.number(),
    unit: v.string(),
    attendees: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const oauth2Client = await getAuthorizedClientForInternal(args.clerkUserId);
    if (!oauth2Client) return { skipped: true, reason: "not_connected" };

    if (!args.startDate || !args.endDate) {
      await ctx.runAction(internalAny.googleCalendar.deleteGoogleEventForSource, {
        sourceType: "labor",
        sourceId: args.itemId,
        clerkUserId: args.clerkUserId,
        teamId: args.teamId,
      });
      return { skipped: true, reason: "missing_dates" };
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const existingLink = await ctx.runQuery(internalAny.googleCalendarLinks.getLinkBySource, {
      sourceType: "labor",
      sourceId: args.itemId,
      clerkUserId: args.clerkUserId,
    });

    const requestBody: any = {
      summary: `Labor: ${args.name}`,
      description: args.notes
        ? `Quantity: ${args.quantity} ${args.unit}\n${args.notes}`
        : `Quantity: ${args.quantity} ${args.unit}`,
      start: { date: toDateString(args.startDate) },
      end: { date: toDateString(args.endDate) },
    };

    if (args.attendees && args.attendees.length > 0) {
      requestBody.attendees = args.attendees.map((email) => ({ email }));
    }

    // Labor works usually defined by days, so force all-day to simplify
    // Or we could check if start/end has time components. 
    // Let's assume passed start/end are timestamps. 
    // If we want time precision, we should use dateTime.
    // The user didn't specify, but Labor is usually "Day X".
    // However, I'll stick to dates (all day) for now as it's safer for "Labor".

    try {
      if (existingLink) {
        const response = await calendar.events.update({
          calendarId: "primary",
          eventId: existingLink.googleEventId,
          requestBody,
        });

        await ctx.runMutation(internalAny.googleCalendarLinks.upsertLink, {
          sourceType: "labor",
          sourceId: args.itemId,
          projectId: args.projectId,
          teamId: args.teamId,
          clerkUserId: args.clerkUserId,
          googleEventId: response.data.id!,
        });

        return { success: true, eventId: response.data.id };
      }

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody,
      });

      await ctx.runMutation(internalAny.googleCalendarLinks.upsertLink, {
        sourceType: "labor",
        sourceId: args.itemId,
        projectId: args.projectId,
        teamId: args.teamId,
        clerkUserId: args.clerkUserId,
        googleEventId: response.data.id!,
      });

      return { success: true, eventId: response.data.id };
    } catch (error) {
      console.error("Error syncing labor item to Google Calendar:", error);
      return { success: false };
    }
  },
});

export const deleteGoogleEventForSource = internalAction({
  args: {
    sourceType: v.union(v.literal("task"), v.literal("shopping"), v.literal("labor")),
    sourceId: v.string(),
    clerkUserId: v.string(),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const oauth2Client = await getAuthorizedClientForInternal(args.clerkUserId);
    if (!oauth2Client) return { skipped: true, reason: "not_connected" };

    const existingLink = await ctx.runQuery(internalAny.googleCalendarLinks.getLinkBySource, {
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      clerkUserId: args.clerkUserId,
    });

    if (!existingLink) return { skipped: true, reason: "no_link" };

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: existingLink.googleEventId,
      });
    } catch (error) {
      console.error("Error deleting Google Calendar event:", error);
    }

    await ctx.runMutation(internalAny.googleCalendarLinks.deleteLink, {
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      clerkUserId: args.clerkUserId,
    });

    return { success: true };
  },
});
