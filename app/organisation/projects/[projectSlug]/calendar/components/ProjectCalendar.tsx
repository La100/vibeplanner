"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import { GoogleCalendar } from "@/components/google-calendar";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCalendarSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="flex-1 p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function ProjectCalendar() {
  const { project } = useProject();

  const hasAccess = useQuery(api.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this project.</p>
      </div>
    );
  }

  if (hasAccess === undefined) {
    return <ProjectCalendarSkeleton />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-card">
        <h1 className="text-xl font-semibold">Google Calendar</h1>
      </div>

      {/* Google Calendar Integration */}
      <div className="flex-1 w-full overflow-hidden">
        <GoogleCalendar className="h-full" />
      </div>
    </div>
  );
}
