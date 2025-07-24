"use client";

import { useState, useMemo, useCallback } from "react";
import { startOfDay, isSameDay } from "date-fns";
import { CalendarProvider } from "./CalendarProvider";
import { CalendarHeader } from "./CalendarHeader";
import { MonthView } from "./MonthView";
import { TaskSidebar } from "./TaskSidebar";
import { DayEventsModal } from "./DayEventsModal";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";

interface CalendarFilters {
  searchQuery: string;
  eventType: string[];
  priority: string[];
  status: string[];
}

interface CalendarProps {
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  className?: string;
}

function CalendarContent({ 
  events = [], 
  onEventClick, 
  onDateClick
}: CalendarProps) {
  const { setSelectedDate } = useCalendar();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>({
    searchQuery: "",
    eventType: [],
    priority: [],
    status: []
  });

  // Apply filters to events
  const filteredEvents = useMemo(() => {
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
      
      // Status filter
      if (filters.status.length > 0 && event.status && !filters.status.includes(event.status)) {
        return false;
      }
      
      return true;
    });
  }, [events, filters]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    
    // Get events for this date to decide whether to open modal
    const dayEvents = getDayEvents(date);
    
    if (dayEvents.length > 3) {
      // If more than 3 events, open day modal
      setDayModalDate(date);
      setIsDayModalOpen(true);
    }
    
    onDateClick?.(date);
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
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <CalendarHeader 
        filters={filters}
        onFiltersChange={setFilters}
      />
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
  className 
}: CalendarProps) {
  return (
    <CalendarProvider>
      <div className={`h-full ${className}`}>
        <CalendarContent
          events={events}
          onEventClick={onEventClick}
          onDateClick={onDateClick}
        />
      </div>
    </CalendarProvider>
  );
}