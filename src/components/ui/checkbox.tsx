import * as React from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "checked" | "defaultChecked"> {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState<boolean | "indeterminate">(defaultChecked ?? false);
    const isControlled = checked !== undefined;
    const state = isControlled ? checked : internalChecked;
    const isChecked = state === true;
    const isIndeterminate = state === "indeterminate";

    const handleClick = () => {
      if (disabled) return;
      const next = !isChecked;
      if (!isControlled) setInternalChecked(next);
      onCheckedChange?.(next);
    };

    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          (isChecked || isIndeterminate) && "bg-primary text-primary-foreground",
          className,
        )}
        {...props}
      >
        <span className="flex items-center justify-center text-current">
          {isIndeterminate ? <Minus className="h-4 w-4" /> : isChecked ? <Check className="h-4 w-4" /> : null}
        </span>
      </button>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
