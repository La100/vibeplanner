export type FunctionToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const functionTools: FunctionToolDefinition[] = [
  {
    name: "create_task",
    description: "Create a new task in the project",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        content: { type: "string", description: "Rich text content" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" },
        status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Task status", default: "todo" },
        assignedTo: { type: "string", description: "Team member name or email from TEAM MEMBERS list" },
        dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
        tags: { type: "array", items: { type: "string" }, description: "Task tags for categorization" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_shopping_section",
    description: "Create a new shopping list section",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Section name" },
      },
      required: ["name"],
    },
  },
  {
    name: "edit_shopping_section",
    description: "Rename an existing shopping list section",
    parameters: {
      type: "object",
      properties: {
        sectionId: { type: "string", description: "Section ID to edit" },
        name: { type: "string", description: "New section name" },
      },
      required: ["sectionId", "name"],
    },
  },
  {
    name: "delete_shopping_section",
    description: "Delete a shopping list section",
    parameters: {
      type: "object",
      properties: {
        sectionId: { type: "string", description: "Section ID to delete" },
      },
      required: ["sectionId"],
    },
  },
  {
    name: "create_multiple_tasks",
    description: "Create multiple tasks at once (use when creating 2+ tasks)",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Array of tasks to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title" },
              description: { type: "string", description: "Task description" },
              content: { type: "string", description: "Rich text content" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Task priority" },
              status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Task status", default: "todo" },
              assignedTo: { type: "string", description: "Team member name or email from TEAM MEMBERS list" },
              dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
              tags: { type: "array", items: { type: "string" }, description: "Task tags for categorization" },
            },
            required: ["title"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "create_note",
    description: "Create a new note in the project",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Note title" },
        content: { type: "string", description: "Note content" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_multiple_notes",
    description: "Create multiple notes at once (use when creating 2+ notes)",
    parameters: {
      type: "object",
      properties: {
        notes: {
          type: "array",
          description: "Array of notes to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Note title" },
              content: { type: "string", description: "Note content" },
            },
            required: ["title", "content"],
          },
        },
      },
      required: ["notes"],
    },
  },
  {
    name: "edit_note",
    description: "Edit/update an existing note in the project",
    parameters: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "Note ID to edit" },
        title: { type: "string", description: "New note title" },
        content: { type: "string", description: "New note content" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "edit_multiple_notes",
    description: "Edit/update multiple notes at once (use when editing 2+ notes)",
    parameters: {
      type: "object",
      properties: {
        notes: {
          type: "array",
          description: "Array of notes to edit with their updates",
          items: {
            type: "object",
            properties: {
              noteId: { type: "string", description: "Note ID to edit" },
              title: { type: "string", description: "New note title" },
              content: { type: "string", description: "New note content" },
            },
            required: ["noteId"],
          },
        },
      },
      required: ["notes"],
    },
  },
  {
    name: "create_shopping_item",
    description: "Create a new shopping list item",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Item name" },
        notes: { type: "string", description: "Additional notes or description" },
        quantity: { type: "number", description: "Quantity needed", default: 1 },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Item priority" },
        buyBefore: { type: "string", description: "Buy before date in ISO format (YYYY-MM-DD)" },
        supplier: { type: "string", description: "Supplier or store name" },
        category: { type: "string", description: "Item category (e.g., Electronics, Furniture)" },
        dimensions: { type: "string", description: "Item dimensions or size" },
        unitPrice: { type: "number", description: "Price per unit" },
        totalPrice: { type: "number", description: "Total price (quantity × unit price)" },
        productLink: { type: "string", description: "Link to product page" },
        catalogNumber: { type: "string", description: "Product catalog/model number" },
        sectionId: { type: "string", description: "Shopping list section ID" },
        sectionName: { type: "string", description: "Shopping list section name (e.g., Kitchen, Bathroom)" },
      },
      required: ["name", "quantity"],
    },
  },
  {
    name: "create_multiple_shopping_items",
    description: "Create multiple shopping items at once (use when creating 2+ items)",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Array of shopping items to create",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name" },
              notes: { type: "string", description: "Additional notes or description" },
              quantity: { type: "number", description: "Quantity needed", default: 1 },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Item priority" },
              buyBefore: { type: "string", description: "Buy before date in ISO format (YYYY-MM-DD)" },
              supplier: { type: "string", description: "Supplier or store name" },
              category: { type: "string", description: "Item category" },
              dimensions: { type: "string", description: "Item dimensions or size" },
              unitPrice: { type: "number", description: "Price per unit" },
              totalPrice: { type: "number", description: "Total price" },
              productLink: { type: "string", description: "Link to product page" },
              catalogNumber: { type: "string", description: "Product catalog/model number" },
              sectionName: { type: "string", description: "Section name" },
            },
            required: ["name", "quantity"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "edit_shopping_item",
    description: "Edit/update an existing shopping item",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Shopping item ID to edit" },
        name: { type: "string", description: "New item name" },
        notes: { type: "string", description: "New notes" },
        quantity: { type: "number", description: "New quantity" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "New priority" },
        buyBefore: { type: "string", description: "New buy before date" },
        supplier: { type: "string", description: "New supplier" },
        category: { type: "string", description: "New category" },
        unitPrice: { type: "number", description: "New unit price" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "edit_multiple_shopping_items",
    description: "Edit/update multiple shopping items at once (use when editing 2+ items)",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Array of shopping items to edit",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string", description: "Shopping item ID to edit" },
              name: { type: "string", description: "New item name" },
              notes: { type: "string", description: "New notes" },
              quantity: { type: "number", description: "New quantity" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "New priority" },
            },
            required: ["itemId"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "create_survey",
    description: "Create a new survey for the project",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Survey title" },
        description: { type: "string", description: "Survey description" },
        isRequired: { type: "boolean", description: "Whether survey is required for customers", default: false },
        allowMultipleResponses: { type: "boolean", description: "Allow multiple responses from same person", default: false },
        startDate: { type: "string", description: "Survey start date in ISO format (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Survey end date in ISO format (YYYY-MM-DD)" },
        targetAudience: {
          type: "string",
          enum: ["all_customers", "specific_customers", "team_members"],
          description: "Who should take this survey",
          default: "all_customers",
        },
        targetCustomerIds: {
          type: "array",
          items: { type: "string" },
          description: "Specific customer IDs (only if targetAudience is 'specific_customers')",
        },
        questions: {
          type: "array",
          description: "Array of survey questions to create",
          items: {
            type: "object",
            properties: {
              questionText: { type: "string", description: "The question text" },
              questionType: {
                type: "string",
                enum: ["text_short", "text_long", "multiple_choice", "single_choice", "rating", "yes_no", "number", "file"],
                description: "Type of question",
                default: "text_short",
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Options for multiple_choice or single_choice questions",
              },
              isRequired: { type: "boolean", description: "Whether this question is required", default: true },
            },
            required: ["questionText", "questionType"],
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_multiple_surveys",
    description: "Create multiple surveys at once (use when creating 2+ surveys)",
    parameters: {
      type: "object",
      properties: {
        surveys: {
          type: "array",
          description: "Array of surveys to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Survey title" },
              description: { type: "string", description: "Survey description" },
              isRequired: { type: "boolean", description: "Whether survey is required" },
              targetAudience: { type: "string", enum: ["all_customers", "specific_customers", "team_members"], description: "Target audience" },
            },
            required: ["title"],
          },
        },
      },
      required: ["surveys"],
    },
  },
  {
    name: "edit_survey",
    description: "Edit/update an existing survey",
    parameters: {
      type: "object",
      properties: {
        surveyId: { type: "string", description: "Survey ID to edit" },
        title: { type: "string", description: "New survey title" },
        description: { type: "string", description: "New survey description" },
        isRequired: { type: "boolean", description: "Whether survey is required" },
        targetAudience: { type: "string", enum: ["all_customers", "specific_customers", "team_members"], description: "New target audience" },
      },
      required: ["surveyId"],
    },
  },
  {
    name: "edit_multiple_surveys",
    description: "Edit/update multiple surveys at once (use when editing 2+ surveys)",
    parameters: {
      type: "object",
      properties: {
        surveys: {
          type: "array",
          description: "Array of surveys to edit",
          items: {
            type: "object",
            properties: {
              surveyId: { type: "string", description: "Survey ID to edit" },
              title: { type: "string", description: "New survey title" },
              description: { type: "string", description: "New survey description" },
              isRequired: { type: "boolean", description: "Whether survey is required" },
            },
            required: ["surveyId"],
          },
        },
      },
      required: ["surveys"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact (contractor, supplier, etc.)",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Contact name" },
        companyName: { type: "string", description: "Company name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        address: { type: "string", description: "Physical address" },
        city: { type: "string", description: "City" },
        postalCode: { type: "string", description: "Postal code" },
        website: { type: "string", description: "Website URL" },
        taxId: { type: "string", description: "Tax ID or company registration number" },
        type: {
          type: "string",
          enum: ["contractor", "supplier", "subcontractor", "other"],
          description: "Contact type",
          default: "contractor",
        },
        notes: { type: "string", description: "Additional notes about the contact" },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "edit_task",
    description: "Edit/update an existing task in the project",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID to edit" },
        title: { type: "string", description: "New task title" },
        description: { type: "string", description: "New task description" },
        content: { type: "string", description: "New rich text content" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "New task priority" },
        status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "New task status" },
        assignedTo: { type: "string", description: "Team member name or email from TEAM MEMBERS list" },
        dueDate: { type: "string", description: "New due date in ISO format (YYYY-MM-DD)" },
        tags: { type: "array", items: { type: "string" }, description: "New task tags" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "edit_multiple_tasks",
    description: "Edit/update multiple tasks at once (use when editing 2+ tasks)",
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Array of tasks to edit with their updates",
          items: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "Task ID to edit" },
              title: { type: "string", description: "New task title" },
              description: { type: "string", description: "New task description" },
              content: { type: "string", description: "New rich text content" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "New task priority" },
              status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "New task status" },
              assignedTo: { type: "string", description: "Team member name or email from TEAM MEMBERS list" },
              dueDate: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
              tags: { type: "array", items: { type: "string" }, description: "New task tags" },
            },
            required: ["taskId"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "delete_task",
    description: "Delete/remove a task from the project",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID to delete" },
        reason: { type: "string", description: "Optional reason for deletion" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "delete_note",
    description: "Delete/remove a note from the project",
    parameters: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "Note ID to delete" },
        reason: { type: "string", description: "Optional reason for deletion" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "delete_shopping_item",
    description: "Delete/remove an item from the shopping list",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "Shopping item ID to delete" },
        reason: { type: "string", description: "Optional reason for deletion" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "delete_survey",
    description: "Delete/remove a survey from the project",
    parameters: {
      type: "object",
      properties: {
        surveyId: { type: "string", description: "Survey ID to delete" },
        title: { type: "string", description: "Survey title for confirmation dialog" },
        reason: { type: "string", description: "Optional reason for deletion" },
      },
      required: ["surveyId", "title"],
    },
  },
  {
    name: "delete_contact",
    description: "Delete/remove a contact from the project",
    parameters: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID to delete" },
        reason: { type: "string", description: "Optional reason for deletion" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "search_tasks",
    description: "Search for tasks in the project. Use this when you need to find specific tasks or get information about existing tasks (e.g., to edit them, check their status, or reference them).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query - can be title, description, assignee name, or any task details" },
        status: { type: "string", enum: ["todo", "in_progress", "review", "done"], description: "Filter by status (optional)" },
        limit: { type: "number", description: "Maximum number of results to return (default: 10)", default: 10 },
      },
      required: [],
    },
  },
  {
    name: "search_shopping_items",
    description: "Search for shopping list items in the project. Use this when you need to find specific items or get information about existing shopping items.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query - can be item name, category, section, supplier, or any item details" },
        sectionName: { type: "string", description: "Filter by section name (optional)" },
        limit: { type: "number", description: "Maximum number of results to return (default: 10)", default: 10 },
      },
      required: [],
    },
  },
  {
    name: "search_notes",
    description: "Search for project notes by title or content. Use this to find notes you need to reference or edit.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query - can be note title or content keywords" },
        includeArchived: { type: "boolean", description: "Whether to include archived notes (default: false)", default: false },
        limit: { type: "number", description: "Maximum number of results to return (default: 10)", default: 10 },
      },
      required: [],
    },
  },
  {
    name: "search_surveys",
    description: "Search for surveys in the project. Use this when you need to find surveys to review, edit, or reference.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query - survey title or description keywords" },
        status: { type: "string", enum: ["draft", "active", "closed"], description: "Filter by survey status (optional)" },
        limit: { type: "number", description: "Maximum number of results to return (default: 10)", default: 10 },
      },
      required: [],
    },
  },
  {
    name: "search_contacts",
    description: "Search for contacts assigned to the project. Use this to find suppliers, contractors, or other contacts.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query - contact name, company, email, phone, or notes" },
        contactType: { type: "string", enum: ["contractor", "supplier", "subcontractor", "other"], description: "Filter by contact type (optional)" },
        limit: { type: "number", description: "Maximum number of results to return (default: 10)", default: 10 },
      },
      required: [],
    },
  },
];
