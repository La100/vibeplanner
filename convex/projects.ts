import { v } from "convex/values";
import { internalMutation, internalQuery, query, mutation } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { getPreset } from "./ai/presets.server";
import { r2 } from "./files";
import { components } from "./_generated/api";
const internalAny = require("./_generated/api").internal as any;

const getProjectImageUrl = async (
  imageUrl?: string
): Promise<string | undefined> => {
  if (!imageUrl) return undefined;

  const looksLikeUrl = /^https?:\/\//i.test(imageUrl);
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

  let key: string | null = null;
  if (!looksLikeUrl) {
    key = imageUrl;
  } else if (publicBase && imageUrl.startsWith(`${publicBase}/`)) {
    key = imageUrl.slice(publicBase.length + 1);
  }

  if (!key) return imageUrl;

  try {
    return await r2.getUrl(key, { expiresIn: 60 * 60 * 24 });
  } catch (error) {
    console.error("Failed to generate signed project image URL:", error);
    return imageUrl;
  }
};

// Utility function to generate a slug from a string
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

// Utility function to generate next project ID
const generateNextProjectId = async (ctx: any) => {
  const projects = await ctx.db.query("projects").collect();
  const maxProjectId = projects.reduce((max: number, project: any) => {
    return (project.projectId || 0) > max ? (project.projectId || 0) : max;
  }, 0);
  return maxProjectId + 1;
};

// ====== CORE PROJECT FUNCTIONS ======

// Get projects by team ID
export const getProjectsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is member of this team
    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this team");
    }

    // Get all projects for the team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    return projects.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listProjectsForCurrentUser = query({
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

    if (!team) {
      return [];
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      return [];
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    const taskCountsByProjectId = new Map<string, { total: number; completed: number }>();
    for (const task of tasks) {
      const key = String(task.projectId);
      const stats = taskCountsByProjectId.get(key) ?? { total: 0, completed: 0 };
      stats.total += 1;
      if (task.status === "done") stats.completed += 1;
      taskCountsByProjectId.set(key, stats);
    }

    const projectsWithTasks = await Promise.all(
      projects.map(async (project) => {
        const [stats, resolvedImageUrl] = await Promise.all([
          Promise.resolve(taskCountsByProjectId.get(String(project._id)) ?? { total: 0, completed: 0 }),
          getProjectImageUrl(project.imageUrl),
        ]);

        return {
          ...project,
          imageUrl: resolvedImageUrl,
          taskCount: stats.total,
          completedTasks: stats.completed,
        };
      })
    );

    return projectsWithTasks;
  },
});

export const listProjectsByTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user has access to this team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || !teamMember.isActive) {
      return [];
    }

    // Get all projects for this team
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    const projectsWithImages = await Promise.all(
      projects.map(async (project) => ({
        ...project,
        imageUrl: await getProjectImageUrl(project.imageUrl),
      }))
    );

    return projectsWithImages;
  },
});

export const createProjectInOrg = mutation({
  args: {
    name: v.string(),
    teamId: v.id("teams"),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    customAiPrompt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    assistantPreset: v.optional(v.union(
      v.literal("custom"),
      v.literal("gymbro"),
      v.literal("martin"),
      v.literal("buddha"),
      v.literal("marcus"),
      v.literal("startup"),
    )),
    assistantOnboardingEnabled: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db.get(args.teamId);
    if (!team || team.ownerUserId !== identity.subject) {
      throw new Error("Workspace not found");
    }

    // Ensure owner has an active admin membership before checking plan limits.
    let creatorMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", identity.subject))
      .unique();

    if (!creatorMembership) {
      await ctx.db.insert("teamMembers", {
        teamId: team._id,
        clerkUserId: identity.subject,
        role: "admin",
        isActive: true,
        joinedAt: Date.now(),
        permissions: [],
      });
    } else if (creatorMembership.role !== "admin" || !creatorMembership.isActive) {
      await ctx.db.patch(creatorMembership._id, { role: "admin", isActive: true });
    }

    const limitCheck = await ctx.runQuery(internalAny.stripe.checkTeamLimits, {
      teamId: args.teamId,
      action: "create_project",
    });
    if (!limitCheck?.allowed) {
      const limit = typeof limitCheck?.limit === "number" ? limitCheck.limit : undefined;
      throw new Error(
        limit
          ? `Assistant limit reached (${limit}) for your current plan. Upgrade to add more assistants.`
          : "Assistant limit reached for your current plan. Upgrade to add more assistants."
      );
    }

    const baseSlug = generateSlug(args.name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_team_and_slug", (q) => q.eq("teamId", team._id).eq("slug", slug))
        .first();
      if (!existing) {
        break;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const defaultStatusSettings = {
      todo: { name: "To Do", color: "#808080" },
      in_progress: { name: "In Progress", color: "#3b82f6" },
      done: { name: "Done", color: "#22c55e" },
    };

    const nextProjectId = await generateNextProjectId(ctx);

    const resolvedPreset = args.assistantPreset ?? "custom";
    const preset = getPreset(resolvedPreset);
    // Copy SOUL from preset to project (each project has its own SOUL)
    const projectSoul = args.customAiPrompt || preset?.defaultSoul || "";

    const shouldStartOnboarding = resolvedPreset === "gymbro"
      || resolvedPreset === "martin"
      || resolvedPreset === "buddha"
      || resolvedPreset === "marcus"
      || resolvedPreset === "startup"
      || (resolvedPreset === "custom" && args.assistantOnboardingEnabled);

    // Only enable onboarding when explicitly requested for custom
    const assistantOnboarding = shouldStartOnboarding
      ? { status: "pending" as const, lastUpdated: Date.now() }
      : undefined;

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      teamId: args.teamId,
      slug: slug,
      projectId: nextProjectId,
      status: "planning",
      createdBy: identity.subject,
      assignedTo: [],
      taskStatusSettings: defaultStatusSettings,
      startDate: args.startDate,
      endDate: args.endDate,
      location: args.location,
      budget: args.budget,
      imageUrl: args.imageUrl,
      soul: projectSoul, // Per-project SOUL
      assistantPreset: resolvedPreset,
      assistantOnboarding,
    });

    return { id: projectId, slug: slug };
  },
});

export const getProjectBySlug = query({
  args: {
    teamSlug: v.string(),
    projectSlug: v.string(),
  },
  async handler(ctx, args) {
    const team = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", args.teamSlug)).unique();
    if (!team) return null;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug)
      )
      .unique();

    if (!project) return null;
    const resolvedImageUrl = await getProjectImageUrl(project.imageUrl);
    return { ...project, imageUrl: resolvedImageUrl };
  },
});

export const getProjectBySlugForCurrentUser = query({
  args: {
    projectSlug: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .unique();
    if (!team) return null;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug)
      )
      .unique();

    if (!project) return null;
    const resolvedImageUrl = await getProjectImageUrl(project.imageUrl);
    return { ...project, imageUrl: resolvedImageUrl };
  },
});

export const getDefaultProjectForOnboarding = query({
  args: {},
  returns: v.union(v.null(), v.object({
    _id: v.id("projects"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    assistantPreset: v.optional(v.string()),
  })),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", identity.subject))
      .unique();
    if (!team) return null;

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    if (projects.length === 0) return null;

    const preferred =
      projects.find((p) => p.status === "active") ??
      projects[0];

    const resolvedImageUrl = await getProjectImageUrl(preferred.imageUrl);
    return {
      _id: preferred._id,
      name: preferred.name,
      imageUrl: resolvedImageUrl,
      assistantPreset: preferred.assistantPreset,
    };
  },
});


export const getProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    const [team, resolvedImageUrl] = await Promise.all([
      ctx.db.get(project.teamId),
      getProjectImageUrl(project.imageUrl),
    ]);
    if (!team) {
      return { ...project, imageUrl: resolvedImageUrl, teamName: "Unknown Team" };
    }
    return { ...project, imageUrl: resolvedImageUrl, teamName: team.name };
  }
});

// Internal query for messaging webhooks (no auth required)
export const getProjectByIdInternal = internalQuery({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const [team, resolvedImageUrl] = await Promise.all([
      ctx.db.get(project.teamId),
      getProjectImageUrl(project.imageUrl),
    ]);
    return { ...project, imageUrl: resolvedImageUrl, teamName: team?.name || "Unknown Team" };
  },
});

export const getProjectByTelegramWebhookSecret = internalQuery({
  args: { telegramWebhookSecret: v.string() },
  async handler(ctx, args) {
    return await ctx.db
      .query("projects")
      .withIndex("by_telegram_webhook_secret", (q) =>
        q.eq("telegramWebhookSecret", args.telegramWebhookSecret)
      )
      .first();
  },
});

export const updateProjectTelegramConfigInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    telegramBotToken: v.string(),
    telegramBotUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", args.actorUserId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
      throw new Error("Not authorized");
    }

    const isTokenUpdated = args.telegramBotToken !== project.telegramBotToken;
    const shouldRotateTelegramSecret =
      !!args.telegramBotToken &&
      (!project.telegramWebhookSecret || isTokenUpdated);
    const telegramWebhookSecret = shouldRotateTelegramSecret
      ? generateTelegramWebhookSecret()
      : project.telegramWebhookSecret;

    await ctx.db.patch(args.projectId, {
      telegramBotToken: args.telegramBotToken,
      ...(args.telegramBotUsername ? { telegramBotUsername: args.telegramBotUsername } : {}),
      ...(shouldRotateTelegramSecret ? { telegramWebhookSecret } : {}),
    });

    if (isTokenUpdated || shouldRotateTelegramSecret) {
      await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.setTelegramWebhook, {
        projectId: args.projectId,
      });
    }

    return { success: true };
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    assistantPreset: v.optional(v.union(
      v.literal("custom"),
      v.literal("gymbro"),
      v.literal("martin"),
      v.literal("buddha"),
      v.literal("marcus"),
      v.literal("startup"),
    )),
    status: v.optional(v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    location: v.optional(v.string()),
    taskStatusSettings: v.optional(v.any()), // Allow any object for simplification
    customAiPrompt: v.optional(v.string()),
    soul: v.optional(v.string()), // Per-project AI SOUL
    telegramBotUsername: v.optional(v.string()),
    telegramBotToken: v.optional(v.string()),
    whatsappNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { projectId, name, telegramBotToken, assistantPreset, ...rest } = args;

    const existingProject = await ctx.db.get(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Permission check (example)
    // const member = await ctx.db.query("teamMembers").withIndex("by_team_and_user", q => q.eq("teamId", existingProject.teamId).eq("clerkUserId", identity.subject)).first();
    // if (!member || (member.role !== 'admin' && member.role !== 'member')) {
    //   throw new Error("You don't have permission to update this project.");
    // }

    // Check if Telegram bot token is being updated
    const isTokenUpdated = telegramBotToken && telegramBotToken !== existingProject.telegramBotToken;
    const shouldRotateTelegramSecret =
      !!(telegramBotToken ?? existingProject.telegramBotToken) &&
      (!existingProject.telegramWebhookSecret || isTokenUpdated);
    const telegramWebhookSecret = shouldRotateTelegramSecret
      ? generateTelegramWebhookSecret()
      : existingProject.telegramWebhookSecret;

    const assistantOnboardingUpdate =
      assistantPreset === undefined
        ? {}
        : assistantPreset === "gymbro" || assistantPreset === "martin" || assistantPreset === "buddha" || assistantPreset === "marcus" || assistantPreset === "startup"
          ? {
            assistantPreset,
            assistantOnboarding:
              existingProject.assistantOnboarding ?? { status: "pending", lastUpdated: Date.now() },
          }
          : { assistantPreset, assistantOnboarding: undefined };

    if (name && name !== existingProject.name) {
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;

      let existing;
      do {
        existing = await ctx.db
          .query("projects")
          .withIndex("by_team_and_slug", (q) =>
            q.eq("teamId", existingProject.teamId).eq("slug", slug)
          )
          .first();
        if (existing) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
      } while (existing);

      await ctx.db.patch(projectId, {
        name,
        slug,
        telegramBotToken,
        ...(shouldRotateTelegramSecret ? { telegramWebhookSecret } : {}),
        ...assistantOnboardingUpdate,
        ...rest,
      });

      // Setup webhook if token was updated
      if (isTokenUpdated || shouldRotateTelegramSecret) {
        await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.setTelegramWebhook, {
          projectId,
        });
      }

      return { slug };
    } else {
      await ctx.db.patch(projectId, {
        telegramBotToken,
        ...(shouldRotateTelegramSecret ? { telegramWebhookSecret } : {}),
        ...assistantOnboardingUpdate,
        ...rest,
      });

      // Setup webhook if token was updated
      if (isTokenUpdated || shouldRotateTelegramSecret) {
        await ctx.scheduler.runAfter(0, internalAny.messaging.telegramActions.setTelegramWebhook, {
          projectId,
        });
      }

      return { slug: existingProject.slug };
    }
  }
});

export const setProjectImageFromFileKey = mutation({
  args: {
    projectId: v.id("projects"),
    fileKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
    }

    await ctx.db.patch(args.projectId, { imageUrl: args.fileKey });

    const signedUrl = await getProjectImageUrl(args.fileKey);
    return { imageUrl: signedUrl };
  },
});

function generateTelegramWebhookSecret(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export const listTeamProjects = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    const projectsWithTaskCounts = await Promise.all(
      projects.map(async (project) => {
        const [tasks, resolvedImageUrl] = await Promise.all([
          ctx.db
            .query("tasks")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect(),
          getProjectImageUrl(project.imageUrl),
        ]);
        const completedTasks = tasks.filter(
          (task) => task.status === "done"
        ).length;
        return {
          ...project,
          imageUrl: resolvedImageUrl,
          taskCount: tasks.length,
          completedTasks: completedTasks,
        };
      })
    );

    return projectsWithTaskCounts;
  }
});

export const getProjectsForTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const clerkUserId = identity.subject;

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", clerkUserId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership) {
      return [];
    }

    let projects: Doc<"projects">[] = [];

    if (membership.role === "admin" || membership.role === "member") {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .collect();
    }

    projects.sort((a, b) => a.name.localeCompare(b.name));
    return projects;
  },
});

// ====== PROJECT ACCESS FUNCTIONS ======

export const checkUserProjectAccess = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const project = await ctx.db.get(args.projectId);
    if (!project) return false;

    // Check team membership
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || !teamMember.isActive) {
      return false;
    }

    // Admin has access to all projects in the team
    if (teamMember.role === "admin") {
      return teamMember;
    }

    if (teamMember.role === "member") {
      return teamMember;
    }

    // In other cases, no access
    return false;
  }
});

// ====== PROJECT DELETION ======

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get the project to check permissions
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Check if user has permission to delete (only admin role)
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Insufficient permissions to delete this project. Only admin can delete projects.");
    }

    // Unregister Telegram webhook before deleting the project
    if (project.telegramBotToken) {
      await ctx.scheduler.runAfter(
        0,
        internalAny.messaging.telegramActions.deleteTelegramWebhook,
        { botToken: project.telegramBotToken }
      );
    }

    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2Bucket = process.env.R2_BUCKET;
    const r2Endpoint = process.env.R2_ENDPOINT;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const canDeleteFromR2 = !!(r2AccessKeyId && r2Bucket && r2Endpoint && r2SecretAccessKey);

    // Delete project image from R2 if it looks like an internal key
    if (project.imageUrl && canDeleteFromR2) {
      const looksLikeUrl = /^https?:\/\//i.test(project.imageUrl);
      const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

      let key: string | null = null;
      if (!looksLikeUrl) {
        key = project.imageUrl;
      } else if (publicBase && project.imageUrl.startsWith(`${publicBase}/`)) {
        key = project.imageUrl.slice(publicBase.length + 1);
      }

      if (key) {
        try {
          await ctx.runMutation(components.r2.lib.deleteObject, {
            accessKeyId: r2AccessKeyId!,
            bucket: r2Bucket!,
            endpoint: r2Endpoint!,
            key,
            secretAccessKey: r2SecretAccessKey!,
          });
        } catch (error) {
          console.error(`Failed to delete project image from R2: ${error}`);
        }
      }
    }

    // Load tasks associated with the project (used for cascading deletes)
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    // Delete AI threads/messages/function calls for this project
    const threads = await ctx.db
      .query("aiThreads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const thread of threads) {
      const messages = await ctx.db
        .query("aiMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread.threadId))
        .collect();
      await Promise.all(messages.map((m) => ctx.db.delete(m._id)));

      const functionCalls = await ctx.db
        .query("aiFunctionCalls")
        .withIndex("by_thread", (q) => q.eq("threadId", thread.threadId))
        .collect();
      await Promise.all(functionCalls.map((c) => ctx.db.delete(c._id)));

      await ctx.db.delete(thread._id);
    }

    // Delete AI token usage + long-term memory for this project
    const tokenUsage = await ctx.db
      .query("aiTokenUsage")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(tokenUsage.map((u) => ctx.db.delete(u._id)));

    const longTermMemories = await ctx.db
      .query("aiLongTermMemories")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(longTermMemories.map((m) => ctx.db.delete(m._id)));

    // Delete all comments related to the project or its tasks
    const projectComments = await ctx.db
      .query("comments")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const taskComments = await Promise.all(
      tasks.map(task =>
        ctx.db
          .query("comments")
          .withIndex("by_task", q => q.eq("taskId", task._id))
          .collect()
      )
    ).then(results => results.flat());

    // Delete all comments related to project files (in case projectId wasn't set on the comment)
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const taskFiles = await Promise.all(
      tasks.map((task) =>
        ctx.db
          .query("files")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect()
      )
    ).then((results) => results.flat());

    const fileMap = new Map<string, Doc<"files">>();
    for (const f of [...projectFiles, ...taskFiles]) {
      fileMap.set(String(f._id), f);
    }
    const allFiles = Array.from(fileMap.values());

    const fileComments = await Promise.all(
      allFiles.map((file) =>
        ctx.db
          .query("comments")
          .withIndex("by_file", (q) => q.eq("fileId", file._id))
          .collect()
      )
    ).then((results) => results.flat());

    const commentMap = new Map<string, Doc<"comments">>();
    for (const c of [...projectComments, ...taskComments, ...fileComments]) {
      commentMap.set(String(c._id), c);
    }
    await Promise.all(Array.from(commentMap.values()).map((c) => ctx.db.delete(c._id)));

    // Delete diary entries related to the project
    const diaryEntries = await ctx.db
      .query("diaryEntries")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(diaryEntries.map((entry) => ctx.db.delete(entry._id)));

    // Delete all habits (and their completions) associated with the project (stops future reminder rescheduling)
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const habit of habits) {
      try {
        await ctx.runMutation(internalAny.messaging.reminders.unscheduleHabitReminder, {
          habitId: habit._id,
        });
      } catch (error) {
        console.error("Failed to unschedule habit reminder during project delete:", error);
      }

      const completions = await ctx.db
        .query("habitCompletions")
        .withIndex("by_habit_and_date", (q) => q.eq("habitId", habit._id))
        .collect();
      await Promise.all(completions.map((completion) => ctx.db.delete(completion._id)));
      await ctx.db.delete(habit._id);
    }

    // Delete messaging channels + pairing artifacts for the project
    const channels = await ctx.db
      .query("messagingChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(channels.map((c) => ctx.db.delete(c._id)));

    const pairingRequests = await ctx.db
      .query("messagingPairingRequests")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(pairingRequests.map((r) => ctx.db.delete(r._id)));

    const pairingTokensTelegram = await ctx.db
      .query("messagingPairingTokens")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "telegram")
      )
      .collect();
    const pairingTokensWhatsapp = await ctx.db
      .query("messagingPairingTokens")
      .withIndex("by_project_and_platform", (q) =>
        q.eq("projectId", args.projectId).eq("platform", "whatsapp")
      )
      .collect();
    await Promise.all([...pairingTokensTelegram, ...pairingTokensWhatsapp].map((t) => ctx.db.delete(t._id)));

    // Delete files related to the project (and their R2 objects)
    for (const file of allFiles) {
      if (canDeleteFromR2) {
        try {
          await ctx.runMutation(components.r2.lib.deleteObject, {
            accessKeyId: r2AccessKeyId!,
            bucket: r2Bucket!,
            endpoint: r2Endpoint!,
            key: file.storageId,
            secretAccessKey: r2SecretAccessKey!,
          });
        } catch (error) {
          console.error(`Failed to delete file from R2: ${error}`);
        }
      }
      await ctx.db.delete(file._id);
    }

    // Delete all folders related to the project (after deleting files)
    const projectFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();
    await Promise.all(projectFolders.map((folder) => ctx.db.delete(folder._id)));

    // Delete all tasks associated with the project
    await Promise.all(tasks.map((task) => ctx.db.delete(task._id)));

    // Finally, delete the project itself
    await ctx.db.delete(args.projectId);

    return { success: true };
  }
});

// Update project task status settings
export const updateProjectTaskStatusSettings = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    }),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error("You don't have permission to update these settings.");
    }

    await ctx.db.patch(args.projectId, {
      taskStatusSettings: args.settings,
    });

    return { success: true };
  }
});

export const completeOnboarding = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    if (project.assistantOnboarding?.status === "pending") {
      await ctx.db.patch(args.projectId, {
        assistantOnboarding: {
          status: "completed",
          lastUpdated: Date.now(),
        },
      });
    }
  },
});

export const completeOnboardingInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", args.actorUserId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership || (membership.role !== "admin" && membership.role !== "member")) {
      throw new Error("Not authorized");
    }

    if (project.assistantOnboarding?.status === "pending") {
      await ctx.db.patch(args.projectId, {
        assistantOnboarding: {
          status: "completed",
          lastUpdated: Date.now(),
        },
      });
    }
  },
});
