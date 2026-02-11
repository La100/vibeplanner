"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import TaskForm from "./TaskForm";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  type DragEndEvent,
} from '@/components/ui/shadcn-io/kanban';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const formatDateTime = (timestamp: number | undefined): string => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  if (hasTime) {
    return format(date, "MM/dd/yyyy, HH:mm");
  }
  return format(date, "MM/dd/yyyy");
};

type TaskStatusKey = "todo" | "in_progress" | "done";

type TaskStatusLiterals = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent" | null | undefined;

const columnOrder: TaskStatusKey[] = ["todo", "in_progress", "done"];

type KanbanTask = {
  id: Id<"tasks">;
  name: string;
  column: TaskStatusLiterals;
  title: string;
  description: string | undefined;
  content: string | undefined;
  priority: TaskPriority;
  startDate: number | undefined;
  endDate: number | undefined;
  cost: number | undefined;
  status: TaskStatusLiterals;
  assignedTo: string | null | undefined;
  assignedToName: string | undefined;
  assignedToImageUrl: string | undefined;
  commentCount: number;
};

type TaskWithDetails = {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  content?: string;
  priority?: TaskPriority;
  startDate?: number;
  endDate?: number;
  cost?: number;
  status: TaskStatusLiterals;
  assignedTo?: string | null;
  assignedToName?: string;
  assignedToImageUrl?: string;
  commentCount: number;
};

interface TeamMemberWithUser {
  _id: Id<"teamMembers">;
  clerkUserId: string;
  name: string;
}

// A simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const priorityColors: Record<NonNullable<TaskPriority>, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const getPriorityDisplay = (priority: TaskPriority) => {
  if (!priority || priority === null) return { label: "No priority", color: "bg-gray-50 text-gray-400" };
  return { label: priority, color: priorityColors[priority] };
};

export function TasksViewSkeleton({ viewMode = "kanban" }: { viewMode?: "kanban" | "list" }) {
  return (
    <div className="p-4 h-full flex flex-col animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-9 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-10 flex-grow" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Content */}
      {viewMode === 'kanban' ? (
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-2">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-grow border rounded-lg">
          <div className="p-4">
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TasksView() {
  const params = useParams<{ projectSlug: string }>();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const entityLabel = "Task";
  const entityLabelLower = "task";
  const detailBasePath = "tasks";

  const [filters] = useState<{
    searchQuery: string;
    status: string[];
    priority: string[];
    assignedTo: string[];
  }>({ searchQuery: "", status: [], priority: [], assignedTo: [] });

  const [sorting] = useState<{
    sortBy: string;
    sortOrder: "asc" | "desc";
  }>({ sortBy: "createdAt", sortOrder: "desc" });

  const debouncedSearchQuery = useDebounce(filters.searchQuery, 300);

  const { project } = useProject();

  const teamMembers = useQuery(apiAny.teams.getTeamMembers, {
    teamId: project.teamId,
  }) as TeamMemberWithUser[] | undefined;

  const tasks = useQuery(apiAny.tasks.listProjectTasks, {
    projectId: project._id,
    filters: {
      ...filters,
      searchQuery: debouncedSearchQuery,
    },
    sortBy: sorting.sortBy,
    sortOrder: sorting.sortOrder
  }) as TaskWithDetails[] | undefined;

  const [preservedTasks, setPreservedTasks] = useState<typeof tasks>(undefined);

  useEffect(() => {
    if (tasks !== undefined) {
      setPreservedTasks(tasks);
    }
  }, [tasks]);

  const tasksToDisplay = tasks ?? preservedTasks;

  const updateTaskStatus = useMutation(apiAny.tasks.updateTaskStatus);

  const statusOptions = useMemo(() => {
    return project.taskStatusSettings
      ? Object.entries(project.taskStatusSettings)
        .map(([id, { name, color }]) => ({ value: id, label: name, color }))
        .sort((a, b) => columnOrder.indexOf(a.value as TaskStatusKey) - columnOrder.indexOf(b.value as TaskStatusKey))
      : [];
  }, [project.taskStatusSettings]);

  const kanbanTasks = useMemo(() => tasksToDisplay?.map(task => ({
    id: task._id,
    name: task.title,
    column: task.status,
    title: task.title,
    description: task.description,
    content: task.content,
    priority: task.priority as TaskPriority,
    startDate: task.startDate,
    endDate: task.endDate,
    cost: task.cost,
    status: task.status,
    assignedTo: task.assignedTo,
    assignedToName: task.assignedToName,
    assignedToImageUrl: task.assignedToImageUrl,
    commentCount: task.commentCount,
  })) || [], [tasksToDisplay]);

  const [localKanbanTasks, setLocalKanbanTasks] = useState<KanbanTask[]>(kanbanTasks);

  useEffect(() => {
    setLocalKanbanTasks(kanbanTasks);
  }, [kanbanTasks]);



  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const columnId = (over.data.current?.parent || over.id) as TaskStatusLiterals;

    if (!statusOptions.some(s => s.value === columnId)) {
      return;
    }

    const task = localKanbanTasks.find(t => t.id === cardId);
    if (task && task.status !== columnId) {
      const prevStatus = task.status;
      const prevColumn = task.column;
      const nextStatus = columnId;
      const nextColumn = columnId;

      setLocalKanbanTasks(prev => {
        return prev.map(t =>
          t.id === cardId ? { ...t, column: nextColumn, status: nextStatus } : t
        );
      });

      try {
        await updateTaskStatus({
          taskId: cardId as Id<"tasks">,
          status: nextStatus,
        });
        toast.success("Task status updated.");
      } catch {
        toast.error("Failed to update task status.");
        setLocalKanbanTasks(prev => {
          return prev.map(t =>
            t.id === cardId ? { ...t, column: prevColumn, status: prevStatus } : t
          );
        });
      }
    }
  };


  if (project === undefined || teamMembers === undefined) {
    return <TasksViewSkeleton />;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }

  return (
    <div className="flex flex-col h-full items-center p-4">
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create a new {entityLabelLower}</DialogTitle>
          </DialogHeader>
          {project && (
            <TaskForm
              projectId={project._id}
              teamId={project.teamId}
              teamMembers={teamMembers || []}
              setIsOpen={setIsTaskFormOpen}
              onTaskCreated={() => {
                // Optionally refetch tasks or handle UI update
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-6xl mx-auto mb-4">
        <Button onClick={() => setIsTaskFormOpen(true)}>
          Add {entityLabel}
        </Button>
      </div>

      <KanbanProvider onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-2 lg:grid-cols-3 w-full max-w-6xl mx-auto">
          {statusOptions.map((status) => (
            <KanbanBoard id={status.value} key={status.value}>
              <KanbanHeader
                name={status.label}
                color={status.color}
              />
              <KanbanCards>
                {localKanbanTasks
                  .filter((task) => task.column === status.value)
                  .map((task, index) => (
                    <KanbanCard
                      key={task.id}
                      id={task.id}
                      name={task.name}
                      index={index}
                      parent={status.value}
                    >
                      <TaskCardContent
                        task={task}
                        projectSlug={params.projectSlug}
                        detailBasePath={detailBasePath}
                      />
                    </KanbanCard>
                  ))}
              </KanbanCards>
            </KanbanBoard>
          ))}
        </div>
      </KanbanProvider>
    </div>
  );
}

function TaskCardContent({ task, projectSlug, detailBasePath }: { task: KanbanTask, projectSlug: string, detailBasePath: string }) {
  const priority = getPriorityDisplay(task.priority);
  return (
    <div className="block">
      <div className="flex justify-between items-start">
        <Link href={`/organisation/projects/${projectSlug}/${detailBasePath}/${task.id}`}>
          <h4 className="font-semibold text-sm mb-2 hover:underline">{task.title}</h4>
        </Link>
        {task.priority && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={`${priority.color} text-xs`}>{priority.label}</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Priority: {priority.label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {task.description && <p className="text-xs text-muted-foreground mb-2">{task.description}</p>}

      {(task.startDate || task.endDate) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {task.startDate && task.endDate ? (
            <span>{formatDateTime(task.startDate)} - {formatDateTime(task.endDate)}</span>
          ) : task.endDate ? (
            <span>Due: {formatDateTime(task.endDate)}</span>
          ) : (
            <span>Start: {formatDateTime(task.startDate!)}</span>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {task.commentCount > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <MessageSquare className="w-3 h-3" />
              <span>{task.commentCount}</span>
            </div>
          )}
        </div>
        <div className="flex items-center -space-x-2">
          {task.assignedTo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="w-6 h-6 border-2 border-white">
                    <AvatarImage src={task.assignedToImageUrl} />
                    <AvatarFallback>{task.assignedToName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Assigned to {task.assignedToName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div >
  );
}
