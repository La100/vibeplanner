import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// REMOVED: Cleanup cron for old RAG system
// The new simplified RAG system (simpleIndexing.ts) doesn't use "replaced" status
// It simply overwrites old entries directly with rag.add()
// 
// Old cron (removed):
// crons.interval("cleanupOldRAGEntries", { hours: 24 }, internal.ai.cleanup.deleteOldReplacedEntries, {});

// Add your new cron jobs here if needed

export default crons;