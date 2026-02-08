import { Suspense } from "react";
import DiaryView, { DiaryViewSkeleton } from "./components/DiaryView";

export default function ProjectDiaryPage() {
  return (
    <Suspense fallback={<DiaryViewSkeleton />}>
      <DiaryView />
    </Suspense>
  );
}
