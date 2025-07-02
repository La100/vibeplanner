import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query, mutation, action } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";

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

// Create a new user or update an existing one from Clerk webhook
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
        imageUrl: args.imageUrl 
      });
    } else {
      await ctx.db.insert("users", {
        clerkUserId: args.clerkUserId,
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
      });
    }
  },
});

// Delete a user from Clerk webhook
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

        // Sprawdź czy to klient zaproszony do konkretnego projektu, który już zaakceptował zaproszenie
        let clientRecord = await ctx.db
            .query("clients")
            .withIndex("by_org_and_user", q => q.eq("clerkOrgId", args.clerkOrgId).eq("clerkUserId", args.clerkUserId))
            .filter(q => q.eq(q.field("status"), "active")) // Szukaj aktywnego klienta
            .first();

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
          (task) => task.status === "done"
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
    teamId: v.id("teams"),
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

    const defaultStatusSettings = {
      todo: { name: "To Do", color: "#808080" },
      in_progress: { name: "In Progress", color: "#3b82f6" },
      review: { name: "Review", color: "#a855f7" },
      done: { name: "Done", color: "#22c55e" },
    };

    const nextProjectId = await generateNextProjectId(ctx);

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      teamId: args.teamId,
      slug: slug,
      projectId: nextProjectId,
      status: "planning",
      priority: args.priority,
      client: args.client,
      location: args.location,
      budget: args.budget,
      startDate: args.startDate,
      endDate: args.endDate,
      createdBy: identity.subject,
      assignedTo: [],
      taskStatusSettings: defaultStatusSettings,
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

export const getProjectByProjectId = query({
  args: { 
    projectId: v.number(),
  },
  async handler(ctx, args) {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_project_id", (q) => q.eq("projectId", args.projectId))
      .unique();
    
    return project;
  },
});

// Funkcja migracji dla istniejących projektów - uruchom raz aby nadać projectId
export const migrateProjectIds = mutation({
  args: {},
  async handler(ctx, args) {
    const projectsWithoutId = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("projectId"), undefined))
      .collect();

    let nextId = 1;
    const existingProjects = await ctx.db.query("projects").collect();
    const maxId = existingProjects.reduce((max: number, project: any) => {
      return (project.projectId || 0) > max ? (project.projectId || 0) : max;
    }, 0);
    nextId = maxId + 1;

    for (const project of projectsWithoutId) {
      await ctx.db.patch(project._id, { projectId: nextId });
      nextId++;
    }

    return `Migrated ${projectsWithoutId.length} projects`;
  },
});

export const listProjectTasks = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    return Promise.all(
      tasks.map(async (task) => {
        let assignedToName: string | undefined;
        let assignedToImageUrl: string | undefined;
        if (task.assignedTo) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!))
            .unique();
          assignedToName = user?.name ?? user?.email;
          assignedToImageUrl = user?.imageUrl;
        }
        return { ...task, assignedToName, assignedToImageUrl };
      })
    );
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
    title: v.string(),
    projectId: v.id("projects"),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      content: args.content,
      projectId: args.projectId,
      teamId: project.teamId,
      status: args.status || "todo",
      priority: args.priority,
      assignedTo: args.assignedTo,
      createdBy: identity.subject,
      startDate: args.startDate,
      endDate: args.endDate,
      dueDate: args.dueDate,
      estimatedHours: args.estimatedHours,
      tags: args.tags || [],
      cost: args.cost,
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done")
    ),
  },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, { status: args.status });
  },
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
    status: v.optional(v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    )),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    client: v.optional(v.string()),
    location: v.optional(v.string()),
    currency: v.optional(v.union(
      v.literal("USD"),
      v.literal("EUR"),
      v.literal("PLN")
    )),
    taskStatusSettings: v.optional(v.any()), // Pozwalamy na dowolny obiekt dla uproszczenia
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { projectId, name, ...rest } = args;

    const existingProject = await ctx.db.get(projectId);
    if (!existingProject) {
      throw new Error("Project not found");
    }

    // Sprawdzenie uprawnień (przykład)
    // const member = await ctx.db.query("teamMembers").withIndex("by_team_and_user", q => q.eq("teamId", existingProject.teamId).eq("clerkUserId", identity.subject)).first();
    // if (!member || (member.role !== 'admin' && member.role !== 'member')) {
    //   throw new Error("You don't have permission to update this project.");
    // }
    
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
      
      await ctx.db.patch(projectId, { name, slug, ...rest });
      return { slug };
    } else {
      await ctx.db.patch(projectId, rest);
      return { slug: existingProject.slug };
    }
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
          (task) => task.status === "done"
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

export const getTask = query({
  args: { taskId: v.id("tasks") },
  async handler(ctx, args) {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    let assignedToName: string | undefined;
    let assignedToImageUrl: string | undefined;

    if (task.assignedTo) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", task.assignedTo!))
        .unique();
      assignedToName = user?.name ?? user?.email;
      assignedToImageUrl = user?.imageUrl;
    }

    return { ...task, assignedToName, assignedToImageUrl };
  }
});

export const updateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedTo: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

    // Wywołaj addClientToProject, aby dodać użytkownika jako klienta do projektu
    await ctx.runMutation(internal.myFunctions.addClientToProject, {
      email: identity.email!,
      projectId: invitation.projectId!,
      clerkOrgId: (await ctx.db.get(invitation.teamId))!.clerkOrgId,
    });
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
export const addClientToProject = internalMutation({
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

    let status: "invited" | "active" = "invited";
    let clerkUserId: string | undefined = undefined;
    let joinedAt: number | undefined = undefined;

    // Sprawdź czy użytkownik już istnieje w systemie (ma konto) i czy jest w naszej tabeli users
    const userWithEmail = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("email"), args.email.toLowerCase()))
      .first();
    
    if (userWithEmail) {
      clerkUserId = userWithEmail.clerkUserId;
      joinedAt = Date.now();
      status = "active";
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
    await ctx.db.patch(taskId, { startDate, endDate });
  },
});

export const updateTaskPriority = mutation({
  args: {
    taskId: v.id("tasks"),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
  },
  async handler(ctx, args) {
    const { taskId, priority } = args;
    await ctx.db.patch(taskId, { priority });
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId);
  },
});


// Delete a project and all its related data
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

    // Check if user has permission to delete (admin or member role)
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to delete this project");
    }

    // Delete all tasks associated with the project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const taskDeletionPromises = tasks.map(task => ctx.db.delete(task._id));
    await Promise.all(taskDeletionPromises);

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

    const allComments = [...projectComments, ...taskComments];
    const commentDeletionPromises = allComments.map(comment => ctx.db.delete(comment._id));
    await Promise.all(commentDeletionPromises);

    // Delete all files related to the project or its tasks
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const taskFiles = await Promise.all(
      tasks.map(task => 
        ctx.db
          .query("files")
          .withIndex("by_task", q => q.eq("taskId", task._id))
          .collect()
      )
    ).then(results => results.flat());

    const allFiles = [...projectFiles, ...taskFiles];
    const fileDeletionPromises = allFiles.map(file => ctx.db.delete(file._id));
    await Promise.all(fileDeletionPromises);

    // Delete all invitations related to the project
    const invitations = await ctx.db
      .query("invitations")
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .collect();

    const invitationDeletionPromises = invitations.map(invitation => ctx.db.delete(invitation._id));
    await Promise.all(invitationDeletionPromises);

    // Delete all pending client invitations for this project
    const pendingInvitations = await ctx.db
      .query("pendingClientInvitations")
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .collect();

    const pendingInvitationDeletionPromises = pendingInvitations.map(invitation => ctx.db.delete(invitation._id));
    await Promise.all(pendingInvitationDeletionPromises);

    // Delete all client records associated with this project
    const clients = await ctx.db
      .query("clients")
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .collect();

    const clientDeletionPromises = clients.map(client => ctx.db.delete(client._id));
    await Promise.all(clientDeletionPromises);

    // Finally, delete the project itself
    await ctx.db.delete(args.projectId);

    return { success: true };
  }
}); 

// Parse task from natural language using OpenAI
export const parseTaskFromChat = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    // Get OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a task parser. Parse the user's message to extract task information. 
              Return ONLY a valid JSON object with the following structure:
              {
                "isTask": boolean,
                "title": string,
                "description": string,
                "priority": "low" | "medium" | "high" | "urgent" | null,
                "status": "todo" | "in_progress" | "review" | "done" | null,
                "dueDate": ISO date string or null,
                "cost": number or null,
                "tags": string[]
              }
              
              IMPORTANT RULES:
              - If the message is not about creating a task, set "isTask" to false
              - For priority, default to "medium" unless specified
              - For status, default to "todo" unless specified
              - For cost, parse it if mentioned, otherwise null.
              - KEEP THE SAME LANGUAGE as the input message (don't translate Polish to English!)
              - For dates, use current time context and return proper ISO date strings (YYYY-MM-DD)
              - Polish date parsing:
                * "jutro" = tomorrow's date
                * "dziś" = today's date  
                * "za tydzień" = date 7 days from now
                * "za 2 dni" = date 2 days from now
                * "w poniedziałek" = next Monday
                * "o 10" = just note in description, not separate time field
              - Current date context: ${new Date().toISOString().split('T')[0]}
              - Current day of week: ${new Date().toLocaleDateString('pl-PL', { weekday: 'long' })}`
            },
            {
              role: 'user',
              content: args.message
            }
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No response from OpenAI");
      }

      try {
        const parsedTask = JSON.parse(content);
        
        // Validate the structure
        if (!parsedTask.hasOwnProperty('isTask')) {
          throw new Error("Invalid response structure");
        }

        return parsedTask;
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", content);
        throw new Error("Failed to parse task information");
      }
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to process message with AI");
    }
  }
});

export const getTeamMembers = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    
    return Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();
        return {
          ...member,
          name: user?.name ?? "Użytkownik bez nazwy",
          email: user?.email ?? "Brak emaila",
          imageUrl: user?.imageUrl,
        };
      })
    );
  },
});

export const assignTask = mutation({
  args: {
    taskId: v.id("tasks"),
    userId: v.optional(v.string()), // Clerk User ID - optional and single
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.taskId, { assignedTo: args.userId });
  },
});

export const updateProjectTaskStatusSettings = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    }),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.projectId, { taskStatusSettings: args.settings });
  }
});

export const internalDeleteAllProjectsAndTasks = internalMutation({
  args: {},
  async handler(ctx) {
    const allProjects = await ctx.db.query("projects").collect();
    const projectDeletionPromises = allProjects.map(p => ctx.db.delete(p._id));
    await Promise.all(projectDeletionPromises);

    const allTasks = await ctx.db.query("tasks").collect();
    const taskDeletionPromises = allTasks.map(t => ctx.db.delete(t._id));
    await Promise.all(taskDeletionPromises);

    console.log(`Deleted ${allProjects.length} projects and ${allTasks.length} tasks.`);
    return {
      deletedProjects: allProjects.length,
      deletedTasks: allTasks.length
    };
  }
});

// Shopping List Functions

// --- Sections ---

export const listShoppingListSections = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const createShoppingListSection = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const existingSections = await ctx.db.query("shoppingListSections").withIndex("by_project", q => q.eq("projectId", args.projectId)).collect();

    return await ctx.db.insert("shoppingListSections", {
      name: args.name,
      projectId: args.projectId,
      teamId: project.teamId,
      order: existingSections.length,
      createdBy: identity.subject,
    });
  },
});

export const deleteShoppingListSection = mutation({
  args: { sectionId: v.id("shoppingListSections") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const section = await ctx.db.get(args.sectionId);
    if (!section) throw new Error("Section not found");
    
    // You might want to check for user permissions here
    
    const itemsInSection = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    for (const item of itemsInSection) {
      await ctx.db.patch(item._id, { sectionId: undefined });
    }

    await ctx.db.delete(args.sectionId);
  },
});


// --- Items ---

export const listShoppingListItems = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
      return await ctx.db
        .query("shoppingListItems")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    },
});

export const createShoppingListItem = mutation({
    args: {
        projectId: v.id("projects"),
        name: v.string(),
        notes: v.optional(v.string()),
        buyBefore: v.optional(v.number()),
        priority: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("URGENT")),
        imageUrl: v.optional(v.string()),
        productLink: v.optional(v.string()),
        supplier: v.optional(v.string()),
        catalogNumber: v.optional(v.string()),
        category: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        quantity: v.number(),
        unitPrice: v.optional(v.number()),
        realizationStatus: v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED")),
        sectionId: v.optional(v.id("shoppingListSections")),
        assignedTo: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const project = await ctx.db.get(args.projectId);
        if (!project) throw new Error("Project not found");

        const totalPrice = args.unitPrice ? args.quantity * args.unitPrice : undefined;

        return await ctx.db.insert("shoppingListItems", {
            name: args.name,
            notes: args.notes,
            completed: false,
            buyBefore: args.buyBefore,
            priority: args.priority,
            imageUrl: args.imageUrl,
            productLink: args.productLink,
            supplier: args.supplier,
            catalogNumber: args.catalogNumber,
            category: args.category,
            dimensions: args.dimensions,
            quantity: args.quantity,
            unitPrice: args.unitPrice,
            totalPrice,
            realizationStatus: args.realizationStatus,
            sectionId: args.sectionId,
            projectId: args.projectId,
            teamId: project.teamId,
            createdBy: identity.subject,
            assignedTo: args.assignedTo,
        });
    },
});

export const updateShoppingListItem = mutation({
    args: {
        itemId: v.id("shoppingListItems"),
        name: v.optional(v.string()),
        notes: v.optional(v.string()),
        buyBefore: v.optional(v.number()),
        priority: v.optional(v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("URGENT"))),
        imageUrl: v.optional(v.string()),
        productLink: v.optional(v.string()),
        supplier: v.optional(v.string()),
        catalogNumber: v.optional(v.string()),
        category: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        quantity: v.optional(v.number()),
        unitPrice: v.optional(v.number()),
        realizationStatus: v.optional(v.union(v.literal("PLANNED"), v.literal("ORDERED"), v.literal("IN_TRANSIT"), v.literal("DELIVERED"), v.literal("COMPLETED"), v.literal("CANCELLED"))),
        sectionId: v.optional(v.id("shoppingListSections")),
        assignedTo: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const { itemId, ...updates } = args;
        
        const item = await ctx.db.get(itemId);
        if (!item) throw new Error("Item not found");

        let totalPrice = item.totalPrice;
        const quantity = updates.quantity ?? item.quantity;
        const unitPrice = updates.unitPrice ?? item.unitPrice;

        if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
             totalPrice = unitPrice ? quantity * unitPrice : undefined;
        }

        await ctx.db.patch(itemId, {...updates, totalPrice });
    },
});

export const deleteShoppingListItem = mutation({
    args: { itemId: v.id("shoppingListItems") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");
        await ctx.db.delete(args.itemId);
    },
});

export const listProjectsByTeamSlug = query({
  args: { teamSlug: v.string() },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) {
      return [];
    }
    
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    const projectsWithCosts = await Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const totalCost = tasks.reduce((sum, task) => sum + (task.cost || 0), 0);
        return {
          ...project,
          totalCost,
        };
      })
    );
    
    return projectsWithCosts;
  },
});

export const getAllTasksByTeam = query({
  args: { teamSlug: v.string() },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", (q) => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) {
      return [];
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();

    const tasksArrays = await Promise.all(
      projects.map(project => 
        ctx.db
          .query("tasks")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect()
      )
    );
    
    return tasksArrays.flat();
  }
});

export const getShoppingListItemsByProject = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const items = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return items;
  },
});

export const getTeamsForCurrentUser = query({
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const clerkUserId = identity.subject;

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", clerkUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (memberships.length === 0) {
      return [];
    }

    const teamIds = [...new Set(memberships.map((m) => m.teamId))];

    const teamPromises = teamIds.map((teamId) => ctx.db.get(teamId));
    const teams = (await Promise.all(teamPromises)).filter(
      (t): t is Doc<"teams"> => t !== null
    );

    teams.sort((a, b) => a.name.localeCompare(b.name));
    
    return teams;
  },
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

    if (
      membership.role === "client" &&
      membership.projectIds &&
      membership.projectIds.length > 0
    ) {
      const clientProjects = await Promise.all(
        membership.projectIds.map((id) => ctx.db.get(id))
      );
      projects = clientProjects.filter((p): p is Doc<"projects"> => p !== null);
    } else if (
      membership.role === "admin" ||
      membership.role === "member" ||
      membership.role === "viewer"
    ) {
      projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
        .collect();
    }

    projects.sort((a, b) => a.name.localeCompare(b.name));
    return projects;
  },
});