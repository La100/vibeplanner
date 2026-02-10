"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, LayoutDashboard, Target, TrendingUp } from "lucide-react";

type HabitItem = {
  _id: string;
  name: string;
  description?: string;
  scheduleDays?: string[];
  isActive: boolean;
  completedToday?: boolean;
};

type HabitsWeekPayload = {
  dates: string[];
  today?: string;
  habits: HabitItem[];
  completionsByHabitId: Record<string, string[]>;
};

type HabitsTimelineDay = {
  date: string;
  scheduled: number;
  completed: number;
  percent: number;
};

type HabitsTimelinePayload = {
  startDate: string;
  today: string;
  days: HabitsTimelineDay[];
  overall: {
    scheduled: number;
    completed: number;
    percent: number;
  };
};

const EMPTY_HABITS: HabitItem[] = [];
const EMPTY_DATES: string[] = [];
const EMPTY_COMPLETIONS: Record<string, string[]> = {};
const EMPTY_TIMELINE_DAYS: HabitsTimelineDay[] = [];

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type DowKey = (typeof DOW_KEYS)[number];

const dateToDowKey = (dateStr: string): DowKey => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return DOW_KEYS[d.getUTCDay()];
};

const isScheduledForDate = (habit: HabitItem, dateStr: string) => {
  if (!habit.isActive) return false;
  const schedule = habit.scheduleDays;
  if (!schedule || schedule.length === 0) return true;
  return schedule.includes(dateToDowKey(dateStr));
};

const formatDateLabel = (dateStr?: string) => {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${dateStr}T00:00:00Z`));
};

const formatShortDate = (dateStr?: string) => {
  if (!dateStr) return "";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${dateStr}T00:00:00Z`));
};

const getDayIntensityClass = (day: HabitsTimelineDay) => {
  if (day.scheduled === 0) return "border border-border/60 bg-muted/40";
  if (day.percent >= 100) return "border border-primary/60 bg-primary";
  if (day.percent >= 80) return "border border-primary/50 bg-primary/80";
  if (day.percent >= 60) return "border border-primary/40 bg-primary/60";
  if (day.percent >= 40) return "border border-primary/30 bg-primary/40";
  if (day.percent >= 20) return "border border-primary/25 bg-primary/25";
  return "border border-primary/20 bg-primary/15";
};

export function ProjectDashboard() {
  const { project } = useProject();

  const week = useQuery(
    apiAny.habits.getHabitsWeek,
    project ? { projectId: project._id, days: 7 } : "skip"
  ) as HabitsWeekPayload | undefined;

  const timeline = useQuery(
    apiAny.habits.getHabitsEffectivenessTimeline,
    project ? { projectId: project._id } : "skip"
  ) as HabitsTimelinePayload | undefined;
  const toggleHabitCompletion = useMutation(apiAny.habits.toggleHabitCompletion);

  const habits = week?.habits ?? EMPTY_HABITS;
  const dates = week?.dates ?? EMPTY_DATES;
  const today = week?.today;
  const completions = week?.completionsByHabitId ?? EMPTY_COMPLETIONS;
  const timelineLoaded = Boolean(timeline);
  const timelineDays = timeline?.days ?? EMPTY_TIMELINE_DAYS;
  const overallSuccess = timeline?.overall?.percent ?? 0;
  const overallScheduled = timeline?.overall?.scheduled ?? 0;
  const overallCompleted = timeline?.overall?.completed ?? 0;
  const timelineRangeLabel = timeline?.startDate
    ? `${formatShortDate(timeline.startDate)} – ${formatShortDate(timeline.today)}`
    : "Loading...";

  const timelineColumns = useMemo(() => {
    const columns: Array<{
      label?: string;
      days: Array<HabitsTimelineDay | null>;
    }> = [];
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

    for (let i = 0; i < timelineDays.length; i += 7) {
      const column: Array<HabitsTimelineDay | null> = timelineDays.slice(i, i + 7);
      while (column.length < 7) {
        column.push(null);
      }
      const firstDay = column.find(Boolean) as HabitsTimelineDay | null;
      const currentMonth = firstDay
        ? new Date(`${firstDay.date}T00:00:00Z`).getUTCMonth()
        : null;
      const prevFirstDay = columns.length
        ? columns[columns.length - 1]?.days.find(Boolean) ?? null
        : null;
      const prevMonth = prevFirstDay
        ? new Date(`${prevFirstDay.date}T00:00:00Z`).getUTCMonth()
        : null;
      const label =
        firstDay && (columns.length === 0 || currentMonth !== prevMonth)
          ? monthFormatter.format(new Date(`${firstDay.date}T00:00:00Z`))
          : undefined;

      columns.push({ label, days: column });
    }
    return columns;
  }, [timelineDays]);

  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", ""];

  const activeHabits = useMemo(() => habits.filter((habit) => habit.isActive), [habits]);

  const scheduledToday = useMemo(() => {
    if (!today) return [] as HabitItem[];
    return activeHabits.filter((habit) => isScheduledForDate(habit, today));
  }, [activeHabits, today]);

  const completedToday = useMemo(() => {
    if (!today) return [] as HabitItem[];
    return scheduledToday.filter((habit) => (completions[habit._id] ?? []).includes(today));
  }, [scheduledToday, completions, today]);

  const todayCompletionRate = scheduledToday.length
    ? Math.round((completedToday.length / scheduledToday.length) * 100)
    : 0;

  const weeklyStats = useMemo(() => {
    let scheduled = 0;
    let completed = 0;

    for (const dateStr of dates) {
      for (const habit of activeHabits) {
        if (!isScheduledForDate(habit, dateStr)) continue;
        scheduled += 1;
        if ((completions[habit._id] ?? []).includes(dateStr)) completed += 1;
      }
    }

    const percent = scheduled ? Math.round((completed / scheduled) * 100) : 0;
    return { scheduled, completed, percent };
  }, [dates, activeHabits, completions]);

  if (habits.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Habits dashboard
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {project.name}
            </h1>
            <p className="text-sm text-muted-foreground">No habits in this project yet</p>
          </div>
        </div>

        <Card>
          <CardHeader>
          <CardTitle>Add your first habit</CardTitle>
          <CardDescription>
            Create habits to unlock progress and weekly stats.
          </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/organisation/projects/${project.slug}/habits`}>
                Go to habits
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      label: "Completed today",
      value: `${completedToday.length}/${scheduledToday.length}`,
      helper: scheduledToday.length
        ? `${todayCompletionRate}% completion rate`
        : "No habits scheduled today",
      icon: CheckCircle2,
    },
    {
      label: "Weekly success rate",
      value: `${weeklyStats.percent}%`,
      helper: `${weeklyStats.completed}/${weeklyStats.scheduled} completions`,
      icon: TrendingUp,
    },
    {
      label: "Active habits",
      value: `${activeHabits.length}`,
      helper: "Active only",
      icon: Target,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Habits dashboard
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily summary • {formatDateLabel(today)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Today</Badge>
          <Badge variant="outline">Week: 7 days</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-card/90">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{stat.label}</span>
                <stat.icon className="h-4 w-4 text-primary/70" />
              </div>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
              <CardDescription>{stat.helper}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="bg-card/90">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Habit effectiveness</CardTitle>
            <CardDescription>
              Since assistant start • {timelineRangeLabel}
            </CardDescription>
          </div>
          {timelineLoaded && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">Active habits</Badge>
              <Badge variant="secondary">{overallSuccess}% overall</Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!timelineLoaded ? (
            <div className="space-y-3">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <div className="h-24 rounded-lg bg-muted animate-pulse" />
            </div>
          ) : timelineDays.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No historical habit data yet.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall success</span>
                  <span className="font-semibold text-foreground">{overallSuccess}%</span>
                </div>
                <Progress value={overallCompleted} max={overallScheduled || 1} />
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2 overflow-x-auto">
                  <div className="min-w-[32px]" />
                  <div className="grid grid-flow-col auto-cols-max gap-2">
                    {timelineColumns.map((column, columnIndex) => (
                      <div key={`${columnIndex}-${column.days[0]?.date ?? "month"}`} className="relative h-4 w-4">
                        {column.label ? (
                          <span className="absolute left-0 text-xs text-muted-foreground">
                            {column.label}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-2 overflow-x-auto pb-1">
                  <div className="flex min-w-[32px] flex-col gap-1 text-[10px] text-muted-foreground">
                    {dayLabels.map((label, idx) => (
                      <span key={`${label}-${idx}`} className="h-4 leading-4">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-flow-col auto-cols-max gap-2">
                    {timelineColumns.map((column, columnIndex) => (
                      <div key={`${columnIndex}-${column.days[0]?.date ?? "week"}`} className="grid grid-rows-7 gap-1">
                        {column.days.map((day, dayIndex) =>
                          day ? (
                            <div
                              key={day.date}
                              className={`h-4 w-4 rounded-[4px] ${getDayIntensityClass(day)}`}
                              title={`${formatDateLabel(day.date)} • ${day.completed}/${day.scheduled || 0} (${day.percent}%)`}
                            />
                          ) : (
                            <div
                              key={`empty-${columnIndex}-${dayIndex}`}
                              className="h-4 w-4 rounded-[4px] border border-border/40 bg-muted/20"
                            />
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Less</span>
                  <div className="flex items-center gap-1">
                    {[
                      "bg-muted/40 border-border/60",
                      "bg-primary/15 border-primary/20",
                      "bg-primary/25 border-primary/25",
                      "bg-primary/40 border-primary/30",
                      "bg-primary/60 border-primary/40",
                      "bg-primary/80 border-primary/50",
                      "bg-primary border-primary/60",
                    ].map((classes, index) => (
                      <span
                        key={`${classes}-${index}`}
                        className={`h-2.5 w-2.5 rounded-[3px] border ${classes}`}
                      />
                    ))}
                  </div>
                  <span>More</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="bg-card/90">
          <CardHeader>
          <CardTitle>Habits for today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduledToday.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No habits scheduled for today.
              </div>
            ) : (
              scheduledToday.slice(0, 6).map((habit) => {
                const done = (completions[habit._id] ?? []).includes(today ?? "");
                return (
                  <div
                    key={habit._id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{habit.name}</p>
                      {habit.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {habit.description}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={done ? "secondary" : "outline"}
                      onClick={() => {
                        if (!today) return;
                        toggleHabitCompletion({ habitId: habit._id, date: today });
                      }}
                      aria-pressed={done}
                      className={
                        done
                          ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80"
                          : undefined
                      }
                    >
                      {done ? "Done" : "Mark done"}
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ProjectDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-6 w-40 rounded-full bg-muted animate-pulse" />
        <div className="h-10 w-64 rounded bg-muted animate-pulse" />
        <div className="h-4 w-56 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted animate-pulse" />
      <div className="h-[360px] rounded-xl bg-muted animate-pulse" />
    </div>
  );
}
