import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

// ====== SHOPPING LIST SECTIONS ======

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

// ====== SHOPPING LIST ITEMS ======

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
        priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
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

        const itemId = await ctx.db.insert("shoppingListItems", {
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
        
        return itemId;
    },
});

export const updateShoppingListItem = mutation({
    args: {
        itemId: v.id("shoppingListItems"),
        name: v.optional(v.string()),
        notes: v.optional(v.string()),
        buyBefore: v.optional(v.number()),
        priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
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

        await ctx.db.patch(itemId, {...updates, totalPrice, updatedAt: Date.now() });
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

export const getShoppingListForIndexing = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// ====== HELPER FUNCTIONS FOR INCREMENTAL INDEXING ======

export const getShoppingItemById = internalQuery({
  args: { itemId: v.id("shoppingListItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const getItemsChangedAfter = internalQuery({
  args: { 
    projectId: v.id("projects"), 
    since: v.number() 
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.or(
        q.gt(q.field("_creationTime"), args.since),
        q.gt(q.field("updatedAt"), args.since)
      ))
      .collect();
  },
}); 