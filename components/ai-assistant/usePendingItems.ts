/**
 * usePendingItems Hook
 * 
 * Manages pending AI suggestions and their confirmation/rejection flow.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  PendingItem,
  ChatHistoryEntry,
  ShoppingItemInput,
  BulkTaskData,
  BulkNoteData,
  BulkShoppingData,
  BulkSurveyData,
} from "./types";
import {
  isPendingItemType,
  normalizePendingItems,
  expandBulkEditItems,
  sanitizeShoppingItemData,
  sanitizeContactData,
  extractSurveyData,
  extractBulkSelection,
  extractBulkUpdates,
  resolveSectionName,
} from "./utils";

interface UsePendingItemsProps {
  projectId: Id<"projects"> | undefined;
  teamSlug: string | undefined;
  threadId: string | undefined;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryEntry[]>>;
}

interface UsePendingItemsReturn {
  pendingItems: PendingItem[];
  setPendingItems: React.Dispatch<React.SetStateAction<PendingItem[]>>;
  currentItemIndex: number;
  setCurrentItemIndex: (index: number) => void;
  isConfirmationDialogOpen: boolean;
  setIsConfirmationDialogOpen: (open: boolean) => void;
  showConfirmationGrid: boolean;
  setShowConfirmationGrid: (show: boolean) => void;
  isCreatingContent: boolean;
  isBulkProcessing: boolean;
  editingItemIndex: number | null;
  setEditingItemIndex: (index: number | null) => void;
  handleContentConfirm: () => Promise<void>;
  handleContentCancel: () => void;
  handleContentEdit: (data: Record<string, unknown>) => void;
  handleContentDialogClose: () => void;
  handleConfirmAll: () => Promise<void>;
  handleConfirmItem: (index: number) => Promise<void>;
  handleRejectItem: (index: number) => Promise<void>;
  handleRejectAll: () => Promise<void>;
  handleEditItem: (index: number) => void;
  resetPendingState: () => void;
}

export const usePendingItems = ({
  projectId,
  teamSlug,
  threadId,
  setChatHistory,
}: UsePendingItemsProps): UsePendingItemsReturn => {
  // State
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [showConfirmationGrid, setShowConfirmationGrid] = useState(false);
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Queries
  const pendingFunctionCalls = useQuery(
    api.ai.threads.listPendingItems,
    threadId ? { threadId } : "skip"
  );

  const shoppingSections = useQuery(
    api.shopping.getShoppingListSections,
    projectId ? { projectId } : "skip"
  );

  // Mutations
  const markFunctionCallsAsConfirmed = useMutation(api.ai.threads.markFunctionCallsAsConfirmed);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const deleteNote = useMutation(api.notes.deleteNote);
  const deleteShoppingItem = useMutation(api.shopping.deleteShoppingListItem);
  const createShoppingSection = useMutation(api.shopping.createShoppingListSection);
  const updateShoppingSection = useMutation(api.shopping.updateShoppingListSection);
  const deleteShoppingSection = useMutation(api.shopping.deleteShoppingListSection);
  const deleteSurvey = useMutation(api.surveys.deleteSurvey);
  const deleteContact = useMutation(api.contacts.deleteContact);

  // Actions
  const createConfirmedTask = useAction(api.ai.confirmedActions.createConfirmedTask);
  const createConfirmedNote = useAction(api.ai.confirmedActions.createConfirmedNote);
  const createConfirmedShoppingItem = useAction(api.ai.confirmedActions.createConfirmedShoppingItem);
  const createConfirmedSurvey = useAction(api.ai.confirmedActions.createConfirmedSurvey);
  const createConfirmedContact = useAction(api.ai.confirmedActions.createConfirmedContact);
  const editConfirmedTask = useAction(api.ai.confirmedActions.editConfirmedTask);
  const editConfirmedNote = useAction(api.ai.confirmedActions.editConfirmedNote);
  const editConfirmedShoppingItem = useAction(api.ai.confirmedActions.editConfirmedShoppingItem);
  const editConfirmedSurvey = useAction(api.ai.confirmedActions.editConfirmedSurvey);
  const bulkEditConfirmedTasks = useAction(api.ai.actions.bulkEditConfirmedTasks);

  // Load pending items from DB
  useEffect(() => {
    if (pendingFunctionCalls && pendingFunctionCalls.length > 0) {
      const pendingItemsFromDB = pendingFunctionCalls.map<PendingItem | null>((call) => {
        try {
          const parsed = JSON.parse(call.arguments);
          const parsedTypeValue = typeof parsed?.type === "string" ? parsed.type : undefined;
          const parsedType = isPendingItemType(parsedTypeValue) ? parsedTypeValue : undefined;
          const functionCallType = isPendingItemType(call.functionName) ? call.functionName : undefined;
          
          return {
            type: parsedType ?? functionCallType ?? "task",
            operation: parsed.operation,
            data: parsed.data || parsed,
            updates: parsed.updates,
            originalItem: parsed.originalItem,
            selection: parsed.selection,
            titleChanges: parsed.titleChanges,
            functionCall: {
              callId: call.callId,
              functionName: call.functionName,
              arguments: call.arguments,
            },
            responseId: call.responseId,
          };
        } catch (e) {
          console.error("Failed to parse pending item:", e);
          return null;
        }
      }).filter((i): i is PendingItem => i !== null);

      if (pendingItemsFromDB.length > 0) {
        const expanded = expandBulkEditItems(normalizePendingItems(pendingItemsFromDB));
        setPendingItems(expanded);
        setCurrentItemIndex(0);

        const firstItem = expanded[0];
        const shouldShowGrid = expanded.length > 1 || firstItem.operation === "bulk_edit" || firstItem.operation === "bulk_create";

        if (shouldShowGrid) {
          setShowConfirmationGrid(true);
          setIsConfirmationDialogOpen(false);
        } else {
          setShowConfirmationGrid(false);
          setIsConfirmationDialogOpen(true);
        }
      }
    } else if (pendingFunctionCalls && pendingFunctionCalls.length === 0 && pendingItems.length > 0) {
      setPendingItems([]);
      setShowConfirmationGrid(false);
      setIsConfirmationDialogOpen(false);
    }
  }, [pendingFunctionCalls, pendingItems.length]);

  // Helper functions
  const resolveTeamSlug = useCallback(() => {
    return teamSlug || undefined;
  }, [teamSlug]);

  const findOrCreateSection = useCallback(async (sectionName: string): Promise<Id<"shoppingListSections"> | undefined> => {
    if (!sectionName || !projectId) return undefined;

    const existingSection = shoppingSections?.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );

    if (existingSection) {
      return existingSection._id;
    }

    try {
      const newSectionId = await createShoppingSection({
        projectId,
        name: sectionName,
      });
      return newSectionId;
    } catch (error) {
      console.error("Failed to create section:", error);
      return undefined;
    }
  }, [projectId, shoppingSections, createShoppingSection]);

  // Confirm single item helper
  const confirmSingleItem = useCallback(async (item: PendingItem) => {
    if (!projectId) throw new Error("No project available");

    let result;

    if (item.operation === 'bulk_create') {
      switch (item.type) {
        case 'create_multiple_tasks':
        case 'task': {
          const data = item.data as BulkTaskData;
          const tasks = Array.isArray(data.tasks) ? data.tasks : [];

          if (tasks.length === 0) {
            throw new Error("No tasks provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const taskData of tasks) {
            try {
              const cleanTaskData = { ...taskData };
              delete (cleanTaskData as Record<string, unknown>).assignedToName;

              const taskResult = await createConfirmedTask({
                projectId,
                taskData: cleanTaskData as {
                  title: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  description?: string;
                  assignedTo?: string | null;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  startDate?: string;
                  endDate?: string;
                  tags?: string[];
                  cost?: number;
                },
              });

              if (taskResult.success && taskResult.taskId) {
                createdIds.push(taskResult.taskId);
              } else if (!taskResult.success) {
                errors.push(taskResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${tasks.length} tasks successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'create_multiple_notes':
        case 'note': {
          const data = item.data as BulkNoteData;
          const notes = Array.isArray(data.notes) ? data.notes : [];

          if (notes.length === 0) {
            throw new Error("No notes provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const noteData of notes) {
            try {
              const noteResult = await createConfirmedNote({
                projectId,
                noteData: noteData as { title: string; content: string },
              });

              if (noteResult.success && noteResult.noteId) {
                createdIds.push(noteResult.noteId);
              } else if (!noteResult.success) {
                errors.push(noteResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${notes.length} notes successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'create_multiple_shopping_items':
        case 'shopping': {
          const data = item.data as BulkShoppingData;
          const items = Array.isArray(data.items) ? data.items : [];

          if (items.length === 0) {
            throw new Error("No shopping items provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          // Pre-create sections
          const uniqueSectionNames = new Set<string>();
          for (const shoppingData of items) {
            const { sectionName } = shoppingData;
            const targetSectionName = resolveSectionName(sectionName, shoppingData.category);
            if (targetSectionName && !shoppingData.sectionId) {
              uniqueSectionNames.add(targetSectionName);
            }
          }

          const sectionNameToId = new Map<string, Id<"shoppingListSections">>();
          for (const sectionName of uniqueSectionNames) {
            const sectionId = await findOrCreateSection(sectionName);
            if (sectionId) {
              sectionNameToId.set(sectionName, sectionId);
            }
          }

          for (const shoppingData of items) {
            try {
              const { sectionName, ...shoppingItemData } = shoppingData;
              const targetSectionName = resolveSectionName(sectionName, shoppingData.category);

              if (targetSectionName && !shoppingItemData.sectionId) {
                const sectionId = sectionNameToId.get(targetSectionName);
                if (sectionId) {
                  shoppingItemData.sectionId = sectionId;
                }
              }

              const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData as Record<string, unknown>);

              const shoppingResult = await createConfirmedShoppingItem({
                projectId,
                itemData: sanitizedItemData as {
                  name: string;
                  quantity: number;
                  notes?: string;
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  buyBefore?: string;
                  supplier?: string;
                  category?: string;
                  unitPrice?: number;
                  sectionId?: Id<'shoppingListSections'>;
                },
              });

              if (shoppingResult.success && shoppingResult.itemId) {
                createdIds.push(shoppingResult.itemId);
              } else if (!shoppingResult.success) {
                errors.push(shoppingResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${items.length} shopping items successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'create_multiple_surveys':
        case 'create_survey':
        case 'survey': {
          const data = item.data as BulkSurveyData;
          const surveys = Array.isArray(data.surveys) ? data.surveys : [];

          if (surveys.length === 0) {
            throw new Error("No surveys provided for bulk creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const surveyData of surveys) {
            try {
              const surveyResult = await createConfirmedSurvey({
                projectId,
                surveyData: extractSurveyData(surveyData as Record<string, unknown>),
              });

              if (surveyResult.success && surveyResult.surveyId) {
                createdIds.push(surveyResult.surveyId);
              } else if (!surveyResult.success) {
                errors.push(surveyResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${surveys.length} surveys successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        case 'create_contact':
        case 'contact': {
          const contacts = Array.isArray(
            (item.data as { contacts?: Array<Record<string, unknown>> }).contacts
          )
            ? ((item.data as { contacts?: Array<Record<string, unknown>> }).contacts as Array<Record<string, unknown>>)
            : [];

          if (contacts.length === 0) {
            throw new Error("No contacts provided for bulk creation");
          }

          const slug = resolveTeamSlug();
          if (!slug) {
            throw new Error("Missing team slug for contact creation");
          }

          const createdIds: string[] = [];
          const errors: string[] = [];

          for (const contact of contacts) {
            try {
              const contactResult = await createConfirmedContact({
                teamSlug: slug,
                contactData: sanitizeContactData(contact),
              });

              if (contactResult.success && contactResult.contactId) {
                createdIds.push(contactResult.contactId);
              } else if (!contactResult.success) {
                errors.push(contactResult.message);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              errors.push(message);
            }
          }

          result = {
            success: errors.length === 0,
            message: `Created ${createdIds.length}/${contacts.length} contacts successfully${
              errors.length > 0 ? `. Errors: ${errors.slice(0, 3).join(', ')}` : ''
            }`,
          };
          break;
        }
        default:
          throw new Error(`Unsupported bulk create type: ${item.type}`);
      }
    } else if (item.operation === 'delete') {
      switch (item.type) {
        case 'task':
          await deleteTask({ taskId: item.data.taskId as Id<"tasks"> });
          result = { success: true, message: "Task deleted successfully" };
          break;
        case 'note':
          await deleteNote({ noteId: item.data.noteId as Id<"notes"> });
          result = { success: true, message: "Note deleted successfully" };
          break;
        case 'shopping':
          await deleteShoppingItem({ itemId: item.data.itemId as Id<"shoppingListItems"> });
          result = { success: true, message: "Shopping item deleted successfully" };
          break;
        case 'shoppingSection':
          await deleteShoppingSection({ sectionId: item.data.sectionId as Id<"shoppingListSections"> });
          result = { success: true, message: "Shopping section deleted successfully" };
          break;
        case 'survey':
          await deleteSurvey({ surveyId: item.data.surveyId as Id<"surveys"> });
          result = { success: true, message: "Survey deleted successfully" };
          break;
        case 'contact':
          await deleteContact({ contactId: item.data.contactId as Id<"contacts"> });
          result = { success: true, message: "Contact deleted successfully" };
          break;
        default:
          throw new Error(`Unknown content type for deletion: ${item.type}`);
      }
    } else if (item.operation === 'edit') {
      switch (item.type) {
        case 'task': {
          const cleanUpdates = { ...(item.updates as Record<string, unknown>) };
          delete cleanUpdates.assignedToName;
          
          result = await editConfirmedTask({
            taskId: item.originalItem?._id as Id<"tasks">,
            updates: cleanUpdates
          });
          break;
        }
        case 'note':
          result = await editConfirmedNote({
            noteId: item.originalItem?._id as Id<"notes">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        case 'shopping': {
          const updates = { ...(item.updates as Record<string, unknown>) };
          const fallbackCategory =
            updates["category"] ?? (item.data ? (item.data as Record<string, unknown>)["category"] : undefined);
          const targetSectionName = resolveSectionName(updates["sectionName"], fallbackCategory);

          if (targetSectionName && !updates["sectionId"]) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              updates["sectionId"] = sectionId;
            }
          }

          delete updates["sectionName"];
          const sanitizedUpdates = sanitizeShoppingItemData(updates);

          result = await editConfirmedShoppingItem({
            itemId: item.originalItem?._id as Id<"shoppingListItems">,
            updates: sanitizedUpdates,
          });
          break;
        }
        case 'shoppingSection':
          await updateShoppingSection({
            sectionId: item.originalItem?._id as Id<"shoppingListSections">,
            name: item.data.name as string,
          });
          result = { success: true, message: "Shopping section updated successfully" };
          break;
        case 'survey':
          result = await editConfirmedSurvey({
            surveyId: item.originalItem?._id as Id<"surveys">,
            updates: item.updates as Record<string, unknown>
          });
          break;
        default:
          throw new Error(`Unknown content type for editing: ${item.type}`);
      }
    } else {
      // Create operations
      switch (item.type) {
        case 'task':
        case 'create_task':
          if (item.operation === 'bulk_edit') {
            const selection = extractBulkSelection(item);
            const updates = extractBulkUpdates(item);

            if (Object.keys(updates).length > 0) {
              result = await bulkEditConfirmedTasks({
                projectId,
                selection,
                updates: updates as {
                  title?: string;
                  description?: string;
                  status?: 'todo' | 'in_progress' | 'review' | 'done';
                  priority?: 'low' | 'medium' | 'high' | 'urgent';
                  assignedTo?: string | null;
                  tags?: string[];
                },
                reason: selection.reason,
              });
            } else if (Array.isArray(item.data?.tasks)) {
              const tasks = item.data.tasks as Array<Record<string, unknown>>;
              if (tasks.length === 0) {
                throw new Error("No tasks provided for bulk edit");
              }

              let updatedCount = 0;
              const errors: string[] = [];

              for (const taskUpdate of tasks) {
                try {
                  const { taskId, ...updatesForTask } = taskUpdate as {
                    taskId?: string;
                    [key: string]: unknown;
                  };
                  if (!taskId) continue;

                  const cleanUpdates = { ...updatesForTask } as Record<string, unknown>;
                  delete cleanUpdates.assignedToName;

                  const editResult = await editConfirmedTask({
                    taskId: taskId as Id<"tasks">,
                    updates: cleanUpdates as {
                      title?: string;
                      description?: string;
                      content?: string;
                      status?: 'todo' | 'in_progress' | 'review' | 'done';
                      assignedTo?: string | null;
                      priority?: 'low' | 'medium' | 'high' | 'urgent';
                      startDate?: string;
                      endDate?: string;
                      tags?: string[];
                      cost?: number;
                    },
                  });

                  if (editResult.success) {
                    updatedCount++;
                  } else {
                    errors.push(editResult.message);
                  }
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  errors.push(message);
                }
              }

              result = {
                success: errors.length === 0,
                message: errors.length === 0
                  ? `Updated ${updatedCount}/${tasks.length} tasks successfully`
                  : `Updated ${updatedCount}/${tasks.length} tasks with errors: ${errors.slice(0, 3).join(', ')}`,
              };
            } else {
              throw new Error("No updates provided for bulk edit");
            }
          } else {
            const cleanTaskData = { ...(item.data as Record<string, unknown>) };
            delete cleanTaskData.assignedToName;
            result = await createConfirmedTask({
              projectId,
              taskData: cleanTaskData as {
                title: string;
                status?: 'todo' | 'in_progress' | 'review' | 'done';
                description?: string;
                assignedTo?: string | null;
                priority?: 'low' | 'medium' | 'high' | 'urgent';
                startDate?: string;
                endDate?: string;
                tags?: string[];
                cost?: number;
              },
            });
          }
          break;
        case 'create_multiple_notes':
        case 'create_note':
        case 'note':
          result = await createConfirmedNote({
            projectId,
            noteData: item.data as { title: string; content: string }
          });
          break;
        case 'create_multiple_shopping_items':
        case 'create_shopping_item':
        case 'shopping': {
          const rawShoppingData = item.data as ShoppingItemInput;
          const { sectionName, ...shoppingItemData } = rawShoppingData;
          const targetSectionName = resolveSectionName(sectionName, rawShoppingData.category);

          if (targetSectionName && !shoppingItemData.sectionId) {
            const sectionId = await findOrCreateSection(targetSectionName);
            if (sectionId) {
              shoppingItemData.sectionId = sectionId;
            }
          }

          const sanitizedItemData = sanitizeShoppingItemData(shoppingItemData);

          result = await createConfirmedShoppingItem({
            projectId,
            itemData: sanitizedItemData as {
              name: string;
              quantity: number;
              notes?: string;
              priority?: "low" | "medium" | "high" | "urgent";
              buyBefore?: string;
              supplier?: string;
              category?: string;
              unitPrice?: number;
              sectionId?: Id<"shoppingListSections">;
            },
          });
          break;
        }
        case 'shoppingSection':
          await createShoppingSection({
            projectId,
            name: item.data.name as string,
          });
          result = { success: true, message: "Shopping section created successfully" };
          break;
        case 'create_multiple_surveys':
        case 'create_survey':
        case 'survey':
          result = await createConfirmedSurvey({
            projectId,
            surveyData: extractSurveyData(item.data)
          });
          break;
        case 'contact':
        case 'create_contact': {
          const slug = resolveTeamSlug();
          if (!slug) {
            throw new Error("Missing team slug for contact creation");
          }
          result = await createConfirmedContact({
            teamSlug: slug,
            contactData: sanitizeContactData(item.data),
          });
          break;
        }
        default:
          throw new Error(`Unknown content type: ${item.type}`);
      }
    }

    return result;
  }, [
    projectId,
    resolveTeamSlug,
    findOrCreateSection,
    createConfirmedTask,
    createConfirmedNote,
    createConfirmedShoppingItem,
    createConfirmedSurvey,
    createConfirmedContact,
    editConfirmedTask,
    editConfirmedNote,
    editConfirmedShoppingItem,
    editConfirmedSurvey,
    bulkEditConfirmedTasks,
    deleteTask,
    deleteNote,
    deleteShoppingItem,
    deleteShoppingSection,
    deleteSurvey,
    deleteContact,
    createShoppingSection,
    updateShoppingSection,
  ]);

  // Handlers
  const handleContentConfirm = useCallback(async () => {
    if (!projectId || pendingItems.length === 0) return;

    const currentItem = pendingItems[currentItemIndex];
    setIsCreatingContent(true);

    try {
      const result = await confirmSingleItem(currentItem);

      if (result.success) {
        toast.success(result.message);

        if (currentItem.functionCall && currentItem.responseId && threadId) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId,
              responseId: currentItem.responseId,
              results: [{
                callId: currentItem.functionCall.callId,
                result: JSON.stringify(result),
              }]
            });
          } catch (e) {
            console.error("Failed to mark function call as confirmed", e);
          }
        }

        const itemTitle = currentItem.data.title || currentItem.data.name || currentItem.data.content;
        const successMessage = itemTitle
          ? `✅ ${result.message}: ${itemTitle}`
          : `✅ ${result.message}`;

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage
        }]);

        if (currentItemIndex < pendingItems.length - 1) {
          setCurrentItemIndex(prev => prev + 1);
        } else {
          setIsConfirmationDialogOpen(false);
          setPendingItems([]);
          setCurrentItemIndex(0);
        }
      }
    } catch (error) {
      console.error(`Error creating ${currentItem.type}:`, error);
      toast.error(`Failed to create ${currentItem.type}`);
    } finally {
      setIsCreatingContent(false);
    }
  }, [projectId, pendingItems, currentItemIndex, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, setChatHistory]);

  const handleContentCancel = useCallback(() => {
    const currentItem = pendingItems[currentItemIndex];
    
    if (currentItemIndex < pendingItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else {
      setIsConfirmationDialogOpen(false);
      setPendingItems([]);
      setCurrentItemIndex(0);
    }

    toast.info(`${currentItem?.type || 'Item'} creation cancelled`);
  }, [pendingItems, currentItemIndex]);

  const handleContentEdit = useCallback((data: Record<string, unknown>) => {
    setPendingItems(prev => {
      const updated = [...prev];
      if (updated[currentItemIndex]) {
        updated[currentItemIndex] = {
          ...updated[currentItemIndex],
          data: { ...updated[currentItemIndex].data, ...data },
        };
      }
      return updated;
    });
  }, [currentItemIndex]);

  const handleContentDialogClose = useCallback(() => {
    setIsConfirmationDialogOpen(false);
    if (editingItemIndex !== null) {
      setShowConfirmationGrid(true);
      setEditingItemIndex(null);
    }
  }, [editingItemIndex]);

  const handleConfirmAll = useCallback(async () => {
    setIsBulkProcessing(true);
    try {
      let successCount = 0;
      let failureCount = 0;
      const resultsByResponseId = new Map<string, { callId: string; result: string }[]>();
      const createdItemsDetails: string[] = [];

      for (const item of pendingItems) {
        try {
          const result = await confirmSingleItem(item);
          successCount++;

          if (result.success) {
            if ('taskId' in result && result.taskId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Task "${title}"`);
            } else if ('noteId' in result && result.noteId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Note "${title}"`);
            } else if ('itemId' in result && result.itemId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Shopping item "${name}"`);
            } else if ('surveyId' in result && result.surveyId) {
              const title = (item.data as { title?: string }).title || 'Untitled';
              createdItemsDetails.push(`Survey "${title}"`);
            } else if ('contactId' in result && result.contactId) {
              const name = (item.data as { name?: string }).name || 'Unnamed';
              createdItemsDetails.push(`Contact "${name}"`);
            }
          }

          if (item.functionCall && item.responseId && result) {
            if (!resultsByResponseId.has(item.responseId)) {
              resultsByResponseId.set(item.responseId, []);
            }
            resultsByResponseId.get(item.responseId)!.push({
              callId: item.functionCall.callId,
              result: JSON.stringify(result),
            });
          }
        } catch (error) {
          console.error(`Failed to create ${item.type}:`, error);
          failureCount++;
        }
      }

      if (threadId) {
        for (const [responseId, results] of resultsByResponseId.entries()) {
          try {
            await markFunctionCallsAsConfirmed({
              threadId,
              responseId,
              results,
            });
          } catch (e) {
            console.error("Failed to mark function calls as confirmed", e);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} items${failureCount > 0 ? `, ${failureCount} failed` : ''}`);

        let successMessage = `✅ Successfully created ${successCount} items${failureCount > 0 ? ` (${failureCount} failed)` : ''}`;
        if (createdItemsDetails.length > 0) {
          successMessage += '\n\nCreated items:\n' + createdItemsDetails.join('\n');
        }

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: successMessage
        }]);
      }

      if (failureCount > 0 && successCount === 0) {
        toast.error(`Failed to create all ${failureCount} items`);
      }

      setPendingItems([]);
      setShowConfirmationGrid(false);
    } catch {
      toast.error("Failed to process items");
    } finally {
      setIsBulkProcessing(false);
    }
  }, [pendingItems, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, setChatHistory]);

  const handleConfirmItem = useCallback(async (index: number) => {
    const item = pendingItems[index];
    try {
      const result = await confirmSingleItem(item);

      if (item.functionCall && item.responseId && threadId) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId,
            responseId: item.responseId,
            results: [{
              callId: item.functionCall.callId,
              result: JSON.stringify(result),
            }]
          });
        } catch (e) {
          console.error("Failed to mark function call as confirmed", e);
        }
      }

      setPendingItems(prev => prev.filter((_, i) => i !== index));

      let successMessage = result.message || `${item.type} created successfully`;
      if ('taskId' in result && result.taskId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Task "${title}" created`;
      } else if ('noteId' in result && result.noteId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Note "${title}" created`;
      } else if ('itemId' in result && result.itemId) {
        const name = (item.data as { name?: string }).name || 'Unnamed';
        successMessage = `Shopping item "${name}" created`;
      } else if ('surveyId' in result && result.surveyId) {
        const title = (item.data as { title?: string }).title || 'Untitled';
        successMessage = `Survey "${title}" created`;
      } else if ('contactId' in result && result.contactId) {
        const name = (item.data as { name?: string }).name || 'Unnamed';
        successMessage = `Contact "${name}" created`;
      }

      toast.success(successMessage);

      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `✅ ${successMessage}`
      }]);

      if (pendingItems.length === 1) {
        setShowConfirmationGrid(false);
      }
    } catch (error) {
      toast.error(`Failed to create ${item.type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pendingItems, threadId, confirmSingleItem, markFunctionCallsAsConfirmed, setChatHistory]);

  const handleRejectItem = useCallback(async (index: number) => {
    const item = pendingItems[index];
    setPendingItems(prev => prev.filter((_, i) => i !== index));
    
    if (pendingItems.length === 1) {
      setShowConfirmationGrid(false);
    }
    
    toast.info(`${item.type} creation cancelled`);

    if (item.functionCall && item.responseId && threadId) {
      try {
        await markFunctionCallsAsConfirmed({
          threadId,
          responseId: item.responseId,
          results: [{
            callId: item.functionCall.callId,
            result: undefined,
          }],
        });
      } catch (error) {
        console.error("Failed to mark function call as rejected", error);
      }
    }

    setChatHistory(prev => [
      ...prev,
      {
        role: "assistant",
        content: `❌ Rejected ${item.type} suggestion${item.data?.title ? `: "${item.data.title}"` : ""}.`,
      },
    ]);
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, setChatHistory]);

  const handleRejectAll = useCallback(async () => {
    const itemsToReject = [...pendingItems];
    setPendingItems([]);
    setShowConfirmationGrid(false);
    toast.info("All item creations cancelled");

    if (threadId) {
      const groupedResults = new Map<string, { callId: string; result: string | undefined }[]>();
      for (const item of itemsToReject) {
        if (item.functionCall && item.responseId) {
          if (!groupedResults.has(item.responseId)) {
            groupedResults.set(item.responseId, []);
          }
          groupedResults.get(item.responseId)!.push({
            callId: item.functionCall.callId,
            result: undefined,
          });
        }
      }

      for (const [responseId, results] of groupedResults.entries()) {
        try {
          await markFunctionCallsAsConfirmed({
            threadId,
            responseId,
            results,
          });
        } catch (error) {
          console.error("Failed to mark function calls as rejected", error);
        }
      }
    }

    setChatHistory(prev => [
      ...prev,
      {
        role: "assistant",
        content: "❌ Rejected all pending AI suggestions.",
      },
    ]);
  }, [pendingItems, threadId, markFunctionCallsAsConfirmed, setChatHistory]);

  const handleEditItem = useCallback((index: number) => {
    setEditingItemIndex(index);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(true);
    setCurrentItemIndex(index);
  }, []);

  const resetPendingState = useCallback(() => {
    setPendingItems([]);
    setCurrentItemIndex(0);
    setShowConfirmationGrid(false);
    setIsConfirmationDialogOpen(false);
    setEditingItemIndex(null);
  }, []);

  return {
    pendingItems,
    setPendingItems,
    currentItemIndex,
    setCurrentItemIndex,
    isConfirmationDialogOpen,
    setIsConfirmationDialogOpen,
    showConfirmationGrid,
    setShowConfirmationGrid,
    isCreatingContent,
    isBulkProcessing,
    editingItemIndex,
    setEditingItemIndex,
    handleContentConfirm,
    handleContentCancel,
    handleContentEdit,
    handleContentDialogClose,
    handleConfirmAll,
    handleConfirmItem,
    handleRejectItem,
    handleRejectAll,
    handleEditItem,
    resetPendingState,
  };
};

export default usePendingItems;








