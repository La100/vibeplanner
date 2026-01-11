/**
 * Confirm Handler Types
 * 
 * Type definitions for confirmation handler strategy pattern.
 */

import type { Id } from "@/convex/_generated/dataModel";
import type { PendingItem } from "../types";

export interface ConfirmResult {
  success: boolean;
  message: string;
  id?: string;
}

export interface ConfirmContext {
  projectId: Id<"projects">;
  teamSlug?: string;
}

export type ConfirmHandler = (
  item: PendingItem,
  context: ConfirmContext,
  mutations: Record<string, (...args: unknown[]) => Promise<unknown>>
) => Promise<ConfirmResult>;


