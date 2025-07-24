import { R2 } from "@convex-dev/r2";
import { api, components } from "./_generated/api";
import { mutation, query, internalMutation } from "./_generated/server";
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

// Generate upload URL with custom folder structure: org/project/file
export const generateUploadUrlWithCustomKey = mutation({
  args: {
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
    fileName: v.string(),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
    publicUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const team = await ctx.db.get(project.teamId);
    if (!team) throw new Error("Team not found");

    // Check access
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this project");
    }

    const contextFolder = args.taskId ? 'tasks' : 'files';
    const path = `${team.slug}/${project.slug}/${contextFolder}`;

    // Generate folder structure: team/project/context/uuid-filename
    const fileExtension = args.fileName.includes('.') 
      ? args.fileName.split('.').pop() 
      : '';
    const baseName = args.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? '.' + fileExtension : ''}`;

    const uploadData = await r2.generateUploadUrl(customKey);
    const publicUrl = process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${customKey}` : "";

    if (!publicUrl) {
      console.warn("R2_PUBLIC_URL environment variable is not set. File analysis will not work.");
    }
    
    return {
      url: uploadData.url,
      key: customKey,
      publicUrl: publicUrl,
    };
  },
});

// Generate upload URL for chat files - stored in chat folder
export const generateChatUploadUrl = mutation({
  args: {
    channelId: v.id("chatChannels"),
    fileName: v.string(),
  },
  returns: v.object({
    url: v.string(),
    key: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    const team = await ctx.db.get(channel.teamId);
    if (!team) throw new Error("Team not found");

    // Check access to channel
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", channel.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this channel");
    }

    // Generate folder structure: team/project/chat/uuid-filename or team/chat/uuid-filename
    let path = `${team.slug}`;
    if (channel.projectId) {
      const project = await ctx.db.get(channel.projectId);
      if (project) {
        path = `${path}/${project.slug}`;
      }
    }
    path = `${path}/chat`;

    // Generate unique filename
    const fileExtension = args.fileName.includes('.') 
      ? args.fileName.split('.').pop() 
      : '';
    const baseName = args.fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const uuid = crypto.randomUUID();
    const customKey = `${path}/${uuid}-${baseName}${fileExtension ? '.' + fileExtension : ''}`;

    const uploadData = await r2.generateUploadUrl(customKey);
    
    return {
      url: uploadData.url,
      key: customKey,
    };
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
export const addFile = mutation({
  args: {
    projectId: v.id("projects"),
    taskId: v.optional(v.id("tasks")),
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
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType === "application/pdf" || mimeType.includes("document")) return "document";
      if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "drawing";
      return "other";
    };

    // Utwórz rekord pliku
    return await ctx.db.insert("files", {
      name: args.fileName,
      teamId: project.teamId,
      projectId: args.projectId,
      taskId: args.taskId,
      folderId: args.folderId,
      fileType: getFileType(args.fileType),
      storageId: args.fileKey, // R2 key stored as string
      size: args.fileSize || 0,
      mimeType: args.fileType,
      uploadedBy: identity.subject,
      version: 1,
      isLatest: true,
    });
  },
});

// Add chat file to database
export const addChatFile = mutation({
  args: {
    channelId: v.id("chatChannels"),
    fileKey: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    // Check access to channel
    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", channel.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) {
      throw new Error("No access to this channel");
    }

    // Determine file type based on MIME type
    const getFileType = (mimeType: string) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType === "application/pdf" || mimeType.includes("document")) return "document";
      if (mimeType.includes("dwg") || mimeType.includes("dxf")) return "drawing";
      return "other";
    };

    // Create file record
    const fileId = await ctx.db.insert("files", {
      name: args.fileName,
      teamId: channel.teamId,
      projectId: channel.projectId,
      taskId: undefined,
      folderId: undefined, // Chat files don't belong to folders
      fileType: getFileType(args.fileType),
      storageId: args.fileKey,
      size: args.fileSize || 0,
      mimeType: args.fileType,
      uploadedBy: identity.subject,
      version: 1,
      isLatest: true,
    });

    // Get file URL for immediate use
    const fileUrl = await r2.getUrl(args.fileKey, {
      expiresIn: 60 * 60 * 24, // 24 hours
    });

    return {
      fileId,
      fileUrl,
    };
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

    // Usuń z R2 używając komponentu
    try {
      await ctx.runMutation(components.r2.lib.deleteObject, {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        bucket: process.env.R2_BUCKET!,
        endpoint: process.env.R2_ENDPOINT!,
        key: file.storageId,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      });
    } catch (error) {
      console.error(`Failed to delete file from R2: ${error}`);
      // Continue with database deletion even if R2 deletion fails
      // This prevents orphaned database records if R2 service is temporarily unavailable
    }
    
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

// Pobierz informacje o konkretnym folderze
export const getFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const folder = await ctx.db.get(args.folderId);
    if (!folder) return null;

    // Sprawdź uprawnienia
    const project = await ctx.db.get(folder.projectId!);
    if (!project) return null;

    const hasAccess = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_and_user", q => 
        q.eq("teamId", project.teamId).eq("clerkUserId", identity.subject)
      )
      .unique();

    if (!hasAccess || !hasAccess.isActive) return null;

    return folder;
  },
});

export const getFilesForTask = query({
    args: { taskId: v.id("tasks") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        const task = await ctx.db.get(args.taskId);
        if (!task) return [];

        const hasAccess = await ctx.runQuery(api.projects.checkUserProjectAccess, { projectId: task.projectId });
        if (!hasAccess) return [];

        const files = await ctx.db
            .query("files")
            .withIndex("by_task", q => q.eq("taskId", args.taskId))
            .collect();

        return Promise.all(
            files.map(async (file) => {
                const url = await r2.getUrl(file.storageId);
                return { ...file, url };
            })
        );
    }
});

// ====== TEXT EXTRACTION SUPPORT ======

// Internal mutation to update file with extracted text
export const updateFileWithExtractedText = internalMutation({
  args: {
    fileId: v.id("files"),
    extractedText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      extractedText: args.extractedText,
      textExtractionStatus: "completed",
    });
  },
});

// Update file text extraction status
export const updateTextExtractionStatus = internalMutation({
  args: {
    fileId: v.id("files"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"), 
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      textExtractionStatus: args.status,
    });
  },
});

// Get file by ID (for text extraction)
export const getFileById = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
}); 