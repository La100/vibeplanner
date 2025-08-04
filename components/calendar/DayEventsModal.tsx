"use client";

import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon } from "lucide-react";
import { CalendarEventCard } from "./CalendarEventCard";
import { CalendarEvent } from "./utils";

interface DayEventsModalProps {
  date: Date;
  events: Array<{ event: CalendarEvent; type: 'start' | 'end' | 'single' }>;
  isOpen: boolean;
  onClose: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  onCreateEvent?: () => void;
}

export function DayEventsModal({ 
  date, 
  events, 
  isOpen, 
  onClose, 
  onEventClick
}: DayEventsModalProps) {
  
  const handleEventClick = (event: CalendarEvent) => {
    onEventClick?.(event);
  };

  // Sort events by priority first, then by time
  const sortedEvents = useMemo(() => {
    const priorityOrder = { 'urgent': 1, 'high': 2, 'medium': 3, 'low': 4 };
    
    return events.sort((a, b) => {
      // All-day events first
      if (a.event.isAllDay && !b.event.isAllDay) return -1;
      if (!a.event.isAllDay && b.event.isAllDay) return 1;
      
      // Then by priority (urgent -> high -> medium -> low)
      const aPriority = priorityOrder[a.event.priority as keyof typeof priorityOrder] || 5;
      const bPriority = priorityOrder[b.event.priority as keyof typeof priorityOrder] || 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Finally by start time
      return new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime();
    });
  }, [events]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] h-[90vh] sm:h-[80vh] flex flex-col mx-2 sm:mx-auto">
        <DialogHeader className="pb-3 sm:pb-4 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg truncate">
                {format(date, 'EEEE, d MMMM yyyy')}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={isToday(date) ? 'default' : 'secondary'} className="text-xs">
                  {isToday(date) ? 'Today' : format(date, 'EEEE')}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {events.length} {events.length === 1 ? 'event' : 'events'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        {events.length > 0 ? (
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full pr-2 sm:pr-4">
              <div className="space-y-1.5 sm:space-y-2">
                {sortedEvents.map(({ event, type }, index) => (
                  <CalendarEventCard
                    key={`${event.id}-${type}-${index}`}
                    event={event}
                    variant="detailed"
                    eventType={type}
                    onClick={() => handleEventClick(event)}
                    className="transition-all hover:shadow-sm"
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-8 sm:py-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm sm:text-base">No events on this day</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}