/**
 * Survey Confirmation Handler
 * 
 * Handles confirmation of survey-related pending items.
 */

import type { PendingItem, SurveyData } from "../types";
import type { ConfirmContext, ConfirmResult } from "./types";

interface SurveyMutations {
  createConfirmedSurvey: (args: { projectId: string; surveyData: SurveyData }) => Promise<{ success: boolean; message: string; surveyId?: string }>;
  editConfirmedSurvey: (args: { surveyId: string; updates: Partial<SurveyData> }) => Promise<{ success: boolean; message: string }>;
  deleteSurvey: (args: { surveyId: string }) => Promise<void>;
}

export function createSurveyHandler(mutations: SurveyMutations) {
  return async (item: PendingItem, context: ConfirmContext): Promise<ConfirmResult> => {
    const { projectId } = context;
    const { operation, data } = item;

    switch (operation) {
      case "create": {
        const surveyData = data as SurveyData;
        
        const result = await mutations.createConfirmedSurvey({
          projectId,
          surveyData,
        });

        return {
          success: result.success,
          message: result.message,
          id: result.surveyId,
        };
      }

      case "edit": {
        const editData = data as { surveyId: string } & Partial<SurveyData>;
        const { surveyId, ...updates } = editData;

        if (!surveyId) {
          return { success: false, message: "No survey ID provided for edit" };
        }

        const result = await mutations.editConfirmedSurvey({
          surveyId,
          updates,
        });

        return {
          success: result.success,
          message: result.message,
        };
      }

      case "delete": {
        const deleteData = data as { surveyId: string };
        
        if (!deleteData.surveyId) {
          return { success: false, message: "No survey ID provided for deletion" };
        }

        await mutations.deleteSurvey({ surveyId: deleteData.surveyId });
        return { success: true, message: "Survey deleted successfully" };
      }

      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }
  };
}


