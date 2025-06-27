"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  MapPin, 
  User, 
  Plus, 
  Filter,
  CheckCircle2,
  Circle,
  Clock3,
  AlertCircle,
  XCircle,
  Users
} from "lucide-react";



interface ProjectDetailProps {
  projectId: Id<"projects">;
  onBack: () => void;
}

export default function ProjectDetail({ projectId, onBack }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "team">("overview");
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "todo" | "in_progress" | "completed">("all");

  const project = useQuery(api.myFunctions.getProject, { projectId });
  const tasks = useQuery(api.myFunctions.listProjectTasks, { projectId });
  
  const createTask = useMutation(api.myFunctions.createTask);
  const updateTaskStatus = useMutation(api.myFunctions.updateTaskStatus);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    dueDate: "",
    estimatedHours: "",
    tags: "",
  });

  if (!project) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks?.filter(task => {
    if (taskFilter === "all") return true;
    return task.status === taskFilter;
  }) || [];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;

    try {
      await createTask({
        title: newTask.title,
        description: newTask.description || undefined,
        projectId,
        priority: newTask.priority,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).getTime() : undefined,
        estimatedHours: newTask.estimatedHours ? parseFloat(newTask.estimatedHours) : undefined,
        tags: newTask.tags.split(",").map(tag => tag.trim()).filter(tag => tag),
      });

      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        estimatedHours: "",
        tags: "",
      });
      setShowNewTaskForm(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleStatusChange = async (taskId: Id<"tasks">, newStatus: "todo" | "in_progress" | "review" | "completed" | "blocked") => {
    try {
      await updateTaskStatus({ taskId, status: newStatus });
    } catch (error) {
      console.error("Error updating task status:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock3 className="h-5 w-5 text-blue-500" />;
      case "blocked":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "review":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Nie ustawiono";
    return new Date(timestamp).toLocaleDateString("pl-PL");
  };

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter(task => task.status === "completed").length || 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {project.teamName}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(project.priority)}`}>
                  {project.priority.toUpperCase()}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  project.status === "completed" ? "bg-green-100 text-green-800" :
                  project.status === "active" ? "bg-blue-100 text-blue-800" :
                  project.status === "on_hold" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {project.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Postęp projektu</span>
              <span>{completedTasks}/{totalTasks} zadań ({Math.round(progress)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: "overview", label: "Przegląd" },
              { id: "tasks", label: `Zadania (${tasks?.length || 0})` },
              { id: "team", label: "Zespół" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "overview" | "tasks" | "team")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-300px)]">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Project Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacje o projekcie</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {project.description && (
                    <div>
                      <h4 className="font-medium text-gray-700">Opis</h4>
                      <p className="text-gray-600">{project.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {project.client && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Klient</p>
                          <p className="font-medium">{project.client}</p>
                        </div>
                      </div>
                    )}
                    
                    {project.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Lokalizacja</p>
                          <p className="font-medium">{project.location}</p>
                        </div>
                      </div>
                    )}
                    
                    {project.startDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Data rozpoczęcia</p>
                          <p className="font-medium">{formatDate(project.startDate)}</p>
                        </div>
                      </div>
                    )}
                    
                    {project.endDate && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Data zakończenia</p>
                          <p className="font-medium">{formatDate(project.endDate)}</p>
                        </div>
                      </div>
                    )}
                    
                    {project.budget && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Budżet</p>
                          <p className="font-medium">{project.budget.toLocaleString("pl-PL")} PLN</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Tasks */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ostatnie zadania</h3>
                <div className="space-y-2">
                  {tasks?.slice(0, 5).map((task) => (
                    <div key={task._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {getStatusIcon(task.status)}
                      <div className="flex-1">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-gray-500">
                          {task.dueDate && `Termin: ${formatDate(task.dueDate)}`}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Task Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <select 
                      value={taskFilter} 
                      onChange={(e) => setTaskFilter(e.target.value as "all" | "todo" | "in_progress" | "completed")}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    >
                      <option value="all">Wszystkie zadania</option>
                      <option value="todo">Do zrobienia</option>
                      <option value="in_progress">W trakcie</option>
                      <option value="completed">Ukończone</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewTaskForm(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Nowe zadanie
                </button>
              </div>

              {/* New Task Form */}
              {showNewTaskForm && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <form onSubmit={handleCreateTask} className="space-y-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Tytuł zadania"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder="Opis zadania (opcjonalny)"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md h-20 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Priorytet</label>
                        <select
                          value={newTask.priority}
                          onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as "low" | "medium" | "high" | "urgent" })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="low">Niski</option>
                          <option value="medium">Średni</option>
                          <option value="high">Wysoki</option>
                          <option value="urgent">Pilny</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Termin</label>
                        <input
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Szacowane godziny</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="8"
                          value={newTask.estimatedHours}
                          onChange={(e) => setNewTask({ ...newTask, estimatedHours: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tagi</label>
                        <input
                          type="text"
                          placeholder="projektowanie, dokumentacja"
                          value={newTask.tags}
                          onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Utwórz zadanie
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewTaskForm(false)}
                        className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                      >
                        Anuluj
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tasks List */}
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <div key={task._id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => {
                          const newStatus = task.status === "completed" ? "todo" : 
                                         task.status === "todo" ? "in_progress" :
                                         task.status === "in_progress" ? "completed" : "todo";
                          handleStatusChange(task._id, newStatus);
                        }}
                        className="mt-0.5"
                      >
                        {getStatusIcon(task.status)}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className={`font-medium ${task.status === "completed" ? "line-through text-gray-500" : "text-gray-900"}`}>
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                              {task.estimatedHours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {task.estimatedHours}h
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            <select
                              value={task.status}
                              onChange={(e) => handleStatusChange(task._id, e.target.value as "todo" | "in_progress" | "review" | "completed" | "blocked")}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="todo">Do zrobienia</option>
                              <option value="in_progress">W trakcie</option>
                              <option value="review">Na review</option>
                              <option value="completed">Ukończone</option>
                              <option value="blocked">Zablokowane</option>
                            </select>
                          </div>
                        </div>
                        
                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {task.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {taskFilter === "all" ? "Brak zadań w tym projekcie" : `Brak zadań ze statusem "${taskFilter}"`}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "team" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Zespół projektu</h3>
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  Zarządzanie zespołem projektu będzie dostępne wkrótce.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 