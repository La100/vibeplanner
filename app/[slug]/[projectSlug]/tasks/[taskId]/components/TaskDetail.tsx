"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, File as FileIcon, Upload } from "lucide-react";
import { useState } from "react";
import TaskEditor from '@/components/ui/advanced-editor/TaskEditor';
import TaskDetailSidebar from './TaskDetailSidebar';
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";

type TaskPriority = "low" | "medium" | "high" | "urgent" | null;

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
  const { user } = useUser();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [newComment, setNewComment] = useState('');

  const task = useQuery(api.tasks.getTask, 
    params.taskId ? { taskId: params.taskId as Id<"tasks"> } : "skip"
  );
  
  const comments = useQuery(api.comments.getCommentsForTask,
    task ? { taskId: task._id } : "skip"
  );

  const files = useQuery(api.files.getFilesForTask, task ? { taskId: task._id } : "skip");

  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const generateUploadUrl = useMutation(api.files.generateUploadUrlWithCustomKey);
  const addFile = useMutation(api.files.addFile);
  const updateTask = useMutation(api.tasks.updateTask);
  const addComment = useMutation(api.comments.addComment);
  
  if (!task || !project || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const { url, key } = await generateUploadUrl({
            projectId: project._id,
            taskId: task._id,
            fileName: file.name,
        });

        const result = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
        });

        if (!result.ok) {
            throw new Error(`Upload failed: ${await result.text()}`);
        }

        await addFile({
            projectId: project._id,
            taskId: task._id,
            fileKey: key,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
        });

        toast.success("Plik został dodany");
    } catch (error) {
        toast.error("Błąd podczas przesyłania pliku");
        console.error(error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;

    try {
      await addComment({
        taskId: task._id,
        content: newComment.trim(),
      });
      setNewComment('');
      toast.success("Komentarz został dodany");
    } catch {
      toast.error("Błąd podczas dodawania komentarza");
    }
  };

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
                Powrót do zadań
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>{project.name}</span>
                <span>/</span>
                <span className="text-foreground font-medium">{task.title}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
               {task.priority && task.priority !== null && (
                 <Badge variant="outline" className={priorityColors[task.priority as Exclude<TaskPriority, null>]}>
                  {task.priority}
                </Badge>
               )}
              <Badge variant="outline" className={statusColors[task.status as keyof typeof statusColors]}>
                {project.taskStatusSettings?.[task.status]?.name || task.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-8">
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
                <p className="text-xs text-muted-foreground mt-1">Naciśnij Enter aby zapisać, Escape aby anulować</p>
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
            
            <div className="max-w-none">
              <TaskEditor 
                taskId={params.taskId} 
                initialContent={task.content || task.description || ""} 
                placeholder="Opisz szczegóły tego zadania..."
              />
            </div>

            {/* Attachments Section */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center"><Paperclip className="mr-2 h-6 w-6"/>Załączniki</h2>
                <div className="bg-background rounded-lg border p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {files?.map((file: { _id: Id<"files">, url: string | null, name: string }) => (
                            <a 
                                key={file._id}
                                href={file.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-muted hover:bg-muted/80 p-3 rounded-md flex items-center gap-3 transition-colors"
                            >
                                <FileIcon className="h-6 w-6 text-muted-foreground" />
                                <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                            </a>
                        ))}
                    </div>
                     <Button asChild variant="outline" className="w-full cursor-pointer">
                        <label>
                            <Upload className="mr-2 h-4 w-4" />
                            Dodaj plik
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </Button>
                </div>
            </div>

            {/* Comments Section */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Komentarze</h2>
              <div className="space-y-6">
                {/* Add comment form */}
                <div className="flex items-start space-x-4">
                   <Avatar className="h-10 w-10">
                    <AvatarImage src={user.imageUrl} />
                    <AvatarFallback>{user.firstName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Dodaj komentarz..."
                      className="mb-2 bg-background"
                    />
                    <Button onClick={handleAddComment} disabled={!newComment.trim()}>Dodaj komentarz</Button>
                  </div>
                </div>

                {/* Comments list */}
                {comments?.map((comment) => (
                  <div key={comment._id} className="flex items-start space-x-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={comment.authorImageUrl} />
                      <AvatarFallback>{comment.authorName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-background rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-800">{comment.authorName}</span>
                        <span className="text-xs text-muted-foreground">{new Date(comment._creationTime).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {/* {comments?.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">Brak komentarzy. Bądź pierwszy!</p>
                )} */}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2">
            <TaskDetailSidebar 
              task={task} 
              project={project}
              onDelete={handleDeleteTask} 
            />
          </div>
        </div>
      </div>
    </div>
  );
} 