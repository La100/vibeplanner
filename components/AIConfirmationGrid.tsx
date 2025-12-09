import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ItemPreviewCard } from "@/components/ItemPreviewCard";

export type PendingContentType =
  | "task"
  | "note"
  | "shopping"
  | "shoppingSection"
  | "survey"
  | "contact"
  | "create_task"
  | "create_note"
  | "create_shopping_item"
  | "create_survey"
  | "create_contact"
  | "create_multiple_tasks"
  | "create_multiple_notes"
  | "create_multiple_shopping_items"
  | "create_multiple_surveys";

export type PendingOperation =
  | "create"
  | "edit"
  | "delete"
  | "bulk_edit"
  | "bulk_create";

export interface PendingDisplay {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  details?: React.ReactNode;
  diff?: React.ReactNode;
  footer?: React.ReactNode;
}

export interface PendingContentItem {
  type: PendingContentType;
  operation?: PendingOperation;
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
  display?: PendingDisplay;
}

interface AIConfirmationGridProps {
  pendingItems: PendingContentItem[];
  onConfirmAll: () => Promise<void>;
  onConfirmItem: (index: number) => Promise<void>;
  onRejectItem: (index: number) => void;
  onRejectAll: () => void;
  onEditItem?: (index: number) => void;
  isProcessing?: boolean;
}

export const AIConfirmationGrid = ({
  pendingItems,
  onConfirmAll,
  onConfirmItem,
  onRejectItem,
  onRejectAll,
  onEditItem,
  isProcessing = false,
}: AIConfirmationGridProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [processingItems, setProcessingItems] = useState<Set<number>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const calculateItemsPerPage = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTall = height >= 900;

      if (width < 640) {
        return isTall ? 6 : 4;
      }
      if (width < 1024) {
        return isTall ? 9 : 6;
      }
      if (width < 1440) {
        return isTall ? 12 : 9;
      }
      return isTall ? 16 : 12;
    };

    setItemsPerPage(calculateItemsPerPage());

    const handleResize = () => {
      setItemsPerPage((prev) => {
        const next = calculateItemsPerPage();
        return prev === next ? prev : next;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const totalPages = Math.ceil(pendingItems.length / itemsPerPage);
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(totalPages - 1, 0));
    }
  }, [currentPage, itemsPerPage, pendingItems.length]);

  const totalPages = Math.ceil(pendingItems.length / itemsPerPage);
  const currentItems = pendingItems.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage,
  );

  const canonicalType = (type: PendingContentType): Exclude<PendingContentType,
    "create_task" |
    "create_note" |
    "create_shopping_item" |
    "create_survey" |
    "create_contact" |
    "create_multiple_tasks" |
    "create_multiple_notes" |
    "create_multiple_shopping_items" |
    "create_multiple_surveys"
  > => {
    switch (type) {
      case "create_task":
      case "create_multiple_tasks":
        return "task";
      case "create_note":
      case "create_multiple_notes":
        return "note";
      case "create_shopping_item":
      case "create_multiple_shopping_items":
        return "shopping";
      case "create_survey":
      case "create_multiple_surveys":
        return "survey";
      case "create_contact":
        return "contact";
      default:
        return type;
    }
  };

  const deriveOperation = (item: PendingContentItem): PendingOperation => {
    if (item.operation) return item.operation;
    const rawType = item.type as string;
    if (rawType.startsWith("create_multiple_")) return "bulk_create";
    if (rawType.startsWith("create_")) return "create";
    return "create";
  };

  const typeLabels: Record<string, string> = {
    task: "task",
    note: "note",
    shopping: "shopping item",
    survey: "survey",
    contact: "contact",
    shoppingSection: "shopping section",
  };

  const operationVerb = (operation: PendingOperation) => {
    switch (operation) {
      case "bulk_create":
      case "create":
        return "create";
      case "bulk_edit":
      case "edit":
        return "update";
      case "delete":
        return "delete";
      default:
        return "process";
    }
  };

  const handleConfirmItem = async (index: number) => {
    setProcessingItems((prev) => new Set([...prev, index]));
    try {
      await onConfirmItem(index);
    } finally {
      setProcessingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const getItemTypeCounts = () => {
    const counts = pendingItems.reduce((acc, item) => {
      const type = canonicalType(item.type);
      const operation = deriveOperation(item);
      const key = `${type}__${operation}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([key, count]) => {
        const [type, operation] = key.split("__") as [PendingContentType, PendingOperation];
        const label = typeLabels[type] ?? type;
        const verb = operationVerb(operation);
        return `${count} ${label}${count === 1 ? "" : "s"} to ${verb}`;
      })
      .join(" • ");
  };

  if (pendingItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            AI wants to process {pendingItems.length} items
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

      {isProcessing && (
        <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing items...</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full animate-pulse"
              style={{ width: "60%" }}
            ></div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 p-4 sm:p-6 bg-gray-50/50 rounded-lg border [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))] auto-rows-fr">
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

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0 || isProcessing}
            onClick={() => setCurrentPage((prev) => prev - 1)}
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
            onClick={() => setCurrentPage((prev) => prev + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground pt-2 border-t">
        Showing {currentItems.length} of {pendingItems.length} items
        {totalPages > 1 && ` • ${itemsPerPage} items per page`}
      </div>
    </div>
  );
};
