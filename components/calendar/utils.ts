import { Doc } from "@/convex/_generated/dataModel";

export type Task = Doc<"tasks">;
export type ShoppingItem = Doc<"shoppingListItems">;

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: 'task' | 'shopping' | 'deadline' | 'milestone';
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  assignedToName?: string;
  assignedToImageUrl?: string;
  project?: {
    id: string;
    name: string;
    slug: string;
  };
  sourceType: 'task' | 'shopping';
  sourceData: Task | ShoppingItem;
}

export function transformTaskToEvent(task: Task & { 
  assignedToName?: string; 
  assignedToImageUrl?: string;
  project?: { id: string; name: string; slug: string; }
}): CalendarEvent | null {
  // Only include tasks with dates
  if (!task.dueDate) {
    return null;
  }


  // Task has due date - show as all-day event
  const startTime = new Date(task.dueDate);
  const endTime = new Date(task.dueDate);
  const isAllDay = true;

  return {
    id: task._id,
    title: task.title,
    description: task.description,
    type: task.dueDate ? 'deadline' : 'task',
    startTime,
    endTime,
    isAllDay,
    color: getPriorityColor(task.priority),
    priority: task.priority || 'medium',
    status: mapTaskStatusToEventStatus(task.status),
    assignedTo: task.assignedTo || undefined,
    assignedToName: task.assignedToName,
    assignedToImageUrl: task.assignedToImageUrl,
    project: task.project,
    sourceType: 'task',
    sourceData: task
  };
}

export function transformShoppingItemToEvent(item: ShoppingItem & { 
  assignedToName?: string; 
  assignedToImageUrl?: string;
  project?: { id: string; name: string; slug: string; }
}): CalendarEvent | null {
  // Only include shopping items with buyBefore dates
  if (!item.buyBefore) {
    return null;
  }

  const startTime = new Date(item.buyBefore);
  const endTime = new Date(item.buyBefore);

  return {
    id: item._id,
    title: `🛒 ${item.name}`,
    description: item.notes ? `Shopping item - ${item.notes}` : 'Shopping item',
    type: 'shopping',
    startTime,
    endTime,
    isAllDay: true,
    color: getPriorityColor(item.priority),
    priority: item.priority || 'medium',
    status: mapShoppingStatusToEventStatus(item.realizationStatus),
    assignedTo: item.assignedTo || undefined,
    assignedToName: item.assignedToName,
    assignedToImageUrl: item.assignedToImageUrl,
    project: item.project,
    sourceType: 'shopping',
    sourceData: item
  };
}

function getPriorityColor(priority?: string | null): string {
  switch (priority) {
    case 'urgent':
      return '#ef4444'; // red-500
    case 'high':
      return '#f97316'; // orange-500
    case 'medium':
      return '#eab308'; // yellow-500
    case 'low':
      return '#22c55e'; // green-500
    default:
      return '#6b7280'; // gray-500
  }
}

function mapTaskStatusToEventStatus(status: string): CalendarEvent['status'] {
  switch (status) {
    case 'todo':
      return 'planned';
    case 'in_progress':
      return 'in_progress';
    case 'review':
      return 'confirmed';
    case 'done':
      return 'completed';
    default:
      return 'planned';
  }
}

function mapShoppingStatusToEventStatus(status: string): CalendarEvent['status'] {
  switch (status) {
    case 'PLANNED':
      return 'planned';
    case 'ORDERED':
      return 'confirmed';
    case 'IN_TRANSIT':
      return 'in_progress';
    case 'DELIVERED':
      return 'confirmed';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'planned';
  }
}

export function transformDataToEvents(
  tasks: (Task & { assignedToName?: string; assignedToImageUrl?: string; project?: { id: string; name: string; slug: string; } })[] = [],
  shoppingItems: (ShoppingItem & { assignedToName?: string; assignedToImageUrl?: string; project?: { id: string; name: string; slug: string; } })[] = []
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  // Transform tasks
  tasks.forEach(task => {
    const event = transformTaskToEvent(task);
    if (event) {
      events.push(event);
    }
  });
  
  // Transform shopping items
  shoppingItems.forEach(item => {
    const event = transformShoppingItemToEvent(item);
    if (event) {
      events.push(event);
    }
  });
  
  return events;
}