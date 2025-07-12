"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Users, Calendar, FileText } from "lucide-react";

interface SurveyResponsesPageProps {
  params: Promise<{
    slug: string;
    projectSlug: string;
    surveyId: string;
  }>;
}

export default function SurveyResponsesPage({ params }: SurveyResponsesPageProps) {
  const router = useRouter();
  const [routeParams, setRouteParams] = useState<{
    surveyId: Id<"surveys">;
    projectSlug: string;
    teamSlug: string;
  } | null>(null);

  useEffect(() => {
    params.then(p => {
      setRouteParams({
        surveyId: p.surveyId as Id<"surveys">,
        projectSlug: p.projectSlug,
        teamSlug: p.slug,
      });
    });
  }, [params]);

  const survey = useQuery(api.surveys.getSurvey, 
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );
  const responses = useQuery(api.surveys.getSurveyResponses, 
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );

  if (!survey || !routeParams) {
    return <div>Loading...</div>;
  }

  const getAnswerDisplay = (answer: {
    answerType: string;
    textAnswer?: string;
    choiceAnswers?: string[];
    ratingAnswer?: number;
    numberAnswer?: number;
    booleanAnswer?: boolean;
  }, question: { ratingScale?: { max?: number } }) => {
    switch (answer.answerType) {
      case "text":
        return answer.textAnswer || "-";
      case "choice":
        return answer.choiceAnswers?.join(", ") || "-";
      case "rating":
        return `${answer.ratingAnswer}/${question.ratingScale?.max || 5}`;
      case "number":
        return answer.numberAnswer?.toString() || "-";
      case "boolean":
        return answer.booleanAnswer ? "Tak" : "Nie";
      default:
        return "-";
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "text_short":
        return "Krótki tekst";
      case "text_long":
        return "Długi tekst";
      case "multiple_choice":
        return "Wielokrotny wybór";
      case "single_choice":
        return "Jeden wybór";
      case "rating":
        return "Ocena";
      case "yes_no":
        return "Tak/Nie";
      case "number":
        return "Liczba";
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${routeParams.teamSlug}/${routeParams.projectSlug}/surveys`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wróć do ankiet
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Odpowiedzi na ankietę</h1>
          <p className="text-gray-600">{survey.title}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Odpowiedzi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responses?.length || 0}</div>
            <p className="text-sm text-gray-600">Łączna liczba odpowiedzi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pytania
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{survey.questions.length}</div>
            <p className="text-sm text-gray-600">Liczba pytań</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={survey.status === "active" ? "default" : "secondary"}>
              {survey.status === "active" ? "Aktywna" : "Nieaktywna"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {responses?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Brak odpowiedzi</CardTitle>
            <CardDescription>
              Nikt jeszcze nie odpowiedział na tę ankietę.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {responses?.map((response, responseIndex) => (
            <Card key={response._id}>
              <CardHeader>
                <CardTitle className="text-xl">
                  Odpowiedź #{responseIndex + 1}
                </CardTitle>
                <CardDescription>
                  Wysłano: {new Date(response.submittedAt || 0).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {survey.questions.map((question, questionIndex) => {
                    const answer = response.answers.find(a => a.questionId === question._id);
                    
                    return (
                      <div key={question._id} className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-xs">
                            {questionIndex + 1}
                          </Badge>
                          <div className="flex-1">
                            <div className="font-medium">{question.questionText}</div>
                            <div className="text-sm text-gray-600 mb-2">
                              {getQuestionTypeLabel(question.questionType)}
                              {question.isRequired && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              {answer ? getAnswerDisplay(answer, question) : (
                                <span className="text-gray-500 italic">Brak odpowiedzi</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {questionIndex < survey.questions.length - 1 && (
                          <Separator className="my-4" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}