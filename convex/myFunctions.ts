import { v } from "convex/values";
import { internalMutation, action } from "./_generated/server";
const internalAny = require("./_generated/api").internal as any;

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

const generateNextProjectId = async (ctx: any) => {
  const projects = await ctx.db.query("projects").collect();
  const maxProjectId = projects.reduce((max: number, project: any) => {
    return (project.projectId || 0) > max ? (project.projectId || 0) : max;
  }, 0);
  return maxProjectId + 1;
};

const ensureUniqueTeamSlug = async (ctx: any, base: string, userId: string) => {
  const baseSlug = base ? generateSlug(base) : "workspace";
  let slug = baseSlug || "workspace";
  let counter = 1;
  while (true) {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();
    if (!existing) {
      return slug;
    }
    slug = `${baseSlug || "workspace"}-${userId.slice(0, 6)}-${counter}`;
    counter++;
  }
};

export const ensurePersonalWorkspace = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const existingTeam = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", args.clerkUserId))
      .unique();

    const displayName =
      args.name && args.name.trim().length > 0
        ? args.name
        : args.email
          ? `${args.email} Workspace`
          : "My Workspace";

    if (existingTeam) {
      await ctx.db.patch(existingTeam._id, {
        name: displayName,
        imageUrl: args.imageUrl,
      });

      const membership = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", existingTeam._id).eq("clerkUserId", args.clerkUserId)
        )
        .unique();

      if (!membership) {
        await ctx.db.insert("teamMembers", {
          teamId: existingTeam._id,
          clerkUserId: args.clerkUserId,
          role: "admin",
          isActive: true,
          joinedAt: Date.now(),
          permissions: [],
        });
      } else if (!membership.isActive || membership.role !== "admin") {
        await ctx.db.patch(membership._id, { role: "admin", isActive: true });
      }

      return { teamId: existingTeam._id };
    }

    const slug = await ensureUniqueTeamSlug(ctx, displayName, args.clerkUserId);

    const teamId = await ctx.db.insert("teams", {
      ownerUserId: args.clerkUserId,
      name: displayName,
      slug,
      imageUrl: args.imageUrl,
      createdBy: args.clerkUserId,
    });

    await ctx.db.insert("teamMembers", {
      teamId,
      clerkUserId: args.clerkUserId,
      role: "admin",
      isActive: true,
      joinedAt: Date.now(),
      permissions: [],
    });

    const defaultStatusSettings = {
      todo: { name: "To Do", color: "#808080" },
      in_progress: { name: "In Progress", color: "#3b82f6" },
      done: { name: "Done", color: "#22c55e" },
    };

    const assistants = [
      {
        name: "Workout Assistant",
        prompt:
          "You are a workout assistant. Create training plans, track progress, and suggest workouts tailored to the user's focus, equipment, and schedule. Keep guidance concise and actionable.",
      },
      {
        name: "Business Assistant",
        prompt:
          "You are a business assistant. Help plan projects, prioritize tasks, draft plans, and provide strategic/operational guidance. Be structured, concise, and execution-focused.",
      },
    ];

    for (const assistant of assistants) {
      const baseSlug = generateSlug(assistant.name);
      let projectSlug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await ctx.db
          .query("projects")
          .withIndex("by_team_and_slug", (q: any) => q.eq("teamId", teamId).eq("slug", projectSlug))
          .first();
        if (!existing) {
          break;
        }
        projectSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      const nextProjectId = await generateNextProjectId(ctx);

      await ctx.db.insert("projects", {
        name: assistant.name,
        description: undefined,
        teamId,
        slug: projectSlug,
        projectId: nextProjectId,
        status: "active",
        location: undefined,
        budget: undefined,
        startDate: undefined,
        endDate: undefined,
        createdBy: args.clerkUserId,
        assignedTo: [],
        taskStatusSettings: defaultStatusSettings,
        customAiPrompt: assistant.prompt,
      });
    }

    return { teamId };
  },
});

export const createOrUpdateUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
      });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
      });
    }

    await ctx.runMutation(internalAny.myFunctions.ensurePersonalWorkspace, {
      clerkUserId: args.clerkUserId,
      name: args.name,
      email: args.email,
      imageUrl: args.imageUrl,
    });
  },
});

export const deleteUser = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const parseTaskFromChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    console.log("This function is deprecated. Please use api.tasks.parseTaskFromChat");
    return { isTask: false };
  },
});
