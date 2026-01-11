/**
 * Confirm Handlers Index
 * 
 * Exports all confirmation handler types and utilities.
 * This module provides a strategy pattern for handling different
 * pending item types during confirmation.
 */

export type { ConfirmHandler, ConfirmContext } from "./types";
export { createTaskHandler } from "./taskHandler";
export { createNoteHandler } from "./noteHandler";
export { createShoppingHandler } from "./shoppingHandler";
export { createLaborHandler } from "./laborHandler";
export { createSurveyHandler } from "./surveyHandler";
export { createContactHandler } from "./contactHandler";

