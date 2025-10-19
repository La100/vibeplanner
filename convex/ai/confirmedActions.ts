/**
 * Confirmed Actions - AI Suggestions that require user confirmation
 * 
 * These actions are called after the user confirms an AI suggestion.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// ==================== CREATE CONFIRMED ACTIONS ====================

export const createConfirmedTask = action({
  args: {
    projectId: v.id("projects"),
    taskData: v.object({
      title: v.string(),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      dueDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      cost: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    taskId: v.optional(v.id("tasks")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const project: any = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
      if (!project) {
        throw new Error("Project not found");
      }

      let dueDateNumber: number | undefined;
      if (args.taskData.dueDate) {
        dueDateNumber = new Date(args.taskData.dueDate).getTime();
      }

      const taskId: any = await ctx.runMutation(api.tasks.createTask, {
        projectId: args.projectId,
        teamId: project.teamId,
        title: args.taskData.title,
        description: args.taskData.description,
        content: args.taskData.content,
        assignedTo: args.taskData.assignedTo,
        priority: args.taskData.priority || "medium",
        status: args.taskData.status || "todo",
        dueDate: dueDateNumber,
        tags: args.taskData.tags || [],
        cost: args.taskData.cost,
      });

      return {
        success: true,
        taskId,
        message: "Task created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create task: ${error}`,
      };
    }
  },
});

export const createConfirmedNote = action({
  args: {
    projectId: v.id("projects"),
    noteData: v.object({
      title: v.string(),
      content: v.string(),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    noteId: v.optional(v.id("notes")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const noteId: any = await ctx.runMutation(api.notes.createNote, {
        projectId: args.projectId,
        title: args.noteData.title,
        content: args.noteData.content,
      });

      return {
        success: true,
        noteId,
        message: "Note created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create note: ${error}`,
      };
    }
  },
});

export const createConfirmedShoppingItem = action({
  args: {
    projectId: v.id("projects"),
    itemData: v.object({
      name: v.string(),
      quantity: v.number(),
      notes: v.optional(v.string()),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      buyBefore: v.optional(v.string()),
      supplier: v.optional(v.string()),
      category: v.optional(v.string()),
      unitPrice: v.optional(v.number()),
      totalPrice: v.optional(v.number()),
      sectionId: v.optional(v.id("shoppingListSections")),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    itemId: v.optional(v.id("shoppingListItems")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      let buyBeforeNumber: number | undefined;
      if (args.itemData.buyBefore) {
        buyBeforeNumber = new Date(args.itemData.buyBefore).getTime();
      }

      const itemId: any = await ctx.runMutation(api.shopping.createShoppingListItem, {
        projectId: args.projectId,
        name: args.itemData.name,
        quantity: args.itemData.quantity,
        notes: args.itemData.notes,
        priority: args.itemData.priority || "medium",
        buyBefore: buyBeforeNumber,
        supplier: args.itemData.supplier,
        category: args.itemData.category,
        unitPrice: args.itemData.unitPrice,
        realizationStatus: "PLANNED",
        sectionId: args.itemData.sectionId,
      });

      return {
        success: true,
        itemId,
        message: "Shopping item created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create shopping item: ${error}`,
      };
    }
  },
});

export const createConfirmedSurvey = action({
  args: {
    projectId: v.id("projects"),
    surveyData: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      isRequired: v.optional(v.boolean()),
      allowMultipleResponses: v.optional(v.boolean()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      targetAudience: v.optional(v.union(v.literal("all_customers"), v.literal("specific_customers"), v.literal("team_members"))),
      targetCustomerIds: v.optional(v.array(v.string())),
      questions: v.optional(v.array(v.object({
        questionText: v.string(),
        questionType: v.union(v.literal("text_short"), v.literal("text_long"), v.literal("multiple_choice"), v.literal("single_choice"), v.literal("rating"), v.literal("yes_no"), v.literal("number"), v.literal("file")),
        options: v.optional(v.array(v.string())),
        isRequired: v.optional(v.boolean()),
      }))),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    surveyId: v.optional(v.id("surveys")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.surveyData.startDate) {
        startDateNumber = new Date(args.surveyData.startDate).getTime();
      }
      if (args.surveyData.endDate) {
        endDateNumber = new Date(args.surveyData.endDate).getTime();
      }

      const surveyId: any = await ctx.runMutation(api.surveys.createSurvey, {
        projectId: args.projectId,
        title: args.surveyData.title,
        description: args.surveyData.description,
        isRequired: args.surveyData.isRequired || false,
        targetAudience: (args.surveyData.targetAudience as "all_customers" | "specific_customers" | "team_members") || "all_customers",
        allowMultipleResponses: args.surveyData.allowMultipleResponses || false,
        startDate: startDateNumber,
        endDate: endDateNumber,
        targetCustomerIds: args.surveyData.targetCustomerIds,
      });

      if (args.surveyData.questions && args.surveyData.questions.length > 0) {
        for (let i = 0; i < args.surveyData.questions.length; i++) {
          const question = args.surveyData.questions[i];
          await ctx.runMutation(api.surveys.createSurveyQuestion, {
            surveyId,
            questionText: question.questionText,
            questionType: question.questionType as "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file",
            options: question.options,
            isRequired: question.isRequired ?? true,
            order: i + 1,
          });
        }
      }

      const questionCount = args.surveyData.questions?.length || 0;
      const message = questionCount > 0
        ? `Survey created successfully with ${questionCount} questions`
        : "Survey created successfully";

      return {
        success: true,
        surveyId,
        message,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create survey: ${error}`,
      };
    }
  },
});

export const createConfirmedContact = action({
  args: {
    teamSlug: v.string(),
    contactData: v.object({
      name: v.string(),
      companyName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      postalCode: v.optional(v.string()),
      website: v.optional(v.string()),
      taxId: v.optional(v.string()),
      type: v.union(v.literal("contractor"), v.literal("supplier"), v.literal("subcontractor"), v.literal("other")),
      notes: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    contactId: v.optional(v.id("contacts")),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const contactId: any = await ctx.runMutation(api.contacts.createContact, {
        teamSlug: args.teamSlug,
        name: args.contactData.name,
        companyName: args.contactData.companyName,
        email: args.contactData.email,
        phone: args.contactData.phone,
        address: args.contactData.address,
        city: args.contactData.city,
        postalCode: args.contactData.postalCode,
        website: args.contactData.website,
        taxId: args.contactData.taxId,
        type: args.contactData.type,
        notes: args.contactData.notes,
      });

      return {
        success: true,
        contactId,
        message: "Contact created successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create contact: ${error}`,
      };
    }
  },
});

// ==================== EDIT CONFIRMED ACTIONS ====================

export const editConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
      assignedTo: v.optional(v.union(v.string(), v.null())),
      priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
      dueDate: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      cost: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      let dueDateNumber: number | undefined;
      if (args.updates.dueDate) {
        dueDateNumber = new Date(args.updates.dueDate).getTime();
      }

      await ctx.runMutation(api.tasks.updateTask, {
        taskId: args.taskId,
        title: args.updates.title,
        description: args.updates.description,
        content: args.updates.content,
        status: args.updates.status,
        assignedTo: args.updates.assignedTo,
        priority: args.updates.priority,
        dueDate: dueDateNumber,
        tags: args.updates.tags,
        cost: args.updates.cost,
      });

      return {
        success: true,
        message: "Task updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update task: ${error}`,
      };
    }
  },
});

export const editConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    updates: v.object({
      title: v.optional(v.string()),
      content: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      const currentNote = await ctx.runQuery(api.notes.getNote, { noteId: args.noteId });
      if (!currentNote) {
        return {
          success: false,
          message: "Note not found",
        };
      }

      await ctx.runMutation(api.notes.updateNote, {
        noteId: args.noteId,
        title: args.updates.title || currentNote.title,
        content: args.updates.content || currentNote.content,
      });

      return {
        success: true,
        message: "Note updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update note: ${error}`,
      };
    }
  },
});

export const editConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    updates: v.object({
      name: v.optional(v.string()),
      notes: v.optional(v.string()),
      buyBefore: v.optional(v.string()),
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
      sectionId: v.optional(v.union(v.id("shoppingListSections"), v.null())),
      assignedTo: v.optional(v.string()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      let buyBeforeNumber: number | undefined;
      if (args.updates.buyBefore) {
        buyBeforeNumber = new Date(args.updates.buyBefore).getTime();
      }

      await ctx.runMutation(api.shopping.updateShoppingListItem, {
        itemId: args.itemId,
        name: args.updates.name,
        notes: args.updates.notes,
        buyBefore: buyBeforeNumber,
        priority: args.updates.priority,
        imageUrl: args.updates.imageUrl,
        productLink: args.updates.productLink,
        supplier: args.updates.supplier,
        catalogNumber: args.updates.catalogNumber,
        category: args.updates.category,
        dimensions: args.updates.dimensions,
        quantity: args.updates.quantity,
        unitPrice: args.updates.unitPrice,
        realizationStatus: args.updates.realizationStatus,
        sectionId: args.updates.sectionId,
        assignedTo: args.updates.assignedTo,
      });

      return {
        success: true,
        message: "Shopping item updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update shopping item: ${error}`,
      };
    }
  },
});

export const editConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      isRequired: v.optional(v.boolean()),
      allowMultipleResponses: v.optional(v.boolean()),
      startDate: v.optional(v.string()),
      endDate: v.optional(v.string()),
      targetAudience: v.optional(v.union(
        v.literal("all_customers"),
        v.literal("specific_customers"),
        v.literal("team_members")
      )),
      questions: v.optional(v.array(v.object({
        questionId: v.id("surveyQuestions"),
        questionText: v.optional(v.string()),
        questionType: v.optional(v.union(
          v.literal("text_short"),
          v.literal("text_long"),
          v.literal("multiple_choice"),
          v.literal("single_choice"),
          v.literal("rating"),
          v.literal("yes_no"),
          v.literal("number"),
          v.literal("file")
        )),
        options: v.optional(v.array(v.string())),
        isRequired: v.optional(v.boolean()),
        order: v.optional(v.number()),
      }))),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      let startDateNumber: number | undefined;
      let endDateNumber: number | undefined;
      if (args.updates.startDate) {
        startDateNumber = new Date(args.updates.startDate).getTime();
      }
      if (args.updates.endDate) {
        endDateNumber = new Date(args.updates.endDate).getTime();
      }

      await ctx.runMutation(api.surveys.updateSurvey, {
        surveyId: args.surveyId,
        title: args.updates.title,
        description: args.updates.description,
        isRequired: args.updates.isRequired,
        allowMultipleResponses: args.updates.allowMultipleResponses,
        startDate: startDateNumber,
        endDate: endDateNumber,
        targetAudience: args.updates.targetAudience as "all_customers" | "specific_customers" | "team_members" | undefined,
      });

      if (args.updates.questions && args.updates.questions.length > 0) {
        for (const questionUpdate of args.updates.questions) {
          const { questionId, operation = "edit", ...questionFields } = questionUpdate as {
            questionId?: Id<"surveyQuestions">;
            operation?: "create" | "edit" | "delete";
            questionText?: string;
            questionType?: string;
            options?: Array<string>;
            isRequired?: boolean;
            order?: number;
          };

          if (operation === "create") {
            await ctx.runMutation(api.surveys.createSurveyQuestion, {
              surveyId: args.surveyId,
              questionText: questionFields.questionText as string,
              questionType: questionFields.questionType as
                | "text_short"
                | "text_long"
                | "multiple_choice"
                | "single_choice"
                | "rating"
                | "yes_no"
                | "number"
                | "file",
              options: questionFields.options,
              isRequired: questionFields.isRequired ?? true,
              order: questionFields.order ?? 1,
            });
            continue;
          }

          if (!questionId) {
            throw new Error("Missing questionId for survey question update");
          }

          if (operation === "delete") {
            await ctx.runMutation(api.surveys.deleteQuestion, {
              questionId,
            });
            continue;
          }

          await ctx.runMutation(api.surveys.updateQuestion, {
            questionId,
            questionText: questionFields.questionText,
            questionType: questionFields.questionType as
              | "text_short"
              | "text_long"
              | "multiple_choice"
              | "single_choice"
              | "rating"
              | "yes_no"
              | "number"
              | "file"
              | undefined,
            options: questionFields.options,
            isRequired: questionFields.isRequired,
            order: questionFields.order,
          });
        }
      }

      return {
        success: true,
        message: "Survey updated successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update survey: ${error}`,
      };
    }
  },
});

// ==================== DELETE CONFIRMED ACTIONS ====================

export const deleteConfirmedTask = action({
  args: {
    taskId: v.id("tasks"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.tasks.deleteTask, {
        taskId: args.taskId,
      });

      return {
        success: true,
        message: "Task deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete task: ${error}`,
      };
    }
  },
});

export const deleteConfirmedNote = action({
  args: {
    noteId: v.id("notes"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.notes.deleteNote, {
        noteId: args.noteId,
      });

      return {
        success: true,
        message: "Note deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete note: ${error}`,
      };
    }
  },
});

export const deleteConfirmedShoppingItem = action({
  args: {
    itemId: v.id("shoppingListItems"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.shopping.deleteShoppingListItem, {
        itemId: args.itemId,
      });

      return {
        success: true,
        message: "Shopping item deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete shopping item: ${error}`,
      };
    }
  },
});

export const deleteConfirmedSurvey = action({
  args: {
    surveyId: v.id("surveys"),
    title: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.surveys.deleteSurvey, {
        surveyId: args.surveyId,
      });

      return {
        success: true,
        message: `Survey "${args.title}" deleted successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete survey: ${error}`,
      };
    }
  },
});

export const deleteConfirmedContact = action({
  args: {
    contactId: v.id("contacts"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(api.contacts.deleteContact, {
        contactId: args.contactId,
      });

      return {
        success: true,
        message: "Contact deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete contact: ${error}`,
      };
    }
  },
});
