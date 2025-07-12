"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, CheckSquare, AlertTriangle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type TaskStatus = "todo" | "in_progress" | "review" | "completed" | "blocked";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-800 border-gray-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  review: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
};

const priorityColors: Record<TaskPriority, string> = {
  low: "border-l-gray-300",
  medium: "border-l-blue-300",
  high: "border-l-orange-300",
  urgent: "border-l-red-300",
};

export function ProjectCalendarSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-1/3 mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-48" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Skeleton className="h-6 w-24 mb-2" />
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div>
                <Skeleton className="h-6 w-28 mb-2" />
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ProjectCalendar() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const { project } = useProject();

  const hasAccess = useQuery(api.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  const allTasks = useQuery(api.tasks.listProjectTasks, {
    projectId: project._id,
  });

  if (!allTasks || hasAccess === false) {
    // Convex useQuery will suspend here, so this logic is for handling
    // null project or access denied after data is loaded.
    if (hasAccess === false) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this project.</p>
        </div>
      );
    }
     if (!project) {
      return <div>Project not found.</div>;
    }
    // This part should technically be unreachable if useQuery suspends correctly
    return null;
  }

  // Filtruj zadania z datami (muszą mieć przynajmniej endDate lub startDate)
  const tasksWithDates = allTasks.filter(task => task.startDate || task.endDate);

  // Funkcja pomocnicza do generowania dat w zakresie
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

  // Grupuj zadania po datach (włączając zakresy dat)
  const tasksByDate: Record<string, typeof tasksWithDates> = {};
  tasksWithDates.forEach(task => {
    const dateRange = getDateRange(task.startDate, task.endDate);
    dateRange.forEach(date => {
      const dateKey = date.toDateString();
      if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
      tasksByDate[dateKey].push(task);
    });
  });

  // Znajdź zadania dla wybranej daty
  const selectedDateTasks = selectedDate ? tasksByDate[selectedDate.toDateString()] || [] : [];

  // Daty z zadaniami dla podświetlenia w kalendarzu
  const datesWithTasks = Object.keys(tasksByDate).map(dateStr => new Date(dateStr));

  // Nadchodzące zadania (rozpoczynające się w następne 7 dni)
  const upcomingTasks = tasksWithDates
    .filter(task => {
      const taskDate = task.startDate || task.endDate;
      if (!taskDate) return false;
      const date = new Date(taskDate);
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return date >= now && date <= nextWeek;
    })
    .sort((a, b) => (a.startDate || a.endDate || 0) - (b.startDate || b.endDate || 0));

  // Przeterminowane zadania (zakończone w przeszłości ale nie completed)
  const overdueTasks = tasksWithDates
    .filter(task => {
      if (task.status === "done") return false;
      const endDate = task.endDate;
      if (!endDate) return false;
      return new Date(endDate) < new Date();
    })
    .sort((a, b) => (a.endDate || 0) - (b.endDate || 0));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{project.name} - Calendar</h1>
        <p className="text-muted-foreground">View tasks by date ranges</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kalendarz */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Project Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>Active tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Overdue tasks</span>
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
                onSelect={setSelectedDate}
                modifiers={{
                  hasTasks: datesWithTasks,
                  overdue: datesWithTasks.filter(date => {
                    const tasks = tasksByDate[date.toDateString()] || [];
                    return tasks.some(task => 
                      task.endDate && 
                      new Date(task.endDate) < new Date() && 
                      task.status !== "done"
                    );
                  }),
                }}
                modifiersClassNames={{
                  hasTasks: "relative",
                  overdue: "relative",
                }}
                components={{
                  DayButton: ({ day, modifiers, ...props }) => {
                    const dateStr = day.date.toDateString();
                    const dayTasks = tasksByDate[dateStr] || [];
                    const hasOverdue = dayTasks.some(task => 
                      task.endDate && 
                      new Date(task.endDate) < new Date() && 
                      task.status !== "done"
                    );
                    
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button 
                            {...props}
                            className={`
                              relative h-9 w-9 p-0 font-normal transition-colors
                              ${modifiers.selected ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 
                                modifiers.today ? 'bg-accent text-accent-foreground' : 
                                'hover:bg-accent hover:text-accent-foreground'}
                              ${dayTasks.length > 0 ? 'font-semibold' : ''}
                              rounded-md border-0 focus:ring-2 focus:ring-primary focus:ring-offset-2
                            `}
                          >
                            <span>{day.date.getDate()}</span>
                            {dayTasks.length > 0 && (
                              <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                                <div className={`h-2 w-2 rounded-full ${
                                  hasOverdue ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
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
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {dayTasks.map(task => (
                                  <div
                                    key={task._id}
                                    className={`text-xs p-2 rounded border-l-2 ${task.priority && task.priority !== null ? priorityColors[task.priority as TaskPriority] : 'border-l-gray-200'}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium truncate">{task.title}</span>
                                      <Badge 
                                        className={`${statusColors[task.status as TaskStatus]} text-xs`}
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

          {/* Zadania na wybrany dzień */}
          {selectedDate && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  Tasks for {selectedDate.toLocaleDateString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateTasks.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateTasks.map(task => (
                      <div
                        key={task._id}
                        className={`p-3 rounded-lg border-l-4 ${task.priority && task.priority !== null ? priorityColors[task.priority as TaskPriority] : 'border-l-gray-200'} hover:bg-accent/50 transition-colors`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge className={statusColors[task.status as TaskStatus]}>
                                {task.status.replace("_", " ")}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/${params.slug}/${params.projectSlug}/tasks`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No tasks scheduled for this date.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar z nadchodzącymi i przeterminowanymi zadaniami */}
        <div className="space-y-6">
          {/* Przeterminowane zadania */}
          {overdueTasks.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Overdue ({overdueTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overdueTasks.slice(0, 5).map(task => (
                    <div
                      key={task._id}
                      className="p-2 rounded border-l-2 border-l-red-300 bg-red-50/50"
                    >
                      <h5 className="font-medium text-sm text-red-800">{task.title}</h5>
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
                  {overdueTasks.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{overdueTasks.length - 5} more overdue tasks
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nadchodzące zadania */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming ({upcomingTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingTasks.length > 0 ? (
                <div className="space-y-2">
                  {upcomingTasks.slice(0, 8).map(task => (
                    <div
                      key={task._id}
                      className={`p-2 rounded border-l-2 ${task.priority && task.priority !== null ? priorityColors[task.priority as TaskPriority] : 'border-l-gray-200'}`}
                    >
                      <h5 className="font-medium text-sm">{task.title}</h5>
                      <p className="text-xs text-muted-foreground">
                        {task.startDate && task.endDate ? (
                          <>{new Date(task.startDate).toLocaleDateString()} - {new Date(task.endDate).toLocaleDateString()}</>
                        ) : task.startDate ? (
                          <>Start: {new Date(task.startDate).toLocaleDateString()}</>
                        ) : task.endDate ? (
                          <>Due: {new Date(task.endDate).toLocaleDateString()}</>
                        ) : null}
                      </p>
                      <Badge className={`mt-1 text-xs ${statusColors[task.status as TaskStatus]}`}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                  {upcomingTasks.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      +{upcomingTasks.length - 8} more upcoming tasks
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No upcoming tasks in the next 7 days.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Szybkie akcje */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push(`/${params.slug}/${params.projectSlug}/tasks`)}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                View All Tasks
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => router.push(`/${params.slug}/${params.projectSlug}/gantt`)}
              >
                <Clock className="h-4 w-4 mr-2" />
                Gantt Chart
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 