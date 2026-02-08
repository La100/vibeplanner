// 🚀 WORLD-CLASS FILTERING SYSTEM - VibePlanner
// Advanced filter types with intelligent context awareness

export interface AdvancedFilters {
  // === BASIC FILTERS ===
  searchQuery: string;
  
  // === SMART TYPE FILTERS ===
  eventTypes: {
    tasks: boolean;
    deadlines: boolean;
    milestones: boolean;
    meetings: boolean; // future expansion
  };
  
  // === INTELLIGENT STATUS FILTERING ===
  taskStatuses: Set<'todo' | 'in_progress' | 'review' | 'done'>;
  
  // === PRIORITY & URGENCY ===
  priorities: Set<'low' | 'medium' | 'high' | 'urgent'>;
  urgencyLevel: 'all' | 'urgent_only' | 'non_urgent'; // Smart urgency detection
  
  // === PEOPLE & ASSIGNMENT ===
  assignees: Set<string>; // Clerk user IDs
  unassignedOnly: boolean;
  myTasksOnly: boolean;
  createdByMe: boolean;
  
  // === TIME-BASED SMART FILTERS ===
  dateRange: {
    type: 'all' | 'today' | 'this_week' | 'this_month' | 'next_week' | 'overdue' | 'custom';
    startDate?: Date;
    endDate?: Date;
  };
  dueSoon: boolean; // Tasks due within 3 days
  overdue: boolean;
  noDeadline: boolean;
  
  // === COST & BUDGET FILTERS ===
  costRange: {
    min?: number;
    max?: number;
  };
  hasCost: boolean;
  noCost: boolean;
  
  // === ADVANCED CONTENT FILTERS ===
  hasDescription: boolean;
  hasAttachments: boolean;
  
  // === PROJECT CONTEXT ===
  projectPhases: Set<string>; // if we add phases later
  
  // === SMART SUGGESTIONS ===
  smartSuggestions: {
    showCriticalPath: boolean;
    showBottlenecks: boolean;
    showUpcoming: boolean;
    showStale: boolean; // Not updated for a while
  };
}

// Preset filter combinations for quick access
export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  filters: Partial<AdvancedFilters>;
  isDefault?: boolean;
  userId?: string; // for personal presets
}

// Smart filter suggestions based on context
export interface SmartFilterSuggestion {
  id: string;
  title: string;
  description: string;
  filters: Partial<AdvancedFilters>;
  reason: string; // Why this filter is suggested
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

// Filter analytics for learning user preferences
export interface FilterAnalytics {
  userId: string;
  mostUsedFilters: Record<string, number>;
  filterCombinations: Record<string, number>;
  timeOfDayPreferences: Record<string, string[]>;
  projectSpecificPreferences: Record<string, Partial<AdvancedFilters>>;
}

// Default presets that ship with the app
export const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'my-urgent-tasks',
    name: 'My Urgent Tasks',
    description: 'High priority tasks assigned to me',
    icon: '🔥',
    filters: {
      myTasksOnly: true,
      priorities: new Set(['urgent', 'high']),
      taskStatuses: new Set(['todo', 'in_progress']),
      eventTypes: { tasks: true, deadlines: true, milestones: false, meetings: false }
    },
    isDefault: true
  },
  {
    id: 'due-this-week',
    name: 'Due This Week',
    description: 'Everything due in the next 7 days',
    icon: '📅',
    filters: {
      dateRange: { type: 'this_week' },
      taskStatuses: new Set(['todo', 'in_progress', 'review'])
    },
    isDefault: true
  },
  {
    id: 'overdue-critical',
    name: 'Overdue & Critical',
    description: 'Overdue items that need immediate attention',
    icon: '⚠️',
    filters: {
      overdue: true,
      priorities: new Set(['urgent', 'high']),
      taskStatuses: new Set(['todo', 'in_progress'])
    },
    isDefault: true
  },
  {
    id: 'my-assistant-overview',
    name: 'My Assistant Overview',
    description: 'All my active items across the assistant',
    icon: '👤',
    filters: {
      myTasksOnly: true,
      taskStatuses: new Set(['todo', 'in_progress', 'review'])
    },
    isDefault: true
  },
  {
    id: 'budget-items',
    name: 'Budget Items',
    description: 'Items with cost implications',
    icon: '💰',
    filters: {
      hasCost: true,
      taskStatuses: new Set(['todo', 'in_progress', 'review'])
    },
    isDefault: true
  }
];

// Smart suggestions based on current context
export const generateSmartSuggestions = (
  currentFilters: Partial<AdvancedFilters>,
  projectData: { hasOverdueItems?: boolean; overdueCount?: number; hasUpcomingDeadlines?: boolean; upcomingDeadlineCount?: number; hasMyTasks?: boolean; [key: string]: unknown }
): SmartFilterSuggestion[] => {
  const suggestions: SmartFilterSuggestion[] = [];
  
  // Suggest overdue items if user hasn't filtered for them
  if (!currentFilters.overdue && projectData.hasOverdueItems) {
    suggestions.push({
      id: 'suggest-overdue',
      title: 'Show Overdue Items',
      description: `You have ${projectData.overdueCount} overdue items`,
      filters: { overdue: true },
      reason: 'You have overdue items that need attention',
      priority: 'high',
      icon: '⚠️'
    });
  }
  
  // Suggest focusing on assigned tasks
  if (!currentFilters.myTasksOnly && projectData.hasMyTasks) {
    suggestions.push({
      id: 'suggest-my-tasks',
      title: 'Focus on My Tasks',
      description: 'Show only items assigned to you',
      filters: { myTasksOnly: true },
      reason: 'Filter out noise and focus on your responsibilities',
      priority: 'medium',
      icon: '👤'
    });
  }
  
  // Suggest upcoming deadlines
  if (!currentFilters.dueSoon && projectData.hasUpcomingDeadlines) {
    suggestions.push({
      id: 'suggest-due-soon',
      title: 'Due Soon',
      description: 'Items due within 3 days',
      filters: { dueSoon: true },
      reason: 'Plan ahead for upcoming deadlines',
      priority: 'medium',
      icon: '⏰'
    });
  }
  
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
};
