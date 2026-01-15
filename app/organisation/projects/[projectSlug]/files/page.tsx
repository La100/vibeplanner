import { Suspense } from "react";
import FilesView, { FilesViewSkeleton } from "./components/FilesView";

export default function ProjectFilesPage() {
  return (
    <Suspense fallback={<FilesViewSkeleton />}>
      <FilesView />
    </Suspense>
  );
} 