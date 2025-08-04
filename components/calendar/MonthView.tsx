"use client";

import { useMemo, useCallback, memo } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isSameDay,
  startOfDay
} from "date-fns";
import { MoreHorizontal } from "lucide-react";
import { CalendarEventCard } from "./CalendarEventCard";
import { useCalendar } from "./CalendarProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import { CalendarEvent } from "./utils";

interface MonthViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onMoreEventsClick?: (date: Date) => void;
}

const EVENTS_PER_DAY_MOBILE = 2;
const EVENTS_PER_DAY_DESKTOP = 4;

export const MonthView = memo(function MonthView({ events = [], onEventClick, onDateClick, onMoreEventsClick }: MonthViewProps) {
  const { state } = useCalendar();
  const { currentDate, selectedDate } = state;
  const isMobile = useIsMobile();

  // Generate month grid
  const monthGrid = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Group days into weeks
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return weeks;
  }, [currentDate]);

  // Memoize events for better performance
  const eventsByDate = useMemo(() => {
    const eventMap = new Map<string, Array<{ event: CalendarEvent; type: 'start' | 'end' | 'single' }>>();
    
    events.forEach(event => {
      const eventStart = startOfDay(new Date(event.startTime));
      const eventEnd = startOfDay(new Date(event.endTime));
      
      // Single day event
      if (isSameDay(eventStart, eventEnd)) {
        const dateKey = eventStart.toISOString().split('T')[0];
        if (!eventMap.has(dateKey)) eventMap.set(dateKey, []);
        eventMap.get(dateKey)!.push({ event, type: 'single' });
      }
      // Multi-day event - show start and end
      else {
        const startKey = eventStart.toISOString().split('T')[0];
        const endKey = eventEnd.toISOString().split('T')[0];
        
        if (!eventMap.has(startKey)) eventMap.set(startKey, []);
        eventMap.get(startKey)!.push({ event, type: 'start' });
        
        if (!eventMap.has(endKey)) eventMap.set(endKey, []);
        eventMap.get(endKey)!.push({ event, type: 'end' });
      }
    });
    
    return eventMap;
  }, [events]);

  // Get events for specific date
  const getEventsForDate = (date: Date) => {
    const dateKey = startOfDay(date).toISOString().split('T')[0];
    return eventsByDate.get(dateKey) || [];
  };

  const handleDateClick = useCallback((date: Date) => {
    onDateClick?.(date);
  }, [onDateClick]);

  const weekDays = useMemo(() => [
    { short: 'Mon', full: 'Monday', letter: 'M' },
    { short: 'Tue', full: 'Tuesday', letter: 'T' },
    { short: 'Wed', full: 'Wednesday', letter: 'W' },
    { short: 'Thu', full: 'Thursday', letter: 'T' },
    { short: 'Fri', full: 'Friday', letter: 'F' },
    { short: 'Sat', full: 'Saturday', letter: 'S' },
    { short: 'Sun', full: 'Sunday', letter: 'S' }
  ], []);

  const eventsLimit = isMobile ? EVENTS_PER_DAY_MOBILE : EVENTS_PER_DAY_DESKTOP;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b bg-card sticky top-0 z-10 flex-shrink-0">
        {weekDays.map((day, index) => (
          <div 
            key={day.short}
            className={cn(
              "p-2 sm:p-3 text-center text-xs sm:text-sm font-medium border-r last:border-r-0",
              index >= 5 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-muted-foreground'
            )}
            title={day.full}
          >
            <span className="hidden lg:inline">{day.short}</span>
            <span className="hidden sm:inline lg:hidden">{day.short.substring(0, 3)}</span>
            <span className="sm:hidden">{day.letter}</span>
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex-1 flex flex-col overflow-auto">
        {monthGrid.map((week, weekIndex) => (
          <div 
            key={weekIndex}
            className={cn(
              "flex-1 border-b last:border-b-0",
              // Increased minimum heights significantly to prevent cutting off
              isMobile 
                ? "min-h-[160px]" 
                : "min-h-[200px] sm:min-h-[240px] lg:min-h-[280px]"
            )}
            style={{
              height: isMobile 
                ? `max(160px, calc((100% - 60px) / ${monthGrid.length}))` 
                : `max(200px, calc((100% - 80px) / ${monthGrid.length}))`
            }}
          >
            <div className="grid grid-cols-7 h-full">
              {week.map((date, dayIndex) => {
                const dayEvents = getEventsForDate(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isCurrentDay = isToday(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isWeekend = dayIndex >= 5;
                const hasMoreEvents = dayEvents.length > eventsLimit;
                const hasManualEvents = dayEvents.length > 3; // Consider "full" day when more than 3 events

                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "group relative flex flex-col cursor-pointer transition-all duration-200",
                      "border-r last:border-r-0 overflow-hidden",
                      isMobile ? "p-2" : "p-2 sm:p-3",
                      !isCurrentMonth && "text-muted-foreground bg-muted/20",
                      isCurrentMonth && "bg-card hover:bg-accent hover:shadow-sm",
                      isCurrentDay && "bg-primary/10 ring-1 sm:ring-2 ring-primary",
                      isSelected && "bg-accent",
                      isWeekend && isCurrentMonth && "bg-blue-50/50",
                      hasManualEvents && isCurrentMonth && "bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-l-2 sm:border-l-4 border-l-blue-500"
                    )}
                    onClick={() => handleDateClick(date)}
                  >
                    {/* Date header */}
                    <div className="flex justify-between items-center mb-2 sm:mb-3 flex-shrink-0">
                      <span 
                        className={cn(
                          "inline-flex items-center justify-center rounded-full font-medium transition-colors",
                          isMobile ? "w-6 h-6 text-sm" : "w-7 h-7 sm:w-8 sm:h-8 text-sm sm:text-base",
                          isCurrentDay && "bg-primary text-primary-foreground shadow-sm",
                          isSelected && !isCurrentDay && "bg-accent text-accent-foreground",
                          !isCurrentMonth && "text-muted-foreground",
                          isWeekend && isCurrentMonth && !isCurrentDay && !isSelected && "text-blue-600",
                          hasManualEvents && isCurrentMonth && !isCurrentDay && "font-bold text-blue-700"
                        )}
                      >
                        {format(date, 'd')}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        {dayEvents.length > 0 && (
                          <div className={cn(
                            "text-xs px-1.5 py-0.5 rounded-full transition-colors",
                            isMobile ? "min-w-[18px] h-5" : "min-w-[20px] h-5",
                            hasManualEvents && isCurrentMonth
                              ? "bg-blue-500 text-white font-semibold" 
                              : "text-muted-foreground bg-muted"
                          )}>
                            {dayEvents.length}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Events */}
                    <div className={cn(
                      "flex-1 flex flex-col",
                      isMobile ? "space-y-1 min-h-0" : "space-y-1 sm:space-y-1.5 min-h-0"
                    )}>
                      <div className="flex-1 overflow-hidden">
                        {dayEvents
                          .sort((a, b) => {
                            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                            const aPriority = priorityOrder[a.event.priority as keyof typeof priorityOrder] || 0;
                            const bPriority = priorityOrder[b.event.priority as keyof typeof priorityOrder] || 0;
                            
                            if (aPriority !== bPriority) return bPriority - aPriority;
                            
                            const typeOrder = { start: 3, single: 2, end: 1 };
                            const aTypeOrder = typeOrder[a.type];
                            const bTypeOrder = typeOrder[b.type];
                            
                            return bTypeOrder - aTypeOrder;
                          })
                          .slice(0, eventsLimit)
                          .map(({ event, type }, index) => (
                            <CalendarEventCard
                              key={`${event.id}-${type}-${index}`}
                              event={event}
                              variant="compact"
                              eventType={type}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }}
                              className={cn(
                                "mb-1 last:mb-0 flex-shrink-0",
                                isMobile && "text-xs"
                              )}
                            />
                          ))}
                      </div>
                      
                      {hasMoreEvents && onMoreEventsClick && (
                        <div className="flex-shrink-0 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoreEventsClick(date);
                            }}
                            className={cn(
                              "w-full transition-colors",
                              isMobile 
                                ? "h-6 text-xs px-1" 
                                : "h-7 sm:h-8 text-xs",
                              hasManualEvents && isCurrentMonth
                                ? "text-blue-700 hover:text-blue-800 hover:bg-blue-100 font-medium" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <MoreHorizontal className={cn(
                              "mr-1",
                              isMobile ? "h-3 w-3" : "h-3 w-3 sm:h-4 sm:w-4"
                            )} />
                            <span className="truncate">
                              +{dayEvents.length - eventsLimit}
                              <span className="hidden sm:inline"> more</span>
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});