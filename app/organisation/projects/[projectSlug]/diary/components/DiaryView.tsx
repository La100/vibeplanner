"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type DiaryEntry = {
  _id: string;
  date: string;
  content: string;
  source: "user" | "assistant";
  mood?: string;
  updatedAt: number;
};

const MOOD_OPTIONS = ["great", "good", "neutral", "bad", "terrible"] as const;

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

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysInMonth(ym: string): string[] {
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function getYearMonth(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

export function DiaryViewSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function DiaryView() {
  const { project } = useProject();

  const entries = useQuery(
    apiAny.diary.listDiaryEntries,
    project ? { projectId: project._id } : "skip"
  ) as DiaryEntry[] | undefined;

  const upsertEntry = useMutation(apiAny.diary.upsertDiaryEntry);

  const todayDate = getTodayDate();

  // Project start date (creation time) — used to limit how far back we can navigate
  const projectStartDate = useMemo(() => {
    if (!project) return todayDate;
    // Use startDate if set, otherwise fall back to _creationTime
    const ts = project.startDate || project._creationTime;
    if (typeof ts === "number") {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return todayDate;
  }, [project, todayDate]);

  const projectStartMonth = getYearMonth(projectStartDate);

  const [currentMonth, setCurrentMonth] = useState(getCurrentYearMonth);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editMood, setEditMood] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const entriesMap = useMemo(() => {
    const map = new Map<string, DiaryEntry>();
    entries?.forEach((e) => map.set(e.date, e));
    return map;
  }, [entries]);

  const days = useMemo(() => {
    const allDays = getDaysInMonth(currentMonth);
    // Only show days from project start date to today
    return allDays.filter((d) => d >= projectStartDate && d <= todayDate);
  }, [currentMonth, todayDate, projectStartDate]);

  const monthEntryCount = useMemo(() => {
    if (!entries) return 0;
    return entries.filter((e) => e.date.startsWith(currentMonth)).length;
  }, [entries, currentMonth]);

  const isCurrentMonth = currentMonth === getCurrentYearMonth();
  const isEarliestMonth = currentMonth <= projectStartMonth;

  const prevMonth = () => {
    if (isEarliestMonth) return;
    const [year, month] = currentMonth.split("-").map(Number);
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    const [year, month] = currentMonth.split("-").map(Number);
    const d = new Date(year, month, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const openEditor = (date: string) => {
    const existing = entriesMap.get(date);
    setEditingDate(date);
    setEditContent(existing?.content ?? "");
    setEditMood(existing?.mood);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!project || !editingDate || !editContent.trim()) return;
    await upsertEntry({
      projectId: project._id,
      date: editingDate,
      content: editContent.trim(),
      mood: editMood,
    });
    setDialogOpen(false);
    setEditingDate(null);
    setEditContent("");
    setEditMood(undefined);
  };

  return (
    <div className="p-4 space-y-6">
      <div className="rounded-3xl border bg-card/80 shadow-sm">
        <div className="p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <h1 className="text-2xl md:text-3xl font-semibold">Diary</h1>
              <p className="text-sm text-muted-foreground">
                Your daily journal. Reflect, record, and revisit.
              </p>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => openEditor(todayDate)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Today&apos;s Entry
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs text-muted-foreground">Total entries</div>
              <div className="mt-1 text-2xl font-semibold">
                {entries?.length ?? 0}
              </div>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="text-xs text-muted-foreground">This month</div>
              <div className="mt-1 text-2xl font-semibold">{monthEntryCount}</div>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={prevMonth} disabled={isEarliestMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {formatMonthLabel(currentMonth)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={nextMonth}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Days Grid */}
          {days.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {days.map((date) => {
                const entry = entriesMap.get(date);
                const isToday = date === todayDate;
                return (
                  <Card
                    key={date}
                    className={cn(
                      "rounded-2xl border cursor-pointer transition hover:shadow-md",
                      entry
                        ? "bg-background"
                        : "bg-muted/20 border-dashed",
                      isToday && "ring-2 ring-primary/30"
                    )}
                    onClick={() => openEditor(date)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatDateLabel(date)}
                        </span>
                        <div className="flex items-center gap-1">
                          {entry?.mood && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 h-5"
                            >
                              {moodEmoji(entry.mood)}
                            </Badge>
                          )}
                          {entry?.source === "assistant" && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 h-5"
                            >
                              AI
                            </Badge>
                          )}
                        </div>
                      </div>
                      {entry ? (
                        <p className="text-sm text-foreground line-clamp-3">
                          {entry.content}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No entry yet
                        </p>
                      )}
                      {!entry && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Pencil className="h-3 w-3" /> Add note
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              No days to display for this month.
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingDate && formatDateLabel(editingDate)}
            </DialogTitle>
            <DialogDescription>
              Write your thoughts for this day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="How was your day? What happened? How do you feel?"
              rows={6}
              className="resize-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mood:</span>
              <div className="flex gap-1.5">
                {MOOD_OPTIONS.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={editMood === m ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-base"
                    onClick={() =>
                      setEditMood(editMood === m ? undefined : m)
                    }
                    title={m}
                  >
                    {moodEmoji(m)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editContent.trim()}>
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
