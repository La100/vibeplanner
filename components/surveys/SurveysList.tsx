"use client";

import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";
interface SurveysListProps {
  projectSlug: string;
}

export function SurveysList({ projectSlug }: SurveysListProps) {
  const { project } = useProject();

  const surveys = useQuery(apiAny.surveys.getSurveysByProject, {
    projectId: project._id,
  });

  const currentUserMember = useQuery(apiAny.teams.getCurrentUserTeamMember, {
    teamId: project.teamId
  });

  const isAdmin = currentUserMember?.role === "admin";
  const isMember = currentUserMember?.role === "member";
  const isClient = currentUserMember?.role === "customer";
  const canEdit = isAdmin || isMember;

  // Get user's responses to check if they already responded
  const userResponses = useQuery(
    apiAny.surveys.getUserSurveyResponses, 
    isClient ? { projectId: project._id } : "skip"
  );

  const hasUserResponded = (surveyId: string) => {
    return userResponses?.some(response => response.surveyId === surveyId && response.isComplete);
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Surveys</h1>
          <p className="text-gray-600">Manage surveys for project {project.name}</p>
        </div>
        {canEdit && (
          <Link href={`/organisation/projects/${projectSlug}/surveys/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Survey
            </Button>
          </Link>
        )}
      </div>

      {surveys?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Surveys</CardTitle>
            <CardDescription>
              You don't have any surveys yet. Create your first survey to start collecting feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canEdit && (
              <Link href={`/organisation/projects/${projectSlug}/surveys/new`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Survey
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {surveys?.map((survey) => (
            <Card key={survey._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{survey.title}</CardTitle>
                {survey.description && (
                  <CardDescription className="line-clamp-2">
                    {survey.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="mt-4 flex gap-2 flex-wrap">
                  {canEdit ? (
                    <>
                      <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                      </Link>
                      <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}>
                        <Button variant="outline" size="sm">
                          <BarChart3 className="mr-1 h-3 w-3" />
                          Responses
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      {!hasUserResponded(survey._id) ? (
                        <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}`}>
                          <Button variant="outline" size="sm">
                            <FileText className="mr-1 h-3 w-3" />
                            Respond
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/organisation/projects/${projectSlug}/surveys/${survey._id}/responses`}>
                          <Button variant="outline" size="sm">
                            <BarChart3 className="mr-1 h-3 w-3" />
                            My Response
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
