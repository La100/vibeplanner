"use client";

import { Suspense } from "react";
import { ProjectChangelog, ProjectChangelogSkeleton } from "../components/ProjectChangelog";

export default function ChangelogPage() {
  return (
    <Suspense fallback={<ProjectChangelogSkeleton />}>
      <ProjectChangelog />
    </Suspense>
  );
}
