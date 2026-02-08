/**
 * Confirmed Actions - Access Control Helpers
 * 
 * Shared helpers for authentication and authorization in AI confirmed actions.
 */

import type { Id } from "../../_generated/dataModel";
const internalAny = require("../../_generated/api").internal as any;

// Basic access control helpers for confirmed AI actions
export const requireIdentity = async (ctx: any): Promise<{ subject: string }> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity;
};

export const ensureProjectAccess = async (
  ctx: any,
  projectId: Id<"projects">,
  requireWriteAccess = true,
): Promise<{ identity: { subject: string }; project: any; membership: any }> => {
  const identity = await requireIdentity(ctx);
  let project: any = null;
  let membership: any = null;

  if (ctx.db && typeof ctx.db.get === "function") {
    project = await ctx.db.get(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q: any) =>
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();
  } else {
    project = await ctx.runQuery(internalAny.projects.getProjectByIdInternal, { projectId });
    if (!project) {
      throw new Error("Project not found");
    }

    membership = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
      teamId: project.teamId,
      clerkUserId: identity.subject,
    });
  }

  if (!membership || membership.isActive === false) {
    throw new Error("Forbidden");
  }

  return { identity, project, membership };
};

export const ensureTeamMembership = async (ctx: any, teamId: Id<"teams">): Promise<{ identity: { subject: string }; membership: any }> => {
  const identity = await requireIdentity(ctx);
  let membership: any = null;

  if (ctx.db && typeof ctx.db.query === "function") {
    membership = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", (q: any) =>
        q.eq("teamId", teamId).eq("clerkUserId", identity.subject)
      )
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .first();
  } else {
    membership = await ctx.runQuery(internalAny.teams.getTeamMemberByClerkId, {
      teamId,
      clerkUserId: identity.subject,
    });
  }

  if (!membership || membership.isActive === false) {
    throw new Error("Forbidden");
  }

  return { identity, membership };
};











