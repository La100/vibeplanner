import { Suspense } from "react";
import EstimationsView, { EstimationsViewSkeleton } from "./components/EstimationsView";

export default function ProjectEstimationsPage() {
  return (
    <Suspense fallback={<EstimationsViewSkeleton />}>
      <EstimationsView />
    </Suspense>
  );
}


