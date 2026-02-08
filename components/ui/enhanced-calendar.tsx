"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  CheckSquare,
  AlertTriangle,
  ExternalLink,
  CalendarDays,
  Filter,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarTask {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "completed" | "blocked";
  priority?: "low" | "medium" | "high" | "urgent";
  startDate?: number;
  endDate?: number;
  estimatedHours?: number;
}

interface EnhancedCalendarProps {
  tasks: CalendarTask[];
  onTaskClick?: (task: CalendarTask) => void;
  onDateSelect?: (date: Date | undefined) => void;
  className?: string;
}

type ViewMode = "month" | "week" | "day";
type FilterStatus = "all" | "todo" | "in_progress" | "completed" | "blocked";

const statusColors: Record<CalendarTask["status"], string> = {
  todo: "bg-gray-100 text-gray-800 border-gray-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
};

const priorityColors: Record<NonNullable<CalendarTask["priority"]>, string> = {
  low: "border-l-gray-300",
  medium: "border-l-blue-300",
  high: "border-l-orange-300",
  urgent: "border-l-red-300",
};

const statusDotColors: Record<CalendarTask["status"], string> = {
  todo: "bg-gray-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  blocked: "bg-red-500",
};

export function EnhancedCalendar({
  tasks,
  onTaskClick,
  onDateSelect,
  className
}: EnhancedCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  // Filter tasks by status
  const filteredTasks = useMemo(() => {
    return statusFilter === "all"
      ? tasks
      : tasks.filter(task => task.status === statusFilter);
  }, [tasks, statusFilter]);

  // Tasks with dates
  const tasksWithDates = useMemo(() => {
    return filteredTasks.filter(task => task.startDate || task.endDate);
  }, [filteredTasks]);

  // Generate date range for a task
  const getDateRange = (startDate: number | undefined, endDate: number | undefined): Date[] => {
    if (!startDate && !endDate) return [];

    const start = startDate ? new Date(startDate) : new Date(endDate!);
    const end = endDate ? new Date(endDate) : new Date(startDate!);

    const dates: Date[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  };

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, CalendarTask[]> = {};

    tasksWithDates.forEach(task => {
      const dateRange = getDateRange(task.startDate, task.endDate);
      dateRange.forEach(date => {
        const dateKey = date.toDateString();
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(task);
      });
    });

    return grouped;
  }, [tasksWithDates]);

  // Selected date tasks
  const selectedDateTasks = useMemo(() => {
    return selectedDate ? tasksByDate[selectedDate.toDateString()] || [] : [];
  }, [selectedDate, tasksByDate]);

  // Dates with tasks
  const datesWithTasks = useMemo(() => {
    return Object.keys(tasksByDate).map(dateStr => new Date(dateStr));
  }, [tasksByDate]);

  // Upcoming tasks (next 7 days)
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return tasksWithDates
      .filter(task => {
        const taskDate = task.startDate || task.endDate;
        if (!taskDate) return false;
        const date = new Date(taskDate);
        return date >= now && date <= nextWeek;
      })
      .sort((a, b) => (a.startDate || a.endDate || 0) - (b.startDate || b.endDate || 0));
  }, [tasksWithDates]);

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    const now = new Date();

    return tasksWithDates
      .filter(task => {
        if (task.status === "completed") return false;
        const endDate = task.endDate;
        if (!endDate) return false;
        return new Date(endDate) < now;
      })
      .sort((a, b) => (a.endDate || 0) - (b.endDate || 0));
  }, [tasksWithDates]);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6", className)}>
      {/* Main Calendar */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Assistant Calendar
              </CardTitle>

              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(value: FilterStatus) => setStatusFilter(value)}>
                  <SelectTrigger className="w-32">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Active tasks</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span>Overdue</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-gray-400" />
                <span>Multiple tasks</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1 w-4 bg-green-500" />
                <span>Task ranges</span>
              </div>
            </div>

            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              modifiers={{
                hasTasks: datesWithTasks,
                overdue: datesWithTasks.filter(date => {
                  const tasks = tasksByDate[date.toDateString()] || [];
                  return tasks.some(task =>
                    task.endDate &&
                    new Date(task.endDate) < new Date() &&
                    task.status !== "completed"
                  );
                }),
              }}
              components={{
                DayButton: ({ day, modifiers, ...props }) => {
                  const dateStr = day.date.toDateString();
                  const dayTasks = tasksByDate[dateStr] || [];
                  const hasOverdue = dayTasks.some(task =>
                    task.endDate &&
                    new Date(task.endDate) < new Date() &&
                    task.status !== "completed"
                  );

                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          {...props}
                          className={cn(
                            "relative h-9 w-9 p-0 font-normal transition-colors rounded-md border-0",
                            "focus:ring-2 focus:ring-primary focus:ring-offset-2",
                            modifiers.selected
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : modifiers.today
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-accent hover:text-accent-foreground',
                            dayTasks.length > 0 ? 'font-semibold' : ''
                          )}
                        >
                          <span>{day.date.getDate()}</span>
                          {dayTasks.length > 0 && (
                            <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                              <div className={cn(
                                "h-2 w-2 rounded-full",
                                hasOverdue ? 'bg-red-500' : 'bg-blue-500'
                              )} />
                              {dayTasks.length > 1 && (
                                <div className="h-2 w-2 rounded-full bg-gray-400" />
                              )}
                            </div>
                          )}
                        </button>
                      </PopoverTrigger>
                      {dayTasks.length > 0 && (
                        <PopoverContent className="w-80" side="right">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">
                              Tasks for {day.date.toLocaleDateString()}
                            </h4>
                            <ScrollArea className="max-h-40">
                              <div className="space-y-2">
                                {dayTasks.map(task => (
                                  <div
                                    key={task.id}
                                    className={cn(
                                      "text-xs p-2 rounded border-l-2 cursor-pointer hover:bg-accent/50",
                                      task.priority ? priorityColors[task.priority] : 'border-l-gray-200'
                                    )}
                                    onClick={() => onTaskClick?.(task)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium truncate">{task.title}</span>
                                      <Badge
                                        className={cn("text-xs", statusColors[task.status])}
                                        variant="outline"
                                      >
                                        {task.status.replace("_", " ")}
                                      </Badge>
                                    </div>
                                    {task.startDate && task.endDate && (
                                      <p className="text-muted-foreground mt-1 text-xs">
                                        {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
                                      </p>
                                    )}
                                    {task.description && (
                                      <p className="text-muted-foreground mt-1 text-xs">
                                        {task.description.substring(0, 60)}
                                        {task.description.length > 60 ? "..." : ""}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        </PopoverContent>
                      )}
                    </Popover>
                  );
                },
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Selected Date Tasks */}
        {selectedDate && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Tasks for {selectedDate.toLocaleDateString()}
                <Badge variant="secondary" className="ml-auto">
                  {selectedDateTasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateTasks.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {selectedDateTasks.map(task => (
                      <div
                        key={task.id}
                        className={cn(
                          "p-3 rounded-lg border-l-4 hover:bg-accent/50 transition-colors cursor-pointer",
                          task.priority ? priorityColors[task.priority] : 'border-l-gray-200'
                        )}
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge className={statusColors[task.status]}>
                                {task.status.replace("_", " ")}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {task.startDate && task.endDate ? (
                                <>
                                  {new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}
                                </>
                              ) : task.startDate ? (
                                <>Start: {new Date(task.startDate).toLocaleDateString()}</>
                              ) : task.endDate ? (
                                <>Due: {new Date(task.endDate).toLocaleDateString()}</>
                              ) : null}
                              {task.estimatedHours && (
                                <>
                                  <span>•</span>
                                  <span>{task.estimatedHours}h estimated</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No tasks scheduled for this date.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Next 7 Days
                  <Badge variant="secondary" className="ml-auto">
                    {upcomingTasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingTasks.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {upcomingTasks.map(task => (
                        <div
                          key={task.id}
                          className={cn(
                            "p-2 rounded border-l-2 cursor-pointer hover:bg-accent/50",
                            task.priority ? priorityColors[task.priority] : 'border-l-gray-200'
                          )}
                          onClick={() => onTaskClick?.(task)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cn("h-2 w-2 rounded-full", statusDotColors[task.status])} />
                            <h5 className="font-medium text-sm flex-1">{task.title}</h5>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {task.startDate && task.endDate ? (
                              <>{new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}</>
                            ) : task.startDate ? (
                              <>Start: {new Date(task.startDate).toLocaleDateString()}</>
                            ) : task.endDate ? (
                              <>Due: {new Date(task.endDate).toLocaleDateString()}</>
                            ) : null}
                          </p>
                          <Badge className={cn("mt-1 text-xs", statusColors[task.status])}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No upcoming tasks in the next 7 days.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overdue" className="mt-4">
            <Card className={overdueTasks.length > 0 ? "border-red-200" : ""}>
              <CardHeader>
                <CardTitle className={cn(
                  "flex items-center gap-2",
                  overdueTasks.length > 0 ? "text-red-600" : ""
                )}>
                  <AlertTriangle className="h-5 w-5" />
                  Overdue
                  <Badge variant={overdueTasks.length > 0 ? "destructive" : "secondary"} className="ml-auto">
                    {overdueTasks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overdueTasks.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {overdueTasks.map(task => (
                        <div
                          key={task.id}
                          className="p-2 rounded border-l-2 border-l-red-300 bg-red-50/50 cursor-pointer hover:bg-red-100/50"
                          onClick={() => onTaskClick?.(task)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                            <h5 className="font-medium text-sm text-red-800 flex-1">{task.title}</h5>
                          </div>
                          <p className="text-xs text-red-600">
                            {task.startDate && task.endDate ? (
                              <>{new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}</>
                            ) : task.endDate ? (
                              <>Due: {new Date(task.endDate).toLocaleDateString()}</>
                            ) : null}
                          </p>
                          <Badge className="mt-1 text-xs bg-red-100 text-red-700">
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No overdue tasks. Great job! 🎉
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Task Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Task Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statusColors).map(([status]) => {
                const count = filteredTasks.filter(task => task.status === status).length;
                const percentage = filteredTasks.length > 0 ? (count / filteredTasks.length) * 100 : 0;

                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-3 w-3 rounded-full", statusDotColors[status as CalendarTask["status"]])} />
                      <span className="text-sm capitalize">{status.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all", statusDotColors[status as CalendarTask["status"]])}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
