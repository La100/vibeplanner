"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { CalendarIcon, Trash2, Tags, User } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TaskStatusSetting {
  name: string;
  color: string;
}

interface TeamMemberWithUser {
  _id: Id<"teamMembers">;
  clerkUserId: string;
  name: string;
  email: string;
  imageUrl?: string;
  role: "admin" | "member" | "viewer" | "client";
}

interface TaskDetailSidebarProps {
  task: {
    _id: Id<"tasks">;
    status: string;
    priority?: string;
    cost?: number;
    startDate?: number;
    endDate?: number;
    assignedTo?: string;
    assignedToName?: string;
    estimatedHours?: number;
    tags?: string[];
    teamId: Id<"teams">;
  };
  project: {
    currency?: string;
    taskStatusSettings?: Record<string, TaskStatusSetting>;
  };
  onDelete: () => void;
}

export default function TaskDetailSidebar({ task, project, onDelete }: TaskDetailSidebarProps) {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState(task.tags?.join(", ") || "");

  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);
  
  const teamMembers = useQuery(api.teams.getTeamMembers, { teamId: task.teamId });

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : project.currency === "USD" ? "$" : "$";

  const handleUpdate = async (field: string, value: string | string[] | number | undefined) => {
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

  const handleTagsUpdate = () => {
    const newTags = tagsInput.split(",").map(tag => tag.trim()).filter(Boolean);
    handleUpdate('tags', newTags);
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
    if (!timestamp) return "Pick a date";
    return format(new Date(timestamp), "PPP");
  };

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Szczegóły zadania</CardTitle>
        <p className="text-sm text-muted-foreground">Edytuj pola bezpośrednio</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <Select 
            value={task.status} 
            onValueChange={(value) => handleUpdate('status', value)}
            disabled={isUpdating === 'status'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(project.taskStatusSettings || {}).map(([id, { name }]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div>
          <Label className="text-sm font-medium">Priority</Label>
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

        {/* Assigned To */}
        <div>
          <Label className="text-sm font-medium flex items-center"><User className="mr-2 h-4 w-4"/>Assigned to</Label>
           <Select
            value={task.assignedTo || "unassigned"}
            onValueChange={(value) => handleUpdate('assignedTo', value === "unassigned" ? undefined : value)}
            disabled={isUpdating === 'assignedTo'}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teamMembers?.map((member: TeamMemberWithUser) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId!}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div>
          <Label className="text-sm font-medium">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full mt-1 justify-start text-left font-normal",
                  !task.startDate && !task.endDate && "text-muted-foreground"
                )}
                disabled={isUpdating === 'dates'}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {task.startDate && task.endDate ? 
                  `${formatDate(task.startDate)} - ${formatDate(task.endDate)}` :
                  (task.startDate ? formatDate(task.startDate) : "Date")
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="range"
                selected={{ from: task.startDate ? new Date(task.startDate) : undefined, to: task.endDate ? new Date(task.endDate) : undefined }}
                onSelect={(range) => {
                  handleUpdate('startDate', range?.from?.getTime());
                  handleUpdate('endDate', range?.to?.getTime());
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Cost */}
        <div>
          <Label className="text-sm font-medium">Cost ({currencySymbol})</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            defaultValue={task.cost || ""}
            className="mt-1"
            disabled={isUpdating === 'cost'}
            onBlur={(e) => handleUpdate('cost', e.target.valueAsNumber)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate('cost', (e.target as HTMLInputElement).valueAsNumber)}
          />
        </div>

        {/* Tags */}
        <div>
          <Label className="text-sm font-medium flex items-center"><Tags className="mr-2 h-4 w-4"/>Tags</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={handleTagsUpdate}
              onKeyDown={(e) => e.key === 'Enter' && handleTagsUpdate()}
              placeholder="Add tags, comma separated"
              className="flex-grow"
            />
          </div>
           <div className="mt-2 flex flex-wrap gap-1">
            {task.tags?.map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
            </div>
        </div>

        {/* Delete Button */}
        <div className="pt-4 border-t">
           <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Task
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to delete this task?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the task and all associated data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTask} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
           </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
} 