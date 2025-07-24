"use client";

import { useMemo, useState, useCallback, memo } from "react";
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
import { MoreHorizontal, ChevronUp } from "lucide-react";
import { CalendarEventCard } from "./CalendarEventCard";
import { useCalendar } from "./CalendarProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CalendarEvent } from "./utils";

interface MonthViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

const EVENTS_PER_DAY_MOBILE = 2;
const EVENTS_PER_DAY_DESKTOP = 4;

export const MonthView = memo(function MonthView({ events = [], onEventClick, onDateClick }: MonthViewProps) {
  const { state } = useCalendar();
  const { currentDate, selectedDate } = state;
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

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

  const toggleDateExpansion = useCallback((dateKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  }, []);

  const weekDays = useMemo(() => [
    { short: 'Mon', full: 'Monday', letter: 'M' },
    { short: 'Tue', full: 'Tuesday', letter: 'T' },
    { short: 'Wed', full: 'Wednesday', letter: 'W' },
    { short: 'Thu', full: 'Thursday', letter: 'T' },
    { short: 'Fri', full: 'Friday', letter: 'F' },
    { short: 'Sat', full: 'Saturday', letter: 'S' },
    { short: 'Sun', full: 'Sunday', letter: 'S' }
  ], []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b bg-card sticky top-0 z-10">
        {weekDays.map((day, index) => (
          <div 
            key={day.short}
            className={cn(
              "p-3 text-center text-sm font-medium border-r last:border-r-0",
              index >= 5 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-muted-foreground'
            )}
            title={day.full}
          >
            <span className="hidden lg:inline">{day.short}</span>
            <span className="hidden sm:inline lg:hidden">{day.short}</span>
            <span className="sm:hidden">{day.letter}</span>
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex-1 flex flex-col">
        {monthGrid.map((week, weekIndex) => (
          <div 
            key={weekIndex}
            className="flex-1 border-b last:border-b-0 min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]"
          >
            <div className="grid grid-cols-7 h-full">
              {week.map((date, dayIndex) => {
                const dayEvents = getEventsForDate(date);
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isCurrentDay = isToday(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isWeekend = dayIndex >= 5;
                const dateKey = startOfDay(date).toISOString().split('T')[0];
                const isExpanded = expandedDates.has(dateKey);
                const hasMoreEvents = dayEvents.length > (typeof window !== 'undefined' && window.innerWidth < 640 ? EVENTS_PER_DAY_MOBILE : EVENTS_PER_DAY_DESKTOP);

                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "group relative flex flex-col p-2 border-r last:border-r-0 cursor-pointer transition-colors hover:bg-accent",
                      !isCurrentMonth && "text-muted-foreground bg-muted/20",
                      isCurrentMonth && "bg-card",
                      isCurrentDay && "bg-primary/10 ring-2 ring-primary",
                      isSelected && "bg-accent",
                      isWeekend && isCurrentMonth && "bg-blue-50/50"
                    )}
                    onClick={() => handleDateClick(date)}
                  >
                    {/* Date header */}
                    <div className="flex justify-between items-center mb-2">
                      <span 
                        className={cn(
                          "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors",
                          isCurrentDay && "bg-primary text-primary-foreground",
                          isSelected && !isCurrentDay && "bg-accent text-accent-foreground",
                          !isCurrentMonth && "text-muted-foreground",
                          isWeekend && isCurrentMonth && !isCurrentDay && !isSelected && "text-blue-600"
                        )}
                      >
                        {format(date, 'd')}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        {dayEvents.length > 0 && (
                          <div className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {dayEvents.length}
                          </div>
                        )}
                        
                      </div>
                    </div>

                    {/* Events */}
                    <div className="flex-1 space-y-1">
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
                        .slice(0, isExpanded ? dayEvents.length : (typeof window !== 'undefined' && window.innerWidth < 640 ? EVENTS_PER_DAY_MOBILE : EVENTS_PER_DAY_DESKTOP))
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
                            className="mb-1 last:mb-0"
                          />
                        ))}
                      
                      {hasMoreEvents && !isExpanded && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => toggleDateExpansion(dateKey, e)}
                          className="w-full h-6 text-xs text-muted-foreground hover:text-foreground mt-1"
                        >
                          <MoreHorizontal className="h-3 w-3 mr-1" />
                          +{dayEvents.length - (typeof window !== 'undefined' && window.innerWidth < 640 ? EVENTS_PER_DAY_MOBILE : EVENTS_PER_DAY_DESKTOP)} more
                        </Button>
                      )}
                      
                      {isExpanded && hasMoreEvents && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => toggleDateExpansion(dateKey, e)}
                          className="w-full h-6 text-xs text-muted-foreground hover:text-foreground mt-1"
                        >
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Collapse
                        </Button>
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