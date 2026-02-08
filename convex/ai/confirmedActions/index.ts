/**
 * Confirmed Actions - Barrel Export
 * 
 * Re-exports all confirmed action functions for AI suggestions.
 * These actions require user confirmation before execution.
 */

// Helpers (for internal use)
export { requireIdentity, ensureProjectAccess, ensureTeamMembership } from "./helpers";

// Task actions
export { createConfirmedTask, editConfirmedTask, deleteConfirmedTask } from "./tasks";

// Habit actions
export { createConfirmedHabit } from "./habits";


// Shopping/Labor/Survey actions removed in assistant-only build

















