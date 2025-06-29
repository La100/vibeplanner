"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import dynamic from 'next/dynamic';
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User,
} from "lucide-react";


type TaskStatus = "todo" | "in_progress" | "review" | "completed" | "blocked";
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
  blocked: "bg-red-100 text-red-700",
};

// Dynamic import for collaborative editor
const CollaborativeEditor = dynamic(
  () => import('./CollaborativeEditorComponent'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-muted-foreground">Ładowanie najlepszego edytora na świecie...</span>
      </div>
    )
  }
) as React.ComponentType<{ taskId: string; onCreateDocument: () => void }>;

export default function TaskDetail() {
  const params = useParams<{ slug: string, projectSlug: string, taskId: string }>();
  const router = useRouter();

  const task = useQuery(api.myFunctions.getTask, 
    params.taskId ? { taskId: params.taskId as Id<"tasks"> } : "skip"
  );

  const project = useQuery(api.myFunctions.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const updateTaskStatus = useMutation(api.myFunctions.updateTaskStatus);

  if (!task || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateTaskStatus({ taskId: task._id, status: newStatus });
      toast.success("Status zadania został zaktualizowany");
    } catch {
      toast.error("Błąd podczas aktualizacji statusu");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Inicjalizuj dokument z przykładową zawartością
  const handleCreateDocument = () => {
    // Używamy prostej implementacji - będziemy to wdrażać krok po kroku
    toast.success("Funkcja tworzenia dokumentu będzie wkrótce dostępna!");
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
              
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">📋 Do zrobienia</SelectItem>
                  <SelectItem value="in_progress">⚡ W trakcie</SelectItem>
                  <SelectItem value="review">👀 Do sprawdzenia</SelectItem>
                  <SelectItem value="completed">✅ Ukończone</SelectItem>
                  <SelectItem value="blocked">🚫 Zablokowane</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar z metadata */}
          <div className="lg:col-span-1">
            <div className="task-detail-sidebar p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Szczegóły</h2>
              
              <div className="space-y-4">
                {task.endDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Termin</label>
                    <div className="flex items-center mt-1">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{formatDate(task.endDate)}</span>
                    </div>
                  </div>
                )}
                
                {task.estimatedHours && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Szacowany czas</label>
                    <div className="flex items-center mt-1">
                      <Clock className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{task.estimatedHours}h</span>
                    </div>
                  </div>
                )}
                
                {task.assignedTo && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Przypisane do</label>
                    <div className="flex items-center mt-1">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{task.assignedTo}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge className={`${statusColors[task.status as TaskStatus]} border-0`}>
                      {task.status === "todo" && "📋 Do zrobienia"}
                      {task.status === "in_progress" && "⚡ W trakcie"}
                      {task.status === "review" && "👀 Do sprawdzenia"}
                      {task.status === "completed" && "✅ Ukończone"}
                      {task.status === "blocked" && "🚫 Zablokowane"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Priorytet</label>
                  <div className="mt-1">
                    <Badge className={priorityColors[task.priority as TaskPriority]}>
                      {task.priority === "low" && "🟢 Niski"}
                      {task.priority === "medium" && "🟡 Średni"}
                      {task.priority === "high" && "🟠 Wysoki"}
                      {task.priority === "urgent" && "🔴 Pilny"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-3">🔗 Szybkie akcje</h3>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="sidebar-item w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Zmień termin
                  </Button>
                  <Button variant="outline" size="sm" className="sidebar-item w-full justify-start">
                    <User className="h-4 w-4 mr-2" />
                    Przypisz osobę
                  </Button>
                  <Button variant="outline" size="sm" className="sidebar-item w-full justify-start">
                    <Clock className="h-4 w-4 mr-2" />
                    Zmień czas
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3">
            <div className="task-detail-main overflow-hidden">
              {/* Task title area */}
              <div className="task-detail-title-area px-8 py-6 border-b border-gray-200">
                <h1 className="text-4xl font-bold text-gray-900 mb-3">{task.title}</h1>
                <p className="text-gray-600 flex items-center space-x-2">
                  <span>📁 {project.name}</span>
               
                </p>
              </div>

              {/* Editor area */}
              <div className="p-0">
                <CollaborativeEditor 
                  taskId={params.taskId || ""}
                  onCreateDocument={handleCreateDocument}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 