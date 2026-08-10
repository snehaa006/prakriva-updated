import * as React from "react";

interface CollapsibleContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext() {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) {
    throw new Error("CollapsibleTrigger/CollapsibleContent must be used within a <Collapsible>");
  }
  return ctx;
}

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open, defaultOpen, onOpenChange, children, ...props }, ref) => {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : uncontrolledOpen;

    const setOpen = React.useCallback(
      (next: boolean) => {
        if (!isControlled) {
          setUncontrolledOpen(next);
        }
        onOpenChange?.(next);
      },
      [isControlled, onOpenChange],
    );

    return (
      <CollapsibleContext.Provider value={{ open: isOpen, setOpen }}>
        <div ref={ref} data-state={isOpen ? "open" : "closed"} {...props}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    );
  },
);
Collapsible.displayName = "Collapsible";

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ onClick, asChild, children, ...props }, ref) => {
    const { open, setOpen } = useCollapsibleContext();

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      return React.cloneElement(child, {
        "aria-expanded": open,
        "data-state": open ? "open" : "closed",
        onClick: (event: React.MouseEvent) => {
          setOpen(!open);
          (child.props.onClick as ((e: React.MouseEvent) => void) | undefined)?.(event);
        },
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={(event) => {
          setOpen(!open);
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, style, ...props }, ref) => {
    const { open } = useCollapsibleContext();
    const innerRef = React.useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = React.useState<string>(open ? "none" : "0px");

    React.useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      if (open) {
        const height = el.scrollHeight;
        setMaxHeight(`${height}px`);
        const timeout = setTimeout(() => setMaxHeight("none"), 300);
        return () => clearTimeout(timeout);
      } else {
        const height = el.scrollHeight;
        setMaxHeight(`${height}px`);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setMaxHeight("0px"));
        });
      }
    }, [open]);

    if (!open && maxHeight === "0px") {
      // Still render (hidden) so height can be measured on next open, matching
      // Radix's keep-mounted default behavior closely enough for consumers.
    }

    return (
      <div
        ref={ref}
        data-state={open ? "open" : "closed"}
        className="overflow-hidden transition-[max-height] duration-300 ease-ios"
        style={{ maxHeight, ...style }}
        {...props}
      >
        <div ref={innerRef} className={className}>
          {children}
        </div>
      </div>
    );
  },
);
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
