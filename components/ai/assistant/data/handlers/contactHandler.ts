/**
 * Contact Confirmation Handler
 * 
 * Handles confirmation of contact-related pending items.
 */

import type { PendingItem, ContactInput } from "../types";
import type { ConfirmContext, ConfirmResult } from "./types";
import { sanitizeContactData } from "../utils";

interface ContactMutations {
  createConfirmedContact: (args: { projectId: string; teamSlug?: string; contactData: ContactInput }) => Promise<{ success: boolean; message: string; contactId?: string }>;
  deleteContact: (args: { contactId: string }) => Promise<void>;
}

export function createContactHandler(mutations: ContactMutations) {
  return async (item: PendingItem, context: ConfirmContext): Promise<ConfirmResult> => {
    const { projectId, teamSlug } = context;
    const { operation, data } = item;

    switch (operation) {
      case "create": {
        const contactData = data as ContactInput;
        const sanitizedData = sanitizeContactData(contactData);

        const result = await mutations.createConfirmedContact({
          projectId,
          teamSlug,
          contactData: sanitizedData,
        });

        return {
          success: result.success,
          message: result.message,
          id: result.contactId,
        };
      }

      case "delete": {
        const deleteData = data as { contactId: string };
        
        if (!deleteData.contactId) {
          return { success: false, message: "No contact ID provided for deletion" };
        }

        await mutations.deleteContact({ contactId: deleteData.contactId });
        return { success: true, message: "Contact deleted successfully" };
      }

      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }
  };
}


