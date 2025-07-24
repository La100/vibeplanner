"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search,
  Bell,
  Users,
  Video,
  Coffee,
  Briefcase,
  User,
  MoreHorizontal,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  addWeeks, 
  subWeeks,
  addDays,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
} from "date-fns";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  type: "meeting" | "workshop" | "call" | "break" | "task" | "personal";
  attendees?: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  location?: string;
  color?: string;
  isAllDay?: boolean;
  status?: "confirmed" | "tentative" | "cancelled";
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  category: "week" | "month" | "unscheduled";
  priority?: "low" | "medium" | "high";
  dueDate?: Date;
}

export interface ShoppingItem {
  id: string;
  name: string;
  completed: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
  buyBefore?: Date;
  supplier?: string;
  quantity: number;
  unitPrice?: number;
  realizationStatus: "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED";
}

interface WorldClassCalendarProps {
  events?: CalendarEvent[];
  todos?: TodoItem[];
  shoppingItems?: ShoppingItem[];
  onEventClick?: (event: CalendarEvent) => void;
  onEventCreate?: (event: Partial<CalendarEvent>) => void;
  onEventUpdate?: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onTodoToggle?: (todoId: string) => void;
  onTodoCreate?: (todo: Partial<TodoItem>) => void;
  onShoppingToggle?: (shoppingId: string) => void;
  onShoppingCreate?: (shopping: Partial<ShoppingItem>) => void;
  className?: string;
}

type ViewMode = "week" | "month" | "day";

const eventTypeIcons = {
  meeting: Briefcase,
  workshop: Users,
  call: Video,
  break: Coffee,
  task: CalendarDays,
  personal: User,
};

const eventTypeColors = {
  meeting: "bg-blue-500",
  workshop: "bg-purple-500", 
  call: "bg-green-500",
  break: "bg-orange-500",
  task: "bg-pink-500",
  personal: "bg-indigo-500",
};

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    hour,
    label: `${displayHour} ${ampm}`,
    shortLabel: `${displayHour}${ampm.toLowerCase()}`
  };
});

interface CalendarEventCardProps {
  event: CalendarEvent;
  style: Record<string, string | number>;
  isDragged: boolean;
  onDragStart: () => void;
  onClick: () => void;
}

const CalendarEventCard = ({ event, style, isDragged, onDragStart, onClick }: CalendarEventCardProps) => {
  const IconComponent = eventTypeIcons[event.type];
  
  return (
    <div
      className={cn(
        "absolute left-2 right-2 rounded-lg p-3 text-white text-sm cursor-pointer shadow-lg hover:shadow-xl transition-all z-10 border border-white/10",
        eventTypeColors[event.type],
        isDragged && "opacity-50"
      )}
      style={style}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
    >
      <div className="flex items-start gap-2 mb-2">
        <IconComponent className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate">{event.title}</h3>
          {event.description && (
            <p className="text-xs opacity-90 mt-1 line-clamp-2">{event.description}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs opacity-90">
        <span>
          {event.isAllDay ? 'All day' : `${format(event.startTime, 'h:mm')} - ${format(event.endTime, 'h:mm')}`}
        </span>
        {event.location && (
          <span className="truncate ml-2">📍 {event.location}</span>
        )}
      </div>
      
      {event.attendees && event.attendees.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <div className="flex -space-x-1">
            {event.attendees.slice(0, 3).map(attendee => (
              <Avatar key={attendee.id} className="h-5 w-5 border-2 border-white">
                <AvatarImage src={attendee.avatar} />
                <AvatarFallback className="text-xs font-medium">
                  {attendee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            ))}
            {event.attendees.length > 3 && (
              <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium border-2 border-white">
                +{event.attendees.length - 3}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export function WorldClassCalendar({
  events = [],
  todos = [],
  shoppingItems = [],
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onTodoToggle,
  onShoppingToggle,
  className
}: WorldClassCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);

  // Calculate week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Filter events by search
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    return events.filter(event => 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [events, searchQuery]);

  // Group todos by category
  const groupedTodos = useMemo(() => {
    const grouped = {
      week: todos.filter(todo => todo.category === "week"),
      month: todos.filter(todo => todo.category === "month"), 
      unscheduled: todos.filter(todo => todo.category === "unscheduled"),
    };
    
    console.log("🔍 GroupedTodos Debug:", {
      totalTodos: todos.length,
      week: grouped.week.length,
      month: grouped.month.length,
      unscheduled: grouped.unscheduled.length,
      firstTodo: todos[0],
      grouped
    });
    
    return grouped;
  }, [todos]);

  // Navigation functions
  const navigatePrevious = () => {
    setCurrentDate(prev => {
      if (viewMode === "week") return subWeeks(prev, 1);
      if (viewMode === "day") return addDays(prev, -1);
      return addDays(prev, -30); // month
    });
  };

  const navigateNext = () => {
    setCurrentDate(prev => {
      if (viewMode === "week") return addWeeks(prev, 1);
      if (viewMode === "day") return addDays(prev, 1);
      return addDays(prev, 30); // month
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get events for a specific day and time slot
  const getEventsForSlot = (date: Date, hour: number) => {
    return filteredEvents.filter(event => {
      if (event.isAllDay) return false;
      const eventStart = event.startTime;
      const eventEnd = event.endTime;
      
      return isSameDay(eventStart, date) && 
             getHours(eventStart) <= hour && 
             getHours(eventEnd) > hour;
    });
  };

  // Get all-day events for a date
  const getAllDayEvents = (date: Date) => {
    const allDayEvents = filteredEvents.filter(event => 
      event.isAllDay && isSameDay(event.startTime, date)
    );
    
    console.log(`🗓️ All-day events for ${date.toDateString()}:`, {
      date: date.toDateString(),
      totalFilteredEvents: filteredEvents.length,
      allDayEventsCount: allDayEvents.length,
      allDayEvents: allDayEvents.map(e => ({
        title: e.title,
        isAllDay: e.isAllDay,
        startTime: e.startTime.toDateString(),
        isSameDay: isSameDay(e.startTime, date)
      }))
    });
    
    return allDayEvents;
  };

  // Calculate event height and position
  const getEventStyle = (event: CalendarEvent): Record<string, string | number> => {
    if (event.isAllDay) return { top: '0px', height: '24px' };
    
    const startHour = getHours(event.startTime);
    const startMinute = getMinutes(event.startTime);
    const endHour = getHours(event.endTime);
    const endMinute = getMinutes(event.endTime);
    
    const startPosition = (startHour * 60 + startMinute) / 60;
    const duration = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60;
    
    return {
      top: `${startPosition * 60}px`,
      height: `${Math.max(duration * 60 - 2, 30)}px`,
    };
  };

  // Drag and drop handlers
  const handleEventDragStart = (event: CalendarEvent) => {
    setDraggedEvent(event);
  };

  const handleEventDrop = (date: Date, hour: number) => {
    if (!draggedEvent || !onEventUpdate) return;
    
    const newStartTime = setHours(setMinutes(date, 0), hour);
    const duration = draggedEvent.endTime.getTime() - draggedEvent.startTime.getTime();
    const newEndTime = new Date(newStartTime.getTime() + duration);
    
    onEventUpdate(draggedEvent.id, {
      startTime: newStartTime,
      endTime: newEndTime
    });
    
    setDraggedEvent(null);
  };

  const renderTimeSlot = (date: Date, timeSlot: typeof timeSlots[0]) => {
    const events = getEventsForSlot(date, timeSlot.hour);
    const isCurrentHour = isToday(date) && getHours(new Date()) === timeSlot.hour;
    
    return (
      <div
        key={`${format(date, 'yyyy-MM-dd')}-${timeSlot.hour}`}
        className={cn(
          "relative border-b border-border/20 h-[60px] group hover:bg-blue-50/30 transition-colors",
          isCurrentHour && "bg-blue-50/70 border-blue-200"
        )}
        onDrop={(e) => {
          e.preventDefault();
          handleEventDrop(date, timeSlot.hour);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
{events.map(event => <CalendarEventCard key={event.id} event={event} style={getEventStyle(event)} isDragged={draggedEvent?.id === event.id} onDragStart={() => handleEventDragStart(event)} onClick={() => onEventClick?.(event)} />)}
        
        {/* Add event button on hover */}
        <Button
          size="sm"
          variant="ghost"
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 bg-white/90 hover:bg-white shadow-sm"
          onClick={() => {
            const startTime = setHours(setMinutes(date, 0), timeSlot.hour);
            const endTime = setHours(setMinutes(date, 0), timeSlot.hour + 1);
            onEventCreate?.({ startTime, endTime });
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  const renderAllDayEvents = (date: Date) => {
    const allDayEvents = getAllDayEvents(date);
    
    return (
      <div className="min-h-[50px] border-b border-border/50 bg-gray-50/60 p-2">
        {allDayEvents.map(event => {
          const IconComponent = eventTypeIcons[event.type];
          
          return (
            <div
              key={event.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-white text-xs mb-1 cursor-pointer shadow-sm border border-white/20",
                eventTypeColors[event.type]
              )}
              onClick={() => onEventClick?.(event)}
            >
              <IconComponent className="h-3 w-3" />
              <span className="truncate">{event.title}</span>
            </div>
          );
        })}
        {allDayEvents.length === 0 && (
          <div className="text-xs text-muted-foreground/60 p-1 italic">All day</div>
        )}
      </div>
    );
  };

  const TodoSection = ({ title, todos, collapsible = true }: { 
    title: string; 
    todos: TodoItem[]; 
    collapsible?: boolean; 
  }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto font-medium text-sm"
            onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
          >
            {collapsible && (
              <ChevronRight className={cn("h-3 w-3 mr-1 transition-transform", !isCollapsed && "rotate-90")} />
            )}
            {title}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        
        {!isCollapsed && (
          <div className="space-y-1 ml-4">
            {todos.map(todo => (
              <div key={todo.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => onTodoToggle?.(todo.id)}
                  className="h-4 w-4"
                />
                <span className={cn(
                  "flex-1 truncate",
                  todo.completed && "line-through text-muted-foreground"
                )}>
                  {todo.title}
                </span>
                {todo.priority && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs px-1 h-4",
                      todo.priority === "high" && "border-red-300 text-red-700",
                      todo.priority === "medium" && "border-yellow-300 text-yellow-700",
                      todo.priority === "low" && "border-green-300 text-green-700"
                    )}
                  >
                    {todo.priority}
                  </Badge>
                )}
              </div>
            ))}
            {todos.length === 0 && (
              <div className="text-xs text-muted-foreground italic">No items</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("h-full flex bg-background", className)}>
      {/* Sidebar */}
      <div className="w-64 border-r-2 border-border bg-white shadow-sm flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b-2 border-border bg-gray-50/80">
          <h2 className="text-lg font-semibold mb-4">Calendar</h2>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button size="sm" className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
            <Button size="sm" variant="outline">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Today Section */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto font-medium"
                >
                  Today
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </div>
              
              <Tabs defaultValue="todo" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="todo" className="text-xs">To-do</TabsTrigger>
                  <TabsTrigger value="shopping" className="text-xs">Shopping</TabsTrigger>
                  <TabsTrigger value="events" className="text-xs">Events</TabsTrigger>
                </TabsList>
                
                <TabsContent value="todo" className="space-y-4 mt-4">
                  <TodoSection title="This week" todos={groupedTodos.week} />
                  <TodoSection title="This month" todos={groupedTodos.month} />
                  <TodoSection title="Unscheduled" todos={groupedTodos.unscheduled} />
                </TabsContent>
                
                <TabsContent value="shopping" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-0 h-auto font-medium text-sm"
                      >
                        Shopping List
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="space-y-1 ml-4">
                      {shoppingItems.map(item => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => onShoppingToggle?.(item.id)}
                            className="h-4 w-4"
                          />
                          <span className={cn(
                            "flex-1 truncate",
                            item.completed && "line-through text-muted-foreground"
                          )}>
                            🛒 {item.name}
                          </span>
                          {item.priority && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs px-1 h-4",
                                item.priority === "urgent" && "border-red-300 text-red-700",
                                item.priority === "high" && "border-orange-300 text-orange-700",
                                item.priority === "medium" && "border-yellow-300 text-yellow-700",
                                item.priority === "low" && "border-green-300 text-green-700"
                              )}
                            >
                              {item.priority}
                            </Badge>
                          )}
                        </div>
                      ))}
                      {shoppingItems.length === 0 && (
                        <div className="text-xs text-muted-foreground italic">No shopping items</div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="events" className="mt-4">
                  <div className="space-y-2">
                    {filteredEvents
                      .filter(event => isToday(event.startTime))
                      .map(event => {
                        const IconComponent = eventTypeIcons[event.type];
                        return (
                          <div
                            key={event.id}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-all"
                            onClick={() => onEventClick?.(event)}
                          >
                            <div className={cn("p-1 rounded", eventTypeColors[event.type])}>
                              <IconComponent className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{event.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {event.isAllDay ? 'All day' : 
                                  `${format(event.startTime, 'h:mm a')} - ${format(event.endTime, 'h:mm a')}`
                                }
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Calendar */}
      <div className="flex-1 flex flex-col">
        {/* Calendar Header */}
        <div className="border-b-2 border-border bg-white shadow-sm">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">Calendar</h1>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigatePrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="min-w-[60px]"
                >
                  Today
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={navigateNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-lg font-medium">
                {format(currentDate, 'MMMM yyyy')}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
              
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Event
              </Button>
            </div>
          </div>
          
          {/* Week header */}
          {viewMode === "week" && (
            <div className="grid grid-cols-8 border-t-2 border-border bg-gray-50/50">
              <div className="p-3 text-xs font-medium text-muted-foreground border-r-2 border-border bg-white">
                UTC +2
              </div>
              {weekDays.map(day => (
                <div
                  key={day.toISOString()}
                  className="p-3 border-r border-border last:border-r-0 text-center bg-white"
                >
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'EEE').toUpperCase()}
                  </div>
                  <div className={cn(
                    "text-lg font-medium",
                    isToday(day) && "text-blue-600"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar Content */}
        <ScrollArea className="flex-1 bg-gray-50/30">
          {viewMode === "week" && (
            <div className="grid grid-cols-8">
              {/* Time column */}
              <div className="border-r-2 border-border bg-white shadow-sm">
                <div className="h-[50px] border-b border-border/50 bg-gray-50/50 flex items-center px-3">
                  <span className="text-xs font-medium text-muted-foreground">All day</span>
                </div>
                {timeSlots.map(timeSlot => (
                  <div
                    key={timeSlot.hour}
                    className="h-[60px] border-b border-border/20 p-3 text-xs font-medium text-muted-foreground bg-white"
                  >
                    {timeSlot.label}
                  </div>
                ))}
              </div>
              
              {/* Day columns */}
              {weekDays.map(day => (
                <div key={day.toISOString()} className="border-r border-border last:border-r-0 bg-white">
                  {/* All day events */}
                  {renderAllDayEvents(day)}
                  
                  {/* Time slots */}
                  {timeSlots.map(timeSlot => renderTimeSlot(day, timeSlot))}
                </div>
              ))}
            </div>
          )}

          {viewMode === "month" && (
            <div className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {/* Month headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
                
                {/* Month days */}
                {weekDays.map(day => (
                  <div key={day.toISOString()} className="min-h-[120px] p-2 border border-border rounded-md bg-white">
                    <div className={cn(
                      "text-sm font-medium mb-2",
                      isToday(day) && "text-blue-600"
                    )}>
                      {format(day, 'd')}
                    </div>
                    
                    {/* Day events */}
                    <div className="space-y-1">
                      {filteredEvents
                        .filter(event => isSameDay(event.startTime, day))
                        .slice(0, 3)
                        .map(event => {
                          const IconComponent = eventTypeIcons[event.type];
                          return (
                            <div
                              key={event.id}
                              className={cn(
                                "text-xs p-1 rounded flex items-center gap-1 text-white cursor-pointer",
                                eventTypeColors[event.type]
                              )}
                              onClick={() => onEventClick?.(event)}
                            >
                              <IconComponent className="h-2 w-2" />
                              <span className="truncate">{event.title}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "day" && (
            <div className="grid grid-cols-2">
              {/* Time column */}
              <div className="border-r-2 border-border bg-white shadow-sm">
                <div className="h-[50px] border-b border-border/50 bg-gray-50/50 flex items-center px-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {format(currentDate, 'EEEE, MMMM d')}
                  </span>
                </div>
                {timeSlots.map(timeSlot => (
                  <div
                    key={timeSlot.hour}
                    className="h-[60px] border-b border-border/20 p-3 text-xs font-medium text-muted-foreground bg-white"
                  >
                    {timeSlot.label}
                  </div>
                ))}
              </div>
              
              {/* Single day column */}
              <div className="bg-white">
                {/* All day events */}
                {renderAllDayEvents(currentDate)}
                
                {/* Time slots */}
                {timeSlots.map(timeSlot => renderTimeSlot(currentDate, timeSlot))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}