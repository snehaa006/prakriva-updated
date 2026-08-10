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
  placement: Placement = "top",
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

let tooltipIdCounter = 0;

/* -------------------------------------------------------------------------
 * Provider — Radix's Provider centralizes delay config across a subtree.
 * We replicate the default delay locally in the hook instead, so Provider
 * can be a near-no-op passthrough.
 * ---------------------------------------------------------------------- */
interface TooltipProviderProps {
  children?: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}
const TooltipProvider = ({ children }: TooltipProviderProps) => <>{children}</>;
TooltipProvider.displayName = "TooltipProvider";

/* -------------------------------------------------------------------------
 * Context
 * ---------------------------------------------------------------------- */
interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  id: string;
}
const TooltipContext = React.createContext<TooltipContextValue | null>(null);
function useTooltipContext(name: string) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error(`${name} must be used within a Tooltip`);
  return ctx;
}

/* -------------------------------------------------------------------------
 * Root
 * ---------------------------------------------------------------------- */
interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  delayDuration?: number;
}
const Tooltip = ({ open: openProp, defaultOpen, onOpenChange, children }: TooltipProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const idRef = React.useRef(`tooltip-${tooltipIdCounter++}`);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <TooltipContext.Provider value={{ open, setOpen, triggerRef, contentRef, id: idRef.current }}>
      {children}
    </TooltipContext.Provider>
  );
};
Tooltip.displayName = "Tooltip";

const OPEN_DELAY = 200;
const CLOSE_DELAY = 0;

interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}
const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ asChild, onMouseEnter, onMouseLeave, onFocus, onBlur, children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef, id } = useTooltipContext("TooltipTrigger");
    const openTimeout = React.useRef<ReturnType<typeof setTimeout>>();
    const closeTimeout = React.useRef<ReturnType<typeof setTimeout>>();

    const setRefs = (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node as HTMLButtonElement);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const show = () => {
      clearTimeout(closeTimeout.current);
      openTimeout.current = setTimeout(() => setOpen(true), OPEN_DELAY);
    };
    const hide = () => {
      clearTimeout(openTimeout.current);
      closeTimeout.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
    };

    React.useEffect(() => {
      return () => {
        clearTimeout(openTimeout.current);
        clearTimeout(closeTimeout.current);
      };
    }, []);

    const handlers = {
      onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
        onMouseEnter?.(e);
        show();
      },
      onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
        onMouseLeave?.(e);
        hide();
      },
      onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
        onFocus?.(e);
        setOpen(true);
      },
      onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
        onBlur?.(e);
        setOpen(false);
      },
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        ref: setRefs,
        "aria-describedby": open ? id : undefined,
        ...handlers,
      });
    }

    return (
      <button ref={setRefs} type="button" aria-describedby={open ? id : undefined} {...handlers} {...props}>
        {children}
      </button>
    );
  },
);
TooltipTrigger.displayName = "TooltipTrigger";

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */
interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  hidden?: boolean;
}
const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, sideOffset = 4, side = "top", align = "center", hidden, children, ...props }, forwardedRef) => {
    const { open, triggerRef, contentRef, id } = useTooltipContext("TooltipContent");
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const placement: Placement = align === "center" ? side : (`${side}-${align === "start" ? "start" : "end"}` as Placement);
    const styles = useFloatingPosition(triggerRef.current, node, open && !hidden, placement, sideOffset);

    if (!open || hidden) return null;

    return createPortal(
      <div
        ref={setRefs}
        role="tooltip"
        id={id}
        style={styles}
        className={cn(
          "z-50 overflow-hidden rounded-xl bg-foreground px-3 py-1.5 text-caption1 text-background shadow-md",
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
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
