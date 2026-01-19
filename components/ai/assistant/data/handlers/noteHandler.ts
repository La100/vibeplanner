/**
 * Note Confirmation Handler
 * 
 * Handles confirmation of note-related pending items.
 */

import type { PendingItem, NoteInput } from "../types";
import type { ConfirmContext, ConfirmResult } from "./types";

interface NoteMutations {
  createConfirmedNote: (args: { projectId: string; noteData: NoteInput }) => Promise<{ success: boolean; message: string; noteId?: string }>;
  editConfirmedNote: (args: { noteId: string; updates: Partial<NoteInput> }) => Promise<{ success: boolean; message: string }>;
  deleteNote: (args: { noteId: string }) => Promise<void>;
}

export function createNoteHandler(mutations: NoteMutations) {
  return async (item: PendingItem, context: ConfirmContext): Promise<ConfirmResult> => {
    const { projectId } = context;
    const { operation, data } = item;

    switch (operation) {
      case "create": {
        const noteData = data as NoteInput;
        
        const result = await mutations.createConfirmedNote({
          projectId,
          noteData,
        });

        return {
          success: result.success,
          message: result.message,
          id: result.noteId,
        };
      }

      case "edit": {
        const editData = data as { noteId: string } & Partial<NoteInput>;
        const { noteId, ...updates } = editData;

        if (!noteId) {
          return { success: false, message: "No note ID provided for edit" };
        }

        const result = await mutations.editConfirmedNote({
          noteId,
          updates,
        });

        return {
          success: result.success,
          message: result.message,
        };
      }

      case "delete": {
        const deleteData = data as { noteId: string };
        
        if (!deleteData.noteId) {
          return { success: false, message: "No note ID provided for deletion" };
        }

        await mutations.deleteNote({ noteId: deleteData.noteId });
        return { success: true, message: "Note deleted successfully" };
      }

      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }
  };
}


