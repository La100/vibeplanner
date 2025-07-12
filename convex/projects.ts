import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { internalMutation, query, mutation } from "./_generated/server";
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

// ====== CORE PROJECT FUNCTIONS ======

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
      client: args.client,
      location: args.location,
      budget: args.budget,
      startDate: args.startDate,
      endDate: args.endDate,
      createdBy: identity.subject,
      assignedTo: [],
      taskStatusSettings: defaultStatusSettings,
    });

    // Automatically create default project channel
    await ctx.scheduler.runAfter(0, internal.chatChannels.createDefaultProjectChannel, {
      projectId: projectId,
      creatorId: identity.subject,
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

    // Sprawdź członkostwo w zespole
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) {
      return false;
    }

    // Admin, member, i viewer mają dostęp do wszystkich projektów w zespole
    if (["admin", "member", "viewer"].includes(teamMember.role)) {
      return teamMember;
    }

    // Klienci mają dostęp tylko do przypisanych projektów
    if (teamMember.role === "client") {
      return teamMember.projectIds?.includes(args.projectId) ? teamMember : false;
    }
    
    // W innych przypadkach, brak dostępu
    return false;
  }
});

export const updateProjectSidebarPermissions = mutation({
  args: {
    projectId: v.id("projects"),
    sidebarPermissions: v.object({
      overview: v.optional(v.object({ visible: v.boolean() })),
      tasks: v.optional(v.object({ visible: v.boolean() })),
      surveys: v.optional(v.object({ visible: v.boolean() })),
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
      surveys: { visible: true },
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
          surveys: sidebarPermissions.surveys || defaultPermissions.surveys,
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

    // Delete all client records associated with this project
    const projectClients = await ctx.db
      .query("clients")
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .collect();

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

// Update project task status settings
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const hasAccess = await ctx.runQuery(api.projects.checkUserProjectAccess, {
      projectId: args.projectId,
    });

    if (!hasAccess) {
      throw new Error("You don't have permission to update these settings.");
    }

    await ctx.db.patch(args.projectId, {
      taskStatusSettings: args.settings,
    });

    return { success: true };
  }
}); 

export const updateProjectIndexingStatus = internalMutation({
    args: {
        projectId: v.id("projects"),
        status: v.union(
            v.literal("idle"),
            v.literal("indexing"),
            v.literal("done")
        ),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.projectId, {
            aiIndexingStatus: args.status,
        });
    },
}); 