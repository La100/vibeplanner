import { Suspense } from "react";
import LaborListView, { LaborListViewSkeleton } from "./components/LaborListView";

export default function ProjectLaborPage() {
  return (
    <Suspense fallback={<LaborListViewSkeleton />}>
      <LaborListView />
    </Suspense>
  );
}


