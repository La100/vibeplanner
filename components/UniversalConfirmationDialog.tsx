"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Calendar, User, DollarSign, Tag, Package, Home } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from '@/components/providers/ProjectProvider';

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
  assignedTo: z.string().nullable().optional(),
  dueDate: z.date().optional(),
  cost: z.coerce.number().optional(),
  tags: z.array(z.string()).optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface SurveyQuestion {
  questionText: string;
  questionType: 'text_short' | 'text_long' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number';
  isRequired: boolean;
  options?: string[];
}

interface ContentItem {
  type: 'task' | 'note' | 'shopping' | 'survey' | 'contact' | 'shoppingSection';
  data: Record<string, unknown>;
  operation?: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create';
  originalItem?: Record<string, unknown>;
  updates?: Record<string, unknown>;
  selection?: Record<string, unknown>;
}

interface UniversalConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: (updatedItem: ContentItem) => void;
  contentItem: ContentItem;
  isLoading?: boolean;
  itemNumber?: number;
  totalItems?: number;
}

const priorityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800", 
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800"
};

const statusColors = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  review: "bg-purple-100 text-purple-800", 
  done: "bg-green-100 text-green-800"
};

const typeIcons = {
  task: "📝",
  note: "📄",
  shopping: "🛒",
  survey: "📊",
  contact: "👤",
  shoppingSection: "🏷️"
};

const typeLabels = {
  task: "task",
  note: "note",
  shopping: "shopping item",
  survey: "survey",
  contact: "contact",
  shoppingSection: "shopping section"
};

export function UniversalConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  onEdit,
  contentItem,
  isLoading = false,
  itemNumber = 1,
  totalItems = 1
}: UniversalConfirmationDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<ContentItem>(contentItem);
  const { project } = useProject();

  // Get team members for assignment dropdown
  const teamMembers = useQuery(
    api.teams.getTeamMembers,
    project ? { teamId: project.teamId } : "skip"
  );

  // Form for task editing
  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: undefined,
      status: "todo",
      assignedTo: "",
      dueDate: undefined,
      cost: undefined,
      tags: [],
    },
  });

  // Update editedItem when contentItem changes (new item in sequence)
  const resetTaskFormValues = (item: ContentItem) => {
    if (item.type !== 'task') {
      return;
    }

    const source = item.operation === 'edit' && item.originalItem
      ? item.originalItem
      : item.data;

    taskForm.reset({
      title: String(source.title || ''),
      description: String(source.description || ''),
      priority: source.priority as TaskFormValues["priority"],
      status: (source.status as TaskFormValues["status"]) || "todo",
      assignedTo: String(source.assignedTo || ''),
      dueDate: source.dueDate ? new Date(String(source.dueDate)) : undefined,
      cost: source.cost !== undefined && source.cost !== null ? Number(source.cost) : undefined,
      tags: (source.tags as string[]) || [],
    });
  };

  useEffect(() => {
    setEditedItem(contentItem);

    // For edit operations, automatically enter editing mode
    setIsEditing(contentItem.operation === 'edit');

    // Reset task form if it's a task
    resetTaskFormValues(contentItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentItem]);

  const handleStartEditing = () => {
    setEditedItem(contentItem);
    resetTaskFormValues(contentItem);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetTaskFormValues(contentItem);
    setEditedItem(contentItem);
    setIsEditing(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('pl-PL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const handleSaveEdit = async () => {
    if (contentItem.type === 'task') {
      const isValid = await taskForm.trigger();
      if (!isValid) {
        return;
      }

      // Get values from task form
      const formValues = taskForm.getValues();
      const updatedTaskData = {
        ...formValues,
        dueDate: formValues.dueDate?.toISOString().split('T')[0], // Convert to string
        tags: formValues.tags || [],
      };

      onEdit({
        ...editedItem,
        data: updatedTaskData
      });

      setEditedItem(prev => ({
        ...prev,
        data: updatedTaskData
      }));
    } else {
      onEdit(editedItem);
    }
    setIsEditing(false);
  };

  const renderTaskContent = () => {
    const data = contentItem.data as Record<string, unknown>;

    if (isEditing) {
      return (
        <div className="space-y-4">
          <Form {...taskForm}>
            <div className="space-y-4">
              {/* Title */}
              <FormField
                control={taskForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Implement new feature" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status and Priority Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={taskForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={taskForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No priority</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Assigned To */}
              <FormField
                control={taskForm.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No assignee</SelectItem>
                        {teamMembers?.map((member) => (
                          <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={taskForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <DatePicker
                      date={field.value}
                      onDateChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cost */}
              <FormField
                control={taskForm.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Task cost"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags */}
              <FormField
                control={taskForm.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="tag1, tag2, tag3"
                        value={field.value?.join(', ') || ''}
                        onChange={(e) => field.onChange(e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={taskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add a more detailed description..."
                        className="resize-none"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </div>
      );
    }

    // Display mode (non-editing)
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{String(data.title)}</h3>
          {Boolean(data.description && String(data.description)) && (
            <p className="text-sm text-gray-600">{String(data.description)}</p>
          )}
        </div>

        {/* Status and Priority */}
        <div className="flex gap-2 flex-wrap">
          {Boolean(data.status && String(data.status)) && (
            <Badge className={statusColors[data.status as keyof typeof statusColors]}>
              Status: {String(data.status)}
            </Badge>
          )}
          {Boolean(data.priority && String(data.priority)) && (
            <Badge className={priorityColors[data.priority as keyof typeof priorityColors]}>
              Priorytet: {String(data.priority)}
            </Badge>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3 border-t pt-3">
          {/* Due Date */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Due Date:</span>
            <span className="font-medium">
              {data.dueDate ? formatDate(String(data.dueDate)) : 'Not set'}
            </span>
          </div>

          {/* Assigned To */}
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Assigned To:</span>
            <span className="font-medium">
              {data.assignedTo ?
                teamMembers?.find(m => m.clerkUserId === data.assignedTo)?.name ||
                teamMembers?.find(m => m.clerkUserId === data.assignedTo)?.email ||
                String(data.assignedTo)
                : 'Not assigned'}
            </span>
          </div>

          {/* Cost */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Cost:</span>
            <span className="font-medium">
              {data.cost && Number(data.cost) > 0 ? String(data.cost) : 'Not set'}
            </span>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Tags:</span>
            <div className="flex gap-1 flex-wrap">
              {data.tags && Array.isArray(data.tags) && data.tags.length > 0 ? (
                (data.tags as string[]).map((tag: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="font-medium text-gray-400">No tags</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNoteContent = () => {
    const data = contentItem.data as Record<string, unknown>;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {isEditing ? (
            <>
              <Input
                value={String(editedItem.data.title || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, title: e.target.value }
                }))}
                placeholder="Tytuł notatki"
                className="font-semibold text-lg"
              />
              <Textarea
                value={String(editedItem.data.content || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, content: e.target.value }
                }))}
                className="text-sm resize-none"
                rows={4}
                placeholder="Treść notatki"
              />
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg">{String(data.title)}</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{String(data.content)}</p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderShoppingContent = () => {
    const data = isEditing ? editedItem.data : contentItem.data;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {isEditing ? (
            <>
              <Input
                value={String(editedItem.data.name || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, name: e.target.value }
                }))}
                placeholder="Nazwa produktu"
                className="font-semibold text-lg"
              />
              <Textarea
                value={String(editedItem.data.notes || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, notes: e.target.value }
                }))}
                className="text-sm resize-none"
                rows={2}
                placeholder="Notatki o produkcie"
              />
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg">{String(data.name)}</h3>
              {Boolean(data.notes && String(data.notes)) && (
                <p className="text-sm text-gray-600">{String(data.notes)}</p>
              )}
            </>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24 flex items-center gap-1">
                <Package className="w-4 h-4" />
                Ilość:
              </label>
              <Input
                type="number"
                value={Number(editedItem.data.quantity || 1)}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, quantity: Number(e.target.value) }
                }))}
                className="flex-1"
                min="1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                Cena:
              </label>
              <Input
                type="number"
                value={Number(editedItem.data.unitPrice || 0)}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, unitPrice: Number(e.target.value) }
                }))}
                placeholder="0.00"
                className="flex-1"
                step="0.01"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24 flex items-center gap-1">
                <Home className="w-4 h-4" />
                Sekcja:
              </label>
              <Input
                value={String(editedItem.data.sectionName || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, sectionName: e.target.value }
                }))}
                placeholder="Łazienka"
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24 flex items-center gap-1">
                <Tag className="w-4 h-4" />
                Kategoria:
              </label>
              <Input
                value={String(editedItem.data.category || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, category: e.target.value }
                }))}
                placeholder="Armatura"
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24 flex items-center gap-1">
                <User className="w-4 h-4" />
                Dostawca:
              </label>
              <Input
                value={String(editedItem.data.supplier || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, supplier: e.target.value }
                }))}
                placeholder="Nazwa dostawcy"
                className="flex-1"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Ilość:</span>
              <span className="font-medium">{String(data.quantity)}</span>
            </div>

            {Boolean(data.unitPrice && String(data.unitPrice)) && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Cena:</span>
                <span className="font-medium">{String(data.unitPrice)} PLN</span>
              </div>
            )}

            {Boolean(data.sectionName && String(data.sectionName)) && (
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Sekcja:</span>
                <span className="font-medium">{String(data.sectionName)}</span>
              </div>
            )}

            {Boolean(data.category && String(data.category)) && (
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Kategoria:</span>
                <span className="font-medium">{String(data.category)}</span>
              </div>
            )}

            {Boolean(data.supplier && String(data.supplier)) && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Dostawca:</span>
                <span className="font-medium">{String(data.supplier)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Priorytet:</span>
          {isEditing ? (
            <Select
              value={String(editedItem.data.priority || 'medium')}
              onValueChange={(value) => setEditedItem(prev => ({
                ...prev,
                data: { ...prev.data, priority: value }
              }))}
            >
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            Boolean(data.priority && String(data.priority)) && (
              <Badge className={priorityColors[data.priority as keyof typeof priorityColors]}>
                Priorytet: {String(data.priority)}
              </Badge>
            )
          )}
        </div>
      </div>
    );
  };

  const renderSurveyContent = () => {
    const data = contentItem.data as Record<string, unknown>;

    // Provide fallback values for undefined data
    const title = data.title || 'Untitled Survey';
    const description = data.description || '';
    const isRequired = data.isRequired ?? false;
    const targetAudience = data.targetAudience || 'all_customers';

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {isEditing ? (
            <>
              <input
                type="text"
                value={String(editedItem.data.title || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, title: e.target.value }
                }))}
                className="w-full p-2 border rounded-md font-semibold text-lg"
                placeholder="Survey title"
              />
              <textarea
                value={String(editedItem.data.description || '')}
                onChange={(e) => setEditedItem(prev => ({
                  ...prev,
                  data: { ...prev.data, description: e.target.value }
                }))}
                className="w-full p-2 border rounded-md text-sm resize-none"
                rows={2}
                placeholder="Survey description"
              />
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg">{String(title)}</h3>
              {Boolean(description && String(description)) && (
                <p className="text-sm text-gray-600">{String(description)}</p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge variant={isRequired ? "default" : "outline"}>
            {isRequired ? "Required" : "Optional"}
          </Badge>
          <Badge variant="outline">
            Target: {targetAudience === 'all_customers' ? 'All customers' :
                     targetAudience === 'team_members' ? 'Team members' : 'Specific customers'}
          </Badge>
          {data.startDate && typeof data.startDate !== 'undefined' ? (
            <Badge variant="outline">
              Start: {new Date(String(data.startDate)).toLocaleDateString()}
            </Badge>
          ) : null}
          {data.endDate && typeof data.endDate !== 'undefined' ? (
            <Badge variant="outline">
              End: {new Date(String(data.endDate)).toLocaleDateString()}
            </Badge>
          ) : null}
        </div>

        {Boolean(data.questions && Array.isArray(data.questions) && data.questions.length > 0) && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm text-gray-700">Questions ({(data.questions as unknown[]).length}):</h4>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newQuestion = {
                      questionText: '',
                      questionType: 'text_short',
                      isRequired: true,
                      options: []
                    };
                    setEditedItem(prev => ({
                      ...prev,
                      data: {
                        ...prev.data,
                        questions: [...(prev.data.questions as SurveyQuestion[] || []), newQuestion]
                      }
                    }));
                  }}
                  className="text-xs h-6"
                >
                  + Add Question
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {(isEditing ? (editedItem.data.questions as SurveyQuestion[]) : (data.questions as SurveyQuestion[])).map((question: SurveyQuestion, index: number) => (
                <div key={index} className={`border rounded-lg p-3 ${isEditing ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 font-medium text-sm mt-1">{index + 1}.</span>
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={question?.questionText || ''}
                            onChange={(e) => {
                              const newQuestions = [...(editedItem.data.questions as SurveyQuestion[])];
                              newQuestions[index] = { ...question, questionText: e.target.value };
                              setEditedItem(prev => ({
                                ...prev,
                                data: { ...prev.data, questions: newQuestions }
                              }));
                            }}
                            placeholder="Question text"
                            className="w-full text-sm p-2 border rounded"
                          />
                          <div className="flex gap-2">
                            <select
                              value={(question as SurveyQuestion)?.questionType || 'text_short'}
                              onChange={(e) => {
                                const newQuestions = [...(editedItem.data.questions as SurveyQuestion[])];
                                newQuestions[index] = { ...question, questionType: e.target.value as SurveyQuestion['questionType'] };
                                setEditedItem(prev => ({
                                  ...prev,
                                  data: { ...prev.data, questions: newQuestions }
                                }));
                              }}
                              className="text-xs p-1 border rounded"
                            >
                              <option value="text_short">Short Text</option>
                              <option value="text_long">Long Text</option>
                              <option value="single_choice">Single Choice</option>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="rating">Rating</option>
                              <option value="yes_no">Yes/No</option>
                              <option value="number">Number</option>
                            </select>
                            <label className="flex items-center text-xs">
                              <input
                                type="checkbox"
                                checked={(question as SurveyQuestion)?.isRequired ?? true}
                                onChange={(e) => {
                                  const newQuestions = [...(editedItem.data.questions as SurveyQuestion[])];
                                  newQuestions[index] = { ...question, isRequired: e.target.checked };
                                  setEditedItem(prev => ({
                                    ...prev,
                                    data: { ...prev.data, questions: newQuestions }
                                  }));
                                }}
                                className="mr-1"
                              />
                              Required
                            </label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newQuestions = (editedItem.data.questions as SurveyQuestion[]).filter((_, i) => i !== index);
                                setEditedItem(prev => ({
                                  ...prev,
                                  data: { ...prev.data, questions: newQuestions }
                                }));
                              }}
                              className="text-xs h-6 px-2 text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                          {((question as SurveyQuestion)?.questionType === 'single_choice' || (question as SurveyQuestion)?.questionType === 'multiple_choice') && (
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Options (one per line):</p>
                              <textarea
                                value={((question as SurveyQuestion)?.options || []).join('\n')}
                                onChange={(e) => {
                                  const options = e.target.value.split('\n').filter(opt => opt.trim());
                                  const newQuestions = [...(editedItem.data.questions as SurveyQuestion[])];
                                  newQuestions[index] = { ...question, options };
                                  setEditedItem(prev => ({
                                    ...prev,
                                    data: { ...prev.data, questions: newQuestions }
                                  }));
                                }}
                                rows={3}
                                className="w-full text-xs p-2 border rounded resize-none"
                                placeholder="Option 1&#10;Option 2&#10;Option 3"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium">{(question as SurveyQuestion)?.questionText}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {(question as SurveyQuestion)?.questionType?.replace('_', ' ')}
                            </Badge>
                            {(question as SurveyQuestion)?.isRequired && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                          {(question as SurveyQuestion)?.options && (question as SurveyQuestion).options!.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-600 mb-1">Options:</p>
                              <ul className="text-xs text-gray-600 list-disc list-inside">
                                {((question as SurveyQuestion)?.options || []).map((option: string, optIndex: number) => (
                                  <li key={optIndex}>{option}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDeleteContent = () => {
    const data = contentItem.data as Record<string, unknown>;

    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white text-xs">
              🗑️
            </div>
            <span className="font-medium text-red-800">Delete: {typeLabels[contentItem.type]}</span>
          </div>
          <p className="text-sm text-red-700 mb-3">
            This action cannot be undone. The item will be permanently removed.
          </p>

          {/* Show basic item info */}
          <div className="bg-white rounded-md p-3 border border-red-200">
            <div className="text-sm">
              <strong>Item:</strong> {String(data.title || data.name || data.subject || data.companyName || 'Selected item')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContactContent = () => {
    const data = contentItem.data as Record<string, unknown>;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{String(data.name || 'Unnamed Contact')}</h3>
          {Boolean(data.companyName) && (
            <p className="text-sm text-gray-600">Company: {String(data.companyName)}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {Boolean(data.email) && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Email:</span>
              <span className="text-blue-600">{String(data.email)}</span>
            </div>
          )}
          {Boolean(data.phone) && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Phone:</span>
              <span>{String(data.phone)}</span>
            </div>
          )}
          {Boolean(data.type) && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Type:</span>
              <Badge variant="outline">{String(data.type)}</Badge>
            </div>
          )}
        </div>

        {Boolean(data.address) && (
          <div className="text-sm">
            <span className="font-medium">Address:</span>
            <p className="text-gray-600 mt-1">{String(data.address)}</p>
          </div>
        )}

        {Boolean(data.notes) && (
          <div className="text-sm">
            <span className="font-medium">Notes:</span>
            <p className="text-gray-600 mt-1">{String(data.notes)}</p>
          </div>
        )}
      </div>
    );
  };

  const renderBulkEditContent = () => {
    const data = contentItem.data as Record<string, unknown>;
    const updates = (contentItem.updates || data.updates || {}) as Record<string, unknown>;
    const selection = (contentItem.selection || data) as Record<string, unknown>;

    const taskIds = selection.taskIds as string[] | undefined;
    const applyToAll = Boolean(selection.applyToAll);
    const reason = (selection.reason || data.reason) as string | undefined;

  const fieldsChanged = Object.entries(updates)
    .filter(([key, value]) => key !== '_' && value !== undefined && value !== null && value !== '')
    .map(([field, value]) => ({ field, value }));

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
              📝
            </div>
            <span className="font-medium text-blue-800">
              Bulk Edit: {applyToAll ? 'All Tasks' : `${taskIds?.length ?? 0} Tasks`}
            </span>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            {reason || 'Apply the following changes to selected tasks:'}
          </p>

          <div className="bg-white rounded-md p-3 border border-blue-200">
            <div className="space-y-2 text-sm">
              {fieldsChanged.length === 0 && (
                <div>No changes provided.</div>
              )}
              {fieldsChanged.map(({ field, value }) => (
                <div key={field} className="capitalize">
                  <strong>{field.replace(/([A-Z])/g, ' $1').toLowerCase()}:</strong> →{' '}
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  let bodyContent: React.ReactNode;

  if (contentItem.operation === 'delete') {
    bodyContent = renderDeleteContent();
  } else if (contentItem.operation === 'bulk_edit') {
    bodyContent = renderBulkEditContent();
  } else if (contentItem.operation === 'bulk_create') {
    // For bulk_create, show summary - individual editing is done in grid
    const tasks = (contentItem.data.tasks as Array<Record<string, unknown>>) || [];
    bodyContent = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Creating {tasks.length} tasks. Use the grid view to review and edit individual tasks.
        </p>
        <div className="text-sm">
          <strong>Tasks preview:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            {tasks.slice(0, 5).map((task, i) => (
              <li key={i}>{String(task.title || 'Untitled')}</li>
            ))}
            {tasks.length > 5 && <li className="text-muted-foreground">...and {tasks.length - 5} more</li>}
          </ul>
        </div>
      </div>
    );
  } else {
    switch (contentItem.type) {
      case 'task':
        bodyContent = renderTaskContent();
        break;
      case 'note':
        bodyContent = renderNoteContent();
        break;
      case 'shopping':
        bodyContent = renderShoppingContent();
        break;
      case 'survey':
        bodyContent = renderSurveyContent();
        break;
      case 'contact':
        bodyContent = renderContactContent();
        break;
      case 'shoppingSection':
        // Render shopping section details
        bodyContent = (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">{String(contentItem.data.name || 'Unnamed Section')}</h3>
              <p className="text-sm text-gray-600">
                Shopping list section for organizing items.
              </p>
            </div>
          </div>
        );
        break;
      default:
        throw new Error(`Unknown content type: ${contentItem.type ?? 'undefined'}`);
    }
  }

  const operationLabel = (() => {
    switch (contentItem.operation) {
      case 'edit':
        return 'Confirm Edit';
      case 'delete':
        return 'Confirm Deletion';
      case 'bulk_edit':
        return 'Confirm Bulk Edit';
      case 'bulk_create':
        const tasks = (contentItem.data.tasks as Array<Record<string, unknown>>) || [];
        return `Confirm Creation (${tasks.length} items)`;
      case 'create':
      default:
        return 'Confirm Creation';
    }
  })();

  const targetLabel = contentItem.operation === 'bulk_edit' || contentItem.operation === 'bulk_create'
    ? 'tasks'
    : typeLabels[contentItem.type as keyof typeof typeLabels] ?? 'item';

  const actionVerb = (() => {
    switch (contentItem.operation) {
      case 'edit':
        return 'edit';
      case 'delete':
        return 'delete';
      case 'bulk_edit':
        return 'bulk edit';
      case 'bulk_create':
        return 'create';
      case 'create':
      default:
        return 'create';
    }
  })();

  const descriptionSuffix = contentItem.operation === 'delete'
    ? 'Are you sure you want to delete this item?'
    : `Review details and confirm${contentItem.operation !== 'edit' ? ', edit' : ''} or cancel.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              contentItem.operation === 'delete' ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {contentItem.operation === 'edit' ? '✏️' :
               contentItem.operation === 'delete' ? '🗑️' : typeIcons[contentItem.type]}
            </div>
            {operationLabel}: {targetLabel}
            {totalItems > 1 && ` (${itemNumber}/${totalItems})`}
          </DialogTitle>
          <DialogDescription>
            AI wants to {actionVerb}{' '}
            {contentItem.operation === 'bulk_edit'
              ? 'multiple tasks'
              : `a ${typeLabels[contentItem.type]}`}.
            {descriptionSuffix}
            {totalItems > 1 && ` ${totalItems - itemNumber + 1} items remaining to review.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {bodyContent}
        </div>

        <DialogFooter className="gap-2 flex-shrink-0 pt-4 border-t">
          <Button
            variant="outline"
            onClick={contentItem.operation === 'delete' ? onCancel : isEditing ? handleCancelEdit : onCancel}
            disabled={isLoading}
          >
            {contentItem.operation === 'delete'
              ? "Cancel"
              : isEditing
                ? "Cancel editing"
                : "Reject"}
          </Button>

          {!isEditing && contentItem.operation !== 'delete' && contentItem.operation !== 'bulk_edit' && contentItem.operation !== 'bulk_create' && (
            <Button
              variant="outline"
              onClick={handleStartEditing}
              disabled={isLoading}
              className="gap-2"
            >
              ✏️ Edit details
            </Button>
          )}

          {isEditing ? (
            <Button
              onClick={handleSaveEdit}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              💾 Save Changes
            </Button>
          ) : contentItem.operation === 'delete' ? (
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? "Deleting..." : `🗑️ Delete ${typeLabels[contentItem.type]}`}
            </Button>
          ) : contentItem.operation === 'edit' ? (
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Updating..." : "✅ Update " + (typeLabels[contentItem.type as keyof typeof typeLabels] ?? 'item')}
            </Button>
          ) : contentItem.operation === 'create' ? (
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Creating..." : `✅ Create ${typeLabels[contentItem.type as keyof typeof typeLabels]}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
