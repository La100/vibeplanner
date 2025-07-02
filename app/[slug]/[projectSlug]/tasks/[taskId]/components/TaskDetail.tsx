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
} from "lucide-react";
import { useState } from "react";
import TaskEditor from '@/components/ui/advanced-editor/TaskEditor';
import TaskDetailSidebar from './TaskDetailSidebar';
import { Input } from "@/components/ui/input";

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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  const task = useQuery(api.myFunctions.getTask, 
    params.taskId ? { taskId: params.taskId as Id<"tasks"> } : "skip"
  );

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const updateTask = useMutation(api.myFunctions.updateTask);
  
  if (!task || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }



  const handleDeleteTask = () => {
    router.back();
  };

  const handleTitleUpdate = async () => {
    if (!titleValue.trim() || titleValue === task.title) {
      setIsEditingTitle(false);
      setTitleValue('');
      return;
    }

    try {
      await updateTask({
        taskId: task._id,
        title: titleValue.trim(),
      });
      toast.success("Tytuł został zaktualizowany");
      setIsEditingTitle(false);
      setTitleValue('');
    } catch {
      toast.error("Błąd podczas aktualizacji tytułu");
    }
  };

  const startEditingTitle = () => {
    setTitleValue(task.title);
    setIsEditingTitle(true);
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
            {/* Editable Title */}
            {isEditingTitle ? (
              <div className="mb-4">
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleUpdate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleUpdate();
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                      setTitleValue('');
                    }
                  }}
                  className="text-3xl font-bold bg-transparent border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Naciśnij Enter aby zapisać, Escape aby anulować</p>
              </div>
            ) : (
              <h1 
                className="text-3xl font-bold text-gray-900 mb-2 cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                onClick={startEditingTitle}
                title="Kliknij aby edytować tytuł"
              >
                {task.title}
              </h1>
            )}
            
            <div className="max-w-none mb-8">
              <TaskEditor 
                taskId={params.taskId} 
                initialContent={task.content || task.description || ""} 
                placeholder="Opisz szczegóły tego zadania..."
              />
            </div>
          </div>

          {/* Editable Sidebar */}
          <aside className="lg:col-span-1">
            <TaskDetailSidebar 
              task={task} 
              project={project} 
              onDelete={handleDeleteTask} 
            />
          </aside>
        </div>
      </div>


    </div>
  );
} 