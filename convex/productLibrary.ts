import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get all products for a team with creator info
export const getAllProducts = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const { teamId } = args;
    
    const products = await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .order("desc")
      .collect();

    // Get creator names for all products
    const productsWithCreators = await Promise.all(
      products.map(async (product) => {
        const creator = await ctx.db
          .query("users")
          .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", product.createdBy))
          .first();
        
        return {
          ...product,
          creatorName: creator?.name || "Unknown User",
        };
      })
    );

    return productsWithCreators;
  },
});

// Get products by category
export const getProductsByCategory = query({
  args: { 
    teamId: v.id("teams"),
    category: v.string()
  },
  handler: async (ctx, args) => {
    const { teamId, category } = args;
    
    return await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("category"), category)
        )
      )
      .order("desc")
      .collect();
  },
});

// Get products by supplier
export const getProductsBySupplier = query({
  args: { 
    teamId: v.id("teams"),
    supplier: v.string()
  },
  handler: async (ctx, args) => {
    const { teamId, supplier } = args;
    
    return await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.eq(q.field("supplier"), supplier)
        )
      )
      .order("desc")
      .collect();
  },
});

// Search products
export const searchProducts = query({
  args: { 
    teamId: v.id("teams"),
    searchTerm: v.string()
  },
  handler: async (ctx, args) => {
    const { teamId, searchTerm } = args;
    
    const products = await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Simple text search across name, description, brand, model, and tags
    const searchLower = searchTerm.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower) ||
      product.brand?.toLowerCase().includes(searchLower) ||
      product.model?.toLowerCase().includes(searchLower) ||
      product.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  },
});

// Get product by ID with creator info
export const getProductById = query({
  args: { productId: v.id("productLibrary") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;

    // Get creator user info
    const creator = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", product.createdBy))
      .first();

    return {
      ...product,
      creatorName: creator?.name || "Unknown User",
    };
  },
});

// Create new product
export const createProduct = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    sku: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    supplierSku: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    weight: v.optional(v.number()),
    material: v.optional(v.string()),
    color: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    teamId: v.id("teams"),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("productLibrary", {
      ...args,
      isActive: true,
    });
  },
});

// Update product
export const updateProduct = mutation({
  args: {
    productId: v.id("productLibrary"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    sku: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    supplierSku: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    weight: v.optional(v.number()),
    material: v.optional(v.string()),
    color: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { productId, ...updates } = args;
    
    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    return await ctx.db.patch(productId, cleanUpdates);
  },
});

// Delete product (soft delete)
export const deleteProduct = mutation({
  args: { productId: v.id("productLibrary") },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.productId, { isActive: false });
  },
});

// Get unique categories for a team
export const getCategories = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const categories = new Set<string>();
    products.forEach(product => {
      if (product.category) {
        categories.add(product.category);
      }
    });
    
    return Array.from(categories).sort();
  },
});

// Get unique suppliers for a team
export const getSuppliers = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const suppliers = new Set<string>();
    products.forEach(product => {
      if (product.supplier) {
        suppliers.add(product.supplier);
      }
    });
    
    return Array.from(suppliers).sort();
  },
});

// Get unique brands for a team
export const getBrands = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("productLibrary")
      .withIndex("by_team", (q) => q.eq("teamId", args.teamId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    const brands = new Set<string>();
    products.forEach(product => {
      if (product.brand) {
        brands.add(product.brand);
      }
    });
    
    return Array.from(brands).sort();
  },
});

// Add product to shopping list
export const addToShoppingList = mutation({
  args: {
    productId: v.id("productLibrary"),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    quantity: v.number(),
    sectionId: v.optional(v.id("shoppingListSections")),
    createdBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    
    if (!product) {
      throw new Error("Product not found");
    }
    
    return await ctx.db.insert("shoppingListItems", {
      name: product.name,
      notes: args.notes || product.notes,
      completed: false,
      priority: "medium" as const,
      imageUrl: product.imageUrl,
      productLink: product.productLink,
      supplier: product.supplier,
      catalogNumber: product.sku,
      category: product.category,
      dimensions: product.dimensions,
      quantity: args.quantity,
      unitPrice: product.unitPrice,
      totalPrice: product.unitPrice ? product.unitPrice * args.quantity : undefined,
      realizationStatus: "PLANNED" as const,
      sectionId: args.sectionId,
      projectId: args.projectId,
      teamId: args.teamId,
      createdBy: args.createdBy,
      updatedAt: Date.now(),
    });
  },
});