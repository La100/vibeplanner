"use client";

import { useMemo } from "react";
import {
  format,
  addHours,
  isWithinInterval,
  differenceInMinutes,
  startOfDay,
  isBefore,
  isAfter,
  isSameDay,
} from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { useCalendar } from "./CalendarProvider";
import { CalendarEvent } from "./utils";

interface DayViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const HOUR_HEIGHT = 60; // pixels per hour - Google Calendar style
const MOBILE_HOUR_HEIGHT = 40; // pixels per hour on medium screens

export function DayView({ events = [], onEventClick, onDateClick }: DayViewProps) {
  const { state } = useCalendar();
  const { currentDate } = state;

  const currentDay = startOfDay(currentDate);

  const isCompact = useIsMobile(640);
  const isNarrow = useIsMobile(1024);

  const hourHeight = isNarrow ? MOBILE_HOUR_HEIGHT : HOUR_HEIGHT;

  // Separate all-day and timed events for this day
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    events.forEach((event) => {
      const eventStart = startOfDay(new Date(event.startTime));
      const eventEnd = startOfDay(new Date(event.endTime));

      // Check if event is on this day
      const isToday =
        isSameDay(eventStart, currentDay) ||
        isSameDay(eventEnd, currentDay) ||
        (isBefore(eventStart, currentDay) && isAfter(eventEnd, currentDay));

      if (!isToday) return;

      // Check if event is multi-day (spans more than one day)
      const isMultiDay = !isSameDay(eventStart, eventEnd);

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
  }, [events, currentDay]);

  const sortedTimedEvents = useMemo(() => {
    return [...timedEvents].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [timedEvents]);

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const dayStart = startOfDay(currentDay);

    // Calculate minutes from start of day
    const minutesFromStart = differenceInMinutes(eventStart, dayStart);
    const duration = differenceInMinutes(eventEnd, eventStart);

    // Convert to pixels - use responsive height
    const top = (minutesFromStart / 60) * hourHeight;
    const minHeight = isNarrow ? 20 : 30;
    const height = Math.max((duration / 60) * hourHeight, minHeight);

    return { top, height };
  };

  // Get overlapping events to calculate widths
  const overlappingGroups = useMemo(() => {
    const sorted = [...timedEvents].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const groups: CalendarEvent[][] = [];

    sorted.forEach((event) => {
      let placed = false;

      for (const group of groups) {
        const hasOverlap = group.some((groupEvent) => {
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          const groupStart = new Date(groupEvent.startTime);
          const groupEnd = new Date(groupEvent.endTime);

          return (
            isWithinInterval(eventStart, { start: groupStart, end: groupEnd }) ||
            isWithinInterval(groupStart, { start: eventStart, end: eventEnd })
          );
        });

        if (hasOverlap) {
          group.push(event);
          placed = true;
          break;
        }
      }

      if (!placed) {
        groups.push([event]);
      }
    });

    return groups;
  }, [timedEvents]);

  // Get positioning for overlapping events
  const getEventPositioning = (event: CalendarEvent) => {
    for (const group of overlappingGroups) {
      const index = group.findIndex((e) => e.id === event.id);
      if (index !== -1) {
        const totalInGroup = group.length;
        const width = totalInGroup > 1 ? `${90 / totalInGroup}%` : "94%";
        const left = totalInGroup > 1 ? `${(index * 90) / totalInGroup + 3}%` : "3%";
        return { width, left };
      }
    }
    return { width: "94%", left: "3%" };
  };

  const isToday = isSameDay(currentDay, new Date());
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  if (isCompact) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-background">
        <div className="border-b bg-card px-3 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {format(currentDay, "EEEE")}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {format(currentDay, "MMM d")}
              </p>
            </div>
            {isToday && (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Today
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-4">
          {allDayEvents.length > 0 && (
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                All-day
              </p>
              <div className="mt-2 space-y-2">
                {allDayEvents.map((event) => (
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
            </div>
          )}

          <div className="rounded-xl border bg-card p-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Schedule
            </p>
            <div className="mt-2 space-y-2">
              {sortedTimedEvents.length > 0 ? (
                sortedTimedEvents.map((event) => (
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
                      {event.assignedToName && (
                        <span className="text-[10px] text-muted-foreground">
                          {event.assignedToName}
                        </span>
                      )}
                    </div>
                    <span
                      className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/40 px-3 py-6 text-center text-xs text-muted-foreground">
                  No scheduled events
                </div>
              )}
            </div>

            {onDateClick && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full border-dashed text-xs"
                onClick={() => onDateClick?.(currentDay)}
              >
                Add event
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* All-day events section - Google Calendar style */}
      {allDayEvents.length > 0 && (
        <div className="border-b bg-white">
          <div className="flex">
            {/* Time column spacer */}
            <div className="w-10 sm:w-16 flex-shrink-0 border-r bg-white" />

            {/* All-day events */}
            <div className="flex-1 p-1 sm:p-2 space-y-0.5 sm:space-y-1">
              {allDayEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
                  style={{
                    backgroundColor: event.color,
                    color: "white",
                  }}
                >
                  {event.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto relative bg-white">
        <div className="flex">
          {/* Time column */}
          <div className="w-10 sm:w-16 flex-shrink-0 border-r bg-white">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-[9px] sm:text-xs text-right pr-1 sm:pr-2 text-gray-500 relative"
                style={{ height: `${hourHeight}px` }}
              >
                <span className="absolute -top-2 right-1 sm:right-2">
                  {format(addHours(startOfDay(new Date()), hour), "HH:mm")}
                </span>
              </div>
            ))}
          </div>

          {/* Day column with events */}
          <div className="flex-1 relative bg-white">
            {/* Hour grid */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-gray-200 hover:bg-gray-50 transition-colors relative"
                style={{ height: `${hourHeight}px` }}
                onClick={() => onDateClick?.(addHours(currentDay, hour))}
              />
            ))}

            {/* Timed events overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
              {timedEvents.map((event) => {
                const { top, height } = getEventStyle(event);
                const { width, left } = getEventPositioning(event);

                return (
                  <div
                    key={event.id}
                    className="absolute rounded border-l-2 sm:border-l-4 p-0.5 px-1 sm:p-1 sm:px-2 overflow-hidden cursor-pointer pointer-events-auto hover:shadow-lg transition-all"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      width,
                      left,
                      backgroundColor: `${event.color}15`, // 15 is hex for ~8% opacity
                      borderLeftColor: event.color,
                      zIndex: 10,
                    }}
                    onClick={() => onEventClick?.(event)}
                  >
                    <div
                      className="font-medium text-[9px] sm:text-xs truncate"
                      style={{ color: event.color }}
                    >
                      {event.title}
                    </div>
                    <div className="text-[8px] sm:text-xs text-gray-600 truncate">
                      {format(new Date(event.startTime), "HH:mm")} -{" "}
                      {format(new Date(event.endTime), "HH:mm")}
                    </div>
                    {event.assignedToName && height > 50 && (
                      <div className="hidden sm:block text-xs text-gray-500 mt-1">
                        {event.assignedToName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current time indicator - Google Calendar style */}
            {isToday && (
              <div
                className="absolute left-0 right-0 pointer-events-none z-20"
                style={{
                  top: `${(currentHour + currentMinute / 60) * hourHeight}px`,
                }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-600 rounded-full -ml-1 sm:-ml-1.5" />
                  <div className="flex-1 h-0.5 bg-red-600" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
