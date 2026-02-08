import { Suspense } from "react";
import HabitsView, { HabitsViewSkeleton } from "./components/HabitsView";

export default function ProjectHabitsPage() {
  return (
    <Suspense fallback={<HabitsViewSkeleton />}>
      <HabitsView />
    </Suspense>
  );
}
