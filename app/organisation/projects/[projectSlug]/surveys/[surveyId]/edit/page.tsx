"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { EditSurveyForm } from "@/components/surveys/EditSurveyForm";

export default function EditSurveyPage() {
  const params = useParams();
  const surveyId = params.surveyId as Id<"surveys">;

  const survey = useQuery(api.surveys.getSurvey, { surveyId });

  if (!survey) {
    return <div>Ładowanie...</div>;
  }

  // Transform the survey data to match the expected format
  const transformedSurvey = {
    ...survey,
    questions: survey.questions?.map(question => ({
      ...question,
      id: question._id.toString(), // Map _id to string id
    })) || []
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Edytuj ankietę</h1>
      <EditSurveyForm survey={transformedSurvey} />
    </div>
  );
}