"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: string;
  questionText: string;
  questionType: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number";
  options?: string[];
  isRequired: boolean;
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
}

interface SurveyFormProps {
  projectSlug: string;
}

export function SurveyForm({ projectSlug }: SurveyFormProps) {
  const router = useRouter();
  const { project, team } = useProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [targetAudience, setTargetAudience] = useState<"all_clients" | "specific_clients" | "team_members">("all_clients");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSurvey = useMutation(api.surveys.createSurvey);
  const addQuestion = useMutation(api.surveys.addQuestion);

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: "",
      questionType: "text_short",
      isRequired: true,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      const newOptions = [...(question.options || []), ""];
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options) {
      const newOptions = question.options.filter((_, index) => index !== optionIndex);
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);

    try {
      const surveyId = await createSurvey({
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: project._id as Id<"projects">,
        isRequired,
        allowMultipleResponses,
        targetAudience,
      });

      // Add questions
      for (const question of questions) {
        if (question.questionText.trim()) {
          await addQuestion({
            surveyId,
            questionText: question.questionText.trim(),
            questionType: question.questionType,
            options: question.options?.filter(opt => opt.trim()) || undefined,
            isRequired: question.isRequired,
            ratingScale: question.ratingScale,
          });
        }
      }

      toast.success("Ankieta została utworzona!");
      router.push(`/${team?.slug}/${projectSlug}/surveys`);
    } catch (error) {
      toast.error("Błąd podczas tworzenia ankiety");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h1 className="text-3xl font-bold">Nowa ankieta</h1>
          <p className="text-gray-600">Utwórz ankietę dla projektu {project.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Podstawowe informacje</CardTitle>
            <CardDescription>
              Podaj podstawowe informacje o ankiecie
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Tytuł ankiety *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Wprowadź tytuł ankiety"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Opis (opcjonalny)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Wprowadź opis ankiety"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isRequired"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
              <Label htmlFor="isRequired">Ankieta obowiązkowa</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="allowMultiple"
                checked={allowMultipleResponses}
                onCheckedChange={setAllowMultipleResponses}
              />
              <Label htmlFor="allowMultiple">Zezwalaj na wielokrotne odpowiedzi</Label>
            </div>

            <div>
              <Label htmlFor="targetAudience">Grupa docelowa</Label>
              <Select value={targetAudience} onValueChange={(value: "all_clients" | "specific_clients" | "team_members") => setTargetAudience(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_clients">Wszyscy klienci</SelectItem>
                  <SelectItem value="specific_clients">Wybrani klienci</SelectItem>
                  <SelectItem value="team_members">Członkowie zespołu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pytania</CardTitle>
                <CardDescription>
                  Dodaj pytania do swojej ankiety
                </CardDescription>
              </div>
              <Button type="button" onClick={addNewQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj pytanie
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nie masz jeszcze żadnych pytań.</p>
                <p>Kliknij "Dodaj pytanie" aby zacząć.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Pytanie {index + 1}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div>
                      <Label>Treść pytania *</Label>
                      <Input
                        value={question.questionText}
                        onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
                        placeholder="Wprowadź treść pytania"
                        required
                      />
                    </div>

                    <div>
                      <Label>Typ pytania</Label>
                      <Select
                        value={question.questionType}
                        onValueChange={(value: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number") => updateQuestion(question.id, { questionType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text_short">Krótki tekst</SelectItem>
                          <SelectItem value="text_long">Długi tekst</SelectItem>
                          <SelectItem value="multiple_choice">Wielokrotny wybór</SelectItem>
                          <SelectItem value="single_choice">Jeden wybór</SelectItem>
                          <SelectItem value="rating">Ocena</SelectItem>
                          <SelectItem value="yes_no">Tak/Nie</SelectItem>
                          <SelectItem value="number">Liczba</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(question.questionType === "multiple_choice" || question.questionType === "single_choice") && (
                      <div>
                        <Label>Opcje odpowiedzi</Label>
                        <div className="space-y-2">
                          {question.options?.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <Input
                                value={option}
                                onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                                placeholder={`Opcja ${optionIndex + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOption(question.id, optionIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addOption(question.id)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Dodaj opcję
                          </Button>
                        </div>
                      </div>
                    )}

                    {question.questionType === "rating" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Skala od</Label>
                          <Input
                            type="number"
                            value={question.ratingScale?.min || 1}
                            onChange={(e) => updateQuestion(question.id, {
                              ratingScale: {
                                ...question.ratingScale,
                                min: parseInt(e.target.value) || 1,
                                max: question.ratingScale?.max || 5,
                              }
                            })}
                          />
                        </div>
                        <div>
                          <Label>Skala do</Label>
                          <Input
                            type="number"
                            value={question.ratingScale?.max || 5}
                            onChange={(e) => updateQuestion(question.id, {
                              ratingScale: {
                                ...question.ratingScale,
                                min: question.ratingScale?.min || 1,
                                max: parseInt(e.target.value) || 5,
                              }
                            })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={question.isRequired}
                        onCheckedChange={(checked) => updateQuestion(question.id, { isRequired: checked })}
                      />
                      <Label>Pytanie obowiązkowe</Label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Tworzenie..." : "Utwórz ankietę"}
          </Button>
        </div>
      </form>
    </div>
  );
}