"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Question {
  _id?: Id<"surveyQuestions">;
  id: string;
  questionText: string;
  questionType: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file";
  isRequired: boolean;
  options?: string[];
  ratingScale?: {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
  };
  order?: number;
}

interface Survey {
  _id: Id<"surveys">;
  title: string;
  description?: string;
  questions?: Question[];
}

interface EditSurveyFormProps {
  survey: Survey;
}

export function EditSurveyForm({ survey }: EditSurveyFormProps) {
  const router = useRouter();
  const { team, project } = useProject();
  const updateSurvey = useMutation(api.surveys.updateSurvey);
  const addQuestion = useMutation(api.surveys.addQuestion);
  const updateQuestion = useMutation(api.surveys.updateQuestion);
  
  const deleteSurvey = useMutation(api.surveys.deleteSurvey);

  const surveyQuestions = useQuery(api.surveys.getSurvey, { surveyId: survey._id });

  const [title, setTitle] = useState(survey.title);
  const [description, setDescription] = useState(survey.description || "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (surveyQuestions?.questions) {
      setQuestions((surveyQuestions.questions
        .filter(q => q.questionType === 'text_long' || q.questionType === 'yes_no')
        .map(q => ({
          _id: q._id,
          id: q._id,
          questionText: q.questionText,
          questionType: q.questionType as 'text_long' | 'yes_no',
          isRequired: q.isRequired,
        })) as Question[]));
    }
  }, [surveyQuestions]);

  const addNewQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      questionText: "",
      questionType: "text_long",
      isRequired: true,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestionLocal = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateSurvey({
        surveyId: survey._id,
        title: title,
        description: description || undefined,
      });

      // Handle questions
      for (const question of questions) {
        if (question.questionText.trim()) {
          if (question._id) {
            // Update existing question
            await updateQuestion({
              questionId: question._id,
              questionText: question.questionText.trim(),
              questionType: question.questionType,
              isRequired: question.isRequired,
            });
          } else {
            // Add new question
            await addQuestion({
              surveyId: survey._id,
              questionText: question.questionText.trim(),
              questionType: question.questionType,
              isRequired: question.isRequired,
            });
          }
        }
      }

      toast.success("Survey has been updated");
      router.push(`/${team?.slug}/${project.slug}/surveys`);
    } catch (error) {
      toast.error("Error updating survey");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async () => {
    if (confirm(`Are you sure you want to delete the survey "${title}"? This action cannot be undone.`)) {
      setLoading(true);
      try {
        await deleteSurvey({ surveyId: survey._id });
        toast.success("Survey has been deleted");
        router.push(`/${team?.slug}/${project.slug}/surveys`);
      } catch (error) {
        toast.error("Error deleting survey");
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="shrink-0 bg-black text-white border-black hover:bg-neutral-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Edit Survey</h1>
            <p className="text-muted-foreground mt-1">
              Edit survey for project <span className="font-medium text-foreground">{project.name}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3">
                <Save className="h-5 w-5 text-black" />
                <div>
                  <CardTitle className="text-xl">Basic Information</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Edit basic information about the survey
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-sm font-semibold">
                  Survey Title *
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter survey title"
                  required
                  className="h-11 text-base"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-semibold">
                  Description (optional)
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter survey description"
                  rows={4}
                  className="resize-none text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Questions Section */}
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5 text-black" />
                  <div>
                    <CardTitle className="text-xl">Questions</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Edit questions in the survey
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  type="button" 
                  onClick={addNewQuestion}
                  className="bg-black text-white hover:bg-neutral-900 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-gray-200">
                    <Plus className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Questions
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Click "Add Question" to add a new question
                  </p>
                  <Button 
                    type="button" 
                    onClick={addNewQuestion}
                    variant="outline"
                    className="border-black text-black hover:bg-neutral-100"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Question
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {questions.map((question, index) => (
                    <Card key={question.id} className="border border-gray-200 shadow-sm bg-gray-50/50">
                      <CardContent className="p-6">
                        <div className="space-y-5">
                          {/* Question Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="inline-block border border-black text-black bg-transparent rounded px-2 py-1 text-xs font-semibold">Question {index + 1}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQuestion(question.id)}
                              className="text-black hover:text-white hover:bg-black"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold">
                                Question Content *
                              </Label>
                              <Textarea
                                value={question.questionText}
                                onChange={(e) => updateQuestionLocal(question.id, { questionText: e.target.value })}
                                placeholder="Enter question content"
                                required
                                rows={3}
                                className="resize-none text-base"
                              />
                            </div>
                            <div className="space-y-3">
                              <Label className="text-sm font-semibold">
                                Question Type
                              </Label>
                              <Select
                                value={question.questionType}
                                onValueChange={(value: "text_short" | "text_long" | "multiple_choice" | "single_choice" | "rating" | "yes_no" | "number" | "file") => updateQuestionLocal(question.id, { questionType: value })}
                              >
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select question type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text_short">Short Text</SelectItem>
                                  <SelectItem value="text_long">Long Text</SelectItem>
                                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                  <SelectItem value="single_choice">Single Choice</SelectItem>
                                  <SelectItem value="rating">Rating Scale</SelectItem>
                                  <SelectItem value="yes_no">Yes/No</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="file">File Upload</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <Switch
                                checked={question.isRequired}
                                onCheckedChange={(checked) => updateQuestionLocal(question.id, { isRequired: checked })}
                              />
                              <div>
                                <Label className="text-sm font-medium">Required Question</Label>
                                <p className="text-xs text-gray-500 mt-1">
                                  Respondents will have to answer this question
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="min-w-[120px] bg-black text-white border-black hover:bg-neutral-900 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[160px] bg-black text-white hover:bg-neutral-900 shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSurvey}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Survey
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}