import { Suspense } from "react";
import ProjectGantt, { ProjectGanttSkeleton } from "./components/ProjectGantt";

export default function ProjectGanttPage() {
  return (
    <Suspense fallback={<ProjectGanttSkeleton />}>
      <ProjectGantt />
    </Suspense>
  );
}
