import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  CheckSquare, 
  FileText, 
  ShoppingCart, 
  MessageSquare, 
  Plus,
  X,
  Check
} from "lucide-react";

interface PendingTask {
  type: 'task' | 'note' | 'shopping' | 'survey';
  operation?: 'create' | 'edit';
  data: Record<string, unknown>;
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
      default: return <Plus className="h-4 w-4" />;
    }
  };

  const getItemTitle = (item: PendingTask): string => {
    switch (item.type) {
      case 'task': return typeof item.data.title === 'string' ? item.data.title : 'Untitled Task';
      case 'note': return typeof item.data.title === 'string' ? item.data.title : 'Untitled Note';
      case 'shopping': return typeof item.data.name === 'string' ? item.data.name : 'Untitled Item';
      case 'survey': return typeof item.data.title === 'string' ? item.data.title : 'Untitled Survey';
      default: return 'Unknown Item';
    }
  };

  const getItemDescription = (item: PendingTask): string => {
    switch (item.type) {
      case 'task': 
        return [
          typeof item.data.description === 'string' ? item.data.description : '',
          item.data.priority && `Priority: ${item.data.priority}`,
          item.data.assignedToName && `Assigned to: ${item.data.assignedToName}`,
          item.data.dueDate && typeof item.data.dueDate === 'number' && `Due: ${new Date(item.data.dueDate).toLocaleDateString()}`
        ].filter(Boolean).join(' • ');
      case 'note': 
        return typeof item.data.content === 'string' ? 
          item.data.content.substring(0, 100) + (item.data.content.length > 100 ? '...' : '') : 
          '';
      case 'shopping': 
        return [
          `Quantity: ${item.data.quantity}`,
          item.data.category && `Category: ${item.data.category}`,
          item.data.supplier && `Supplier: ${item.data.supplier}`
        ].filter(Boolean).join(' • ');
      case 'survey':
        return (typeof item.data.description === 'string' ? item.data.description : '') || 
               `Target: ${item.data.targetAudience || 'Unknown'}`;
      default: 
        return '';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-100 text-blue-700';
      case 'note': return 'bg-green-100 text-green-700';
      case 'shopping': return 'bg-purple-100 text-purple-700';
      case 'survey': return 'bg-orange-100 text-orange-700';
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
            {getItemIcon(item.type)}
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