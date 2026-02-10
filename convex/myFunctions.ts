import { v } from "convex/values";
import { internalMutation, action } from "./_generated/server";
const internalAny = require("./_generated/api").internal as any;

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

const toIdKey = (value: unknown) => String(value);

const dedupeIdList = <T>(values: T[]) => {
  const map = new Map<string, T>();
  for (const value of values) {
    map.set(toIdKey(value), value);
  }
  return Array.from(map.values());
};

const deleteProjectCascade = async (ctx: any, projectId: any) => {
  const project = await ctx.db.get(projectId);
  if (!project) return;

  if (project.telegramBotToken) {
    await ctx.scheduler.runAfter(
      0,
      internalAny.messaging.telegramActions.deleteTelegramWebhook,
      { botToken: project.telegramBotToken }
    );
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  const threads = await ctx.db
    .query("aiThreads")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  for (const thread of threads) {
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_thread", (q: any) => q.eq("threadId", thread.threadId))
      .collect();
    await Promise.all(messages.map((message: any) => ctx.db.delete(message._id)));

    const functionCalls = await ctx.db
      .query("aiFunctionCalls")
      .withIndex("by_thread", (q: any) => q.eq("threadId", thread.threadId))
      .collect();
    await Promise.all(functionCalls.map((call: any) => ctx.db.delete(call._id)));

    await ctx.db.delete(thread._id);
  }

  const tokenUsage = await ctx.db
    .query("aiTokenUsage")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(tokenUsage.map((usage: any) => ctx.db.delete(usage._id)));

  const longTermMemories = await ctx.db
    .query("aiLongTermMemories")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(longTermMemories.map((memory: any) => ctx.db.delete(memory._id)));

  const projectComments = await ctx.db
    .query("comments")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  const taskComments = await Promise.all(
    tasks.map((task: any) =>
      ctx.db
        .query("comments")
        .withIndex("by_task", (q: any) => q.eq("taskId", task._id))
        .collect()
    )
  ).then((results: any[][]) => results.flat());

  const projectFiles = await ctx.db
    .query("files")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  const taskFiles = await Promise.all(
    tasks.map((task: any) =>
      ctx.db
        .query("files")
        .withIndex("by_task", (q: any) => q.eq("taskId", task._id))
        .collect()
    )
  ).then((results: any[][]) => results.flat());

  const allFiles = dedupeIdList<any>([...projectFiles, ...taskFiles]);

  const fileComments = await Promise.all(
    allFiles.map((file: any) =>
      ctx.db
        .query("comments")
        .withIndex("by_file", (q: any) => q.eq("fileId", file._id))
        .collect()
    )
  ).then((results: any[][]) => results.flat());

  const allComments = dedupeIdList<any>([
    ...projectComments,
    ...taskComments,
    ...fileComments,
  ]);
  await Promise.all(allComments.map((comment: any) => ctx.db.delete(comment._id)));

  const diaryEntries = await ctx.db
    .query("diaryEntries")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(diaryEntries.map((entry: any) => ctx.db.delete(entry._id)));

  const habits = await ctx.db
    .query("habits")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  for (const habit of habits) {
    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_and_date", (q: any) => q.eq("habitId", habit._id))
      .collect();
    await Promise.all(
      completions.map((completion: any) => ctx.db.delete(completion._id))
    );
    await ctx.db.delete(habit._id);
  }

  const channels = await ctx.db
    .query("messagingChannels")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(channels.map((channel: any) => ctx.db.delete(channel._id)));

  const pairingRequests = await ctx.db
    .query("messagingPairingRequests")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(pairingRequests.map((request: any) => ctx.db.delete(request._id)));

  const pairingTokensTelegram = await ctx.db
    .query("messagingPairingTokens")
    .withIndex("by_project_and_platform", (q: any) =>
      q.eq("projectId", projectId).eq("platform", "telegram")
    )
    .collect();
  const pairingTokensWhatsapp = await ctx.db
    .query("messagingPairingTokens")
    .withIndex("by_project_and_platform", (q: any) =>
      q.eq("projectId", projectId).eq("platform", "whatsapp")
    )
    .collect();
  await Promise.all(
    [...pairingTokensTelegram, ...pairingTokensWhatsapp].map((token: any) =>
      ctx.db.delete(token._id)
    )
  );

  await Promise.all(allFiles.map((file: any) => ctx.db.delete(file._id)));

  const folders = await ctx.db
    .query("folders")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  await Promise.all(folders.map((folder: any) => ctx.db.delete(folder._id)));

  await Promise.all(tasks.map((task: any) => ctx.db.delete(task._id)));

  const memories = await ctx.db.query("aiMemories").collect();
  const projectMemories = memories.filter(
    (memory: any) => memory.projectId && toIdKey(memory.projectId) === toIdKey(projectId)
  );
  await Promise.all(projectMemories.map((memory: any) => ctx.db.delete(memory._id)));

  await ctx.db.delete(projectId);
};

const deleteTeamCascade = async (ctx: any, teamId: any) => {
  const team = await ctx.db.get(teamId);
  if (!team) return;

  const projects = await ctx.db
    .query("projects")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();

  for (const project of projects) {
    await deleteProjectCascade(ctx, project._id);
  }

  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  await Promise.all(tasks.map((task: any) => ctx.db.delete(task._id)));

  const habits = await ctx.db
    .query("habits")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  for (const habit of habits) {
    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_and_date", (q: any) => q.eq("habitId", habit._id))
      .collect();
    await Promise.all(
      completions.map((completion: any) => ctx.db.delete(completion._id))
    );
    await ctx.db.delete(habit._id);
  }

  const files = await ctx.db
    .query("files")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  const fileComments = await Promise.all(
    files.map((file: any) =>
      ctx.db
        .query("comments")
        .withIndex("by_file", (q: any) => q.eq("fileId", file._id))
        .collect()
    )
  ).then((results: any[][]) => results.flat());
  await Promise.all(fileComments.map((comment: any) => ctx.db.delete(comment._id)));
  await Promise.all(files.map((file: any) => ctx.db.delete(file._id)));

  const folders = await ctx.db
    .query("folders")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  await Promise.all(folders.map((folder: any) => ctx.db.delete(folder._id)));

  const channels = await ctx.db
    .query("messagingChannels")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  await Promise.all(channels.map((channel: any) => ctx.db.delete(channel._id)));

  const teamTokenUsage = await ctx.db
    .query("aiTokenUsage")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  await Promise.all(teamTokenUsage.map((usage: any) => ctx.db.delete(usage._id)));

  const allComments = await ctx.db.query("comments").collect();
  const teamComments = allComments.filter(
    (comment: any) => toIdKey(comment.teamId) === toIdKey(teamId)
  );
  await Promise.all(teamComments.map((comment: any) => ctx.db.delete(comment._id)));

  const allPairingTokens = await ctx.db.query("messagingPairingTokens").collect();
  const teamPairingTokens = allPairingTokens.filter(
    (token: any) => toIdKey(token.teamId) === toIdKey(teamId)
  );
  await Promise.all(teamPairingTokens.map((token: any) => ctx.db.delete(token._id)));

  const teamMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();
  await Promise.all(teamMembers.map((member: any) => ctx.db.delete(member._id)));

  await ctx.db.delete(teamId);
};

const removeMembershipAndCleanupTeam = async (
  ctx: any,
  teamId: any,
  removedUserId?: string
) => {
  const remainingMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_team", (q: any) => q.eq("teamId", teamId))
    .collect();

  if (remainingMembers.length === 0) {
    await deleteTeamCascade(ctx, teamId);
    return;
  }

  if (!removedUserId) return;

  const team = await ctx.db.get(teamId);
  if (!team || team.ownerUserId !== removedUserId) return;

  const nextOwner =
    remainingMembers.find((member: any) => member.role === "admin") ??
    remainingMembers[0];

  await ctx.db.patch(teamId, {
    ownerUserId: nextOwner.clerkUserId,
  });
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
    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    const affectedTeamIds = dedupeIdList<any>(
      memberships.map((membership: any) => membership.teamId)
    );

    await Promise.all(
      memberships.map((membership: any) => ctx.db.delete(membership._id))
    );

    for (const teamId of affectedTeamIds) {
      await removeMembershipAndCleanupTeam(ctx, teamId, args.clerkUserId);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

export const deleteOrganization = internalMutation({
  args: { clerkOrgId: v.string() },
  async handler(ctx, args) {
    const teams = await ctx.db.query("teams").collect();
    const organizationTeams = teams.filter(
      (team: any) => team.clerkOrgId === args.clerkOrgId
    );

    for (const team of organizationTeams) {
      await deleteTeamCascade(ctx, team._id);
    }

    const members = await ctx.db.query("teamMembers").collect();
    const membersInOrganization = members.filter(
      (member: any) => member.clerkOrgId === args.clerkOrgId
    );

    const affectedTeamIds = dedupeIdList<any>(
      membersInOrganization.map((member: any) => member.teamId)
    );

    await Promise.all(
      membersInOrganization.map((member: any) => ctx.db.delete(member._id))
    );

    for (const teamId of affectedTeamIds) {
      await removeMembershipAndCleanupTeam(ctx, teamId);
    }
  },
});

export const deleteOrganizationMembership = internalMutation({
  args: {
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    const allTeams = await ctx.db.query("teams").collect();
    const organizationTeamIds = new Set(
      allTeams
        .filter((team: any) => team.clerkOrgId === args.clerkOrgId)
        .map((team: any) => toIdKey(team._id))
    );

    const userMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    const membershipsToDelete = userMemberships.filter(
      (membership: any) =>
        membership.clerkOrgId === args.clerkOrgId ||
        organizationTeamIds.has(toIdKey(membership.teamId))
    );

    const affectedTeamIds = dedupeIdList<any>(
      membershipsToDelete.map((membership: any) => membership.teamId)
    );

    await Promise.all(
      membershipsToDelete.map((membership: any) => ctx.db.delete(membership._id))
    );

    for (const teamId of affectedTeamIds) {
      await removeMembershipAndCleanupTeam(ctx, teamId, args.clerkUserId);
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
