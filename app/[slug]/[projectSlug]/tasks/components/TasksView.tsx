"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { LayoutGrid, List, ChevronsUpDown, X, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";
import TaskForm from "./TaskForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  type DragEndEvent,
} from '@/components/ui/kibo-ui/kanban';
import { Skeleton } from '@/components/ui/skeleton';

type TaskStatusLiterals = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent" | undefined;

type KanbanTask = {
  id: Id<"tasks">;
  name: string;
  column: TaskStatusLiterals;
  title: string;
  description: string | undefined;
  content: string | undefined;
  priority: TaskPriority;
  endDate: number | undefined;
  estimatedHours: number | undefined;
  cost: number | undefined;
  status: TaskStatusLiterals;
  assignedTo: string | undefined;
  assignedToName: string | undefined;
  assignedToImageUrl: string | undefined;
  tags: string[] | undefined;
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
  if (!priority) return { label: "No priority", color: "bg-gray-50 text-gray-400" };
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
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  
  const [filters, setFilters] = useState<{
    searchQuery: string;
    status: string[];
    priority: string[];
    assignedTo: string[];
    tags: string[];
  }>({ searchQuery: "", status: [], priority: [], assignedTo: [], tags: [] });

  const [sorting, setSorting] = useState<{
    sortBy: string;
    sortOrder: "asc" | "desc";
  }>({ sortBy: "createdAt", sortOrder: "desc" });

  const debouncedSearchQuery = useDebounce(filters.searchQuery, 300);

  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });
  
  const teamMembers = useQuery(api.teams.getTeamMembers, project ? { teamId: project.teamId } : "skip");

  const tasks = useQuery(api.tasks.listProjectTasks, 
    project ? { 
      projectId: project._id,
      filters: {
        ...filters,
        searchQuery: debouncedSearchQuery,
      },
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder
    } : "skip"
  );

  const [preservedTasks, setPreservedTasks] = useState<typeof tasks>(undefined);

  useEffect(() => {
    if (tasks !== undefined) {
      setPreservedTasks(tasks);
    }
  }, [tasks]);

  const tasksToDisplay = tasks ?? preservedTasks;

  const hasAccess = useQuery(api.projects.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );
  
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  
  const statusOptions = useMemo(() => 
    project?.taskStatusSettings 
      ? Object.entries(project.taskStatusSettings).map(([id, { name }]) => ({ value: id, label: name }))
      : [],
    [project]
  );
  
  const priorityOptions = [
      { value: "urgent", label: "Urgent" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
  ];

  const assignedToOptions = useMemo(() =>
    teamMembers?.map((member: TeamMemberWithUser) => ({ value: member.clerkUserId!, label: member.name! })) || [],
    [teamMembers]
  );
  
  const kanbanTasks = useMemo(() => tasksToDisplay?.map(task => ({
    id: task._id,
    name: task.title,
    column: task.status,
    title: task.title,
    description: task.description,
    content: task.content,
    priority: task.priority as TaskPriority,
    endDate: task.endDate,
    estimatedHours: task.estimatedHours,
    cost: task.cost,
    status: task.status,
    assignedTo: task.assignedTo,
    assignedToName: task.assignedToName,
    assignedToImageUrl: task.assignedToImageUrl,
    tags: task.tags,
    commentCount: task.commentCount,
  })) || [], [tasksToDisplay]);
  
  const [localKanbanTasks, setLocalKanbanTasks] = useState<KanbanTask[]>(kanbanTasks);

  useEffect(() => {
    setLocalKanbanTasks(kanbanTasks);
  }, [kanbanTasks]);

  const handleDataChange = (newData: KanbanTask[]) => {
    setLocalKanbanTasks(newData);
  };

  const tagsOptions = useMemo(() => {
    const allTags = tasksToDisplay?.flatMap(task => task.tags || []) || [];
    const uniqueTags = [...new Set(allTags)];
    return uniqueTags.map(tag => ({ value: tag, label: tag }));
  }, [tasksToDisplay]);


  if (project === undefined || hasAccess === undefined || teamMembers === undefined) {
    // Let Suspense handle the main loading state
    return <TasksViewSkeleton viewMode={viewMode} />;
  }

  const isRefetching = tasks === undefined && preservedTasks !== undefined;

  const handleFilterChange = (filterType: keyof typeof filters, value: string | string[]) => {
      setFilters(prev => ({...prev, [filterType]: value}));
  };

  const clearFilters = () => {
    setFilters({ searchQuery: "", status: [], priority: [], assignedTo: [], tags: [] });
  }

  const handleSortChange = (newSortBy: string) => {
    setSorting(current => {
      if (current.sortBy === newSortBy) {
        return { ...current, sortOrder: current.sortOrder === 'asc' ? 'desc' : 'asc' };
      }
      return { sortBy: newSortBy, sortOrder: 'desc' };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const taskId = active.id as Id<"tasks">;
      const newStatus = over.id as TaskStatusLiterals;
      
      const originalTasks = localKanbanTasks;
      
      // Optimistic update
      setLocalKanbanTasks(prevTasks => prevTasks.map(t => 
        t.id === taskId ? { ...t, column: newStatus } : t
      ));
      
      try {
        await updateTaskStatus({ taskId, status: newStatus });
        toast.success("Task status updated!");
      } catch {
        toast.error("Failed to update task status.");
        // Revert on error
        setLocalKanbanTasks(originalTasks);
      }
    }
  };

  const isFiltered = filters.searchQuery !== "" || filters.status.length > 0 || filters.priority.length > 0 || filters.assignedTo.length > 0 || filters.tags.length > 0;

  if (project === null) {
    return <div>Project not found.</div>;
  }
  
  if (hasAccess === false) {
    return <div>You do not have access to this project.</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white/60 backdrop-blur-sm sticky top-0 z-10 p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name} Tasks</h1>
            <p className="text-muted-foreground">Manage your project's tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsTaskFormOpen(true)} variant="outline">New Task</Button>
            <div className="flex items-center rounded-md border bg-background">
               <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 mt-4">
          <Input 
            placeholder="Search tasks..." 
            className="max-w-sm" 
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
          />

          <DataTableFacetedFilter 
            title="Status"
            options={statusOptions}
            selectedValues={new Set(filters.status)}
            onFilterChange={(selected) => handleFilterChange('status', Array.from(selected))}
          />
          <DataTableFacetedFilter 
            title="Priority"
            options={priorityOptions}
            selectedValues={new Set(filters.priority)}
            onFilterChange={(selected) => handleFilterChange('priority', Array.from(selected))}
          />
           <DataTableFacetedFilter 
            title="Assignee"
            options={assignedToOptions}
            selectedValues={new Set(filters.assignedTo)}
            onFilterChange={(selected) => handleFilterChange('assignedTo', Array.from(selected))}
          />
          <DataTableFacetedFilter
            title="Tags"
            options={tagsOptions}
            selectedValues={new Set(filters.tags)}
            onFilterChange={(selected) => handleFilterChange('tags', Array.from(selected))}
          />

          {isFiltered && <Button variant="ghost" onClick={clearFilters} className="h-8 px-2 lg:px-3">Reset <X className="ml-2 h-4 w-4"/></Button>}
        </div>
      </div>
      
      {/* Content */}
      <main className="flex-grow p-4 overflow-y-auto relative">
        <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create a new task</DialogTitle>
            </DialogHeader>
            <TaskForm projectId={project._id} setIsOpen={setIsTaskFormOpen} />
          </DialogContent>
        </Dialog>

       <div className={cn("relative transition-opacity", isRefetching && "opacity-50")}>
         {isRefetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
         )}
          {viewMode === "kanban" ? (
            <KanbanProvider
              data={localKanbanTasks}
              columns={statusOptions.map(s => ({ id: s.value, name: s.label }))}
              onDragEnd={handleDragEnd}
              onDataChange={handleDataChange}
            >
              {(column) => (
                <KanbanBoard key={column.id} id={column.id} className="w-80 min-w-80">
                  <KanbanHeader>{column.name}</KanbanHeader>
                  <KanbanCards id={column.id}>
                    {(task: KanbanTask) => (
                      <KanbanCard {...task}>
                        <TaskCardContent task={task} projectSlug={params.projectSlug} companySlug={params.slug} />
                      </KanbanCard>
                    )}
                  </KanbanCards>
                </KanbanBoard>
              )}
            </KanbanProvider>
          ) : (
             <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead onClick={() => handleSortChange('title')}>
                                <div className="flex items-center cursor-pointer">
                                    Task <ChevronsUpDown className="ml-2 h-4 w-4" />
                                </div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Assignee</TableHead>
                            <TableHead onClick={() => handleSortChange('endDate')}>
                                <div className="flex items-center cursor-pointer">
                                    Due Date <ChevronsUpDown className="ml-2 h-4 w-4" />
                                </div>
                            </TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasksToDisplay?.map((task) => (
                            <TableRow key={task._id}>
                                <TableCell className="font-medium">
                                  <Link href={`/${params.slug}/${params.projectSlug}/tasks/${task._id}`}>
                                    {task.title}
                                  </Link>
                                </TableCell>
                                <TableCell>
                                    <Badge style={{ 
                                      backgroundColor: project.taskStatusSettings?.[task.status]?.color,
                                      color: 'white',
                                    }}>
                                        {project.taskStatusSettings?.[task.status]?.name || task.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{task.priority || 'N/A'}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={task.assignedToImageUrl} />
                                            <AvatarFallback>{task.assignedToName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span>{task.assignedToName || "Unassigned"}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {task.endDate ? new Date(task.endDate).toLocaleDateString() : 'N/A'}
                                </TableCell>
                                 <TableCell>
                                  <div className="flex gap-1">
                                    {task.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <ChevronsUpDown className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                            <DropdownMenuItem>Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          )}
       </div>
      </main>
    </div>
  );
}

function TaskCardContent({ task, projectSlug, companySlug }: { task: KanbanTask, projectSlug: string, companySlug: string }) {
  const { label, color } = getPriorityDisplay(task.priority);
  
  return (
    <Link href={`/${companySlug}/${projectSlug}/tasks/${task.id}`}>
      <Card className="mb-2 hover:shadow-md transition-shadow">
        <div className="p-3">
          <div className="flex justify-between items-start mb-2">
            <p className="font-semibold leading-tight pr-2">{task.title}</p>
            <Badge className={cn("text-xs whitespace-nowrap", color)}>{label}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {task.assignedTo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assignedToImageUrl} />
                        <AvatarFallback>{task.assignedToName?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{task.assignedToName}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
               {task.commentCount > 0 && 
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4"/>
                    {task.commentCount}
                  </div>
                }
            </div>
            {task.endDate && (
              <span className="text-xs">
                {new Date(task.endDate).toLocaleDateString()}
              </span>
            )}
          </div>
          {task.tags && task.tags.length > 0 && 
            <div className="mt-2 flex flex-wrap gap-1">
              {task.tags.map((tag: string) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          }
        </div>
      </Card>
    </Link>
  );
} 