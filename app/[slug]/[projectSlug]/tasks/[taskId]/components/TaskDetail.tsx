"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Trash2,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import TaskForm from "../../components/TaskForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SimpleTextEditor from './SimpleTextEditor';

type TaskPriority = "low" | "medium" | "high" | "urgent";

const priorityColors = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
};

export default function TaskDetail() {
  const params = useParams<{ slug: string, projectSlug: string, taskId: string }>();
  const router = useRouter();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  const task = useQuery(api.myFunctions.getTask, 
    params.taskId ? { taskId: params.taskId as Id<"tasks"> } : "skip"
  );

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const deleteTask = useMutation(api.myFunctions.deleteTask);
  
  if (!task || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  const handleDeleteTask = async () => {
    if (!task) return;
    try {
      await deleteTask({ taskId: task._id });
      toast.success("Zadanie zostało usunięte");
      router.back();
    } catch {
      toast.error("Błąd podczas usuwania zadania");
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    // Sprawdź czy czas jest ustawiony (inny niż północ)
    if (date.getHours() !== 0 || date.getMinutes() !== 0) {
      return format(date, "PPP p"); // Format z datą i godziną
    }
    return format(date, "PPP"); // Format z samą datą
  };

  return (
    <div className="task-detail-container">
      {/* Header z breadcrumbs */}
      <div className="task-detail-header sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Powrót do zadań
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>{project.name}</span>
                <span>/</span>
                <span className="text-gray-900 font-medium">{task.title}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge className={priorityColors[task.priority as TaskPriority]}>
                {task.priority === "low" && "🟢 Niski"}
                {task.priority === "medium" && "🟡 Średni"}
                {task.priority === "high" && "🟠 Wysoki"}
                {task.priority === "urgent" && "🔴 Pilny"}
              </Badge>
              <Badge className={statusColors[task.status as keyof typeof statusColors]}>
                {task.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
            <div className="max-w-none mb-8">
              <SimpleTextEditor 
                taskId={params.taskId} 
                initialContent={task.description || ""} 
              />
            </div>
          </div>

          {/* Sidebar with metadata */}
          <aside className="lg:col-span-1">
            <div className="task-detail-sidebar p-6 sticky top-24 rounded-lg border">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Details</h2>
                <Button variant="outline" size="sm" onClick={() => setIsTaskFormOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Task
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-base text-gray-800">{task.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Priority</label>
                  <p className="text-base text-gray-800">{task.priority}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Cost</label>
                  <p className="text-base text-gray-800">{task.cost ? `${currencySymbol}${task.cost.toFixed(2)}` : "Not set"}</p>
                </div>

                {(task.startDate || task.endDate) && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      {task.startDate && task.endDate ? "Date Range" : 
                       task.startDate ? "Start Date" : "End Date"}
                    </label>
                    <p className="text-sm text-gray-800">
                      {task.startDate && task.endDate ? (
                        <>{formatDate(task.startDate)} - {formatDate(task.endDate)}</>
                      ) : task.startDate ? (
                        <>Start: {formatDate(task.startDate)}</>
                      ) : task.endDate ? (
                        <>End: {formatDate(task.endDate)}</>
                      ) : null}
                    </p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Assigned to</label>
                   <p className="text-base text-gray-800">{task.assignedToName || "Unassigned"}</p>
                </div>
              </div>

              <div className="mt-6">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Task
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the task. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTask}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            <TaskForm 
              projectId={project._id} 
              task={task} 
              setIsOpen={setIsTaskFormOpen} 
            />
        </DialogContent>
      </Dialog>
    </div>
  );
} 