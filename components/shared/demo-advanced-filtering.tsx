// 🚀 DEMO: How to Enable World-Class Filtering in VibePlanner
// Copy this example to your ProjectCalendar component

"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import { Calendar } from "@/components/calendar/Calendar";
import { Gantt } from "@/components/gantt/Gantt";
import { transformDataToEvents } from "@/components/calendar/utils";
import { GanttHeader } from "@/components/gantt/GanttHeader";
import { SharedFilters } from "@/components/shared/types";

type ViewType = "calendar" | "gantt";

export default function EnhancedProjectCalendar() {
  const { project } = useProject();
  const [currentView, setCurrentView] = useState<ViewType>("calendar");
  const [filters, setFilters] = useState<SharedFilters>({
    searchQuery: "",
    eventType: [],
    priority: [],
    status: []
  });

  // Get data
  const allTasks = useQuery(api.tasks.listProjectTasks, {
    projectId: project._id,
  });

  const allShoppingItems = useQuery(api.shopping.listShoppingListItems, {
    projectId: project._id,
  });

  // Get team members for assignee filtering
  const teamMembers = useQuery(api.teamMembers.getTeamMembers, {
    teamId: project.teamId,
  });

  // Get current user for context
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (!allTasks || !allShoppingItems || !teamMembers || !currentUser) {
    return <div>Loading...</div>;
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

  // Prepare team members for filtering
  const teamMembersForFilter = teamMembers.map(member => ({
    id: member.clerkUserId,
    name: member.name || member.email,
    imageUrl: member.imageUrl
  }));

  // Project data for smart suggestions
  const projectData = {
    hasOverdueItems: calendarEvents.some(event => 
      new Date(event.startTime) < new Date() && 
      event.sourceType === 'task' && 
      (event.sourceData as any).status !== 'done'
    ),
    overdueCount: calendarEvents.filter(event => 
      new Date(event.startTime) < new Date() && 
      event.sourceType === 'task' && 
      (event.sourceData as any).status !== 'done'
    ).length,
    hasUpcomingDeadlines: calendarEvents.some(event => {
      const eventDate = new Date(event.startTime);
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      return eventDate <= threeDaysFromNow && eventDate >= new Date();
    }),
    upcomingDeadlineCount: calendarEvents.filter(event => {
      const eventDate = new Date(event.startTime);
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      return eventDate <= threeDaysFromNow && eventDate >= new Date();
    }).length,
    averageTaskDuration: 0,
    criticalPath: []
  };

  // User context for smart filtering
  const userContext = {
    userId: currentUser.clerkUserId,
    name: currentUser.name,
    email: currentUser.email
  };

  const handleEventClick = (event: any) => {
    // Handle event clicks
    console.log('Event clicked:', event);
  };

  const handleDateClick = (date: Date) => {
    // Handle date clicks
    console.log('Date clicked:', date);
  };

  return (
    <div className="h-screen w-full relative overflow-hidden">
      {/* 🚀 WORLD-CLASS FILTERING ENABLED */}
      <GanttHeader 
        filters={filters}
        onFiltersChange={setFilters}
        currentView={currentView}
        onViewChange={setCurrentView}
        useAdvancedFiltering={true} // 🎯 Enable the magic!
        projectData={projectData}
        userContext={userContext}
        teamMembers={teamMembersForFilter}
      />

      {/* Content Area */}
      <div className="flex-1 w-full h-[calc(100vh-200px)]">
        {currentView === "calendar" ? (
          <Calendar
            events={calendarEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            className="h-full w-full"
            filters={filters}
            onFiltersChange={setFilters}
            useSmartFiltering={true} // 🧠 Enable smart filtering
            currentUserId={currentUser.clerkUserId}
          />
        ) : (
          <Gantt
            events={calendarEvents}
            onEventClick={handleEventClick}
            className="h-full w-full"
            filters={filters}
            onFiltersChange={setFilters}
            useSmartFiltering={true} // 🧠 Enable smart filtering
            currentUserId={currentUser.clerkUserId}
          />
        )}
      </div>
    </div>
  );
}

/*
🎉 FEATURES YOU GET WITH ADVANCED FILTERING:

✅ SMART SEARCH with fuzzy matching and typo tolerance
✅ PRESET FILTERS like "My Urgent Tasks", "Due This Week", "Overdue & Critical"
✅ SMART SUGGESTIONS based on project context
✅ INTELLIGENT URGENCY DETECTION
✅ ASSIGNEE FILTERING with team member photos
✅ TIME-BASED FILTERS (today, this week, overdue, due soon)
✅ COST & BUDGET FILTERING
✅ TAG-BASED FILTERING
✅ SHOPPING-SPECIFIC FILTERS (categories, suppliers, price ranges)
✅ VISUAL FILTER BADGES with one-click removal
✅ CONTEXT-AWARE FILTERING that learns from your usage

🚀 TO ENABLE IN YOUR PROJECT:
1. Replace your ProjectCalendar component with this enhanced version
2. Set useAdvancedFiltering={true} in GanttHeader
3. Set useSmartFiltering={true} in Calendar and Gantt components
4. Provide projectData, userContext, and teamMembers props
5. Enjoy the world's best filtering experience! 🎯

💡 BACKWARD COMPATIBILITY:
- All existing code works without changes
- Advanced features are opt-in
- Legacy filtering still works as before
- Gradual migration is supported
*/