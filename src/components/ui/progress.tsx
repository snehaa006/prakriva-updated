import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  /** Overrides the filled bar's colour, e.g. a risk-level class. */
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <div
        className={cn("h-full flex-1 bg-primary transition-all duration-300 ease-ios", indicatorClassName)}
        style={{ width: `${value || 0}%` }}
      />
    </div>
  ),
);
Progress.displayName = "Progress";

export { Progress };
