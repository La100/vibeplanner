"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { useState } from "react";
import { Calendar, Clock, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanHeader,
  KanbanCards,
  type DragEndEvent,
} from "@/components/ui/kibo-ui/kanban";
import TaskForm from "./TaskForm";



type TaskStatus = "todo" | "in_progress" | "review" | "completed" | "blocked";
type TaskPriority = "low" | "medium" | "high" | "urgent";

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

const columns: { id: TaskStatus; name: string }[] = [
    { id: "todo", name: "To Do" },
    { id: "in_progress", name: "In Progress" },
    { id: "review", name: "Review" },
    { id: "completed", name: "Completed" },
    { id: "blocked", name: "Blocked" },
];

export default function TasksView() {
  const params = useParams<{ slug: string, projectSlug: string }>();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const tasks = useQuery(api.myFunctions.listProjectTasks, 
    project ? { projectId: project._id } : "skip"
  );

  const hasAccess = useQuery(api.myFunctions.checkUserProjectAccess, 
    project ? { projectId: project._id } : "skip"
  );

  const updateTaskStatus = useMutation(api.myFunctions.updateTaskStatus);

  if (project === undefined || tasks === undefined || hasAccess === undefined) {
    return <div>Loading...</div>;
  }

  if (project === null) {
    return <div>Project not found.</div>;
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this project.</p>
      </div>
    );
  }



  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const taskId = active.id as Id<"tasks">;
    const newStatus = over.id as TaskStatus;

    const originalTask = tasks?.find(t => t._id === taskId);

    if (originalTask && originalTask.status !== newStatus) {
        try {
            await updateTaskStatus({ taskId, status: newStatus });
            toast.success("Task status updated");
        } catch {
            toast.error("Error updating task status");
        }
    }
  };
  
  const kanbanTasks = tasks?.map(task => ({
    id: task._id,
    name: task.title,
    column: task.status,
    title: task.title,
    description: task.description,
    priority: task.priority as TaskPriority,
    endDate: task.endDate,
    estimatedHours: task.estimatedHours,
    status: task.status
  })) || [];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <TaskForm projectId={project._id} onTaskCreated={() => {}} />
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.name} - Tasks</h1>
          <p className="text-muted-foreground">Manage tasks for this project</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
          </div>

        </div>
      </div>



      {viewMode === "kanban" ? (
        <div className="flex gap-6 overflow-x-auto">
          <KanbanProvider
            columns={columns}
            data={kanbanTasks}
            onDragEnd={handleDragEnd}
          >
            {(column) => (
              <KanbanBoard id={column.id} key={column.id}>
                <KanbanHeader>{column.name}</KanbanHeader>
                <KanbanCards id={column.id}>
                  {(task: typeof kanbanTasks[0]) => (
                    <KanbanCard key={task.id} id={task.id} name={task.name} column={task.column}>
                        <Link href={`/${params.slug}/${params.projectSlug}/tasks/${task.id}`} className="block w-full">
                            <div className="w-full hover:bg-muted/50 rounded p-2 -m-2 transition-colors">
                                <h4 className="font-medium">{task.title}</h4>
                                {task.description && (
                                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge className={priorityColors[task.priority as TaskPriority]}>
                                        {task.priority}
                                    </Badge>
                                    {task.endDate && (
                                        <Badge variant="outline" className="text-xs">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(task.endDate).toLocaleDateString()}
                                        </Badge>
                                    )}
                                    {task.estimatedHours && (
                                        <Badge variant="outline" className="text-xs">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {task.estimatedHours}h
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </KanbanCard>
                  )}
                </KanbanCards>
              </KanbanBoard>
            )}
          </KanbanProvider>
        </div>
      ) : (
        <div className="space-y-4">
          {columns.map((column) => {
            const columnTasks = tasks?.filter(task => task.status === column.id) || [];
            
            if (columnTasks.length === 0) return null;
            
            return (
              <div key={column.id} className="space-y-2">
                <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2">
                  {column.name} ({columnTasks.length})
                </h3>
                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <Card key={task._id} className="hover:shadow-md transition-shadow">
                      <Link href={`/${params.slug}/${params.projectSlug}/tasks/${task._id}`}>
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-medium hover:text-primary transition-colors">{task.title}</h4>
                                <Badge className={priorityColors[task.priority as TaskPriority]}>
                                  {task.priority}
                                </Badge>
                              </div>
                              {task.description && (
                                <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {task.endDate && (
                                  <Badge variant="outline" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {new Date(task.endDate).toLocaleDateString()}
                                  </Badge>
                                )}
                                {task.estimatedHours && (
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {task.estimatedHours}h
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  Status: {task.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
          
          {(!tasks || tasks.length === 0) && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No tasks found. Create your first task to get started.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
} 