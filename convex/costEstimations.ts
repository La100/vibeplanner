import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ====== COST ESTIMATION QUERIES ======

export const listCostEstimations = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const getCostEstimation = query({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.estimationId);
  },
});

export const getCostEstimationWithItems = query({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) return null;

    // Fetch labor items
    const laborItems = await Promise.all(
      estimation.laborItemIds.map((id) => ctx.db.get(id))
    );

    // Fetch material items
    const materialItems = await Promise.all(
      estimation.materialItemIds.map((id) => ctx.db.get(id))
    );

    // Fetch contact if linked
    const contact = estimation.contactId
      ? await ctx.db.get(estimation.contactId)
      : null;

    return {
      ...estimation,
      laborItems: laborItems.filter(Boolean),
      materialItems: materialItems.filter(Boolean),
      contact,
    };
  },
});

// ====== COST ESTIMATION MUTATIONS ======

export const createCostEstimation = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    estimationNumber: v.optional(v.string()),
    location: v.optional(v.string()),
    plannedStartDate: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    vatPercent: v.number(),
    discountPercent: v.optional(v.number()),
    materialItemIds: v.array(v.id("shoppingListItems")),
    laborItemIds: v.array(v.id("laborItems")),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Calculate totals
    const { laborTotal, materialsTotal, netTotal, discountAmount, vatAmount, grossTotal } =
      await calculateEstimationTotals(ctx, {
        laborItemIds: args.laborItemIds,
        materialItemIds: args.materialItemIds,
        vatPercent: args.vatPercent,
        discountPercent: args.discountPercent || 0,
      });

    const estimationId = await ctx.db.insert("costEstimations", {
      title: args.title,
      estimationNumber: args.estimationNumber,
      location: args.location,
      estimationDate: Date.now(),
      plannedStartDate: args.plannedStartDate,
      validUntil: args.validUntil,
      vatPercent: args.vatPercent,
      discountPercent: args.discountPercent,
      status: "draft",
      materialItemIds: args.materialItemIds,
      laborItemIds: args.laborItemIds,
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      customerAddress: args.customerAddress,
      contactId: args.contactId,
      notes: args.notes,
      projectId: args.projectId,
      teamId: project.teamId,
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: project.teamId,
      projectId: args.projectId,
      actionType: "estimation.create",
      entityId: estimationId,
      entityType: "estimation",
      details: {
        title: args.title,
        grossTotal,
      },
    });

    return estimationId;
  },
});

export const updateCostEstimation = mutation({
  args: {
    estimationId: v.id("costEstimations"),
    title: v.optional(v.string()),
    estimationNumber: v.optional(v.string()),
    location: v.optional(v.string()),
    plannedStartDate: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    vatPercent: v.optional(v.number()),
    discountPercent: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("expired")
      )
    ),
    materialItemIds: v.optional(v.array(v.id("shoppingListItems"))),
    laborItemIds: v.optional(v.array(v.id("laborItems"))),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const { estimationId, ...updates } = args;
    const estimation = await ctx.db.get(estimationId);
    if (!estimation) throw new Error("Estimation not found");

    // Recalculate totals if items or rates changed
    const laborItemIds = updates.laborItemIds ?? estimation.laborItemIds;
    const materialItemIds = updates.materialItemIds ?? estimation.materialItemIds;
    const vatPercent = updates.vatPercent ?? estimation.vatPercent;
    const discountPercent = updates.discountPercent ?? estimation.discountPercent ?? 0;

    const { laborTotal, materialsTotal, netTotal, discountAmount, vatAmount, grossTotal } =
      await calculateEstimationTotals(ctx, {
        laborItemIds,
        materialItemIds,
        vatPercent,
        discountPercent,
      });

    const patch: Record<string, unknown> = {
      ...updates,
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
      updatedAt: Date.now(),
    };

    await ctx.db.patch(estimationId, patch);

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: estimation.teamId,
      projectId: estimation.projectId,
      actionType: "estimation.update",
      entityId: args.estimationId,
      entityType: "estimation",
      details: {
        title: estimation.title,
        updates: Object.keys(updates),
      },
    });

    return estimationId;
  },
});

export const deleteCostEstimation = mutation({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) throw new Error("Estimation not found");

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: estimation.teamId,
      projectId: estimation.projectId,
      actionType: "estimation.delete",
      entityId: args.estimationId,
      entityType: "estimation",
      details: {
        title: estimation.title,
      },
    });

    await ctx.db.delete(args.estimationId);

    return args.estimationId;
  },
});

export const updateEstimationStatus = mutation({
  args: {
    estimationId: v.id("costEstimations"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) throw new Error("Estimation not found");

    await ctx.db.patch(args.estimationId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.activityLog.logActivity, {
      teamId: estimation.teamId,
      projectId: estimation.projectId,
      actionType: "estimation.status_change",
      entityId: args.estimationId,
      entityType: "estimation",
      details: {
        title: estimation.title,
        fromStatus: estimation.status,
        toStatus: args.status,
      },
    });

    return args.estimationId;
  },
});

// ====== RECALCULATE ESTIMATION ======

export const recalculateEstimation = mutation({
  args: { estimationId: v.id("costEstimations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const estimation = await ctx.db.get(args.estimationId);
    if (!estimation) throw new Error("Estimation not found");

    const { laborTotal, materialsTotal, netTotal, discountAmount, vatAmount, grossTotal } =
      await calculateEstimationTotals(ctx, {
        laborItemIds: estimation.laborItemIds,
        materialItemIds: estimation.materialItemIds,
        vatPercent: estimation.vatPercent,
        discountPercent: estimation.discountPercent || 0,
      });

    await ctx.db.patch(args.estimationId, {
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
      updatedAt: Date.now(),
    });

    return {
      laborTotal,
      materialsTotal,
      netTotal,
      discountAmount,
      vatAmount,
      grossTotal,
    };
  },
});

// ====== HELPER FUNCTIONS ======

interface CalculateTotalsArgs {
  laborItemIds: Id<"laborItems">[];
  materialItemIds: Id<"shoppingListItems">[];
  vatPercent: number;
  discountPercent: number;
}

interface CalculateTotalsResult {
  laborTotal: number;
  materialsTotal: number;
  netTotal: number;
  discountAmount: number;
  vatAmount: number;
  grossTotal: number;
}

async function calculateEstimationTotals(
  ctx: { db: { get: (id: Id<"laborItems"> | Id<"shoppingListItems">) => Promise<{ totalPrice?: number } | null> } },
  args: CalculateTotalsArgs
): Promise<CalculateTotalsResult> {
  // Calculate labor total
  let laborTotal = 0;
  for (const id of args.laborItemIds) {
    const item = await ctx.db.get(id);
    if (item?.totalPrice) {
      laborTotal += item.totalPrice;
    }
  }

  // Calculate materials total
  let materialsTotal = 0;
  for (const id of args.materialItemIds) {
    const item = await ctx.db.get(id);
    if (item?.totalPrice) {
      materialsTotal += item.totalPrice;
    }
  }

  // Calculate summary
  const netTotal = laborTotal + materialsTotal;
  const discountAmount = netTotal * (args.discountPercent / 100);
  const afterDiscount = netTotal - discountAmount;
  const vatAmount = afterDiscount * (args.vatPercent / 100);
  const grossTotal = afterDiscount + vatAmount;

  return {
    laborTotal: Math.round(laborTotal * 100) / 100,
    materialsTotal: Math.round(materialsTotal * 100) / 100,
    netTotal: Math.round(netTotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    grossTotal: Math.round(grossTotal * 100) / 100,
  };
}

// ====== QUERY HELPERS ======

export const getEstimationsByTeam = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db
      .query("costEstimations")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .order("desc")
      .collect();
  },
});

export const getEstimationsByStatus = query({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
  },
  handler: async (ctx, args) => {
    const estimations = await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return estimations.filter((e) => e.status === args.status);
  },
});

export const getEstimationStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const estimations = await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const stats = {
      total: estimations.length,
      draft: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      totalValue: 0,
      acceptedValue: 0,
    };

    for (const est of estimations) {
      stats[est.status]++;
      stats.totalValue += est.grossTotal || 0;
      if (est.status === "accepted") {
        stats.acceptedValue += est.grossTotal || 0;
      }
    }

    return stats;
  },
});

// Generate next estimation number
export const getNextEstimationNumber = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const estimations = await ctx.db
      .query("costEstimations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const year = new Date().getFullYear();
    const count = estimations.length + 1;
    return `EST-${year}-${count.toString().padStart(3, "0")}`;
  },
});


