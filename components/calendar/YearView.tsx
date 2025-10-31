"use client";

import { useMemo } from "react";
import { 
  format,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  getMonth
} from "date-fns";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";
import { cn } from "@/lib/utils";

interface YearViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

export function YearView({ events = [] }: YearViewProps) {
  const { state, setCurrentDate, setViewMode } = useCalendar();
  const { currentDate } = state;

  const year = currentDate.getFullYear();
  const yearStart = startOfYear(currentDate);
  const yearEnd = endOfYear(currentDate);

  // Get all months in the year
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  // Group events by month
  const eventsByMonth = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();

    events.forEach(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const yearStart = startOfYear(currentDate);
      const yearEnd = endOfYear(currentDate);

      // Check if event is in this year
      if (
        isWithinInterval(eventStart, { start: yearStart, end: yearEnd }) ||
        isWithinInterval(eventEnd, { start: yearStart, end: yearEnd })
      ) {
        const month = getMonth(eventStart);
        if (!map.has(month)) {
          map.set(month, []);
        }
        map.get(month)!.push(event);
      }
    });

    return map;
  }, [events, currentDate]);

  // Get event count for a specific day
  const getEventCountForDay = (day: Date, monthIndex: number) => {
    const monthEvents = eventsByMonth.get(monthIndex) || [];
    return monthEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return (
        isSameDay(eventStart, day) ||
        isSameDay(eventEnd, day) ||
        isWithinInterval(day, { start: eventStart, end: eventEnd })
      );
    }).length;
  };

  // Check if day has priority events
  const hasPriorityEvent = (day: Date, monthIndex: number) => {
    const monthEvents = eventsByMonth.get(monthIndex) || [];
    return monthEvents.some(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const hasDate = (
        isSameDay(eventStart, day) ||
        isSameDay(eventEnd, day) ||
        isWithinInterval(day, { start: eventStart, end: eventEnd })
      );
      return hasDate && (event.priority === 'urgent' || event.priority === 'high');
    });
  };

  const handleMonthClick = (month: Date) => {
    setCurrentDate(month);
    setViewMode('month');
  };

  const weekDayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const isCurrentYear = year === new Date().getFullYear();

  return (
    <div className="flex flex-col h-full bg-background overflow-auto p-2 sm:p-4">
      {/* Year Header */}
      <div className="mb-3 sm:mb-6 text-center">
        <h1 className="text-2xl sm:text-4xl font-bold text-foreground">
          {year}
          {isCurrentYear && (
            <span className="ml-2 sm:ml-3 text-xs sm:text-lg bg-primary text-primary-foreground px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
              Current
            </span>
          )}
        </h1>
      </div>

      {/* Months Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 auto-rows-fr">
        {months.map((month) => {
          const monthIndex = getMonth(month);
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
          const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
          const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
          const monthEvents = eventsByMonth.get(monthIndex) || [];
          const isCurrentMonth = isSameMonth(month, new Date());

          return (
            <div
              key={month.toISOString()}
              className={cn(
                "border rounded-lg bg-card hover:shadow-lg transition-shadow cursor-pointer overflow-hidden",
                isCurrentMonth && "ring-1 sm:ring-2 ring-primary"
              )}
              onClick={() => handleMonthClick(month)}
            >
              {/* Month Header */}
              <div className={cn(
                "bg-muted/50 p-1.5 sm:p-3 border-b",
                isCurrentMonth && "bg-primary/10"
              )}>
                <h3 className="font-semibold text-xs sm:text-base text-center">
                  {format(month, 'MMMM')}
                </h3>
                {monthEvents.length > 0 && (
                  <div className="text-[10px] sm:text-xs text-center text-muted-foreground mt-0.5 sm:mt-1">
                    {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}
                  </div>
                )}
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-0 px-1 sm:px-2 py-0.5 sm:py-1 bg-muted/30">
                {weekDayNames.map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-[9px] sm:text-xs font-medium text-center text-muted-foreground",
                      i >= 5 && "text-blue-600"
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-0 p-1 sm:p-2">
                {days.map((day) => {
                  const isThisMonth = isSameMonth(day, month);
                  const isToday = isSameDay(day, new Date());
                  const eventCount = isThisMonth ? getEventCountForDay(day, monthIndex) : 0;
                  const hasImportant = isThisMonth && hasPriorityEvent(day, monthIndex);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "aspect-square flex flex-col items-center justify-center relative text-[10px] sm:text-xs min-h-[44px] sm:min-h-0",
                        "hover:bg-accent/50 rounded transition-colors",
                        !isThisMonth && "text-muted-foreground/40",
                        isThisMonth && "text-foreground",
                        isWeekend && isThisMonth && "text-blue-600",
                        isToday && "font-bold"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isThisMonth) {
                          setCurrentDate(day);
                          setViewMode('day');
                        }
                      }}
                    >
                      {/* Day number */}
                      <span
                        className={cn(
                          "z-10",
                          isToday && "flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Event indicators */}
                      {eventCount > 0 && (
                        <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                          {eventCount === 1 ? (
                            <div
                              className={cn(
                                "w-1 h-1 rounded-full",
                                hasImportant ? "bg-red-500" : "bg-blue-500"
                              )}
                            />
                          ) : eventCount === 2 ? (
                            <>
                              <div
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  hasImportant ? "bg-red-500" : "bg-blue-500"
                                )}
                              />
                              <div
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  hasImportant ? "bg-red-500" : "bg-blue-500"
                                )}
                              />
                            </>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  hasImportant ? "bg-red-500" : "bg-blue-500"
                                )}
                              />
                              <div
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  hasImportant ? "bg-red-500" : "bg-blue-500"
                                )}
                              />
                              <div
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  hasImportant ? "bg-red-500" : "bg-blue-500"
                                )}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 sm:mt-6 flex items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap px-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500" />
          <span>Events</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />
          <span>Important</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] sm:text-xs font-bold">
            {format(new Date(), 'd')}
          </div>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

