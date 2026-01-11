/**
 * Message Steps Components
 * 
 * Step-by-step visualization of AI assistant processing:
 * - StepContainer: wrapper with vertical connector line
 * - ToolCallStep: shows tool execution with icon and result
 * - ReasoningStep: shows AI thinking process
 * - TextStep: regular text content
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useSmoothText } from "@convex-dev/agent/react";
import { getToolConfig, getCategoryStyles } from "./ToolIcons";
import { Check, Loader2, MessageSquare } from "lucide-react";

// ============================================
// STEP CONTAINER
// ============================================

interface StepContainerProps {
  children: React.ReactNode;
  isLast?: boolean;
  status?: "pending" | "active" | "completed";
  dotColor?: string;
}

export function StepContainer({
  children,
  isLast = false,
  status = "completed",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dotColor,
}: StepContainerProps) {
  const getDotStyles = () => {
    switch (status) {
      case "pending":
        return "bg-muted-foreground/20";
      case "active":
        return "bg-foreground animate-pulse";
      case "completed":
        return "bg-muted-foreground/40";
    }
  };

  return (
    <div className="relative flex gap-3">
      {/* Vertical line & dot */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 mt-1.5",
            getDotStyles()
          )}
        />
        {/* Line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border/60 min-h-[16px]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-3 min-w-0">{children}</div>
    </div>
  );
}

// ============================================
// TOOL CALL STEP
// ============================================

interface ToolCallStepProps {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  isStreaming?: boolean;
  isLast?: boolean;
}

export function ToolCallStep({
  toolName,
  toolArgs,
  toolResult,
  isStreaming = false,
  isLast = false,
}: ToolCallStepProps) {
  const config = getToolConfig(toolName);
  const styles = getCategoryStyles(config.category);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Icon = config.icon;

  // Parse tool result to check if it contains confirmation data
  const parsedResult = React.useMemo(() => {
    if (!toolResult) return null;
    try {
      return JSON.parse(toolResult);
    } catch {
      return toolResult;
    }
  }, [toolResult]);

  // Check if this is a search result
  const isSearchResult =
    parsedResult &&
    typeof parsedResult === "object" &&
    ("found" in parsedResult || "tasks" in parsedResult || "notes" in parsedResult || "items" in parsedResult);

  // Check if this is a confirmation item (create/edit/delete)
  const isConfirmationResult =
    parsedResult &&
    typeof parsedResult === "object" &&
    "type" in parsedResult &&
    "operation" in parsedResult;

  // Format search results summary
  const getSearchSummary = () => {
    if (!isSearchResult || typeof parsedResult !== "object") return null;
    const found = parsedResult.found ?? parsedResult.count ?? 0;
    const total = parsedResult.total ?? found;
    return `Found ${found} of ${total}`;
  };

  return (
    <StepContainer
      isLast={isLast}
      status={isStreaming ? "active" : "completed"}
      dotColor={styles.dotColor}
    >
      <div className="py-1">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground/80">{config.label}</span>
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />
          ) : (
            <Check className="h-3.5 w-3.5 text-muted-foreground/60 ml-2" />
          )}
        </div>

        {/* Tool args preview (for search queries) */}
        {toolArgs && config.category === "search" && toolArgs.query && (
          <div className="mt-1 text-xs text-muted-foreground">
            Query: &quot;{String(toolArgs.query)}&quot;
          </div>
        )}

        {/* Search result summary */}
        {isSearchResult && (
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            {getSearchSummary()}
          </div>
        )}

        {/* Confirmation result indicator */}
        {isConfirmationResult && !isStreaming && (
          <div className="mt-1 text-xs text-muted-foreground">
            Ready for confirmation
          </div>
        )}

        {/* Full context loaded indicator */}
        {toolName === "load_full_project_context" && !isStreaming && parsedResult?.success && (
          <div className="mt-1 text-xs text-muted-foreground">
            Loaded: {parsedResult.counts?.tasks || 0} tasks, {parsedResult.counts?.notes || 0} notes,{" "}
            {parsedResult.counts?.shoppingItems || 0} items
          </div>
        )}
      </div>
    </StepContainer>
  );
}

// ============================================
// REASONING STEP
// ============================================

interface ReasoningStepProps {
  content: string;
  isStreaming?: boolean;
  isLast?: boolean;
}

export function ReasoningStep({
  content,
  isStreaming = false,
  isLast = false,
}: ReasoningStepProps) {
  const [visibleText] = useSmoothText(content || "", {
    startStreaming: isStreaming,
  });

  return (
    <StepContainer
      isLast={isLast}
      status={isStreaming ? "active" : "completed"}
      dotColor="bg-muted-foreground/30"
    >
      <div className="py-1">
        <span className="font-medium text-sm text-foreground/80">
          Thinking
        </span>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {visibleText || content}
          {isStreaming && visibleText && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-foreground/50 animate-blink align-middle" />
          )}
        </p>
      </div>
    </StepContainer>
  );
}

// ============================================
// TEXT STEP
// ============================================

interface TextStepProps {
  content: string;
  isStreaming?: boolean;
  isLast?: boolean;
}

export function TextStep({
  content,
  isStreaming = false,
  isLast = false,
}: TextStepProps) {
  const [visibleText] = useSmoothText(content || "", {
    startStreaming: isStreaming,
  });

  return (
    <StepContainer
      isLast={isLast}
      status={isStreaming ? "active" : "completed"}
      dotColor="bg-foreground/70"
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-muted/30">
          <MessageSquare className="h-4 w-4 text-foreground/60" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base leading-relaxed whitespace-pre-wrap text-foreground/90">
            {visibleText || content}
            {isStreaming && visibleText && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-blink align-middle" />
            )}
          </div>
        </div>
      </div>
    </StepContainer>
  );
}

// ============================================
// STARTED HEADER
// ============================================

interface StartedHeaderProps {
  title: string;
  isActive?: boolean;
}

export function StartedHeader({ title, isActive = false }: StartedHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
      {isActive ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Check className="h-4 w-4 text-green-500" />
      )}
      <span className="font-medium text-sm">
        {isActive ? "Processing" : "Completed"}: {title}
      </span>
    </div>
  );
}

// ============================================
// MESSAGE STEP LIST
// ============================================

export interface MessagePart {
  type: string;
  text?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: string;
}

interface MessageStepListProps {
  parts: MessagePart[];
  isStreaming?: boolean;
  headerTitle?: string;
}

export function MessageStepList({
  parts,
  isStreaming = false,
  headerTitle,
}: MessageStepListProps) {
  // Determine header title from first tool call or default
  const derivedTitle = React.useMemo(() => {
    if (headerTitle) return headerTitle;

    // Try to derive from first create/edit tool
    const actionTool = parts.find(
      (p) =>
        p.type.startsWith("tool-") &&
        (p.toolName?.includes("create") || p.toolName?.includes("edit") || p.toolName?.includes("delete"))
    );

    if (actionTool?.toolName) {
      const config = getToolConfig(actionTool.toolName);
      return config.label;
    }

    return "AI Response";
  }, [parts, headerTitle]);
  const shouldShowHeader = headerTitle != null || derivedTitle !== "AI Response";
  const orderedParts = React.useMemo(() => {
    if (!isStreaming) return parts;
    const reasoningParts = parts.filter((part) => part.type === "reasoning");
    const nonReasoningParts = parts.filter((part) => part.type !== "reasoning");
    return [...reasoningParts, ...nonReasoningParts];
  }, [parts, isStreaming]);

  return (
    <div className="py-2">
      {shouldShowHeader && (
        <StartedHeader title={derivedTitle} isActive={isStreaming} />
      )}

      <div className="pl-1">
        {orderedParts.map((part, index) => {
          const isLast = index === orderedParts.length - 1;
          const isPartStreaming = isStreaming && isLast;

          // Tool call part
          if (part.type.startsWith("tool-") && part.toolName) {
            return (
              <ToolCallStep
                key={`${part.type}-${index}`}
                toolName={part.toolName}
                toolArgs={part.args}
                toolResult={part.result}
                isStreaming={isPartStreaming && !part.result}
                isLast={isLast}
              />
            );
          }

          // Reasoning part
          if (part.type === "reasoning" && part.text) {
            return (
              <ReasoningStep
                key={`reasoning-${index}`}
                content={part.text}
                isStreaming={isPartStreaming}
                isLast={isLast}
              />
            );
          }

          // Text part
          if (part.type === "text" && part.text) {
            return (
              <TextStep
                key={`text-${index}`}
                content={part.text}
                isStreaming={isPartStreaming}
                isLast={isLast}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

export default MessageStepList;
