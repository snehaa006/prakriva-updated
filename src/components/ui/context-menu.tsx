import * as React from "react";
import { createPortal } from "react-dom";
import {
  computePosition,
  autoUpdate,
  offset,
  flip,
  shift,
  type Placement,
  type VirtualElement,
} from "@floating-ui/dom";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
 * Local floating-ui positioning hook (duplicated per-file by design).
 * Accepts either a real HTMLElement or a virtual element (cursor point).
 * ---------------------------------------------------------------------- */
function useFloatingPosition(
  referenceEl: HTMLElement | VirtualElement | null,
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
        setStyles({
          position: "fixed",
          top: `${y}px`,
          left: `${x}px`,
          visibility: "visible",
        });
      });
    };

    let cleanup: (() => void) | undefined;
    if (referenceEl instanceof HTMLElement) {
      cleanup = autoUpdate(referenceEl, floatingEl, update);
    } else {
      update();
    }
    return () => {
      cleanup?.();
      setStyles((s) => ({ ...s, visibility: "hidden" }));
    };
  }, [open, referenceEl, floatingEl, placement, offsetPx]);

  return styles;
}

/* -------------------------------------------------------------------------
 * Context
 * ---------------------------------------------------------------------- */
interface ContextMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  point: VirtualElement | null;
  setPoint: (p: VirtualElement | null) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(null);
function useContextMenuContext(name: string) {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) throw new Error(`${name} must be used within a ContextMenu`);
  return ctx;
}

interface SubContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const ContextMenuSubContext = React.createContext<SubContextValue | null>(null);

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}
const ContextMenuRadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

/* -------------------------------------------------------------------------
 * Root / Trigger / misc passthrough pieces
 * ---------------------------------------------------------------------- */
interface ContextMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  modal?: boolean;
}
const ContextMenu = ({ children }: ContextMenuProps) => {
  const [open, setOpen] = React.useState(false);
  const [point, setPoint] = React.useState<VirtualElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <ContextMenuContext.Provider value={{ open, setOpen, point, setPoint, triggerRef, contentRef }}>
      {children}
    </ContextMenuContext.Provider>
  );
};

interface ContextMenuTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
}
const ContextMenuTrigger = React.forwardRef<HTMLDivElement, ContextMenuTriggerProps>(
  ({ children, onContextMenu, disabled, ...props }, forwardedRef) => {
    const { setOpen, setPoint, triggerRef } = useContextMenuContext("ContextMenuTrigger");

    const setRefs = (node: HTMLDivElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
      onContextMenu?.(e);
      if (disabled) return;
      e.preventDefault();
      const x = e.clientX;
      const y = e.clientY;
      setPoint({
        getBoundingClientRect: () =>
          ({
            x,
            y,
            top: y,
            left: x,
            right: x,
            bottom: y,
            width: 0,
            height: 0,
          }) as DOMRect,
      });
      setOpen(true);
    };

    return (
      <div ref={setRefs} onContextMenu={handleContextMenu} {...props}>
        {children}
      </div>
    );
  },
);
ContextMenuTrigger.displayName = "ContextMenuTrigger";

const ContextMenuGroup = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="group" {...props}>
    {children}
  </div>
);
ContextMenuGroup.displayName = "ContextMenuGroup";

const ContextMenuPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
ContextMenuPortal.displayName = "ContextMenuPortal";

const ContextMenuRadioGroup = ({
  value,
  onValueChange,
  children,
  ...props
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <ContextMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
    <div {...props}>{children}</div>
  </ContextMenuRadioGroupContext.Provider>
);
ContextMenuRadioGroup.displayName = "ContextMenuRadioGroup";

/* -------------------------------------------------------------------------
 * Keyboard nav helpers
 * ---------------------------------------------------------------------- */
function getMenuItems(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
  );
}

function useMenuKeyboardNav(
  contentRef: React.MutableRefObject<HTMLDivElement | null>,
  open: boolean,
  onClose: () => void,
) {
  React.useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;

    const id = requestAnimationFrame(() => {
      getMenuItems(el)[0]?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = getMenuItems(el);
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
        onClose();
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
  }, [open, contentRef, onClose]);
}

/* -------------------------------------------------------------------------
 * Sub (nested submenu)
 * ---------------------------------------------------------------------- */
interface ContextMenuSubProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}
const ContextMenuSub = ({ open: openProp, onOpenChange, children }: ContextMenuSubProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
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
    <ContextMenuSubContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </ContextMenuSubContext.Provider>
  );
};

const ContextMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, children, onClick, onMouseEnter, onMouseLeave, onKeyDown, ...props }, forwardedRef) => {
  const sub = React.useContext(ContextMenuSubContext);
  if (!sub) throw new Error("ContextMenuSubTrigger must be used within a ContextMenuSub");
  const { open, setOpen, triggerRef } = sub;
  const openTimeout = React.useRef<ReturnType<typeof setTimeout>>();
  const closeTimeout = React.useRef<ReturnType<typeof setTimeout>>();

  const setRefs = (node: HTMLDivElement | null) => {
    triggerRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  return (
    <div
      ref={setRefs}
      role="menuitem"
      tabIndex={-1}
      aria-haspopup="menu"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        clearTimeout(closeTimeout.current);
        openTimeout.current = setTimeout(() => setOpen(true), 150);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        clearTimeout(openTimeout.current);
        closeTimeout.current = setTimeout(() => setOpen(false), 200);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className={cn(
        "flex cursor-default select-none items-center rounded-xl px-3 py-2 text-sm outline-none hover:bg-accent-soft focus:bg-accent-soft data-[state=open]:bg-accent-soft",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </div>
  );
});
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";

const ContextMenuSubContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => {
    const sub = React.useContext(ContextMenuSubContext);
    if (!sub) throw new Error("ContextMenuSubContent must be used within a ContextMenuSub");
    const { open, setOpen, triggerRef, contentRef } = sub;
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const styles = useFloatingPosition(triggerRef.current, node, open, "right-start", 4);
    useMenuKeyboardNav(contentRef, open, () => {
      setOpen(false);
      triggerRef.current?.focus();
    });

    React.useEffect(() => {
      if (!open) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, setOpen, triggerRef]);

    if (!open) return null;

    return createPortal(
      <div
        ref={setRefs}
        role="menu"
        style={styles}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          "glass z-50 min-w-[8rem] overflow-hidden rounded-2xl p-1 shadow-lg text-popover-foreground",
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
ContextMenuSubContent.displayName = "ContextMenuSubContent";

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */
const ContextMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => {
    const { open, setOpen, point, triggerRef, contentRef } = useContextMenuContext("ContextMenuContent");
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const styles = useFloatingPosition(point, node, open, "bottom-start", 2);

    const close = React.useCallback(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, [setOpen, triggerRef]);

    useMenuKeyboardNav(contentRef, open, close);

    React.useEffect(() => {
      if (!open) return;
      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (!contentRef.current?.contains(target)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleMouseDown);
      return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [open, setOpen, contentRef]);

    if (!open) return null;

    return createPortal(
      <div
        ref={setRefs}
        role="menu"
        style={styles}
        className={cn(
          "glass z-50 min-w-[8rem] overflow-hidden rounded-2xl p-1 shadow-lg text-popover-foreground",
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
ContextMenuContent.displayName = "ContextMenuContent";

/* -------------------------------------------------------------------------
 * Items
 * ---------------------------------------------------------------------- */
interface ContextMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  disabled?: boolean;
}
const ContextMenuItem = React.forwardRef<HTMLDivElement, ContextMenuItemProps>(
  ({ className, inset, disabled, onClick, ...props }, ref) => (
    <div
      ref={ref}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
      }}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-xl px-3 py-2 text-sm outline-none hover:bg-accent-soft focus:bg-accent-soft",
        disabled && "pointer-events-none opacity-50",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  ),
);
ContextMenuItem.displayName = "ContextMenuItem";

interface ContextMenuCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}
const ContextMenuCheckboxItem = React.forwardRef<HTMLDivElement, ContextMenuCheckboxItemProps>(
  ({ className, children, checked, onCheckedChange, disabled, onClick, ...props }, ref) => (
    <div
      ref={ref}
      role="menuitemcheckbox"
      aria-checked={!!checked}
      aria-disabled={disabled}
      tabIndex={-1}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        onCheckedChange?.(!checked);
      }}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-xl py-2 pl-8 pr-3 text-sm outline-none hover:bg-accent-soft focus:bg-accent-soft",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {checked && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  ),
);
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem";

interface ContextMenuRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}
const ContextMenuRadioItem = React.forwardRef<HTMLDivElement, ContextMenuRadioItemProps>(
  ({ className, children, value, disabled, onClick, ...props }, ref) => {
    const group = React.useContext(ContextMenuRadioGroupContext);
    const checked = group?.value === value;
    return (
      <div
        ref={ref}
        role="menuitemradio"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={-1}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
          group?.onValueChange?.(value);
        }}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-xl py-2 pl-8 pr-3 text-sm outline-none hover:bg-accent-soft focus:bg-accent-soft",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {checked && <Circle className="h-2 w-2 fill-current" />}
        </span>
        {children}
      </div>
    );
  },
);
ContextMenuRadioItem.displayName = "ContextMenuRadioItem";

const ContextMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-1.5 text-sm font-semibold text-foreground", inset && "pl-8", className)}
    {...props}
  />
));
ContextMenuLabel.displayName = "ContextMenuLabel";

const ContextMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  ),
);
ContextMenuSeparator.displayName = "ContextMenuSeparator";

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-foreground-secondary", className)} {...props} />;
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
