import { Suspense } from "react";
import NotesView, { NotesViewSkeleton } from "./components/NotesView";

export default function ProjectNotesPage() {
  return (
    <Suspense fallback={<NotesViewSkeleton />}>
      <NotesView />
    </Suspense>
  );
} 