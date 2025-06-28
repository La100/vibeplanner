"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, CheckSquare, AlertTriangle, ExternalLink } from "lucide-react";
import { useState } from "react";

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

export default function ProjectCalendarPage() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const hasAccess = useQuery(api.myFunctions.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );

  // Pobierz wszystkie zadania projektu
  const allTasks = useQuery(api.myFunctions.listProjectTasks, 
    project ? { projectId: project._id } : "skip"
  );

  if (project === undefined || allTasks === undefined || hasAccess === undefined) {
    return <div>Loading...</div>;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this project.</p>
      </div>
    );
  }

  // Filtruj zadania z datami
  const tasksWithDates = allTasks.filter(task => task.endDate);

  // Grupuj zadania po datach
  const tasksByDate: Record<string, typeof tasksWithDates> = {};
  tasksWithDates.forEach(task => {
    if (task.endDate) {
      const dateKey = new Date(task.endDate).toDateString();
      if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
      tasksByDate[dateKey].push(task);
    }
  });

  // Znajdź zadania dla wybranej daty
  const selectedDateTasks = selectedDate ? tasksByDate[selectedDate.toDateString()] || [] : [];

  // Daty z zadaniami dla podświetlenia w kalendarzu
  const datesWithTasks = Object.keys(tasksByDate).map(dateStr => new Date(dateStr));

  // Nadchodzące zadania (następne 7 dni)
  const upcomingTasks = tasksWithDates
    .filter(task => {
      if (!task.endDate) return false;
      const endDate = new Date(task.endDate);
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return endDate >= now && endDate <= nextWeek;
    })
    .sort((a, b) => (a.endDate || 0) - (b.endDate || 0));

  // Przeterminowane zadania
  const overdueTasks = tasksWithDates
    .filter(task => {
      if (!task.endDate || task.status === "completed") return false;
      return new Date(task.endDate) < new Date();
    })
    .sort((a, b) => (a.endDate || 0) - (b.endDate || 0));

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{project.name} - Calendar</h1>
        <p className="text-muted-foreground">View tasks by due date</p>
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
                  <span>Has tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Overdue tasks</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-gray-400" />
                  <span>Multiple tasks</span>
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
                      task.status !== "completed"
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
                      task.status !== "completed"
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
                                   <div key={task._id} className="p-2 border rounded">
                                     <div className="flex items-start justify-between mb-2">
                                       <div className="flex-1">
                                         <div className="font-medium text-sm">{task.title}</div>
                                         {task.description && (
                                           <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                             {task.description}
                                           </div>
                                         )}
                                       </div>
                                       <Badge 
                                         variant={task.priority === "urgent" ? "destructive" : "secondary"}
                                         className="text-xs ml-2"
                                       >
                                         {task.priority}
                                       </Badge>
                                     </div>
                                     <div className="flex items-center justify-between">
                                       <Badge variant="outline" className="text-xs">
                                         {task.status.replace("_", " ")}
                                       </Badge>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="h-6 px-2 text-xs"
                                         onClick={() => router.push(`/${params.slug}/${params.projectSlug}/tasks`)}
                                       >
                                         <ExternalLink className="h-3 w-3 mr-1" />
                                         View
                                       </Button>
                                     </div>
                                   </div>
                                 ))}
                               </div>
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    );
                  }
                }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>

        {/* Zadania dla wybranej daty */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDate 
                  ? `Tasks for ${selectedDate.toLocaleDateString()}`
                  : "Select a date"
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedDateTasks.length > 0 ? (
                  selectedDateTasks.map(task => (
                    <div 
                      key={task._id}
                      className={`p-3 rounded-lg border-l-4 ${priorityColors[task.priority]} bg-card`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          <Badge className={statusColors[task.status]}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {task.priority}
                          </Badge>
                          {task.estimatedHours && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {task.estimatedHours}h
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    {selectedDate 
                      ? "No tasks scheduled for this date"
                      : "Select a date to view tasks"
                    }
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Statystyki i listy zadań */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Statystyki */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Total with dates</span>
                </div>
                <span className="font-semibold">{tasksWithDates.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Overdue</span>
                </div>
                <span className="font-semibold text-red-600">{overdueTasks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Upcoming</span>
                </div>
                <span className="font-semibold text-orange-600">{upcomingTasks.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Nadchodzące zadania */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingTasks.slice(0, 5).map(task => (
                <div key={task._id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{task.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {task.endDate && new Date(task.endDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {upcomingTasks.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No upcoming tasks
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Przeterminowane zadania */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overdueTasks.slice(0, 5).map(task => (
                <div key={task._id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{task.title}</span>
                    <Badge variant="destructive" className="text-xs">
                      {task.priority}
                    </Badge>
                  </div>
                  <div className="text-xs text-red-600">
                    Due: {task.endDate && new Date(task.endDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {overdueTasks.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No overdue tasks 🎉
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 