import { Suspense } from "react";
import ProjectCalendar, { ProjectCalendarSkeleton } from "./components/ProjectCalendar";

export default function ProjectCalendarPage() {
  return (
    <Suspense fallback={<ProjectCalendarSkeleton />}>
      <ProjectCalendar />
    </Suspense>
  );
} 