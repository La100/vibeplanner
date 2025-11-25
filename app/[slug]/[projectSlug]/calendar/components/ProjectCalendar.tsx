"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import { Calendar } from "@/components/calendar/Calendar";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { CalendarProvider } from "@/components/calendar/CalendarProvider";
import { Gantt } from "@/components/gantt/Gantt";
import { transformDataToEvents } from "@/components/calendar/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskSidebar } from "@/components/calendar/TaskSidebar";
import { useState, useEffect } from "react";
import { CalendarEvent } from "@/components/calendar/utils";
import { GanttHeader } from "@/components/gantt/GanttHeader";
import { SharedFilters } from "@/components/shared/types";

type ViewType = "calendar" | "gantt";


export function ProjectCalendarSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
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
  const [currentView, setCurrentView] = useState<ViewType>("calendar");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<SharedFilters>({
    searchQuery: "",
    eventType: [],
    priority: [],
    status: []
  });

  // Auto-open sidebar in Gantt view, close in Calendar view
  useEffect(() => {
    if (currentView === "gantt") {
      setIsSidebarOpen(true);
    } else {
      setIsSidebarOpen(false);
    }
    // Always reset selected event when switching views
    setSelectedEvent(null);
  }, [currentView]);

  const hasAccess = useQuery(api.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  const allTasks = useQuery(api.tasks.listProjectTasks, {
    projectId: project._id,
  });

  const allShoppingItems = useQuery(api.shopping.listShoppingListItems, {
    projectId: project._id,
  });

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


  const handleEventClick = (event: CalendarEvent) => {
    if (currentView === "gantt") {
      setSelectedEvent(event);
      // Sidebar is always open in Gantt view, just update selected event
    }
    // For calendar view, don't handle event clicks (original behavior)
  };

  const handleDateClick = () => {
    // Date click handler for calendar view
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
    setSelectedEvent(null);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-card">
        <h1 className="text-xl font-semibold">Schedule</h1>
      </div>

      {/* View Switcher (Calendar/Gantt) */}
      <div className="border-b border-gray-200 bg-card px-2 py-3 sm:px-4">
        <GanttHeader
          filters={filters}
          onFiltersChange={setFilters}
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full overflow-hidden">
        {currentView === "calendar" ? (
          <CalendarProvider>
            <div className="flex h-full flex-col overflow-hidden">
              <CalendarHeader
                filters={filters}
                onFiltersChange={setFilters}
              />
              <div className="flex-1 min-h-0">
                <Calendar
                  events={calendarEvents}
                  onEventClick={handleEventClick}
                  onDateClick={handleDateClick}
                  className="h-full w-full"
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            </div>
          </CalendarProvider>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <Gantt
              events={calendarEvents}
              onEventClick={handleEventClick}
              className="flex-1 w-full"
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        )}
      </div>

      {/* Sidebar for Gantt view */}
      <TaskSidebar
        key={selectedEvent?.id || 'no-event'}
        event={selectedEvent}
        isOpen={currentView === "gantt" && isSidebarOpen}
        onClose={handleSidebarClose}
        onStatusChange={() => {}}
      />
    </div>
  );
} 
