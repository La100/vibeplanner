"use client";

import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { ChevronLeft, ChevronRight, Calendar, Search, X, Filter, CalendarRange, CalendarClock, CalendarDays as CalendarDaysIcon, Keyboard } from "lucide-react";
import { CalendarDays, ShoppingCart, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCalendar } from "./CalendarProvider";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
  const { state, navigatePrevious, navigateNext, goToToday, setViewMode } = useCalendar();
  const { currentDate, viewMode } = state;
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const getDateDisplayText = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy', { locale: enUS });
      case 'week':
        return format(currentDate, "'Week of' MMMM d, yyyy", { locale: enUS });
      case 'month':
        return format(currentDate, 'LLLL yyyy', { locale: enUS });
      case 'year':
        return format(currentDate, 'yyyy', { locale: enUS });
      default:
        return format(currentDate, 'LLLL yyyy', { locale: enUS });
    }
  };

  const getShortDateDisplayText = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, 'MMM d', { locale: enUS });
      case 'week':
        return format(currentDate, "'Week' MMM d", { locale: enUS });
      case 'month':
        return format(currentDate, 'MMM yyyy', { locale: enUS });
      case 'year':
        return format(currentDate, 'yyyy', { locale: enUS });
      default:
        return format(currentDate, 'MMM yyyy', { locale: enUS });
    }
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

  const renderMobileFilters = () => (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          className="pl-10"
          value={filters.searchQuery}
          onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="space-y-3">
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
      </div>

      {/* Clear Filters Button */}
      {isFiltered && (
        <Button 
          variant="outline" 
          onClick={clearFilters}
          className="w-full"
        >
          Clear All Filters
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="border-b bg-card">
      {/* Main header */}
      <div className="flex items-center justify-between p-1.5 sm:p-4">
        {/* Left section - Logo and Title */}
        <div className="flex items-center gap-1 sm:gap-4 min-w-0 flex-1">
          {/* Logo and Title */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <div className="p-1 sm:p-2 rounded-lg bg-primary flex-shrink-0">
              <Calendar className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                Calendar
              </h1>
              <p className="text-xs text-muted-foreground">
                Browse events
              </p>
            </div>
          </div>
          
          {/* Today Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="px-1.5 sm:px-4 h-6 sm:h-8 text-[10px] sm:text-sm font-medium flex-shrink-0"
          >
            <span className="hidden sm:inline">Today</span>
            <span className="sm:hidden">Now</span>
          </Button>
        </div>

        {/* Center section - Navigation with Date */}
        <div className="flex items-center gap-0.5 sm:gap-3 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={navigatePrevious}
            className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-muted"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          
          <div className="text-[11px] sm:text-lg font-semibold text-foreground min-w-[70px] sm:min-w-[180px] text-center px-0.5 sm:px-1">
            <span className="hidden sm:inline">{getDateDisplayText()}</span>
            <span className="sm:hidden">{getShortDateDisplayText()}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={navigateNext}
            className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-muted"
          >
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Right section - View Switcher & Mobile filter button */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Keyboard Shortcuts Tooltip - Desktop only */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hidden xl:flex">
                  <Keyboard className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-4 max-w-xs">
                <div className="space-y-2 text-sm">
                  <div className="font-semibold mb-2">Keyboard Shortcuts</div>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Navigate:</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs">← →</kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Today:</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs">T</kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Day view:</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs">D</kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Week view:</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs">W</kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Month view:</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs">M</kbd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Year view:</span>
                      <kbd className="px-2 py-0.5 bg-muted rounded text-xs">Y</kbd>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* View Switcher - Desktop */}
          <div className="hidden sm:flex items-center gap-0.5 border rounded-lg p-0.5 bg-muted/50">
            <Button
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
              className={cn(
                "h-6 px-2 text-[10px] font-medium transition-all",
                viewMode === 'day' && "shadow-sm"
              )}
              title="Day View"
            >
              <CalendarClock className="h-3 w-3 sm:mr-1" />
              <span className="hidden lg:inline">Day</span>
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className={cn(
                "h-6 px-2 text-[10px] font-medium transition-all",
                viewMode === 'week' && "shadow-sm"
              )}
              title="Week View"
            >
              <CalendarRange className="h-3 w-3 sm:mr-1" />
              <span className="hidden lg:inline">Week</span>
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className={cn(
                "h-6 px-2 text-[10px] font-medium transition-all",
                viewMode === 'month' && "shadow-sm"
              )}
              title="Month View"
            >
              <CalendarDaysIcon className="h-3 w-3 sm:mr-1" />
              <span className="hidden lg:inline">Month</span>
            </Button>
            <Button
              variant={viewMode === 'year' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('year')}
              className={cn(
                "h-6 px-2 text-[10px] font-medium transition-all",
                viewMode === 'year' && "shadow-sm"
              )}
              title="Year View"
            >
              <Calendar className="h-3 w-3 sm:mr-1" />
              <span className="hidden lg:inline">Year</span>
            </Button>
          </div>

          {/* Mobile filter button */}
          <div className="sm:hidden">
            <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative h-6 w-6 p-0">
                  <Filter className="h-3 w-3" />
                  {isFiltered && (
                    <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-blue-500 rounded-full" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filter Events</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  {renderMobileFilters()}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Mobile View Switcher - Second Row */}
      <div className="sm:hidden border-t px-1.5 py-1.5">
        <div className="flex items-center gap-0.5 border rounded-lg p-0.5 bg-muted/50">
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('day')}
            className={cn(
              "flex-1 h-7 text-[10px] font-medium transition-all",
              viewMode === 'day' && "shadow-sm"
            )}
          >
            <CalendarClock className="h-3 w-3 mr-0.5" />
            Day
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('week')}
            className={cn(
              "flex-1 h-7 text-[10px] font-medium transition-all",
              viewMode === 'week' && "shadow-sm"
            )}
          >
            <CalendarRange className="h-3 w-3 mr-0.5" />
            Week
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('month')}
            className={cn(
              "flex-1 h-7 text-[10px] font-medium transition-all",
              viewMode === 'month' && "shadow-sm"
            )}
          >
            <CalendarDaysIcon className="h-3 w-3 mr-0.5" />
            Month
          </Button>
          <Button
            variant={viewMode === 'year' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('year')}
            className={cn(
              "flex-1 h-7 text-[10px] font-medium transition-all",
              viewMode === 'year' && "shadow-sm"
            )}
          >
            <Calendar className="h-3 w-3 mr-0.5" />
            Year
          </Button>
        </div>
      </div>

      {/* Desktop Filters section */}
      <div className="hidden sm:block px-2 sm:px-4 pb-2 sm:pb-4 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              className="pl-8 sm:pl-10 h-8 sm:h-10 text-xs sm:text-sm"
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