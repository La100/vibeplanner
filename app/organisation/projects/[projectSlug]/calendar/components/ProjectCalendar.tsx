"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckSquare,
  Repeat,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";

// --- Types ---

type CalendarTask = {
  _id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent" | null;
  startDate?: number;
  endDate?: number;
  assignedToName?: string;
};

type CalendarDiaryEntry = {
  _id: string;
  date: string;
  mood?: string;
  contentPreview: string;
  source: "user" | "assistant";
};

type DayData = {
  tasks: CalendarTask[];
  habits: { _id: string; name: string; completed: boolean }[];
  diary: CalendarDiaryEntry[];
};

type EventType = "task" | "habit" | "diary";

// --- Helpers ---

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isHabitScheduledForDate(
  scheduleDays: string[] | undefined,
  date: Date
): boolean {
  if (!scheduleDays || scheduleDays.length === 0) return true;
  const dow = DOW_KEYS[date.getDay()];
  return scheduleDays.includes(dow);
}

function dateToStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function moodEmoji(mood: string): string {
  const map: Record<string, string> = {
    great: "\u{1F31F}",
    good: "\u{1F60A}",
    neutral: "\u{1F610}",
    bad: "\u{1F614}",
    terrible: "\u{1F622}",
  };
  return map[mood] || "\u{1F4DD}";
}

const statusBadgeColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-green-100 text-green-700 border-green-200",
};

const priorityBorderColors: Record<string, string> = {
  low: "border-l-gray-300",
  medium: "border-l-blue-300",
  high: "border-l-orange-300",
  urgent: "border-l-red-400",
};

// --- Skeleton ---

export function ProjectCalendarSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-8" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`c-${i}`} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function ProjectCalendar() {
  const { project } = useProject();

  const hasAccess = useQuery(apiAny.projects.checkUserProjectAccess, {
    projectId: project._id,
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<EventType>>(
    new Set(["task", "habit", "diary"])
  );

  const calendarData = useQuery(
    apiAny.calendar.getProjectCalendarData,
    hasAccess ? { projectId: project._id, month: currentMonth } : "skip"
  );

  // Parse current month for grid generation
  const [year, monthIdx] = useMemo(() => {
    const [y, m] = currentMonth.split("-");
    return [parseInt(y, 10), parseInt(m, 10) - 1] as const;
  }, [currentMonth]);

  const monthDate = useMemo(() => new Date(year, monthIdx, 1), [year, monthIdx]);

  // Generate all day cells for the grid
  const allDays = useMemo(() => {
    const mStart = startOfMonth(monthDate);
    const mEnd = endOfMonth(monthDate);
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthDate]);

  // Build day data map
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    if (!calendarData) return map;

    const initDay = (key: string): DayData => {
      if (!map.has(key)) map.set(key, { tasks: [], habits: [], diary: [] });
      return map.get(key)!;
    };

    // Tasks
    for (const task of calendarData.tasks) {
      const s = task.startDate;
      const e = task.endDate;
      if (!s && !e) continue;

      const taskStart = new Date(s || e!);
      const taskEnd = new Date(e || s!);
      // Clamp to displayed range
      const rangeStart = allDays[0] > taskStart ? allDays[0] : taskStart;
      const rangeEnd = allDays[allDays.length - 1] < taskEnd ? allDays[allDays.length - 1] : taskEnd;

      if (rangeStart > rangeEnd) {
        // Single point: add to whichever date exists
        const key = dateToStr(taskStart);
        initDay(key).tasks.push(task);
        continue;
      }

      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      for (const d of days) {
        initDay(dateToStr(d)).tasks.push(task);
      }
    }

    // Habits
    for (const day of allDays) {
      const key = dateToStr(day);
      for (const habit of calendarData.habits) {
        if (!isHabitScheduledForDate(habit.scheduleDays, day)) continue;
        const completedDates = calendarData.habitCompletions[habit._id] || [];
        const completed = completedDates.includes(key);
        initDay(key).habits.push({
          _id: habit._id,
          name: habit.name,
          completed,
        });
      }
    }

    // Diary
    for (const entry of calendarData.diaryEntries) {
      initDay(entry.date).diary.push(entry);
    }

    return map;
  }, [calendarData, allDays]);

  // Navigation
  const goToPrevMonth = () => {
    const d = new Date(year, monthIdx - 1, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    const d = new Date(year, monthIdx + 1, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDate(null);
  };

  const toggleType = (type: EventType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Selected day data
  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return dayDataMap.get(selectedDate) || { tasks: [], habits: [], diary: [] };
  }, [selectedDate, dayDataMap]);

  // --- Access / Loading states ---

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to access this project.
        </p>
      </div>
    );
  }

  if (hasAccess === undefined || calendarData === undefined) {
    return <ProjectCalendarSkeleton />;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b bg-card">
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[160px] text-center">
            {format(monthDate, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Type filters */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={visibleTypes.has("task") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("task")}
          >
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            Tasks
          </Button>
          <Button
            variant={visibleTypes.has("habit") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("habit")}
          >
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            Habits
          </Button>
          <Button
            variant={visibleTypes.has("diary") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => toggleType("diary")}
          >
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            Diary
          </Button>
        </div>
      </div>

      {/* Calendar content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-px rounded-t-lg overflow-hidden">
            {WEEKDAY_HEADERS.map((day) => (
              <div
                key={day}
                className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden -mt-4">
            {allDays.map((day) => {
              const key = dateToStr(day);
              const data = dayDataMap.get(key);
              const inMonth = isSameMonth(day, monthDate);
              const today = isToday(day);
              const isSelected = selectedDate === key;

              const hasTasks = visibleTypes.has("task") && (data?.tasks.length ?? 0) > 0;
              const hasHabits = visibleTypes.has("habit") && (data?.habits.length ?? 0) > 0;
              const hasDiary = visibleTypes.has("diary") && (data?.diary.length ?? 0) > 0;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : key)}
                  className={cn(
                    "bg-card min-h-[80px] p-1.5 text-left transition-colors relative",
                    !inMonth && "bg-muted/30 text-muted-foreground/50",
                    today && "ring-2 ring-primary/30 ring-inset",
                    isSelected && "bg-accent ring-2 ring-primary/50 ring-inset",
                    !isSelected && "hover:bg-accent/50",
                    "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      today && "text-primary font-bold"
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Dots */}
                  <div className="flex gap-0.5 mt-1">
                    {hasTasks && <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                    {hasHabits && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    {hasDiary && <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                  </div>

                  {/* Task previews on desktop */}
                  {hasTasks && (
                    <div className="hidden sm:block mt-1 space-y-0.5">
                      {data!.tasks.slice(0, 2).map((task) => (
                        <div
                          key={task._id}
                          className="text-[10px] leading-tight truncate text-blue-700 dark:text-blue-400"
                        >
                          {task.title}
                        </div>
                      ))}
                      {data!.tasks.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{data!.tasks.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Day detail panel */}
          {selectedDate && selectedDayData && (
            <Card className="rounded-2xl border bg-card/80">
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedDate(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Tasks */}
                {visibleTypes.has("task") && selectedDayData.tasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckSquare className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">
                        Tasks ({selectedDayData.tasks.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedDayData.tasks.map((task) => (
                        <div
                          key={task._id}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border-l-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30",
                            task.priority
                              ? priorityBorderColors[task.priority]
                              : "border-l-gray-200"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                            {task.assignedToName && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {task.assignedToName}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("text-xs ml-2 shrink-0", statusBadgeColors[task.status])}
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Habits */}
                {visibleTypes.has("habit") && selectedDayData.habits.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Repeat className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium">
                        Habits ({selectedDayData.habits.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedDayData.habits.map((habit) => (
                        <div
                          key={habit._id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30"
                        >
                          <span className="text-sm">{habit.name}</span>
                          {habit.completed ? (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs"
                            >
                              Done
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diary */}
                {visibleTypes.has("diary") && selectedDayData.diary.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">Diary</span>
                    </div>
                    {selectedDayData.diary.map((entry) => (
                      <div
                        key={entry._id}
                        className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {entry.mood && (
                            <span className="text-sm">{moodEmoji(entry.mood)}</span>
                          )}
                          {entry.source === "assistant" && (
                            <Badge variant="outline" className="text-[10px]">
                              AI
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.contentPreview}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {((!visibleTypes.has("task") || selectedDayData.tasks.length === 0) &&
                  (!visibleTypes.has("habit") || selectedDayData.habits.length === 0) &&
                  (!visibleTypes.has("diary") || selectedDayData.diary.length === 0)) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nothing scheduled for this day.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
