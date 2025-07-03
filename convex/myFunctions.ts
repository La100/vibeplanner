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

      // 1. Find all projects for this team
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      console.log(`Found ${projects.length} projects to delete for team ${team.name}.`);

      // 2. For each project, delete all related data using the same logic as deleteProject
      for (const project of projects) {
        // Delete all tasks associated with the project
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();
        
        // Delete all comments related to the project or its tasks
        const projectComments = await ctx.db
          .query("comments")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        const taskComments = await Promise.all(
          tasks.map(task => 
            ctx.db
              .query("comments")
              .withIndex("by_task", q => q.eq("taskId", task._id))
              .collect()
          )
        ).then(results => results.flat());

        // Delete all files related to the project or its tasks
        const projectFiles = await ctx.db
          .query("files")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        const taskFiles = await Promise.all(
          tasks.map(task => 
            ctx.db
              .query("files")
              .withIndex("by_task", q => q.eq("taskId", task._id))
              .collect()
          )
        ).then(results => results.flat());

        // Delete all invitations related to the project
        const projectInvitations = await ctx.db
          .query("invitations")
          .filter(q => q.eq(q.field("projectId"), project._id))
          .collect();

        // Delete all pending client invitations for this project
        const pendingInvitations = await ctx.db
          .query("pendingClientInvitations")
          .filter(q => q.eq(q.field("projectId"), project._id))
          .collect();

        // Delete all client records associated with this project
        const projectClients = await ctx.db
          .query("clients")
          .filter(q => q.eq(q.field("projectId"), project._id))
          .collect();

        // Delete all folders related to the project
        const projectFolders = await ctx.db
          .query("folders")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        // Delete all shopping list sections and items for this project
        const shoppingListSections = await ctx.db
          .query("shoppingListSections")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        const shoppingListItems = await ctx.db
          .query("shoppingListItems")
          .withIndex("by_project", q => q.eq("projectId", project._id))
          .collect();

        // Execute all deletions for this project
        await Promise.all([
          ...tasks.map(task => ctx.db.delete(task._id)),
          ...projectComments.map(comment => ctx.db.delete(comment._id)),
          ...taskComments.map(comment => ctx.db.delete(comment._id)),
          ...projectFiles.map(file => ctx.db.delete(file._id)),
          ...taskFiles.map(file => ctx.db.delete(file._id)),
          ...projectInvitations.map(invitation => ctx.db.delete(invitation._id)),
          ...pendingInvitations.map(invitation => ctx.db.delete(invitation._id)),
          ...projectClients.map(client => ctx.db.delete(client._id)),
          ...projectFolders.map(folder => ctx.db.delete(folder._id)),
          ...shoppingListSections.map(section => ctx.db.delete(section._id)),
          ...shoppingListItems.map(item => ctx.db.delete(item._id)),
        ]);

        console.log(`Deleted all data for project ${project.name}.`);
      }

      // 3. Delete all remaining team-level data that wasn't project-specific

      // Delete all team-level folders
      const teamFolders = await ctx.db
        .query("folders")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .filter(q => q.eq(q.field("projectId"), undefined))
        .collect();

      // Delete all team-level files
      const teamFiles = await ctx.db
        .query("files")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .filter(q => q.eq(q.field("projectId"), undefined))
        .collect();

      // Delete all team-level comments
      const teamComments = await ctx.db
        .query("comments")
        .filter(q => q.and(
          q.eq(q.field("teamId"), team._id),
          q.eq(q.field("projectId"), undefined)
        ))
        .collect();

      // Delete all team-level invitations
      const teamInvitations = await ctx.db
        .query("invitations")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .filter(q => q.eq(q.field("projectId"), undefined))
        .collect();

      // Delete all remaining clients for this team
      const remainingClients = await ctx.db
        .query("clients")
        .withIndex("by_team", q => q.eq("teamId", team._id))
        .collect();

      // Execute team-level deletions
      await Promise.all([
        ...teamFolders.map(folder => ctx.db.delete(folder._id)),
        ...teamFiles.map(file => ctx.db.delete(file._id)),
        ...teamComments.map(comment => ctx.db.delete(comment._id)),
        ...teamInvitations.map(invitation => ctx.db.delete(invitation._id)),
        ...remainingClients.map(client => ctx.db.delete(client._id)),
      ]);

      // 4. Delete all projects
      await Promise.all(projects.map(project => ctx.db.delete(project._id)));

      // 5. Delete all team members
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .collect();
      await Promise.all(members.map(member => ctx.db.delete(member._id)));

      // 6. Finally, delete the team itself
      await ctx.db.delete(team._id);
      
      console.log(`Team ${team.name} and ALL related data deleted successfully.`);
      console.log(`Deleted: ${projects.length} projects, ${members.length} members, and all associated data.`);
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
        
        if(!user && args.userEmail && args.userEmail !== "unknown@example.com") {
            console.warn(`User not found for webhook processing: clerkUserId=${args.clerkUserId}. Creating user from membership webhook.`);
            
            // Stwórz użytkownika tylko jeśli mamy poprawny email
            await ctx.db.insert("users", {
                clerkUserId: args.clerkUserId,
                email: args.userEmail,
                name: undefined, // Będzie zaktualizowane przy webhook user.created/updated
                imageUrl: undefined,
            });
        } else if (!user) {
            console.warn(`User not found and no valid email for clerkUserId=${args.clerkUserId}. Skipping user creation - will be created by user.created webhook.`);
        }

        // Sprawdź czy to klient zaproszony do konkretnego projektu, który już zaakceptował zaproszenie
        let clientRecord = await ctx.db
            .query("clients")
            .withIndex("by_org_and_user", q => q.eq("clerkOrgId", args.clerkOrgId).eq("clerkUserId", args.clerkUserId))
            .filter(q => q.eq(q.field("status"), "active")) // Szukaj aktywnego klienta
            .first();

        // Jeśli nie znaleziono po clerkUserId, spróbuj po email (dla nowych użytkowników)
        if (!clientRecord && args.userEmail) {
            clientRecord = await ctx.db
                .query("clients")
                .withIndex("by_email", q => q.eq("email", args.userEmail!))
                .filter(q => q.and(
                    q.eq(q.field("clerkOrgId"), args.clerkOrgId),
                    q.or(
                        q.eq(q.field("status"), "invited"),
                        q.eq(q.field("status"), "active")
                    )
                ))
                .first();
        }

        const membership = await ctx.db
            .query("teamMembers")
            .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", args.clerkUserId))
            .unique();
        
        // Określ rolę użytkownika w zespole
        let role: "admin" | "member" | "client" = "member"; // domyślna rola
        let projectIds: Id<"projects">[] | undefined = undefined;

        // 1. Sprawdź rolę z Clerk
        if (args.role === "admin") {
            role = "admin";
        } else if (args.role === "org:customer") {
            role = "client";
        } else {
            role = "member"; // org:member, basic_member, itp.
        }

        // 1.5. Sprawdź czy to pierwszy członek organizacji (powinien być adminem)
        if (!membership && !clientRecord) {
            const existingMembers = await ctx.db
                .query("teamMembers")
                .withIndex("by_team", q => q.eq("teamId", team._id))
                .collect();
            
            // Jeśli to pierwszy członek organizacji, zrób go adminem
            if (existingMembers.length === 0) {
                role = "admin";
            }
        }

        // 2. Jeśli znaleziono zaproszenie do konkretnego projektu, ustaw rolę "client"
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
    async handler(ctx, args): Promise<void> {
        // Use the same complete deletion logic as deleteTeamInternal
        await ctx.runMutation(internal.myFunctions.deleteTeamInternal, {
            clerkOrgId: args.clerkOrgId
        });
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
    } else if (membership && membership.isActive && membership.role === "client" && membership.projectIds) {
      // Client z określonymi projectIds w teamMembers
      const projectPromises = membership.projectIds.map(id => ctx.db.get(id));
      const projectResults = await Promise.all(projectPromises);
      projects = projectResults.filter(p => p !== null);
    } else {
      // Sprawdź czy użytkownik jest klientem z dostępem do konkretnych projektów (legacy)
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

    // Sprawdź czy twórca jest już członkiem zespołu
    let creatorMembership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) => q.eq("teamId", team._id).eq("clerkUserId", identity.subject))
      .unique();

    if (!creatorMembership) {
      // Jeśli nie jest członkiem, dodaj jako admina
      await ctx.db.insert("teamMembers", {
        teamId: team._id,
        clerkUserId: identity.subject,
        clerkOrgId: args.clerkOrgId,
        role: "admin",
        isActive: true,
        joinedAt: Date.now(),
        permissions: [],
      });
    } else if (creatorMembership.role !== "admin") {
      // Jeśli już jest członkiem ale nie jest adminem, podwyższ do admina
      await ctx.db.patch(creatorMembership._id, { role: "admin" });
    }

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

    // Sprawdź uprawnienia
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions");
    }

    // Dodaj do tabeli clients (to jest kluczowe!)
    await ctx.runMutation(internal.myFunctions.addClientToProject, {
      email: args.email,
      projectId: args.projectId,
      clerkOrgId: (await ctx.db.get(project.teamId))!.clerkOrgId,
    });

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

    // Handle team members with role "client" - remove project or delete member entirely
    const clientTeamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", q => q.eq("teamId", project.teamId))
      .filter(q => q.eq(q.field("role"), "client"))
      .collect();

    const memberOperationPromises = clientTeamMembers.map(async (member) => {
      const currentProjectIds = member.projectIds || [];
      
      if (currentProjectIds.includes(args.projectId) || currentProjectIds.length === 0) {
        const updatedProjectIds = currentProjectIds.filter(id => id !== args.projectId);
        
        if (updatedProjectIds.length === 0) {
          // Jeśli to był jedyny projekt klienta lub nie miał projektów, usuń członka całkowicie
          await ctx.db.delete(member._id);
          console.log(`Deleted client team member ${member.clerkUserId} - no more projects`);
        } else {
          // Jeśli ma więcej projektów, tylko usuń ten projekt z listy
          await ctx.db.patch(member._id, { projectIds: updatedProjectIds });
          console.log(`Updated client team member ${member.clerkUserId} - removed project from list`);
        }
      } else {
        // Sprawdź czy klient ma dostęp do tego projektu przez tabelę clients
        const clientRecord = await ctx.db
          .query("clients")
          .withIndex("by_clerk_user", q => q.eq("clerkUserId", member.clerkUserId))
          .filter(q => q.eq(q.field("projectId"), args.projectId))
          .first();
        
        if (clientRecord) {
          // Klient był powiązany z tym projektem - sprawdź czy ma inne projekty
          const otherClientRecords = await ctx.db
            .query("clients")
            .withIndex("by_clerk_user", q => q.eq("clerkUserId", member.clerkUserId))
            .filter(q => q.neq(q.field("projectId"), args.projectId))
            .collect();
          
          if (otherClientRecords.length === 0) {
            // Nie ma innych projektów - usuń członka
            await ctx.db.delete(member._id);
            console.log(`Deleted client team member ${member.clerkUserId} - was only connected to deleted project`);
          }
        }
      }
    });
    await Promise.all(memberOperationPromises);

    // Delete all folders related to the project
    const projectFolders = await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const folderDeletionPromises = projectFolders.map(folder => ctx.db.delete(folder._id));
    await Promise.all(folderDeletionPromises);

    // Delete all shopping list sections and items for this project
    const shoppingListSections = await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const shoppingListItems = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    const shoppingSectionDeletionPromises = shoppingListSections.map(section => ctx.db.delete(section._id));
    const shoppingItemDeletionPromises = shoppingListItems.map(item => ctx.db.delete(item._id));
    
    await Promise.all([...shoppingSectionDeletionPromises, ...shoppingItemDeletionPromises]);

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

// Nowa funkcja do pobierania członków projektu (łącznie z klientami)
export const getProjectMembers = query({
  args: { 
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects"))
  },
  async handler(ctx, args) {
    // Pobierz wszystkich członków zespołu
    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
    
    const result = [];
    const processedUserIds = new Set();

    // Przetwórz członków zespołu
    for (const member of teamMembers) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
        .unique();
      
      result.push({
        ...member,
        name: user?.name ?? "Użytkownik bez nazwy",
        email: user?.email ?? "Brak emaila",
        imageUrl: user?.imageUrl,
        source: "teamMember"
      });
      
      processedUserIds.add(member.clerkUserId);
    }

    // Jeśli podano projectId, dodaj klientów z tabeli clients
    if (args.projectId) {
      const projectClients = await ctx.db
        .query("clients")
        .filter(q => q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("status"), "active")
        ))
        .collect();

      for (const client of projectClients) {
        const clientUserId = client.clerkUserId ?? "";
        
        // Sprawdź czy klient nie jest już w wynikach (z teamMembers)
        if (!client.clerkUserId || !processedUserIds.has(client.clerkUserId)) {
          let user = null;
          
          if (client.clerkUserId) {
            user = await ctx.db
              .query("users")
              .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", client.clerkUserId!))
              .unique();
          }

          result.push({
            _id: client._id,
            _creationTime: client._creationTime,
            teamId: client.teamId,
            clerkUserId: clientUserId,
            clerkOrgId: client.clerkOrgId,
            role: "client" as const,
            permissions: [],
            projectIds: args.projectId ? [args.projectId] : undefined,
            joinedAt: client.joinedAt || client.invitedAt,
            isActive: true,
            name: user?.name ?? client.email.split('@')[0],
            email: user?.email ?? client.email,
            imageUrl: user?.imageUrl,
            source: "clientOnly"
          });
        }
      }
    }

    return result;
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

// Nowa funkcja do usuwania członków zespołu
export const removeTeamMember = mutation({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Sprawdź uprawnienia wywołującego (musi być admin)
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || callerMember.role !== "admin") {
      throw new Error("Only admins can remove team members");
    }

    // Znajdź członka do usunięcia
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("Team member not found");
    }

    // Nie pozwól usunąć siebie
    if (targetMember.clerkUserId === identity.subject) {
      throw new Error("Cannot remove yourself from the team");
    }

    // Usuń członka
    await ctx.db.delete(targetMember._id);

    // Jeśli to był klient, usuń też wpisy z tabeli clients
    if (targetMember.role === "client") {
      const clientRecords = await ctx.db
        .query("clients")
        .withIndex("by_clerk_user", q => q.eq("clerkUserId", args.clerkUserId))
        .filter(q => q.eq(q.field("teamId"), args.teamId))
        .collect();
      
      for (const clientRecord of clientRecords) {
        await ctx.db.delete(clientRecord._id);
      }
    }

    return { success: true };
  }
});

// Funkcja do zmiany roli członka zespołu
export const changeTeamMemberRole = mutation({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
      v.literal("client")
    ),
    projectId: v.optional(v.id("projects")), // Wymagane dla roli client
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Sprawdź uprawnienia wywołującego (musi być admin)
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || callerMember.role !== "admin") {
      throw new Error("Only admins can change member roles");
    }

    // Znajdź członka do zmiany
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("Team member not found");
    }

    // Przygotuj dane do aktualizacji
    const updateData: any = { role: args.newRole };

    // Jeśli zmiana na client, potrzebny jest projectId
    if (args.newRole === "client") {
      if (!args.projectId) {
        throw new Error("Project ID is required for client role");
      }
      updateData.projectIds = [args.projectId];

      // Dodaj wpis do tabeli clients
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", args.clerkUserId))
        .unique();

      if (user) {
        await ctx.db.insert("clients", {
          email: user.email,
          clerkUserId: args.clerkUserId,
          clerkOrgId: targetMember.clerkOrgId,
          projectId: args.projectId,
          teamId: args.teamId,
          invitedBy: identity.subject,
          status: "active",
          invitedAt: Date.now(),
          joinedAt: Date.now(),
        });
      }
    } else {
      // Jeśli zmiana z client na inną rolę, usuń projectIds
      updateData.projectIds = undefined;

      // Usuń wpisy z tabeli clients
      if (targetMember.role === "client") {
        const clientRecords = await ctx.db
          .query("clients")
          .withIndex("by_clerk_user", q => q.eq("clerkUserId", args.clerkUserId))
          .filter(q => q.eq(q.field("teamId"), args.teamId))
          .collect();
        
        for (const clientRecord of clientRecords) {
          await ctx.db.delete(clientRecord._id);
        }
      }
    }

    // Aktualizuj członka
    await ctx.db.patch(targetMember._id, updateData);

    return { success: true };
  }
});

// Dodawanie istniejącego członka organizacji do projektu jako klienta
export const addExistingMemberToProject = mutation({
  args: {
    clerkUserId: v.string(),
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

    // Znajdź członka organizacji do dodania
    const targetMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();

    if (!targetMember) {
      throw new Error("User is not a member of this organization");
    }

    // Sprawdź czy już ma dostęp do tego projektu
    const existingClient = await ctx.db
      .query("clients")
      .withIndex("by_clerk_user", q => q.eq("clerkUserId", args.clerkUserId))
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .unique();

    if (existingClient) {
      // Jeśli już ma dostęp, upewnij się że jest aktywny
      if (existingClient.status !== "active") {
        await ctx.db.patch(existingClient._id, { status: "active" });
      }
      return { success: true, message: "User already has access to this project" };
    }

    // Pobierz dane użytkownika
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (!user) {
      throw new Error("User data not found");
    }

    // Dodaj do tabeli clients
    await ctx.db.insert("clients", {
      email: user.email,
      clerkUserId: args.clerkUserId,
      clerkOrgId: targetMember.clerkOrgId,
      projectId: args.projectId,
      teamId: project.teamId,
      invitedBy: identity.subject,
      status: "active", // Natychmiast aktywny
      invitedAt: Date.now(),
      joinedAt: Date.now(),
    });

    // Aktualizuj członkostwo TYLKO jeśli to klient organizacyjny
    if (targetMember.role === "client") {
      const currentProjectIds = targetMember.projectIds || [];
      if (!currentProjectIds.includes(args.projectId)) {
        await ctx.db.patch(targetMember._id, {
          projectIds: [...currentProjectIds, args.projectId],
        });
      }
    }
    // Dla admin/member/viewer - nie zmieniamy roli organizacyjnej, tylko dodajemy do project clients

    return { success: true, message: "User added to project successfully" };
  }
});

// Pobieranie członków organizacji którzy mogą zostać dodani jako klienci projektu
export const getAvailableOrgMembersForProject = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Sprawdź uprawnienia
    const callerMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!callerMember || (callerMember.role !== "admin" && callerMember.role !== "member")) {
      return [];
    }

    // Pobierz wszystkich członków organizacji
    const allMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", q => q.eq("teamId", project.teamId))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();

    // Pobierz już istniejących project clients
    const existingProjectClients = await ctx.db
      .query("clients")
      .filter(q => q.and(
        q.eq(q.field("projectId"), args.projectId),
        q.eq(q.field("status"), "active")
      ))
      .collect();

    const existingProjectClientUserIds = new Set(
      existingProjectClients.map(client => client.clerkUserId).filter(Boolean)
    );

    // POPRAWIONA LOGIKA: Pokaż tylko tych którzy mogą skorzystać z dodania jako project client
    const availableMembers = allMembers.filter(member => {
      // Admin i Member już mają pełny dostęp do wszystkich projektów - nie trzeba ich dodawać jako project clients
      if (member.role === "admin" || member.role === "member") {
        return false;
      }

      // Nie pokazuj tych którzy już są project clients dla tego projektu
      if (existingProjectClientUserIds.has(member.clerkUserId)) {
        return false;
      }

      // Dla klientów organizacyjnych: sprawdź czy już mają ten projekt w projectIds
      if (member.role === "client" && member.projectIds && member.projectIds.includes(args.projectId)) {
        return false;
      }

      // Pokaż: Viewer i Client (którzy jeszcze nie mają dostępu do tego projektu)
      return true;
    });

    // Dodaj dane użytkowników
    const membersWithUserData = await Promise.all(
      availableMembers.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();
        
        return {
          ...member,
          name: user?.name ?? "Unknown User",
          email: user?.email ?? "No email",
          imageUrl: user?.imageUrl,
        };
      })
    );

    return membersWithUserData;
  }
});

// DEBUG: Tymczasowa funkcja do sprawdzenia kto jest w teamMembers
export const debugTeamMembers = query({
  args: {
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { error: "Not authenticated" };

    const project = await ctx.db.get(args.projectId);
    if (!project) return { error: "Project not found" };

    // Pobierz wszystkich członków tej organizacji
    const allMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_team", q => q.eq("teamId", project.teamId))
      .collect();

    // Pobierz zespół
    const team = await ctx.db.get(project.teamId);

    // Dodaj dane użytkowników
    const membersWithUserData = await Promise.all(
      allMembers.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", member.clerkUserId))
          .unique();
        
        return {
          clerkUserId: member.clerkUserId,
          role: member.role,
          isActive: member.isActive,
          projectIds: member.projectIds,
          name: user?.name ?? "No user data",
          email: user?.email ?? "No email",
        };
      })
    );

    return {
      teamId: project.teamId,
      teamName: team?.name,
      clerkOrgId: team?.clerkOrgId,
      totalMembers: allMembers.length,
      members: membersWithUserData
    };
  }
});

// Aktualizacja uprawnień sidebar projektu
export const updateProjectSidebarPermissions = mutation({
  args: {
    projectId: v.id("projects"),
    sidebarPermissions: v.object({
      overview: v.optional(v.object({ visible: v.boolean() })),
      tasks: v.optional(v.object({ visible: v.boolean() })),
      calendar: v.optional(v.object({ visible: v.boolean() })),
      gantt: v.optional(v.object({ visible: v.boolean() })),
      files: v.optional(v.object({ visible: v.boolean() })),
      shopping_list: v.optional(v.object({ visible: v.boolean() })),
      settings: v.optional(v.object({ visible: v.boolean() })),
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

    // Sprawdź uprawnienia - tylko admin i member mogą zmieniać uprawnienia
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to update sidebar permissions");
    }

    // Aktualizuj uprawnienia sidebar
    await ctx.db.patch(args.projectId, {
      sidebarPermissions: args.sidebarPermissions,
    });

    return { success: true };
  },
});

// Pobieranie uprawnień sidebar projektu dla aktualnego użytkownika
export const getProjectSidebarPermissions = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    // Sprawdź rolę użytkownika
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    // Sprawdź czy użytkownik jest klientem projektu
    const clientAccess = await ctx.db
      .query("clients")
      .withIndex("by_clerk_user", q => q.eq("clerkUserId", identity.subject))
      .filter(q => q.and(
        q.eq(q.field("projectId"), args.projectId),
        q.eq(q.field("status"), "active")
      ))
      .unique();

    // Domyślne uprawnienia
    const defaultPermissions = {
      overview: { visible: true },
      tasks: { visible: true },
      calendar: { visible: true },
      gantt: { visible: true },
      files: { visible: true },
      shopping_list: { visible: true },
      settings: { visible: true },
    };

    // Jeśli użytkownik jest admin lub member, ma pełne uprawnienia
    if (teamMember && (teamMember.role === "admin" || teamMember.role === "member")) {
      return {
        permissions: defaultPermissions,
        userRole: teamMember.role,
        isClient: false,
      };
    }

    // Jeśli użytkownik jest klientem, zastosuj ograniczenia
    if (teamMember?.role === "client" || clientAccess) {
      const sidebarPermissions = project.sidebarPermissions || {};
      
              return {
          permissions: {
            overview: sidebarPermissions.overview || defaultPermissions.overview,
            tasks: sidebarPermissions.tasks || defaultPermissions.tasks,
            calendar: sidebarPermissions.calendar || defaultPermissions.calendar,
            gantt: sidebarPermissions.gantt || defaultPermissions.gantt,
            files: sidebarPermissions.files || defaultPermissions.files,
            shopping_list: sidebarPermissions.shopping_list || defaultPermissions.shopping_list,
            settings: sidebarPermissions.settings || { visible: false }, // Domyślnie clients nie widzą ustawień
          },
          userRole: teamMember?.role || "client",
          isClient: true,
        };
    }

    // Jeśli użytkownik nie ma dostępu
    return null;
  },
});