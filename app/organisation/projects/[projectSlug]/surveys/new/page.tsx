import { Suspense } from "react";
import { apiAny } from "@/lib/convexApiAny";
import { preloadQuery } from "convex/nextjs";
import { SurveyForm } from "@/components/surveys/SurveyForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@clerk/nextjs/server";

interface NewSurveyPageProps {
  params: Promise<{
    projectSlug: string;
  }>;
}

export default async function NewSurveyPage({ params }: NewSurveyPageProps) {
  const { projectSlug } = await params;
  const { orgId } = await auth();

  const preloadedProject = orgId
    ? preloadQuery(apiAny.projects.getProjectBySlugInClerkOrg, {
        clerkOrgId: orgId,
        projectSlug,
      })
    : null;

  return (
    <Suspense fallback={<NewSurveySkeleton />}>
      <NewSurveyContent 
        preloadedProject={preloadedProject} 
        projectSlug={projectSlug}
      />
    </Suspense>
  );
}

async function NewSurveyContent({ 
  preloadedProject, 
  projectSlug 
}: { 
  preloadedProject: ReturnType<typeof preloadQuery> | null;
  projectSlug: string;
}) {
  if (!preloadedProject) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization required</CardTitle>
            <CardDescription>
              You need to be part of an organization to create surveys.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const project = await preloadedProject;

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Project not found</CardTitle>
            <CardDescription>
              We couldn't find a project with that name.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <SurveyForm projectSlug={projectSlug} />;
}

function NewSurveySkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 w-20" />
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Skeleton className="h-4 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-56 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
