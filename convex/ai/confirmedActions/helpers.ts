/**
 * Confirmed Actions - Access Control Helpers
 * 
 * Shared helpers for authentication and authorization in AI confirmed actions.
 */

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

// Basic access control helpers for confirmed AI actions
export const requireIdentity = async (ctx: any) => {
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
) => {
  const identity = await requireIdentity(ctx);
  const project = await ctx.runQuery(api.projects.getProject, { projectId });
  if (!project) {
    throw new Error("Project not found");
  }

  const membership = await ctx.runQuery(api.teams.getCurrentUserTeamMember, {
    teamId: project.teamId,
  });

  if (!membership || membership.isActive === false) {
    throw new Error("Forbidden");
  }

  if (requireWriteAccess && membership.role === "customer") {
    throw new Error("Forbidden");
  }

  if (
    membership.role === "member" &&
    membership.projectIds &&
    membership.projectIds.length > 0 &&
    !membership.projectIds.includes(projectId)
  ) {
    throw new Error("Forbidden");
  }

  return { identity, project, membership };
};

export const ensureTeamMembership = async (ctx: any, teamId: Id<"teams">) => {
  const identity = await requireIdentity(ctx);
  const membership = await ctx.runQuery(api.teams.getCurrentUserTeamMember, {
    teamId,
  });

  if (!membership || membership.isActive === false) {
    throw new Error("Forbidden");
  }

  return { identity, membership };
};




















