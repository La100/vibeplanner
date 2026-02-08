import { Suspense } from "react";
import { ProjectDashboard, ProjectDashboardSkeleton } from "./components/ProjectDashboard";

export default function ProjectDashboardPage() {
  return (
    <Suspense fallback={<ProjectDashboardSkeleton />}>
      <ProjectDashboard />
    </Suspense>
  );
}
