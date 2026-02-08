/**
 * Confirmed Actions - Re-exports
 * 
 * This file re-exports all confirmed actions from the confirmedActions/ folder.
 * 
 * The actual implementations are now organized by entity type:
 * - confirmedActions/tasks.ts - Task CRUD
 * - confirmedActions/helpers.ts - Access control helpers
 */

export {
  // Tasks
  createConfirmedTask,
  editConfirmedTask,
  deleteConfirmedTask,
} from "./confirmedActions/index";

export {
  createConfirmedHabit,
} from "./confirmedActions/index";
