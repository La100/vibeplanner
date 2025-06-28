import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query, mutation, action } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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
        userEmail: v.optional(v.string()), // Email użytkownika do sprawdzenia zaproszeń
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

        // Sprawdź czy to klient zaproszony do konkretnego projektu
        let clientRecord = null;
        if (user.email) {
            // Szukaj po emailu (case-insensitive)
            const allClients = await ctx.db
                .query("clients")
                .withIndex("by_org_and_user", q => q.eq("clerkOrgId", args.clerkOrgId))
                .filter(q => q.eq(q.field("status"), "invited"))
                .collect();
            
            clientRecord = allClients.find(c => 
                c.email.toLowerCase() === user.email.toLowerCase()
            );
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();
        
        // Jeśli znaleziono zaproszenie do projektu, ustaw rolę "client"
        let role: "admin" | "member" | "client" = args.role === "admin" ? "admin" : "member";
        let projectIds: Id<"projects">[] | undefined = undefined;

        if (clientRecord) {
            role = "client";
            projectIds = [clientRecord.projectId];
            
            // Oznacz klienta jako aktywnego i zapisz clerkUserId
            await ctx.db.patch(clientRecord._id, { 
                status: "active",
                clerkUserId: args.clerkUserId,
                joinedAt: Date.now()
            });
        }

        if(membership){
            // Jeśli już jest członkiem, zaktualizuj rolę i projekty
            const updateData: any = { role };
            if (projectIds) {
                // Dla klientów dodaj nowy projekt do listy
                const currentProjectIds = membership.projectIds || [];
                updateData.projectIds = [...new Set([...currentProjectIds, ...projectIds])];
            }
            await ctx.db.patch(membership._id, updateData);
        } else {
            // Stwórz nowego członka
            await ctx.db.insert("teamMembers", {
                teamId: team._id,
                clerkUserId: args.clerkUserId,
                clerkOrgId: args.clerkOrgId,
                role: role,
                projectIds: projectIds,
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

    let projects;
    
    // Admin i member widzą wszystkie projekty zespołu
    if (membership && membership.isActive && (membership.role === "admin" || membership.role === "member")) {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
    } else {
      // Sprawdź czy użytkownik jest klientem z dostępem do konkretnych projektów
      const clientAccess = await ctx.db
        .query("clients")
        .withIndex("by_clerk_user", q => q.eq("clerkUserId", identity.subject))
        .filter(q => q.and(
          q.eq(q.field("teamId"), team._id),
          q.eq(q.field("status"), "active")
        ))
        .collect();

      if (clientAccess.length > 0) {
        const projectIds = clientAccess.map(c => c.projectId);
        const projectPromises = projectIds.map(id => ctx.db.get(id));
        const projectResults = await Promise.all(projectPromises);
        projects = projectResults.filter(p => p !== null);
      } else {
        return [];
      }
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

// Pobieranie zadań z datami dla kalendarza
export const getProjectTasksWithDates = query({
  args: { 
    projectId: v.id("projects"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    let query = ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId));
    
    const tasks = await query.collect();
    
    // Filtruj zadania z datami w zakresie
    return tasks.filter(task => {
      if (!task.endDate) return false;
      if (args.startDate && task.endDate < args.startDate) return false;
      if (args.endDate && task.endDate > args.endDate) return false;
      return true;
    });
  }
});

// Pobieranie wszystkich zadań zespołu
export const listTeamTasks = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_team", q => q.eq("teamId", args.teamId))
      .collect();
    
    // Pobierz informacje o projektach dla zadań
    const tasksWithProjects = await Promise.all(
      tasks.map(async (task) => {
        const project = await ctx.db.get(task.projectId);
        return {
          ...task,
          projectName: project?.name || "Unknown Project",
          projectSlug: project?.slug || "",
        };
      })
    );
    
    return tasksWithProjects;
  }
});

export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    endDate: v.optional(v.number()),
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
      endDate: args.endDate,
      assignedTo: args.assignedTo,
      createdBy: identity.subject,
      tags: args.tags,
      estimatedHours: args.estimatedHours,
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
    const { projectId, name, description } = args;
    
    const updateData: any = {};
    if (description !== undefined) {
      updateData.description = description;
    }
    
    // Jeśli zmienia się nazwa, wygeneruj nowy slug
    if (name !== undefined) {
      updateData.name = name;
      
      // Pobierz projekt żeby sprawdzić teamId
      const project = await ctx.db.get(projectId);
      if (!project) throw new Error("Project not found");
      
      // Wygeneruj unikalny slug dla tego zespołu
      const baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;
      
      while (true) {
        const existing = await ctx.db
          .query("projects")
          .withIndex("by_team_and_slug", (q) => 
            q.eq("teamId", project.teamId).eq("slug", slug)
          )
          .filter(q => q.neq(q.field("_id"), projectId)) // Wyklucz aktualny projekt
          .first();
          
        if (!existing) {
          break;
        }
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      updateData.slug = slug;
    }
    
    await ctx.db.patch(projectId, updateData);
    
    // Zwróć nowy slug jeśli został zmieniony
    return { slug: updateData.slug };
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

    await ctx.db.patch(invitation._id, { status: "accepted" });

    // Sprawdź czy user już jest w teamMembers
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => q.eq("teamId", invitation.teamId).eq("clerkUserId", identity.subject))
      .unique();

    if (!teamMember) {
      // Tworzenie nowego członka z dostępem tylko do projektu z zaproszenia
      await ctx.db.insert("teamMembers", {
        teamId: invitation.teamId,
        clerkUserId: identity.subject,
        clerkOrgId: (await ctx.db.get(invitation.teamId))!.clerkOrgId,
        role: "client",
        projectIds: invitation.projectId ? [invitation.projectId] : undefined,
        isActive: true,
        joinedAt: Date.now(),
        permissions: [],
      });
    } else {
      // Jeśli już jest członkiem, dodaj projekt do jego listy (jeśli jest klientem)
      if (teamMember.role === "client" && invitation.projectId) {
        const currentProjectIds = teamMember.projectIds || [];
        if (!currentProjectIds.includes(invitation.projectId)) {
          await ctx.db.patch(teamMember._id, {
            projectIds: [...currentProjectIds, invitation.projectId],
          });
        }
      }
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

// Sprawdzanie uprawnień użytkownika do projektu
export const checkUserProjectAccess = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const project = await ctx.db.get(args.projectId);
    if (!project) return false;

    // Sprawdź członkostwo w zespole
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    // Admin i member mają dostęp do wszystkich projektów zespołu
    if (teamMember && teamMember.isActive && (teamMember.role === "admin" || teamMember.role === "member")) {
      return true;
    }

    // Sprawdź czy użytkownik jest klientem z dostępem do tego projektu
    const clientAccess = await ctx.db
      .query("clients")
      .withIndex("by_clerk_user", q => q.eq("clerkUserId", identity.subject))
      .filter(q => q.and(
        q.eq(q.field("projectId"), args.projectId),
        q.eq(q.field("status"), "active")
      ))
      .unique();

    return clientAccess !== null;
  }
});

// Przypisywanie projektu klientowi
export const assignProjectToClient = mutation({
  args: {
    clerkUserId: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Sprawdź czy wywołujący ma uprawnienia (admin/member)
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || (callerMember.role !== "admin" && callerMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    // Znajdź członka zespołu który ma być przypisany
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("User is not a member of this team");
    }

    if (targetMember.role !== "client") {
      throw new Error("Can only assign projects to clients");
    }

    // Dodaj projekt do listy klienta
    const currentProjectIds = targetMember.projectIds || [];
    if (!currentProjectIds.includes(args.projectId)) {
      await ctx.db.patch(targetMember._id, {
        projectIds: [...currentProjectIds, args.projectId],
      });
    }

    return { success: true };
  }
});

// Usuwanie dostępu klienta do projektu
export const removeProjectFromClient = mutation({
  args: {
    clerkUserId: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Sprawdź uprawnienia wywołującego
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || (callerMember.role !== "admin" && callerMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    // Znajdź członka zespołu
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember || targetMember.role !== "client") {
      throw new Error("Client not found");
    }

    // Usuń projekt z listy
    const currentProjectIds = targetMember.projectIds || [];
    const filteredProjectIds = currentProjectIds.filter(id => id !== args.projectId);
    
    await ctx.db.patch(targetMember._id, {
      projectIds: filteredProjectIds,
    });

    return { success: true };
  }
});

// Lista projektów dostępnych dla aktualnego użytkownika
export const listUserProjects = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Sprawdź członkostwo w zespole
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    // Admin i member widzą wszystkie projekty zespołu
    if (teamMember && teamMember.isActive && (teamMember.role === "admin" || teamMember.role === "member")) {
      return await ctx.db
        .query("projects")
        .withIndex("by_team", q => q.eq("teamId", args.teamId))
        .collect();
    }

    // Sprawdź czy użytkownik jest klientem z dostępem do konkretnych projektów
    const clientAccess = await ctx.db
      .query("clients")
      .withIndex("by_clerk_user", q => q.eq("clerkUserId", identity.subject))
      .filter(q => q.and(
        q.eq(q.field("teamId"), args.teamId),
        q.eq(q.field("status"), "active")
      ))
      .collect();

    if (clientAccess.length > 0) {
      const projectIds = clientAccess.map(c => c.projectId);
      const projects = await Promise.all(
        projectIds.map(id => ctx.db.get(id))
      );
      return projects.filter(p => p !== null);
    }

    return [];
  }
});

// Pobieranie informacji o członkostwie aktualnego użytkownika w zespole
export const getCurrentUserTeamMember = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
  }
});


// Aktualizacja statusu klienta (gdy dołącza do organizacji)
export const activateClient = mutation({
  args: {
    email: v.string(),
    clerkUserId: v.string(),
  },
  async handler(ctx, args) {
    const client = await ctx.db
      .query("clients")
      .withIndex("by_email", q => q.eq("email", args.email))
      .filter(q => q.eq(q.field("status"), "invited"))
      .first();

    if (client) {
      await ctx.db.patch(client._id, {
        status: "active",
        clerkUserId: args.clerkUserId,
        joinedAt: Date.now(),
      });
      return { success: true, clientId: client._id };
    }
    
    return { success: false, message: "Client invitation not found" };
  }
});

// Dodawanie klienta do projektu
export const addClientToProject = mutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    clerkOrgId: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Sprawdź uprawnienia do projektu
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    // Sprawdź czy klient już istnieje dla tego projektu
    const existingClient = await ctx.db
      .query("clients")
      .withIndex("by_email", q => q.eq("email", args.email))
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .unique();

    if (existingClient) {
      // Jeśli już istnieje, upewnij się że jest aktywny
      if (existingClient.status !== "active") {
        await ctx.db.patch(existingClient._id, { status: "active" });
      }
      return existingClient._id;
    }

    // Sprawdź czy użytkownik już istnieje w systemie (ma konto)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", identity.subject))
      .unique();

    let status: "invited" | "active" = "invited";
    let clerkUserId: string | undefined = undefined;
    let joinedAt: number | undefined = undefined;

    // Jeśli zapraszający ma dostęp do organizacji, sprawdź czy zapraszany już jest członkiem
    if (existingUser) {
      // Sprawdź czy istnieje użytkownik z tym emailem
      const userWithEmail = await ctx.db
        .query("users")
        .filter(q => q.eq(q.field("email"), args.email.toLowerCase()))
        .first();
      
      if (userWithEmail) {
        status = "active";
        clerkUserId = userWithEmail.clerkUserId;
        joinedAt = Date.now();
      }
    }

    // Dodaj klienta
    return await ctx.db.insert("clients", {
      email: args.email,
      clerkUserId: clerkUserId,
      clerkOrgId: args.clerkOrgId,
      projectId: args.projectId,
      teamId: project.teamId,
      invitedBy: identity.subject,
      status: status,
      invitedAt: Date.now(),
      joinedAt: joinedAt,
    });
  }
});

// Tymczasowe przechowywanie informacji o zaproszeniu klienta
export const createPendingClientInvitation = internalMutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    clerkOrgId: v.string(),
    invitedBy: v.string(),
  },
  async handler(ctx, args) {
    // Usuń poprzednie zaproszenia dla tego email + projekt (jeśli istnieją)
    const existingInvitations = await ctx.db
      .query("pendingClientInvitations")
      .filter(q => q.and(
        q.eq(q.field("email"), args.email),
        q.eq(q.field("projectId"), args.projectId)
      ))
      .collect();
    
    for (const invitation of existingInvitations) {
      await ctx.db.delete(invitation._id);
    }

    // Stwórz nowe zaproszenie
    return await ctx.db.insert("pendingClientInvitations", {
      email: args.email,
      projectId: args.projectId,
      clerkOrgId: args.clerkOrgId,
      invitedBy: args.invitedBy,
      status: "pending",
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 dni
    });
  }
});

export const updateTaskDates = mutation({
  args: {
    taskId: v.id("tasks"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  async handler(ctx, args) {
    const { taskId, startDate, endDate } = args;
    const task = await ctx.db.get(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    await ctx.db.patch(taskId, { startDate, endDate });
  },
}); 