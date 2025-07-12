"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
interface SurveysListProps {
  projectSlug: string;
}

export function SurveysList({ projectSlug }: SurveysListProps) {
  const { project, team } = useProject();

  const surveys = useQuery(api.surveys.getSurveysByProject, {
    projectId: project._id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "active":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft":
        return "Szkic";
      case "active":
        return "Aktywna";
      case "closed":
        return "Zamknięta";
      default:
        return status;
    }
  };

  const getAudienceText = (audience: string) => {
    switch (audience) {
      case "all_clients":
        return "Wszyscy klienci";
      case "specific_clients":
        return "Wybrani klienci";
      case "team_members":
        return "Członkowie zespołu";
      default:
        return audience;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ankiety</h1>
          <p className="text-gray-600">Zarządzaj ankietami dla projektu {project.name}</p>
        </div>
        <Link href={`/${team?.slug}/${projectSlug}/surveys/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nowa ankieta
          </Button>
        </Link>
      </div>

      {surveys?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Brak ankiet</CardTitle>
            <CardDescription>
              Nie masz jeszcze żadnych ankiet. Utwórz swoją pierwszą ankietę, aby zacząć zbierać opinie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/${team?.slug}/${projectSlug}/surveys/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Utwórz pierwszą ankietę
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {surveys?.map((survey) => (
            <Card key={survey._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className={getStatusColor(survey.status)}>
                    {getStatusText(survey.status)}
                  </Badge>
                  {survey.isRequired && (
                    <Badge variant="outline" className="text-red-600 border-red-300">
                      Obowiązkowa
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{survey.title}</CardTitle>
                {survey.description && (
                  <CardDescription className="line-clamp-2">
                    {survey.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="mr-2 h-4 w-4" />
                    {getAudienceText(survey.targetAudience)}
                  </div>
                  
                  {survey.endDate && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="mr-2 h-4 w-4" />
                      Kończy się: {new Date(survey.endDate).toLocaleDateString()}
                    </div>
                  )}

                  {survey.allowMultipleResponses && (
                    <div className="flex items-center text-sm text-green-600">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Wielokrotne odpowiedzi
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/${team?.slug}/${projectSlug}/surveys/${survey._id}`}>
                    <Button variant="outline" size="sm">
                      Szczegóły
                    </Button>
                  </Link>
                  <Link href={`/${team?.slug}/${projectSlug}/surveys/${survey._id}/responses`}>
                    <Button variant="outline" size="sm">
                      Odpowiedzi
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}