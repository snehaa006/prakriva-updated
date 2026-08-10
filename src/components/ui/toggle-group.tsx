import * as React from "react";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    type?: "single" | "multiple";
    value?: string | string[];
    onItemToggle?: (value: string) => void;
  }
>({
  size: "default",
  variant: "default",
});

export interface ToggleGroupSingleProps extends VariantProps<typeof toggleVariants> {
  type?: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export interface ToggleGroupMultipleProps extends VariantProps<typeof toggleVariants> {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  className?: string;
  children?: React.ReactNode;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, variant, size, children, type = "single", value, defaultValue, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string | string[] | undefined>(
      defaultValue ?? (type === "multiple" ? [] : undefined),
    );
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const onItemToggle = React.useCallback(
      (itemValue: string) => {
        if (type === "multiple") {
          const arr = Array.isArray(currentValue) ? currentValue : [];
          const next = arr.includes(itemValue) ? arr.filter((v) => v !== itemValue) : [...arr, itemValue];
          if (!isControlled) setInternalValue(next);
          (onValueChange as ((value: string[]) => void) | undefined)?.(next);
        } else {
          const next = currentValue === itemValue ? "" : itemValue;
          if (!isControlled) setInternalValue(next);
          (onValueChange as ((value: string) => void) | undefined)?.(next);
        }
      },
      [type, currentValue, isControlled, onValueChange],
    );

    return (
      <div ref={ref} className={cn("flex items-center justify-center gap-1", className)} {...props}>
        <ToggleGroupContext.Provider value={{ variant, size, type, value: currentValue, onItemToggle }}>
          {children}
        </ToggleGroupContext.Provider>
      </div>
    );
  },
);

ToggleGroup.displayName = "ToggleGroup";

export interface ToggleGroupItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange">,
    VariantProps<typeof toggleVariants> {
  value: string;
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, children, variant, size, value, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext);
    const isPressed =
      context.type === "multiple"
        ? Array.isArray(context.value) && context.value.includes(value)
        : context.value === value;

    return (
      <button
        type="button"
        ref={ref}
        aria-pressed={isPressed}
        data-state={isPressed ? "on" : "off"}
        onClick={() => context.onItemToggle?.(value)}
        className={cn(
          toggleVariants({
            variant: context.variant || variant,
            size: context.size || size,
          }),
          isPressed && "bg-accent text-accent-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
