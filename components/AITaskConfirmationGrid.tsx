import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemPreviewCard } from "./ItemPreviewCard";
import { Loader2 } from "lucide-react";

interface PendingTask {
  type: 'task' | 'note' | 'shopping' | 'survey';
  operation?: 'create' | 'edit';
  data: Record<string, unknown>;
}

interface AITaskConfirmationGridProps {
  pendingItems: PendingTask[];
  onConfirmAll: () => Promise<void>;
  onConfirmItem: (index: number) => Promise<void>;
  onRejectItem: (index: number) => void;
  onRejectAll: () => void;
  onEditItem?: (index: number) => void;
  isProcessing?: boolean;
}

export const AITaskConfirmationGrid = ({
  pendingItems,
  onConfirmAll,
  onConfirmItem,
  onRejectItem,
  onRejectAll,
  onEditItem,
  isProcessing = false
}: AITaskConfirmationGridProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set());
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(pendingItems.length / itemsPerPage);
  const currentItems = pendingItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const handleConfirmItem = async (index: number) => {
    setProcessingItems(prev => new Set([...prev, index]));
    try {
      await onConfirmItem(index);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const getItemTypeCounts = () => {
    const counts = pendingItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');
  };

  if (pendingItems.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            AI wants to create {pendingItems.length} items
          </h3>
          <p className="text-sm text-muted-foreground">
            {getItemTypeCounts()} • Review and confirm the items below
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onRejectAll}
            disabled={isProcessing}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Reject All
          </Button>
          <Button 
            onClick={onConfirmAll}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept All ({pendingItems.length})
          </Button>
        </div>
      </div>

      {/* Progress indicator during bulk processing */}
      {isProcessing && (
        <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing items...</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: "60%" }}></div>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-6 bg-gray-50/50 rounded-lg border">
        {currentItems.map((item, index) => {
          const actualIndex = currentPage * itemsPerPage + index;
          const isItemProcessing = processingItems.has(actualIndex);
          
          return (
            <div key={actualIndex} className="relative">
              {isItemProcessing && (
                <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}
              <ItemPreviewCard
                item={item}
                index={actualIndex}
                onConfirm={handleConfirmItem}
                onReject={onRejectItem}
                onEdit={onEditItem}
              />
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0 || isProcessing}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            Previous
          </Button>
          
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages - 1 || isProcessing}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Footer stats */}
      <div className="text-center text-xs text-muted-foreground pt-2 border-t">
        Showing {currentItems.length} of {pendingItems.length} items
        {totalPages > 1 && ` • ${itemsPerPage} items per page`}
      </div>
    </div>
  );
};