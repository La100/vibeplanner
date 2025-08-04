// 🔄 FILTER ADAPTER - Bridge between old and new filtering systems
// Ensures backward compatibility while enabling new features

import { SharedFilters } from './types';
import { AdvancedFilters } from './advanced-filter-types';

/**
 * Convert legacy SharedFilters to new AdvancedFilters
 */
export function convertLegacyFilters(legacy: SharedFilters): Partial<AdvancedFilters> {
  return {
    searchQuery: legacy.searchQuery,
    eventTypes: {
      tasks: legacy.eventType.length === 0 || legacy.eventType.includes('task'),
      deadlines: legacy.eventType.length === 0 || legacy.eventType.includes('deadline'),
      shopping: legacy.eventType.length === 0 || legacy.eventType.includes('shopping'),
      milestones: legacy.eventType.length === 0 || legacy.eventType.includes('milestone'),
      meetings: false
    },
    priorities: new Set(legacy.priority),
    // Convert status array to appropriate sets
    taskStatuses: new Set(
      legacy.status.filter(s => ['todo', 'in_progress', 'review', 'done'].includes(s)) as any[]
    ),
    shoppingStatuses: new Set(
      legacy.status.filter(s => ['PLANNED', 'ORDERED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(s)) as any[]
    ),
    // Set defaults for new fields
    assignees: new Set(),
    tags: new Set(),
    dateRange: { type: 'all' },
  };
}

/**
 * Convert new AdvancedFilters back to legacy SharedFilters  
 */
export function convertToLegacyFilters(advanced: Partial<AdvancedFilters>): SharedFilters {
  const eventTypes: string[] = [];
  
  if (advanced.eventTypes?.tasks) eventTypes.push('task');
  if (advanced.eventTypes?.deadlines) eventTypes.push('deadline');
  if (advanced.eventTypes?.shopping) eventTypes.push('shopping');
  if (advanced.eventTypes?.milestones) eventTypes.push('milestone');
  
  const statuses = [
    ...(advanced.taskStatuses ? Array.from(advanced.taskStatuses) : []),
    ...(advanced.shoppingStatuses ? Array.from(advanced.shoppingStatuses) : [])
  ];

  return {
    searchQuery: advanced.searchQuery || '',
    eventType: eventTypes,
    priority: advanced.priorities ? Array.from(advanced.priorities) : [],
    status: statuses
  };
}

/**
 * Create default AdvancedFilters with sensible defaults
 */
export function createDefaultAdvancedFilters(): AdvancedFilters {
  return {
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
    priorities: new Set(),
    urgencyLevel: 'all',
    assignees: new Set(),
    unassignedOnly: false,
    myTasksOnly: false,
    createdByMe: false,
    dateRange: { type: 'all' },
    dueSoon: false,
    overdue: false,
    noDeadline: false,
    costRange: {},
    hasCost: false,
    noCost: false,
    tags: new Set(),
    hasDescription: false,
    hasAttachments: false,
    shoppingCategories: new Set(),
    suppliers: new Set(),
    priceRange: {},
    projectPhases: new Set(),
    smartSuggestions: {
      showCriticalPath: false,
      showBottlenecks: false,
      showUpcoming: false,
      showStale: false
    }
  };
}

/**
 * Merge partial advanced filters with defaults
 */
export function mergeWithDefaults(partial: Partial<AdvancedFilters>): AdvancedFilters {
  const defaults = createDefaultAdvancedFilters();
  
  return {
    ...defaults,
    ...partial,
    eventTypes: { ...defaults.eventTypes, ...partial.eventTypes },
    taskStatuses: partial.taskStatuses || defaults.taskStatuses,
    shoppingStatuses: partial.shoppingStatuses || defaults.shoppingStatuses,
    priorities: partial.priorities || defaults.priorities,
    assignees: partial.assignees || defaults.assignees,
    tags: partial.tags || defaults.tags,
    shoppingCategories: partial.shoppingCategories || defaults.shoppingCategories,
    suppliers: partial.suppliers || defaults.suppliers,
    projectPhases: partial.projectPhases || defaults.projectPhases,
    dateRange: { ...defaults.dateRange, ...partial.dateRange },
    costRange: { ...defaults.costRange, ...partial.costRange },
    priceRange: { ...defaults.priceRange, ...partial.priceRange },
    smartSuggestions: { ...defaults.smartSuggestions, ...partial.smartSuggestions }
  };
}