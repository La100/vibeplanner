"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { google } from "googleapis";

// OAuth2 client configuration
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// ====== ACTIONS (Google API calls) ======

// Generate OAuth URL
export const getAuthUrl = action({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const oauth2Client = getOAuth2Client();

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: JSON.stringify({
        clerkUserId: identity.subject,
        teamId: args.teamId,
      }),
    });

    return authUrl;
  },
});

// Exchange code for tokens
export const exchangeCodeForTokens = internalAction({
  args: {
    code: v.string(),
    clerkUserId: v.string(),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const oauth2Client = getOAuth2Client();

    try {
      const { tokens } = await oauth2Client.getToken(args.code);
      oauth2Client.setCredentials(tokens);

      // Get user email
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Get primary calendar ID
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items?.find((cal) => cal.primary);

      // Store tokens
      await ctx.runMutation(internal.googleCalendarDb.storeTokens, {
        clerkUserId: args.clerkUserId,
        teamId: args.teamId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiresAt: tokens.expiry_date || Date.now() + 3600000,
        email: userInfo.data.email || undefined,
        calendarId: primaryCalendar?.id || undefined,
      });

      return { success: true, email: userInfo.data.email };
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      throw new Error("Failed to connect Google Calendar");
    }
  },
});

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

    // Get user's token
    const token = await ctx.runQuery(api.googleCalendarDb.getConnectionStatus, {
      teamId: args.teamId,
    });

    if (!token?.isConnected) {
      throw new Error("Google Calendar not connected");
    }

    // Get full token data for API access
    const tokenData = await ctx.runQuery(internal.googleCalendarDb.getTokenData, {
      clerkUserId: identity.subject,
      teamId: args.teamId,
    });

    if (!tokenData) {
      throw new Error("Token data not found");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

    // Check if token needs refresh
    if (tokenData.expiresAt < Date.now()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await ctx.runMutation(internal.googleCalendarDb.storeTokens, {
          clerkUserId: identity.subject,
          teamId: args.teamId,
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || tokenData.refreshToken,
          expiresAt: credentials.expiry_date || Date.now() + 3600000,
          email: tokenData.email,
          calendarId: tokenData.calendarId,
        });
        oauth2Client.setCredentials(credentials);
      } catch (error) {
        console.error("Error refreshing token:", error);
        throw new Error("Failed to refresh Google Calendar access");
      }
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

      await ctx.runMutation(internal.googleCalendarDb.storeEvents, {
        events: transformedEvents,
      });

      return { success: true, count: transformedEvents.length };
    } catch (error) {
      console.error("Error syncing events:", error);
      throw new Error("Failed to sync Google Calendar events");
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

    const tokenData = await ctx.runQuery(internal.googleCalendarDb.getTokenData, {
      clerkUserId: identity.subject,
      teamId: args.teamId,
    });

    if (!tokenData) {
      throw new Error("Google Calendar not connected");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

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

    const tokenData = await ctx.runQuery(internal.googleCalendarDb.getTokenData, {
      clerkUserId: identity.subject,
      teamId: args.teamId,
    });

    if (!tokenData) {
      throw new Error("Google Calendar not connected");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

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

    const tokenData = await ctx.runQuery(internal.googleCalendarDb.getTokenData, {
      clerkUserId: identity.subject,
      teamId: args.teamId,
    });

    if (!tokenData) {
      throw new Error("Google Calendar not connected");
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

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
