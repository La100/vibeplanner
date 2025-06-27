import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query, mutation, action } from "./_generated/server";

// Utility function to generate a slug from a string
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

// Create a new user or update an existing one
export const createOrUpdateUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { email: args.email, name: args.name });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        email: args.email,
        name: args.name,
      });
    }
  },
});

// Delete a user
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

// Create or update a team based on a Clerk organization
export const createOrUpdateTeam = internalMutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
    
    const slug = args.slug || generateSlug(args.name);

    if (team) {
      await ctx.db.patch(team._id, { name: args.name, slug: slug, imageUrl: args.imageUrl });
    } else {
      await ctx.db.insert("teams", {
        clerkOrgId: args.clerkOrgId,
        name: args.name,
        slug: slug,
        imageUrl: args.imageUrl,
        // createdBy is optional and will not be set by the webhook
      });
    }
  },
});

// Delete a team if it exists
export const deleteTeamInternal = internalMutation({
  args: { clerkOrgId: v.string() },
  async handler(ctx, args) {
    console.log(`Attempting to delete team with clerkOrgId: ${args.clerkOrgId}`);
    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (team) {
      console.log(`Found team to delete: ${team.name} (ID: ${team._id})`);

      // 1. Find and delete all members of the team
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      const memberDeletionPromises = members.map((member) =>
        ctx.db.delete(member._id)
      );
      await Promise.all(memberDeletionPromises);
      console.log(`Deleted ${members.length} members from team ${team.name}.`);

      // 2. Find and delete all projects and their tasks
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      console.log(`Found ${projects.length} projects to delete for team ${team.name}.`);

      const projectDeletionPromises = projects.map(async (project) => {
        // Delete tasks for each project
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const taskDeletionPromises = tasks.map((task) =>
          ctx.db.delete(task._id)
        );
        await Promise.all(taskDeletionPromises);
        console.log(`Deleted ${tasks.length} tasks for project ${project.name}.`);

        // Delete the project itself
        await ctx.db.delete(project._id);
        console.log(`Deleted project ${project.name}.`);
      });
      await Promise.all(projectDeletionPromises);

      // 3. Delete the team itself
      await ctx.db.delete(team._id);
      console.log(`Team, members, projects, and tasks deleted successfully.`);
    } else {
      console.warn(
        `Webhook for deleteTeamInternal was called, but no team found with clerkOrgId: ${args.clerkOrgId}`
      );
    }
  },
});

// Create or update a team membership
export const createOrUpdateMembership = internalMutation({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
        role: v.string(),
        orgName: v.string(),
        orgSlug: v.string(),
        orgImageUrl: v.optional(v.string()),
    },
    async handler(ctx, args) {
        let team = await ctx.db
            .query("teams")
            .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();
        
        if(!team) {
            console.warn(`Team not found for clerkOrgId: ${args.clerkOrgId}. Creating it from membership webhook.`);
            const teamId = await ctx.db.insert("teams", {
                clerkOrgId: args.clerkOrgId,
                name: args.orgName,
                slug: args.orgSlug,
                imageUrl: args.orgImageUrl,
            });
            team = {
                _id: teamId,
                _creationTime: Date.now(),
                clerkOrgId: args.clerkOrgId,
                name: args.orgName,
                slug: args.orgSlug,
                imageUrl: args.orgImageUrl,
            };
        };

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
            .unique();
        
        if(!user) {
            console.error(`User not found for webhook processing: clerkUserId=${args.clerkUserId}`);
            return;
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();
        
        const role = args.role === "admin" ? "admin" : "member";

        if(membership){
            await ctx.db.patch(membership._id, { role: role });
        } else {
            await ctx.db.insert("teamMembers", {
                teamId: team._id,
                clerkUserId: args.clerkUserId,
                clerkOrgId: args.clerkOrgId,
                role: role,
                isActive: true,
                joinedAt: Date.now(),
                permissions: [],
            });
        }
    }
});

// Delete a team membership
export const deleteMembership = internalMutation({
    args: {
        clerkOrgId: v.string(),
        clerkUserId: v.string(),
    },
    async handler(ctx, args) {
        const team = await ctx.db
            .query("teams")
            .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();
        
        if(!team) return;

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();
        
        if(membership){
            await ctx.db.delete(membership._id);
        }
    }
});

export const deleteTeam = internalMutation({
    args: { clerkOrgId: v.string() },
    async handler(ctx, args) {
        const team = await ctx.db
            .query("teams")
            .withIndex("by_clerk_org", q => q.eq("clerkOrgId", args.clerkOrgId))
            .unique();

        if (team) {
            await ctx.db.delete(team._id);
        }
    }
});

// =================================================================
// ============== UI-FACING QUERIES & MUTATIONS ====================
// =================================================================

export const listUserTeams = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userMemberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const teams = [];
    for (const membership of userMemberships) {
      const team = await ctx.db.get(membership.teamId);
      if (team) {
        teams.push(team);
      }
    }
    return teams;
  },
});

export const getTeamByClerkOrg = query({
  args: {
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();
  },
});

export const listProjectsByClerkOrg = query({
  args: { clerkOrgId: v.string() },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
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

    if (!membership) {
      return [];
    }

    let projects;
    if (membership.role === "admin" || membership.role === "member") {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
    } else {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      
      projects = projects.filter(p => p.assignedTo.includes(identity.subject));
    }

    const projectsWithTasks = await Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const completedTasks = tasks.filter(
          (task) => task.status === "completed"
        ).length;
        return {
          ...project,
          taskCount: tasks.length,
          completedTasks: completedTasks,
        };
      })
    );

    return projectsWithTasks;
  },
});

export const createProjectInOrg = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    clerkOrgId: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    client: v.optional(v.string()),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (!team) {
      throw new Error("Team not found for this organization");
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

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      teamId: team._id,
      slug: slug,
      status: "planning",
      priority: args.priority,
      client: args.client,
      location: args.location,
      budget: args.budget,
      startDate: args.startDate,
      endDate: args.endDate,
      createdBy: identity.subject, // Clerk user ID
      assignedTo: [],
    });

    return { id: projectId, slug: slug };
  },
});

export const createUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called createUser without authentication present");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) =>
        q.eq("clerkUserId", identity.subject)
      )
      .unique();

    if (user !== null) {
      return user._id;
    }
    
    const userId = await ctx.db.insert("users", {
      clerkUserId: identity.subject,
      email: identity.email!,
      name: identity.name,
    });

    return userId;
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
    }
});

export const getProjectBySlug = query({
  args: { 
    teamSlug: v.string(),
    projectSlug: v.string(),
  },
  async handler(ctx, args) {
    const team = await ctx.db.query("teams").withIndex("by_slug", q => q.eq("slug", args.teamSlug)).unique();
    if(!team) return null;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_team_and_slug", (q) =>
        q.eq("teamId", team._id).eq("slug", args.projectSlug)
      )
      .unique();
    
    return project;
  },
});

export const listProjectTasks = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();
  }
});

export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    dueDate: v.optional(v.number()),
    assignedTo: v.optional(v.string()),
    tags: v.array(v.string()),
    estimatedHours: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    return await ctx.db.insert("tasks", {
      projectId: args.projectId,
      teamId: project.teamId,
      title: args.title,
      description: args.description,
      status: "todo",
      priority: args.priority,
      dueDate: args.dueDate,
      assignedTo: args.assignedTo,
      createdBy: identity.subject,
      tags: args.tags,
    });
  }
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("completed"),
      v.literal("blocked")
    ),
  },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { status: args.status });
  },
});

export const toggleTaskStatus = mutation({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const newStatus = task.status === "completed" ? "todo" : "completed";
    await ctx.db.patch(args.taskId, { status: newStatus });
  }
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    const team = await ctx.db.get(project.teamId);
    if (!team) {
      return { ...project, teamName: "Unknown Team" };
    }
    return { ...project, teamName: team.name };
  }
});

export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { projectId, ...rest } = args;
    await ctx.db.patch(projectId, rest);
  }
});

export const listTeamProjects = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();

    const projectsWithTaskCounts = await Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const completedTasks = tasks.filter(
          (task) => task.status === "completed"
        ).length;
        return {
          ...project,
          taskCount: tasks.length,
          completedTasks: completedTasks,
        };
      })
    );

    return projectsWithTaskCounts;
  }
});

export const createProject = mutation({
  args: {
    teamId: v.id("teams"),
    name: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    client: v.optional(v.string()),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const slug = generateSlug(args.name);
    return await ctx.db.insert("projects", {
      ...args,
      slug,
      status: "planning",
      createdBy: identity.subject,
      assignedTo: [],
    });
  }
});

export const getTeam = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return ctx.db.get(args.teamId);
  }
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const { taskId, ...rest } = args;
    await ctx.db.patch(taskId, rest);
  }
});

export const inviteClientToProject = mutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
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

    // Generate a simple random token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const invitation = await ctx.db.insert("invitations", {
      email: args.email,
      projectId: args.projectId,
      teamId: project.teamId,
      role: "client",
      invitedBy: identity.subject,
      status: "pending",
      token: token,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    return invitation;
  }
});

export const acceptClientInvitation = mutation({
  args: {
    token: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated. Please sign up or log in to accept the invitation.");
    }

    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) {
      throw new Error("Invitation not found or expired.");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Invitation is already ${invitation.status}.`);
    }

    if (invitation.email !== identity.email) {
      throw new Error("This invitation is for a different email address.");
    }
    
    // This part assumes the user is already part of the Clerk organization.
    // In a real app, you might need to use the Clerk API to invite the user to the organization first
    // if they are not already a member.

    await ctx.db.patch(invitation._id, { status: "accepted" });

    if (invitation.projectId) {
      const project = await ctx.db.get(invitation.projectId);
      if (project) {
        const currentAssignedTo = project.assignedTo || [];
        if (!currentAssignedTo.includes(identity.subject)) {
          await ctx.db.patch(invitation.projectId, {
            assignedTo: [...currentAssignedTo, identity.subject],
          });
        }
      }
    }
    
    // We should also ensure the user is in teamMembers table.
    // The webhook for membership creation should handle this, but we can be defensive.
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => q.eq("teamId", invitation.teamId).eq("clerkUserId", identity.subject))
      .unique();

    if (!teamMember) {
      await ctx.db.insert("teamMembers", {
        teamId: invitation.teamId,
        clerkUserId: identity.subject,
        clerkOrgId: (await ctx.db.get(invitation.teamId))!.clerkOrgId,
        role: "client",
        isActive: true,
        joinedAt: Date.now(),
        permissions: [],
      });
    } else {
      // If user is already a member, maybe update their role if the invitation has a higher privilege?
      // For now, we do nothing if they are already a member.
    }
  }
});

export const syncTeamWithClerkOrg = mutation({
  args: {
    clerkOrgId: v.string(),
    orgName: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if the team already exists
    const existingTeam = await ctx.db
      .query("teams")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .unique();

    if (existingTeam) {
      // Update existing team if name has changed
      if (existingTeam.name !== args.orgName) {
        await ctx.db.patch(existingTeam._id, { name: args.orgName });
      }
    } else {
      // Create new team
      await ctx.db.insert("teams", {
        clerkOrgId: args.clerkOrgId,
        name: args.orgName,
        slug: generateSlug(args.orgName),
      });
    }
  },
});

export const syncAndCleanUpTeams = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("No user identity, skipping sync.");
      return;
    }

    console.log(`Starting team sync for user: ${identity.subject}`);
    // More logic will be added here to call the Clerk API
    // and sync data with internal mutations.
  },
}); 