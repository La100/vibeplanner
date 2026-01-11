/**
 * AI Assistant Module - Barrel Export
 * 
 * This module provides all types, utilities, constants, and hooks
 * for the AI Assistant feature.
 */

// Types
export * from "./types";

// Constants
export * from "./constants";

// Utilities
export * from "./utils";

// Hooks
export { useAIChat } from "./useAIChat";
export { usePendingItems } from "./usePendingItems";
export { useFileUpload } from "./useFileUpload";

// Components
export { StreamingMessage, StreamingMessageList } from "./StreamingMessage";
export { MessageStepList, StepContainer, ToolCallStep, ReasoningStep, TextStep } from "./MessageSteps";
export { ConfirmationCard, InlineConfirmationList } from "./InlineConfirmation";
export { getToolConfig, getCategoryStyles, TOOL_CONFIGS } from "./ToolIcons";
export { WorkflowWizard } from "./WorkflowWizard";
export { ChatSidebar } from "./ChatSidebar";
export { ChatInput } from "./ChatInput";
export { ChatMessageList } from "./ChatMessageList";

