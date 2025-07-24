"use client";

import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { ChevronLeft, ChevronRight, Calendar, Search, X } from "lucide-react";
import { CalendarDays, ShoppingCart, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCalendar } from "./CalendarProvider";
import { Badge } from "@/components/ui/badge";

interface CalendarFilters {
  searchQuery: string;
  eventType: string[];
  priority: string[];
  status: string[];
}

interface CalendarHeaderProps {
  filters?: CalendarFilters;
  onFiltersChange?: (filters: CalendarFilters) => void;
}

export function CalendarHeader({ 
  filters = { searchQuery: "", eventType: [], priority: [], status: [] },
  onFiltersChange 
}: CalendarHeaderProps) {
  const { state, navigatePrevious, navigateNext, goToToday } = useCalendar();
  const { currentDate } = state;

  const getDateDisplayText = () => {
    return format(currentDate, 'LLLL yyyy', { locale: enUS });
  };

  const handleFilterChange = (filterType: keyof CalendarFilters, value: string | string[]) => {
    if (onFiltersChange) {
      onFiltersChange({
        ...filters,
        [filterType]: value,
      });
    }
  };

  const clearFilters = () => {
    if (onFiltersChange) {
      onFiltersChange({ searchQuery: "", eventType: [], priority: [], status: [] });
    }
  };

  const isFiltered = filters.searchQuery !== "" || 
                     filters.eventType.length > 0 || 
                     filters.priority.length > 0 || 
                     filters.status.length > 0;

  // Filter options
  const eventTypeOptions = [
    { value: "task", label: "Tasks", icon: CalendarDays },
    { value: "shopping", label: "Shopping", icon: ShoppingCart },
    { value: "deadline", label: "Deadline", icon: AlertCircle },
    { value: "milestone", label: "Milestone", icon: CheckCircle2 },
  ];

  const priorityOptions = [
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];

  const statusOptions = [
    { value: "planned", label: "Planned" },
    { value: "confirmed", label: "Confirmed" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="border-b bg-card">
      {/* Main header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Calendar
              </h1>
              <p className="text-xs text-muted-foreground">
                Browse events
              </p>
            </div>
          </div>
          
          {/* Navigation Controls */}
          <div className="flex items-center gap-1 bg-background rounded-lg p-1 border">
            <Button
              variant="ghost"
              size="sm"
              onClick={navigatePrevious}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="px-4 h-8 text-xs font-semibold"
            >
              Today
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateNext}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Current Date Display */}
          <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
            {getDateDisplayText()}
          </Badge>
        </div>
      </div>

      {/* Filters section */}
      <div className="px-4 pb-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              className="max-w-sm pl-10"
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            />
          </div>

          {/* Filter Dropdowns */}
          <DataTableFacetedFilter
            title="Type"
            options={eventTypeOptions}
            selectedValues={new Set(filters.eventType)}
            onFilterChange={(selected) => handleFilterChange('eventType', Array.from(selected))}
          />

          <DataTableFacetedFilter
            title="Priority"
            options={priorityOptions}
            selectedValues={new Set(filters.priority)}
            onFilterChange={(selected) => handleFilterChange('priority', Array.from(selected))}
          />

          <DataTableFacetedFilter
            title="Status"
            options={statusOptions}
            selectedValues={new Set(filters.status)}
            onFilterChange={(selected) => handleFilterChange('status', Array.from(selected))}
          />

          {/* Clear Filters Button */}
          {isFiltered && (
            <Button 
              variant="ghost" 
              onClick={clearFilters}
              className="h-8 px-2 lg:px-3"
            >
              Clear
              <X className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Active filters display */}
        {isFiltered && (
          <div className="flex items-center gap-1 flex-wrap text-sm text-muted-foreground">
            <span>Active filters:</span>
            {filters.searchQuery && (
              <Badge variant="secondary" className="text-xs">
                "{filters.searchQuery}"
              </Badge>
            )}
            {filters.eventType.map(type => (
              <Badge key={type} variant="secondary" className="text-xs">
                {eventTypeOptions.find(opt => opt.value === type)?.label}
              </Badge>
            ))}
            {filters.priority.map(priority => (
              <Badge key={priority} variant="secondary" className="text-xs">
                {priorityOptions.find(opt => opt.value === priority)?.label}
              </Badge>
            ))}
            {filters.status.map(status => (
              <Badge key={status} variant="secondary" className="text-xs">
                {statusOptions.find(opt => opt.value === status)?.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}