import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Doc } from "./_generated/dataModel";

// Utility function to check team access
const hasTeamAccess = async (ctx: any, teamId: Id<"teams">): Promise<string | false> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("clerkUserId", identity.subject)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) {
    return false;
  }

  return membership.role;
};

// Utility function to check company chat access (excludes clients)
const hasCompanyChatAccess = async (ctx: any, teamId: Id<"teams">): Promise<boolean> => {
  const role = await hasTeamAccess(ctx, teamId);
  // Clients don't have access to company chat - only their specific projects
  return role !== false && !['client'].includes(role);
};

// Utility function to check project access
const hasProjectAccess = async (ctx: any, projectId: Id<"projects">): Promise<string | false> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return false;
  }

  const project = await ctx.db.get(projectId);
  if (!project) {
    return false;
  }

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
    )
    .filter((q: any) => q.eq(q.field("isActive"), true))
    .first();

  if (!membership) {
    return false;
  }
  
  if (membership.role === 'admin') {
    // Admin has access to all projects
    return 'admin';
  }
  
  if (membership.role === 'member') {
    // Member may have limited access to specific projects
    if (membership.projectIds && membership.projectIds.length > 0) {
      return membership.projectIds.includes(projectId) ? 'member' : false;
    }
    // Member without projectIds has access to all projects (backward compatibility)
    return 'member';
  }
  
  if (membership.role === 'customer') {
    return membership.projectIds?.includes(projectId) ? 'customer' : false;
  }
  
  if (membership.role === 'client') {
    return membership.projectIds?.includes(projectId) ? 'client' : false;
  }

  return false;
};

// ====== QUERIES ======

export const listTeamChannels = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const hasAccess = await hasTeamAccess(ctx, args.teamId);
    if (!hasAccess) return [];

    // 1. Get all of the user's channel memberships
    const userMemberships = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();
      
    // 2. Get the full channel documents for those memberships
    const channelIds = userMemberships.map(m => m.channelId);
    const channels = (
      await Promise.all(channelIds.map(id => ctx.db.get(id)))
    ).filter(Boolean) as Doc<"chatChannels">[];

    // 3. Filter for channels that belong to the specified team
    const teamChannels = channels.filter(
      channel => channel.type === 'team' && channel.teamId === args.teamId
    );

    return teamChannels;
  }
});

export const listProjectChannels = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const hasAccess = await hasProjectAccess(ctx, args.projectId);
    if (!hasAccess) return [];

    // 1. Get all of the user's channel memberships
    const userMemberships = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    // 2. Get the full channel documents for those memberships
    const channelIds = userMemberships.map(m => m.channelId);
    const channels = (
      await Promise.all(channelIds.map(id => ctx.db.get(id)))
    ).filter(Boolean) as Doc<"chatChannels">[];

    // 3. Filter for channels that belong to the specified project
    const projectChannels = channels.filter(
      channel => channel.type === 'project' && channel.projectId === args.projectId
    );

    return projectChannels;
  }
});

export const getChannel = query({
  args: { channelId: v.id("chatChannels") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return null;
    }

    // Check access based on channel type
    if (channel.type === "team") {
      const hasAccess = await hasTeamAccess(ctx, channel.teamId);
      if (!hasAccess) return null;
    } else if (channel.type === "project" && channel.projectId) {
      const hasAccess = await hasProjectAccess(ctx, channel.projectId);
      if (!hasAccess) return null;
    }

    // Check private channel access
    if (channel.isPrivate) {
      const membership = await ctx.db
        .query("chatChannelMembers")
        .withIndex("by_channel_and_user", (q) =>
          q.eq("channelId", channel._id).eq("userId", identity.subject)
        )
        .first();
      
      if (!membership) return null;
    }

    return channel;
  }
});

export const updateChannel = mutation({
    args: {
        channelId: v.id("chatChannels"),
        name: v.string(),
    },
    async handler(ctx, args) {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const channel = await ctx.db.get(args.channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        const member = await ctx.db
            .query("chatChannelMembers")
            .withIndex("by_channel_and_user", (q) =>
                q.eq("channelId", args.channelId).eq("userId", identity.subject)
            )
            .first();

        if (!member || member.role !== "admin") {
            throw new Error("Only channel admins can rename the channel");
        }

        await ctx.db.patch(args.channelId, { name: args.name });
    }
});

export const deleteChannel = mutation({
    args: {
        channelId: v.id("chatChannels"),
    },
    async handler(ctx, args) {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Not authenticated");
        }

        const channel = await ctx.db.get(args.channelId);
        if (!channel) {
            throw new Error("Channel not found");
        }

        if (channel.isDefault) {
            throw new Error("Cannot delete a default channel");
        }

        const member = await ctx.db
            .query("chatChannelMembers")
            .withIndex("by_channel_and_user", (q) =>
                q.eq("channelId", args.channelId).eq("userId", identity.subject)
            )
            .first();

        if (!member || member.role !== "admin") {
            throw new Error("Only channel admins can delete the channel");
        }

        // Delete messages and files
        const messages = await ctx.db
            .query("chatMessages")
            .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
            .collect();

        for (const message of messages) {
            if (message.fileId) {
                // this will delete from R2 and the files table
                await ctx.runMutation(api.files.deleteFile, { fileId: message.fileId });
            }
            await ctx.db.delete(message._id);
        }

        // Delete channel members
        const memberships = await ctx.db
            .query("chatChannelMembers")
            .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
            .collect();
        for (const membership of memberships) {
            await ctx.db.delete(membership._id);
        }

        // Delete channel
        await ctx.db.delete(args.channelId);
    }
});

// ====== MUTATIONS ======

export const createTeamChannel = mutation({
  args: {
    name: v.string(),
    teamId: v.id("teams"),
    description: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userRole = await hasTeamAccess(ctx, args.teamId);
    if (!userRole || (userRole !== "admin" && userRole !== "member")) {
      throw new Error("Insufficient permissions to create team channel");
    }

    const channelId = await ctx.db.insert("chatChannels", {
      name: args.name,
      description: args.description,
      type: "team",
      teamId: args.teamId,
      createdBy: identity.subject,
      isPrivate: args.isPrivate ?? false,
      isDefault: false,
    });

    const isPrivate = args.isPrivate ?? false;

    if (isPrivate) {
      // If private channel, add only creator as admin
      await ctx.db.insert("chatChannelMembers", {
        channelId,
        userId: identity.subject,
        joinedAt: Date.now(),
        role: "admin",
        lastReadAt: Date.now(),
      });
    } else {
      // If public channel, add all team members
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      // Add each team member to the channel
      for (const member of teamMembers) {
        await ctx.db.insert("chatChannelMembers", {
          channelId,
          userId: member.clerkUserId,
          joinedAt: Date.now(),
          role: member.clerkUserId === identity.subject 
            ? "admin" // Creator is admin
            : (member.role === "admin" ? "admin" : "member"),
          lastReadAt: Date.now(),
        });
      }
    }

    return channelId;
  }
});

export const createProjectChannel = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
    description: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userRole = await hasProjectAccess(ctx, args.projectId);
    if (!userRole || (userRole !== "admin" && userRole !== "member")) {
      throw new Error("Insufficient permissions to create project channel");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const channelId = await ctx.db.insert("chatChannels", {
      name: args.name,
      description: args.description,
      type: "project",
      teamId: project.teamId,
      projectId: args.projectId,
      createdBy: identity.subject,
      isPrivate: args.isPrivate ?? false,
      isDefault: false,
    });

    const isPrivate = args.isPrivate ?? false;

    if (isPrivate) {
      // If private channel, add only creator as admin
      await ctx.db.insert("chatChannelMembers", {
        channelId,
        userId: identity.subject,
        joinedAt: Date.now(),
        role: "admin",
        lastReadAt: Date.now(),
      });
    } else {
      // If public channel, add all team members who have access to this project
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      // Filter members who have access to this project
      const projectMembers = teamMembers.filter(member => {
        if (member.role === 'customer') {
          // Customers only have access to specific projects
          return member.projectIds?.includes(args.projectId);
        }
        // Admin, member have access to all projects
        return true;
      });

      // Add each project member to the channel
      for (const member of projectMembers) {
        await ctx.db.insert("chatChannelMembers", {
          channelId,
          userId: member.clerkUserId,
          joinedAt: Date.now(),
          role: member.clerkUserId === identity.subject 
            ? "admin" // Creator is admin
            : (member.role === "admin" ? "admin" : "member"),
          lastReadAt: Date.now(),
        });
      }
    }

    return channelId;
  }
});

export const joinChannel = mutation({
  args: { channelId: v.id("chatChannels") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user has access to the team/project
    if (channel.type === "team") {
      const hasAccess = await hasTeamAccess(ctx, channel.teamId);
      if (!hasAccess) throw new Error("No access to team");
    } else if (channel.type === "project" && channel.projectId) {
      const hasAccess = await hasProjectAccess(ctx, channel.projectId);
      if (!hasAccess) throw new Error("No access to project");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", identity.subject)
      )
      .first();

    if (existingMembership) {
      return existingMembership._id;
    }

    // Add as member
    const membershipId = await ctx.db.insert("chatChannelMembers", {
      channelId: args.channelId,
      userId: identity.subject,
      joinedAt: Date.now(),
      role: "member",
      lastReadAt: Date.now(),
    });

    return membershipId;
  }
});

export const leaveChannel = mutation({
  args: { channelId: v.id("chatChannels") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.isDefault) {
      throw new Error("Cannot leave default channel");
    }

    const membership = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", identity.subject)
      )
      .first();

    if (membership) {
      await ctx.db.delete(membership._id);
    }

    return true;
  }
});

// ====== INTERNAL MUTATIONS (for automatic channel creation) ======

export const createDefaultTeamChannel = internalMutation({
  args: { teamId: v.id("teams"), creatorId: v.string() },
  async handler(ctx, args) {
    const channelId = await ctx.db.insert("chatChannels", {
      name: "General",
      description: "General team discussion",
      type: "team",
      teamId: args.teamId,
      createdBy: args.creatorId,
      isPrivate: false,
      isDefault: true,
    });

    // Add all team members to the default channel
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Add each team member to the channel
    for (const member of teamMembers) {
      await ctx.db.insert("chatChannelMembers", {
        channelId,
        userId: member.clerkUserId,
        joinedAt: Date.now(),
        role: member.role === "admin" ? "admin" : "member",
        lastReadAt: Date.now(),
      });
    }

    return channelId;
  }
});

export const createDefaultProjectChannel = internalMutation({
  args: { projectId: v.id("projects"), creatorId: v.string() },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const channelId = await ctx.db.insert("chatChannels", {
      name: "Project Discussion",
      description: `Discussion for ${project.name}`,
      type: "project",
      teamId: project.teamId,
      projectId: args.projectId,
      createdBy: args.creatorId,
      isPrivate: false,
      isDefault: true,
    });

    // Add all team members who have access to this project
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Filter members who have access to this project
    const projectMembers = teamMembers.filter(member => {
      if (member.role === 'customer') {
        // Customers only have access to specific projects
        return member.projectIds?.includes(args.projectId);
      }
      // Admin, member, viewer have access to all projects
      return true;
    });

    // Add each project member to the channel
    for (const member of projectMembers) {
      await ctx.db.insert("chatChannelMembers", {
        channelId,
        userId: member.clerkUserId,
        joinedAt: Date.now(),
        role: member.role === "admin" ? "admin" : "member",
        lastReadAt: Date.now(),
      });
    }

    return channelId;
  }
});

// ====== CHANNEL MEMBER MANAGEMENT ======

export const listChannelMembers = query({
  args: { channelId: v.id("chatChannels") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return [];
    }

    // Check access to channel
    if (channel.type === "team") {
      const hasAccess = await hasTeamAccess(ctx, channel.teamId);
      if (!hasAccess) return [];
    } else if (channel.type === "project" && channel.projectId) {
      const hasAccess = await hasProjectAccess(ctx, channel.projectId);
      if (!hasAccess) return [];
    }

    // Get channel members
    const memberships = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Enrich with user information
    const enrichedMembers = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", membership.userId))
          .unique();

        return {
          ...membership,
          userName: user?.name || "Unknown User",
          userEmail: user?.email || "",
          userImageUrl: user?.imageUrl,
        };
      })
    );

    return enrichedMembers;
  }
});

export const addUserToChannel = mutation({
  args: {
    channelId: v.id("chatChannels"),
    userId: v.string(),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user has permission to manage this channel
    let canManage = false;
    
    if (channel.type === "team") {
      const userRole = await hasTeamAccess(ctx, channel.teamId);
      canManage = userRole === "admin" || userRole === "member";
    } else if (channel.type === "project" && channel.projectId) {
      const userRole = await hasProjectAccess(ctx, channel.projectId);
      canManage = userRole === "admin" || userRole === "member";
      
      // Also check if user is channel admin
      if (!canManage) {
        const membership = await ctx.db
          .query("chatChannelMembers")
          .withIndex("by_channel_and_user", (q) =>
            q.eq("channelId", args.channelId).eq("userId", identity.subject)
          )
          .first();
        canManage = membership?.role === "admin";
      }
    }

    if (!canManage) {
      throw new Error("Insufficient permissions to manage channel members");
    }

    // Check if user to be added has access to team/project
    if (channel.type === "team") {
      const targetUserAccess = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", channel.teamId).eq("clerkUserId", args.userId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      
      if (!targetUserAccess) {
        throw new Error("User is not a member of this team");
      }
    } else if (channel.type === "project" && channel.projectId) {
      const project = await ctx.db.get(channel.projectId);
      if (!project) throw new Error("Project not found");
      
      const targetUserAccess = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", project.teamId).eq("clerkUserId", args.userId)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      
      if (!targetUserAccess) {
        throw new Error("User is not a member of this team");
      }
      
      // If user is customer, check if they have access to this specific project
      if (targetUserAccess.role === 'customer') {
        if (!targetUserAccess.projectIds?.includes(channel.projectId)) {
          throw new Error("Customer doesn't have access to this project");
        }
      }
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .first();

    if (existingMembership) {
      throw new Error("User is already a member of this channel");
    }

    // Add user to channel
    const membershipId = await ctx.db.insert("chatChannelMembers", {
      channelId: args.channelId,
      userId: args.userId,
      joinedAt: Date.now(),
      role: args.role || "member",
      lastReadAt: Date.now(),
    });

    return membershipId;
  }
});

export const removeUserFromChannel = mutation({
  args: {
    channelId: v.id("chatChannels"),
    userId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Can't remove from default channels
    if (channel.isDefault) {
      throw new Error("Cannot remove users from default channels");
    }

    // Check if user has permission to manage this channel
    let canManage = false;
    
    if (channel.type === "team") {
      const userRole = await hasTeamAccess(ctx, channel.teamId);
      canManage = userRole === "admin" || userRole === "member";
    } else if (channel.type === "project" && channel.projectId) {
      const userRole = await hasProjectAccess(ctx, channel.projectId);
      canManage = userRole === "admin" || userRole === "member";
      
      // Also check if user is channel admin
      if (!canManage) {
        const membership = await ctx.db
          .query("chatChannelMembers")
          .withIndex("by_channel_and_user", (q) =>
            q.eq("channelId", args.channelId).eq("userId", identity.subject)
          )
          .first();
        canManage = membership?.role === "admin";
      }
    }

    // Users can always remove themselves
    if (args.userId === identity.subject) {
      canManage = true;
    }

    if (!canManage) {
      throw new Error("Insufficient permissions to manage channel members");
    }

    // Find and remove membership
    const membership = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .first();

    if (membership) {
      await ctx.db.delete(membership._id);
    }

    return true;
  }
});

export const updateChannelMemberRole = mutation({
  args: {
    channelId: v.id("chatChannels"),
    userId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    // Check if user has permission to manage roles in this channel
    let canManage = false;
    
    if (channel.type === "team") {
      const userRole = await hasTeamAccess(ctx, channel.teamId);
      canManage = userRole === "admin";
    } else if (channel.type === "project" && channel.projectId) {
      const userRole = await hasProjectAccess(ctx, channel.projectId);
      canManage = userRole === "admin";
      
      // Also check if user is channel admin
      if (!canManage) {
        const membership = await ctx.db
          .query("chatChannelMembers")
          .withIndex("by_channel_and_user", (q) =>
            q.eq("channelId", args.channelId).eq("userId", identity.subject)
          )
          .first();
        canManage = membership?.role === "admin";
      }
    }

    if (!canManage) {
      throw new Error("Insufficient permissions to manage channel roles");
    }

    // Find and update membership
    const membership = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this channel");
    }

    await ctx.db.patch(membership._id, {
      role: args.role,
    });

    return true;
  }
});

export const getAvailableUsersForChannel = query({
  args: { channelId: v.id("chatChannels") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const channel = await ctx.db.get(args.channelId);
    if (!channel) {
      return [];
    }

    // Check if user has permission to view this
    let hasAccess = false;
    if (channel.type === "team") {
      hasAccess = !!(await hasTeamAccess(ctx, channel.teamId));
    } else if (channel.type === "project" && channel.projectId) {
      hasAccess = !!(await hasProjectAccess(ctx, channel.projectId));
    }

    if (!hasAccess) {
      return [];
    }

    // Get all team members
    let availableUsers;
    if (channel.type === "team") {
      availableUsers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", channel.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    } else if (channel.type === "project" && channel.projectId) {
      const project = await ctx.db.get(channel.projectId);
      if (!project) return [];
      
      const teamMembers = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", project.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      // Filter to include only users with access to this project
      availableUsers = teamMembers.filter(member => {
        if (member.role === 'customer') {
          return member.projectIds?.includes(channel.projectId!);
        }
        return true; // admin, member have access to all projects
      });
    } else {
      return [];
    }

    // Get current channel members to exclude them
    const currentMembers = await ctx.db
      .query("chatChannelMembers")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    const currentMemberIds = new Set(currentMembers.map(m => m.userId));

    // Enrich with user information and filter out current members
    const enrichedUsers = await Promise.all(
      availableUsers
        .filter(member => !currentMemberIds.has(member.clerkUserId))
        .map(async (member) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", member.clerkUserId))
            .unique();

          return {
            clerkUserId: member.clerkUserId,
            name: user?.name || "Unknown User",
            email: user?.email || "",
            imageUrl: user?.imageUrl,
            teamRole: member.role,
          };
        })
    );

    return enrichedUsers;
  }
});

// ====== UTILITY FUNCTIONS ======

export const populateExistingPublicChannels = mutation({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const userRole = await hasTeamAccess(ctx, args.teamId);
    if (userRole !== "admin") {
      throw new Error("Only admins can populate channels");
    }

    // Get all public channels for this team
    const channels = await ctx.db
      .query("chatChannels")
      .withIndex("by_type_and_team", (q) => 
        q.eq("type", "team").eq("teamId", args.teamId)
      )
      .filter((q) => q.eq(q.field("isPrivate"), false))
      .collect();

    let populatedCount = 0;

    for (const channel of channels) {
      // Check if channel already has members
      const existingMembers = await ctx.db
        .query("chatChannelMembers")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
        .collect();

      if (existingMembers.length === 0) {
        // Channel is empty, add all team members
        const teamMembers = await ctx.db
          .query("teamMembers")
          .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        for (const member of teamMembers) {
          await ctx.db.insert("chatChannelMembers", {
            channelId: channel._id,
            userId: member.clerkUserId,
            joinedAt: Date.now(),
            role: member.role === "admin" ? "admin" : "member",
            lastReadAt: Date.now(),
          });
        }
        populatedCount++;
      }
    }

    return { populatedChannels: populatedCount };
  }
}); 