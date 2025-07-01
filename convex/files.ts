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

// Utwórz folder
export const createFolder = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    parentFolderId: v.optional(v.id("folders")),
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

    return await ctx.db.insert("folders", {
      name: args.name,
      teamId: project.teamId,
      projectId: args.projectId,
      parentFolderId: args.parentFolderId,
      createdBy: identity.subject,
    });
  },
});

// Dodaj plik do projektu/folderu
export const attachFileToProject = mutation({
  args: {
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders")),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.optional(v.number()),
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

    // Sprawdź czy folder istnieje i należy do projektu
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.projectId !== args.projectId) {
        throw new Error("Invalid folder");
      }
    }

    // Określ typ pliku na podstawie MIME type
    const getFileType = (mimeType: string) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType === "application/pdf" || mimeType.includes("document")) return "document";
      if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "drawing";
      return "other";
    };

    // Utwórz rekord pliku
    return await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: args.projectId,
      folderId: args.folderId,
      fileType: getFileType(args.fileType),
      storageId: args.fileKey as any, // R2 key stored as storageId
      size: args.fileSize || 0,
      mimeType: args.fileType,
      uploadedBy: identity.subject,
      version: 1,
      isLatest: true,
    });
  },
});

// Pobierz foldery projektu
export const getProjectFolders = query({
  args: { 
    projectId: v.id("projects"),
    parentFolderId: v.optional(v.id("folders"))
  },
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

    return await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("parentFolderId"), args.parentFolderId))
      .collect();
  },
});

// Pobierz pliki projektu (w określonym folderze lub root)
export const getProjectFiles = query({
  args: { 
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders"))
  },
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
      .filter(q => q.eq(q.field("folderId"), args.folderId))
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

// Pobierz wszystkie pliki i foldery dla konkretnej lokalizacji
export const getProjectContent = query({
  args: { 
    projectId: v.id("projects"),
    folderId: v.optional(v.id("folders"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { folders: [], files: [] };

    const project = await ctx.db.get(args.projectId);
    if (!project) return { folders: [], files: [] };

    // Sprawdź uprawnienia
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return { folders: [], files: [] };

    // Pobierz foldery
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("parentFolderId"), args.folderId))
      .collect();

    // Pobierz pliki
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .filter(q => q.eq(q.field("folderId"), args.folderId))
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

    return { folders, files: filesWithUrls };
  },
});

// Usuń folder
export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("Folder not found");

    // Sprawdź uprawnienia
    const project = await ctx.db.get(folder.projectId!);
    if (project) {
      const member = await ctx.db
        .query("teamMembers")
        .withIndex("by_team_and_user", q => 
          q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
        )
        .unique();
      
      if (!member || !member.isActive) {
        throw new Error("No permission to delete this folder");
      }
    }

    // Sprawdź czy folder jest pusty (brak plików i podfolderów)
    const filesInFolder = await ctx.db
      .query("files")
      .withIndex("by_folder", q => q.eq("folderId", args.folderId))
      .first();

    const subfolders = await ctx.db
      .query("folders")
      .withIndex("by_parent", q => q.eq("parentFolderId", args.folderId))
      .first();

    if (filesInFolder || subfolders) {
      throw new Error("Cannot delete folder that contains files or subfolders");
    }

    // Usuń folder
    await ctx.db.delete(args.folderId);
    
    return { success: true };
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