import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
const internalAny = require("./_generated/api").internal as any;

const fetchUsersByClerkIds = async (ctx: any, clerkUserIds: Iterable<string>) => {
  const uniqueIds = [...new Set([...clerkUserIds].filter(Boolean))];
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

export const listUserTeams = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .unique();

    return team ? [team] : [];
  },
});

export const getMyTeam = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .unique();
  },
});

export const ensureMyTeam = mutation({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .unique();

    if (team) {
      return { teamId: team._id };
    }

    return await ctx.runMutation(internalAny.myFunctions.ensurePersonalWorkspace, {
      clerkUserId: identity.subject,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
      imageUrl: identity.pictureUrl ?? undefined,
    });
  },
});

export const getTeamById = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
  },
});

export const getTeamBySlug = query({
  args: { slug: v.string() },
  async handler(ctx, args) {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return team;
  },
});

export const getTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
  },
});

export const getCurrentUserTeamMember = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
  },
});

export const getTeamMemberByClerkId = internalQuery({
  args: {
    teamId: v.id("teams"),
    clerkUserId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("teamMembers"),
      _creationTime: v.number(),
      teamId: v.id("teams"),
      clerkUserId: v.string(),
      clerkOrgId: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("member")),
      permissions: v.array(v.string()),
      joinedAt: v.number(),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  async handler(ctx, args) {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();
  },
});


export const getMyTeamSettings = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .unique();

    if (!team) return null;

    // Get timezone from user (primary source)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    return {
      teamId: team._id,
      name: team.name,
      timezone: user?.timezone ?? team.timezone,
      userRole: "admin",
    };
  },
});

export const updateTeamTimezone = mutation({
  args: {
    teamId: v.id("teams"),
    timezone: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Only admins can update team settings");
    }

    // Dual-write: update both team and user
    await ctx.db.patch(args.teamId, {
      timezone: args.timezone,
    });
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, { timezone: args.timezone });
    }

    return { success: true };
  },
});

export const getTeamMembersForIndexing = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.teamId) return [];

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId!))
      .collect();

    const usersByClerkId = await fetchUsersByClerkIds(
      ctx,
      members.map((member) => member.clerkUserId)
    );

    return members.map((member) => {
      const user = usersByClerkId.get(member.clerkUserId);
      return {
        clerkUserId: member.clerkUserId,
        name: user?.name,
        email: user?.email,
      };
    });
  },
});

export const getTeamMembersWithUserDetails = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || !project.teamId) return [];

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", project.teamId!))
      .collect();

    const usersByClerkId = await fetchUsersByClerkIds(
      ctx,
      members.map((member) => member.clerkUserId)
    );

    return members.map((member) => {
      const user = usersByClerkId.get(member.clerkUserId);
      return {
        ...member,
        name: user?.name ?? "Unknown User",
        email: user?.email ?? "No Email",
        imageUrl: user?.imageUrl,
      };
    });
  },
});

export const getTeamMembers = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const usersByClerkId = await fetchUsersByClerkIds(
      ctx,
      members.map((member) => member.clerkUserId)
    );

    return members.map((member) => {
      const user = usersByClerkId.get(member.clerkUserId);
      return {
        ...member,
        name: user?.name ?? "User without name",
        email: user?.email ?? "No email",
        imageUrl: user?.imageUrl,
      };
    });
  },
});

export const getTeamResourceUsage = query({
  args: { teamId: v.id("teams") },
  returns: v.object({
    projectsUsed: v.number(),
    projectsLimit: v.number(),
    projectsPercentUsed: v.number(),
    membersUsed: v.number(),
    membersLimit: v.number(),
    membersPercentUsed: v.number(),
  }),
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("Not authorized to view this team");
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    const projectsUsed = projects.length;

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    const membersUsed = members.length;

    // Get subscription data from user (primary source)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    const plan = ((user?.subscriptionPlan || team.subscriptionPlan || "free") as
      | "free"
      | "basic"
      | "ai"
      | "ai_scale"
      | "pro"
      | "enterprise");
    const limits = (user?.subscriptionLimits || team.subscriptionLimits || {
      maxProjects:
        plan === "free"
          ? 1
          : plan === "basic"
            ? 10
            : plan === "ai"
              ? 4
              : plan === "ai_scale"
                ? 10
                : plan === "pro"
                  ? 50
                  : 999,
      maxTeamMembers:
        plan === "free"
          ? 1
          : plan === "basic"
            ? 15
            : plan === "ai" || plan === "ai_scale"
              ? 25
              : plan === "pro"
                ? 50
                : 999,
    }) as { maxProjects: number; maxTeamMembers: number };

    const projectsLimit = limits.maxProjects;
    const membersLimit = limits.maxTeamMembers;

    const projectsPercentUsed = projectsLimit > 0 ? Math.round((projectsUsed / projectsLimit) * 100) : 0;
    const membersPercentUsed = membersLimit > 0 ? Math.round((membersUsed / membersLimit) * 100) : 0;

    return {
      projectsUsed,
      projectsLimit,
      projectsPercentUsed,
      membersUsed,
      membersLimit,
      membersPercentUsed,
    };
  },
});
