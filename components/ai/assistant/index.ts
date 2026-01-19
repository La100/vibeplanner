/**
 * AI Assistant Module
 *
 * Main export file for the AI Assistant feature.
 */

// UI Components
export * from './ui';

// Data Layer
export * from './data/hooks';
export * from './data/handlers';
export * from './data/utils';
export * from './data/types';

// Configuration
export * from './config';

// Main component
export { default as AIAssistant } from './AIAssistant';
export { default } from './AIAssistant';
