/**
 * Inline Confirmation Components
 * 
 * Displays confirmation cards inline within the AI message flow.
 * Allows users to confirm, edit, or reject items without a dialog.
 */

"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  X,
  Pencil,
  ListTodo,
  FileText,
  ShoppingBag,
  ClipboardList,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PendingContentItem, PendingContentType } from "@/components/AIConfirmationGrid";
import { InlineCreationForm } from "./InlineCreationForm";

// ============================================
// SINGLE CONFIRMATION CARD
// ============================================

interface ConfirmationCardProps {
  item: PendingContentItem;
  index: number;
  onConfirm: (index: number) => Promise<void>;
  onReject: (index: number) => void | Promise<void>;
  onEdit?: (index: number) => void;
  onUpdate?: (index: number, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  task: ListTodo,
  note: FileText,
  shopping: ShoppingBag,
  survey: ClipboardList,
  contact: Users,
  shoppingSection: ShoppingBag,
};

const TYPE_COLORS: Record<string, string> = {
  task: "bg-card border-border/50 shadow-sm",
  note: "bg-card border-border/50 shadow-sm",
  shopping: "bg-card border-border/50 shadow-sm",
  survey: "bg-card border-border/50 shadow-sm",
  contact: "bg-card border-border/50 shadow-sm",
  shoppingSection: "bg-card border-border/50 shadow-sm",
};

const OPERATION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Create", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  bulk_create: { label: "Create", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  edit: { label: "Edit", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  bulk_edit: { label: "Edit", color: "bg-primary/10 text-primary hover:bg-primary/20" },
  delete: { label: "Delete", color: "bg-destructive/10 text-destructive hover:bg-destructive/20" },
};

function getCanonicalType(type: PendingContentType): string {
  const typeStr = type as string;
  if (typeStr.startsWith("create_multiple_")) {
    return typeStr.replace("create_multiple_", "").replace("s", "");
  }
  if (typeStr.startsWith("create_")) {
    return typeStr.replace("create_", "");
  }
  return type;
}

function getTitle(item: PendingContentItem): string {
  const data = item.data;
  return (
    (data?.title as string) ||
    (data?.name as string) ||
    (data?.questionText as string) ||
    "Untitled"
  );
}

function getDescription(item: PendingContentItem): string | undefined {
  const data = item.data;
  return (
    (data?.description as string) ||
    (data?.content as string) ||
    (data?.notes as string)
  );
}

function getOperation(item: PendingContentItem): string {
  if (item.operation) return item.operation;
  const typeStr = item.type as string;
  if (typeStr.startsWith("create_multiple_")) return "bulk_create";
  if (typeStr.startsWith("create_")) return "create";
  return "create";
}

export const ConfirmationCard = memo(function ConfirmationCard({
  item,
  index,
  onConfirm,
  onReject,
  onEdit,
  onUpdate,
  isProcessing = false,
}: ConfirmationCardProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // Use InlineCreationForm for creation items
  const type = getCanonicalType(item.type);
  const supportedTypes = ["task", "note", "shopping", "contact"];
  const needsInlineForm = supportedTypes.includes(type) && !item.status;

  if (needsInlineForm && onUpdate) {
    return (
      <InlineCreationForm
        item={item}
        index={index}
        onConfirm={onConfirm}
        onReject={onReject}
        onUpdate={onUpdate}
        isProcessing={isProcessing}
      />
    );
  }

  const canonicalType = getCanonicalType(item.type);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Icon = TYPE_ICONS[canonicalType] || ListTodo;
  const colorClass = TYPE_COLORS[canonicalType] || TYPE_COLORS.task;
  const operation = getOperation(item);
  const operationInfo = OPERATION_LABELS[operation] || OPERATION_LABELS.create;
  const resolvedStatus = item.status;
  const isResolved = resolvedStatus === "confirmed" || resolvedStatus === "rejected";

  const title = getTitle(item);
  const description = getDescription(item);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(index);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        colorClass,
        isProcessing && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Removed Icon Container */}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-xs", operationInfo.color)}>
              {operationInfo.label}
            </Badge>
            {isResolved && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  resolvedStatus === "confirmed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                )}
              >
                {resolvedStatus === "confirmed" ? "Confirmed" : "Rejected"}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground capitalize">
              {canonicalType}
            </span>
          </div>

          <h4 className="font-medium mt-1 truncate">{title}</h4>

          {description && !expanded && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <dl className="space-y-2 text-sm">
            {Object.entries(item.data).map(([key, value]) => {
              if (!value || key === "type" || key === "operation") return null;
              return (
                <div key={key} className="flex gap-2">
                  <dt className="text-muted-foreground capitalize min-w-[80px]">
                    {key.replace(/([A-Z])/g, " $1").trim()}:
                  </dt>
                  <dd className="flex-1 break-words">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-8"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              More
            </>
          )}
        </Button>

        <div className="flex-1" />

        {isResolved ? (
          <span className="text-xs text-muted-foreground">
            {resolvedStatus === "confirmed" ? "Confirmed" : "Rejected"}
          </span>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onReject(index)}
              disabled={isProcessing || isConfirming}
            >
              <X className="h-3 w-3 mr-1" />
              Reject
            </Button>

            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-8"
                onClick={() => onEdit(index)}
                disabled={isProcessing || isConfirming}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}

            <Button
              size="sm"
              className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirm}
              disabled={isProcessing || isConfirming}
            >
              {isConfirming ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Confirm
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

ConfirmationCard.displayName = "ConfirmationCard";

// ============================================
// INLINE CONFIRMATION LIST
// ============================================

interface InlineConfirmationListProps {
  items: PendingContentItem[];
  onConfirmItem: (index: number) => Promise<void>;
  onRejectItem: (index: number) => void | Promise<void>;
  onEditItem?: (index: number) => void;
  onConfirmAll?: () => Promise<void>;
  onRejectAll?: () => void | Promise<void>;
  onUpdateItem?: (index: number, updates: Partial<PendingContentItem>) => void;
  isProcessing?: boolean;
}

export function InlineConfirmationList({
  items,
  onConfirmItem,
  onRejectItem,
  onEditItem,
  onConfirmAll,
  onRejectAll,
  onUpdateItem,
  isProcessing = false,
}: InlineConfirmationListProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const isInlineFormOnly =
    items.length === 1 &&
    Boolean(onUpdateItem) &&
    !items[0].status &&
    ["task", "note", "shopping", "contact"].includes(getCanonicalType(items[0].type));

  if (isInlineFormOnly) {
    return (
      <div className="pt-2 pb-24 sm:pb-28">
        <ConfirmationCard
          item={items[0]}
          index={0}
          onConfirm={onConfirmItem}
          onReject={onRejectItem}
          onEdit={onEditItem}
          onUpdate={onUpdateItem}
          isProcessing={isProcessing}
        />
      </div>
    );
  }

  const showSlider = items.length > 1;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < items.length - 1;

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.scrollWidth / items.length;
      scrollRef.current.scrollTo({
        left: cardWidth * index,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {items.length} item{items.length !== 1 ? "s" : ""} to confirm
          </span>
          {isProcessing && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {showSlider && (
            <span className="text-xs text-muted-foreground">
              ({currentIndex + 1}/{items.length})
            </span>
          )}
        </div>

        {items.length > 1 && onConfirmAll && onRejectAll && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 text-destructive hover:text-destructive"
              onClick={onRejectAll}
              disabled={isProcessing}
            >
              Reject All
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
              onClick={onConfirmAll}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Confirm All
            </Button>
          </div>
        )}
      </div>

      {/* Slider container */}
      <div className="relative">
        {/* Navigation arrows */}
        {showSlider && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 h-8 w-8 rounded-full shadow-md bg-background",
                !canGoBack && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => canGoBack && goToIndex(currentIndex - 1)}
              disabled={!canGoBack || isProcessing}
            >
              <ChevronUp className="h-4 w-4 -rotate-90" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 h-8 w-8 rounded-full shadow-md bg-background",
                !canGoForward && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => canGoForward && goToIndex(currentIndex + 1)}
              disabled={!canGoForward || isProcessing}
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </>
        )}

        {/* Cards slider */}
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2",
            showSlider ? "px-2" : "",
            // Hide scrollbar
            "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          )}
          onScroll={(e) => {
            const container = e.currentTarget;
            const cardWidth = container.scrollWidth / items.length;
            const newIndex = Math.round(container.scrollLeft / cardWidth);
            if (newIndex !== currentIndex) {
              setCurrentIndex(newIndex);
            }
          }}
        >
          {items.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex-shrink-0 snap-center",
                showSlider ? "w-[calc(100%-16px)]" : "w-full"
              )}
            >
              <ConfirmationCard
                item={item}
                index={index}
                onConfirm={onConfirmItem}
                onReject={onRejectItem}
                onEdit={onEditItem}
                onUpdate={onUpdateItem}
                isProcessing={isProcessing}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dots indicator */}
      {showSlider && (
        <div className="flex justify-center gap-1.5">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-primary w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InlineConfirmationList;
