"use client";

import { useState, useMemo } from "react";
import { format, isToday } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, List, Calendar as CalendarIcon } from "lucide-react";
import { CalendarEventCard } from "./CalendarEventCard";
import { CalendarEvent } from "./utils";
import { cn } from "@/lib/utils";

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
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  
  const handleEventClick = (event: CalendarEvent) => {
    onEventClick?.(event);
  };

  // Group events by type for better organization
  const eventGroups = useMemo(() => {
    const groups = {
      urgent: [] as typeof events,
      high: [] as typeof events,
      medium: [] as typeof events,
      low: [] as typeof events,
      other: [] as typeof events
    };
    
    events.forEach(item => {
      const priority = item.event.priority as keyof typeof groups;
      if (groups[priority]) {
        groups[priority].push(item);
      } else {
        groups.other.push(item);
      }
    });
    
    return groups;
  }, [events]);

  // Generate hourly timeline
  const timelineSlots = useMemo(() => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      const eventsInHour = events.filter(({ event }) => {
        if (event.isAllDay) return hour === 0;
        const eventHour = new Date(event.startTime).getHours();
        return eventHour === hour;
      });
      
      slots.push({ hour, events: eventsInHour });
    }
    return slots.filter(slot => slot.events.length > 0 || slot.hour % 6 === 0); // Show only populated hours + every 6th hour
  }, [events]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {format(date, 'EEEE, d MMMM yyyy')}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={isToday(date) ? 'default' : 'secondary'} className="text-xs">
                    {isToday(date) ? 'Today' : format(date, 'EEEE')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {events.length} {events.length === 1 ? 'event' : 'events'}
                  </Badge>
                </div>
              </div>
            </div>
            
          </div>
        </DialogHeader>
        
        {events.length > 0 ? (
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'timeline')} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="flex-1 mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-4">
                  {Object.entries(eventGroups)
                    .filter(([, priorityEvents]) => priorityEvents.length > 0)
                    .map(([priority, priorityEvents]) => (
                      <div key={priority} className="space-y-2">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            priority === 'urgent' && 'bg-red-500',
                            priority === 'high' && 'bg-orange-500',
                            priority === 'medium' && 'bg-yellow-500',
                            priority === 'low' && 'bg-green-500',
                            priority === 'other' && 'bg-gray-500'
                          )} />
                          <h3 className="font-medium text-sm text-muted-foreground capitalize">
                            {priority === 'urgent' && 'Urgent'}
                            {priority === 'high' && 'High'}
                            {priority === 'medium' && 'Medium'}
                            {priority === 'low' && 'Low'}
                            {priority === 'other' && 'Other'}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            {priorityEvents.length}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          {priorityEvents
                            .sort((a, b) => {
                              const typeOrder = { start: 3, single: 2, end: 1 };
                              const aTypeOrder = typeOrder[a.type];
                              const bTypeOrder = typeOrder[b.type];
                              
                              if (aTypeOrder !== bTypeOrder) return bTypeOrder - aTypeOrder;
                              
                              return new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime();
                            })
                            .map(({ event, type }, index) => (
                              <CalendarEventCard
                                key={`${event.id}-${type}-${index}`}
                                event={event}
                                variant="detailed"
                                eventType={type}
                                onClick={() => handleEventClick(event)}
                                className="transition-all hover:shadow-sm"
                              />
                            ))
                          }
                        </div>
                      </div>
                    ))
                  }
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="timeline" className="flex-1 mt-0">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-1">
                  {timelineSlots.map(({ hour, events: hourEvents }) => (
                    <div key={hour} className="flex gap-4 py-2">
                      <div className="w-16 flex-shrink-0 text-right">
                        <div className="text-sm font-medium text-muted-foreground">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                      </div>
                      
                      <div className="flex-1 relative">
                        {hourEvents.length > 0 ? (
                          <div className="space-y-1">
                            {hourEvents.map(({ event, type }, index) => (
                              <CalendarEventCard
                                key={`${event.id}-${type}-${index}`}
                                event={event}
                                variant="compact"
                                eventType={type}
                                onClick={() => handleEventClick(event)}
                                className="ml-2"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="h-8 border-l-2 border-muted ml-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <CalendarIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-muted-foreground">No events on this day</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}