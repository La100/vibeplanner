"use client";

import { useMemo } from "react";
import { 
  format, 
  startOfWeek, 
  endOfWeek,
  eachDayOfInterval,
  addHours,
  isSameDay,
  isWithinInterval,
  differenceInMinutes,
  startOfDay,
  isBefore,
  isAfter
} from "date-fns";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const HOUR_HEIGHT = 60; // pixels per hour
const MOBILE_HOUR_HEIGHT = 50; // pixels per hour on mobile
const MIN_DAY_WIDTH = 100; // minimum width for day column on mobile

export function WeekView({ events = [], onEventClick, onDateClick }: WeekViewProps) {
  const { state } = useCalendar();
  const { currentDate } = state;

  // Get week days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Responsive hour height
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  }, []);

  const hourHeight = isMobile ? MOBILE_HOUR_HEIGHT : HOUR_HEIGHT;

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    events.forEach(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Check if event falls within this week
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      const isInWeek =
        isWithinInterval(eventStart, { start: weekStart, end: weekEnd }) ||
        isWithinInterval(eventEnd, { start: weekStart, end: weekEnd }) ||
        (isBefore(eventStart, weekStart) && isAfter(eventEnd, weekEnd));

      if (!isInWeek) return;

      // Check if event is multi-day (spans more than one day)
      const eventStartDay = startOfDay(eventStart);
      const eventEndDay = startOfDay(eventEnd);
      const isMultiDay = !isSameDay(eventStartDay, eventEndDay);

      // Show in top section if:
      // 1. Explicitly marked as all-day, OR
      // 2. Event spans multiple days (Google Calendar style)
      if (event.isAllDay || isMultiDay) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, currentDate]);

  // Get all-day events for a specific day
  const getAllDayEventsForDay = (day: Date) => {
    return allDayEvents.filter(event => {
      const eventStart = startOfDay(new Date(event.startTime));
      const eventEnd = startOfDay(new Date(event.endTime));
      const targetDay = startOfDay(day);

      return (
        isSameDay(eventStart, targetDay) ||
        isSameDay(eventEnd, targetDay) ||
        (isBefore(eventStart, targetDay) && isAfter(eventEnd, targetDay))
      );
    });
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent, day: Date) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const dayStart = startOfDay(day);

    // Calculate minutes from start of day
    const minutesFromStart = differenceInMinutes(eventStart, dayStart);
    const duration = differenceInMinutes(eventEnd, eventStart);

    // Convert to pixels - use responsive height
    const top = (minutesFromStart / 60) * hourHeight;
    const minHeight = isMobile ? 18 : 20;
    const height = Math.max((duration / 60) * hourHeight, minHeight);

    return { top, height };
  };

  const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mobileWeekDayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex border-b bg-card sticky top-0 z-20">
        {/* Time column header */}
        <div className="w-10 sm:w-16 flex-shrink-0 border-r" />
        
        {/* Day headers - scrollable on mobile */}
        <div className="flex-1 overflow-x-auto sm:overflow-x-visible">
          <div className="flex sm:contents" style={{ minWidth: isMobile ? `${MIN_DAY_WIDTH * 7}px` : 'auto' }}>
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, new Date());
              const isWeekend = index >= 5;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "p-1.5 sm:p-3 text-center border-r last:border-r-0",
                    isWeekend && "bg-blue-50/50",
                    isToday && "bg-primary/10"
                  )}
                  style={{ minWidth: isMobile ? `${MIN_DAY_WIDTH}px` : 'auto', flex: isMobile ? 'none' : '1' }}
                >
                  <div className="font-semibold text-[10px] sm:text-sm text-muted-foreground">
                    <span className="sm:hidden">{mobileWeekDayNames[index]}</span>
                    <span className="hidden sm:inline">{weekDayNames[index]}</span>
                  </div>
                  <div
                    className={cn(
                      "text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1",
                      isToday && "inline-flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, 'd')}
                  </div>

                  {/* All-day events for this day */}
                  <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                    {getAllDayEventsForDay(day).slice(0, isMobile ? 1 : 3).map(event => (
                      <div
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className={cn(
                          "text-[9px] sm:text-xs p-0.5 sm:p-1 rounded cursor-pointer truncate",
                          "hover:opacity-80 transition-opacity"
                        )}
                        style={{ backgroundColor: event.color, color: 'white' }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {getAllDayEventsForDay(day).length > (isMobile ? 1 : 3) && (
                      <div className="text-[8px] sm:text-[10px] text-muted-foreground">
                        +{getAllDayEventsForDay(day).length - (isMobile ? 1 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto relative bg-white">
        <div className="flex">
          {/* Time column */}
          <div className="w-10 sm:w-16 flex-shrink-0 border-r bg-muted/30 sticky left-0 z-10">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="text-[9px] sm:text-xs text-right pr-1 sm:pr-2 text-muted-foreground"
                style={{ height: `${hourHeight}px` }}
              >
                {format(addHours(startOfDay(new Date()), hour), 'HH:mm')}
              </div>
            ))}
          </div>

          {/* Day columns with events - scrollable on mobile */}
          <div className="flex-1 overflow-x-auto sm:overflow-x-visible">
            <div className="flex sm:contents" style={{ minWidth: isMobile ? `${MIN_DAY_WIDTH * 7}px` : 'auto' }}>
              {weekDays.map((day, dayIndex) => {
                const isWeekend = dayIndex >= 5;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 relative"
                    )}
                    style={{ 
                      backgroundColor: isWeekend ? '#eff6ff' : '#ffffff',
                      minWidth: isMobile ? `${MIN_DAY_WIDTH}px` : 'auto',
                      flex: isMobile ? 'none' : '1'
                    }}
                  >
                    {/* Hour grid */}
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className="border-b border-gray-200 cursor-pointer hover:bg-accent/50 transition-colors"
                        style={{ height: `${hourHeight}px`, backgroundColor: 'transparent' }}
                        onClick={() => onDateClick?.(addHours(startOfDay(day), hour))}
                      />
                    ))}

                    {/* Timed events overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      {timedEvents
                        .filter(event => {
                          const eventStart = startOfDay(new Date(event.startTime));
                          return isSameDay(eventStart, day);
                        })
                        .map(event => {
                          const { top, height } = getEventStyle(event, day);

                          return (
                            <div
                              key={event.id}
                              className="absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded p-0.5 sm:p-1 text-[9px] sm:text-xs overflow-hidden cursor-pointer pointer-events-auto hover:opacity-90 transition-opacity shadow-sm"
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                backgroundColor: event.color,
                                color: 'white',
                                zIndex: 10
                              }}
                              onClick={() => onEventClick?.(event)}
                              title={`${event.title}\n${format(new Date(event.startTime), 'HH:mm')} - ${format(new Date(event.endTime), 'HH:mm')}`}
                            >
                              <div className="font-semibold truncate">{event.title}</div>
                              {height > 30 && (
                                <div className="text-[8px] sm:text-[10px] opacity-90 truncate">
                                  {format(new Date(event.startTime), 'HH:mm')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Current time indicator */}
                    {isSameDay(day, new Date()) && (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-red-500 pointer-events-none z-20"
                        style={{
                          top: `${(new Date().getHours() + new Date().getMinutes() / 60) * hourHeight}px`
                        }}
                      >
                        <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

