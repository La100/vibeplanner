"use client";

import { useState, useEffect } from "react";
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
import { Calendar, User, DollarSign, Tag, Package, Home } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProject } from '@/components/providers/ProjectProvider';

interface SurveyQuestion {
  questionText: string;
  questionType: 'text_short' | 'text_long' | 'single_choice' | 'multiple_choice' | 'rating' | 'yes_no' | 'number';
  isRequired: boolean;
  options?: string[];
}

interface ContentItem {
  type: 'task' | 'note' | 'shopping' | 'survey' | 'contact';
  data: Record<string, unknown>;
  operation?: 'create' | 'edit' | 'delete';
  originalItem?: Record<string, unknown>;
  updates?: Record<string, unknown>;
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
  contact: "👤"
};

const typeLabels = {
  task: "task",
  note: "note",
  shopping: "shopping item",
  survey: "survey",
  contact: "contact"
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

  // Update editedItem when contentItem changes (new item in sequence)
  useEffect(() => {
    setEditedItem(contentItem);
    setIsEditing(false);
  }, [contentItem]);

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

  const handleSaveEdit = () => {
    onEdit(editedItem);
    setIsEditing(false);
  };

  const renderTaskContent = () => {
    const data = contentItem.data as Record<string, unknown>;
    return (
      <div className="space-y-4">
        {/* Title and Description */}
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
                placeholder="Task title"
              />
              <textarea
                value={String(editedItem.data.description || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, description: e.target.value }
                }))}
                className="w-full p-2 border rounded-md text-sm resize-none"
                rows={2}
                placeholder="Task description"
              />
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg">{String(data.title)}</h3>
              {Boolean(data.description && String(data.description)) && (
                <p className="text-sm text-gray-600">{String(data.description)}</p>
              )}
            </>
          )}
        </div>

        {/* Status and Priority */}
        <div className="flex gap-2 flex-wrap">
          {isEditing ? (
            <>
              <select
                value={String(editedItem.data.priority || 'medium')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, priority: e.target.value }
                }))}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
              <select
                value={String(editedItem.data.status || 'todo')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, status: e.target.value }
                }))}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="todo">📝 To Do</option>
                <option value="in_progress">⚡ In Progress</option>
                <option value="review">👀 Review</option>
                <option value="done">✅ Done</option>
              </select>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Details */}
        <div className="space-y-3 border-t pt-3">
          {/* Due Date */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Due Date:</span>
            {isEditing ? (
              <input
                type="date"
                value={String(editedItem.data.dueDate || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, dueDate: e.target.value }
                }))}
                className="px-2 py-1 border rounded-md text-sm"
              />
            ) : (
              <span className="font-medium">
                {data.dueDate ? formatDate(String(data.dueDate)) : 'Not set'}
              </span>
            )}
          </div>

          {/* Assigned To */}
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Assigned To:</span>
            {isEditing ? (
              <select
                value={String(editedItem.data.assignedTo || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, assignedTo: e.target.value || null }
                }))}
                className="px-2 py-1 border rounded-md text-sm"
              >
                <option value="">Not assigned</option>
                {teamMembers?.map((member, index) => (
                  <option key={`${member.clerkUserId}-${index}`} value={member.clerkUserId}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium">
                {data.assignedTo ? 
                  teamMembers?.find(m => m.clerkUserId === data.assignedTo)?.name || 
                  teamMembers?.find(m => m.clerkUserId === data.assignedTo)?.email || 
                  String(data.assignedTo)
                  : 'Not assigned'}
              </span>
            )}
          </div>

          {/* Cost */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Cost:</span>
            {isEditing ? (
              <input
                type="number"
                value={Number(editedItem.data.cost || 0)}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, cost: parseFloat(e.target.value) || 0 }
                }))}
                className="px-2 py-1 border rounded-md text-sm"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            ) : (
              <span className="font-medium">
                {data.cost && Number(data.cost) > 0 ? String(data.cost) : 'Not set'}
              </span>
            )}
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 text-sm">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Tags:</span>
            {isEditing ? (
              <input
                type="text"
                value={(editedItem.data.tags as string[] || []).join(', ')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) }
                }))}
                className="px-2 py-1 border rounded-md text-sm flex-1"
                placeholder="tag1, tag2, tag3"
              />
            ) : (
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
            )}
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
              <input
                type="text"
                value={String(editedItem.data.title || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, title: e.target.value }
                }))}
                className="w-full p-2 border rounded-md font-semibold text-lg"
                placeholder="Tytuł notatki"
              />
              <textarea
                value={String(editedItem.data.content || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, content: e.target.value }
                }))}
                className="w-full p-2 border rounded-md text-sm resize-none"
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
    const data = contentItem.data as Record<string, unknown>;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {isEditing ? (
            <>
              <input
                type="text"
                value={String(editedItem.data.name || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, name: e.target.value }
                }))}
                className="w-full p-2 border rounded-md font-semibold text-lg"
                placeholder="Nazwa produktu"
              />
              <textarea
                value={String(editedItem.data.notes || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, notes: e.target.value }
                }))}
                className="w-full p-2 border rounded-md text-sm resize-none"
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

        {Boolean(data.priority && String(data.priority)) && (
          <Badge className={priorityColors[data.priority as keyof typeof priorityColors]}>
            Priorytet: {String(data.priority)}
          </Badge>
        )}
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

  const renderContent = () => {
    // For edit operations, show original data with changes highlighted
    const isEditing = contentItem.operation === 'edit';
    const isDeleting = contentItem.operation === 'delete';

    if (isEditing) {
      return renderEditContent();
    }

    if (isDeleting) {
      return renderDeleteContent();
    }

    switch (contentItem.type) {
      case 'task': return renderTaskContent();
      case 'note': return renderNoteContent();
      case 'shopping': return renderShoppingContent();
      case 'survey': return renderSurveyContent();
      case 'contact': return renderContactContent();
      default: return <div>Unknown content type</div>;
    }
  };

  const renderEditContent = () => {
    const original = contentItem.originalItem || {};
    const updates = contentItem.updates || {};
    
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs">
              ✏️
            </div>
            <span className="font-medium text-blue-800">Edycja: {String(original?.title || original?.name || 'Element')}</span>
          </div>
          <p className="text-sm text-blue-700">
            Sprawdź zmiany poniżej i potwierdź edycję.
          </p>
        </div>

        {/* Show changes */}
        <div className="space-y-3">
          {Object.entries(updates).map(([key, newValue]) => {
            const oldValue = original?.[key];
            
            if (newValue === oldValue || newValue === undefined) return null;
            
            return (
              <div key={key} className="border rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-1 capitalize">
                  {key === 'dueDate' ? 'Termin' : 
                   key === 'assignedTo' ? 'Przypisane do' :
                   key === 'unitPrice' ? 'Cena jednostkowa' :
                   key === 'targetAudience' ? 'Grupa docelowa' :
                   key}:
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded flex-1">
                    <span className="font-medium">Było:</span> {
                      Array.isArray(oldValue) ? (oldValue as string[]).join(', ') : 
                      String(oldValue || 'brak')
                    }
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded flex-1">
                    <span className="font-medium">Będzie:</span> {
                      Array.isArray(newValue) ? (newValue as string[]).join(', ') : 
                      String(newValue || 'brak')
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
            {contentItem.operation === 'edit' ? 'Confirm Edit' :
             contentItem.operation === 'delete' ? 'Confirm Deletion' : 'Confirm Creation'}: {typeLabels[contentItem.type]} {totalItems > 1 && `(${itemNumber}/${totalItems})`}
          </DialogTitle>
          <DialogDescription>
            AI wants to {contentItem.operation === 'edit' ? 'edit' :
                         contentItem.operation === 'delete' ? 'delete' : 'create'} a {typeLabels[contentItem.type]}.
            {contentItem.operation === 'delete' ? 'Are you sure you want to delete this item?' :
             `Review details and confirm${contentItem.operation !== 'edit' && ', edit'} or cancel.`}
            {totalItems > 1 && ` ${totalItems - itemNumber + 1} items remaining to review.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {renderContent()}
        </div>

        <DialogFooter className="gap-2 flex-shrink-0 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            {contentItem.operation === 'delete' ? "Cancel" : isEditing ? "Cancel" : "Reject"}
          </Button>

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
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                ✏️ Edit
              </Button>
              <Button
                onClick={onConfirm}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? "Creating..." : `✅ Create ${typeLabels[contentItem.type]}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
