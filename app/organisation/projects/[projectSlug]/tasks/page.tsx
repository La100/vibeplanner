import { Suspense } from "react";
import TasksView, { TasksViewSkeleton } from "./components/TasksView";

export default function ProjectTasksPage() {
  return (
    <Suspense fallback={<TasksViewSkeleton />}>
      <TasksView />
    </Suspense>
  );
}
