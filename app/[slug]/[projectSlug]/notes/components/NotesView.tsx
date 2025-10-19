"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useProject } from "@/components/providers/ProjectProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, Edit, Trash2, StickyNote, Eye } from "lucide-react";
import { format } from "date-fns";

type Note = {
  _id: Id<"notes">;
  title: string;
  content: string;
  projectId: Id<"projects">;
  teamId: Id<"teams">;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
  createdByUser: {
    name: string;
    imageUrl?: string;
  };
};

interface NoteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; content: string }) => void;
  note?: Note;
  isSubmitting: boolean;
}

function NoteForm({ isOpen, onClose, onSubmit, note, isSubmitting }: NoteFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [note]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    onSubmit({ title: title.trim(), content: content.trim() });
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "Add New Note"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter note content"
              rows={6}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : note ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NoteCard({ note, onEdit, onDelete, onView }: { 
  note: Note; 
  onEdit: (note: Note) => void; 
  onDelete: (noteId: Id<"notes">) => void; 
  onView: (note: Note) => void;
}) {
  return (
    <Card className="h-fit cursor-pointer hover:shadow-md transition-shadow" onClick={() => onView(note)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(note)}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(note)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(note._id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
          {note.content}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={note.createdByUser.imageUrl} />
              <AvatarFallback className="text-xs">
                {note.createdByUser.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{note.createdByUser.name}</span>
          </div>
          <div>
            {note.updatedAt !== note.createdAt && "Updated "}
            {format(new Date(note.updatedAt), "MMM d, yyyy")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotesView() {
  const { project } = useProject();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  const notes = useQuery(api.notes.getProjectNotes, { 
    projectId: project._id 
  });

  const createNote = useMutation(api.notes.createNote);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateNote = async (data: { title: string; content: string }) => {
    setIsSubmitting(true);
    try {
      await createNote({
        title: data.title,
        content: data.content,
        projectId: project._id,
      });
      toast.success("Note created successfully");
      setIsFormOpen(false);
    } catch (error) {
      toast.error("Failed to create note");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (data: { title: string; content: string }) => {
    if (!editingNote) return;
    
    setIsSubmitting(true);
    try {
      await updateNote({
        noteId: editingNote._id,
        title: data.title,
        content: data.content,
      });
      toast.success("Note updated successfully");
      setEditingNote(null);
    } catch (error) {
      toast.error("Failed to update note");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: Id<"notes">) => {
    try {
      await deleteNote({ noteId });
      toast.success("Note deleted successfully");
    } catch (error) {
      toast.error("Failed to delete note");
      console.error(error);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
  };

  const handleViewNote = (note: Note) => {
    setViewingNote(note);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingNote(null);
  };

  const closeView = () => {
    setViewingNote(null);
  };

  if (notes === undefined) {
    return <NotesViewSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">
            Manage project notes and documentation
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card className="p-12 text-center">
          <StickyNote className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No notes yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first note to get started
          </p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onEdit={handleEditNote}
              onDelete={handleDeleteNote}
              onView={handleViewNote}
            />
          ))}
        </div>
      )}

      <NoteForm
        isOpen={isFormOpen || !!editingNote}
        onClose={closeForm}
        onSubmit={editingNote ? handleUpdateNote : handleCreateNote}
        note={editingNote || undefined}
        isSubmitting={isSubmitting}
      />

      {/* Note Viewer Modal */}
      <Dialog open={!!viewingNote} onOpenChange={closeView}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{viewingNote?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {viewingNote?.content}
            </div>
            <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={viewingNote?.createdByUser.imageUrl} />
                  <AvatarFallback className="text-xs">
                    {viewingNote?.createdByUser.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{viewingNote?.createdByUser.name}</span>
              </div>
              <div className="flex gap-4">
                <span>Created: {viewingNote && format(new Date(viewingNote.createdAt), "MMM d, yyyy 'at' HH:mm")}</span>
                {viewingNote && viewingNote.updatedAt !== viewingNote.createdAt && (
                  <span>Updated: {format(new Date(viewingNote.updatedAt), "MMM d, yyyy 'at' HH:mm")}</span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeView}>
                Close
              </Button>
              <Button 
                onClick={() => {
                  setViewingNote(null);
                  setEditingNote(viewingNote);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NotesViewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-64">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-8 w-8" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 