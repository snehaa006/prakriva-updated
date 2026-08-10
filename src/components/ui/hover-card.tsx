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
interface HoverCardContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const HoverCardContext = React.createContext<HoverCardContextValue | null>(null);
function useHoverCardContext(name: string) {
  const ctx = React.useContext(HoverCardContext);
  if (!ctx) throw new Error(`${name} must be used within a HoverCard`);
  return ctx;
}

const OPEN_DELAY = 300;
const CLOSE_DELAY = 150;

/* -------------------------------------------------------------------------
 * Root
 * ---------------------------------------------------------------------- */
interface HoverCardProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  openDelay?: number;
  closeDelay?: number;
}
const HoverCard = ({ open: openProp, defaultOpen, onOpenChange, children }: HoverCardProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <HoverCardContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </HoverCardContext.Provider>
  );
};
HoverCard.displayName = "HoverCard";

interface HoverCardTriggerProps extends React.HTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
  href?: string;
}
const HoverCardTrigger = React.forwardRef<HTMLAnchorElement, HoverCardTriggerProps>(
  ({ asChild, onMouseEnter, onMouseLeave, onFocus, onBlur, children, ...props }, forwardedRef) => {
    const { setOpen, triggerRef } = useHoverCardContext("HoverCardTrigger");
    const openTimeout = React.useRef<ReturnType<typeof setTimeout>>();
    const closeTimeout = React.useRef<ReturnType<typeof setTimeout>>();

    const setRefs = (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node as HTMLAnchorElement);
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
      onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
        onMouseEnter?.(e);
        show();
      },
      onMouseLeave: (e: React.MouseEvent<HTMLAnchorElement>) => {
        onMouseLeave?.(e);
        hide();
      },
      onFocus: (e: React.FocusEvent<HTMLAnchorElement>) => {
        onFocus?.(e);
        show();
      },
      onBlur: (e: React.FocusEvent<HTMLAnchorElement>) => {
        onBlur?.(e);
        hide();
      },
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, { ref: setRefs, ...handlers });
    }

    return (
      <a ref={setRefs} {...handlers} {...props}>
        {children}
      </a>
    );
  },
);
HoverCardTrigger.displayName = "HoverCardTrigger";

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */
interface HoverCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}
const HoverCardContent = React.forwardRef<HTMLDivElement, HoverCardContentProps>(
  ({ className, align = "center", sideOffset = 4, children, onMouseEnter, onMouseLeave, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef, contentRef } = useHoverCardContext("HoverCardContent");
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);
    const closeTimeout = React.useRef<ReturnType<typeof setTimeout>>();

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const placement: Placement = align === "end" ? "bottom-end" : align === "start" ? "bottom-start" : "bottom";
    const styles = useFloatingPosition(triggerRef.current, node, open, placement, sideOffset);

    React.useEffect(() => {
      return () => clearTimeout(closeTimeout.current);
    }, []);

    if (!open) return null;

    return createPortal(
      <div
        ref={setRefs}
        style={styles}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          clearTimeout(closeTimeout.current);
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          closeTimeout.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
        }}
        className={cn(
          "z-50 w-64 rounded-2xl bg-popover p-4 text-popover-foreground shadow-lg outline-none",
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
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardTrigger, HoverCardContent };
