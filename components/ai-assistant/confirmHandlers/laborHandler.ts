/**
 * Labor Item Confirmation Handler
 * 
 * Handles confirmation of labor/work item related pending items.
 */

import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem, LaborItemInput } from "../types";
import type { ConfirmContext, ConfirmResult } from "./types";
import { resolveSectionName } from "../utils";

interface LaborSectionData {
  _id: Id<"laborSections">;
  name: string;
}

interface LaborMutations {
  createConfirmedLaborItem: (args: { projectId: string; itemData: LaborItemInput }) => Promise<{ success: boolean; message: string; itemId?: string }>;
  editConfirmedLaborItem: (args: { itemId: string; updates: Partial<LaborItemInput> }) => Promise<{ success: boolean; message: string }>;
  deleteLaborItem: (args: { itemId: string }) => Promise<void>;
  createLaborSection: (args: { projectId: string; name: string }) => Promise<Id<"laborSections">>;
}

export function createLaborHandler(
  mutations: LaborMutations,
  laborSections: LaborSectionData[] | undefined
) {
  const findOrCreateSection = async (
    sectionName: string,
    projectId: Id<"projects">
  ): Promise<Id<"laborSections"> | undefined> => {
    const existing = laborSections?.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );
    if (existing) return existing._id;

    try {
      return await mutations.createLaborSection({
        projectId,
        name: sectionName,
      });
    } catch (error) {
      console.error("Failed to create labor section:", error);
      return undefined;
    }
  };

  return async (item: PendingItem, context: ConfirmContext): Promise<ConfirmResult> => {
    const { projectId } = context;
    const { operation, data } = item;

    switch (operation) {
      case "create": {
        const laborData = data as LaborItemInput & { sectionName?: string };
        const { sectionName, ...itemData } = laborData;

        // Resolve section
        const targetSectionName = sectionName || resolveSectionName(sectionName, undefined);
        if (targetSectionName && !itemData.sectionId) {
          const sectionId = await findOrCreateSection(targetSectionName, projectId as Id<"projects">);
          if (sectionId) {
            itemData.sectionId = sectionId;
          }
        }

        const result = await mutations.createConfirmedLaborItem({
          projectId,
          itemData,
        });

        return {
          success: result.success,
          message: result.message,
          id: result.itemId,
        };
      }

      case "edit": {
        const editData = data as { itemId: string } & Partial<LaborItemInput>;
        const { itemId, ...updates } = editData;

        if (!itemId) {
          return { success: false, message: "No labor item ID provided for edit" };
        }

        const result = await mutations.editConfirmedLaborItem({
          itemId,
          updates,
        });

        return {
          success: result.success,
          message: result.message,
        };
      }

      case "delete": {
        const deleteData = data as { itemId: string };
        
        if (!deleteData.itemId) {
          return { success: false, message: "No labor item ID provided for deletion" };
        }

        await mutations.deleteLaborItem({ itemId: deleteData.itemId });
        return { success: true, message: "Labor item deleted successfully" };
      }

      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }
  };
}
