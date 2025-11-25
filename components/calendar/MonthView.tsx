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
  startOfDay,
  isBefore,
  isAfter
} from "date-fns";
import { MoreHorizontal } from "lucide-react";
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

interface EventWithPosition extends CalendarEvent {
  startCol: number;
  span: number;
  row: number;
  weekIndex: number;
}

const MAX_VISIBLE_ROWS = 3;

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

    return { weeks, startDate, endDate };
  }, [currentDate]);

  // Process events to calculate their positions and spans
  const eventsByWeek = useMemo(() => {
    const weekEvents: EventWithPosition[][] = [];
    
    monthGrid.weeks.forEach((week, weekIndex) => {
      const weekStart = week[0];
      const weekEnd = week[6];
      
      const eventsInWeek: EventWithPosition[] = [];
      
      events.forEach(event => {
        const eventStart = startOfDay(new Date(event.startTime));
        const eventEnd = startOfDay(new Date(event.endTime));
        
        // Check if event overlaps with this week
        if (isBefore(eventEnd, weekStart) || isAfter(eventStart, weekEnd)) {
          return;
        }
        
        // Calculate start column (0-6 for Mon-Sun)
        const displayStart = isBefore(eventStart, weekStart) ? weekStart : eventStart;
        const displayEnd = isAfter(eventEnd, weekEnd) ? weekEnd : eventEnd;
        
        const startCol = week.findIndex(day => isSameDay(day, displayStart));
        const endCol = week.findIndex(day => isSameDay(day, displayEnd));
        
        if (startCol === -1) return;
        
        const span = endCol - startCol + 1;
        
        eventsInWeek.push({
          ...event,
          startCol,
          span,
          row: 0,
          weekIndex
        });
      });
      
      // Sort events by start column, then by span (longer first)
      eventsInWeek.sort((a, b) => {
        if (a.startCol !== b.startCol) return a.startCol - b.startCol;
        return b.span - a.span;
      });
      
      // Assign rows to prevent overlaps
      eventsInWeek.forEach(event => {
        let row = 0;
        let placed = false;
        
        while (!placed) {
          const hasConflict = eventsInWeek.some(other => {
            if (other === event) return false;
            if (other.row !== row) return false;
            
            const otherEnd = other.startCol + other.span - 1;
            const eventEnd = event.startCol + event.span - 1;
            
            return !(eventEnd < other.startCol || event.startCol > otherEnd);
          });
          
          if (!hasConflict) {
            event.row = row;
            placed = true;
          } else {
            row++;
          }
        }
      });
      
      weekEvents.push(eventsInWeek);
    });
    
    return weekEvents;
  }, [events, monthGrid.weeks]);

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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-10 flex-shrink-0">
        {weekDays.map((day, index) => (
          <div 
            key={day.short}
            className={cn(
              "p-1.5 sm:p-3 text-center text-[10px] sm:text-sm font-medium border-r last:border-r-0",
              index >= 5 
                ? 'text-primary/80 bg-primary/5'
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
        {monthGrid.weeks.map((week, weekIndex) => {
          const weekEventsData = eventsByWeek[weekIndex] || [];
          const maxRow = Math.max(0, ...weekEventsData.map(e => e.row));
          const visibleEvents = weekEventsData.filter(e => e.row < MAX_VISIBLE_ROWS);
          const hasMoreEvents = maxRow >= MAX_VISIBLE_ROWS;
          
          return (
            <div 
              key={weekIndex}
              className="border-b last:border-b-0 relative min-h-[140px] sm:min-h-[180px] lg:min-h-[200px]"
              style={{
                height: `calc((100% - 40px) / ${monthGrid.weeks.length})`
              }}
            >
              {/* Day cells background */}
              <div className="grid grid-cols-7 h-full absolute inset-0">
                {week.map((date, dayIndex) => {
                  const isCurrentMonth = isSameMonth(date, currentDate);
                  const isCurrentDay = isToday(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isWeekend = dayIndex >= 5;

                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "group relative flex flex-col transition-colors border-r last:border-r-0 p-2 sm:p-3",
                        isCurrentMonth
                          ? "cursor-pointer bg-background hover:bg-muted/40"
                          : "cursor-default text-muted-foreground/60 bg-muted/10",
                        isWeekend && isCurrentMonth && !isCurrentDay && "bg-primary/5",
                        isCurrentDay && "bg-primary/20 ring-2 ring-primary/60 ring-inset",
                        isSelected && !isCurrentDay && "bg-primary/10 ring-2 ring-primary/40 ring-inset"
                      )}
                      onClick={() => handleDateClick(date)}
                    >
                      {/* Date number */}
                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <span 
                          className={cn(
                            "inline-flex items-center justify-center font-semibold transition-all",
                            "text-sm sm:text-base lg:text-lg",
                            isCurrentDay 
                              ? "bg-primary text-primary-foreground shadow-lg rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2" 
                              : "text-foreground",
                            !isCurrentMonth && "text-muted-foreground/60"
                          )}
                        >
                          {format(date, 'd')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Events layer */}
              <div className="absolute inset-0 pointer-events-none" style={{ top: isMobile ? '32px' : '44px' }}>
                <div className="relative h-full px-2 sm:px-3">
                  {visibleEvents.map((event, idx) => {
                    const rowHeight = isMobile ? 24 : 28;
                    const rowGap = isMobile ? 3 : 4;
                    const topPosition = event.row * (rowHeight + rowGap);
                    
                    return (
                      <div
                        key={`${event.id}-${idx}`}
                        className={cn(
                          "absolute pointer-events-auto cursor-pointer",
                          "rounded px-1.5 sm:px-2 py-0.5 sm:py-1",
                          "text-white font-medium truncate",
                          "hover:opacity-90 hover:shadow-md transition-all",
                          "flex items-center gap-1"
                        )}
                        style={{
                          backgroundColor: event.color,
                          left: `${(event.startCol / 7) * 100}%`,
                          width: `calc(${(event.span / 7) * 100}% - ${isMobile ? '4px' : '6px'})`,
                          top: `${topPosition}px`,
                          height: `${rowHeight}px`,
                          zIndex: 5 + event.row
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(event);
                        }}
                        title={`${event.title}\n${format(new Date(event.startTime), 'MMM d')} - ${format(new Date(event.endTime), 'MMM d')}`}
                      >
                        {/* Event indicator badges */}
                        {event.assignedTo && event.assignedToImageUrl && (
                          <div className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] sm:text-xs overflow-hidden">
                            <img 
                              src={event.assignedToImageUrl} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {!event.assignedToImageUrl && event.assignedToName && (
                          <div className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/30 flex items-center justify-center text-[9px] sm:text-[10px] font-bold">
                            {event.assignedToName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <span className="text-xs sm:text-sm truncate flex-1">
                          {event.title}
                        </span>
                      </div>
                    );
                  })}
                  
                  {/* More events indicator */}
                  {hasMoreEvents && (
                    <div
                      className="absolute left-0 right-0 pointer-events-auto"
                      style={{
                        top: `${MAX_VISIBLE_ROWS * (isMobile ? 27 : 32)}px`,
                        height: `${isMobile ? 22 : 26}px`
                      }}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoreEventsClick?.(week[0]);
                        }}
                        className={cn(
                          "h-full w-full text-xs sm:text-sm px-2 py-0",
                          "text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
                        )}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />
                        <span>+{weekEventsData.length - visibleEvents.length} more</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
