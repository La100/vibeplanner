import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Teams (mapped to Clerk Organizations)
  teams: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    clerkOrgId: v.string(), // Organization ID from Clerk
    slug: v.string(), // New field for unique slug
    imageUrl: v.optional(v.string()), // Added imageUrl for the team logo
    createdBy: v.optional(v.string()), // Clerk user ID - now optional
    currency: v.optional(v.union(
      v.literal("USD"), // US Dollar
      v.literal("EUR"), // Euro
      v.literal("PLN"), // Polish Zloty
      v.literal("GBP"), // British Pound
      v.literal("CAD"), // Canadian Dollar
      v.literal("AUD"), // Australian Dollar
      v.literal("JPY"), // Japanese Yen
      v.literal("CHF"), // Swiss Franc
      v.literal("SEK"), // Swedish Krona
      v.literal("NOK"), // Norwegian Krone
      v.literal("DKK"), // Danish Krone
      v.literal("CZK"), // Czech Koruna
      v.literal("HUF"), // Hungarian Forint
      v.literal("CNY"), // Chinese Yuan
      v.literal("INR"), // Indian Rupee
      v.literal("BRL"), // Brazilian Real
      v.literal("MXN"), // Mexican Peso
      v.literal("KRW"), // South Korean Won
      v.literal("SGD"), // Singapore Dollar
      v.literal("HKD"), // Hong Kong Dollar
    )),
    settings: v.optional(v.object({
      isPublic: v.boolean(),
      allowGuestAccess: v.boolean(),
    })),
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    })),
    // Stripe subscription fields
    stripeCustomerId: v.optional(v.string()), // Stripe customer ID
    subscriptionStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("unpaid"),
      v.null()
    )),
    subscriptionId: v.optional(v.string()), // Stripe subscription ID
    subscriptionPlan: v.optional(v.union(
      v.literal("free"),
      v.literal("basic"),
      v.literal("pro"),
      v.literal("enterprise")
    )),
    subscriptionPriceId: v.optional(v.string()), // Stripe price ID
    currentPeriodStart: v.optional(v.number()), // Unix timestamp
    currentPeriodEnd: v.optional(v.number()), // Unix timestamp
    trialEnd: v.optional(v.number()), // Unix timestamp
    cancelAtPeriodEnd: v.optional(v.boolean()),
    subscriptionLimits: v.optional(v.object({
      id: v.string(),
      name: v.string(),
      maxProjects: v.number(),
      maxTeamMembers: v.number(),
      maxStorageGB: v.number(),
      hasAdvancedFeatures: v.boolean(),
      price: v.number(),
    }))
  })
    .index("by_clerk_org", ["clerkOrgId"])
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]), // Added index

  // Architectural projects
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    slug: v.string(),
    projectId: v.number(), // Numeric project ID for users
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("on_hold"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    budget: v.optional(v.number()),
    customer: v.optional(v.string()),
    location: v.optional(v.string()),
    currency: v.optional(v.union(
      v.literal("USD"), // US Dollar
      v.literal("EUR"), // Euro
      v.literal("PLN"), // Polish Zloty
      v.literal("GBP"), // British Pound
      v.literal("CAD"), // Canadian Dollar
      v.literal("AUD"), // Australian Dollar
      v.literal("JPY"), // Japanese Yen
      v.literal("CHF"), // Swiss Franc
      v.literal("SEK"), // Swedish Krona
      v.literal("NOK"), // Norwegian Krone
      v.literal("DKK"), // Danish Krone
      v.literal("CZK"), // Czech Koruna
      v.literal("HUF"), // Hungarian Forint
      v.literal("CNY"), // Chinese Yuan
      v.literal("INR"), // Indian Rupee
      v.literal("BRL"), // Brazilian Real
      v.literal("MXN"), // Mexican Peso
      v.literal("KRW"), // South Korean Won
      v.literal("SGD"), // Singapore Dollar
      v.literal("HKD"), // Hong Kong Dollar
    )),
    createdBy: v.string(), // Clerk user ID
    assignedTo: v.array(v.string()), // Array of Clerk user IDs
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.object({ name: v.string(), color: v.string() }),
      done: v.object({ name: v.string(), color: v.string() }),
    })),
    sidebarPermissions: v.optional(v.object({
      overview: v.optional(v.object({ visible: v.boolean() })),
      tasks: v.optional(v.object({ visible: v.boolean() })),
      notes: v.optional(v.object({ visible: v.boolean() })),
      contacts: v.optional(v.object({ visible: v.boolean() })),
      surveys: v.optional(v.object({ visible: v.boolean() })),
      calendar: v.optional(v.object({ visible: v.boolean() })),
      gantt: v.optional(v.object({ visible: v.boolean() })),
      files: v.optional(v.object({ visible: v.boolean() })),
      shopping_list: v.optional(v.object({ visible: v.boolean() })),
      settings: v.optional(v.object({ visible: v.boolean() })),
    })),
  })
    .index("by_team", ["teamId"])
    .index("by_team_and_slug", ["teamId", "slug"])
    .index("by_project_id", ["projectId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // Tasks in projects
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
    priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent"),
        v.null()
    )),
    assignedTo: v.optional(v.union(v.string(), v.null())), // Clerk user ID
    createdBy: v.string(), // Clerk user ID
    dueDate: v.optional(v.number()),
    tags: v.array(v.string()),
    cost: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_assigned_to", ["assignedTo"]),

  // Folders for file organization
  folders: defineTable({
    name: v.string(),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    parentFolderId: v.optional(v.id("folders")), // For nested folders
    createdBy: v.string(), // Clerk user ID
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_parent", ["parentFolderId"]),

  // Files and documents
  files: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")),
    folderId: v.optional(v.id("folders")), // Which folder contains the file
    fileType: v.union(
      v.literal("image"),
      v.literal("video"),
      v.literal("document"),
      v.literal("drawing"),
      v.literal("model"),
      v.literal("other")
    ),
    storageId: v.string(), // R2 storage key
    size: v.number(),
    mimeType: v.string(),
    uploadedBy: v.string(), // Clerk user ID
    version: v.number(),
    isLatest: v.boolean(),
    origin: v.optional(v.union(
      v.literal("general"),
      v.literal("ai")
    )),
    extractedText: v.optional(v.string()), // Text extracted from file
    textExtractionStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"), 
      v.literal("completed"),
      v.literal("failed")
    )),
    // PDF analysis with Vertex AI
    pdfAnalysis: v.optional(v.string()), // Analysis results for PDF files
    analysisStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    )),
    // For moodboard images - which section they belong to
    moodboardSection: v.optional(v.string()),
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_task", ["taskId"])
    .index("by_folder", ["folderId"])
    .index("by_uploaded_by", ["uploadedBy"])
    .index("by_moodboard_section", ["projectId", "moodboardSection"]),

  // Comments
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

  // Chat channels (for organizations and projects)
  chatChannels: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("team"),      // Organization channel  
      v.literal("project")    // Project channel
    ),
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")), // null for organization channels
    createdBy: v.string(),    // Clerk user ID
    isPrivate: v.boolean(),   // whether the channel is private
    allowedUsers: v.optional(v.array(v.string())), // only for private channels
    isDefault: v.boolean(),   // whether this is the default channel (e.g. "General")
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_type_and_team", ["type", "teamId"])
    .index("by_type_and_project", ["type", "projectId"])
    .index("by_created_by", ["createdBy"]),

  // Messages in channels
  chatMessages: defineTable({
    content: v.string(),
    channelId: v.id("chatChannels"),
    authorId: v.string(),    // Clerk user ID
    teamId: v.id("teams"),   // for faster access and permissions
    projectId: v.optional(v.id("projects")), // for project channels
    replyToId: v.optional(v.id("chatMessages")), // replies to messages
    isEdited: v.boolean(),
    editedAt: v.optional(v.number()),
    messageType: v.union(
      v.literal("text"),
      v.literal("file"),
      v.literal("system")    // system messages e.g. "User joined"
    ),
    fileUrl: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileId: v.optional(v.id("files")),
  })
    .index("by_channel", ["channelId"])
    .index("by_author", ["authorId"])
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_reply_to", ["replyToId"]),

  // Channel membership
  chatChannelMembers: defineTable({
    channelId: v.id("chatChannels"),
    userId: v.string(),      // Clerk user ID
    joinedAt: v.number(),
    role: v.union(
      v.literal("admin"),
      v.literal("member")
    ),
    lastReadAt: v.optional(v.number()), // for marking unread messages
  })
    .index("by_channel", ["channelId"])
    .index("by_user", ["userId"])
    .index("by_channel_and_user", ["channelId", "userId"]),

  // Team members (only admin/member - internal team)
  teamMembers: defineTable({
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    clerkOrgId: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("member"),
      v.literal("customer") // ✅ temporarily restored for compatibility
    ),
    permissions: v.array(v.string()),
    projectIds: v.optional(v.array(v.id("projects"))), // ✅ temporarily restored for compatibility
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_team_and_user", ["teamId", "clerkUserId"])
    .index("by_user", ["clerkUserId"])
    .index("by_team", ["teamId"]),

  // Team invitations (synchronized with Clerk)
  invitations: defineTable({
    clerkInvitationId: v.string(),
    teamId: v.id("teams"),
    email: v.string(),
    role: v.string(), // 'admin', 'member'
    status: v.string(), // 'pending', 'accepted', 'revoked'
    invitedBy: v.string(), // Clerk user ID
  })
    .index("by_clerk_invitation_id", ["clerkInvitationId"])
    .index("by_team", ["teamId"]),

  // Temporary customer invitations (to specific projects)
  pendingCustomerInvitations: defineTable({
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

  // Customers - 1 customer = 1 project (99% of cases)
  // For multi-project access: add separate record per project
  customers: defineTable({
    email: v.string(),
    clerkUserId: v.optional(v.string()), // After registration/invitation
    clerkOrgId: v.string(),
    projectId: v.id("projects"),         // ✅ 1-to-1 relationship  
    teamId: v.id("teams"),
    invitedBy: v.string(),
    status: v.union(
      v.literal("invited"),              // invited, waiting for acceptance
      v.literal("active"),               // active access to project
      v.literal("inactive")              // access suspended
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

  aiSettings: defineTable({
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    isEnabled: v.boolean(),
    indexingEnabled: v.optional(v.boolean()),
    lastAutoIndexAt: v.optional(v.number()),
    createdBy: v.string(),
    enabledAt: v.optional(v.number()),
    disabledAt: v.optional(v.number()),
  }).index("by_project", ["projectId"]),

  // Users
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"]),

  projectEmbeddings: defineTable({
    projectId: v.id("projects"),
    embedding: v.array(v.float64()),
    text: v.string(),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["projectId"],
  }),
    
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
    priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
    )),
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
    sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    assignedTo: v.optional(v.string()), // Clerk user ID
    updatedAt: v.optional(v.number()),
  })
  .index("by_project", ["projectId"])
  .index("by_section", ["sectionId"])
  .index("by_status", ["realizationStatus"]),

  // Activity log (Changelog)
  activityLog: defineTable({
    teamId: v.id("teams"),
    projectId: v.optional(v.id("projects")),
    taskId: v.optional(v.id("tasks")), // Task-specific activity
    userId: v.string(), // Clerk User ID
    actionType: v.string(), // e.g. "task.create", "task.update", "task.status_change", "file.upload", "comment.add"
    details: v.any(), // e.g. { taskTitle: "...", fromStatus: "...", toStatus: "..." }
    entityId: v.string(), // ID of related object (e.g. taskId)
    entityType: v.optional(v.string()), // Type of entity (e.g. "task", "file", "comment")
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_task", ["taskId"])
    .index("by_entity", ["entityId", "entityType"]),

  // Surveys
  surveys: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    createdBy: v.string(), // Clerk user ID
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("closed")
    ),
    isRequired: v.boolean(), // whether the survey is mandatory
    allowMultipleResponses: v.boolean(), // whether it can be filled multiple times
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    targetAudience: v.union(
      v.literal("all_customers"), // all project customers
      v.literal("specific_customers"), // specific customers
      v.literal("team_members") // team members
    ),
    targetCustomerIds: v.optional(v.array(v.string())), // specific customers (Clerk user IDs)
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"]),

  // Survey questions
  surveyQuestions: defineTable({
    surveyId: v.id("surveys"),
    questionText: v.string(),
    questionType: v.union(
      v.literal("text_short"), // short text
      v.literal("text_long"), // long text
      v.literal("multiple_choice"), // multiple choice
      v.literal("single_choice"), // single choice
      v.literal("rating"), // rating scale
      v.literal("yes_no"), // yes/no
      v.literal("number"), // number
      v.literal("file") // file upload
    ),
    options: v.optional(v.array(v.string())), // options for multiple/single choice
    isRequired: v.boolean(),
    order: v.number(), // question order
    ratingScale: v.optional(v.object({
      min: v.number(),
      max: v.number(),
      minLabel: v.optional(v.string()),
      maxLabel: v.optional(v.string())
    })), // for rating type
  })
    .index("by_survey", ["surveyId"])
    .index("by_order", ["surveyId", "order"]),

  // Survey responses
  surveyResponses: defineTable({
    surveyId: v.id("surveys"),
    respondentId: v.string(), // Clerk user ID
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    isComplete: v.boolean(),
    submittedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      timeSpent: v.optional(v.number()) // time in seconds
    })),
  })
    .index("by_survey", ["surveyId"])
    .index("by_respondent", ["respondentId"])
    .index("by_project", ["projectId"])
    .index("by_survey_and_respondent", ["surveyId", "respondentId"]),

  // Answers to specific questions
  surveyAnswers: defineTable({
    responseId: v.id("surveyResponses"),
    questionId: v.id("surveyQuestions"),
    surveyId: v.id("surveys"),
    answerType: v.union(
      v.literal("text"),
      v.literal("choice"),
      v.literal("rating"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("file")
    ),
    textAnswer: v.optional(v.string()),
    choiceAnswers: v.optional(v.array(v.string())), // for multiple choice
    ratingAnswer: v.optional(v.number()),
    numberAnswer: v.optional(v.number()),
    booleanAnswer: v.optional(v.boolean()),
    fileAnswer: v.optional(v.object({
      fileId: v.id("files"),
      fileName: v.string(),
      fileSize: v.number(),
      fileType: v.string()
    })),
  })
    .index("by_response", ["responseId"])
    .index("by_question", ["questionId"])
    .index("by_survey", ["surveyId"]),

  

  // Contacts/Address Book
  contacts: defineTable({
    name: v.string(),
    companyName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    type: v.union(
      v.literal("contractor"), // wykonawca
      v.literal("supplier"),   // dostawca
      v.literal("subcontractor"), // podwykonawca
      v.literal("other")       // inne
    ),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    isActive: v.boolean(),
    website: v.optional(v.string()),
    taxId: v.optional(v.string()), // NIP/VAT ID
  })
    .index("by_team", ["teamId"])
    .index("by_type", ["type"])
    .index("by_created_by", ["createdBy"])
    .index("by_company_name", ["companyName"]),

  // Contact assignments to projects
  projectContacts: defineTable({
    projectId: v.id("projects"),
    contactId: v.id("contacts"),
    teamId: v.id("teams"),
    role: v.optional(v.string()), // rola w projekcie np. "główny wykonawca"
    assignedBy: v.string(), // Clerk user ID
    assignedAt: v.number(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_contact", ["contactId"])
    .index("by_team", ["teamId"])
    .index("by_project_and_contact", ["projectId", "contactId"]),

  // Project Notes
  notes: defineTable({
    title: v.string(),
    content: v.string(),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(), // Clerk user ID
    createdAt: v.number(),
    updatedAt: v.number(),
    isArchived: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_created_by", ["createdBy"]),

  // AI Token Usage Tracking
  aiTokenUsage: defineTable({
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    model: v.string(),
    requestType: v.union(
      v.literal("chat"), 
      v.literal("embedding"), 
      v.literal("other")
    ),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    contextSize: v.optional(v.number()),
    mode: v.optional(v.string()),
    estimatedCostCents: v.optional(v.number()),
    responseTimeMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_user", ["userClerkId"])
    .index("by_thread", ["threadId"]),

  // Product Library
  productLibrary: defineTable({
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
    createdBy: v.string(), // Clerk user ID
    isActive: v.boolean(),
  })
    .index("by_team", ["teamId"])
    .index("by_category", ["category"])
    .index("by_supplier", ["supplier"])
    .index("by_brand", ["brand"])
    .index("by_created_by", ["createdBy"]),

  // AI Custom Prompts
  aiCustomPrompts: defineTable({
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    customPrompt: v.string(), // Custom system prompt text
    createdBy: v.string(), // Clerk user ID who created the custom prompt
    createdAt: v.number(),
    updatedAt: v.number(),
    isActive: v.boolean(), // Whether this custom prompt is currently being used
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_project_and_active", ["projectId", "isActive"]),

  // AI Chat Threads - conversation sessions
  aiThreads: defineTable({
    threadId: v.string(), // Unique thread identifier
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(), // User who started the thread
    title: v.optional(v.string()), // Optional thread title
    lastMessageAt: v.number(), // Timestamp of last message
    lastResponseId: v.optional(v.string()), // OpenAI Response ID (not currently used)
  })
    .index("by_thread_id", ["threadId"])
    .index("by_project", ["projectId"])
    .index("by_user", ["userClerkId"]),

  // AI Chat Messages - individual messages in threads
  aiMessages: defineTable({
    threadId: v.string(), // Reference to aiThreads
    projectId: v.id("projects"),
    role: v.union(v.literal("user"), v.literal("assistant")), // Message sender
    content: v.string(), // Message content
    tokenUsage: v.optional(v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    })),
    ragContext: v.optional(v.string()), // RAG context used for this message
    metadata: v.optional(
      v.object({
        fileId: v.optional(v.string()),
        fileName: v.optional(v.string()),
        fileType: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        mode: v.optional(v.string()),
      })
    ),
    messageIndex: v.number(), // Order of message in thread (0, 1, 2, ...)
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_index", ["threadId", "messageIndex"]),

  // AI Function Calls - tracks function calls for threading continuity
  aiFunctionCalls: defineTable({
    threadId: v.string(), // Reference to aiThreads
    projectId: v.id("projects"),
    responseId: v.string(), // OpenAI Response ID that generated this call
    callId: v.string(), // OpenAI call_id for the function call
    functionName: v.string(), // Name of the function called
    arguments: v.string(), // JSON stringified arguments
    result: v.optional(v.string()), // JSON stringified result after confirmation
    status: v.union(
      v.literal("pending"), // Waiting for user confirmation
      v.literal("confirmed"), // User confirmed, executed
      v.literal("rejected"), // User rejected
      v.literal("replayed"), // Already replayed in a subsequent message
    ),
    createdAt: v.number(),
    confirmedAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_and_status", ["threadId", "status"])
    .index("by_response_id", ["responseId"]),
});
