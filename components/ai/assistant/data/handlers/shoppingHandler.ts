/**
 * Shopping Item Confirmation Handler
 * 
 * Handles confirmation of shopping-related pending items.
 */

import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem, ShoppingItemInput } from "../types";
import type { ConfirmContext, ConfirmResult } from "./types";
import { sanitizeShoppingItemData, resolveSectionName } from "../utils";

interface ShoppingSectionData {
  _id: Id<"shoppingListSections">;
  name: string;
}

interface ShoppingMutations {
  createConfirmedShoppingItem: (args: { projectId: string; itemData: ShoppingItemInput }) => Promise<{ success: boolean; message: string; itemId?: string }>;
  editConfirmedShoppingItem: (args: { itemId: string; updates: Partial<ShoppingItemInput> }) => Promise<{ success: boolean; message: string }>;
  deleteShoppingItem: (args: { itemId: string }) => Promise<void>;
  createShoppingSection: (args: { projectId: string; name: string }) => Promise<Id<"shoppingListSections">>;
}

export function createShoppingHandler(
  mutations: ShoppingMutations,
  shoppingSections: ShoppingSectionData[] | undefined
) {
  const findOrCreateSection = async (
    sectionName: string,
    projectId: Id<"projects">
  ): Promise<Id<"shoppingListSections"> | undefined> => {
    const existing = shoppingSections?.find(
      (s) => s.name.toLowerCase() === sectionName.toLowerCase()
    );
    if (existing) return existing._id;

    try {
      return await mutations.createShoppingSection({
        projectId,
        name: sectionName,
      });
    } catch (error) {
      console.error("Failed to create section:", error);
      return undefined;
    }
  };

  return async (item: PendingItem, context: ConfirmContext): Promise<ConfirmResult> => {
    const { projectId } = context;
    const { operation, data } = item;

    switch (operation) {
      case "create": {
        const shoppingData = data as ShoppingItemInput & { sectionName?: string };
        const { sectionName, ...itemData } = shoppingData;

        // Resolve section
        const targetSectionName = resolveSectionName(sectionName, itemData.category);
        if (targetSectionName && !itemData.sectionId) {
          const sectionId = await findOrCreateSection(targetSectionName, projectId as Id<"projects">);
          if (sectionId) {
            itemData.sectionId = sectionId;
          }
        }

        const sanitizedData = sanitizeShoppingItemData(itemData as Record<string, unknown>);

        const result = await mutations.createConfirmedShoppingItem({
          projectId,
          itemData: sanitizedData as ShoppingItemInput,
        });

        return {
          success: result.success,
          message: result.message,
          id: result.itemId,
        };
      }

      case "edit": {
        const editData = data as { itemId: string } & Partial<ShoppingItemInput>;
        const { itemId, ...updates } = editData;

        if (!itemId) {
          return { success: false, message: "No shopping item ID provided for edit" };
        }

        const sanitizedUpdates = sanitizeShoppingItemData(updates as Record<string, unknown>);

        const result = await mutations.editConfirmedShoppingItem({
          itemId,
          updates: sanitizedUpdates as Partial<ShoppingItemInput>,
        });

        return {
          success: result.success,
          message: result.message,
        };
      }

      case "delete": {
        const deleteData = data as { itemId: string };
        
        if (!deleteData.itemId) {
          return { success: false, message: "No shopping item ID provided for deletion" };
        }

        await mutations.deleteShoppingItem({ itemId: deleteData.itemId });
        return { success: true, message: "Shopping item deleted successfully" };
      }

      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }
  };
}


