/**
 * Workflow Context Builder
 * 
 * Builds AI context for workflow execution, integrating:
 * - Current workflow step prompt
 * - Previous step responses
 * - File context (if uploaded)
 * - Workflow-specific instructions
 */

import type { WorkflowAIContext, WorkflowSession, WorkflowDefinition, WorkflowStep } from "../workflows/types";
import { getWorkflow, getWorkflowStep } from "../workflows/loader";

/**
 * Build the system prompt section for a workflow step
 */
export function buildWorkflowSystemPrompt(
  workflow: WorkflowDefinition,
  currentStep: WorkflowStep,
  previousResponses: Record<string, string>
): string {
  const parts: string[] = [];

  // Workflow header
  parts.push(`## 🔧 AKTYWNY WORKFLOW: ${workflow.name}`);
  parts.push("");
  parts.push(`**Opis**: ${workflow.description}`);
  parts.push("");

  // Current step info
  parts.push(`### Aktualny krok: ${currentStep.name}`);
  if (currentStep.description) {
    parts.push(`*${currentStep.description}*`);
  }
  parts.push("");

  // Previous responses context (if any)
  if (Object.keys(previousResponses).length > 0) {
    parts.push("### Poprzednie kroki:");
    for (const [stepId, response] of Object.entries(previousResponses)) {
      const step = workflow.steps.find((s) => s.id === stepId);
      if (step) {
        parts.push(`**${step.name}**:`);
        // Truncate long responses
        const truncatedResponse = response.length > 500 
          ? response.substring(0, 500) + "..." 
          : response;
        parts.push(truncatedResponse);
        parts.push("");
      }
    }
  }

  // Step-specific instructions
  if (currentStep.prompt) {
    parts.push("### Instrukcje dla tego kroku:");
    parts.push(currentStep.prompt);
    parts.push("");
  }

  // Enabled tools guidance
  if (currentStep.enabledTools && currentStep.enabledTools.length > 0) {
    parts.push("### Dostępne narzędzia dla tego kroku:");
    parts.push(currentStep.enabledTools.map((t) => `- \`${t}\``).join("\n"));
    parts.push("");
    parts.push("*Użyj powyższych narzędzi aby wykonać zadania w tym kroku.*");
  }

  // Workflow help content
  if (workflow.content) {
    parts.push("");
    parts.push("### Dodatkowe informacje o workflow:");
    parts.push(workflow.content);
  }

  return parts.join("\n");
}

/**
 * Build full AI context for workflow execution
 */
export function buildWorkflowAIContext(session: WorkflowSession): WorkflowAIContext | null {
  const { workflow, currentStepIndex, stepResponses } = session;
  
  if (currentStepIndex >= workflow.steps.length) {
    return null; // Workflow completed
  }

  const currentStep = workflow.steps[currentStepIndex];
  
  return {
    workflowId: workflow.id,
    stepId: currentStep.id,
    stepPrompt: currentStep.prompt || "",
    workflowInstructions: buildWorkflowSystemPrompt(workflow, currentStep, stepResponses),
    previousResponses: stepResponses,
    hasFiles: session.uploadedFileIds.length > 0,
  };
}

/**
 * Create the workflow context section to inject into the main system prompt
 */
export function createWorkflowContextSection(
  workflowId: string,
  stepId: string,
  previousResponses: Record<string, string> = {},
  hasUploadedFile: boolean = false
): string | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;

  const currentStep = getWorkflowStep(workflowId, stepId);
  if (!currentStep) return null;

  const parts: string[] = [];

  // Workflow mode indicator
  parts.push("=".repeat(60));
  parts.push("TRYB WORKFLOW - KREATOR PROWADZONY");
  parts.push("=".repeat(60));
  parts.push("");

  // Core workflow prompt
  parts.push(buildWorkflowSystemPrompt(workflow, currentStep, previousResponses));

  // File upload reminder
  if (hasUploadedFile) {
    parts.push("");
    parts.push("📎 **PLIK WGRANY**: Użytkownik wgrał plik. Przeanalizuj go w kontekście tego kroku workflow.");
  } else if (currentStep.requiresUpload) {
    parts.push("");
    parts.push("⚠️ **OCZEKIWANIE NA PLIK**: Ten krok wymaga wgrania pliku. Poproś użytkownika o wgranie odpowiedniego pliku.");
  }

  // Step navigation info
  const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
  const totalSteps = workflow.steps.length;
  parts.push("");
  parts.push(`📍 Krok ${stepIndex + 1} z ${totalSteps}`);

  if (stepIndex < totalSteps - 1) {
    const nextStep = workflow.steps[stepIndex + 1];
    parts.push(`➡️ Następny krok: ${nextStep.name}`);
  } else {
    parts.push("✅ To jest ostatni krok workflow.");
  }

  parts.push("");
  parts.push("=".repeat(60));

  return parts.join("\n");
}

/**
 * Get the initial message for a workflow step (shown to user)
 */
export function getStepInitialMessage(workflowId: string, stepId: string): string {
  const workflow = getWorkflow(workflowId);
  const step = getWorkflowStep(workflowId, stepId);

  if (!workflow || !step) {
    return "Rozpoczynamy workflow...";
  }

  if (step.requiresUpload && !step.prompt) {
    return `**${step.name}**\n\n${step.description || "Wgraj plik aby kontynuować."}\n\nKliknij przycisk załącznika aby dodać plik.`;
  }

  return `**${step.name}**\n\n${step.description || ""}`;
}

/**
 * Validate if a step can be executed
 */
export function canExecuteStep(
  workflowId: string,
  stepId: string,
  hasUploadedFile: boolean
): { canExecute: boolean; reason?: string } {
  const step = getWorkflowStep(workflowId, stepId);

  if (!step) {
    return { canExecute: false, reason: "Nie znaleziono kroku workflow." };
  }

  if (step.requiresUpload && !hasUploadedFile) {
    return { canExecute: false, reason: "Ten krok wymaga wgrania pliku." };
  }

  if (!step.prompt && !step.requiresUpload) {
    return { canExecute: false, reason: "Ten krok nie ma zdefiniowanego zadania." };
  }

  return { canExecute: true };
}

/**
 * Get progress percentage for a workflow
 */
export function getWorkflowProgress(workflowId: string, completedStepIds: string[]): number {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return 0;

  const completedCount = completedStepIds.filter((id) =>
    workflow.steps.some((s) => s.id === id)
  ).length;

  return Math.round((completedCount / workflow.steps.length) * 100);
}

/**
 * Check if workflow is complete
 */
export function isWorkflowComplete(workflowId: string, completedStepIds: string[]): boolean {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return false;

  return workflow.steps.every((step) => completedStepIds.includes(step.id));
}



