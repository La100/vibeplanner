import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";

// Utility function to check channel access
const hasChannelAccess = async (ctx: any, channelId: Id<"chatChannels">): Promise<boolean> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }

  const channel = await ctx.db.get(channelId);
  if (!channel) {
    return false;
  }

  // To access a channel, the user must be a member of it.
  const channelMembership = await ctx.db
    .query("chatChannelMembers")
    .withIndex("by_channel_and_user", (q: any) =>
      q.eq("channelId", channelId).eq("userId", identity.subject)
    )
    .first();

  return !!channelMembership;
};

// ====== QUERIES ======

export const listChannelMessages = query({
  args: {
    channelId: v.id("chatChannels"),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, args) {
    const hasAccess = await hasChannelAccess(ctx, args.channelId);
    if (!hasAccess) {
      return { page: [], isDone: true, continueCursor: null };
    }

    const result = await ctx.db
      .query("chatMessages")
      .withIndex("by_channel", (q) =>
        q.eq("channelId", args.channelId)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich messages with author information
    const enrichedMessages = await Promise.all(
      result.page.map(async (message) => {
        const author = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) =>
            q.eq("clerkUserId", message.authorId)
          )
          .unique();

        let replyToMessage = null;
        if (message.replyToId) {
          const replyTo = await ctx.db.get(message.replyToId);
          if (replyTo) {
            const replyAuthor = await ctx.db
              .query("users")
              .withIndex("by_clerk_user_id", (q) =>
                q.eq("clerkUserId", replyTo.authorId)
              )
              .unique();
            
            replyToMessage = {
              ...replyTo,
              authorName: replyAuthor?.name || "Unknown User",
              authorImageUrl: replyAuthor?.imageUrl,
            };
          }
        }

        return {
          ...message,
          authorName: author?.name || "Unknown User",
          authorImageUrl: author?.imageUrl,
          replyToMessage,
        };
      })
    );

    return {
      ...result,
      page: enrichedMessages,
    };
  },
});

export const getMessage = query({
  args: { messageId: v.id("chatMessages") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    const hasAccess = await hasChannelAccess(ctx, message.channelId);
    if (!hasAccess) {
      return null;
    }

    // Enrich with author info
    const author = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) =>
        q.eq("clerkUserId", message.authorId)
      )
      .unique();

    return {
      ...message,
      authorName: author?.name || "Unknown User",
      authorImageUrl: author?.imageUrl,
    };
  },
});

export const getUnreadCount = query({
  args: { 
    channelId: v.id("chatChannels"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const hasAccess = await hasChannelAccess(ctx, args.channelId);
    if (!hasAccess) {
      return 0;
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) return 0;

    // Get user's last read timestamp
    let lastReadAt = 0;
    if (channel.isPrivate) {
      const membership = await ctx.db
        .query("chatChannelMembers")
        .withIndex("by_channel_and_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", identity.subject)
        )
        .first();
      
      lastReadAt = membership?.lastReadAt || 0;
    }

    // Count messages since last read
    const unreadMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.gt(q.field("_creationTime"), lastReadAt))
      .collect();

    return unreadMessages.length;
  },
});

// ====== MUTATIONS ======

export const sendMessage = mutation({
  args: {
    channelId: v.id("chatChannels"),
    content: v.string(),
    replyToId: v.optional(v.id("chatMessages")),
    messageType: v.optional(v.union(
      v.literal("text"),
      v.literal("file"),
      v.literal("system")
    )),
    fileUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const hasAccess = await hasChannelAccess(ctx, args.channelId);
    if (!hasAccess) {
      throw new Error("No access to this channel");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Validate reply-to message if provided
    if (args.replyToId) {
      const replyToMessage = await ctx.db.get(args.replyToId);
      if (!replyToMessage || replyToMessage.channelId !== args.channelId) {
        throw new Error("Invalid reply-to message");
      }
    }

    const messageId = await ctx.db.insert("chatMessages", {
      content: args.content,
      channelId: args.channelId,
      authorId: identity.subject,
      teamId: channel.teamId,
      projectId: channel.projectId,
      replyToId: args.replyToId,
      isEdited: false,
      messageType: args.messageType || "text",
      fileUrl: args.fileUrl,
      fileName: args.fileName,
    });

    // Auto-mark as read for sender if it's a private channel
    if (channel.isPrivate) {
      const membership = await ctx.db
        .query("chatChannelMembers")
        .withIndex("by_channel_and_user", (q) =>
          q.eq("channelId", args.channelId).eq("userId", identity.subject)
        )
        .first();

      if (membership) {
        await ctx.db.patch(membership._id, {
          lastReadAt: Date.now(),
        });
      }
    }

    return messageId;
  },
});

export const editMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    newContent: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check if user owns the message
    if (message.authorId !== identity.subject) {
      throw new Error("Can only edit your own messages");
    }

    const hasAccess = await hasChannelAccess(ctx, message.channelId);
    if (!hasAccess) {
      throw new Error("No access to this channel");
    }

    await ctx.db.patch(args.messageId, {
      content: args.newContent,
      isEdited: true,
      editedAt: Date.now(),
    });

    return true;
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("chatMessages") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const hasAccess = await hasChannelAccess(ctx, message.channelId);
    if (!hasAccess) {
      throw new Error("No access to this channel");
    }

    // Check if user owns the message or is admin
    const channel = await ctx.db.get(message.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    let canDelete = message.authorId === identity.subject;

    // Check if user is admin of team/project
    if (!canDelete) {
      if (channel.type === "team") {
        const membership = await ctx.db
          .query("teamMembers")
          .withIndex("by_team_and_user", (q: any) =>
            q.eq("teamId", channel.teamId).eq("clerkUserId", identity.subject)
          )
          .first();

        canDelete = membership?.role === "admin";
      } else if (channel.type === "project" && channel.projectId) {
        const project = await ctx.db.get(channel.projectId);
        if (project) {
          const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q: any) =>
              q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
            )
            .first();

          canDelete = membership?.role === "admin";
        }
      }
    }

    if (!canDelete) {
      throw new Error("Can only delete your own messages or if you're an admin");
    }

    await ctx.db.delete(args.messageId);
    return true;
  },
});

export const markChannelAsRead = mutation({
  args: { channelId: v.id("chatChannels") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const hasAccess = await hasChannelAccess(ctx, args.channelId);
    if (!hasAccess) {
      throw new Error("No access to this channel");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel || !channel.isPrivate) {
      // Only track read status for private channels
      return true;
    }

    const membership = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", identity.subject)
      )
      .first();

    if (membership) {
      await ctx.db.patch(membership._id, {
        lastReadAt: Date.now(),
      });
    }

    return true;
  },
});

export const searchMessages = query({
  args: {
    query: v.string(),
    channelId: v.optional(v.id("chatChannels")),
    teamId: v.optional(v.id("teams")),
    projectId: v.optional(v.id("projects")),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    let messages;

    // Apply filters
    if (args.channelId) {
      const hasAccess = await hasChannelAccess(ctx, args.channelId);
      if (!hasAccess) return [];
      
      const channelId = args.channelId;
      messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .collect();
    } else if (args.teamId) {
      const teamId = args.teamId;
      messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_team", (q) => q.eq("teamId", teamId))
        .collect();
    } else if (args.projectId) {
      const projectId = args.projectId;
      messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    } else {
      messages = await ctx.db.query("chatMessages").collect();
    }

    // Filter by search query and access permissions
    const filteredMessages = [];
    for (const message of messages) {
      if (message.content.toLowerCase().includes(args.query.toLowerCase())) {
        const hasAccess = await hasChannelAccess(ctx, message.channelId);
        if (hasAccess) {
          // Enrich with author info
          const author = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) =>
              q.eq("clerkUserId", message.authorId)
            )
            .unique();

          filteredMessages.push({
            ...message,
            authorName: author?.name || "Unknown User",
            authorImageUrl: author?.imageUrl,
          });
        }
      }
    }

    return filteredMessages.slice(0, 50); // Limit results
  },
}); 