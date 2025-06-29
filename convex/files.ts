import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const r2 = new R2(components.r2);

// Konfiguracja klienta R2 z walidacją dla interior design
export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    // Sprawdź czy użytkownik jest zalogowany
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to upload files");
    }
    
    // Można dodać dodatkowe sprawdzenia uprawnień
    console.log(`User ${identity.subject} is uploading to bucket ${bucket}`);
  },
  
  onUpload: async (ctx, key) => {
    // Logika wykonywana po upload - możemy utworzyć rekord w bazie
    console.log(`File uploaded with key: ${key}`);
  },
});

// Dodaj plik do projektu/zadania
export const attachFileToProject = mutation({
  args: {
    projectId: v.id("projects"),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    category: v.union(
      v.literal("inspiration"), 
      v.literal("moodboard"),
      v.literal("floor_plan"),
      v.literal("technical_drawing"),
      v.literal("product_photo"),
      v.literal("client_photo"),
      v.literal("progress_photo"),
      v.literal("document"),
      v.literal("other")
    ),
    roomCategory: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Sprawdź uprawnienia do projektu
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
    }

    // Utwórz rekord pliku
    return await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: args.projectId,
      fileType: args.category === "floor_plan" || args.category === "technical_drawing" ? "drawing" : 
               args.category === "product_photo" || args.category === "client_photo" || args.category === "progress_photo" || args.category === "inspiration" ? "image" :
               args.category === "document" ? "document" : "other",
      storageId: args.fileKey as any, // R2 key stored as storageId
      size: 0, // Will be updated when we get metadata
      mimeType: args.fileType,
      uploadedBy: identity.subject,
      version: 1,
      isLatest: true,
    });
  },
});

// Pobierz pliki projektu
export const getProjectFiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Sprawdź uprawnienia
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return [];

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();

    // Generuj URLs dla plików
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        try {
          const url = await r2.getUrl(file.storageId as string, {
            expiresIn: 60 * 60 * 24, // 24 godziny
          });
          return { ...file, url };
        } catch (error) {
          console.error(`Error generating URL for file ${file._id}:`, error);
          return { ...file, url: null };
        }
      })
    );

    return filesWithUrls;
  },
});

// Usuń plik
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    // Sprawdź czy użytkownik może usunąć plik
    if (file.uploadedBy !== identity.subject) {
      const project = await ctx.db.get(file.projectId!);
      if (project) {
        const member = await ctx.db
          .query("teamMembers")
          .withIndex("by_team_and_user", q => 
            q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
          )
          .unique();
        
        if (!member || (member.role !== "admin" && member.role !== "member")) {
          throw new Error("No permission to delete this file");
        }
      }
    }

    // TODO: Usuń z R2 - implementować później
    // await r2.deleteByKey(ctx, file.storageId as string);
    
    // Usuń z bazy danych
    await ctx.db.delete(args.fileId);
    
    return { success: true };
  },
});

// Pobierz metadane pliku
export const getFileMetadata = query({
  args: { fileKey: v.string() },
  handler: async (ctx, args) => {
    return await r2.getMetadata(ctx, args.fileKey);
  },
}); 