"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import {
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttHeader,
  GanttToday,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureItem,
  type GanttFeature,
  type Range
} from "@/components/ui/kibo-ui/gantt";
import { TaskSidebar } from "@/components/calendar/TaskSidebar";
import { transformTaskToEvent, CalendarEvent } from "@/components/calendar/utils";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColors: Record<string, string> = {
  todo: "#9CA3AF", // gray-400
  in_progress: "#3B82F6", // blue-500
  review: "#F59E0B", // amber-500
  done: "#10B981", // emerald-500
  blocked: "#EF4444", // red-500
};

export function ProjectGanttSkeleton() {
  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-1/3 mt-2" />
      </div>

      <div className="flex gap-4 mb-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>

      <div className="flex-grow border rounded-lg">
        <div className="flex h-full">
          {/* Sidebar Skeleton */}
          <div className="w-1/4 pr-4 border-r">
            <div className="space-y-3 p-4">
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
            <div className="space-y-3 p-4">
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
  const { project } = useProject();
  const [range, setRange] = useState<Range>('monthly');
  const [zoom, setZoom] = useState(100);
  const [selectedTask, setSelectedTask] = useState<CalendarEvent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tasks = useQuery(api.tasks.listProjectTasks, {
    projectId: project._id,
  });

  if (!tasks) {
    return <ProjectGanttSkeleton />;
  }

  const ganttFeatures: GanttFeature[] = tasks
    ?.filter(task => task.startDate || task.endDate)
    .map(task => {
      // Properly handle start and end dates for Gantt chart
      let startAt: Date;
      let endAt: Date;
      
      if (task.startDate && task.endDate) {
        // Has both - use as is
        startAt = new Date(task.startDate);
        endAt = new Date(task.endDate);
      } else if (task.endDate) {
        // Only deadline - show as single point at deadline
        endAt = new Date(task.endDate);
        startAt = endAt;
      } else {
        // Only startDate - show as single point at start
        startAt = new Date(task.startDate!);
        endAt = startAt;
      }
      
      return {
        id: task._id,
        name: task.title,
        startAt,
        endAt,
        status: {
          id: task.status,
          name: task.status.replace("_", " "),
          color: statusColors[task.status] || "#6B7280",
        },
      };
    }) || [];


  const handleTaskClick = (taskId: string) => {
    const task = tasks?.find(t => t._id === taskId);
    if (task) {
      // Transform task to calendar event format for TaskSidebar
      const calendarEvent = transformTaskToEvent({
        ...task,
        assignedToName: task.assignedToName,
        assignedToImageUrl: task.assignedToImageUrl || "",
        project: {
          id: project._id,
          name: project.name,
          slug: project.slug
        }
      });

      if (calendarEvent) {
        setSelectedTask(calendarEvent);
        setIsSidebarOpen(true);
      }
    }
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
    setSelectedTask(null);
  };

  const handleEventStatusChange = (event: unknown, newStatus: string) => {
    // TODO: Update task status
    console.log('Status change:', event, newStatus);
  };

  return (
    <div className="h-[calc(100vh-57px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{project.name} - Gantt Chart</h1>
          <p className="text-muted-foreground">Visualize your project timeline</p>
        </div>

        <div className="flex gap-4">
          <Select value={range} onValueChange={(value: Range) => setRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(50, zoom - 25))}
            >
              -
            </Button>
            <span className="text-sm w-12 text-center">{zoom}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(200, zoom + 25))}
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-hidden">
        <GanttProvider
          range={range}
          zoom={zoom}
          className="h-full"
        >
          <GanttSidebar>
            <GanttSidebarGroup name="Project Tasks">
              {ganttFeatures.map(feature => (
                <GanttSidebarItem
                  key={feature.id}
                  feature={feature}
                  onSelectItem={handleTaskClick}
                />
              ))}
            </GanttSidebarGroup>
          </GanttSidebar>

          <GanttTimeline>
            <GanttHeader />
            <GanttToday />
            <GanttFeatureList>
              <GanttFeatureListGroup>
                {ganttFeatures.map(feature => (
                  <GanttFeatureItem
                    key={feature.id}
                    {...feature}
                    onClick={handleTaskClick}
                  />
                ))}
              </GanttFeatureListGroup>
            </GanttFeatureList>
          </GanttTimeline>
        </GanttProvider>
      </div>

      <TaskSidebar
        event={selectedTask}
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
        onStatusChange={handleEventStatusChange}
      />
    </div>
  );
} 