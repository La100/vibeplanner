"use client";

import { useState } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
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

import { Trash2, Tags, User, Loader2, Wand2 } from "lucide-react";
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
import { DateRangePickerWithTime } from "@/components/ui/DateRangePickerWithTime";
import { DateRange } from "react-day-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  role: "admin" | "member" | "customer";
}

interface TaskDetailSidebarProps {
  task: {
    _id: Id<"tasks">;
    status: string;
    priority?: string | null;
    cost?: number;
    startDate?: number;
    endDate?: number;
    assignedTo?: string | null;
    assignedToName?: string;
    estimatedHours?: number;
    tags?: string[];
    teamId: Id<"teams">;
    projectId: Id<"projects">;
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
  const [aiMessage, setAiMessage] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const updateTask = useMutation(api.tasks.updateTask);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const generateTaskDetails = useAction(api.tasks.generateTaskDetailsFromPrompt);
  
  const teamMembers = useQuery(api.teams.getTeamMembers, { teamId: task.teamId });

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : project.currency === "USD" ? "$" : "$";

  const handleUpdate = async (field: string, value: string | string[] | number | undefined | null) => {
    setIsUpdating(field);
    try {
      await updateTask({
        taskId: task._id,
        [field]: value,
      });
      toast.success("Changes saved");
    } catch (error) {
      toast.error("Error saving changes");
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleAiParse = async () => {
    if (!aiMessage) return;
    setIsParsing(true);
    try {
        const timezoneOffsetInMinutes = new Date().getTimezoneOffset();
        const result = await generateTaskDetails({ 
            prompt: aiMessage, 
            projectId: task.projectId,
            timezoneOffsetInMinutes,
            taskId: task._id
        });

        // Prepare a payload with only the fields returned by the AI
        const updatePayload: Partial<Doc<"tasks">> = {};
        if (result.title) updatePayload.title = result.title;
        if (result.description) updatePayload.description = result.description;
        if (result.hasOwnProperty('priority')) updatePayload.priority = result.priority;
        if (result.status) updatePayload.status = result.status;
        if (result.cost) updatePayload.cost = result.cost;
        if (result.assignedTo) updatePayload.assignedTo = result.assignedTo;
        if (result.tags) updatePayload.tags = result.tags;

        if (result.dateRange) {
            if (result.dateRange.from) {
                updatePayload.startDate = new Date(result.dateRange.from).getTime();
            }
            if (result.dateRange.to) {
                updatePayload.endDate = new Date(result.dateRange.to).getTime();
            }
        }
        
        if (Object.keys(updatePayload).length > 0) {
            await updateTask({
              taskId: task._id,
              ...updatePayload,
            });
            toast.success("Task updated with AI!");
        }
        setAiMessage("");

    } catch (error) {
        toast.error("AI parsing failed.");
        console.error(error);
    } finally {
        setIsParsing(false);
    }
  };

  const handleDateUpdate = async (range: DateRange | undefined) => {
    setIsUpdating('dates');
     try {
      await updateTask({
        taskId: task._id,
        startDate: range?.from?.getTime(),
        endDate: range?.to?.getTime(),
      });
      toast.success("Date updated");
    } catch (error) {
      toast.error("Error updating date");
      console.error(error);
    } finally {
      setIsUpdating(null);
    }
  }

  const handleTagsUpdate = () => {
    const newTags = tagsInput.split(",").map(tag => tag.trim()).filter(Boolean);
    handleUpdate('tags', newTags);
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask({ taskId: task._id });
      toast.success("Task deleted");
      onDelete();
    } catch {
      toast.error("Error deleting task");
    }
  };

  

  const assignedMember = teamMembers?.find((m: TeamMemberWithUser) => m.clerkUserId === task.assignedTo);

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Task Details</CardTitle>
        <p className="text-sm text-muted-foreground">Edit fields directly</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Edit with AI</Label>
            <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    placeholder="e.g., change priority to high"
                    disabled={isParsing}
                    className="flex-1"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!isParsing && aiMessage) {
                                handleAiParse();
                            }
                        }
                    }}
                />
                <Button 
                    onClick={handleAiParse} 
                    disabled={isParsing || !aiMessage}
                    className="w-full sm:w-auto shrink-0"
                >
                    {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>
            </div>
        </div>
        
        <div className="h-px bg-border" />

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
            value={task.priority || 'none'}
            onValueChange={(value) => handleUpdate('priority', value === 'none' ? null : value)}
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
            value={task.assignedTo || 'none'}
            onValueChange={(value) => handleUpdate('assignedTo', value === 'none' ? null : value)}
            disabled={isUpdating === 'assignedTo'}
          >
            <SelectTrigger className="mt-1">
                <div className="flex items-center gap-2">
                  {assignedMember ? (
                    <>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={assignedMember.imageUrl} />
                        <AvatarFallback>{assignedMember.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{assignedMember.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No assignee</span>
                  )}
                </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No assignee</SelectItem>
              {teamMembers?.map((member: TeamMemberWithUser) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId!}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>{member.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{member.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div>
          <Label className="text-sm font-medium">Date</Label>
          <DateRangePickerWithTime
            className="mt-1"
            value={{
              from: task.startDate ? new Date(task.startDate) : undefined,
              to: task.endDate ? new Date(task.endDate) : undefined,
            }}
            onChange={handleDateUpdate}
            disabled={isUpdating === 'dates'}
          />
        </div>

        {/* Cost */}
        <div>
          <Label className="text-sm font-medium">Cost ({currencySymbol})</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            defaultValue={task.cost || ""}
            className="mt-1 no-arrows"
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