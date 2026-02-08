import type { Id } from "../_generated/dataModel";

export interface DiaryEntryContext {
  date: string;
  content: string;
  mood?: string;
  source: "user" | "assistant";
}

export interface ProjectContextSnapshot {
  project: ProjectSummary | null;
  tasks: Array<TaskContext>;
  habits: Array<HabitContext>;
  files: Array<FileContext>;
  diaryEntries: Array<DiaryEntryContext>;
  summary: string;
}

export interface ProjectSummary {
  _id: string;
  name: string;
  description?: string;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  startDate?: number;
  endDate?: number;
  location?: string;
  teamId?: Id<"teams">;
  assistantPreset?: string;
  assistantOnboardingStatus?: "pending" | "completed";
}

export interface TaskContext {
  _id: string;
  title: string;
  description?: string;
  content?: string;
  status: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assignedTo?: string | null;
  assignedToName?: string;
  startDate?: number;
  endDate?: number;
  cost?: number;
}

export interface HabitContext {
  _id: string;
  name: string;
  description?: string;
  targetValue?: number;
  unit?: string;
  frequency?: "daily" | "weekly";
  scheduleDays?: string[];
  reminderTime?: string;
  isActive: boolean;
  completedToday?: boolean;
}

export interface FileContext {
  _id: string;
  name: string;
  description?: string;
  fileType: "image" | "video" | "document" | "drawing" | "model" | "other";
  size: number;
  mimeType: string;
  moodboardSection?: string;
  extractedText?: string;
  pdfAnalysis?: string;
}

// Additional types for AI processing
export interface TeamMember {
  name?: string | null;
  email?: string | null;
  clerkUserId?: string;
}

export interface AITokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

export interface PendingItem {
  type: "task" | "habit";
  operation?: "create" | "edit" | "delete" | "bulk_edit" | "bulk_create" | "complete";
  data: any;
  updates?: any;
  originalItem?: any;
  functionCall?: {
    callId: string;
    functionName: string;
    arguments: string;
  };
  responseId?: string;
}
