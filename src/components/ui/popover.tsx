import * as React from "react";
import { createPortal } from "react-dom";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
 * Local floating-ui positioning hook (duplicated per-file by design).
 * ---------------------------------------------------------------------- */
function useFloatingPosition(
  referenceEl: HTMLElement | null,
  floatingEl: HTMLElement | null,
  open: boolean,
  placement: Placement = "bottom",
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
interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  anchorRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const PopoverContext = React.createContext<PopoverContextValue | null>(null);
function usePopoverContext(name: string) {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error(`${name} must be used within a Popover`);
  return ctx;
}

/* -------------------------------------------------------------------------
 * Root
 * ---------------------------------------------------------------------- */
interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  modal?: boolean;
}
const Popover = ({ open: openProp, defaultOpen, onOpenChange, children }: PopoverProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef, anchorRef, contentRef }}>
      {children}
    </PopoverContext.Provider>
  );
};
Popover.displayName = "Popover";

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}
const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, onClick, children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef } = usePopoverContext("PopoverTrigger");

    const setRefs = (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node as HTMLButtonElement);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      setOpen(!open);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        ref: setRefs,
        onClick: handleClick,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
      });
    }

    return (
      <button
        ref={setRefs}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  },
);
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverAnchorProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}
const PopoverAnchor = React.forwardRef<HTMLDivElement, PopoverAnchorProps>(
  ({ asChild, children, ...props }, forwardedRef) => {
    const { anchorRef } = usePopoverContext("PopoverAnchor");

    const setRefs = (node: HTMLElement | null) => {
      anchorRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node as HTMLDivElement);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, { ref: setRefs });
    }

    return (
      <div ref={setRefs} {...props}>
        {children}
      </div>
    );
  },
);
PopoverAnchor.displayName = "PopoverAnchor";

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */
interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}
const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "center", sideOffset = 4, children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef, anchorRef, contentRef } = usePopoverContext("PopoverContent");
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const referenceEl = anchorRef.current ?? triggerRef.current;
    const placement: Placement = align === "end" ? "bottom-end" : align === "start" ? "bottom-start" : "bottom";
    const styles = useFloatingPosition(referenceEl, node, open, placement, sideOffset);

    React.useEffect(() => {
      if (!open) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      };
      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!contentRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
          setOpen(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleMouseDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleMouseDown);
      };
    }, [open, setOpen, triggerRef, contentRef]);

    if (!open) return null;

    return createPortal(
      <div
        ref={setRefs}
        role="dialog"
        style={styles}
        className={cn(
          "z-50 w-72 rounded-2xl bg-popover p-4 text-popover-foreground shadow-lg outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
