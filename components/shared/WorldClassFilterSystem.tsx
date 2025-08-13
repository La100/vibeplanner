"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Search, Filter, X, Sparkles, Clock, User, DollarSign, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { AdvancedFilters, FilterPreset, SmartFilterSuggestion, DEFAULT_FILTER_PRESETS } from "./advanced-filter-types";

interface WorldClassFilterSystemProps {
  filters: Partial<AdvancedFilters>;
  onFiltersChange: (filters: Partial<AdvancedFilters>) => void;
  projectData?: unknown;
  userContext?: unknown;
  teamMembers?: Array<{ id: string; name: string; imageUrl?: string }>;
  className?: string;
}

export function WorldClassFilterSystem({
  filters,
  onFiltersChange,
  projectData,
  userContext,
  teamMembers = [],
  className
}: WorldClassFilterSystemProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(true);
  
  // Initialize with default filters if empty
  const currentFilters = useMemo(() => ({
    searchQuery: '',
    eventTypes: {
      tasks: true,
      deadlines: true,
      shopping: true,
      milestones: false,
      meetings: false
    },
    taskStatuses: new Set(['todo', 'in_progress', 'review']),
    shoppingStatuses: new Set(['PLANNED', 'ORDERED', 'IN_TRANSIT']),
    priorities: new Set<string>(),
    assignees: new Set<string>(),
    dateRange: { type: 'all' as const },
    tags: new Set<string>(),
    ...filters
  }), [filters]);

  // Calculate active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    
    if (currentFilters.searchQuery) count++;
    if (currentFilters.myTasksOnly) count++;
    if (currentFilters.overdue) count++;
    if (currentFilters.dueSoon) count++;
    if (currentFilters.priorities.size > 0) count++;
    if (currentFilters.assignees.size > 0) count++;
    if (currentFilters.tags.size > 0) count++;
    if (currentFilters.dateRange.type !== 'all') count++;
    
    // Event types (only count if not all are selected)
    const eventTypeCount = Object.values(currentFilters.eventTypes).filter(Boolean).length;
    if (eventTypeCount < Object.keys(currentFilters.eventTypes).length) count++;
    
    // Status filters (only count if not default)
    if (currentFilters.taskStatuses.size !== 3) count++; // default is 3 statuses
    if (currentFilters.shoppingStatuses.size !== 3) count++; // default is 3 statuses
    
    return count;
  }, [currentFilters]);

  // Smart suggestions based on current context
  const smartSuggestions = useMemo(() => {
    if (!showSmartSuggestions) return [];
    
    const suggestions: SmartFilterSuggestion[] = [];
    
    // Suggest my tasks if not filtered
    if (!currentFilters.myTasksOnly && (userContext as { userId?: string })?.userId) {
      suggestions.push({
        id: 'my-tasks',
        title: 'My Tasks Only',
        description: 'Focus on items assigned to you',
        filters: { myTasksOnly: true },
        reason: 'Reduce noise and focus on your work',
        priority: 'medium',
        icon: '👤'
      });
    }
    
    // Suggest due soon if not active
    if (!currentFilters.dueSoon && (projectData as { hasUpcomingDeadlines?: boolean })?.hasUpcomingDeadlines) {
      suggestions.push({
        id: 'due-soon',
        title: 'Due Soon',
        description: 'Show items due within 3 days',
        filters: { dueSoon: true },
        reason: 'Stay ahead of deadlines',
        priority: 'high',
        icon: '⏰'
      });
    }
    
    // Suggest overdue items
    const overdueCount = (projectData as { overdueCount?: number })?.overdueCount;
    if (!currentFilters.overdue && overdueCount && overdueCount > 0) {
      suggestions.push({
        id: 'overdue',
        title: 'Overdue Items',
        description: `${overdueCount} items need attention`,
        filters: { overdue: true },
        reason: 'Address overdue items immediately',
        priority: 'high',
        icon: '🚨'
      });
    }
    
    return suggestions.slice(0, 3); // Show max 3 suggestions
  }, [currentFilters, projectData, userContext, showSmartSuggestions]);

  const updateFilters = useCallback((updates: Partial<AdvancedFilters>) => {
    onFiltersChange({ ...currentFilters, ...updates } as Partial<AdvancedFilters>);
  }, [currentFilters, onFiltersChange]);

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
      searchQuery: '',
      eventTypes: {
        tasks: true,
        deadlines: true,
        shopping: true,
        milestones: false,
        meetings: false
      },
      taskStatuses: new Set(['todo', 'in_progress', 'review'] as ("todo" | "in_progress" | "review" | "done")[]),
      shoppingStatuses: new Set(['PLANNED', 'ORDERED', 'IN_TRANSIT'] as ("PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED")[]),
      priorities: new Set(),
      assignees: new Set(),
      dateRange: { type: 'all' },
      tags: new Set(),
      myTasksOnly: false,
      overdue: false,
      dueSoon: false,
      urgencyLevel: 'all'
    });
  }, [onFiltersChange]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    onFiltersChange({ ...currentFilters, ...preset.filters } as Partial<AdvancedFilters>);
    setIsPresetsOpen(false);
  }, [currentFilters, onFiltersChange]);

  const applySuggestion = useCallback((suggestion: SmartFilterSuggestion) => {
    updateFilters(suggestion.filters);
    setShowSmartSuggestions(false);
  }, [updateFilters]);

  const toggleEventType = useCallback((type: keyof AdvancedFilters['eventTypes']) => {
    updateFilters({
      eventTypes: {
        ...currentFilters.eventTypes,
        [type]: !currentFilters.eventTypes[type]
      }
    });
  }, [currentFilters.eventTypes, updateFilters]);

  const togglePriority = useCallback((priority: string) => {
    const newPriorities = new Set(currentFilters.priorities);
    if (newPriorities.has(priority)) {
      newPriorities.delete(priority);
    } else {
      newPriorities.add(priority as "low" | "medium" | "high" | "urgent");
    }
    updateFilters({ priorities: newPriorities as Set<"low" | "medium" | "high" | "urgent"> });
  }, [currentFilters.priorities, updateFilters]);

  const toggleAssignee = useCallback((userId: string) => {
    const newAssignees = new Set(currentFilters.assignees);
    if (newAssignees.has(userId)) {
      newAssignees.delete(userId);
    } else {
      newAssignees.add(userId);
    }
    updateFilters({ assignees: newAssignees });
  }, [currentFilters.assignees, updateFilters]);

  return (
    <div className={`flex flex-col space-y-3 ${className}`}>
      {/* Main Filter Bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search tasks, items, or people..."
            value={currentFilters.searchQuery}
            onChange={(e) => updateFilters({ searchQuery: e.target.value })}
            className="pl-10 pr-4"
          />
          {currentFilters.searchQuery && (
            <button
              onClick={() => updateFilters({ searchQuery: '' })}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Filter Presets */}
        <Popover open={isPresetsOpen} onOpenChange={setIsPresetsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Presets
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Quick Filter Presets</h4>
              <div className="grid gap-2">
                {DEFAULT_FILTER_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className="justify-start gap-2 h-auto p-2"
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <div className="text-left">
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Advanced Filters */}
        <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="px-1 py-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Advanced Filters</h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-6 px-2 text-xs"
                  >
                    Clear all
                  </Button>
                )}
              </div>

              {/* Event Types */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  Event Types
                </label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(currentFilters.eventTypes).map(([type, enabled]) => (
                    <Button
                      key={type}
                      variant={enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleEventType(type as keyof AdvancedFilters['eventTypes'])}
                      className="h-7 px-2 text-xs capitalize"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                  <Zap className="h-3 w-3" />
                  Priority
                </label>
                <div className="flex flex-wrap gap-1">
                  {['low', 'medium', 'high', 'urgent'].map((priority) => (
                    <Button
                      key={priority}
                      variant={currentFilters.priorities.has(priority) ? "default" : "outline"}
                      size="sm"
                      onClick={() => togglePriority(priority)}
                      className="h-7 px-2 text-xs capitalize"
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Quick Actions */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Quick Filters
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={currentFilters.myTasksOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateFilters({ myTasksOnly: !currentFilters.myTasksOnly })}
                    className="h-8 text-xs"
                  >
                    <User className="h-3 w-3 mr-1" />
                    My Tasks
                  </Button>
                  <Button
                    variant={currentFilters.overdue ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateFilters({ overdue: !currentFilters.overdue })}
                    className="h-8 text-xs"
                  >
                    ⚠️ Overdue
                  </Button>
                  <Button
                    variant={currentFilters.dueSoon ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateFilters({ dueSoon: !currentFilters.dueSoon })}
                    className="h-8 text-xs"
                  >
                    ⏰ Due Soon
                  </Button>
                  <Button
                    variant={currentFilters.hasCost ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateFilters({ hasCost: !currentFilters.hasCost })}
                    className="h-8 text-xs"
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Has Cost
                  </Button>
                </div>
              </div>

              {/* Team Members */}
              {teamMembers.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Assigned To
                    </label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {teamMembers.map((member) => (
                        <Button
                          key={member.id}
                          variant={currentFilters.assignees.has(member.id) ? "default" : "ghost"}
                          size="sm"
                          onClick={() => toggleAssignee(member.id)}
                          className="w-full justify-start h-8 text-xs"
                        >
                          {member.imageUrl && (
                            <img
                              src={member.imageUrl}
                              alt={member.name}
                              className="w-4 h-4 rounded-full mr-2"
                            />
                          )}
                          {member.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Smart Suggestions */}
      {smartSuggestions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Smart suggestions:</span>
          {smartSuggestions.map((suggestion) => (
            <Button
              key={suggestion.id}
              variant="outline"
              size="sm"
              onClick={() => applySuggestion(suggestion)}
              className="h-6 px-2 text-xs gap-1 bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <span>{suggestion.icon}</span>
              {suggestion.title}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSmartSuggestions(false)}
            className="h-6 px-2 text-xs text-gray-400"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {currentFilters.searchQuery && (
            <Badge variant="secondary" className="gap-1 text-xs">
              Search: {currentFilters.searchQuery}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-600" 
                onClick={() => updateFilters({ searchQuery: '' })}
              />
            </Badge>
          )}
          
          {currentFilters.myTasksOnly && (
            <Badge variant="secondary" className="gap-1 text-xs">
              👤 My Tasks
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-600" 
                onClick={() => updateFilters({ myTasksOnly: false })}
              />
            </Badge>
          )}
          
          {currentFilters.overdue && (
            <Badge variant="destructive" className="gap-1 text-xs">
              ⚠️ Overdue
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-600" 
                onClick={() => updateFilters({ overdue: false })}
              />
            </Badge>
          )}
          
          {currentFilters.dueSoon && (
            <Badge variant="secondary" className="gap-1 text-xs">
              ⏰ Due Soon
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-600" 
                onClick={() => updateFilters({ dueSoon: false })}
              />
            </Badge>
          )}
          
          {Array.from(currentFilters.priorities).map((priority) => (
            <Badge key={priority} variant="secondary" className="gap-1 text-xs capitalize">
              🔥 {priority}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-red-600" 
                onClick={() => togglePriority(priority)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}