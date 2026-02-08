import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, indicatorClassName, value = 0, max = 100, ...props }, ref) => {
    const clampedMax = max && max > 0 ? max : 100;
    const percentage = Math.min(100, Math.max(0, ((value || 0) / clampedMax) * 100));

    return (
      <div
        ref={ref}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <div
          className={cn("h-full w-full bg-primary transition-all duration-200", indicatorClassName)}
          style={{ width: `${percentage}%` }}
          aria-valuemin={0}
          aria-valuemax={clampedMax}
          aria-valuenow={value}
          role="progressbar"
        />
      </div>
    );
  }
);

Progress.displayName = "Progress";
