import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Teams (mapowane na Clerk Organizations)
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    clerkOrgId: v.string(), // ID organizacji z Clerk
    slug: v.string(), // Nowe pole na unikalny slug
    imageUrl: v.optional(v.string()), // Added imageUrl for the team logo
    createdBy: v.optional(v.string()), // Clerk user ID - teraz opcjonalne
    settings: v.optional(v.object({
      isPublic: v.boolean(),
      allowGuestAccess: v.boolean(),
    })),
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    }))
  })
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]), // Dodany indeks

  // Projekty architektoniczne
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    slug: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    client: v.optional(v.string()),
    location: v.optional(v.string()),
    currency: v.optional(v.union(
      v.literal("USD"),
      v.literal("EUR"),
      v.literal("PLN")
    )),
    createdBy: v.string(), // Clerk user ID
    assignedTo: v.array(v.string()), // Array of Clerk user IDs
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    }))
  })
    .index("by_team", ["teamId"])
    .index("by_team_and_slug", ["teamId", "slug"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // Zadania w projektach
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    content: v.optional(v.string()), // Rich text content from Tiptap editor
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    status: v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("review"),
        v.literal("done")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    assignedTo: v.optional(v.string()), // Clerk user ID
    createdBy: v.string(), // Clerk user ID
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    tags: v.array(v.string()),
    cost: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_start_date", ["startDate"])
    .index("by_end_date", ["endDate"]),

  // Foldery dla organizacji plików
  folders: defineTable({
    name: v.string(),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    parentFolderId: v.optional(v.id("folders")), // Dla zagnieżdżonych folderów
    createdBy: v.string(), // Clerk user ID
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentFolderId"]),

  // Pliki i dokumenty
  files: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    folderId: v.optional(v.id("folders")), // W którym folderze znajduje się plik
    fileType: v.union(
      v.literal("image"),
      v.literal("document"),
      v.literal("drawing"),
      v.literal("model"),
      v.literal("other")
    ),
    storageId: v.id("_storage"), // Convex storage ID
    size: v.number(),
    mimeType: v.string(),
    uploadedBy: v.string(), // Clerk user ID
    version: v.number(),
    isLatest: v.boolean(),
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_task", ["taskId"])
    .index("by_folder", ["folderId"])
    .index("by_uploaded_by", ["uploadedBy"]),

  // Komentarze
  comments: defineTable({
    content: v.string(),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    fileId: v.optional(v.id("files")),
    authorId: v.string(), // Clerk user ID
    parentCommentId: v.optional(v.id("comments")), // For replies
    isEdited: v.boolean(),
    editedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_task", ["taskId"])
    .index("by_file", ["fileId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentCommentId"]),

  // Członkowie zespołów (cache dla Clerk data)
  teamMembers: defineTable({
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
      v.literal("client")
    ),
    permissions: v.array(v.string()),
    projectIds: v.optional(v.array(v.id("projects"))), // Lista projektów dla klientów
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_team_and_user", ["teamId", "clerkUserId"])
    .index("by_user", ["clerkUserId"])
    .index("by_team", ["teamId"]),

  // Zaproszenia do zespołów
  invitations: defineTable({
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
      v.literal("client")
    ),
    invitedBy: v.string(), // Clerk user ID
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
    token: v.string(), // Unique invitation token
  })
    .index("by_team", ["teamId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_status", ["status"]),

  

  // Tymczasowe zaproszenia klientów (do konkretnych projektów)
  pendingClientInvitations: defineTable({
    email: v.string(),
    projectId: v.id("projects"),
    clerkOrgId: v.string(),
    invitedBy: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired")
    ),
    expiresAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_project", ["projectId"])
    .index("by_org", ["clerkOrgId"]),

  // Klienci z dostępem do konkretnych projektów
  clients: defineTable({
    email: v.string(),
    clerkUserId: v.optional(v.string()), // Gdy się zarejestruje
    clerkOrgId: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    invitedBy: v.string(),
    status: v.union(
      v.literal("invited"),
      v.literal("active"),
      v.literal("inactive")
    ),
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_org_and_user", ["clerkOrgId", "clerkUserId"])
    .index("by_status", ["status"]),

  // Użytkownicy
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"]),

  // Shopping List
  shoppingListSections: defineTable({
    name: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    order: v.number(),
    createdBy: v.string(), // Clerk user ID
  })
    .index("by_project", ["projectId"]),

  shoppingListItems: defineTable({
    name: v.string(),
    notes: v.optional(v.string()),
    completed: v.boolean(),
    completedAt: v.optional(v.number()),
    buyBefore: v.optional(v.number()),
    priority: v.union(
      v.literal("LOW"),
      v.literal("MEDIUM"),
      v.literal("HIGH"),
      v.literal("URGENT")
    ),
    imageUrl: v.optional(v.string()),
    productLink: v.optional(v.string()),
    supplier: v.optional(v.string()),
    catalogNumber: v.optional(v.string()),
    category: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    quantity: v.number(),
    unitPrice: v.optional(v.number()),
    totalPrice: v.optional(v.number()),
    realizationStatus: v.union(
      v.literal("PLANNED"),
      v.literal("ORDERED"),
      v.literal("IN_TRANSIT"),
      v.literal("DELIVERED"),
      v.literal("COMPLETED"),
      v.literal("CANCELLED")
    ),
    sectionId: v.optional(v.id("shoppingListSections")),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    assignedTo: v.optional(v.string()), // Clerk user ID
  })
  .index("by_project", ["projectId"])
  .index("by_section", ["sectionId"])
  .index("by_status", ["realizationStatus"]),
});
