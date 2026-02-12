import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Personal workspaces (single-user, lightweight container for projects)
  teams: defineTable({
    name: v.string(),
    ownerUserId: v.optional(v.string()), // Clerk user ID
    clerkOrgId: v.optional(v.string()),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.optional(v.object({ name: v.string(), color: v.string() })),
      done: v.object({ name: v.string(), color: v.string() }),
    })),
    // DEPRECATED: billing fields moved to users table (kept for backward compat during migration)
    stripeCustomerId: v.optional(v.string()),
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
    subscriptionId: v.optional(v.string()),
    subscriptionPlan: v.optional(v.union(
      v.literal("free"),
      v.literal("basic"),
      v.literal("ai"),
      v.literal("ai_scale"),
      v.literal("pro"),
      v.literal("enterprise")
    )),
    subscriptionPriceId: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    subscriptionLimits: v.optional(v.object({
      id: v.string(),
      name: v.string(),
      maxProjects: v.number(),
      maxTeamMembers: v.number(),
      maxStorageGB: v.number(),
      hasAdvancedFeatures: v.boolean(),
      hasAIFeatures: v.optional(v.boolean()),
      price: v.number(),
      aiMonthlyTokens: v.optional(v.number()),
      aiMonthlySpendLimitCents: v.optional(v.number()),
      aiImageGenerationsLimit: v.optional(v.number()),
    })),
    aiTokens: v.optional(v.number()),
    timezone: v.optional(v.string()),
  })
    .index("by_owner", ["ownerUserId"])
    .index("by_slug", ["slug"])
    .index("by_createdBy", ["createdBy"]),

  // Assistants (stored in the projects table)
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
    location: v.optional(v.string()),
    customer: v.optional(v.string()),

    createdBy: v.string(), // Clerk user ID
    assignedTo: v.array(v.string()), // Array of Clerk user IDs
    taskStatusSettings: v.optional(v.object({
      todo: v.object({ name: v.string(), color: v.string() }),
      in_progress: v.object({ name: v.string(), color: v.string() }),
      review: v.optional(v.object({ name: v.string(), color: v.string() })),
      done: v.object({ name: v.string(), color: v.string() }),
    })),
    // Custom AI assistant prompt override
    customAiPrompt: v.optional(v.string()),
    assistantPreset: v.optional(v.union(
      v.literal("custom"),
      v.literal("gymbro"),
      v.literal("martin"),
      v.literal("monk"),
      v.literal("marcus"),
      v.literal("startup"),
    )),
    assistantOnboarding: v.optional(v.object({
      status: v.union(v.literal("pending"), v.literal("completed")),
      lastUpdated: v.optional(v.number()),
    })),
    imageUrl: v.optional(v.string()), // Project avatar image
    // Legacy assistant fields (kept for compatibility with existing data)
    systemPrompt: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    // Messaging bot configuration (each project can have its own bot)
    telegramBotUsername: v.optional(v.string()), // Telegram bot username (without @)
    telegramBotToken: v.optional(v.string()), // Telegram bot token from @BotFather
    telegramWebhookSecret: v.optional(v.string()), // Telegram webhook secret (per-bot)
    whatsappNumber: v.optional(v.string()), // WhatsApp business number
    // Per-project AI SOUL - the assistant's personality and instructions
    soul: v.optional(v.string()), // Full SOUL content for this assistant
  })
    .index("by_team", ["teamId"])
    .index("by_team_and_slug", ["teamId", "slug"])
    .index("by_project_id", ["projectId"])
    .index("by_status", ["status"])
    .index("by_created_by", ["createdBy"])
    .index("by_telegram_webhook_secret", ["telegramWebhookSecret"]),

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
    startDate: v.optional(v.number()), // Unix timestamp (UTC)
    endDate: v.optional(v.number()), // Unix timestamp (UTC)
    cost: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())), // Added to match existing data
    link: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"])
    .index("by_status", ["status"])
    .index("by_assigned_to", ["assignedTo"]),

  // Habits in projects
  habits: defineTable({
    name: v.optional(v.string()),
    // Legacy fields for older habit entries
    title: v.optional(v.string()),
    order: v.optional(v.number()),
    targetCount: v.optional(v.number()),
    description: v.optional(v.string()),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    createdBy: v.string(),
    // New professional habit fields
    habitType: v.optional(v.union(
      v.literal("workout"),
      v.literal("cardio"),
      v.literal("nutrition"),
      v.literal("custom")
    )),
    scheduleDays: v.optional(v.array(v.string())), // ["mon", "wed", "fri"]
    targetValue: v.optional(v.number()),
    unit: v.optional(v.string()),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"))),
    reminderTime: v.optional(v.string()), // Local time (HH:mm)
    reminderPlan: v.optional(
      v.array(
        v.object({
          date: v.string(), // YYYY-MM-DD (project calendar date)
          reminderTime: v.string(), // Local time (HH:mm)
          minStartTime: v.optional(v.string()), // Local time (HH:mm), optional "not earlier than"
          phaseLabel: v.optional(v.string()),
        })
      )
    ),
    scheduledReminderId: v.optional(v.string()),
    nextReminderAt: v.optional(v.number()), // Unix timestamp (ms) for currently scheduled reminder
    isActive: v.boolean(),
    source: v.optional(v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("gymbro_onboarding"),
    )),
  })
    .index("by_project", ["projectId"])
    .index("by_team", ["teamId"]),

  // Habit completions (daily tracking)
  habitCompletions: defineTable({
    habitId: v.id("habits"),
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    date: v.string(), // YYYY-MM-DD (team timezone)
    completedAt: v.number(),
    completedBy: v.optional(v.string()),
    value: v.optional(v.number()), // Logged numeric value (kcal, g, L, steps, kg)
  })
    .index("by_habit_and_date", ["habitId", "date"])
    .index("by_project_and_date", ["projectId", "date"]),

  // Diary / Journal entries (per-project daily notes)
  diaryEntries: defineTable({
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    date: v.string(), // YYYY-MM-DD (team timezone)
    content: v.string(), // Markdown text of the diary entry
    source: v.union(v.literal("user"), v.literal("assistant")),
    createdBy: v.string(), // Clerk user ID
    updatedAt: v.number(),
    mood: v.optional(v.string()), // e.g., "great", "good", "neutral", "bad", "terrible"
  })
    .index("by_project_and_date", ["projectId", "date"])
    .index("by_project", ["projectId"]),

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

  // Workspace members (single-user, kept for permission checks)
  teamMembers: defineTable({
    teamId: v.id("teams"),
    clerkUserId: v.string(),
    clerkOrgId: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("member")),
    permissions: v.array(v.string()),
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_team_and_user", ["teamId", "clerkUserId"])
    .index("by_user", ["clerkUserId"])
    .index("by_team", ["teamId"]),

  // Users
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // User onboarding / personalization (shared across assistants)
    preferredName: v.optional(v.union(v.string(), v.null())), // "Jak mam się do Ciebie zwracać?"
    preferredLanguage: v.optional(v.union(v.string(), v.null())), // e.g. "pl", "en", "Polish", "English"
    age: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(v.union(
      v.literal("female"),
      v.literal("male"),
      v.literal("nonbinary"),
      v.literal("prefer_not_to_say"),
      v.literal("other"),
    )),
    genderOther: v.optional(v.union(v.string(), v.null())),
    workMode: v.optional(v.union(
      v.literal("office"),
      v.literal("home"),
      v.literal("hybrid"),
      v.literal("other"),
    )),
    workModeOther: v.optional(v.union(v.string(), v.null())),
    onboardingCompletedAt: v.optional(v.number()),
    // Subscription & billing (migrated from teams)
    stripeCustomerId: v.optional(v.string()),
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
    subscriptionId: v.optional(v.string()),
    subscriptionPlan: v.optional(v.union(
      v.literal("free"),
      v.literal("basic"),
      v.literal("ai"),
      v.literal("ai_scale"),
      v.literal("pro"),
      v.literal("enterprise")
    )),
    subscriptionPriceId: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    subscriptionLimits: v.optional(v.object({
      id: v.string(),
      name: v.string(),
      maxProjects: v.number(),
      maxTeamMembers: v.number(),
      maxStorageGB: v.number(),
      hasAdvancedFeatures: v.boolean(),
      hasAIFeatures: v.optional(v.boolean()),
      price: v.number(),
      aiMonthlyTokens: v.optional(v.number()),
      aiMonthlySpendLimitCents: v.optional(v.number()),
      aiImageGenerationsLimit: v.optional(v.number()),
    })),
    aiTokens: v.optional(v.number()),
    timezone: v.optional(v.string()),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"])
    .index("by_stripe_customer_id", ["stripeCustomerId"]),

  // AI Token Usage Tracking
  aiTokenUsage: defineTable({
    projectId: v.optional(v.id("projects")),
    teamId: v.id("teams"),
    userClerkId: v.string(),
    threadId: v.optional(v.string()),
    model: v.string(),
    feature: v.optional(
      v.union(
        v.literal("assistant"),
        v.literal("visualizations"),
        v.literal("other")
      )
    ),
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

  // AI Chat Threads - conversation sessions
  aiThreads: defineTable({
    threadId: v.string(), // Unique thread identifier
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(), // User who started the thread
    title: v.optional(v.string()), // Optional thread title
    lastMessageAt: v.number(), // Timestamp of last message
    messageCount: v.optional(v.number()), // Total messages in thread
    lastMessagePreview: v.optional(v.string()),
    lastMessageRole: v.optional(v.union(v.literal("user"), v.literal("assistant"))),
    lastResponseId: v.optional(v.string()), // OpenAI Response ID (not currently used)
    agentThreadId: v.optional(v.string()), // Convex Agent Thread ID
    abortedAt: v.optional(v.number()), // Timestamp when user requested abort
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

  // AI System Files - stores SOUL, AGENTS.md, etc.
  aiSystemFiles: defineTable({
    slug: v.string(), // "soul", "agents", "long_term_memory"
    content: v.string(),
    lastUpdated: v.number(),
  })
    .index("by_slug", ["slug"]),

  // AI Memories - daily logs and summaries
  aiMemories: defineTable({
    date: v.string(), // "YYYY-MM-DD"
    type: v.union(v.literal("daily"), v.literal("summary")),
    content: v.string(), // Markdown log
    threadIds: v.array(v.string()), // Related conversation threads
    projectId: v.optional(v.id("projects")),
  })
    .index("by_date", ["date"])
    .index("by_type", ["type"]),

  // AI Long-Term Memory - per assistant/project
  aiLongTermMemories: defineTable({
    projectId: v.id("projects"),
    content: v.string(), // Markdown bullet list of stable facts/preferences
    threadIds: v.array(v.string()), // Threads that contributed to memory
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"]),




  // Messaging Platform Channels - user connections to Telegram/WhatsApp
  messagingChannels: defineTable({
    teamId: v.id("teams"),
    projectId: v.id("projects"),
    platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    externalUserId: v.string(), // Telegram chat ID or WhatsApp phone number
    userClerkId: v.optional(v.string()), // Optional - may not be linked to Clerk user
    threadId: v.optional(v.string()), // AI thread ID for this channel
    isActive: v.boolean(),
    lastMessageAt: v.optional(v.number()),
    metadata: v.optional(v.any()), // Platform-specific data (username, name, etc.)
  })
    .index("by_team", ["teamId"])
    .index("by_project", ["projectId"])
    .index("by_platform_and_external_id", ["platform", "externalUserId"])
    .index("by_user", ["userClerkId"]),

  // Messaging Pairing Tokens - for auto-connect SaaS flow
  messagingPairingTokens: defineTable({
    token: v.string(), // Unique pairing token
    projectId: v.id("projects"),
    teamId: v.id("teams"),
    userClerkId: v.string(), // VibePlanner user who created token
    platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    expiresAt: v.number(), // Token expiration timestamp
    usedAt: v.optional(v.number()), // When token was used
    usedByExternalId: v.optional(v.string()), // Telegram chatId or WhatsApp phone who used it
  })
    .index("by_token", ["token"])
    .index("by_project_and_platform", ["projectId", "platform"])
    .index("by_user", ["userClerkId"]),

  // Pairing requests (pending approval) - like MoltBot
  messagingPairingRequests: defineTable({
    projectId: v.id("projects"),
    platform: v.union(v.literal("telegram"), v.literal("whatsapp")),
    externalUserId: v.string(), // Telegram chatId or WhatsApp phone
    pairingCode: v.string(), // 8-char code for approval
    metadata: v.optional(v.any()), // username, firstName, lastName, etc.
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()), // When approved/rejected
    resolvedBy: v.optional(v.string()), // Clerk user ID who approved/rejected
  })
    .index("by_project", ["projectId"])
    .index("by_code", ["pairingCode"])
    .index("by_external_id", ["platform", "externalUserId"]),
});
