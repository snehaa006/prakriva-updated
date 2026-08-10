import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof toggleVariants> {
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, variant, size, pressed, defaultPressed, onPressedChange, disabled, ...props }, ref) => {
    const [internalPressed, setInternalPressed] = React.useState(defaultPressed ?? false);
    const isControlled = pressed !== undefined;
    const isPressed = isControlled ? pressed : internalPressed;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const next = !isPressed;
      if (!isControlled) setInternalPressed(next);
      onPressedChange?.(next);
      props.onClick?.(event);
    };

    return (
      <button
        type="button"
        ref={ref}
        aria-pressed={isPressed}
        disabled={disabled}
        data-state={isPressed ? "on" : "off"}
        className={cn(toggleVariants({ variant, size }), isPressed && "bg-accent text-accent-foreground", className)}
        {...props}
        onClick={handleClick}
      />
    );
  },
);

Toggle.displayName = "Toggle";

export { Toggle, toggleVariants };
