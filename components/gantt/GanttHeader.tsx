"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Search, X, Filter, BarChart3, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { SharedFilters } from "../shared/types";

interface GanttHeaderProps {
  filters: SharedFilters;
  onFiltersChange: (filters: SharedFilters) => void;
  currentView?: "calendar" | "gantt";
  onViewChange?: (view: "calendar" | "gantt") => void;
  children?: React.ReactNode;
}

export function GanttHeader({ 
  filters, 
  onFiltersChange, 
  currentView = "gantt", 
  onViewChange
}: GanttHeaderProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const updateFilters = (updates: Partial<SharedFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchQuery: "",
      eventType: [],
      priority: [],
      status: []
    });
  };

  const activeFiltersCount = [
    ...filters.eventType,
    ...filters.priority,
    ...filters.status
  ].length + (filters.searchQuery ? 1 : 0);

  const removeFilter = (type: keyof SharedFilters, value: string) => {
    if (type === 'searchQuery') {
      updateFilters({ searchQuery: "" });
    } else {
      const currentArray = filters[type] as string[];
      updateFilters({
        [type]: currentArray.filter(item => item !== value)
      });
    }
  };

  const toggleArrayFilter = (type: 'eventType' | 'priority' | 'status', value: string) => {
    const currentArray = filters[type];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilters({ [type]: newArray });
  };

  return (
    <div className="border-b bg-white">
      {/* Main Header */}
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Left side - Search, Filters, and View Switcher */}
        <div className="flex items-center gap-4 flex-1">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search tasks..."
              value={filters.searchQuery}
              onChange={(e) => updateFilters({ searchQuery: e.target.value })}
              className="pl-10 pr-4"
            />
            {filters.searchQuery && (
              <button
                onClick={() => updateFilters({ searchQuery: "" })}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Button */}
          <DropdownMenu open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                Filter
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1 py-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Event Type</DropdownMenuLabel>
              {[
                { value: 'task', label: 'Tasks', icon: '📋' },
                { value: 'deadline', label: 'Deadlines', icon: '⏰' },
                { value: 'shopping', label: 'Shopping', icon: '🛒' }
              ].map((type) => (
                <DropdownMenuCheckboxItem
                  key={type.value}
                  checked={filters.eventType.includes(type.value)}
                  onCheckedChange={() => toggleArrayFilter('eventType', type.value)}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Priority</DropdownMenuLabel>
              {[
                { value: 'low', label: 'Low', icon: '🟢' },
                { value: 'medium', label: 'Medium', icon: '🟡' },
                { value: 'high', label: 'High', icon: '🟠' },
                { value: 'urgent', label: 'Urgent', icon: '🔴' }
              ].map((priority) => (
                <DropdownMenuCheckboxItem
                  key={priority.value}
                  checked={filters.priority.includes(priority.value)}
                  onCheckedChange={() => toggleArrayFilter('priority', priority.value)}
                >
                  <span className="mr-2">{priority.icon}</span>
                  {priority.label}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Task Status</DropdownMenuLabel>
              {[
                { value: 'todo', label: 'To Do', icon: '⚪' },
                { value: 'in_progress', label: 'In Progress', icon: '🔵' },
                { value: 'review', label: 'Review', icon: '🟡' },
                { value: 'done', label: 'Done', icon: '✅' }
              ].map((status) => (
                <DropdownMenuCheckboxItem
                  key={status.value}
                  checked={filters.status.includes(status.value)}
                  onCheckedChange={() => toggleArrayFilter('status', status.value)}
                >
                  <span className="mr-2">{status.icon}</span>
                  {status.label}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-gray-500 font-normal">Shopping Status</DropdownMenuLabel>
              {[
                { value: 'PLANNED', label: 'Planned', icon: '📝' },
                { value: 'ORDERED', label: 'Ordered', icon: '📦' },
                { value: 'IN_TRANSIT', label: 'In Transit', icon: '🚚' },
                { value: 'DELIVERED', label: 'Delivered', icon: '📍' },
                { value: 'COMPLETED', label: 'Completed', icon: '✅' },
                { value: 'CANCELLED', label: 'Cancelled', icon: '❌' }
              ].map((status) => (
                <DropdownMenuCheckboxItem
                  key={status.value}
                  checked={filters.status.includes(status.value)}
                  onCheckedChange={() => toggleArrayFilter('status', status.value)}
                >
                  <span className="mr-2">{status.icon}</span>
                  {status.label}
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearAllFilters}>
                Clear all filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Switcher */}
          {onViewChange && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button
                variant={currentView === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewChange("calendar")}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Calendar
              </Button>
              <Button
                variant={currentView === "gantt" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewChange("gantt")}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Gantt
              </Button>
            </div>
          )}
        </div>

        {/* Right side - Empty for now */}
        <div className="flex items-center">
        </div>
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {filters.searchQuery && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Search: {filters.searchQuery}
                <button
                  onClick={() => removeFilter('searchQuery', '')}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {filters.eventType.map((type) => (
              <Badge key={type} variant="secondary" className="flex items-center gap-1">
                Type: {type}
                <button
                  onClick={() => removeFilter('eventType', type)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            
            {filters.priority.map((priority) => (
              <Badge key={priority} variant="secondary" className="flex items-center gap-1">
                Priority: {priority}
                <button
                  onClick={() => removeFilter('priority', priority)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            
            {filters.status.map((status) => (
              <Badge key={status} variant="secondary" className="flex items-center gap-1">
                Status: {status.replace('_', ' ')}
                <button
                  onClick={() => removeFilter('status', status)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 