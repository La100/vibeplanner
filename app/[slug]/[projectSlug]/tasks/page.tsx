"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Calendar, Clock } from "lucide-react";
import {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  // KanbanColumn,
  KanbanHeader,
  KanbanCards,
  type DragEndEvent,
} from "@/components/ui/kibo-ui/kanban";

const taskFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
});

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

export default function ProjectTasksPage() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

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

  const createTask = useMutation(api.myFunctions.createTask);
  const updateTaskStatus = useMutation(api.myFunctions.updateTaskStatus);

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      estimatedHours: undefined,
    },
  });

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

  async function onSubmit(values: z.infer<typeof taskFormSchema>) {
    if (!project) return;
    
    try {
      await createTask({
        projectId: project._id,
        title: values.title,
        description: values.description,
        priority: values.priority,
        endDate: values.dueDate ? new Date(values.dueDate).getTime() : undefined,
        estimatedHours: values.estimatedHours,
        tags: [],
      });
      
      toast.success("Task created successfully");
      form.reset();
      setShowNewTaskForm(false);
    } catch (e) {
      toast.error("Error creating task", {
        description: (e as Error).message || "There was a problem creating the task."
      });
    }
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
            // Revert optimistic update on failure if needed
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project.name} - Tasks</h1>
          <p className="text-muted-foreground">Manage tasks for this project</p>
        </div>
        <Button onClick={() => setShowNewTaskForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {showNewTaskForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Task title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Task description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Hours" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Creating..." : "Create Task"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowNewTaskForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

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
                  <KanbanCard id={task.id} name={task.name} column={task.column}>
                      <div className="w-full">
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
                  </KanbanCard>
                )}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      </div>
    </div>
  );
}