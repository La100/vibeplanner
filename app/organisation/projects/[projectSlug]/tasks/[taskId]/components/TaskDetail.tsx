"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";

export default function TaskDetail() {
  const params = useParams<{ projectSlug: string, taskId: string }>();
  const router = useRouter();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [isSavingDate, setIsSavingDate] = useState(false);

  const task = useQuery(apiAny.tasks.getTask, 
    params.taskId ? { taskId: params.taskId as Id<"tasks"> } : "skip"
  );
  
  const project = useQuery(
    apiAny.projects.getProjectBySlugForCurrentUser,
    params.projectSlug ? { projectSlug: params.projectSlug } : "skip"
  );

  const updateTask = useMutation(apiAny.tasks.updateTask);
  const deleteTask = useMutation(apiAny.tasks.deleteTask);
  
  useEffect(() => {
    setDescriptionValue(task?.description || "");
  }, [task?._id, task?.description]);
  
  if (!task || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const entityLabel = "task";
  const entityLabelTitle = "Task";
  const dateLabel = "Due date";

  const handleDeleteTask = async () => {
    if (!task) return;
    const shouldDelete = window.confirm(`Delete this ${entityLabel}? This can't be undone.`);
    if (!shouldDelete) return;
    try {
      await deleteTask({ taskId: task._id });
      toast.success(`${entityLabelTitle} deleted`);
      router.back();
    } catch {
      toast.error(`Error deleting ${entityLabel}`);
    }
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
      toast.success("Title updated successfully");
      setIsEditingTitle(false);
      setTitleValue('');
    } catch {
      toast.error("Error updating title");
    }
  };

  const startEditingTitle = () => {
    setTitleValue(task.title);
    setIsEditingTitle(true);
  };

  const handleDescriptionSave = async () => {
    if (!task) return;
    const nextValue = descriptionValue.trim();
    const currentValue = (task.description || "").trim();
    if (nextValue === currentValue) {
      return;
    }
    setIsSavingDescription(true);
    try {
      await updateTask({
        taskId: task._id,
        description: nextValue,
      });
      toast.success("Description updated");
    } catch {
      toast.error("Error updating description");
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleTargetDateUpdate = async (date: Date | undefined) => {
    if (!task) return;
    setIsSavingDate(true);
    try {
      await updateTask({
        taskId: task._id,
        endDate: date?.getTime(),
      });
      toast.success(`${dateLabel} updated`);
    } catch {
      toast.error(`Error updating ${dateLabel.toLowerCase()}`);
    } finally {
      setIsSavingDate(false);
    }
  };

  return (
    <div className="bg-muted/40 min-h-screen">
      {/* Header z breadcrumbs */}
      <div className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to tasks
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{project.name}</span>
                <span>/</span>
                <span className="text-foreground font-medium">{task.title}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl space-y-8">
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
                <p className="text-xs text-muted-foreground mt-1">Press Enter to save, Escape to cancel</p>
              </div>
            ) : (
              <h1 
                className="text-3xl font-bold text-gray-900 mb-2 cursor-pointer hover:bg-gray-50 rounded p-2 -m-2 transition-colors"
                onClick={startEditingTitle}
                title="Click to edit title"
              >
                {task.title}
              </h1>
            )}
            
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                {dateLabel}
              </label>
              <DatePicker
                date={task.endDate ? new Date(task.endDate) : undefined}
                onDateChange={handleTargetDateUpdate}
                placeholder={`Set ${dateLabel.toLowerCase()}`}
                className="mt-2"
              />
              {isSavingDate && (
                <p className="text-xs text-muted-foreground mt-2">Saving date…</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                value={descriptionValue}
                onChange={(e) => setDescriptionValue(e.target.value)}
                onBlur={handleDescriptionSave}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    handleDescriptionSave();
                  }
                }}
                placeholder={`Describe this ${entityLabel}...`}
                className="mt-2 min-h-[160px] bg-background"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                <span>{isSavingDescription ? "Saving…" : "Autosaves on blur"}</span>
                <Button variant="outline" size="sm" onClick={handleDeleteTask}>
                  Delete {entityLabel}
                </Button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
} 
