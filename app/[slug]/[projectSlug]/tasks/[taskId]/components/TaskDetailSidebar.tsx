"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

interface TaskDetailSidebarProps {
  task: {
    _id: Id<"tasks">;
    status: string;
    priority?: string;
    cost?: number;
    startDate?: number;
    endDate?: number;
    assignedToName?: string;
    estimatedHours?: number;
  };
  project: {
    currency?: string;
  };
  onDelete: () => void;
}

export default function TaskDetailSidebar({ task, project, onDelete }: TaskDetailSidebarProps) {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const updateTask = useMutation(api.myFunctions.updateTask);
  const deleteTask = useMutation(api.myFunctions.deleteTask);

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : project.currency === "USD" ? "$" : "$";

  const handleUpdate = async (field: string, value: string | number | undefined) => {
    setIsUpdating(field);
    try {
      await updateTask({
        taskId: task._id,
        [field]: value,
      });
      toast.success("Zapisano zmiany");
    } catch (error) {
      toast.error("Błąd podczas zapisywania");
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDateUpdate = async (startDate?: number, endDate?: number) => {
    setIsUpdating('dates');
    try {
      await updateTask({
        taskId: task._id,
        startDate,
        endDate,
      });
      toast.success("Zapisano daty");
    } catch (error) {
      toast.error("Błąd podczas zapisywania dat");
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask({ taskId: task._id });
      toast.success("Zadanie zostało usunięte");
      onDelete();
    } catch {
      toast.error("Błąd podczas usuwania zadania");
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "";
    return format(new Date(timestamp), "PPP");
  };

  return (
    <div className="task-detail-sidebar p-6 sticky top-24 rounded-lg border">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Szczegóły zadania</h2>
        <p className="text-sm text-gray-500">Edytuj pola bezpośrednio</p>
      </div>
      
      <div className="space-y-6">
        {/* Status */}
        <div>
          <Label className="text-sm font-medium text-gray-500">Status</Label>
          <Select 
            value={task.status} 
            onValueChange={(value) => handleUpdate('status', value)}
            disabled={isUpdating === 'status'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div>
          <Label className="text-sm font-medium text-gray-500">Priority</Label>
          <Select 
            value={task.priority || "none"} 
            onValueChange={(value) => handleUpdate('priority', value === "none" ? undefined : value)}
            disabled={isUpdating === 'priority'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="No priority set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">⚪ No priority</SelectItem>
              <SelectItem value="low">🟢 Low</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="urgent">🔴 Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cost */}
        <div>
          <Label className="text-sm font-medium text-gray-500">Cost ({currencySymbol})</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            defaultValue={task.cost || ""}
            className="mt-1"
            disabled={isUpdating === 'cost'}
            onBlur={(e) => {
              const value = e.target.valueAsNumber;
              if (!isNaN(value) && value !== task.cost) {
                handleUpdate('cost', value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = (e.target as HTMLInputElement).valueAsNumber;
                if (!isNaN(value) && value !== task.cost) {
                  handleUpdate('cost', value);
                }
              }
            }}
          />
        </div>

        {/* Start Date */}
        <div>
          <Label className="text-sm font-medium text-gray-500">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full mt-1 justify-start text-left font-normal",
                  !task.startDate && "text-muted-foreground"
                )}
                disabled={isUpdating === 'dates'}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {task.startDate ? formatDate(task.startDate) : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={task.startDate ? new Date(task.startDate) : undefined}
                onSelect={(date) => {
                  const timestamp = date ? date.getTime() : undefined;
                  handleDateUpdate(timestamp, task.endDate);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div>
          <Label className="text-sm font-medium text-gray-500">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full mt-1 justify-start text-left font-normal",
                  !task.endDate && "text-muted-foreground"
                )}
                disabled={isUpdating === 'dates'}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {task.endDate ? formatDate(task.endDate) : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={task.endDate ? new Date(task.endDate) : undefined}
                onSelect={(date) => {
                  const timestamp = date ? date.getTime() : undefined;
                  handleDateUpdate(task.startDate, timestamp);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Assigned To */}
        <div>
          <Label className="text-sm font-medium text-gray-500">Assigned to</Label>
          <p className="text-sm text-gray-800 mt-1 p-2 bg-gray-50 rounded">
            {task.assignedToName || "Unassigned"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            User assignment will be added in future updates
          </p>
        </div>

        {/* Estimated Hours */}
        <div>
          <Label className="text-sm font-medium text-gray-500">Estimated Hours</Label>
          <Input
            type="number"
            step="0.5"
            placeholder="0"
            defaultValue={task.estimatedHours || ""}
            className="mt-1"
            disabled={isUpdating === 'estimatedHours'}
            onBlur={(e) => {
              const value = e.target.valueAsNumber;
              if (!isNaN(value) && value !== task.estimatedHours) {
                handleUpdate('estimatedHours', value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = (e.target as HTMLInputElement).valueAsNumber;
                if (!isNaN(value) && value !== task.estimatedHours) {
                  handleUpdate('estimatedHours', value);
                }
              }
            }}
          />
        </div>
      </div>

      {/* Delete Button */}
      <div className="mt-8 pt-6 border-t">
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

      {/* Update Status */}
      {isUpdating && (
        <div className="mt-4 p-2 bg-blue-50 text-blue-700 text-sm rounded">
          Zapisywanie {isUpdating}...
        </div>
      )}
    </div>
  );
} 