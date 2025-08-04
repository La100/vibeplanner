"use client";

import { useState, useMemo, useCallback } from "react";
import { startOfDay, isSameDay } from "date-fns";
import { CalendarProvider } from "./CalendarProvider";
import { MonthView } from "./MonthView";
import { TaskSidebar } from "./TaskSidebar";
import { DayEventsModal } from "./DayEventsModal";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";
import { SharedFilters, AdvancedFilters } from "../shared/types";
import { useSmartFiltering } from "../shared/smart-filter-engine";
import { convertLegacyFilters } from "../shared/filter-adapter";


interface CalendarProps {
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  className?: string;
  filters?: SharedFilters;
  onFiltersChange?: (filters: SharedFilters) => void;
  // New props for smart filtering
  useSmartFiltering?: boolean;
  currentUserId?: string;
}

function CalendarContent({ 
  events = [], 
  onEventClick, 
  onDateClick,
  filters: externalFilters,
  onFiltersChange,
  useSmartFiltering = false,
  currentUserId
}: CalendarProps) {
  const { setSelectedDate } = useCalendar();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  
  // Use external filters if provided, otherwise use default empty filters
  const filters = externalFilters || {
    searchQuery: "",
    eventType: [],
    priority: [],
    status: []
  };

  // Smart filtering context
  const filterContext = useMemo(() => ({
    currentUserId,
    currentDate: new Date(),
    projectData: {
      hasOverdueItems: false,
      overdueCount: 0,
      hasUpcomingDeadlines: false,
      upcomingDeadlineCount: 0,
      averageTaskDuration: 0,
      criticalPath: []
    }
  }), [currentUserId]);

  // Apply filters to events - use smart filtering if enabled
  const filteredEvents = useSmartFiltering 
    ? useSmartFiltering(events || [], convertLegacyFilters(filters), filterContext)
    : useMemo(() => {
        if (!events) return [];
        
        return events.filter((event) => {
          // Search query filter
          if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
            return false;
          }
          
          // Event type filter
          if (filters.eventType.length > 0 && !filters.eventType.includes(event.type)) {
            return false;
          }
          
          // Priority filter
          if (filters.priority.length > 0 && event.priority && !filters.priority.includes(event.priority)) {
            return false;
          }
          
          // Status filter - check original source status
          if (filters.status.length > 0) {
            if (event.sourceType === 'task') {
              const originalStatus = (event.sourceData as any).status;
              if (!filters.status.includes(originalStatus)) {
                return false;
              }
            } else if (event.sourceType === 'shopping') {
              const originalStatus = (event.sourceData as any).realizationStatus;
              if (!filters.status.includes(originalStatus)) {
                return false;
              }
            }
          }
          
          return true;
        });
      }, [events, filters]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  const handleMoreEventsClick = (date: Date) => {
    setDayModalDate(date);
    setIsDayModalOpen(true);
  };


  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsSidebarOpen(true);
    onEventClick?.(event);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
    setSelectedEvent(null);
  };

  // Get events for a specific day
  const getDayEvents = useCallback((date: Date) => {
    return filteredEvents
      .filter(event => {
        const eventStart = startOfDay(new Date(event.startTime));
        const eventEnd = startOfDay(new Date(event.endTime));
        const targetDate = startOfDay(date);
        
        // Single day event
        if (isSameDay(eventStart, eventEnd)) {
          return isSameDay(eventStart, targetDate);
        }
        // Multi-day event - show on start and end dates
        return isSameDay(eventStart, targetDate) || isSameDay(eventEnd, targetDate);
      })
      .map(event => {
        const eventStart = startOfDay(new Date(event.startTime));
        const eventEnd = startOfDay(new Date(event.endTime));
        const targetDate = startOfDay(date);
        
        // Determine event type for display
        if (isSameDay(eventStart, eventEnd)) {
          return { event, type: 'single' as const };
        } else if (isSameDay(eventStart, targetDate)) {
          return { event, type: 'start' as const };
        } else {
          return { event, type: 'end' as const };
        }
      });
  }, [filteredEvents]);

  const handleDayModalClose = () => {
    setIsDayModalOpen(false);
    setDayModalDate(null);
  };


  const dayModalEvents = useMemo(() => {
    return dayModalDate ? getDayEvents(dayModalDate) : [];
  }, [dayModalDate, getDayEvents]);

  const renderCurrentView = () => {
    return (
      <MonthView
        events={filteredEvents}
        onEventClick={handleEventClick}
        onDateClick={handleDateClick}
        onMoreEventsClick={handleMoreEventsClick}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-hidden">
        {renderCurrentView()}
      </div>
      
      <TaskSidebar
        event={selectedEvent}
        isOpen={isSidebarOpen}
        onClose={handleSidebarClose}
        onStatusChange={() => {}}
      />
      
      {dayModalDate && (
        <DayEventsModal
          date={dayModalDate}
          events={dayModalEvents}
          isOpen={isDayModalOpen}
          onClose={handleDayModalClose}
          onEventClick={handleEventClick}
        />
      )}
    </div>
  );
}

export function Calendar({ 
  events, 
  onEventClick, 
  onDateClick,
  className,
  filters,
  onFiltersChange,
  useSmartFiltering,
  currentUserId
}: CalendarProps) {
  return (
    <CalendarProvider>
      <div className={`h-full ${className}`}>
        <CalendarContent
          events={events}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
          filters={filters}
          onFiltersChange={onFiltersChange}
          useSmartFiltering={useSmartFiltering}
          currentUserId={currentUserId}
        />
      </div>
    </CalendarProvider>
  );
}