"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

type HabitItem = {
  _id: Id<"habits">;
  name: string;
  description?: string;
  scheduleDays?: Weekday[]; // ["mon", "tue", ...] - empty/undefined means everyday
  targetValue?: number;
  unit?: string;
  frequency?: "daily" | "weekly";
  reminderTime?: string;
  reminderPlan?: Array<{
    date: string;
    reminderTime: string;
    minStartTime?: string;
    phaseLabel?: string;
  }>;
  effectiveTodayReminderTime?: string;
  todayPhaseLabel?: string;
  isActive: boolean;
  completedToday?: boolean;
  completionValue?: number;
};

type HabitsWeekPayload = {
  dates: string[];
  today?: string;
  habits: HabitItem[];
  completionsByHabitId: Record<string, string[]>;
  valuesByHabitId?: Record<string, Record<string, number>>;
};

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DEFAULT_SOME_DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;

const dateToDowKey = (dateStr: string): Weekday => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return DOW_KEYS[d.getUTCDay()];
};

const formatDow = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const formatMd = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
};

const isHabitScheduledForDate = (habit: HabitItem, dateStr: string) => {
  if (!habit.isActive) return false;
  const reminderPlan = habit.reminderPlan ?? [];
  const hasPlanForDate = reminderPlan.some((entry) => entry.date === dateStr);
  if (hasPlanForDate) return true;
  if (reminderPlan.length > 0 && !habit.reminderTime) return false;
  const schedule = habit.scheduleDays;
  if (!schedule || schedule.length === 0) return true;
  return schedule.includes(dateToDowKey(dateStr));
};

export function HabitsViewSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export default function HabitsView() {
  const { project } = useProject();

  const habits = useQuery(
    apiAny.habits.listProjectHabits,
    project ? { projectId: project._id } : "skip"
  ) as HabitItem[] | undefined;

  const week = useQuery(
    apiAny.habits.getHabitsWeek,
    project ? { projectId: project._id, days: 7 } : "skip"
  ) as HabitsWeekPayload | undefined;

  const createHabit = useMutation(apiAny.habits.createHabit);
  const updateHabit = useMutation(apiAny.habits.updateHabit);
  const toggleHabitCompletion = useMutation(apiAny.habits.toggleHabitCompletion);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"today" | "week">("today");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scheduleMode: "everyday" as "everyday" | "some_days",
    scheduleDays: [...ALL_DAYS],
    targetValue: "",
    unit: "",
    reminderTime: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    scheduleMode: "everyday" as "everyday" | "some_days",
    scheduleDays: [...ALL_DAYS],
    targetValue: "",
    unit: "",
    reminderTime: "",
  });

  const [valueInputHabitId, setValueInputHabitId] = useState<Id<"habits"> | null>(null);
  const [valueInputAmount, setValueInputAmount] = useState("");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // (derived counts computed per selected date below)

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weekStats = useMemo(() => {
    if (!week?.dates?.length || !week?.habits?.length) {
      return { totalCells: 0, doneCells: 0, percent: 0 };
    }
    let totalCells = 0;
    let doneCells = 0;
    const completionsByHabitId = week.completionsByHabitId ?? {};
    for (const h of week.habits) {
      const doneDates = new Set(completionsByHabitId[h._id] ?? []);
      for (const date of week.dates) {
        if (!isHabitScheduledForDate(h, date)) continue;
        totalCells += 1;
        if (doneDates.has(date)) doneCells += 1;
      }
    }
    const percent = totalCells > 0 ? Math.round((doneCells / totalCells) * 100) : 0;
    return { totalCells, doneCells, percent };
  }, [week]);

  const effectiveSelectedDate = selectedDate ?? week?.today ?? null;

  const isEverydaySchedule = (days?: string[]) =>
    !days || days.length === 0 || days.length === ALL_DAYS.length;

  const habitsForSelectedDate = useMemo(() => {
    if (!effectiveSelectedDate) return [] as HabitItem[];
    return (week?.habits ?? habits ?? []).filter((h) => isHabitScheduledForDate(h, effectiveSelectedDate));
  }, [effectiveSelectedDate, week?.habits, habits]);

  const completedCountForSelectedDate = useMemo(() => {
    if (!effectiveSelectedDate) return 0;
    const completions = week?.completionsByHabitId ?? {};
    let n = 0;
    for (const h of habitsForSelectedDate) {
      if ((completions[h._id] ?? []).includes(effectiveSelectedDate)) n++;
    }
    return n;
  }, [effectiveSelectedDate, habitsForSelectedDate, week?.completionsByHabitId]);

  const activeHabitsCount = useMemo(() => {
    const list = week?.habits ?? habits ?? [];
    return list.filter((h) => h.isActive).length;
  }, [habits, week?.habits]);

  const scheduledCountForSelectedDate = habitsForSelectedDate.length;
  const todayCompletionRate = scheduledCountForSelectedDate
    ? Math.round((completedCountForSelectedDate / scheduledCountForSelectedDate) * 100)
    : 0;

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !formData.name) return;

    const scheduleDays =
      formData.scheduleMode === "everyday"
        ? undefined
        : formData.scheduleDays?.length
          ? formData.scheduleDays
          : [...DEFAULT_SOME_DAYS];

    await createHabit({
      projectId: project._id,
      name: formData.name,
      description: formData.description || undefined,
      scheduleDays,
      targetValue: formData.targetValue ? Number(formData.targetValue) : undefined,
      unit: formData.unit || undefined,
      reminderTime: formData.reminderTime || undefined,
      source: "user",
    });

    setFormData({
      name: "",
      description: "",
      scheduleMode: "everyday",
      scheduleDays: [...ALL_DAYS],
      targetValue: "",
      unit: "",
      reminderTime: "",
    });
    setOpen(false);
  };

  const openEditHabit = (habit: HabitItem) => {
    const scheduleDays = habit.scheduleDays?.length ? habit.scheduleDays : [...ALL_DAYS];
    const scheduleMode = isEverydaySchedule(habit.scheduleDays) ? "everyday" : "some_days";
    setEditingHabit(habit);
    setEditFormData({
      name: habit.name || "",
      description: habit.description || "",
      scheduleMode,
      scheduleDays,
      targetValue: habit.targetValue ? String(habit.targetValue) : "",
      unit: habit.unit || "",
      reminderTime: habit.reminderTime || "",
    });
    setEditOpen(true);
  };

  const handleUpdateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHabit) return;

    const scheduleDays =
      editFormData.scheduleMode === "everyday"
        ? undefined
        : editFormData.scheduleDays?.length
          ? editFormData.scheduleDays
          : [...DEFAULT_SOME_DAYS];

    await updateHabit({
      habitId: editingHabit._id,
      name: editFormData.name,
      description: editFormData.description || undefined,
      scheduleDays,
      targetValue: editFormData.targetValue ? Number(editFormData.targetValue) : undefined,
      unit: editFormData.unit || undefined,
      reminderTime: editFormData.reminderTime,
    });

    setEditOpen(false);
    setEditingHabit(null);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="rounded-3xl border bg-card/80 shadow-sm">
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <h1 className="text-2xl md:text-3xl font-semibold">Habits</h1>
              <p className="text-sm text-muted-foreground">
                Track daily routines, build streaks, and review weekly momentum.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border bg-background p-1">
                <Button
                  type="button"
                  variant={view === "today" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("today")}
                  className="rounded-full"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant={view === "week" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("week")}
                  className="rounded-full"
                >
                  Week
                </Button>
              </div>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Habit
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[460px]">
                  <DialogHeader>
                    <DialogTitle>New habit</DialogTitle>
                    <DialogDescription>Add a routine you want to track.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateHabit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="habitName">Name</Label>
                      <Input
                        id="habitName"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Morning workout"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="habitDescription">Description</Label>
                      <Textarea
                        id="habitDescription"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional details..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Schedule</Label>
                      <Select
                        value={formData.scheduleMode}
                        onValueChange={(value) => {
                          const nextMode = value as "everyday" | "some_days";
                          if (nextMode === "everyday") {
                            setFormData({ ...formData, scheduleMode: nextMode, scheduleDays: [...ALL_DAYS] });
                            return;
                          }
                          const hasCustom =
                            formData.scheduleDays.length > 0 && formData.scheduleDays.length < ALL_DAYS.length;
                          setFormData({
                            ...formData,
                            scheduleMode: nextMode,
                            scheduleDays: hasCustom ? formData.scheduleDays : [...DEFAULT_SOME_DAYS],
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyday">Every day</SelectItem>
                          <SelectItem value="some_days">Some days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Days</Label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ["mon", "Mon"],
                          ["tue", "Tue"],
                          ["wed", "Wed"],
                          ["thu", "Thu"],
                          ["fri", "Fri"],
                          ["sat", "Sat"],
                          ["sun", "Sun"],
                        ] as const).map(([key, label]) => {
                          const active = formData.scheduleDays.includes(key);
                          const disabled = formData.scheduleMode === "everyday";
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                if (disabled) return;
                                const next = active
                                  ? formData.scheduleDays.filter((d) => d !== key)
                                  : [...formData.scheduleDays, key];
                                if (next.length === 0) return;
                                setFormData({ ...formData, scheduleDays: next });
                              }}
                              className={cn(
                                "rounded-full border px-3 py-1 text-xs font-medium transition",
                                active
                                  ? "bg-foreground text-background border-foreground"
                                  : "bg-background hover:bg-muted/30",
                                disabled && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        For "Some days", pick at least one day. Weekdays are selected by default.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="habitTarget">Target</Label>
                        <Input
                          id="habitTarget"
                          type="number"
                          min="0"
                          value={formData.targetValue}
                          onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                          placeholder="e.g., 45"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="habitUnit">Unit</Label>
                        <Input
                          id="habitUnit"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          placeholder="min, kcal, reps"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="habitTime">Reminder time (optional)</Label>
                      <Input
                        id="habitTime"
                        type="time"
                        value={formData.reminderTime}
                        onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Create Habit</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {view === "today" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
                <h2 className="text-xl font-semibold text-foreground">Habits for today</h2>
              </div>
              {habitsForSelectedDate.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {habitsForSelectedDate.map((habit, index) => {
                    const doneDates = new Set(week?.completionsByHabitId?.[habit._id] ?? []);
                    const isDone = effectiveSelectedDate ? doneDates.has(effectiveSelectedDate) : habit.completedToday;
                    const isNumeric = Boolean(habit.targetValue && habit.unit);
                    const loggedValue = effectiveSelectedDate
                      ? (week?.valuesByHabitId?.[habit._id]?.[effectiveSelectedDate] ?? (isDone && isNumeric ? habit.completionValue : undefined))
                      : habit.completionValue;
                    const accentStyles = [
                      "bg-primary/10 text-primary",
                      "bg-emerald-500/10 text-emerald-600",
                      "bg-amber-500/10 text-amber-600",
                      "bg-sky-500/10 text-sky-600",
                    ];
                    const accent = accentStyles[index % accentStyles.length];
                    const progressLabel = isNumeric
                      ? `${loggedValue ?? 0} / ${habit.targetValue} ${habit.unit}`
                      : `${isDone ? 1 : 0} of 1`;
                    const progressPercent = isNumeric
                      ? Math.min(100, Math.round(((loggedValue ?? 0) / (habit.targetValue || 1)) * 100))
                      : isDone ? 100 : 0;
                    const isValueInputOpen = valueInputHabitId === habit._id;
                    const planEntry = effectiveSelectedDate
                      ? (habit.reminderPlan ?? []).find((entry) => entry.date === effectiveSelectedDate)
                      : undefined;
                    const reminderLabel = planEntry?.reminderTime || habit.effectiveTodayReminderTime || habit.reminderTime;
                    const phaseLabel = planEntry?.phaseLabel || habit.todayPhaseLabel;
                    return (
                      <Card
                        key={habit._id}
                        className={cn(
                          "rounded-2xl border bg-background/80 shadow-sm",
                          isDone ? "border-primary/40 bg-primary/5" : "border-border"
                        )}
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {isNumeric ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleHabitCompletion({
                                      habitId: habit._id,
                                      date: effectiveSelectedDate || undefined,
                                      completed: !isDone,
                                      value: isDone ? undefined : habit.targetValue,
                                    })
                                  }
                                  className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition", accent)}
                                  aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                                >
                                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                </button>
                              ) : (
                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>
                                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-base font-semibold text-foreground">{habit.name}</p>
                                  <button
                                    type="button"
                                    onClick={() => openEditHabit(habit)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label="Edit habit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                </div>
                                <p className="text-xs text-muted-foreground">{progressLabel}</p>
                                <p className="text-xs text-muted-foreground">
                                  {reminderLabel ? `Reminder: ${reminderLabel}` : "No reminder set"}
                                </p>
                                {phaseLabel ? (
                                  <p className="text-[11px] text-muted-foreground/80">Phase: {phaseLabel}</p>
                                ) : null}
                              </div>
                            </div>
                            {isNumeric ? (
                              <div className="flex flex-col items-end gap-1">
                                {isValueInputOpen ? (
                                  <form
                                    className="flex items-center gap-1"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const val = Number(valueInputAmount);
                                      if (!isNaN(val) && val > 0) {
                                        toggleHabitCompletion({
                                          habitId: habit._id,
                                          date: effectiveSelectedDate || undefined,
                                          completed: true,
                                          value: val,
                                        });
                                      }
                                      setValueInputHabitId(null);
                                      setValueInputAmount("");
                                    }}
                                  >
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="h-9 w-20 text-sm"
                                      placeholder={habit.unit}
                                      value={valueInputAmount}
                                      onChange={(e) => setValueInputAmount(e.target.value)}
                                      autoFocus
                                      onBlur={() => {
                                        setTimeout(() => {
                                          setValueInputHabitId(null);
                                          setValueInputAmount("");
                                        }, 150);
                                      }}
                                    />
                                    <Button type="submit" size="sm" className="h-9 px-2">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setValueInputHabitId(habit._id);
                                      setValueInputAmount(loggedValue ? String(loggedValue) : "");
                                    }}
                                    className={cn(
                                      "flex h-12 items-center gap-1 px-3 rounded-full border transition text-sm font-medium",
                                      isDone
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                    )}
                                  >
                                    {loggedValue ?? 0} {habit.unit}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleHabitCompletion({
                                    habitId: habit._id,
                                    date: effectiveSelectedDate || undefined,
                                  })
                                }
                                className={cn(
                                  "flex h-12 w-12 items-center justify-center rounded-full border transition",
                                  isDone
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                )}
                                aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                              >
                                {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                              </button>
                            )}
                          </div>
                          {habit.description && (
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedDescriptions((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(habit._id)) next.delete(habit._id);
                                    else next.add(habit._id);
                                    return next;
                                  });
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                              >
                                {expandedDescriptions.has(habit._id) ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                {expandedDescriptions.has(habit._id) ? "Hide details" : "Show details"}
                              </button>
                              {expandedDescriptions.has(habit._id) && (
                                <p className="mt-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                                  {habit.description}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full transition-all", progressPercent >= 100 ? "bg-primary" : "bg-primary/60")}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{progressPercent}% complete</span>
                              <Badge variant={isDone ? "secondary" : "outline"}>{isDone ? "Done" : "To do"}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="rounded-2xl border bg-background/80">
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    No habits scheduled for today.
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs text-muted-foreground">Today</div>
              <div className="mt-1 text-2xl font-semibold">
                {completedCountForSelectedDate}/{scheduledCountForSelectedDate || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Completed ({todayCompletionRate}%)
              </div>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs text-muted-foreground">Active habits</div>
              <div className="mt-1 text-2xl font-semibold">{activeHabitsCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Across your schedule</div>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs text-muted-foreground">Weekly progress</div>
              <div className="mt-1 text-2xl font-semibold">{weekStats.percent}%</div>
              <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${weekStats.percent}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Selector Row */}
      {view === "week" && week?.dates?.length && effectiveSelectedDate && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 rounded-2xl border bg-muted/40 p-2">
          {week.dates.map((d) => {
            const active = d === effectiveSelectedDate;
            const isToday = d === week.today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "shrink-0 rounded-xl border px-3 py-2 text-left transition min-w-[72px] bg-background",
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background hover:bg-muted/30",
                  isToday && !active && "border-primary/50"
                )}
              >
                <div className={cn("text-[10px]", active ? "opacity-80" : "text-muted-foreground")}>
                  {isToday ? "Today" : formatDow(d)}
                </div>
                <div className="text-sm font-medium leading-none">{formatMd(d)}</div>
              </button>
            );
          })}
        </div>
      )}

      {view === "week" ? (
        <Card className="rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-base font-semibold">Weekly Progress</CardTitle>
              <div className="text-xs text-muted-foreground mt-0.5">
                {weekStats.doneCells}/{weekStats.totalCells} completions ({weekStats.percent}%)
              </div>
            </div>
            {weekStats.totalCells > 0 && (
              <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${weekStats.percent}%` }} />
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {week === undefined && <div className="p-4 text-sm text-muted-foreground">Loading week…</div>}
            {week?.habits?.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No habits yet. Add your first one.</div>
            )}

            {week?.habits?.length ? (
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid" style={{ gridTemplateColumns: `260px repeat(${week.dates.length}, minmax(64px, 1fr))` }}>
                    <div className="px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/40 self-end">Habit</div>
                    {week.dates.map((d) => {
                      const isToday = d === week.today;
                      return (
                        <div key={d} className={cn("px-2 py-3 text-center border-l", isToday ? "bg-muted/30" : "")}>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{formatDow(d)}</div>
                          <div className={cn("text-xs font-medium mt-0.5", isToday ? "text-primary" : "")}>{formatMd(d)}</div>
                        </div>
                      )
                    })}

                    {week.habits.map((habit) => {
                      const doneDates = new Set(week.completionsByHabitId[habit._id] ?? []);
                      const weekDoneCount = doneDates.size;
                      const weeklyTarget = habit.frequency === "weekly" && habit.targetValue ? habit.targetValue : undefined;

                      return (
                        <div key={habit._id} className="contents group">
                          <div className="px-4 py-3 border-t bg-background group-hover:bg-muted/5 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate text-sm">{habit.name}</span>
                              <button
                                type="button"
                                onClick={() => openEditHabit(habit)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Edit habit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {weeklyTarget !== undefined && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                                  {weekDoneCount}/{weeklyTarget}
                                </Badge>
                              )}
                            </div>
                            {habit.description && (
                              <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                {habit.description}
                              </div>
                            )}
                            {habit.targetValue && habit.frequency !== "weekly" && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Target: {habit.targetValue} {habit.unit}
                              </div>
                            )}
                          </div>

                          {week.dates.map((date) => {
                            const isScheduled = isHabitScheduledForDate(habit, date);
                            const isDone = doneDates.has(date);
                            const isScheduledDone = isScheduled && isDone;
                            const isToday = date === week.today;
                            const isNumeric = Boolean(habit.targetValue && habit.unit);
                            const cellValue = week.valuesByHabitId?.[habit._id]?.[date];
                            return (
                              <button
                                key={`${habit._id}:${date}`}
                                type="button"
                                onClick={() => {
                                  if (!isScheduled) return;
                                  toggleHabitCompletion({ habitId: habit._id, date });
                                }}
                                disabled={!isScheduled}
                                className={cn(
                                  "border-t border-l flex items-center justify-center py-3 transition relative",
                                  !isScheduled && "bg-muted/20 cursor-not-allowed opacity-50",
                                  isScheduledDone ? "bg-green-500/10" : "bg-background group-hover:bg-muted/5",
                                  isToday && !isScheduledDone ? "bg-primary/5" : ""
                                )}
                                aria-label={
                                  !isScheduled ? "Not scheduled" : isDone ? "Mark incomplete" : "Mark complete"
                                }
                              >
                                {!isScheduled ? (
                                  <span className="text-xs text-muted-foreground/60">-</span>
                                ) : isScheduledDone ? (
                                  isNumeric && cellValue != null ? (
                                    <span className="text-xs font-medium text-green-700">{cellValue}</span>
                                  ) : (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  )
                                ) : (
                                  <Circle className={cn("h-5 w-5", isToday ? "text-primary/40" : "text-muted-foreground/30")} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit habit</DialogTitle>
            <DialogDescription>Update schedule, reminder time, or details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateHabit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-habit-name">Name</Label>
              <Input
                id="edit-habit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-habit-description">Description</Label>
              <Textarea
                id="edit-habit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Schedule</Label>
              <Select
                value={editFormData.scheduleMode}
                onValueChange={(value) => {
                  const nextMode = value as "everyday" | "some_days";
                  if (nextMode === "everyday") {
                    setEditFormData({ ...editFormData, scheduleMode: nextMode, scheduleDays: [...ALL_DAYS] });
                    return;
                  }
                  const hasCustom =
                    editFormData.scheduleDays.length > 0 && editFormData.scheduleDays.length < ALL_DAYS.length;
                  setEditFormData({
                    ...editFormData,
                    scheduleMode: nextMode,
                    scheduleDays: hasCustom ? editFormData.scheduleDays : [...DEFAULT_SOME_DAYS],
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyday">Every day</SelectItem>
                  <SelectItem value="some_days">Some days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  ["mon", "Mon"],
                  ["tue", "Tue"],
                  ["wed", "Wed"],
                  ["thu", "Thu"],
                  ["fri", "Fri"],
                  ["sat", "Sat"],
                  ["sun", "Sun"],
                ] as const).map(([key, label]) => {
                  const active = editFormData.scheduleDays.includes(key);
                  const disabled = editFormData.scheduleMode === "everyday";
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant={active ? "secondary" : "outline"}
                      size="sm"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        const next = active
                          ? editFormData.scheduleDays.filter((d) => d !== key)
                          : [...editFormData.scheduleDays, key];
                        if (next.length === 0) return;
                        setEditFormData({ ...editFormData, scheduleDays: next });
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                For "Some days", pick at least one day. Weekdays are selected by default.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-habit-target">Target</Label>
                <Input
                  id="edit-habit-target"
                  type="number"
                  value={editFormData.targetValue}
                  onChange={(e) => setEditFormData({ ...editFormData, targetValue: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-habit-unit">Unit</Label>
                <Input
                  id="edit-habit-unit"
                  value={editFormData.unit}
                  onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-habit-time">Reminder time (optional)</Label>
              <Input
                id="edit-habit-time"
                type="time"
                value={editFormData.reminderTime}
                onChange={(e) => setEditFormData({ ...editFormData, reminderTime: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
