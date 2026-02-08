// Legacy interface for backward compatibility
export interface SharedFilters {
  searchQuery: string;
  eventType: string[];
  priority: string[];
  status: string[];
}

// Re-export new advanced filters
export type { AdvancedFilters, FilterPreset, SmartFilterSuggestion } from './advanced-filter-types';