import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Utility function to check admin or member access
const hasAdminAccess = async (ctx: any, teamId: Id<"teams">): Promise<boolean> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const membership = await ctx.db
    .query("teamMembers")
    .withIndex("by_team_and_user", (q: any) =>
      q.eq("teamId", teamId).eq("clerkUserId", identity.subject)
    )
    .unique();

  if (!membership || !membership.isActive) return false;

  return membership.role === "admin" || membership.role === "member";
};

// LIST TEAM CUSTOMERS
export const listTeamCustomers = query({
  args: { teamId: v.id("teams") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Check if user has access to team
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", args.teamId).eq("clerkUserId", identity.subject)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (!teamMember) return [];

    // Get all customers for this team
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .collect();

    // Enrich with user data
    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        if (customer.clerkUserId) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", customer.clerkUserId!))
            .unique();
          
          return {
            ...customer,
            name: user?.name,
            imageUrl: user?.imageUrl,
          };
        }
        return customer;
      })
    );

    return enrichedCustomers;
  },
});

// INVITE CUSTOMER TO PROJECT
export const inviteCustomerToProject = mutation({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get project and team
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const team = await ctx.db.get(project.teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const hasAccess = await hasAdminAccess(ctx, project.teamId);
    if (!hasAccess) {
      throw new Error("Only admins can invite customers");
    }

    // Check if customer already exists for this project
    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .unique();

    if (existingCustomer) {
      throw new Error("Customer already has access to this project");
    }

    // Check if user already exists in the system
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .unique();

    let status: "invited" | "active" = "invited";
    let clerkUserId: string | undefined = undefined;
    let joinedAt: number | undefined = undefined;

    if (existingUser) {
      clerkUserId = existingUser.clerkUserId;
      joinedAt = Date.now();
      status = "active";
    }

    // Create customer record
    const customerId = await ctx.db.insert("customers", {
      email: args.email.toLowerCase(),
      clerkUserId,
      clerkOrgId: team.clerkOrgId,
      projectId: args.projectId,
      teamId: project.teamId,
      invitedBy: identity.subject,
      status,
      invitedAt: Date.now(),
      joinedAt,
    });

    // TODO: Send email invitation if user doesn't exist
    
    return { customerId, status };
  },
});

// REMOVE CUSTOMER ACCESS
export const removeCustomerAccess = mutation({
  args: { customerId: v.id("customers") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const hasAccess = await hasAdminAccess(ctx, customer.teamId);
    if (!hasAccess) {
      throw new Error("Only admins can remove customer access");
    }

    await ctx.db.delete(args.customerId);
    return { success: true };
  },
});

// TOGGLE CUSTOMER STATUS
export const toggleCustomerStatus = mutation({
  args: { customerId: v.id("customers") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const hasAccess = await hasAdminAccess(ctx, customer.teamId);
    if (!hasAccess) {
      throw new Error("Only admins can change customer status");
    }

    const newStatus = customer.status === "active" ? "inactive" : "active";
    
    await ctx.db.patch(args.customerId, { 
      status: newStatus,
      joinedAt: newStatus === "active" ? Date.now() : customer.joinedAt,
    });

    return { success: true, newStatus };
  },
});

// GET CUSTOMERS FOR PROJECT
export const getProjectCustomers = query({
  args: { projectId: v.id("projects") },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Check if user has access to this project
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!teamMember || !teamMember.isActive) return [];

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Enrich with user data
    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        if (customer.clerkUserId) {
          const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", customer.clerkUserId!))
            .unique();
          
          return {
            ...customer,
            name: user?.name,
            imageUrl: user?.imageUrl,
          };
        }
        return customer;
      })
    );

    return enrichedCustomers;
  },
});

// Activate pending customers who have joined the organization
export const activatePendingCustomer = internalMutation({
  args: { email: v.string(), clerkUserId: v.string() },
  async handler(ctx, args) {
    // Find all invited customers with this email
    const invitedCustomers = await ctx.db
      .query("customers")
      .withIndex("by_email", q => q.eq("email", args.email))
      .filter(q => q.eq(q.field("status"), "invited"))
      .collect();
    
    if (invitedCustomers.length === 0) {
      return { activated: 0 };
    }
    
    // Activate all invited customers for this email
    let activatedCount = 0;
    for (const customer of invitedCustomers) {
      await ctx.db.patch(customer._id, {
        status: "active",
        clerkUserId: args.clerkUserId,
        joinedAt: Date.now()
      });
      activatedCount++;
    }
    
    // Mark pending invitations as accepted
    const pendingInvitations = await ctx.db
      .query("pendingCustomerInvitations")
      .filter(q => q.and(
        q.eq(q.field("email"), args.email),
        q.eq(q.field("status"), "pending")
      ))
      .collect();
    
    for (const invitation of pendingInvitations) {
      await ctx.db.patch(invitation._id, {
        status: "accepted"
      });
    }
    
    return { activated: activatedCount };
  }
});

// One-time fix for stuck customers (can be called manually)
export const fixStuckCustomer = internalMutation({
  args: { email: v.string() },
  async handler(ctx, args) {

    // Find the customer first to get the clerkOrgId
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_email", q => q.eq("email", args.email))
      .filter(q => q.eq(q.field("status"), "invited"))
      .first();

    if (!customer) {
      return { message: "No invited customers found for this email", activated: 0 };
    }

    // Check if there's a team member in the same org that joined
    const teamMembers = await ctx.db
      .query("teamMembers") 
      .filter(q => q.eq(q.field("clerkOrgId"), customer.clerkOrgId))
      .collect();

    // Find user by email first  
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique();

    // If no user record but there are team members, try to find by clerkUserId pattern
    if (!user && teamMembers.length > 0) {
      // Try to find the user by clerkUserId among team members
      const possibleUsers = await ctx.db
        .query("users")
        .collect();
      
      // Find user that matches one of the team members
      for (const member of teamMembers) {
        const matchingUser = possibleUsers.find(u => u.clerkUserId === member.clerkUserId);
        if (matchingUser) {
          // Create user record with the correct email if email matches pattern
          const emailPrefix = args.email.split('@')[0].toLowerCase();
          if (matchingUser.name?.toLowerCase().includes(emailPrefix) || 
              matchingUser.email?.toLowerCase() === args.email) {
            user = matchingUser;
            break;
          }
        }
      }
    }

    if (!user) {
      return { message: `No user record found for ${args.email}. Available team members: ${teamMembers.length}`, activated: 0 };
    }


    // Find invited customers with this email
    const invitedCustomers = await ctx.db
      .query("customers")
      .withIndex("by_email", q => q.eq("email", args.email))
      .filter(q => q.eq(q.field("status"), "invited"))
      .collect();

    if (invitedCustomers.length === 0) {
      return { message: "No invited customers found for this email", activated: 0 };
    }

    // Activate all invited customers
    let activatedCount = 0;
    for (const customerToActivate of invitedCustomers) {
      await ctx.db.patch(customerToActivate._id, {
        status: "active",
        clerkUserId: user!.clerkUserId,
        joinedAt: Date.now()
      });
      activatedCount++;
    }

    // Mark pending invitations as accepted
    const pendingInvitations = await ctx.db
      .query("pendingCustomerInvitations")
      .filter(q => q.and(
        q.eq(q.field("email"), args.email),
        q.eq(q.field("status"), "pending")
      ))
      .collect();

    for (const invitation of pendingInvitations) {
      await ctx.db.patch(invitation._id, {
        status: "accepted"
      });
    }

    return { 
      message: `Successfully activated ${activatedCount} customers for ${args.email}`,
      activated: activatedCount 
    };
  }
});

// Simple manual activation for debugging
export const manualActivateCustomer = mutation({
  args: { 
    customerId: v.id("customers"),
    clerkUserId: v.string()
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.patch(args.customerId, {
      status: "active",
      clerkUserId: args.clerkUserId,
      joinedAt: Date.now()
    });

    return { success: true };
  }
});