"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface SurveyResponsePageProps {
  params: Promise<{
    slug: string;
    projectSlug: string;
    surveyId: string;
  }>;
}

export default function SurveyResponsePage({ params }: SurveyResponsePageProps) {
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

  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<Id<"surveyResponses"> | null>(null);

  const survey = useQuery(api.surveys.getSurvey, 
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );
  const userResponse = useQuery(api.surveys.getUserSurveyResponse, 
    routeParams ? { surveyId: routeParams.surveyId } : "skip"
  );
  const project = useQuery(api.projects.getProject, 
    survey?.projectId ? { projectId: survey.projectId } : "skip"
  );
  const team = useQuery(api.teams.getTeam, 
    project?.teamId ? { teamId: project.teamId } : "skip"
  );
  
  const startResponse = useMutation(api.surveys.startSurveyResponse);
  const saveAnswer = useMutation(api.surveys.saveAnswer);
  const submitResponse = useMutation(api.surveys.submitSurveyResponse);

  useEffect(() => {
    if (userResponse && !userResponse.isComplete) {
      setCurrentResponseId(userResponse._id);
      // Load existing answers
      const existingAnswers: Record<string, unknown> = {};
      userResponse.answers.forEach((answer) => {
        const questionId = answer.questionId;
        switch (answer.answerType) {
          case "text":
            existingAnswers[questionId] = answer.textAnswer;
            break;
          case "choice":
            existingAnswers[questionId] = answer.choiceAnswers;
            break;
          case "rating":
            existingAnswers[questionId] = answer.ratingAnswer;
            break;
          case "number":
            existingAnswers[questionId] = answer.numberAnswer;
            break;
          case "boolean":
            existingAnswers[questionId] = answer.booleanAnswer;
            break;
        }
      });
      setAnswers(existingAnswers);
    }
  }, [userResponse]);

  const handleStartResponse = async () => {
    if (!routeParams) return;
    try {
      const response = await startResponse({ surveyId: routeParams.surveyId });
      if (response) {
        setCurrentResponseId(response._id);
        toast.success("Rozpoczęto wypełnianie ankiety");
      }
    } catch (error) {
      toast.error("Nie można rozpocząć ankiety");
      console.error(error);
    }
  };

  const handleAnswerChange = async (questionId: string, value: unknown, answerType: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    if (currentResponseId) {
      try {
        const baseAnswerData = {
          responseId: currentResponseId,
          questionId: questionId as Id<"surveyQuestions">,
          answerType: answerType as "text" | "choice" | "rating" | "number" | "boolean",
        };

        switch (answerType) {
          case "text":
            await saveAnswer({
              ...baseAnswerData,
              textAnswer: value as string,
            });
            break;
          case "choice":
            await saveAnswer({
              ...baseAnswerData,
              choiceAnswers: Array.isArray(value) ? value as string[] : [value as string],
            });
            break;
          case "rating":
            await saveAnswer({
              ...baseAnswerData,
              ratingAnswer: value as number,
            });
            break;
          case "number":
            await saveAnswer({
              ...baseAnswerData,
              numberAnswer: value as number,
            });
            break;
          case "boolean":
            await saveAnswer({
              ...baseAnswerData,
              booleanAnswer: value as boolean,
            });
            break;
        }
      } catch (error) {
        console.error("Error saving answer:", error);
      }
    }
  };

  const handleSubmit = async () => {
    if (!currentResponseId || !routeParams) return;

    const requiredQuestions = survey?.questions.filter(q => q.isRequired) || [];
    const missingAnswers = requiredQuestions.filter(q => !answers[q._id]);

    if (missingAnswers.length > 0) {
      toast.error("Proszę odpowiedzieć na wszystkie obowiązkowe pytania");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitResponse({ responseId: currentResponseId });
      toast.success("Ankieta została wysłana!");
      router.push(`/${team?.slug}/${routeParams.projectSlug}/surveys`);
    } catch (error) {
      toast.error("Błąd podczas wysyłania ankiety");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!survey || !routeParams) {
    return <div>Loading...</div>;
  }

  const isResponseComplete = userResponse?.isComplete;
  const hasStarted = currentResponseId !== null;

  if (isResponseComplete) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Wróć
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Ankieta wypełniona</CardTitle>
            <CardDescription>
              Dziękujemy za wypełnienie ankiety "{survey.title}". Twoja odpowiedź została zapisana.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Wypełniono: {new Date(userResponse?.submittedAt || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wróć
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{survey.title}</h1>
          {survey.description && (
            <p className="text-gray-600 mt-2">{survey.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Badge variant={survey.status === "active" ? "default" : "secondary"}>
          {survey.status === "active" ? "Aktywna" : "Nieaktywna"}
        </Badge>
        {survey.isRequired && (
          <Badge variant="destructive">Obowiązkowa</Badge>
        )}
      </div>

      {!hasStarted ? (
        <Card>
          <CardHeader>
            <CardTitle>Wypełnij ankietę</CardTitle>
            <CardDescription>
              Kliknij poniżej, aby rozpocząć wypełnianie ankiety.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleStartResponse}>
              Rozpocznij ankietę
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {survey.questions.map((question, index) => (
            <Card key={question._id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Pytanie {index + 1}</Badge>
                  {question.isRequired && (
                    <Badge variant="destructive" className="text-xs">
                      Obowiązkowe
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{question.questionText}</CardTitle>
              </CardHeader>
              <CardContent>
                {question.questionType === "text_short" && (
                  <Input
                    value={String(answers[question._id] || "")}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value, "text")}
                    placeholder="Twoja odpowiedź"
                  />
                )}

                {question.questionType === "text_long" && (
                  <Textarea
                    value={String(answers[question._id] || "")}
                    onChange={(e) => handleAnswerChange(question._id, e.target.value, "text")}
                    placeholder="Twoja odpowiedź"
                    rows={4}
                  />
                )}

                {question.questionType === "single_choice" && (
                  <RadioGroup
                    value={String(answers[question._id] || "")}
                    onValueChange={(value) => handleAnswerChange(question._id, value, "choice")}
                  >
                    {question.options?.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question._id}-${optionIndex}`} />
                        <Label htmlFor={`${question._id}-${optionIndex}`}>{option}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {question.questionType === "multiple_choice" && (
                  <div className="space-y-2">
                    {question.options?.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${question._id}-${optionIndex}`}
                          checked={Array.isArray(answers[question._id]) && (answers[question._id] as string[]).includes(option)}
                          onCheckedChange={(checked) => {
                            const currentAnswers = Array.isArray(answers[question._id]) ? answers[question._id] as string[] : [];
                            const newAnswers = checked
                              ? [...currentAnswers, option]
                              : currentAnswers.filter((a: string) => a !== option);
                            handleAnswerChange(question._id, newAnswers, "choice");
                          }}
                        />
                        <Label htmlFor={`${question._id}-${optionIndex}`}>{option}</Label>
                      </div>
                    ))}
                  </div>
                )}

                {question.questionType === "rating" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{question.ratingScale?.minLabel || question.ratingScale?.min}</span>
                      <span>{question.ratingScale?.maxLabel || question.ratingScale?.max}</span>
                    </div>
                    <RadioGroup
                      value={answers[question._id]?.toString() || ""}
                      onValueChange={(value) => handleAnswerChange(question._id, parseInt(value), "rating")}
                    >
                      <div className="flex items-center justify-between">
                        {Array.from(
                          { length: (question.ratingScale?.max || 5) - (question.ratingScale?.min || 1) + 1 },
                          (_, i) => (question.ratingScale?.min || 1) + i
                        ).map((value) => (
                          <div key={value} className="flex flex-col items-center">
                            <RadioGroupItem value={value.toString()} id={`${question._id}-${value}`} />
                            <Label htmlFor={`${question._id}-${value}`} className="text-sm">
                              {value}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {question.questionType === "yes_no" && (
                  <RadioGroup
                    value={answers[question._id]?.toString() || ""}
                    onValueChange={(value) => handleAnswerChange(question._id, value === "true", "boolean")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id={`${question._id}-yes`} />
                      <Label htmlFor={`${question._id}-yes`}>Tak</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id={`${question._id}-no`} />
                      <Label htmlFor={`${question._id}-no`}>Nie</Label>
                    </div>
                  </RadioGroup>
                )}

                {question.questionType === "number" && (
                  <Input
                    type="number"
                    value={String(answers[question._id] || "")}
                    onChange={(e) => handleAnswerChange(question._id, parseFloat(e.target.value), "number")}
                    placeholder="Wprowadź liczbę"
                  />
                )}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Wysyłanie..." : "Wyślij ankietę"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}