import { Suspense } from "react";
import { apiAny } from "@/lib/convexApiAny";
import { preloadQuery } from "convex/nextjs";
import { SurveysList } from "@/components/surveys/SurveysList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@clerk/nextjs/server";

interface SurveysPageProps {
  params: Promise<{
    projectSlug: string;
  }>;
}

export default async function SurveysPage({ params }: SurveysPageProps) {
  const { projectSlug } = await params;
  const { orgId } = await auth();

  const preloadedProject = orgId
    ? preloadQuery(apiAny.projects.getProjectBySlugInClerkOrg, {
        clerkOrgId: orgId,
        projectSlug,
      })
    : null;

  return (
    <Suspense fallback={<SurveysSkeleton />}>
      <SurveysContent preloadedProject={preloadedProject} projectSlug={projectSlug} />
    </Suspense>
  );
}

async function SurveysContent({ preloadedProject, projectSlug }: { preloadedProject: ReturnType<typeof preloadQuery> | null; projectSlug: string }) {
  if (!preloadedProject) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization required</CardTitle>
            <CardDescription>
              You need to be part of an organization to access surveys.
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

  return <SurveysList projectSlug={projectSlug} />;
}

function SurveysSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
