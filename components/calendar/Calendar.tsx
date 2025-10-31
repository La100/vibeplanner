"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { startOfDay, isSameDay } from "date-fns";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { YearView } from "./YearView";
import { TaskSidebar } from "./TaskSidebar";
import { DayEventsModal } from "./DayEventsModal";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";
import { SharedFilters } from "../shared/types";


interface CalendarProps {
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  className?: string;
  filters?: SharedFilters;
  onFiltersChange?: (filters: SharedFilters) => void;
  // New props for smart filtering
  currentUserId?: string;
}

function CalendarContent({ 
  events = [], 
  onEventClick, 
  onDateClick,
  filters: externalFilters
}: CalendarProps) {
  const { setSelectedDate, state, navigateNext, navigatePrevious, goToToday, setViewMode } = useCalendar();
  const { viewMode } = state;
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore if modal/sidebar is open (to avoid conflicts)
      if (isSidebarOpen || isDayModalOpen) {
        if (e.key === 'Escape') {
          if (isSidebarOpen) handleSidebarClose();
          if (isDayModalOpen) handleDayModalClose();
        }
        return;
      }

      // Navigation shortcuts
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigatePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateNext();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          goToToday();
          break;
        
        // View mode shortcuts
        case 'd':
        case 'D':
          e.preventDefault();
          setViewMode('day');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          setViewMode('week');
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setViewMode('month');
          break;
        case 'y':
        case 'Y':
          e.preventDefault();
          setViewMode('year');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, isDayModalOpen, navigateNext, navigatePrevious, goToToday, setViewMode]);
  
  // Apply filters to events
  const filteredEvents = useMemo(() => {
        if (!events) return [];
        
        // Use external filters if provided, otherwise use default empty filters
        const filters = externalFilters || {
          searchQuery: "",
          eventType: [],
          priority: [],
          status: []
        };
        
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
              const originalStatus = (event.sourceData as { status: string }).status;
              if (!filters.status.includes(originalStatus)) {
                return false;
              }
            } else if (event.sourceType === 'shopping') {
              const originalStatus = (event.sourceData as { realizationStatus: string }).realizationStatus;
              if (!filters.status.includes(originalStatus)) {
                return false;
              }
            }
          }
          
          return true;
        });
      }, [events, externalFilters]);

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
    switch (viewMode) {
      case 'day':
        return (
          <DayView
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        );
      case 'week':
        return (
          <WeekView
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        );
      case 'month':
        return (
          <MonthView
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onMoreEventsClick={handleMoreEventsClick}
          />
        );
      case 'year':
        return (
          <YearView
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        );
      default:
        return (
          <MonthView
            events={filteredEvents}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onMoreEventsClick={handleMoreEventsClick}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
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
  filters
}: CalendarProps) {
  return (
    <div className={`h-full ${className}`}>
      <CalendarContent
        events={events}
        onEventClick={onEventClick}
        onDateClick={onDateClick}
        filters={filters}
      />
    </div>
  );
}