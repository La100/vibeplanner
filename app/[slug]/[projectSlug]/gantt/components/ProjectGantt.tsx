"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  GanttProvider,
  GanttSidebar,
  GanttSidebarItem,
  GanttTimeline,
  GanttHeader,
  GanttFeatureList,
  GanttFeatureRow,
  GanttToday,
  type GanttFeature
} from "@/components/ui/kibo-ui/gantt";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<string, string> = {
  todo: "#9CA3AF", // gray-400
  in_progress: "#3B82F6", // blue-500
  review: "#F59E0B", // amber-500
  completed: "#10B981", // emerald-500
  blocked: "#EF4444", // red-500
};

export function ProjectGanttSkeleton() {
  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-1/3 mt-2" />
      </div>

      <div className="mb-4">
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="flex-grow border rounded-lg p-4">
        <div className="flex h-full">
          {/* Sidebar Skeleton */}
          <div className="w-1/4 pr-4 border-r">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          {/* Timeline Skeleton */}
          <div className="w-3/4 pl-4">
            <Skeleton className="h-8 w-full mb-4" /> {/* Header */}
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectGantt() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [range, setRange] = useState<"daily" | "monthly">("monthly");

  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const tasks = useQuery(api.tasks.listProjectTasks, 
    project ? { projectId: project._id } : "skip"
  );
  
  const updateTask = useMutation(api.tasks.updateTask);

  if (!project || !tasks) {
    // This will be handled by Suspense
    return null;
  }

  const ganttFeatures: GanttFeature[] = tasks
    ?.filter(task => task.endDate)
    .map(task => ({
      id: task._id,
      name: task.title,
      startAt: new Date(task.startDate || task.endDate!),
      endAt: new Date(task.endDate!),
      status: {
        id: task.status,
        name: task.status,
        color: statusColors[task.status] || "#6B7280",
      },
    })) || [];

  const handleMove = async (id: string, startAt: Date, endAt: Date | null) => {
    try {
      await updateTask({
        taskId: id as Id<"tasks">,
        startDate: startAt.getTime(),
        endDate: endAt?.getTime(),
      });
    } catch (error) {
      console.error("Failed to update task dates", error);
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{project.name} - Gantt Chart</h1>
        <p className="text-muted-foreground">Visualize your project timeline</p>
      </div>
      
      <div className="mb-4">
        <select value={range} onChange={(e) => setRange(e.target.value as "daily" | "monthly")}>
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div className="flex-grow">
        <GanttProvider range={range} onAddItem={() => {}}>
          <GanttSidebar>
            {ganttFeatures.map(feature => (
              <GanttSidebarItem key={feature.id} feature={feature} />
            ))}
          </GanttSidebar>
          <GanttTimeline>
            <GanttHeader />
            <GanttFeatureList>
              <GanttFeatureRow features={ganttFeatures} onMove={handleMove} />
            </GanttFeatureList>
            <GanttToday />
          </GanttTimeline>
        </GanttProvider>
      </div>
    </div>
  );
} 