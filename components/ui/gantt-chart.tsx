"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: {
    id: string;
    name: string;
    color: string;
  };
  progress?: number;
}

interface GanttChartProps {
  tasks: GanttTask[];
  onTaskMove?: (taskId: string, newStartDate: Date, newEndDate: Date) => Promise<void>;
  onTaskClick?: (task: GanttTask) => void;
  className?: string;
}

type ViewMode = "days" | "weeks" | "months";

const CELL_WIDTH = 40;
const ROW_HEIGHT = 40;
const SIDEBAR_WIDTH = 300;

const statusColors: Record<string, string> = {
  todo: "bg-gray-500",
  in_progress: "bg-blue-500", 
  review: "bg-yellow-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

export function GanttChart({ tasks, onTaskMove, onTaskClick, className }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("weeks");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate time periods based on view mode
  const timeUnits = useMemo(() => {
    const units: Date[] = [];
    const start = new Date(currentDate);
    start.setDate(1); // Start from beginning of month
    
    const periodsToShow = viewMode === "days" ? 60 : viewMode === "weeks" ? 26 : 12;
    
    for (let i = 0; i < periodsToShow; i++) {
      const date = new Date(start);
      
      if (viewMode === "days") {
        date.setDate(start.getDate() + i);
      } else if (viewMode === "weeks") {
        const weekStart = new Date(start);
        weekStart.setDate(start.getDate() - start.getDay() + (i * 7));
        date.setTime(weekStart.getTime());
      } else {
        date.setMonth(start.getMonth() + i);
      }
      
      units.push(new Date(date));
    }
    
    return units;
  }, [currentDate, viewMode]);

  // Format time unit labels
  const formatTimeUnit = (date: Date) => {
    if (viewMode === "days") {
      return date.getDate().toString();
    } else if (viewMode === "weeks") {
      return `W${Math.ceil(date.getDate() / 7)}`;
    } else {
      return date.toLocaleDateString("en", { month: "short" });
    }
  };

  // Calculate task position and width
  const getTaskPosition = (task: GanttTask) => {
    const startUnit = timeUnits.findIndex(unit => {
      if (viewMode === "days") {
        return unit.toDateString() === task.startDate.toDateString();
      } else if (viewMode === "weeks") {
        const weekEnd = new Date(unit);
        weekEnd.setDate(unit.getDate() + 6);
        return task.startDate >= unit && task.startDate <= weekEnd;
      } else {
        return unit.getMonth() === task.startDate.getMonth() && 
               unit.getFullYear() === task.startDate.getFullYear();
      }
    });

    const endUnit = timeUnits.findIndex(unit => {
      if (viewMode === "days") {
        return unit.toDateString() === task.endDate.toDateString();
      } else if (viewMode === "weeks") {
        const weekEnd = new Date(unit);
        weekEnd.setDate(unit.getDate() + 6);
        return task.endDate >= unit && task.endDate <= weekEnd;
      } else {
        return unit.getMonth() === task.endDate.getMonth() && 
               unit.getFullYear() === task.endDate.getFullYear();
      }
    });

    if (startUnit === -1 || endUnit === -1) return null;

    return {
      left: startUnit * CELL_WIDTH,
      width: Math.max((endUnit - startUnit + 1) * CELL_WIDTH, CELL_WIDTH),
    };
  };

  // Handle task drag
  const handleTaskDragStart = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault();
    setDraggedTask(taskId);
    setDragStartX(e.clientX);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setDragStartDate(new Date(task.startDate));
    }
  };

  const handleTaskDrag = useCallback((e: MouseEvent) => {
    if (!draggedTask || !dragStartDate) return;

    const deltaX = e.clientX - dragStartX;
    const unitsDelta = Math.round(deltaX / CELL_WIDTH);
    
    if (unitsDelta !== 0) {
      const task = tasks.find(t => t.id === draggedTask);
      if (task) {
        const taskDuration = task.endDate.getTime() - task.startDate.getTime();
        const newStartDate = new Date(dragStartDate);
        
        if (viewMode === "days") {
          newStartDate.setDate(newStartDate.getDate() + unitsDelta);
        } else if (viewMode === "weeks") {
          newStartDate.setDate(newStartDate.getDate() + (unitsDelta * 7));
        } else {
          newStartDate.setMonth(newStartDate.getMonth() + unitsDelta);
        }
        
        const newEndDate = new Date(newStartDate.getTime() + taskDuration);
        
        if (onTaskMove) {
          onTaskMove(draggedTask, newStartDate, newEndDate);
        }
      }
    }
  }, [draggedTask, dragStartX, dragStartDate, onTaskMove, tasks, viewMode]);

  const handleTaskDragEnd = () => {
    setDraggedTask(null);
    setDragStartX(0);
    setDragStartDate(null);
  };

  // Add global mouse event listeners for drag
  useEffect(() => {
    if (draggedTask) {
      document.addEventListener("mousemove", handleTaskDrag);
      document.addEventListener("mouseup", handleTaskDragEnd);
      
      return () => {
        document.removeEventListener("mousemove", handleTaskDrag);
        document.removeEventListener("mouseup", handleTaskDragEnd);
      };
    }
  }, [draggedTask, dragStartX, dragStartDate, handleTaskDrag]);

  // Navigate time periods
  const navigateTime = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    const amount = direction === "next" ? 1 : -1;
    
    if (viewMode === "days") {
      newDate.setMonth(newDate.getMonth() + amount);
    } else if (viewMode === "weeks") {
      newDate.setMonth(newDate.getMonth() + amount);
    } else {
      newDate.setFullYear(newDate.getFullYear() + amount);
    }
    
    setCurrentDate(newDate);
  };

  // Get current period label
  const getCurrentPeriodLabel = () => {
    if (viewMode === "days") {
      return currentDate.toLocaleDateString("en", { month: "long", year: "numeric" });
    } else if (viewMode === "weeks") {
      return currentDate.toLocaleDateString("en", { month: "long", year: "numeric" });
    } else {
      return currentDate.getFullYear().toString();
    }
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Gantt Chart
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => navigateTime("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[120px] text-center">
                {getCurrentPeriodLabel()}
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateTime("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Task List Sidebar */}
          <div className="flex-shrink-0 bg-muted/30 border-r" style={{ width: SIDEBAR_WIDTH }}>
            <div className="sticky top-0 bg-background border-b px-4 py-3 font-medium text-sm">
              Tasks ({tasks.length})
            </div>
            <ScrollArea className="h-[calc(100%-40px)]">
              <div className="space-y-0">
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={cn(
                      "px-4 py-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                      index % 2 === 0 ? "bg-background" : "bg-muted/20"
                    )}
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <div className="flex items-center justify-between h-full">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-sm truncate">
                            {task.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                            style={{ backgroundColor: `${task.status.color}15`, color: task.status.color }}
                          >
                            {task.status.name}
                          </Badge>
                          {task.progress !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {task.progress}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-hidden">
            {/* Timeline Header */}
            <div className="sticky top-0 bg-background border-b">
              <div className="flex">
                {timeUnits.map((unit, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 border-r border-border bg-muted/30 px-2 py-3 text-center text-xs font-medium"
                    style={{ width: CELL_WIDTH }}
                  >
                    {formatTimeUnit(unit)}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Content */}
            <ScrollArea className="h-[calc(100%-40px)]" ref={scrollContainerRef}>
              <div className="relative">
                {/* Grid Lines */}
                <div className="absolute inset-0">
                  {timeUnits.map((_, index) => (
                    <div
                      key={index}
                      className="absolute top-0 bottom-0 border-r border-border/30"
                      style={{ left: index * CELL_WIDTH }}
                    />
                  ))}
                  {tasks.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "absolute left-0 right-0 border-b border-border/30",
                        index % 2 === 0 ? "bg-background" : "bg-muted/20"
                      )}
                      style={{ 
                        top: index * ROW_HEIGHT,
                        height: ROW_HEIGHT
                      }}
                    />
                  ))}
                </div>

                {/* Task Bars */}
                <div className="relative">
                  {tasks.map((task, index) => {
                    const position = getTaskPosition(task);
                    if (!position) return null;

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "absolute cursor-move rounded-md shadow-sm transition-all duration-200 hover:shadow-md",
                          statusColors[task.status.id] || "bg-gray-500",
                          draggedTask === task.id ? "opacity-50 scale-105" : "opacity-90 hover:opacity-100"
                        )}
                        style={{
                          top: index * ROW_HEIGHT + 8,
                          height: ROW_HEIGHT - 16,
                          left: position.left + 4,
                          width: position.width - 8,
                        }}
                        onMouseDown={(e) => handleTaskDragStart(e, task.id)}
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center h-full px-2 text-white text-xs font-medium">
                          <span className="truncate">{task.name}</span>
                          {task.progress !== undefined && (
                            <span className="ml-auto text-xs opacity-75">
                              {task.progress}%
                            </span>
                          )}
                        </div>
                        
                        {/* Progress bar */}
                        {task.progress !== undefined && task.progress > 0 && (
                          <div
                            className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-md"
                            style={{ width: `${task.progress}%` }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Today Line */}
                {(() => {
                  const today = new Date();
                  const todayUnit = timeUnits.findIndex(unit => {
                    if (viewMode === "days") {
                      return unit.toDateString() === today.toDateString();
                    } else if (viewMode === "weeks") {
                      const weekEnd = new Date(unit);
                      weekEnd.setDate(unit.getDate() + 6);
                      return today >= unit && today <= weekEnd;
                    } else {
                      return unit.getMonth() === today.getMonth() && 
                             unit.getFullYear() === today.getFullYear();
                    }
                  });

                  if (todayUnit !== -1) {
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-lg z-10"
                        style={{ left: todayUnit * CELL_WIDTH + CELL_WIDTH / 2 }}
                      >
                        <div className="absolute -top-2 -left-1.5 w-3 h-3 bg-red-500 rotate-45" />
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Minimum height to show grid */}
                <div style={{ height: Math.max(tasks.length * ROW_HEIGHT, 400) }} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}