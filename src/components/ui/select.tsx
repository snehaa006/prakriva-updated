import * as React from "react";
import { createPortal } from "react-dom";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
 * Local floating-ui positioning hook (duplicated per-file by design).
 * ---------------------------------------------------------------------- */
function useFloatingPosition(
  referenceEl: HTMLElement | null,
  floatingEl: HTMLElement | null,
  open: boolean,
  placement: Placement = "bottom-start",
  offsetPx = 4,
) {
  const [styles, setStyles] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    visibility: "hidden",
  });

  React.useEffect(() => {
    if (!open || !referenceEl || !floatingEl) return;

    const update = () => {
      computePosition(referenceEl, floatingEl, {
        placement,
        strategy: "fixed",
        middleware: [offset(offsetPx), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        setStyles({ position: "fixed", top: `${y}px`, left: `${x}px`, visibility: "visible" });
      });
    };

    const cleanup = autoUpdate(referenceEl, floatingEl, update);
    return () => {
      cleanup();
      setStyles((s) => ({ ...s, visibility: "hidden" }));
    };
  }, [open, referenceEl, floatingEl, placement, offsetPx]);

  return styles;
}

/* -------------------------------------------------------------------------
 * Context
 * ---------------------------------------------------------------------- */
interface SelectContextValue {
  value?: string;
  setValue: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  triggerWidth: number;
  itemLabels: React.MutableRefObject<Map<string, React.ReactNode>>;
  registerItemLabel: (value: string, label: React.ReactNode) => void;
}
const SelectContext = React.createContext<SelectContextValue | null>(null);
function useSelectContext(name: string) {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error(`${name} must be used within a Select`);
  return ctx;
}

/**
 * Recursively find every `SelectItem` in a children tree and record its label
 * against its value. Used to populate the label map without mounting the
 * (closed, and therefore unrendered) dropdown content.
 */
function collectItemLabels(
  children: React.ReactNode,
  into: Map<string, React.ReactNode>,
): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: unknown; children?: React.ReactNode };
    if (child.type === SelectItem && typeof props.value === "string") {
      into.set(props.value, props.children);
    }
    if (props.children) collectItemLabels(props.children, into);
  });
}

/* -------------------------------------------------------------------------
 * Root
 * ---------------------------------------------------------------------- */
interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  name?: string;
}
const Select = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled,
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
}: SelectProps) => {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const isValueControlled = valueProp !== undefined;
  const value = isValueControlled ? valueProp : uncontrolledValue;

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isOpenControlled = openProp !== undefined;
  const open = isOpenControlled ? openProp : uncontrolledOpen;

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const itemLabels = React.useRef<Map<string, React.ReactNode>>(new Map());
  const [triggerWidth, setTriggerWidth] = React.useState(0);

  const setValue = React.useCallback(
    (next: string) => {
      if (!isValueControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isValueControlled, onValueChange],
  );

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next && triggerRef.current) {
        setTriggerWidth(triggerRef.current.getBoundingClientRect().width);
      }
      if (!isOpenControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange],
  );

  const registerItemLabel = React.useCallback((itemValue: string, label: React.ReactNode) => {
    itemLabels.current.set(itemValue, label);
  }, []);

  // Seed the label map straight from the element tree, before anything mounts.
  //
  // `SelectContent` renders `null` while closed, so its `SelectItem` children
  // never run and never call `registerItemLabel`. That left `SelectValue`
  // blank on first paint for every select in the app — a settings page of
  // empty boxes until you opened each dropdown once. Walking the children here
  // is a pure read of the props tree, so the label is available immediately
  // and the runtime registration above still covers dynamic items.
  collectItemLabels(children, itemLabels.current);

  return (
    <SelectContext.Provider
      value={{
        value,
        setValue,
        open,
        setOpen,
        disabled,
        triggerRef,
        contentRef,
        triggerWidth,
        itemLabels,
        registerItemLabel,
      }}
    >
      {children}
    </SelectContext.Provider>
  );
};
Select.displayName = "Select";

const SelectGroup = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="group" {...props}>
    {children}
  </div>
);
SelectGroup.displayName = "SelectGroup";

interface SelectValueProps {
  placeholder?: React.ReactNode;
  className?: string;
}
const SelectValue = ({ placeholder, className }: SelectValueProps) => {
  const { value, itemLabels } = useSelectContext("SelectValue");
  const label = value !== undefined ? itemLabels.current.get(value) : undefined;
  return <span className={className}>{label ?? placeholder}</span>;
};
SelectValue.displayName = "SelectValue";

/* -------------------------------------------------------------------------
 * Trigger
 * ---------------------------------------------------------------------- */
const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, onClick, onKeyDown, ...props }, forwardedRef) => {
    const { open, setOpen, disabled, triggerRef } = useSelectContext("SelectTrigger");

    const setRefs = (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    };

    return (
      <button
        ref={setRefs}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={(e) => {
          onClick?.(e);
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background-elevated px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

/* Trivial passthroughs — a scrollable listbox substitutes for scroll buttons */
const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronUp className="h-4 w-4" />
    </div>
  ),
);
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronDown className="h-4 w-4" />
    </div>
  ),
);
SelectScrollDownButton.displayName = "SelectScrollDownButton";

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */
interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: "popper" | "item-aligned";
}
const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, position = "popper", ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef, contentRef, triggerWidth } = useSelectContext("SelectContent");
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const styles = useFloatingPosition(triggerRef.current, node, open, "bottom-start", 4);

    const close = React.useCallback(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, [setOpen, triggerRef]);

    React.useEffect(() => {
      if (!open) return;
      const el = contentRef.current;
      if (!el) return;

      const getOptions = () =>
        Array.from(el.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'));

      const id = requestAnimationFrame(() => {
        const selected = el.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
        (selected ?? getOptions()[0])?.focus();
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        const items = getOptions();
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);

        if (e.key === "ArrowDown") {
          e.preventDefault();
          items[(currentIndex + 1) % items.length]?.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length]?.focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          items[0]?.focus();
        } else if (e.key === "End") {
          e.preventDefault();
          items[items.length - 1]?.focus();
        } else if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (e.key === "Enter" || e.key === " ") {
          if (document.activeElement && items.includes(document.activeElement as HTMLElement)) {
            e.preventDefault();
            (document.activeElement as HTMLElement).click();
          }
        }
      };

      el.addEventListener("keydown", handleKeyDown);
      return () => {
        cancelAnimationFrame(id);
        el.removeEventListener("keydown", handleKeyDown);
      };
    }, [open, contentRef, close]);

    React.useEffect(() => {
      if (!open) return;
      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!contentRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleMouseDown);
      return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [open, setOpen, contentRef, triggerRef]);

    if (!open) return null;

    return createPortal(
      <div
        ref={setRefs}
        role="listbox"
        style={{ ...styles, minWidth: triggerWidth || undefined }}
        className={cn(
          "glass z-50 min-w-[8rem] overflow-hidden rounded-2xl shadow-lg text-popover-foreground",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <div className="max-h-60 overflow-y-auto p-1">{children}</div>
        <SelectScrollDownButton />
      </div>,
      document.body,
    );
  },
);
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
  ),
);
SelectLabel.displayName = "SelectLabel";

/* -------------------------------------------------------------------------
 * Item
 * ---------------------------------------------------------------------- */
interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}
const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled, onClick, ...props }, ref) => {
    const { value: selectedValue, setValue, setOpen, triggerRef, registerItemLabel } = useSelectContext("SelectItem");
    const selected = selectedValue === value;

    React.useEffect(() => {
      registerItemLabel(value, children);
    }, [value, children, registerItemLabel]);

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={selected}
        aria-disabled={disabled}
        tabIndex={-1}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
          setValue(value);
          setOpen(false);
          triggerRef.current?.focus();
        }}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-xl py-2 pl-8 pr-3 text-sm outline-none hover:bg-accent-soft focus:bg-accent-soft",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {selected && <Check className="h-4 w-4" />}
        </span>
        {children}
      </div>
    );
  },
);
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  ),
);
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
