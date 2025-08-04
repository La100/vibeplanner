// 🧠 INTELLIGENT FILTERING ENGINE - VibePlanner
// Advanced filtering logic with AI-like intelligence

import { CalendarEvent } from "@/components/calendar/utils";
import { AdvancedFilters } from "./advanced-filter-types";

export interface FilterContext {
  currentUserId?: string;
  currentDate: Date;
  projectData?: {
    hasOverdueItems: boolean;
    overdueCount: number;
    hasUpcomingDeadlines: boolean;
    upcomingDeadlineCount: number;
    averageTaskDuration: number;
    criticalPath: string[];
  };
  userPreferences?: {
    preferredPriorities: string[];
    workingHours: { start: number; end: number };
    timezone: string;
  };
}

export class SmartFilterEngine {
  private context: FilterContext;
  
  constructor(context: FilterContext) {
    this.context = context;
  }

  /**
   * 🚀 WORLD-CLASS FILTERING - Main filtering function
   */
  filterEvents(events: CalendarEvent[], filters: Partial<AdvancedFilters>): CalendarEvent[] {
    if (!events || events.length === 0) return [];

    return events.filter(event => {
      // === BASIC TEXT SEARCH ===
      if (!this.passesTextSearch(event, filters.searchQuery)) return false;
      
      // === SMART EVENT TYPE FILTERING ===
      if (!this.passesEventTypeFilter(event, filters.eventTypes)) return false;
      
      // === INTELLIGENT STATUS FILTERING ===
      if (!this.passesStatusFilter(event, filters)) return false;
      
      // === PRIORITY & URGENCY INTELLIGENCE ===
      if (!this.passesPriorityFilter(event, filters)) return false;
      
      // === SMART ASSIGNMENT FILTERING ===
      if (!this.passesAssignmentFilter(event, filters)) return false;
      
      // === ADVANCED TIME-BASED FILTERING ===
      if (!this.passesTimeFilter(event, filters)) return false;
      
      // === COST & BUDGET FILTERING ===
      if (!this.passesCostFilter(event, filters)) return false;
      
      // === CONTENT & METADATA FILTERING ===
      if (!this.passesContentFilter(event, filters)) return false;
      
      // === SHOPPING-SPECIFIC FILTERING ===
      if (!this.passesShoppingFilter(event, filters)) return false;
      
      return true;
    });
  }

  /**
   * 🔍 Advanced text search with fuzzy matching and context awareness
   */
  private passesTextSearch(event: CalendarEvent, searchQuery?: string): boolean {
    if (!searchQuery || searchQuery.trim() === '') return true;
    
    const query = searchQuery.toLowerCase().trim();
    const searchableText = [
      event.title,
      event.description || '',
      event.assignedToName || '',
      event.project?.name || '',
      // Add tags and other metadata if available
      ...(event.sourceData as any)?.tags || []
    ].join(' ').toLowerCase();
    
    // Exact match
    if (searchableText.includes(query)) return true;
    
    // Fuzzy search for typos (simplified version)
    const words = query.split(' ');
    return words.some(word => {
      if (word.length <= 2) return searchableText.includes(word);
      
      // Check for partial matches
      return searchableText.split(' ').some(textWord => {
        if (textWord.includes(word) || word.includes(textWord)) return true;
        
        // Simple fuzzy match (allows 1 character difference for words > 3 chars)
        if (word.length > 3 && textWord.length > 3) {
          return this.levenshteinDistance(word, textWord) <= 1;
        }
        
        return false;
      });
    });
  }

  /**
   * 🎯 Smart event type filtering with context awareness
   */
  private passesEventTypeFilter(event: CalendarEvent, eventTypes?: AdvancedFilters['eventTypes']): boolean {
    if (!eventTypes) return true;
    
    // Check if the event type is enabled
    switch (event.type) {
      case 'task':
        return eventTypes.tasks;
      case 'deadline':
        return eventTypes.deadlines;
      case 'shopping':
        return eventTypes.shopping;
      case 'milestone':
        return eventTypes.milestones;
      default:
        return true;
    }
  }

  /**
   * 📊 Intelligent status filtering with source-aware logic
   */
  private passesStatusFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    if (event.sourceType === 'task') {
      const taskStatus = (event.sourceData as any).status;
      return !filters.taskStatuses || filters.taskStatuses.size === 0 || filters.taskStatuses.has(taskStatus);
    } else if (event.sourceType === 'shopping') {
      const shoppingStatus = (event.sourceData as any).realizationStatus;
      return !filters.shoppingStatuses || filters.shoppingStatuses.size === 0 || filters.shoppingStatuses.has(shoppingStatus);
    }
    
    return true;
  }

  /**
   * ⚡ Smart priority filtering with urgency detection
   */
  private passesPriorityFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    // Priority filter
    if (filters.priorities && filters.priorities.size > 0) {
      if (!event.priority || !filters.priorities.has(event.priority)) {
        return false;
      }
    }
    
    // Urgency level filter
    if (filters.urgencyLevel && filters.urgencyLevel !== 'all') {
      const isUrgent = this.isEventUrgent(event);
      
      if (filters.urgencyLevel === 'urgent_only' && !isUrgent) return false;
      if (filters.urgencyLevel === 'non_urgent' && isUrgent) return false;
    }
    
    return true;
  }

  /**
   * 👥 Smart assignment filtering with user context
   */
  private passesAssignmentFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    // My tasks only
    if (filters.myTasksOnly && this.context.currentUserId) {
      if (event.assignedTo !== this.context.currentUserId) return false;
    }
    
    // Unassigned only
    if (filters.unassignedOnly) {
      if (event.assignedTo) return false;
    }
    
    // Created by me
    if (filters.createdByMe && this.context.currentUserId) {
      const createdBy = (event.sourceData as any).createdBy;
      if (createdBy !== this.context.currentUserId) return false;
    }
    
    // Specific assignees
    if (filters.assignees && filters.assignees.size > 0) {
      if (!event.assignedTo || !filters.assignees.has(event.assignedTo)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 📅 Advanced time-based filtering with smart date logic
   */
  private passesTimeFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    const now = this.context.currentDate;
    const eventDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);
    
    // Date range filter
    if (filters.dateRange && filters.dateRange.type !== 'all') {
      if (!this.isEventInDateRange(event, filters.dateRange, now)) {
        return false;
      }
    }
    
    // Due soon (within 3 days)
    if (filters.dueSoon) {
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(now.getDate() + 3);
      
      if (eventDate > threeDaysFromNow) return false;
      if (eventDate < now && event.type !== 'deadline') return false;
    }
    
    // Overdue
    if (filters.overdue) {
      if (eventDate >= now) return false;
      
      // Don't show completed items as overdue
      if (event.sourceType === 'task') {
        const status = (event.sourceData as any).status;
        if (status === 'done') return false;
      } else if (event.sourceType === 'shopping') {
        const status = (event.sourceData as any).realizationStatus;
        if (status === 'COMPLETED' || status === 'CANCELLED') return false;
      }
    }
    
    // No deadline
    if (filters.noDeadline) {
      if (event.type === 'deadline' || (event.sourceData as any).dueDate) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 💰 Cost and budget filtering
   */
  private passesCostFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    const cost = (event.sourceData as any).cost || (event.sourceData as any).totalPrice || 0;
    
    // Has cost
    if (filters.hasCost && !cost) return false;
    
    // No cost
    if (filters.noCost && cost) return false;
    
    // Cost range
    if (filters.costRange) {
      if (filters.costRange.min !== undefined && cost < filters.costRange.min) return false;
      if (filters.costRange.max !== undefined && cost > filters.costRange.max) return false;
    }
    
    return true;
  }

  /**
   * 📄 Content and metadata filtering
   */
  private passesContentFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    // Has description
    if (filters.hasDescription && !event.description) return false;
    
    // Tags
    if (filters.tags && filters.tags.size > 0) {
      const eventTags = (event.sourceData as any).tags || [];
      const hasMatchingTag = Array.from(filters.tags).some(tag => 
        eventTags.includes(tag)
      );
      if (!hasMatchingTag) return false;
    }
    
    return true;
  }

  /**
   * 🛒 Shopping-specific filtering
   */
  private passesShoppingFilter(event: CalendarEvent, filters: Partial<AdvancedFilters>): boolean {
    if (event.sourceType !== 'shopping') return true;
    
    const shoppingData = event.sourceData as any;
    
    // Categories
    if (filters.shoppingCategories && filters.shoppingCategories.size > 0) {
      if (!shoppingData.category || !filters.shoppingCategories.has(shoppingData.category)) {
        return false;
      }
    }
    
    // Suppliers
    if (filters.suppliers && filters.suppliers.size > 0) {
      if (!shoppingData.supplier || !filters.suppliers.has(shoppingData.supplier)) {
        return false;
      }
    }
    
    // Price range
    if (filters.priceRange) {
      const price = shoppingData.totalPrice || shoppingData.unitPrice || 0;
      if (filters.priceRange.min !== undefined && price < filters.priceRange.min) return false;
      if (filters.priceRange.max !== undefined && price > filters.priceRange.max) return false;
    }
    
    return true;
  }

  /**
   * 🧠 Smart urgency detection based on multiple factors
   */
  private isEventUrgent(event: CalendarEvent): boolean {
    // Explicit urgent priority
    if (event.priority === 'urgent') return true;
    
    // High priority with approaching deadline
    if (event.priority === 'high') {
      const eventDate = new Date(event.startTime);
      const now = this.context.currentDate;
      const daysUntilDue = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 1) return true; // Due tomorrow or today
    }
    
    // Overdue items are always urgent
    if (new Date(event.startTime) < this.context.currentDate) {
      // But not if they're already completed
      if (event.sourceType === 'task') {
        const status = (event.sourceData as any).status;
        return status !== 'done';
      } else if (event.sourceType === 'shopping') {
        const status = (event.sourceData as any).realizationStatus;
        return status !== 'COMPLETED' && status !== 'CANCELLED';
      }
    }
    
    return false;
  }

  /**
   * 📅 Smart date range checking
   */
  private isEventInDateRange(
    event: CalendarEvent, 
    dateRange: AdvancedFilters['dateRange'], 
    now: Date
  ): boolean {
    const eventDate = new Date(event.startTime);
    
    switch (dateRange.type) {
      case 'today':
        return this.isSameDay(eventDate, now);
        
      case 'this_week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return eventDate >= weekStart && eventDate <= weekEnd;
        
      case 'this_month':
        return eventDate.getMonth() === now.getMonth() && 
               eventDate.getFullYear() === now.getFullYear();
        
      case 'next_week':
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(now.getDate() + (7 - now.getDay()));
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
        return eventDate >= nextWeekStart && eventDate <= nextWeekEnd;
        
      case 'custom':
        if (dateRange.startDate && eventDate < dateRange.startDate) return false;
        if (dateRange.endDate && eventDate > dateRange.endDate) return false;
        return true;
        
      default:
        return true;
    }
  }

  /**
   * 🔧 Utility functions
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

/**
 * 🎯 Easy-to-use hook for filtering events
 */
export function useSmartFiltering(
  events: CalendarEvent[],
  filters: Partial<AdvancedFilters>,
  context: FilterContext
) {
  const engine = new SmartFilterEngine(context);
  return engine.filterEvents(events, filters);
}