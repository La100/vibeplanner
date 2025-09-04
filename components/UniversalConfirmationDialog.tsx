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

interface ContentItem {
  type: 'task' | 'note' | 'shopping' | 'survey';
  data: Record<string, unknown>;
  operation?: 'create' | 'edit';
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
  survey: "📊"
};

const typeLabels = {
  task: "zadanie",
  note: "notatkę",
  shopping: "element listy zakupów",
  survey: "ankietę"
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
                placeholder="Tytuł zadania"
              />
              <textarea
                value={String(editedItem.data.description || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, description: e.target.value }
                }))}
                className="w-full p-2 border rounded-md text-sm resize-none"
                rows={2}
                placeholder="Opis zadania"
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
                <option value="low">🟢 Niski</option>
                <option value="medium">🟡 Średni</option>
                <option value="high">🟠 Wysoki</option>
                <option value="urgent">🔴 Pilny</option>
              </select>
              <select
                value={String(editedItem.data.status || 'todo')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, status: e.target.value }
                }))}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="todo">📝 Do zrobienia</option>
                <option value="in_progress">⚡ W trakcie</option>
                <option value="review">👀 Do przeglądu</option>
                <option value="done">✅ Gotowe</option>
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
          {Boolean(data.dueDate && String(data.dueDate)) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Termin:</span>
              <span className="font-medium">{formatDate(String(data.dueDate))}</span>
            </div>
          )}

          {Boolean(data.assignedTo && String(data.assignedTo)) && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Przypisane do:</span>
              <span className="font-medium">{String(data.assignedTo)}</span>
            </div>
          )}

          {Boolean(data.cost && Number(data.cost) > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Koszt:</span>
              <span className="font-medium">{String(data.cost)} PLN</span>
            </div>
          )}

          {Boolean(data.tags && Array.isArray(data.tags) && data.tags.length > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <Tag className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Tagi:</span>
              <div className="flex gap-1 flex-wrap">
                {(data.tags as string[]).map((tag: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
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
                placeholder="Tytuł ankiety"
              />
              <textarea
                value={String(editedItem.data.description || '')}
                onChange={(e) => setEditedItem(prev => ({ 
                  ...prev, 
                  data: { ...prev.data, description: e.target.value }
                }))}
                className="w-full p-2 border rounded-md text-sm resize-none"
                rows={2}
                placeholder="Opis ankiety"
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

        <div className="flex gap-2 flex-wrap">
          <Badge variant={data.isRequired ? "default" : "outline"}>
            {data.isRequired ? "Wymagana" : "Opcjonalna"}
          </Badge>
          <Badge variant="outline">
            Grupa docelowa: {data.targetAudience === 'all_customers' ? 'Wszyscy klienci' : 
                              data.targetAudience === 'team_members' ? 'Zespół' : 'Wybrani klienci'}
          </Badge>
        </div>

        {Boolean(data.questions && Array.isArray(data.questions) && data.questions.length > 0) && (
          <div className="border-t pt-3">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Pytania ({(data.questions as string[]).length}):</h4>
            <div className="space-y-2">
              {(data.questions as string[]).map((question: string, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500 font-medium">{index + 1}.</span>
                  <span>{question}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // For edit operations, show original data with changes highlighted
    const isEditing = contentItem.operation === 'edit';
    
    if (isEditing) {
      return renderEditContent();
    }
    
    switch (contentItem.type) {
      case 'task': return renderTaskContent();
      case 'note': return renderNoteContent();
      case 'shopping': return renderShoppingContent();
      case 'survey': return renderSurveyContent();
      default: return <div>Nieznany typ zawartości</div>;
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              {contentItem.operation === 'edit' ? '✏️' : typeIcons[contentItem.type]}
            </div>
            {contentItem.operation === 'edit' ? 'Potwierdź edycję' : 'Potwierdź utworzenie'}: {typeLabels[contentItem.type]} {totalItems > 1 && `(${itemNumber}/${totalItems})`}
          </DialogTitle>
          <DialogDescription>
            AI chce {contentItem.operation === 'edit' ? 'edytować' : 'utworzyć'} {typeLabels[contentItem.type]}. Sprawdź szczegóły i potwierdź{contentItem.operation !== 'edit' && ', edytuj'} lub odrzuć.
            {totalItems > 1 && ` Zostało ${totalItems - itemNumber + 1} elementów do przejrzenia.`}
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isLoading}
          >
            {isEditing ? "Anuluj" : "Odrzuć"}
          </Button>
          
          {isEditing ? (
            <Button 
              onClick={handleSaveEdit}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              💾 Zapisz zmiany
            </Button>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                ✏️ Edytuj
              </Button>
              <Button 
                onClick={onConfirm}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 
                  (contentItem.operation === 'edit' ? "Zapisuję..." : "Tworzę...") : 
                  (contentItem.operation === 'edit' ? `✏️ Zapisz zmiany` : `✅ Utwórz ${typeLabels[contentItem.type]}`)
                }
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
