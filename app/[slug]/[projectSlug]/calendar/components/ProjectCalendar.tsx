"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import { Calendar } from "@/components/calendar/Calendar";
import { transformDataToEvents } from "@/components/calendar/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function ProjectCalendarSkeleton() {
  return (
    <div className="h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      <div className="flex-1 p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function ProjectCalendar() {
  const { project } = useProject();

  const hasAccess = useQuery(api.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  // Check original data
  const allTasks = useQuery(api.tasks.listProjectTasks, {
    projectId: project._id,
  });

  const allShoppingItems = useQuery(api.shopping.listShoppingListItems, {
    projectId: project._id,
  });


  // const updateTaskDates = useMutation(api.calendar.updateTaskDates);
  // const updateShoppingItemDate = useMutation(api.calendar.updateShoppingItemBuyBefore);

  if (!allTasks || !allShoppingItems || hasAccess === false) {
    if (hasAccess === false) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this project.</p>
        </div>
      );
    }
    if (!project) {
      return <div>Project not found.</div>;
    }
    return <ProjectCalendarSkeleton />;
  }


  // Transform data to calendar events
  const calendarEvents = transformDataToEvents(
    allTasks.map(task => ({
      ...task,
      assignedToName: task.assignedToName,
      assignedToImageUrl: task.assignedToImageUrl,
      project: {
        id: project._id,
        name: project.name,
        slug: project.slug
      }
    })),
    allShoppingItems.map(item => ({
      ...item,
      assignedToName: "",
      assignedToImageUrl: "",
      project: {
        id: project._id,
        name: project.name,
        slug: project.slug
      }
    }))
  );

  // Debug: check first task
  if (allTasks.length > 0) {
    console.log('🔍 PIERWSZE ZADANIE:', {
      title: allTasks[0].title,
      startDate: allTasks[0].startDate,
      endDate: allTasks[0].endDate,
      dueDate: allTasks[0].dueDate,
    });
  }

  // Debug: check first event
  if (calendarEvents.length > 0) {
    console.log('🔍 PIERWSZE WYDARZENIE:', {
      title: calendarEvents[0].title,
      startTime: calendarEvents[0].startTime,
      endTime: calendarEvents[0].endTime,
      isAllDay: calendarEvents[0].isAllDay,
    });
  }



  const handleEventClick = () => {
    // Don't redirect - sidebar will handle showing details
  };


  const handleDateClick = (date: Date) => {
    console.log('Date clicked:', date);
  };


  return (
    <div className="h-screen w-full">
      <Calendar
        events={calendarEvents}
        onEventClick={handleEventClick}
    
        onDateClick={handleDateClick}
        className="h-full w-full"
      />
    </div>
  );
} 