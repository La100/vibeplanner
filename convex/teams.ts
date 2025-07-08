import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
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
    await ctx.runMutation(internal.teams.addClientToProject, {
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
