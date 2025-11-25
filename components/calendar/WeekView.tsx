"use client";

import { useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addHours,
  isSameDay,
  isWithinInterval,
  differenceInMinutes,
  startOfDay,
  isBefore,
  isAfter,
} from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const HOUR_HEIGHT = 60; // pixels per hour
const MOBILE_HOUR_HEIGHT = 50; // pixels per hour on medium screens
const MIN_DAY_WIDTH = 100; // minimum width for day column on narrow layouts

export function WeekView({ events = [], onEventClick, onDateClick }: WeekViewProps) {
  const { state } = useCalendar();
  const { currentDate } = state;

  const isCompact = useIsMobile(640);
  const isNarrow = useIsMobile(1024);

  // Get week days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const hourHeight = isNarrow ? MOBILE_HOUR_HEIGHT : HOUR_HEIGHT;
  const allDayLimit = isCompact ? 1 : isNarrow ? 2 : 3;

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    events.forEach((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);

      // Check if event falls within this week
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      const isInWeek =
        isWithinInterval(eventStart, { start: weekStart, end: weekEnd }) ||
        isWithinInterval(eventEnd, { start: weekStart, end: weekEnd }) ||
        (isBefore(eventStart, weekStart) && isAfter(eventEnd, weekEnd));

      if (!isInWeek) return;

      // Check if event is multi-day (spans more than one day)
      const eventStartDay = startOfDay(eventStart);
      const eventEndDay = startOfDay(eventEnd);
      const isMultiDay = !isSameDay(eventStartDay, eventEndDay);

      // Show in top section if:
      // 1. Explicitly marked as all-day, OR
      // 2. Event spans multiple days (Google Calendar style)
      if (event.isAllDay || isMultiDay) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, currentDate]);

  // Pre-compute timed events per day for compact layouts
  const timedEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    timedEvents.forEach((event) => {
      const key = format(startOfDay(new Date(event.startTime)), "yyyy-MM-dd");
      const entries = map.get(key) ?? [];
      entries.push(event);
      map.set(key, entries);
    });

    map.forEach((list) => {
      list.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return map;
  }, [timedEvents]);

  // Get all-day events for a specific day
  const getAllDayEventsForDay = (day: Date) => {
    return allDayEvents.filter((event) => {
      const eventStart = startOfDay(new Date(event.startTime));
      const eventEnd = startOfDay(new Date(event.endTime));
      const targetDay = startOfDay(day);

      return (
        isSameDay(eventStart, targetDay) ||
        isSameDay(eventEnd, targetDay) ||
        (isBefore(eventStart, targetDay) && isAfter(eventEnd, targetDay))
      );
    });
  };

  const getTimedEventsForDay = (day: Date) => {
    const key = format(startOfDay(day), "yyyy-MM-dd");
    return timedEventsByDay.get(key) ?? [];
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent, day: Date) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const dayStart = startOfDay(day);

    // Calculate minutes from start of day
    const minutesFromStart = differenceInMinutes(eventStart, dayStart);
    const duration = differenceInMinutes(eventEnd, eventStart);

    // Convert to pixels - use responsive height
    const top = (minutesFromStart / 60) * hourHeight;
    const minHeight = isNarrow ? 18 : 20;
    const height = Math.max((duration / 60) * hourHeight, minHeight);

    return { top, height };
  };

  const weekDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const mobileWeekDayNames = ["M", "T", "W", "T", "F", "S", "S"];

  if (isCompact) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <div className="border-b bg-card px-3 py-2">
          <div className="text-sm font-semibold text-foreground">
            {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d")}
          </div>
          <div className="text-xs text-muted-foreground">Week overview</div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="space-y-3 p-3">
            {weekDays.map((day) => {
              const allDayForDay = getAllDayEventsForDay(day);
              const scheduledEvents = getTimedEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className="rounded-xl border bg-card p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {format(day, "EEE")}
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {format(day, "MMM d")}
                      </div>
                    </div>
                    {isToday && (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        Today
                      </span>
                    )}
                  </div>

                  {allDayForDay.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        All-day
                      </p>
                      {allDayForDay.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onEventClick?.(event)}
                          className="flex w-full items-center justify-between rounded-lg border border-transparent bg-muted/60 px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-muted-foreground/20 hover:bg-muted"
                        >
                          <span className="truncate">{event.title}</span>
                          {event.priority && (
                            <span className="ml-2 text-xs capitalize text-muted-foreground">
                              {event.priority}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Schedule
                    </p>
                    {scheduledEvents.length > 0 ? (
                      scheduledEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => onEventClick?.(event)}
                          className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-sm shadow-sm transition hover:border-primary/40 hover:bg-card/90"
                          style={{ borderLeft: `4px solid ${event.color}` }}
                        >
                          <span className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {format(new Date(event.startTime), "HH:mm")}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium text-foreground">
                              {event.title}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(event.startTime), "HH:mm")} –{" "}
                              {format(new Date(event.endTime), "HH:mm")}
                            </span>
                          </div>
                          <span
                            className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                        </button>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-muted-foreground/40 px-3 py-4 text-center text-xs text-muted-foreground">
                        No scheduled events
                      </div>
                    )}
                  </div>

                  {onDateClick && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full border-dashed text-xs"
                      onClick={() => onDateClick?.(startOfDay(day))}
                    >
                      Add event
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex border-b bg-card sticky top-0 z-20">
        {/* Time column header */}
        <div className="w-10 sm:w-16 flex-shrink-0 border-r" />

        {/* Day headers - scrollable on narrow layouts */}
        <div className="flex-1 overflow-x-auto sm:overflow-x-visible">
          <div
            className="flex sm:contents"
            style={{ minWidth: isNarrow ? `${MIN_DAY_WIDTH * 7}px` : "auto" }}
          >
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, new Date());
              const isWeekend = index >= 5;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "p-1.5 sm:p-3 text-center border-r last:border-r-0",
                    isWeekend && "bg-blue-50/50",
                    isToday && "bg-primary/10"
                  )}
                  style={{
                    minWidth: isNarrow ? `${MIN_DAY_WIDTH}px` : "auto",
                    flex: isNarrow ? "none" : "1",
                  }}
                >
                  <div className="font-semibold text-[10px] sm:text-sm text-muted-foreground">
                    <span className="sm:hidden">{mobileWeekDayNames[index]}</span>
                    <span className="hidden sm:inline">{weekDayNames[index]}</span>
                  </div>
                  <div
                    className={cn(
                      "text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1",
                      isToday &&
                        "inline-flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>

                  {/* All-day events for this day */}
                  <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                    {getAllDayEventsForDay(day)
                      .slice(0, allDayLimit)
                      .map((event) => (
                        <div
                          key={event.id}
                          onClick={() => onEventClick?.(event)}
                          className={cn(
                            "text-[9px] sm:text-xs p-0.5 sm:p-1 rounded cursor-pointer truncate",
                            "hover:opacity-80 transition-opacity"
                          )}
                          style={{ backgroundColor: event.color, color: "white" }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                    {getAllDayEventsForDay(day).length > allDayLimit && (
                      <div className="text-[8px] sm:text-[10px] text-muted-foreground">
                        +{getAllDayEventsForDay(day).length - allDayLimit} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-auto relative bg-white">
        <div className="flex">
          {/* Time column */}
          <div className="w-10 sm:w-16 flex-shrink-0 border-r bg-muted/30 sticky left-0 z-10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-[9px] sm:text-xs text-right pr-1 sm:pr-2 text-muted-foreground"
                style={{ height: `${hourHeight}px` }}
              >
                {format(addHours(startOfDay(new Date()), hour), "HH:mm")}
              </div>
            ))}
          </div>

          {/* Day columns with events - scrollable on narrow layouts */}
          <div className="flex-1 overflow-x-auto sm:overflow-x-visible">
            <div
              className="flex sm:contents"
              style={{ minWidth: isNarrow ? `${MIN_DAY_WIDTH * 7}px` : "auto" }}
            >
              {weekDays.map((day, dayIndex) => {
                const isWeekend = dayIndex >= 5;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn("border-r last:border-r-0 relative")}
                    style={{
                      backgroundColor: isWeekend ? "#eff6ff" : "#ffffff",
                      minWidth: isNarrow ? `${MIN_DAY_WIDTH}px` : "auto",
                      flex: isNarrow ? "none" : "1",
                    }}
                  >
                    {/* Hour grid */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="border-b border-gray-200 cursor-pointer hover:bg-accent/50 transition-colors"
                        style={{ height: `${hourHeight}px`, backgroundColor: "transparent" }}
                        onClick={() => onDateClick?.(addHours(startOfDay(day), hour))}
                      />
                    ))}

                    {/* Timed events overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      {timedEvents
                        .filter((event) => {
                          const eventStart = startOfDay(new Date(event.startTime));
                          return isSameDay(eventStart, day);
                        })
                        .map((event) => {
                          const { top, height } = getEventStyle(event, day);

                          return (
                            <div
                              key={event.id}
                              className="absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded p-0.5 sm:p-1 text-[9px] sm:text-xs overflow-hidden cursor-pointer pointer-events-auto hover:opacity-90 transition-opacity shadow-sm"
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                backgroundColor: event.color,
                                color: "white",
                                zIndex: 10,
                              }}
                              onClick={() => onEventClick?.(event)}
                              title={`${event.title}\n${format(
                                new Date(event.startTime),
                                "HH:mm"
                              )} - ${format(new Date(event.endTime), "HH:mm")}`}
                            >
                              <div className="font-semibold truncate">{event.title}</div>
                              {height > 30 && (
                                <div className="text-[8px] sm:text-[10px] opacity-90 truncate">
                                  {format(new Date(event.startTime), "HH:mm")}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>

                    {/* Current time indicator */}
                    {isSameDay(day, new Date()) && (
                      <div
                        className="absolute left-0 right-0 border-t-2 border-red-500 pointer-events-none z-20"
                        style={{
                          top: `${(new Date().getHours() + new Date().getMinutes() / 60) * hourHeight}px`,
                        }}
                      >
                        <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
