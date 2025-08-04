"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  GanttProvider, 
  GanttSidebar, 
  GanttSidebarGroup, 
  GanttSidebarItem, 
  GanttTimeline, 
  GanttHeader as KiboGanttHeader, 
  GanttToday,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureItem,
  type GanttFeature,
  type Range
} from "@/components/ui/kibo-ui/gantt";
import { CalendarEvent } from "@/components/calendar/utils";
import { GanttHeader } from "./GanttHeader";
import { SharedFilters } from "../shared/types";

interface GanttProps {
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  filters?: SharedFilters;
  onFiltersChange?: (filters: SharedFilters) => void;
}

const statusColors: Record<string, string> = {
  todo: "#9CA3AF", // gray-400
  in_progress: "#3B82F6", // blue-500
  review: "#F59E0B", // amber-500
  done: "#10B981", // emerald-500
  blocked: "#EF4444", // red-500
};

export function Gantt({ 
  events = [], 
  onEventClick,
  className,
  filters,
  onFiltersChange
}: GanttProps) {
  const [ganttRange, setGanttRange] = useState<Range>('monthly');
  const [ganttZoom, setGanttZoom] = useState(100);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Reset selected task when component unmounts or events change
  useEffect(() => {
    setSelectedTaskId(null);
  }, [events]);

  // Apply filters to events
  const filteredEvents = useMemo(() => {
    if (!events || !filters) return events;
    
    return events.filter((event) => {
      // Search query filter
      if (filters.searchQuery && !event.title.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      
      // Event type filter
      if (filters.eventType.length > 0 && !filters.eventType.includes(event.type)) {
        return false;
      }
      
      // Priority filter
      if (filters.priority.length > 0 && event.priority && !filters.priority.includes(event.priority)) {
        return false;
      }
      
      // Status filter - check original source status  
      if (filters.status.length > 0) {
        if (event.sourceType === 'task') {
          const originalStatus = (event.sourceData as any).status;
          if (!filters.status.includes(originalStatus)) {
            return false;
          }
        } else if (event.sourceType === 'shopping') {
          const originalStatus = (event.sourceData as any).realizationStatus;
          if (!filters.status.includes(originalStatus)) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [events, filters]);

  // Transform events to Gantt features
  const ganttFeatures: GanttFeature[] = useMemo(() => {
    return filteredEvents
      .filter(event => event.type === 'task' && event.endTime)
      .map(event => ({
        id: event.id,
        name: event.title,
        startAt: new Date(event.startTime),
        endAt: new Date(event.endTime!),
        status: {
          id: event.status || 'todo',
          name: (event.status || 'todo').replace("_", " "),
          color: statusColors[event.status || 'todo'] || "#6B7280",
        },
      }));
  }, [filteredEvents]);

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    const event = filteredEvents.find(e => e.id === taskId);
    if (event) {
      onEventClick?.(event);
    }
  };

  return (
    <div className={`flex flex-col h-full w-full bg-background ${className}`}>
      {/* Gantt Controls */}
      <div className="flex gap-4 p-4 border-b bg-background">
        <Select value={ganttRange} onValueChange={(value: Range) => setGanttRange(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setGanttZoom(Math.max(50, ganttZoom - 25))}
          >
            -
          </Button>
          <span className="text-sm w-12 text-center">{ganttZoom}%</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setGanttZoom(Math.min(200, ganttZoom + 25))}
          >
            +
          </Button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 w-full overflow-hidden">
        <GanttProvider 
          range={ganttRange} 
          zoom={ganttZoom} 
          className="h-full w-full"
        >
          <GanttSidebar>
            <GanttSidebarGroup name="Project Tasks">
              {ganttFeatures.map(feature => (
                <GanttSidebarItem 
                  key={feature.id} 
                  feature={feature}
                  onSelectItem={handleTaskClick}
                  className={selectedTaskId === feature.id ? "bg-blue-100 border-l-4 border-l-blue-500" : ""}
                />
              ))}
            </GanttSidebarGroup>
          </GanttSidebar>
          
          <GanttTimeline>
            <KiboGanttHeader />
            <GanttToday />
            <GanttFeatureList>
              <GanttFeatureListGroup>
                {ganttFeatures.map(feature => (
                  <GanttFeatureItem 
                    key={feature.id} 
                    {...feature}
                    onClick={handleTaskClick}
                  />
                ))}
              </GanttFeatureListGroup>
            </GanttFeatureList>
          </GanttTimeline>
        </GanttProvider>
      </div>
    </div>
  );
} 