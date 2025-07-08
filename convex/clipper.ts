import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

export const getTeamsAndProjects = query({
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { user: null, teams: [] };
    }
    const clerkUserId = identity.subject;

    const user = {
      id: clerkUserId,
      name: identity.name,
      email: identity.email,
    };

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_user", (q) => q.eq("clerkUserId", clerkUserId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (memberships.length === 0) {
      return { user, teams: [] };
    }

    const teamIds = [...new Set(memberships.map((m) => m.teamId))];

    const teams = await Promise.all(
      teamIds.map(async (teamId) => {
        const team = await ctx.db.get(teamId);
        if (!team) return null;

        // Fetch projects for this specific team
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_team", (q) => q.eq("teamId", teamId))
          .collect();
        
        // Dla każdego projektu pobierz od razu jego sekcje
        const projectsWithSections = await Promise.all(
          projects.map(async (project) => {
            const sections = await ctx.db
              .query("shoppingListSections")
              .withIndex("by_project", (q) => q.eq("projectId", project._id))
              .collect();
            return { ...project, sections };
          })
        );
        
        projectsWithSections.sort((a, b) => a.name.localeCompare(b.name));

        return {
          team,
          projects: projectsWithSections,
        };
      })
    );

    const validTeams = teams.filter((t) => t !== null) as { team: Doc<"teams">; projects: (Doc<"projects"> & { sections: Doc<"shoppingListSections">[] })[] }[];

    validTeams.sort((a, b) => a.team.name.localeCompare(b.team.name));

    // Mapujemy do prostej struktury, której oczekuje frontend
    const finalTeams = validTeams.map(item => ({
      ...item.team, // Rozpakowujemy cały obiekt team
      projects: item.projects // Dołączamy do niego listę projektów
    }));

    return { user, teams: finalTeams };
  },
});

export const getProjectsForTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.runQuery(api.teams.getCurrentUserTeamMember, { teamId: args.teamId });

    if (!member) {
      throw new Error("Nie jesteś członkiem tego zespołu lub musisz być zalogowany.");
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();
  },
});

export const saveProduct = mutation({
    args: {
        projectId: v.id("projects"),
        teamId: v.id("teams"),
        name: v.string(),
        notes: v.optional(v.string()),
        supplier: v.optional(v.string()),
        quantity: v.optional(v.number()),
        price: v.optional(v.number()),
        productLink: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const quantity = args.quantity ?? 1;
        const totalPrice = args.price ? quantity * args.price : undefined;

        return await ctx.db.insert("shoppingListItems", {
            projectId: args.projectId,
            teamId: args.teamId,
            createdBy: identity.subject,
            name: args.name,
            notes: args.notes,
            supplier: args.supplier,
            quantity: quantity,
            unitPrice: args.price,
            productLink: args.productLink,
            imageUrl: args.imageUrl,
            totalPrice,
            completed: false,
            priority: "MEDIUM",
            realizationStatus: "PLANNED",
        });
    },
});

/**
 * Zapytanie do pobierania sekcji listy zakupów dla projektu.
 * Dostępne tylko dla zalogowanych użytkowników.
 */
export const getShoppingListSections = query({
  args: {
    projectId: v.id("projects"),
    teamId: v.id("teams"),
  },
  handler: async (ctx, args): Promise<Doc<"shoppingListSections">[]> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
        throw new Error("Project not found");
      }
      
      const member: Doc<"teamMembers"> | null = await ctx.runQuery(api.teams.getCurrentUserTeamMember, { teamId: project.teamId });
  
      if (!member) {
        throw new Error("Current user is not a team member");
      }

    return await ctx.db
      .query("shoppingListSections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Mutacja do dodawania nowego przedmiotu do listy zakupów z rozszerzenia.
 */
export const addShoppingListItem = mutation({
  args: {
    name: v.string(),
    projectId: v.id("projects"),
    sectionId: v.optional(v.id("shoppingListSections")),
    unitPrice: v.optional(v.number()),
    quantity: v.number(),
    totalPrice: v.optional(v.number()),
    supplier: v.optional(v.string()),
    notes: v.optional(v.string()),
    productLink: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    priority: v.union(
      v.literal("LOW"),
      v.literal("MEDIUM"),
      v.literal("HIGH"),
      v.literal("URGENT")
    ),
    realizationStatus: v.union(
        v.literal("PLANNED"),
        v.literal("ORDERED"),
        v.literal("IN_TRANSIT"),
        v.literal("DELIVERED"),
        v.literal("COMPLETED"),
        v.literal("CANCELLED")
      ),
  },
  handler: async (ctx, args): Promise<Id<"shoppingListItems">> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
        throw new Error("Nie znaleziono projektu.");
    }
    
    const member: Doc<"teamMembers"> | null = await ctx.runQuery(api.teams.getCurrentUserTeamMember, { teamId: project.teamId });

    if (!member) {
      throw new Error("Nie jesteś członkiem tego zespołu lub musisz być zalogowany.");
    }

    // Jeśli nie podano sectionId, pozostaw jako undefined
    // Aplikacja automatycznie zgrupuje takie itemy jako "No Category"
    const finalSectionId = args.sectionId || undefined;

    const newItem: Id<"shoppingListItems"> = await ctx.db.insert("shoppingListItems", {
        ...args,
        sectionId: finalSectionId,
        teamId: project.teamId,
        createdBy: member.clerkUserId,
        completed: false, 
    });

    return newItem;
  },
}); 