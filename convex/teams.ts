import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";

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
    }
});

export const getTeam = query({
  args: {
    teamId: v.id("teams"),
  },
  async handler(ctx, args) {
    return await ctx.db.get(args.teamId);
  }
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
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();
  }
});

export const getTeamMemberByClerkId = internalQuery({
  args: {
    teamId: v.id("teams"),
    clerkUserId: v.string(),
  },
  returns: v.union(v.object({
    _id: v.id("teamMembers"),
    _creationTime: v.number(),
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("customer")),
    permissions: v.array(v.string()),
    projectIds: v.optional(v.array(v.id("projects"))),
    joinedAt: v.number(),
    isActive: v.boolean(),
  }), v.null()),
  async handler(ctx, args) {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", args.clerkUserId)
      )
      .unique();
  }
});

export const getCurrentUserRoleInTeam = query({
  args: {
    teamSlug: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", q => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) return null;

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    return teamMember?.role || null;
  }
});

export const getTeamSettings = query({
  args: {
    teamSlug: v.string(),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const team = await ctx.db
      .query("teams")
      .withIndex("by_slug", q => q.eq("slug", args.teamSlug))
      .unique();

    if (!team) return null;

    // Sprawdź czy użytkownik ma dostęp do zespołu
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", team._id).eq("clerkUserId", identity.subject)
      )
      .filter(q => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) return null;

    return {
      teamId: team._id,
      name: team.name,
      description: team.description,
      currency: team.currency || "PLN",
      settings: team.settings || {
        isPublic: false,
        allowGuestAccess: false,
      },
      userRole: teamMember.role,
    };
  }
});

export const inviteCustomerToProject = mutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args): Promise<{ invitationId: any }> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found for this project");
    }

    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || (teamMember.role !== "admin" && teamMember.role !== "member")) {
      throw new Error("Insufficient permissions to invite a customer");
    }

    const invitationId = await ctx.runMutation(internal.teams.createPendingCustomerInvitation, {
      email: args.email,
      projectId: args.projectId,
      clerkOrgId: team.clerkOrgId,
      invitedBy: identity.subject,
    });

    return { invitationId };
  }
});

const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
};

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

export const removeProjectFromCustomer = mutation({
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

    if (!targetMember || targetMember.role !== "customer") {
      throw new Error("Customer not found");
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

export const addCustomerToProject = internalMutation({
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

    // Sprawdź czy customer już istnieje dla tego projektu
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_email", q => q.eq("email", args.email))
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .unique();

    if (existingCustomer) {
      // Jeśli już istnieje, upewnij się że jest aktywny
      if (existingCustomer.status !== "active") {
        await ctx.db.patch(existingCustomer._id, { status: "active" });
      }
      return existingCustomer._id;
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

    // Dodaj customera
    return await ctx.db.insert("customers", {
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

export const createPendingCustomerInvitation = internalMutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    clerkOrgId: v.string(),
    invitedBy: v.string(),
  },
  async handler(ctx, args) {
    // Usuń poprzednie zaproszenia dla tego email + projekt (jeśli istnieją)
    const existingInvitations = await ctx.db
      .query("pendingCustomerInvitations")
      .filter(q => q.and(
        q.eq(q.field("email"), args.email),
        q.eq(q.field("projectId"), args.projectId)
      ))
      .collect();
    
    for (const invitation of existingInvitations) {
      await ctx.db.delete(invitation._id);
    }

    // Stwórz nowe zaproszenie
    return await ctx.db.insert("pendingCustomerInvitations", {
      email: args.email,
      projectId: args.projectId,
      clerkOrgId: args.clerkOrgId,
      invitedBy: args.invitedBy,
      status: "pending",
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 dni
    });
  }
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

    // This is not efficient, but for indexing it's fine.
    // It filters members who have the projectId in their projectIds array, or who are not customers (admins, members).
    return members.filter(m => m.projectIds?.includes(args.projectId) || m.role !== 'customer');
  },
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

    // Jeśli podano projectId, dodaj customerów z tabeli customers
    if (args.projectId) {
      const projectCustomers = await ctx.db
        .query("customers")
        .filter(q => q.and(
          q.eq(q.field("projectId"), args.projectId),
          q.eq(q.field("status"), "active")
        ))
        .collect();

      for (const customer of projectCustomers) {
        const customerUserId = customer.clerkUserId ?? "";
        
        // Sprawdź czy customer nie jest już w wynikach (z teamMembers)
        if (!customer.clerkUserId || !processedUserIds.has(customer.clerkUserId)) {
          let user = null;
          
          if (customer.clerkUserId) {
            user = await ctx.db
              .query("users")
              .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", customer.clerkUserId!))
              .unique();
          }

          result.push({
            _id: customer._id,
            _creationTime: customer._creationTime,
            teamId: customer.teamId,
            clerkUserId: customerUserId,
            clerkOrgId: customer.clerkOrgId,
            role: "customer" as const,
            permissions: [],
            projectIds: args.projectId ? [args.projectId] : undefined,
            joinedAt: customer.joinedAt || customer.invitedAt,
            isActive: true,
            name: user?.name ?? customer.email.split('@')[0],
            email: user?.email ?? customer.email,
            imageUrl: user?.imageUrl,
            source: "customerOnly"
          });
        }
      }
    }

    return result;
  },
});

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

    // Jeśli to był customer, usuń też wpisy z tabeli customers
    if (targetMember.role === "customer") {
      const customerRecords = await ctx.db
        .query("customers")
        .withIndex("by_clerk_user", q => q.eq("clerkUserId", args.clerkUserId))
        .filter(q => q.eq(q.field("teamId"), args.teamId))
        .collect();
      
      for (const customerRecord of customerRecords) {
        await ctx.db.delete(customerRecord._id);
      }
    }

    return { success: true };
  }
});

export const inviteTeamMember = mutation({
  args: {
    teamId: v.id("teams"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("customer")
    ),
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

    const currentUserMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (currentUserMember?.role !== "admin") {
      throw new Error("Only admins can invite members");
    }

    await ctx.scheduler.runAfter(0, internal.teams.sendClerkInvitation, {
      clerkOrgId: team.clerkOrgId,
      email: args.email,
      role: args.role,
      invitedBy: identity.subject,
    });

    return { success: true };
  },
});

export const sendClerkInvitation = internalAction({
  args: {
    clerkOrgId: v.string(),
    email: v.string(),
    role: v.string(), // "admin", "member", or "customer"
    invitedBy: v.string(),
  },
  async handler(ctx, args) {
    const clerkApiKey = process.env.CLERK_SECRET_KEY;
    if (!clerkApiKey) {
      throw new Error("CLERK_SECRET_KEY environment variable not set");
    }

    // Map our internal role to a Clerk role.
    // "customer" will be treated as a "member" in Clerk's system.
    const clerkRole = args.role === 'admin' ? 'org:admin' : 'org:member';

    const redirectUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    try {
      const response = await fetch(
        `https://api.clerk.com/v1/organizations/${args.clerkOrgId}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkApiKey}`,
          },
          body: JSON.stringify({
            email_address: args.email,
            role: clerkRole,
            inviter_user_id: args.invitedBy,
            redirect_url: redirectUrl,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json();
        console.error("Clerk API Error:", JSON.stringify(errorBody, null, 2));
        const clerkError = errorBody.errors[0]?.long_message || "Failed to send invitation.";
        throw new Error(`Clerk API Error: ${clerkError}`);
      }

    } catch (error) {
      console.error("Failed to send Clerk invitation:", error);
      throw new Error((error as Error).message);
    }
  },
});

export const changeTeamMemberRole = mutation({
  args: {
    clerkUserId: v.string(),
    teamId: v.id("teams"),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("customer")
    ),
    projectId: v.optional(v.id("projects")), // Wymagane dla roli customer
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
    const updateData: any = { role: args.role };

    // Jeśli zmiana na customer, potrzebny jest projectId
    if (args.role === "customer") {
      if (!args.projectId) {
        throw new Error("Project ID is required for customer role");
      }
      updateData.projectIds = [args.projectId];

      // Dodaj wpis do tabeli customers
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_user_id", q => q.eq("clerkUserId", args.clerkUserId))
        .unique();

      if (user) {
        await ctx.db.insert("customers", {
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
      // Jeśli zmiana z customer na inną rolę, usuń projectIds
      updateData.projectIds = undefined;

      // Usuń wpisy z tabeli customers
      if (targetMember.role === "customer") {
        const customerRecords = await ctx.db
          .query("customers")
          .withIndex("by_clerk_user", q => q.eq("clerkUserId", args.clerkUserId))
          .filter(q => q.eq(q.field("teamId"), args.teamId))
          .collect();
        
        for (const customerRecord of customerRecords) {
          await ctx.db.delete(customerRecord._id);
        }
      }
    }

    // Aktualizuj członka
    await ctx.db.patch(targetMember._id, updateData);

    return { success: true };
  }
});

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
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_clerk_user", q => q.eq("clerkUserId", args.clerkUserId))
      .filter(q => q.eq(q.field("projectId"), args.projectId))
      .unique();

    if (existingCustomer) {
      // Jeśli już ma dostęp, upewnij się że jest aktywny
      if (existingCustomer.status !== "active") {
        await ctx.db.patch(existingCustomer._id, { status: "active" });
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

    // Dodaj do tabeli customers
    await ctx.db.insert("customers", {
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

    // Aktualizuj członkostwo TYLKO jeśli to customer organizacyjny
    if (targetMember.role === "customer") {
      const currentProjectIds = targetMember.projectIds || [];
      if (!currentProjectIds.includes(args.projectId)) {
        await ctx.db.patch(targetMember._id, {
          projectIds: [...currentProjectIds, args.projectId],
        });
      }
    }
    // Dla admin/member - nie zmieniamy roli organizacyjnej, tylko dodajemy do project customers

    return { success: true, message: "User added to project successfully" };
  }
});

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

    // Pobierz już istniejących project customers
    const existingProjectCustomers = await ctx.db
      .query("customers")
      .filter(q => q.and(
        q.eq(q.field("projectId"), args.projectId),
        q.eq(q.field("status"), "active")
      ))
      .collect();

    const existingProjectCustomerUserIds = new Set(
      existingProjectCustomers.map(customer => customer.clerkUserId).filter(Boolean)
    );

    // POPRAWIONA LOGIKA: Pokaż tylko tych którzy mogą skorzystać z dodania jako project customer
    const availableMembers = allMembers.filter(member => {
      // Admin i Member już mają pełny dostęp do wszystkich projektów - nie trzeba ich dodawać jako project customers
      if (member.role === "admin" || member.role === "member") {
        return false;
      }

      // Nie pokazuj tych którzy już są project customers dla tego projektu
      if (existingProjectCustomerUserIds.has(member.clerkUserId)) {
        return false;
      }

      // Dla customerów organizacyjnych: sprawdź czy już mają ten projekt w projectIds
      if (member.role === "customer" && member.projectIds && member.projectIds.includes(args.projectId)) {
        return false;
      }

      // Pokaż: Customer (którzy jeszcze nie mają dostępu do tego projektu)
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

export const getPendingInvitations = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    return await ctx.db
      .query("invitations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("invitations") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const currentUserMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", invitation.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (currentUserMember?.role !== "admin") {
      throw new Error("Only admins can revoke invitations");
    }

    const clerkApiKey = process.env.CLERK_SECRET_KEY;
    if (!clerkApiKey) {
      throw new Error("CLERK_SECRET_KEY environment variable not set");
    }

    const response = await fetch(
      `https://api.clerk.com/v1/organizations/${currentUserMember.clerkOrgId}/invitations/${invitation.clerkInvitationId}/revoke`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkApiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to revoke invitation in Clerk");
    }

    // The webhook will handle the DB update
    return { success: true };
  },
});

export const updateTeamSettings = mutation({
  args: {
    teamId: v.id("teams"),
    currency: v.optional(v.union(
      v.literal("USD"), v.literal("EUR"), v.literal("PLN"), v.literal("GBP"),
      v.literal("CAD"), v.literal("AUD"), v.literal("JPY"), v.literal("CHF"),
      v.literal("SEK"), v.literal("NOK"), v.literal("DKK"), v.literal("CZK"),
      v.literal("HUF"), v.literal("CNY"), v.literal("INR"), v.literal("BRL"),
      v.literal("MXN"), v.literal("KRW"), v.literal("SGD"), v.literal("HKD")
    )),
    settings: v.optional(v.object({
      isPublic: v.boolean(),
      allowGuestAccess: v.boolean(),
    })),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Sprawdź uprawnienia - tylko admin może zmieniać ustawienia zespołu
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || teamMember.role !== "admin") {
      throw new Error("Only admins can update team settings");
    }

    // Przygotuj dane do aktualizacji
    const updateData: any = {};
    if (args.currency !== undefined) {
      updateData.currency = args.currency;
    }
    if (args.settings !== undefined) {
      updateData.settings = args.settings;
    }

    // Aktualizuj zespół
    await ctx.db.patch(args.teamId, updateData);

    return { success: true };
  },
});
