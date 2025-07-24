"use client";

import { createContext, useContext, useReducer, ReactNode } from "react";
import { addMonths, subMonths, addDays, subDays, addWeeks, subWeeks } from "date-fns";

type ViewMode = 'day' | 'week' | 'month' | 'year';

interface CalendarState {
  currentDate: Date;
  viewMode: ViewMode;
  selectedDate: Date | null;
  loading: boolean;
  error: string | null;
}

type CalendarAction =
  | { type: 'SET_CURRENT_DATE'; payload: Date }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_SELECTED_DATE'; payload: Date | null }
  | { type: 'NAVIGATE_NEXT' }
  | { type: 'NAVIGATE_PREVIOUS' }
  | { type: 'GO_TO_TODAY' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

interface CalendarContextType {
  state: CalendarState;
  dispatch: React.Dispatch<CalendarAction>;
  // Helper functions
  navigateNext: () => void;
  navigatePrevious: () => void;
  goToToday: () => void;
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: Date | null) => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

const calendarReducer = (state: CalendarState, action: CalendarAction): CalendarState => {
  switch (action.type) {
    case 'SET_CURRENT_DATE':
      return { ...state, currentDate: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.payload };
    case 'NAVIGATE_NEXT':
      return {
        ...state,
        currentDate: getNextDate(state.currentDate, state.viewMode)
      };
    case 'NAVIGATE_PREVIOUS':
      return {
        ...state,
        currentDate: getPreviousDate(state.currentDate, state.viewMode)
      };
    case 'GO_TO_TODAY':
      return { ...state, currentDate: new Date() };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

const getNextDate = (date: Date, viewMode: ViewMode): Date => {
  switch (viewMode) {
    case 'day':
      return addDays(date, 1);
    case 'week':
      return addWeeks(date, 1);
    case 'month':
      return addMonths(date, 1);
    case 'year':
      return addMonths(date, 12);
    default:
      return date;
  }
};

const getPreviousDate = (date: Date, viewMode: ViewMode): Date => {
  switch (viewMode) {
    case 'day':
      return subDays(date, 1);
    case 'week':
      return subWeeks(date, 1);
    case 'month':
      return subMonths(date, 1);
    case 'year':
      return subMonths(date, 12);
    default:
      return date;
  }
};

const initialState: CalendarState = {
  currentDate: new Date(),
  viewMode: 'month',
  selectedDate: null,
  loading: false,
  error: null,
};

interface CalendarProviderProps {
  children: ReactNode;
}

export function CalendarProvider({ children }: CalendarProviderProps) {
  const [state, dispatch] = useReducer(calendarReducer, initialState);

  const navigateNext = () => dispatch({ type: 'NAVIGATE_NEXT' });
  const navigatePrevious = () => dispatch({ type: 'NAVIGATE_PREVIOUS' });
  const goToToday = () => dispatch({ type: 'GO_TO_TODAY' });
  const setCurrentDate = (date: Date) => dispatch({ type: 'SET_CURRENT_DATE', payload: date });
  const setViewMode = (mode: ViewMode) => dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  const setSelectedDate = (date: Date | null) => dispatch({ type: 'SET_SELECTED_DATE', payload: date });

  const contextValue: CalendarContextType = {
    state,
    dispatch,
    navigateNext,
    navigatePrevious,
    goToToday,
    setCurrentDate,
    setViewMode,
    setSelectedDate,
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
}