import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CheckSquare,
  FileText,
  ShoppingCart,
  MessageSquare,
  User,
  Plus,
  X,
  Check
} from "lucide-react";

interface PendingTask {
  type: 'task' | 'note' | 'shopping' | 'survey' | 'contact' | 'shoppingSection';
  operation?: 'create' | 'edit' | 'delete' | 'bulk_edit' | 'bulk_create';
  data: Record<string, unknown>;
  updates?: Record<string, unknown>;
  originalItem?: Record<string, unknown>;
  selection?: Record<string, unknown>;
  titleChanges?: Array<{
    id?: string;
    currentTitle?: string;
    originalTitle?: string;
    newTitle: string;
  }>;
  display?: {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    details?: React.ReactNode;
    diff?: React.ReactNode;
    footer?: React.ReactNode;
  };
}

interface ItemPreviewCardProps {
  item: PendingTask;
  index: number;
  onConfirm: (index: number) => void;
  onReject: (index: number) => void;
  onEdit?: (index: number) => void;
}

export const ItemPreviewCard = ({ item, index, onConfirm, onReject, onEdit }: ItemPreviewCardProps) => {
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      case 'shopping': return <ShoppingCart className="h-4 w-4" />;
      case 'survey': return <MessageSquare className="h-4 w-4" />;
      case 'contact': return <User className="h-4 w-4" />;
      case 'shoppingSection': return <ShoppingCart className="h-4 w-4" />;
      default: return <Plus className="h-4 w-4" />;
    }
  };

  const getItemTitle = (item: PendingTask): string => {
    if (item.display) {
      return item.display.title;
    }
    switch (item.type) {
      case 'task':
        if (item.operation === 'bulk_edit') {
          const changes = item.titleChanges || (Array.isArray(item.data.titleChanges) ? item.data.titleChanges as PendingTask['titleChanges'] : []);
          const firstChange = changes?.[0];
          if (firstChange) {
            const fromTitle = firstChange.originalTitle || firstChange.currentTitle || 'Task';
            const toTitle = firstChange.newTitle;
            const extra = changes && changes.length > 1 ? ` (+${changes.length - 1} more)` : '';
            return `Update ${fromTitle} → ${toTitle}${extra}`;
          }
          if (Array.isArray(item.selection?.taskIds)) {
            const count = (item.selection?.taskIds as string[]).length;
            return `Update ${count} tasks`;
          }
          return 'Bulk edit tasks';
        }
        if (item.operation === 'bulk_create') {
          const tasks = (item.data.tasks as Array<Record<string, unknown>>) || [];
          return `Create ${tasks.length} tasks`;
        }
        if (item.operation === 'delete') {
          if (typeof item.data.title === 'string' && item.data.title) {
            return item.data.title as string;
          }
          if (typeof item.data.currentTitle === 'string' && item.data.currentTitle) {
            return item.data.currentTitle as string;
          }
          if (typeof item.data.reason === 'string' && item.data.reason) {
            return item.data.reason as string;
          }
          return 'Task deletion';
        }
        if (item.operation === 'edit') {
          // For edit operations, check updates first, then originalItem, then data
          const title = (item.updates?.title as string) ||
                       (item.originalItem?.title as string) ||
                       (item.data.title as string);
          return title || 'Untitled Task';
        }
        return typeof item.data.title === 'string' ? item.data.title : 'Untitled Task';
      case 'note':
        if (item.operation === 'edit') {
          // For edit operations, check updates first, then originalItem, then data
          const noteTitle = (item.updates?.title as string) ||
                           (item.originalItem?.title as string) ||
                           (item.data.title as string);
          return noteTitle || 'Untitled Note';
        }
        return typeof item.data.title === 'string' ? item.data.title : 'Untitled Note';
      case 'shopping':
        if (item.operation === 'edit') {
          const shoppingName = (item.updates?.name as string) ||
                              (item.originalItem?.name as string) ||
                              (item.data.name as string);
          return shoppingName || 'Untitled Item';
        }
        return typeof item.data.name === 'string' ? item.data.name : 'Untitled Item';
      case 'survey':
        if (item.operation === 'edit') {
          const surveyTitle = (item.updates?.title as string) ||
                             (item.originalItem?.title as string) ||
                             (item.data.title as string);
          return surveyTitle || 'Untitled Survey';
        }
        return typeof item.data.title === 'string' ? item.data.title : 'Untitled Survey';
      case 'contact': return typeof item.data.name === 'string' ? item.data.name : 'Untitled Contact';
      case 'shoppingSection': return typeof item.data.name === 'string' ? item.data.name : 'Untitled Section';
      default: return 'Unknown Item';
    }
  };

  const getItemDescription = (item: PendingTask): string => {
    if (item.display && item.display.description) {
      return item.display.description;
    }
    switch (item.type) {
      case 'task':
        if (item.operation === 'bulk_create') {
          const tasks = (item.data.tasks as Array<Record<string, unknown>>) || [];
          const previews = tasks.slice(0, 3).map(t => t.title || 'Untitled').join(', ');
          return tasks.length > 3 ? `${previews} and ${tasks.length - 3} more...` : previews;
        }
        if (item.operation === 'bulk_edit') {
          if (typeof item.data.previousTitle === 'string' && typeof item.data.title === 'string') {
            return `${item.data.previousTitle} → ${item.data.title}`;
          }

          const changes = item.titleChanges || (Array.isArray(item.data.titleChanges) ? item.data.titleChanges as PendingTask['titleChanges'] : []);
          if (changes && changes.length > 0) {
            const visible = changes.slice(0, 3)
              .map(change => {
                const fromTitle = change.originalTitle || change.currentTitle || 'Task';
                return `${fromTitle} → ${change.newTitle}`;
              });
            const remaining = Math.max(changes.length - visible.length, 0);
            return [
              ...visible,
              remaining > 0 ? `+${remaining} more changes` : null
            ].filter(Boolean).join(' • ');
          }
          const targetLabel = item.data.applyToAll
            ? 'Applies to all tasks'
            : `${Array.isArray(item.selection?.taskIds) ? (item.selection?.taskIds as string[]).length : 0} selected tasks`;
          return targetLabel;
        }
        if (item.operation === 'delete') {
          const parts: string[] = [];
          if (typeof item.data.currentTitle === 'string' && item.data.currentTitle) {
            parts.push(`Current title: ${item.data.currentTitle}`);
          }
          if (Array.isArray(item.selection?.keepTaskTitles) && item.selection.keepTaskTitles.length > 0) {
            parts.push(`Keeping: ${(item.selection.keepTaskTitles as string[]).slice(0, 3).join(', ')}`);
          }
          return parts.join(' • ');
        }
        if (item.operation === 'edit') {
          // For edit operations, show what's being changed
          const changes: string[] = [];
          if (item.updates?.title && item.originalItem?.title && item.updates.title !== item.originalItem.title) {
            changes.push(`Title: ${item.originalItem.title} → ${item.updates.title}`);
          }
          if (item.updates?.assignedToName) {
            changes.push(`Assigned to: ${item.updates.assignedToName}`);
          }
          if (item.updates?.priority) {
            changes.push(`Priority: ${item.updates.priority}`);
          }
          if (item.updates?.status) {
            changes.push(`Status: ${item.updates.status}`);
          }
          if (changes.length > 0) {
            return changes.join(' • ');
          }
          // Fallback to showing current values from originalItem or data
          const description = (item.originalItem?.description as string) || (item.data.description as string) || '';
          const priority = (item.originalItem?.priority as string) || (item.data.priority as string);
          const assignedTo = (item.updates?.assignedToName as string) || (item.originalItem?.assignedToName as string) || (item.data.assignedToName as string);
          return [
            description,
            priority && `Priority: ${priority}`,
            assignedTo && `Assigned to: ${assignedTo}`
          ].filter(Boolean).join(' • ');
        }
        return [
          typeof item.data.description === 'string' ? item.data.description : '',
          item.data.priority && `Priority: ${item.data.priority}`,
          item.data.assignedToName && `Assigned to: ${item.data.assignedToName}`,
          item.data.dueDate && typeof item.data.dueDate === 'number' && `Due: ${new Date(item.data.dueDate).toLocaleDateString()}`
        ].filter(Boolean).join(' • ');
      case 'note':
        if (item.operation === 'edit') {
          // For edit operations, show what's being changed
          const changes: string[] = [];
          if (item.updates?.title && item.originalItem?.title && item.updates.title !== item.originalItem.title) {
            changes.push(`Title: ${item.originalItem.title} → ${item.updates.title}`);
          }
          if (item.updates?.content) {
            const preview = (item.updates.content as string).substring(0, 60);
            changes.push(`Content: ${preview}${(item.updates.content as string).length > 60 ? '...' : ''}`);
          }
          if (changes.length > 0) {
            return changes.join(' • ');
          }
          // Fallback to showing current content
          const content = (item.originalItem?.content as string) || (item.data.content as string) || '';
          return content.substring(0, 100) + (content.length > 100 ? '...' : '');
        }
        return typeof item.data.content === 'string' ?
          item.data.content.substring(0, 100) + (item.data.content.length > 100 ? '...' : '') :
          '';
      case 'shopping':
        if (item.operation === 'edit') {
          const changes: string[] = [];
          if (item.updates?.name && item.originalItem?.name && item.updates.name !== item.originalItem.name) {
            changes.push(`Name: ${item.originalItem.name} → ${item.updates.name}`);
          }
          if (item.updates?.quantity !== undefined) {
            changes.push(`Quantity: ${item.updates.quantity}`);
          }
          if (item.updates?.priority) {
            changes.push(`Priority: ${item.updates.priority}`);
          }
          if (changes.length > 0) {
            return changes.join(' • ');
          }
          const quantity = (item.originalItem?.quantity as number) || (item.data.quantity as number) || 1;
          const category = (item.originalItem?.category as string) || (item.data.category as string);
          const supplier = (item.originalItem?.supplier as string) || (item.data.supplier as string);
          return [
            `Quantity: ${quantity}`,
            category && `Category: ${category}`,
            supplier && `Supplier: ${supplier}`
          ].filter(Boolean).join(' • ');
        }
        return [
          `Quantity: ${item.data.quantity}`,
          item.data.category && `Category: ${item.data.category}`,
          item.data.supplier && `Supplier: ${item.data.supplier}`
        ].filter(Boolean).join(' • ');
      case 'survey':
        if (item.operation === 'edit') {
          const changes: string[] = [];
          if (item.updates?.title && item.originalItem?.title && item.updates.title !== item.originalItem.title) {
            changes.push(`Title: ${item.originalItem.title} → ${item.updates.title}`);
          }
          if (item.updates?.description) {
            const preview = (item.updates.description as string).substring(0, 60);
            changes.push(`Description: ${preview}${(item.updates.description as string).length > 60 ? '...' : ''}`);
          }
          if (changes.length > 0) {
            return changes.join(' • ');
          }
          const description = (item.originalItem?.description as string) || (item.data.description as string) || '';
          return description || `Target: ${item.data.targetAudience || 'Unknown'}`;
        }
        return (typeof item.data.description === 'string' ? item.data.description : '') ||
               `Target: ${item.data.targetAudience || 'Unknown'}`;
      case 'contact':
        return [
          item.data.email && `Email: ${item.data.email}`,
          item.data.phone && `Phone: ${item.data.phone}`,
          item.data.role && `Role: ${item.data.role}`
        ].filter(Boolean).join(' • ');
      case 'shoppingSection':
        return item.operation === 'delete'
          ? 'Section will be removed; items stay unsectioned'
          : 'Shopping list section for organizing items';
      default:
        return '';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task':
        return item.operation === 'bulk_edit'
          ? 'bg-blue-600 text-white'
          : 'bg-blue-100 text-blue-700';
      case 'note': return 'bg-green-100 text-green-700';
      case 'shopping': return 'bg-purple-100 text-purple-700';
      case 'survey': return 'bg-orange-100 text-orange-700';
      case 'contact': return 'bg-indigo-100 text-indigo-700';
      case 'shoppingSection': return 'bg-purple-200 text-purple-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive' as const;
      case 'high': return 'destructive' as const;
      case 'medium': return 'default' as const;
      case 'low': return 'secondary' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <Card className="relative group hover:shadow-md transition-all duration-200 hover:scale-[1.02] h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${getTypeColor(item.type)}`}>
            {item.display?.icon || getItemIcon(item.type)}
          </div>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {item.operation || 'create'} {item.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col">
        <h4 className="font-medium text-base mb-3 line-clamp-2 min-h-[3rem]">
          {getItemTitle(item)}
        </h4>
        
        <p className="text-sm text-muted-foreground line-clamp-4 mb-4 min-h-[4rem] leading-relaxed">
          {getItemDescription(item)}
        </p>

        {/* Tags/Priority indicators */}
        <div className="flex flex-wrap gap-2 mb-4 flex-grow">
          {Array.isArray(item.data.tags) && item.data.tags.slice(0, 2).map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-sm px-2 py-1">
              {tag}
            </Badge>
          ))}
          {typeof item.data.priority === 'string' && (
            <Badge 
              variant={getPriorityVariant(item.data.priority)} 
              className="text-sm px-2 py-1"
            >
              {item.data.priority}
            </Badge>
          )}
        </div>

        {/* Action buttons - always at bottom */}
        <div className="flex gap-2 mt-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReject(index)}
            className="flex-1 text-sm h-9 text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline" 
            onClick={() => onEdit?.(index)}
            className="flex-1 text-sm h-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
          >
            ✏️ Edit
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(index)}
            className="flex-1 text-sm h-9 bg-green-600 hover:bg-green-700 font-medium"
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};