"use client";

/**
 * Thinking Indicator Component (Vercel AI Chatbot Style)
 *
 * Shows "Thinking..." with animated dots while AI is processing.
 */

export function ThinkingIndicator() {
  return (
    <div className="group/message fade-in w-full animate-in duration-300">
      <div className="flex w-full flex-col gap-2 md:gap-4">
        <div className="flex items-center gap-1 p-0 text-muted-foreground text-sm">
          <span className="animate-pulse">Thinking</span>
          <span className="inline-flex">
            <span className="animate-bounce [animation-delay:0ms]">.</span>
            <span className="animate-bounce [animation-delay:150ms]">.</span>
            <span className="animate-bounce [animation-delay:300ms]">.</span>
          </span>
        </div>
      </div>
    </div>
  );
}
