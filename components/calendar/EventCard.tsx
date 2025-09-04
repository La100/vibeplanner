"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarEvent } from "./utils";
import { 
  CalendarDays, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle2,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EventCardProps {
  event: CalendarEvent;
  variant?: 'compact' | 'standard' | 'detailed' | 'day';
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const getPriorityColors = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return {
        bg: 'bg-red-500',
        text: 'text-red-700',
        border: 'border-red-200'
      };
    case 'high':
      return {
        bg: 'bg-orange-500',
        text: 'text-orange-700',
        border: 'border-orange-200'
      };
    case 'medium':
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-700',
        border: 'border-yellow-200'
      };
    case 'low':
      return {
        bg: 'bg-green-500',
        text: 'text-green-700',
        border: 'border-green-200'
      };
    default:
      return {
        bg: 'bg-gray-500',
        text: 'text-gray-700',
        border: 'border-gray-200'
      };
  }
};

const eventTypeConfig = {
  task: {
    icon: CalendarDays
  },
  shopping: {
    icon: ShoppingCart,
    colors: {
      bg: 'bg-emerald-500',
      text: 'text-emerald-700',
      border: 'border-emerald-200'
    }
  },
  deadline: {
    icon: AlertCircle
  },
  milestone: {
    icon: CheckCircle2,
    colors: {
      bg: 'bg-purple-500',
      text: 'text-purple-700',
      border: 'border-purple-200'
    }
  }
};

const priorityColors = {
  urgent: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300'
};

export function EventCard({ event, variant = 'standard', onClick, className }: EventCardProps) {
  const config = eventTypeConfig[event.type as keyof typeof eventTypeConfig] || eventTypeConfig.task;
  const Icon = config.icon;
  
  // Use priority colors for tasks, default colors for other event types
  const colors = event.type === 'task' 
    ? getPriorityColors(event.priority || 'medium')
    : 'colors' in config ? config.colors : getPriorityColors('medium');

  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md cursor-pointer hover:opacity-80 transition-opacity",
          colors.bg,
          "text-white text-xs",
          className
        )}
      >
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="truncate flex-1">{event.title}</span>
        {event.priority && (
          <div className="w-2 h-2 rounded-full bg-white/30" />
        )}
      </div>
    );
  }

  if (variant === 'standard') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "p-3 rounded-lg border-l-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer",
          colors.border,
          className
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", colors.text)} />
            <h3 className="font-medium text-sm text-gray-900 truncate">{event.title}</h3>
          </div>
          {event.priority && (
            <Badge 
              variant="outline" 
              className={cn("text-xs px-1 h-5", priorityColors[event.priority as keyof typeof priorityColors])}
            >
              {event.priority}
            </Badge>
          )}
        </div>
        
        {event.description && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{event.description}</p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {event.isAllDay ? 'All day' : format(new Date(event.startTime), 'HH:mm')}
          </div>
          
          {event.assignedToName && (
            <div className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarImage src={event.assignedToImageUrl} />
                <AvatarFallback className="text-xs">
                  {event.assignedToName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[60px]">{event.assignedToName}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'day') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "p-1.5 rounded-md text-white text-xs h-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity flex flex-col justify-start",
          colors.bg,
          className
        )}
      >
        <div className="flex items-start gap-1 min-h-0">
          <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 overflow-hidden">
            <h4 className="font-medium leading-tight break-words text-xs">{event.title}</h4>
            {!event.isAllDay && (
              <p className="text-xs opacity-90 mt-0.5">
                {format(new Date(event.startTime), 'HH:mm')}
              </p>
            )}
          </div>
        </div>
        {event.assignedToName && (
          <div className="text-xs opacity-80 truncate mt-1">
            {event.assignedToName}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "p-4 rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer",
          colors.border,
          className
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", colors.bg)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{event.title}</h3>
              <p className="text-sm text-gray-500">{event.type}</p>
            </div>
          </div>
          {event.priority && (
            <Badge 
              variant="outline" 
              className={cn("text-xs", priorityColors[event.priority as keyof typeof priorityColors])}
            >
              {event.priority}
            </Badge>
          )}
        </div>
        
        {event.description && (
          <p className="text-sm text-gray-600 mb-3">{event.description}</p>
        )}
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {event.isAllDay 
                ? 'All day' 
                : `${format(new Date(event.startTime), 'HH:mm')} - ${format(new Date(event.endTime), 'HH:mm')}`
              }
            </span>
          </div>
          
          {event.assignedToName && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={event.assignedToImageUrl} />
                <AvatarFallback className="text-xs">
                  {event.assignedToName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span>{event.assignedToName}</span>
            </div>
          )}
        </div>
        
        {event.project && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Project: {event.project.name}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}