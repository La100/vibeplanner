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

const statusColors: Record<string, string> = {
  todo: "#9CA3AF", // gray-400
  in_progress: "#3B82F6", // blue-500
  review: "#F59E0B", // amber-500
  completed: "#10B981", // emerald-500
  blocked: "#EF4444", // red-500
};

export default function ProjectGanttPage() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [range, setRange] = useState<"daily" | "monthly">("monthly");

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const tasks = useQuery(api.myFunctions.listProjectTasks, 
    project ? { projectId: project._id } : "skip"
  );
  
  const updateTaskDates = useMutation(api.myFunctions.updateTaskDates);

  if (project === undefined || tasks === undefined) {
    return <div>Loading...</div>;
  }

  if (project === null) {
    return <div>Project not found.</div>;
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
      await updateTaskDates({
        taskId: id as Id<"tasks">,
        startDate: startAt.getTime(),
        dueDate: endAt?.getTime(),
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
