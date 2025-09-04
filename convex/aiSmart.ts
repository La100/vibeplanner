"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Id } from "./_generated/dataModel";
// import { rag } from "./rag"; // Temporarily disabled

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ====== SMART SINGLE-PROJECT AI SYSTEM ======

/**
 * Inteligentny system dla pojedynczego projektu:
 * - Małe projekty (<100 elementów) → Full Context Window
 * - Duże projekty (>100 elementów) → Smart Hybrid
 */
async function buildSmartProjectContext(
  ctx: any, 
  projectId: Id<"projects">, 
  userQuery: string
): Promise<{systemPrompt: string, contextData: string, useRAG: boolean}> {
  
  const project = await ctx.runQuery(api.projects.getProject, { projectId });
  if (!project) {
    throw new Error("Project not found");
  }

  // Pobierz podstawowe statystyki projektu
  let tasks: any[] = [];
  let notes: any[] = [];
  let shoppingItems: any[] = [];
  let shoppingSections: any[] = [];
  let surveys: any[] = [];
  let teamMembers: any[] = [];

  try {
    tasks = await ctx.runQuery(api.tasks.listProjectTasks, { projectId }) || [];
    notes = await ctx.runQuery(internal.notes.getNotesForIndexing, { projectId }) || [];
    shoppingItems = await ctx.runQuery(api.shopping.listShoppingListItems, { projectId }) || [];
    shoppingSections = await ctx.runQuery(api.shopping.listShoppingListSections, { projectId }) || [];
    surveys = await ctx.runQuery(api.surveys.getSurveysByProject, { projectId }) || [];
    teamMembers = await ctx.runQuery(api.teams.getProjectMembers, { 
      teamId: project.teamId, 
      projectId: projectId 
    }) || [];
  } catch (error) {
    console.warn("Error fetching project data:", error);
  }

  const totalItems = tasks.length + notes.length + shoppingItems.length + surveys.length;
  const useRAG = totalItems > 100; // Próg dla przejścia na RAG

  let ragResults: any[] = [];
  let contextTasks = tasks;
  let contextNotes = notes;

  if (useRAG) {
    // Duży projekt → używaj RAG + recent data
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // Context Window: tylko ostatnie 30 dni
    contextTasks = tasks.filter(task => 
      task._creationTime > thirtyDaysAgo || 
      (task.updatedAt && task.updatedAt > thirtyDaysAgo) ||
      task.priority === "urgent" || task.priority === "high"
    );
    
    contextNotes = notes.filter(note => 
      note.createdAt > thirtyDaysAgo || note.updatedAt > thirtyDaysAgo
    );

    // RAG Search: wyszukaj w starszych danych
    try {
      // TODO: Implement RAG search when API is clarified
      // For now, just use empty results for large projects
      ragResults = [];
      console.log("RAG search temporarily disabled - using time-based filtering only");
    } catch (error) {
      console.warn("RAG search failed:", error);
    }
  }
  // Małe projekty używają pełnego context window (jak wcześniej)

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const contextData = `# ${project.name.toUpperCase()} - PROJECT CONTEXT
${useRAG ? '## 🧠 SMART MODE: Recent Data + Historical Search' : '## 📋 FULL MODE: Complete Project Data'}
## Current Date: ${currentDate}

## PROJECT OVERVIEW
- **Name**: "${project.name}"
- **Status**: ${project.status}
- **Customer**: ${project.customer || 'Not specified'}
- **Budget**: ${project.budget ? `${project.budget} ${project.currency || 'USD'}` : 'Not specified'}
- **Description**: ${project.description || 'No description provided'}
- **Summary**: ${totalItems} total items (${tasks.length} tasks, ${notes.length} notes, ${shoppingItems.length} shopping items)

## ${useRAG ? 'RECENT & HIGH PRIORITY' : 'ALL'} TASKS (${contextTasks.length} tasks)
${contextTasks.length > 0 ? contextTasks.map((task: any) => `
### "${task.title}" [${task.status.toUpperCase()}] ${task.priority ? `[${task.priority.toUpperCase()}]` : ''}
- **Assigned**: ${task.assignedToName || 'Unassigned'}
- **Due**: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
- **Cost**: ${task.cost ? `$${task.cost}` : 'Not specified'}
- **Description**: ${task.description || 'No description'}
${task.content ? `- **Details**: ${task.content.replace(/<[^>]*>/g, '').substring(0, 300)}` : ''}
`).join('\n') : 'No tasks found.'}

## ${useRAG ? 'RECENT' : 'ALL'} NOTES (${contextNotes.length} notes)
${contextNotes.length > 0 ? contextNotes.map((note: any) => `
### "${note.title}"
- **Date**: ${new Date(note.createdAt).toLocaleDateString()}
- **Content**: ${note.content ? note.content.replace(/<[^>]*>/g, '').substring(0, 400) : 'No content'}
`).join('\n') : 'No notes found.'}

${!useRAG ? `## SHOPPING LIST SECTIONS (${shoppingSections.length} sections)
${shoppingSections.length > 0 ? shoppingSections.map((section: any) => `
### SECTION: "${section.name}"
- **Order**: ${section.order}
- **Created by**: ${section.createdBy}
`).join('\n') : 'No shopping sections found.'}

## SHOPPING LIST ITEMS (${shoppingItems.length} items)
${shoppingItems.length > 0 ? shoppingItems.map((item: any) => {
  const sectionName = item.sectionId ? shoppingSections.find((s: any) => s._id === item.sectionId)?.name || 'Unknown Section' : 'No Section';
  return `
### "${item.name}" [${item.realizationStatus}]
- **Section**: ${sectionName}
- **Category**: ${item.category || 'Uncategorized'}
- **Quantity**: ${item.quantity}
- **Supplier**: ${item.supplier || 'Not specified'}
- **Price**: ${item.totalPrice ? `$${item.totalPrice}` : 'Not specified'}
- **Notes**: ${item.notes || 'No notes'}
`;
}).join('\n') : 'No shopping items found.'}

## SURVEYS (${surveys.length} surveys)
${surveys.length > 0 ? surveys.map((survey: any) => `
### "${survey.title}" [${survey.status}]
- **Target**: ${survey.targetAudience}
- **Required**: ${survey.isRequired ? 'Yes' : 'No'}
- **Description**: ${survey.description || 'No description'}
`).join('\n') : 'No surveys found.'}` : ''}

## TEAM MEMBERS (${teamMembers.length} members)
${teamMembers.length > 0 ? teamMembers.map((member: any) => `
### ${member.name || member.email || 'Unknown'} [${member.role.toUpperCase()}]
- **Email**: ${member.email || 'No email'}
- **User ID**: ${member.clerkUserId}
- **Role**: ${member.role}
- **Joined**: ${new Date(member.joinedAt).toLocaleDateString()}
- **Active**: ${member.isActive ? 'Yes' : 'No'}
- **Source**: ${member.source || 'teamMember'}
${member.projectIds ? `- **Project Access**: ${member.projectIds.length} projects` : ''}
`).join('\n') : 'No team members found.'}

${useRAG && ragResults.length > 0 ? `## 🔍 RELEVANT HISTORICAL DATA (${ragResults.length} items found)
${ragResults.map((result: any, index: number) => `
### RELEVANT ${result.type?.toUpperCase() || 'ITEM'} ${index + 1} (${(result.score * 100).toFixed(1)}% match)
${result.content.substring(0, 300)}...
`).join('\n')}` : ''}

${useRAG ? `
## 💡 CONTEXT EXPLANATION
This project has ${totalItems} total items, so I'm using SMART MODE:
- **Fresh Data**: Recent 30 days + high priority items (${contextTasks.length + contextNotes.length} items)
- **Historical Data**: AI-searched relevant past content (${ragResults.length} items)
- **Excluded**: ${totalItems - (contextTasks.length + contextNotes.length)} older items (searchable on demand)
` : `
## 💡 CONTEXT EXPLANATION  
This project has ${totalItems} items, so I'm using FULL MODE:
- **Complete Data**: All tasks, notes, shopping items, and surveys included
- **Real-time**: Every piece of information is current and complete
`}`;

  const systemPrompt = `You are an expert AI assistant for the VibePlanner interior design project "${project.name}".

${useRAG ? 
`SMART MODE ACTIVE: You have access to recent data (last 30 days + priorities) plus AI-searched historical content relevant to the user's query.` 
: 
`FULL MODE ACTIVE: You have complete access to all project data.`}

IMPORTANT INTERACTION GUIDELINES:
- Start conversations naturally - respond to greetings warmly without overwhelming analysis
- Wait for specific questions before providing detailed project analysis
- When asked about project status, focus on what the user specifically wants to know
- Be conversational and helpful, not robotic
- Only analyze data when explicitly asked or when it's clearly relevant to the question
- For simple greetings like "hi", "hello", introduce yourself briefly and ask how you can help

## SHOPPING LIST STRUCTURE:
IMPORTANT: Shopping lists have two organizational levels:

**SECTIONS** (main groupings):
- Organizational sections like "Kuchnia" (Kitchen), "Łazienka" (Bathroom), etc.
- Used to group items by room/area
- Use "section" field with section NAME (system will auto-convert to ID)
- PREFERRED for room-based organization

**CATEGORIES** (item types):  
- Item categories like "Elektronika" (Electronics), "Meble" (Furniture), etc.
- Used to classify what type of item it is
- Use "category" field (free text) when creating shopping items
- SECONDARY classification

When user says "add to shopping list to kuchnia" they mean SECTION "kuchnia", not category!
Users work with section NAMES, system handles IDs automatically.

CONTENT MANAGEMENT CAPABILITIES:
You can create AND edit various types of project content when requested:

1. TASKS - Project tasks and todos
2. NOTES - Project notes and documentation  
3. SHOPPING ITEMS - Items for shopping lists (with sections and categories)
4. SURVEYS - Customer/team surveys

## TEAM MEMBER MANAGEMENT:
When assigning tasks or referencing team members, use the information from the TEAM MEMBERS section above:

- **Admin/Member roles**: Can access all project data and be assigned any tasks
- **Customer roles**: May have limited project access, check their projectIds
- **For task assignments**: Use the member's clerkUserId as "assignedTo" value
- **For mentions**: Use member's name or email to reference them naturally
- **Active status**: Only assign tasks to active team members (isActive: true)

Available team members for assignment:
${teamMembers.filter((m: any) => m.isActive).map((m: any) => `- ${m.name || m.email} (${m.role}) - ID: ${m.clerkUserId}`).join('\n')}

## CREATION vs EDITING:
- **CREATE** when user asks to "add", "create", "make new"
- **EDIT** when user asks to "update", "modify", "change", "edit existing"
- **FIND FIRST** - always identify which item to edit by searching project data

ALWAYS ask clarifying questions if important details are missing!

## TASK CREATION:
When user asks to create/add a task:
[CREATE_TASK]
{
  "title": "Task title",
  "description": "Task description", 
  "priority": "low|medium|high|urgent",
  "status": "todo|in_progress|review|done",
  "assignedTo": "user_id_if_mentioned",
  "dueDate": "YYYY-MM-DD if mentioned",
  "cost": number_if_mentioned,
  "tags": ["tag1", "tag2"]
}
[/CREATE_TASK]

## NOTE CREATION:
When user asks to create/add a note:
[CREATE_NOTE]
{
  "title": "Note title",
  "content": "Note content/body text"
}
[/CREATE_NOTE]

## SHOPPING ITEM CREATION:
When user asks to add to shopping list:
[CREATE_SHOPPING_ITEM]
{
  "name": "Item name",
  "notes": "Additional notes about item",
  "quantity": number,
  "unitPrice": number_if_mentioned,
  "priority": "low|medium|high|urgent", 
  "category": "category_if_mentioned (free text like 'Elektronika', 'Meble')",
  "supplier": "supplier_if_mentioned",
  "buyBefore": "YYYY-MM-DD if urgent",
  "section": "section_name_like_kuchnia (PREFERRED for room organization!)"
}
[/CREATE_SHOPPING_ITEM]

IMPORTANT: When user says "add to kuchnia", use "section": "kuchnia" - system will handle ID conversion!

## SURVEY CREATION:
When user asks to create a survey:
[CREATE_SURVEY]
{
  "title": "Survey title",
  "description": "Survey description",
  "isRequired": true/false,
  "targetAudience": "all_customers|specific_customers|team_members",
  "questions": ["Question 1", "Question 2", "Question 3"]
}
[/CREATE_SURVEY]

## EDITING EXISTING CONTENT:

### TASK EDITING:
When user asks to edit/update/modify a task:
[EDIT_TASK]
{
  "searchCriteria": "task title or description to find",
  "updates": {
    "title": "new title if changed",
    "description": "new description if changed",
    "priority": "new priority if changed",
    "status": "new status if changed",
    "assignedTo": "new assignee if changed",
    "dueDate": "new due date if changed",
    "cost": new_cost_if_changed
  }
}
[/EDIT_TASK]

### NOTE EDITING:
When user asks to edit/update a note:
[EDIT_NOTE]
{
  "searchCriteria": "note title to find",
  "updates": {
    "title": "new title if changed",
    "content": "new content if changed"
  }
}
[/EDIT_NOTE]

### SHOPPING ITEM EDITING:
When user asks to edit shopping list item:
[EDIT_SHOPPING_ITEM]
{
  "searchCriteria": "item name to find",
  "updates": {
    "name": "new name if changed",
    "quantity": new_quantity_if_changed,
    "priority": "new priority if changed",
    "notes": "new notes if changed",
    "category": "new category if changed",
    "supplier": "new supplier if changed",
    "section": "new_section_name (when moving to different room/section)"
  }
}
[/EDIT_SHOPPING_ITEM]

### SURVEY EDITING:
When user asks to edit a survey:
[EDIT_SURVEY]
{
  "searchCriteria": "survey title to find",
  "updates": {
    "title": "new title if changed",
    "description": "new description if changed",
    "questions": ["new questions if changed"]
  }
}
[/EDIT_SURVEY]

ALWAYS ask clarifying questions when details are missing:
- "What specific details should I include?"
- "Who should this be assigned to?" 
- "When do you need this completed?"
- "What's the priority level?"
- "Which item exactly do you want to edit?"
- "What changes should I make?"

Provide helpful insights for interior design project management when asked, always referencing specific data from the context when relevant.`;

  return { systemPrompt, contextData, useRAG };
}

// ====== TASK CREATION HELPER FUNCTIONS ======

/**
 * Extract task creation blocks from AI response
 */
// Enhanced function to extract all types of creation and edit blocks from AI response
function extractCreationBlocks(response: string): {
  tasks: any[];
  notes: any[];
  shoppingItems: any[];
  surveys: any[];
  editTasks: any[];
  editNotes: any[];
  editShoppingItems: any[];
  editSurveys: any[];
} {
  const result = { 
    tasks: [] as any[], 
    notes: [] as any[], 
    shoppingItems: [] as any[], 
    surveys: [] as any[],
    editTasks: [] as any[],
    editNotes: [] as any[],
    editShoppingItems: [] as any[],
    editSurveys: [] as any[]
  };

  // Extract TASK blocks
  const taskRegex = /\[CREATE_TASK\]([\s\S]*?)\[\/CREATE_TASK\]/g;
  let match;
  while ((match = taskRegex.exec(response)) !== null) {
    try {
      const taskData = JSON.parse(match[1].trim());
      if (taskData.title) result.tasks.push(taskData);
    } catch (error) {
      console.warn("Failed to parse task creation block:", match[1]);
    }
  }

  // Extract NOTE blocks
  const noteRegex = /\[CREATE_NOTE\]([\s\S]*?)\[\/CREATE_NOTE\]/g;
  while ((match = noteRegex.exec(response)) !== null) {
    try {
      const noteData = JSON.parse(match[1].trim());
      if (noteData.title) result.notes.push(noteData);
    } catch (error) {
      console.warn("Failed to parse note creation block:", match[1]);
    }
  }

  // Extract SHOPPING_ITEM blocks
  const shoppingRegex = /\[CREATE_SHOPPING_ITEM\]([\s\S]*?)\[\/CREATE_SHOPPING_ITEM\]/g;
  while ((match = shoppingRegex.exec(response)) !== null) {
    try {
      const itemData = JSON.parse(match[1].trim());
      if (itemData.name) result.shoppingItems.push(itemData);
    } catch (error) {
      console.warn("Failed to parse shopping item creation block:", match[1]);
    }
  }

  // Extract SURVEY blocks
  const surveyRegex = /\[CREATE_SURVEY\]([\s\S]*?)\[\/CREATE_SURVEY\]/g;
  while ((match = surveyRegex.exec(response)) !== null) {
    try {
      const surveyData = JSON.parse(match[1].trim());
      if (surveyData.title) result.surveys.push(surveyData);
    } catch (error) {
      console.warn("Failed to parse survey creation block:", match[1]);
    }
  }

  // Extract EDIT blocks
  
  // Extract EDIT_TASK blocks
  const editTaskRegex = /\[EDIT_TASK\]([\s\S]*?)\[\/EDIT_TASK\]/g;
  while ((match = editTaskRegex.exec(response)) !== null) {
    try {
      const editData = JSON.parse(match[1].trim());
      if (editData.searchCriteria) result.editTasks.push(editData);
    } catch (error) {
      console.warn("Failed to parse edit task block:", match[1]);
    }
  }

  // Extract EDIT_NOTE blocks
  const editNoteRegex = /\[EDIT_NOTE\]([\s\S]*?)\[\/EDIT_NOTE\]/g;
  while ((match = editNoteRegex.exec(response)) !== null) {
    try {
      const editData = JSON.parse(match[1].trim());
      if (editData.searchCriteria) result.editNotes.push(editData);
    } catch (error) {
      console.warn("Failed to parse edit note block:", match[1]);
    }
  }

  // Extract EDIT_SHOPPING_ITEM blocks
  const editShoppingRegex = /\[EDIT_SHOPPING_ITEM\]([\s\S]*?)\[\/EDIT_SHOPPING_ITEM\]/g;
  while ((match = editShoppingRegex.exec(response)) !== null) {
    try {
      const editData = JSON.parse(match[1].trim());
      if (editData.searchCriteria) result.editShoppingItems.push(editData);
    } catch (error) {
      console.warn("Failed to parse edit shopping item block:", match[1]);
    }
  }

  // Extract EDIT_SURVEY blocks
  const editSurveyRegex = /\[EDIT_SURVEY\]([\s\S]*?)\[\/EDIT_SURVEY\]/g;
  while ((match = editSurveyRegex.exec(response)) !== null) {
    try {
      const editData = JSON.parse(match[1].trim());
      if (editData.searchCriteria) result.editSurveys.push(editData);
    } catch (error) {
      console.warn("Failed to parse edit survey block:", match[1]);
    }
  }

  return result;
}

// Legacy function for backward compatibility
function extractTaskCreationBlocks(response: string): any[] {
  return extractCreationBlocks(response).tasks;
}

// Helper function to find content by search criteria
async function findContentBySearch(ctx: any, projectId: string, searchCriteria: string, contentType: 'task' | 'note' | 'shopping' | 'survey'): Promise<any> {
  const searchLower = searchCriteria.toLowerCase();
  
  switch (contentType) {
    case 'task':
      const tasks: any = await ctx.runQuery(api.tasks.listProjectTasks, { projectId });
      return tasks.find((task: any) => 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
      );
      
    case 'note':
      const notes: any = await ctx.runQuery(api.notes.getProjectNotes, { projectId });
      return notes.find((note: any) => 
        note.title.toLowerCase().includes(searchLower) ||
        (note.content && note.content.toLowerCase().includes(searchLower))
      );
      
    case 'shopping':
      const shoppingItems: any = await ctx.runQuery(api.shopping.listShoppingListItems, { projectId });
      return shoppingItems.find((item: any) => 
        item.name.toLowerCase().includes(searchLower) ||
        (item.notes && item.notes.toLowerCase().includes(searchLower))
      );
      
    case 'survey':
      const surveys: any = await ctx.runQuery(api.surveys.getSurveysByProject, { projectId });
      return surveys.find((survey: any) => 
        survey.title.toLowerCase().includes(searchLower) ||
        (survey.description && survey.description.toLowerCase().includes(searchLower))
      );
      
    default:
      return null;
  }
}

// Helper function to find section ID by name
async function findSectionIdByName(ctx: any, projectId: string, sectionName: string): Promise<any> {
  const sections: any = await ctx.runQuery(api.shopping.listShoppingListSections, { projectId });
  const section: any = sections.find((s: any) => s.name.toLowerCase() === sectionName.toLowerCase());
  return section?._id || null;
}

// ====== MAIN SMART CHAT FUNCTION ======

export const chatWithSmartAgent = action({
  args: {
    message: v.string(),
    projectId: v.id("projects"),
    userClerkId: v.string(),
    threadId: v.optional(v.string())
  },
  returns: v.object({
    response: v.string(),
    threadId: v.string(),
    mode: v.string(), // "full" or "smart"
    pendingTasks: v.array(v.any()), // Legacy compatibility
    pendingItems: v.array(v.any()), // New unified system
    tokenUsage: v.optional(v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      totalTokens: v.number(),
      estimatedCostUSD: v.number(),
    })),
  }),
  handler: async (ctx, args): Promise<any> => {
    // 🔒 CHECK SUBSCRIPTION
    const subscriptionCheck: any = await ctx.runQuery(internal.stripe.checkAIFeatureAccess, { 
      projectId: args.projectId 
    });
    
    if (!subscriptionCheck.allowed) {
      throw new Error(subscriptionCheck.message || "🚫 AI features require Pro or Enterprise subscription.");
    }

    // Build smart context based on project size
    const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
    if (!project) {
      throw new Error("Project not found");
    }

    const { systemPrompt, contextData, useRAG } = await buildSmartProjectContext(
      ctx, 
      args.projectId, 
      args.message
    );
    
    // Get team members for user name resolution
    const teamMembers = await ctx.runQuery(api.teams.getProjectMembers, { 
      teamId: project.teamId, 
      projectId: args.projectId 
    }) || [];
    
    // Get or create thread
    let threadId = args.threadId;
    if (!threadId) {
      threadId = `smart_thread_${args.projectId}_${args.userClerkId}_${Date.now()}`;
      
      await ctx.runMutation(internal.ai_database.createThreadInDB, {
        threadId,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });
    }

    // Get conversation history
    const messages = await ctx.runQuery(internal.ai_database.getThreadMessages, { threadId });
    
    // Format messages for Gemini
    const conversationHistory = messages
      .filter((msg: any) => msg.role !== "system")
      .map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }));

    const startTime = Date.now();
    
    try {
      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, 
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
        }
      ];

      // Use smart context (auto-adapts to project size)
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          {
            role: "user",
            parts: [{ text: contextData }]
          },
          ...conversationHistory,
          {
            role: "user", 
            parts: [{ text: args.message }]
          }
        ],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 8000,
          temperature: 0.7,
          safetySettings
        }
      });
      
      let finalResponse = result.text || "";
      
      if (!finalResponse) {
        throw new Error("Empty response from Gemini API");
      }

      // 🛠️ PARSE ALL CREATION REQUESTS FOR CONFIRMATION
      let pendingItems = [];
      const creationBlocks = extractCreationBlocks(finalResponse);
      const taskCreationBlocks = creationBlocks.tasks; // Legacy compatibility
      
      if (taskCreationBlocks.length > 0) {
        console.log("🎯 AI requested task creation for confirmation:", taskCreationBlocks);
        
        for (const taskData of taskCreationBlocks) {
          try {
            // Use the existing generateTaskDetailsFromPrompt system to prepare task
            const timezoneOffsetInMinutes = new Date().getTimezoneOffset();
            const taskDetails: any = await ctx.runAction(api.tasks.generateTaskDetailsFromPrompt, {
              prompt: `Create task: ${taskData.title}. ${taskData.description || ''}. Priority: ${taskData.priority || 'medium'}.`,
              projectId: args.projectId,
              timezoneOffsetInMinutes,
            });

            // Prepare task data for confirmation (don't create yet)
            const preparedTask: any = {
              title: taskDetails.title || taskData.title,
              description: taskDetails.description || taskData.description || "",
              priority: taskDetails.priority || taskData.priority || "medium",
              status: taskDetails.status || taskData.status || "todo",
              tags: taskData.tags || [],
            };

            // Only add optional fields if they have valid values
            if (taskDetails.assignedTo || taskData.assignedTo) {
              preparedTask.assignedTo = taskDetails.assignedTo || taskData.assignedTo;
              // Add user-friendly name for assignment
              const member = teamMembers.find((m: any) => m.clerkUserId === preparedTask.assignedTo);
              if (member) {
                preparedTask.assignedToName = member.name || member.email || 'Unknown User';
              }
            }
            
            if (taskDetails.dateRange?.from) {
              preparedTask.dueDate = taskDetails.dateRange.from;
            } else if (taskData.dueDate) {
              preparedTask.dueDate = taskData.dueDate;
            }
            
            if ((taskDetails.cost && taskDetails.cost > 0) || (taskData.cost && taskData.cost > 0)) {
              preparedTask.cost = taskDetails.cost || taskData.cost;
            }

            pendingItems.push({ type: 'task', data: preparedTask });

          } catch (error) {
            console.error("Failed to prepare task:", error);
            // Still add to pending items but with error indicator
            pendingItems.push({
              type: 'task',
              data: {
                title: taskData.title + " (parsing error)",
                description: taskData.description || "",
                priority: "medium",
                status: "todo",
                tags: [],
                _error: error instanceof Error ? error.message : 'Unknown error'
              }
            });
          }
        }
        
        console.log(`🎯 Prepared ${pendingItems.length} task(s) for confirmation`);
      }

      // Process NOTES creation blocks
      if (creationBlocks.notes.length > 0) {
        console.log("📝 AI requested note creation:", creationBlocks.notes);
        
        for (const noteData of creationBlocks.notes) {
          pendingItems.push({
            type: 'note',
            data: {
              title: noteData.title,
              content: noteData.content || noteData.description || "",
            }
          });
        }
        console.log(`📝 Prepared ${creationBlocks.notes.length} note(s) for confirmation`);
      }

      // Process SHOPPING ITEMS creation blocks  
      if (creationBlocks.shoppingItems.length > 0) {
        console.log("🛒 AI requested shopping item creation:", creationBlocks.shoppingItems);
        
        for (const itemData of creationBlocks.shoppingItems) {
          // Convert section name to section ID if provided
          let sectionId = null;
          let sectionName = null;
          if (itemData.section && typeof itemData.section === 'string' && itemData.section.length > 0) {
            const resolvedSectionId: any = await findSectionIdByName(ctx, args.projectId, itemData.section);
            sectionId = resolvedSectionId;
            if (resolvedSectionId) {
              sectionName = itemData.section; // Keep the original section name for display
            } else {
              console.warn(`Section "${itemData.section}" not found, item will have no section`);
            }
          }

          pendingItems.push({
            type: 'shopping',
            data: {
              name: itemData.name,
              notes: itemData.notes || "",
              quantity: itemData.quantity || 1,
              unitPrice: itemData.unitPrice,
              priority: itemData.priority || "medium",
              category: itemData.category,
              supplier: itemData.supplier,
              buyBefore: itemData.buyBefore,
              realizationStatus: "PLANNED",
              sectionId: sectionId,
              sectionName: sectionName
            }
          });
        }
        console.log(`🛒 Prepared ${creationBlocks.shoppingItems.length} shopping item(s) for confirmation`);
      }

      // Process SURVEYS creation blocks
      if (creationBlocks.surveys.length > 0) {
        console.log("📊 AI requested survey creation:", creationBlocks.surveys);
        
        for (const surveyData of creationBlocks.surveys) {
          pendingItems.push({
            type: 'survey',
            data: {
              title: surveyData.title,
              description: surveyData.description || "",
              isRequired: surveyData.isRequired || false,
              allowMultipleResponses: false,
              targetAudience: surveyData.targetAudience || "all_customers",
              questions: surveyData.questions || []
            }
          });
        }
        console.log(`📊 Prepared ${creationBlocks.surveys.length} survey(s) for confirmation`);
      }

      // Clean response and add confirmation message if any items were created
      if (pendingItems.length > 0) {
        let cleanedResponse = finalResponse;
        
        // Remove all creation blocks from response
        cleanedResponse = cleanedResponse.replace(/\[CREATE_TASK\][\s\S]*?\[\/CREATE_TASK\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[CREATE_NOTE\][\s\S]*?\[\/CREATE_NOTE\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[CREATE_SHOPPING_ITEM\][\s\S]*?\[\/CREATE_SHOPPING_ITEM\]/g, '');
        cleanedResponse = cleanedResponse.replace(/\[CREATE_SURVEY\][\s\S]*?\[\/CREATE_SURVEY\]/g, '');
        
        const itemCounts = {
          tasks: pendingItems.filter(item => item.type === 'task').length,
          notes: pendingItems.filter(item => item.type === 'note').length,
          shopping: pendingItems.filter(item => item.type === 'shopping').length,
          surveys: pendingItems.filter(item => item.type === 'survey').length
        };

        let summaryText = "🤖 **Chcę utworzyć ";
        const parts = [];
        if (itemCounts.tasks > 0) parts.push(`${itemCounts.tasks} zadanie${itemCounts.tasks > 1 ? '' : ''}`);
        if (itemCounts.notes > 0) parts.push(`${itemCounts.notes} notatkę${itemCounts.notes > 1 ? 'i' : ''}`);
        if (itemCounts.shopping > 0) parts.push(`${itemCounts.shopping} element${itemCounts.shopping > 1 ? 'y' : ''} listy zakupów`);
        if (itemCounts.surveys > 0) parts.push(`${itemCounts.surveys} ankietę${itemCounts.surveys > 1 ? 'y' : ''}`);
        
        summaryText += parts.join(', ') + ". Sprawdź szczegóły i potwierdź.**";
        
        finalResponse = cleanedResponse.trim() + `\n\n${summaryText}`;
      }

      // Helper function to get user name from clerkUserId
      const getUserName = (clerkUserId: string): string => {
        const member = teamMembers.find((m: any) => m.clerkUserId === clerkUserId);
        return member ? (member.name || member.email || 'Unknown User') : 'Unknown User';
      };

      // 🔧 PROCESS EDIT REQUESTS
      const editRequests = [];
      
      // Process EDIT_TASK blocks
      if (creationBlocks.editTasks.length > 0) {
        console.log("✏️ AI requested task edits:", creationBlocks.editTasks);
        
        for (const editData of creationBlocks.editTasks) {
          const foundTask: any = await findContentBySearch(ctx, args.projectId, editData.searchCriteria, 'task');
          if (foundTask) {
            // Enrich updates with user-friendly names for assignedTo field
            const enrichedUpdates = { ...editData.updates };
            if (enrichedUpdates.assignedTo) {
              enrichedUpdates.assignedToName = getUserName(enrichedUpdates.assignedTo);
            }
            
            // Also enrich originalItem with current assignee name
            const enrichedOriginalItem: any = { ...foundTask };
            if (foundTask.assignedTo) {
              enrichedOriginalItem.assignedToName = getUserName(foundTask.assignedTo);
            }

            editRequests.push({
              type: 'task',
              operation: 'edit',
              originalItem: enrichedOriginalItem,
              updates: enrichedUpdates,
              searchCriteria: editData.searchCriteria
            });
          } else {
            console.warn(`Task not found for search: "${editData.searchCriteria}"`);
            finalResponse += `\n\n❌ Nie znalazłem zadania pasującego do: "${editData.searchCriteria}"`;
          }
        }
      }

      // Process EDIT_NOTE blocks
      if (creationBlocks.editNotes.length > 0) {
        console.log("📝 AI requested note edits:", creationBlocks.editNotes);
        
        for (const editData of creationBlocks.editNotes) {
          const foundNote = await findContentBySearch(ctx, args.projectId, editData.searchCriteria, 'note');
          if (foundNote) {
            editRequests.push({
              type: 'note',
              operation: 'edit',
              originalItem: foundNote,
              updates: editData.updates,
              searchCriteria: editData.searchCriteria
            });
          } else {
            console.warn(`Note not found for search: "${editData.searchCriteria}"`);
            finalResponse += `\n\n❌ Nie znalazłem notatki pasującej do: "${editData.searchCriteria}"`;
          }
        }
      }

      // Process EDIT_SHOPPING_ITEM blocks
      if (creationBlocks.editShoppingItems.length > 0) {
        console.log("🛒 AI requested shopping item edits:", creationBlocks.editShoppingItems);
        
        for (const editData of creationBlocks.editShoppingItems) {
          const foundItem = await findContentBySearch(ctx, args.projectId, editData.searchCriteria, 'shopping');
          if (foundItem) {
            // Convert section name to section ID if provided in updates
            let processedUpdates = { ...editData.updates };
            if (processedUpdates.section && typeof processedUpdates.section === 'string') {
              const sectionId = await findSectionIdByName(ctx, args.projectId, processedUpdates.section);
              if (sectionId) {
                processedUpdates.sectionId = sectionId;
                delete processedUpdates.section; // Remove the section name, keep only ID
              } else {
                console.warn(`Section "${processedUpdates.section}" not found for edit`);
                delete processedUpdates.section; // Remove invalid section
              }
            }

            editRequests.push({
              type: 'shopping',
              operation: 'edit',
              originalItem: foundItem,
              updates: processedUpdates,
              searchCriteria: editData.searchCriteria
            });
          } else {
            console.warn(`Shopping item not found for search: "${editData.searchCriteria}"`);
            finalResponse += `\n\n❌ Nie znalazłem elementu listy zakupów pasującego do: "${editData.searchCriteria}"`;
          }
        }
      }

      // Process EDIT_SURVEY blocks
      if (creationBlocks.editSurveys.length > 0) {
        console.log("📊 AI requested survey edits:", creationBlocks.editSurveys);
        
        for (const editData of creationBlocks.editSurveys) {
          const foundSurvey = await findContentBySearch(ctx, args.projectId, editData.searchCriteria, 'survey');
          if (foundSurvey) {
            editRequests.push({
              type: 'survey',
              operation: 'edit',
              originalItem: foundSurvey,
              updates: editData.updates,
              searchCriteria: editData.searchCriteria
            });
          } else {
            console.warn(`Survey not found for search: "${editData.searchCriteria}"`);
            finalResponse += `\n\n❌ Nie znalazłem ankiety pasującej do: "${editData.searchCriteria}"`;
          }
        }
      }

      // Add edit requests to pending items
      if (editRequests.length > 0) {
        pendingItems.push(...editRequests);
        
        // Clean edit blocks from response
        finalResponse = finalResponse.replace(/\[EDIT_TASK\][\s\S]*?\[\/EDIT_TASK\]/g, '');
        finalResponse = finalResponse.replace(/\[EDIT_NOTE\][\s\S]*?\[\/EDIT_NOTE\]/g, '');
        finalResponse = finalResponse.replace(/\[EDIT_SHOPPING_ITEM\][\s\S]*?\[\/EDIT_SHOPPING_ITEM\]/g, '');
        finalResponse = finalResponse.replace(/\[EDIT_SURVEY\][\s\S]*?\[\/EDIT_SURVEY\]/g, '');
        
        const editSummary = `\n\n🔧 **Chcę edytować ${editRequests.length} element${editRequests.length > 1 ? 'ów' : ''}. Sprawdź zmiany i potwierdź.**`;
        finalResponse = finalResponse.trim() + editSummary;
      }

      // 📊 EXTRACT AND SAVE TOKEN USAGE
      const { extractTokenUsage, estimateGeminiCost } = await import("./aiTokenHelpers");
      const tokenUsage = extractTokenUsage(result);
      const responseTime = Date.now() - startTime;
      
      // Save token usage statistics
      await ctx.runMutation(internal.aiTokenUsage.saveTokenUsage, {
        projectId: args.projectId,
        teamId: project.teamId,
        userClerkId: args.userClerkId,
        threadId,
        model: "gemini-2.5-pro",
        requestType: "chat",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        contextSize: contextData.length,
        mode: useRAG ? "smart" : "full",
        estimatedCostCents: estimateGeminiCost(tokenUsage.inputTokens, tokenUsage.outputTokens),
        responseTimeMs: responseTime,
        success: true,
      });

      console.log("📊 Token Usage:", {
        mode: useRAG ? "smart" : "full",
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
        estimatedCostUSD: estimateGeminiCost(tokenUsage.inputTokens, tokenUsage.outputTokens) / 100,
        responseTimeMs: responseTime,
        contextSizeChars: contextData.length
      });

      // Save the conversation
      const updatedMessages = [
        ...messages,
        { role: "user" as const, content: args.message },
        { role: "assistant" as const, content: finalResponse }
      ];

      await ctx.runMutation(internal.ai_database.saveThreadMessages, {
        threadId,
        messages: updatedMessages,
        projectId: args.projectId,
        userClerkId: args.userClerkId,
      });

      return {
        response: finalResponse,
        threadId,
        mode: useRAG ? "smart" : "full",
        pendingTasks: pendingItems
          .filter(item => item.type === 'task' && item.operation !== 'edit') // Only creation tasks for legacy compatibility
          .map(item => item.data), 
        pendingItems: pendingItems,
        tokenUsage: {
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          totalTokens: tokenUsage.totalTokens,
          estimatedCostUSD: estimateGeminiCost(tokenUsage.inputTokens, tokenUsage.outputTokens) / 100
        }
      };
      
    } catch (error: unknown) {
      console.error("Smart AI error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Save failed request statistics
      try {
        const { estimateGeminiCost } = await import("./aiTokenHelpers");
        const responseTime = Date.now() - startTime;
        
        await ctx.runMutation(internal.aiTokenUsage.saveTokenUsage, {
          projectId: args.projectId,
          teamId: project.teamId,
          userClerkId: args.userClerkId,
          threadId,
          model: "gemini-2.5-pro",
          requestType: "chat",
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          contextSize: contextData?.length || 0,
          mode: useRAG ? "smart" : "full",
          estimatedCostCents: 0,
          responseTimeMs: responseTime,
          success: false,
          errorMessage: errorMessage,
        });
      } catch (statError) {
        console.error("Failed to save error statistics:", statError);
      }
      
      throw new Error(`AI service error: ${errorMessage}`);
    }
  }
});

// Simplified auto-indexing that only triggers for large projects
export const smartAutoIndex = internalAction({
  args: {
    content: v.string(),
    metadata: v.object({
      type: v.string(),
      projectId: v.string(),
      itemId: v.string(),
      title: v.string(),
      createdAt: v.number(),
    })
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      // Check if project needs RAG (>100 items)
      const projectData = await ctx.runQuery(api.projects.getProject, { 
        projectId: args.metadata.projectId as Id<"projects"> 
      });
      
      if (!projectData) return;

      // TODO: Implement RAG indexing when API is clarified
      // For now, just log what would be indexed
      console.log(`Smart-indexing disabled - would index ${args.metadata.type}: ${args.metadata.title}`);
    } catch (error) {
      console.error("Smart auto-indexing failed:", error);
      // Don't throw - indexing failure shouldn't break the main flow
    }
  },
});

// 🚀 CREATE TASK WITH CONFIRMATION
export const createConfirmedTask = action({
  args: {
    projectId: v.id("projects"),
    taskData: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      dueDate: v.optional(v.string()),
      cost: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("🎯 Creating confirmed task:", args.taskData);

    // Get project to access teamId
    const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
    if (!project) {
      throw new Error("Project not found");
    }

    // Prepare task arguments - exclude undefined/null values to use v.optional properly
    const taskArgs: any = {
      title: args.taskData.title,
      description: args.taskData.description || "",
      projectId: args.projectId,
      teamId: project.teamId,
      priority: args.taskData.priority || "medium",
      status: args.taskData.status || "todo",
      tags: args.taskData.tags || [],
    };

    // Only add optional fields if they have valid values
    if (args.taskData.assignedTo) {
      taskArgs.assignedTo = args.taskData.assignedTo;
    }

    if (args.taskData.dueDate) {
      taskArgs.dueDate = new Date(args.taskData.dueDate).getTime();
    }

    if (args.taskData.cost && args.taskData.cost > 0) {
      taskArgs.cost = args.taskData.cost;
    }

    // Create the task
    const taskId: any = await ctx.runMutation(api.tasks.createTask, taskArgs);

    return {
      success: true,
      taskId,
      message: `✅ Task "${args.taskData.title}" has been created!`
    };
  },
});

// 📝 CREATE NOTE WITH CONFIRMATION
export const createConfirmedNote = action({
  args: {
    projectId: v.id("projects"),
    noteData: v.object({
      title: v.string(),
      content: v.string(),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("📝 Creating confirmed note:", args.noteData);

    const noteId: any = await ctx.runMutation(api.notes.createNote, {
      title: args.noteData.title,
      content: args.noteData.content,
      projectId: args.projectId
    });

    return {
      success: true,
      noteId,
      message: `📝 Note "${args.noteData.title}" has been created!`
    };
  },
});

// 🛒 CREATE SHOPPING ITEM WITH CONFIRMATION  
export const createConfirmedShoppingItem = action({
  args: {
    projectId: v.id("projects"),
    itemData: v.object({
      name: v.string(),
      notes: v.optional(v.string()),
      quantity: v.number(),
      unitPrice: v.optional(v.number()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      category: v.optional(v.string()),
      supplier: v.optional(v.string()),
      buyBefore: v.optional(v.string()),
      realizationStatus: v.optional(v.string()),
      sectionId: v.optional(v.id("shoppingListSections")),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("🛒 Creating confirmed shopping item:", args.itemData);

    const itemId: any = await ctx.runMutation(api.shopping.createShoppingListItem, {
      ...args.itemData,
      projectId: args.projectId,
      buyBefore: args.itemData.buyBefore ? new Date(args.itemData.buyBefore).getTime() : undefined,
      realizationStatus: args.itemData.realizationStatus as any || "PLANNED",
      priority: args.itemData.priority || "medium"
    });

    return {
      success: true,
      itemId,
      message: `🛒 Item "${args.itemData.name}" added to shopping list!`
    };
  },
});

// 📊 CREATE SURVEY WITH CONFIRMATION
export const createConfirmedSurvey = action({
  args: {
    projectId: v.id("projects"),
    surveyData: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      isRequired: v.boolean(),
      allowMultipleResponses: v.optional(v.boolean()),
      targetAudience: v.string(),
      questions: v.array(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("📊 Creating confirmed survey:", args.surveyData);

    // Create survey
    const surveyId: any = await ctx.runMutation(api.surveys.createSurvey, {
      title: args.surveyData.title,
      description: args.surveyData.description,
      projectId: args.projectId,
      isRequired: args.surveyData.isRequired,
      allowMultipleResponses: args.surveyData.allowMultipleResponses || false,
      targetAudience: args.surveyData.targetAudience as any
    });

    // Create questions
    for (let i = 0; i < args.surveyData.questions.length; i++) {
      await ctx.runMutation(api.surveys.createSurveyQuestion, {
        surveyId,
        questionText: args.surveyData.questions[i],
        questionType: "text_long",
        isRequired: false,
        order: i + 1
      });
    }

    return {
      success: true,
      surveyId,
      message: `📊 Survey "${args.surveyData.title}" has been created with ${args.surveyData.questions.length} questions!`
    };
  },
});

// 🔧 EDIT FUNCTIONS

// ✏️ EDIT TASK WITH CONFIRMATION
export const editConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      dueDate: v.optional(v.string()),
      cost: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("✏️ Editing confirmed task:", args.taskId, args.updates);

    const task: any = await ctx.runQuery(api.tasks.getTask, { taskId: args.taskId });
    if (!task) {
      throw new Error("Task not found");
    }

    // Prepare update data, excluding undefined values
    const updateData: any = {};
    
    if (args.updates.title !== undefined) updateData.title = args.updates.title;
    if (args.updates.description !== undefined) updateData.description = args.updates.description;
    if (args.updates.priority !== undefined) updateData.priority = args.updates.priority;
    if (args.updates.status !== undefined) updateData.status = args.updates.status;
    if (args.updates.assignedTo !== undefined) updateData.assignedTo = args.updates.assignedTo;
    if (args.updates.dueDate !== undefined) updateData.dueDate = new Date(args.updates.dueDate).getTime();
    if (args.updates.cost !== undefined) updateData.cost = args.updates.cost;

    await ctx.runMutation(api.tasks.updateTask, {
      taskId: args.taskId,
      ...updateData
    });

    return {
      success: true,
      taskId: args.taskId,
      message: `✏️ Task "${task.title}" has been updated!`
    };
  },
});

// 📝 EDIT NOTE WITH CONFIRMATION
export const editConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    updates: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("📝 Editing confirmed note:", args.noteId, args.updates);

    // Get current note data to merge with updates
    const currentNote: any = await ctx.runQuery(api.notes.getNote, { noteId: args.noteId });
    if (!currentNote) {
      throw new Error("Note not found");
    }
    
    // Prepare update data with all required fields
    const updateData = {
      noteId: args.noteId,
      title: args.updates.title !== undefined ? args.updates.title : currentNote.title,
      content: args.updates.content !== undefined ? args.updates.content : currentNote.content,
    };

    await ctx.runMutation(api.notes.updateNote, updateData);

    return {
      success: true,
      noteId: args.noteId,
      message: `📝 Note "${currentNote.title}" has been updated!`
    };
  },
});

// 🛒 EDIT SHOPPING ITEM WITH CONFIRMATION  
export const editConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    updates: v.object({
      name: v.optional(v.string()),
      notes: v.optional(v.string()),
      quantity: v.optional(v.number()),
      unitPrice: v.optional(v.number()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      category: v.optional(v.string()),
      supplier: v.optional(v.string()),
      sectionId: v.optional(v.id("shoppingListSections")),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("🛒 Editing confirmed shopping item:", args.itemId, args.updates);

    const item: any = await ctx.runQuery(api.shopping.getShoppingListItem, { itemId: args.itemId });
    if (!item) {
      throw new Error("Shopping item not found");
    }

    const updateData: any = {};
    if (args.updates.name !== undefined) updateData.name = args.updates.name;
    if (args.updates.notes !== undefined) updateData.notes = args.updates.notes;
    if (args.updates.quantity !== undefined) updateData.quantity = args.updates.quantity;
    if (args.updates.unitPrice !== undefined) updateData.unitPrice = args.updates.unitPrice;
    if (args.updates.priority !== undefined) updateData.priority = args.updates.priority;
    if (args.updates.category !== undefined) updateData.category = args.updates.category;
    if (args.updates.supplier !== undefined) updateData.supplier = args.updates.supplier;

    await ctx.runMutation(api.shopping.updateShoppingListItem, {
      itemId: args.itemId,
      ...updateData
    });

    return {
      success: true,
      itemId: args.itemId,
      message: `🛒 Item "${item.name}" has been updated!`
    };
  },
});

// 📊 EDIT SURVEY WITH CONFIRMATION
export const editConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      questions: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log("📊 Editing confirmed survey:", args.surveyId, args.updates);

    const survey: any = await ctx.runQuery(api.surveys.getSurvey, { surveyId: args.surveyId });
    if (!survey) {
      throw new Error("Survey not found");
    }

    const updateData: any = {};
    if (args.updates.title !== undefined) updateData.title = args.updates.title;
    if (args.updates.description !== undefined) updateData.description = args.updates.description;

    await ctx.runMutation(api.surveys.updateSurvey, {
      surveyId: args.surveyId,
      ...updateData
    });

    // Update questions if provided
    if (args.updates.questions) {
      // Get existing questions
      const existingQuestions = await ctx.runQuery(api.surveys.getSurveyQuestions, { surveyId: args.surveyId });
      
      // Delete old questions
      for (const question of existingQuestions) {
        await ctx.runMutation(api.surveys.deleteSurveyQuestion, { questionId: question._id });
      }
      
      // Add new questions
      for (let i = 0; i < args.updates.questions.length; i++) {
        await ctx.runMutation(api.surveys.createSurveyQuestion, {
          surveyId: args.surveyId,
          questionText: args.updates.questions[i],
          questionType: "text_long",
          isRequired: false,
          order: i + 1
        });
      }
    }

    return {
      success: true,
      surveyId: args.surveyId,
      message: `📊 Survey "${survey.title}" has been updated!`
    };
  },
});
