"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CalendarDays, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  MessageSquare,
  ArrowRight,
  Zap
} from "lucide-react";
import { CalendarEvent } from "./utils";

interface CalendarEventCardProps {
  event: CalendarEvent;
  variant?: 'compact' | 'detailed';
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  eventType?: 'start' | 'end' | 'single';
}

const eventTypeConfig = {
  task: {
    icon: CalendarDays,
    label: 'Task',
    colors: {
      bg: 'bg-blue-500',
      light: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200'
    }
  },
  shopping: {
    icon: ShoppingCart,
    label: 'Shopping',
    colors: {
      bg: 'bg-emerald-500',
      light: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200'
    }
  },
  deadline: {
    icon: AlertCircle,
    label: 'Deadline',
    colors: {
      bg: 'bg-red-500',
      light: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200'
    }
  },
  milestone: {
    icon: CheckCircle2,
    label: 'Milestone',
    colors: {
      bg: 'bg-purple-500',
      light: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200'
    }
  }
};

const priorityConfig = {
  urgent: { 
    label: 'Urgent', 
    color: 'bg-red-100 text-red-700 border-red-200', 
    dot: 'bg-red-500'
  },
  high: { 
    label: 'High', 
    color: 'bg-orange-100 text-orange-700 border-orange-200', 
    dot: 'bg-orange-500'
  },
  medium: { 
    label: 'Medium', 
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
    dot: 'bg-yellow-500'
  },
  low: { 
    label: 'Low', 
    color: 'bg-green-100 text-green-700 border-green-200', 
    dot: 'bg-green-500'
  }
};

const statusConfig = {
  planned: { 
    label: 'Planned', 
    color: 'bg-muted text-muted-foreground', 
    progress: 0,
    icon: Clock
  },
  confirmed: { 
    label: 'Confirmed', 
    color: 'bg-blue-100 text-blue-700', 
    progress: 25,
    icon: CheckCircle2
  },
  in_progress: { 
    label: 'In Progress', 
    color: 'bg-yellow-100 text-yellow-700', 
    progress: 50,
    icon: Zap
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-green-100 text-green-700', 
    progress: 100,
    icon: CheckCircle2
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-100 text-red-700', 
    progress: 0,
    icon: AlertCircle
  }
};

export function CalendarEventCard({ 
  event, 
  variant = 'compact', 
  onClick, 
  className,
  eventType = 'single'
}: CalendarEventCardProps) {
  const config = eventTypeConfig[event.type as keyof typeof eventTypeConfig] || eventTypeConfig.task;
  const priority = priorityConfig[event.priority as keyof typeof priorityConfig];
  const status = statusConfig[event.status as keyof typeof statusConfig];
  const Icon = config.icon;

  const getEventTitle = () => {
    if (eventType === 'start') return `▶ ${event.title}`;
    if (eventType === 'end') return `◀ ${event.title}`;
    return event.title;
  };


  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={cn(
          "rounded-lg border cursor-pointer transition-colors hover:bg-accent",
          "p-1.5 sm:p-2 text-sm",
          config.colors.light,
          config.colors.border,
          className
        )}
        title={`${event.title} (${eventType === 'start' ? 'Start' : eventType === 'end' ? 'End' : 'Single day'}) - Priority: ${event.priority}`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Priority dot */}
          {priority && (
            <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0", priority.dot)} />
          )}
          
          {/* Event icon and title */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
            <Icon className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0", config.colors.text)} />
            <span className={cn("truncate font-medium", config.colors.text, "text-[10px] sm:text-xs")}>
              {getEventTitle()}
            </span>
          </div>
          
          {/* Indicators */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {event.assignedToName && (
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-muted-foreground/60" />
            )}
            {eventType !== 'single' && (
              <ArrowRight className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // variant === 'detailed' - Kanban style card

  return (
    <div
        onClick={onClick}
        className={cn(
          "block p-1.5 rounded-md border bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group",
          config.colors.border,
          "hover:border-blue-300",
          className
        )}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-semibold text-xs group-hover:text-blue-600 transition-colors truncate flex-1 min-w-0">
            {getEventTitle()}
          </h4>
        
        {priority && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={cn("text-xs ml-1", priority.color)}>
                  <div className={cn("w-2 h-2 rounded-full mr-1", priority.dot)} />
                  {priority.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Priority: {priority.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Time and date info */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
        <Clock className="w-3 h-3" />
        <span>
          {event.isAllDay 
            ? 'All day' 
            : `${format(new Date(event.startTime), 'HH:mm')}`
          }
        </span>
        {eventType !== 'single' && (
          <>
            <span>•</span>
            <span className="text-blue-600 font-medium">
              {eventType === 'start' ? 'Start' : 'End'}
            </span>
          </>
        )}
      </div>

      {/* Status badge */}
      <div className="mb-1.5">
        <Badge variant="outline" className={cn("text-xs", status.color)}>
          {status.label}
        </Badge>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          {/* Event type indicator */}
          <Icon className={cn("w-3 h-3", config.colors.text)} />
          
          {/* Comments indicator (if applicable) */}
          {event.sourceData && 
           typeof event.sourceData === 'object' && 
           'commentCount' in event.sourceData && 
           typeof event.sourceData.commentCount === 'number' && 
           event.sourceData.commentCount > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <MessageSquare className="w-3 h-3" />
              <span>{event.sourceData.commentCount}</span>
            </div>
          )}
        </div>

        {/* Assigned user */}
        {event.assignedToName && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="w-5 h-5 border border-white">
                  <AvatarImage src={event.assignedToImageUrl} />
                  <AvatarFallback className="text-xs">
                    {event.assignedToName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <p>{event.assignedToName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}