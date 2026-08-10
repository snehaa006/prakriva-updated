import * as React from "react";
import { createPortal } from "react-dom";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
 * Local floating-ui positioning hook (duplicated per-file by design — see
 * component rewrite spec: files must stay independent, no cross-imports).
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
        setStyles({
          position: "fixed",
          top: `${y}px`,
          left: `${x}px`,
          visibility: "visible",
        });
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
interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);
function useDropdownMenuContext(name: string) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error(`${name} must be used within a DropdownMenu`);
  return ctx;
}

interface SubContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const DropdownMenuSubContext = React.createContext<SubContextValue | null>(null);

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}
const DropdownMenuRadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

/* -------------------------------------------------------------------------
 * Root / Trigger / misc passthrough pieces
 * ---------------------------------------------------------------------- */
interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  modal?: boolean;
}
const DropdownMenu = ({ open: openProp, defaultOpen, onOpenChange, children }: DropdownMenuProps) => {
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
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </DropdownMenuContext.Provider>
  );
};

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}
const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ asChild, onClick, onKeyDown, children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef } = useDropdownMenuContext("DropdownMenuTrigger");

    const setRefs = (node: HTMLElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node as HTMLButtonElement);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      setOpen(!open);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(e);
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement, {
        ref: setRefs,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        "aria-haspopup": "menu",
        "aria-expanded": open,
      });
    }

    return (
      <button
        ref={setRefs}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuGroup = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="group" {...props}>
    {children}
  </div>
);
DropdownMenuGroup.displayName = "DropdownMenuGroup";

const DropdownMenuPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
DropdownMenuPortal.displayName = "DropdownMenuPortal";

const DropdownMenuRadioGroup = ({
  value,
  onValueChange,
  children,
  ...props
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <DropdownMenuRadioGroupContext.Provider value={{ value, onValueChange }}>
    <div {...props}>{children}</div>
  </DropdownMenuRadioGroupContext.Provider>
);
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";

/* -------------------------------------------------------------------------
 * Keyboard nav helpers (shared within this file only)
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

    const focusFirst = () => {
      const items = getMenuItems(el);
      items[0]?.focus();
    };
    // Focus first item on open
    const id = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = getMenuItems(el);
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[(currentIndex + 1) % items.length];
        next?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        prev?.focus();
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
interface DropdownMenuSubProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}
const DropdownMenuSub = ({ open: openProp, defaultOpen, onOpenChange, children }: DropdownMenuSubProps) => {
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
    <DropdownMenuSubContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </DropdownMenuSubContext.Provider>
  );
};

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, children, onClick, onMouseEnter, onMouseLeave, onKeyDown, ...props }, forwardedRef) => {
  const sub = React.useContext(DropdownMenuSubContext);
  if (!sub) throw new Error("DropdownMenuSubTrigger must be used within a DropdownMenuSub");
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
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, onKeyDown, ...props }, forwardedRef) => {
    const sub = React.useContext(DropdownMenuSubContext);
    if (!sub) throw new Error("DropdownMenuSubContent must be used within a DropdownMenuSub");
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
      const handleMouseEnter = () => {};
      const el = contentRef.current;
      el?.addEventListener("mouseenter", handleMouseEnter);
      return () => el?.removeEventListener("mouseenter", handleMouseEnter);
    }, [open]);

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
        onKeyDown={onKeyDown}
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
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

/* -------------------------------------------------------------------------
 * Content
 * ---------------------------------------------------------------------- */
interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  align?: "start" | "center" | "end";
}
const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, sideOffset = 4, align = "start", children, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef, contentRef } = useDropdownMenuContext("DropdownMenuContent");
    const [node, setNode] = React.useState<HTMLDivElement | null>(null);

    const setRefs = (n: HTMLDivElement | null) => {
      contentRef.current = n;
      setNode(n);
      if (typeof forwardedRef === "function") forwardedRef(n);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = n;
    };

    const placement: Placement = align === "end" ? "bottom-end" : align === "center" ? "bottom" : "bottom-start";
    const styles = useFloatingPosition(triggerRef.current, node, open, placement, sideOffset);

    const close = React.useCallback(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, [setOpen, triggerRef]);

    useMenuKeyboardNav(contentRef, open, close);

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
DropdownMenuContent.displayName = "DropdownMenuContent";

/* -------------------------------------------------------------------------
 * Items
 * ---------------------------------------------------------------------- */
interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  disabled?: boolean;
}
const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
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
        "relative flex cursor-default select-none items-center rounded-xl px-3 py-2 text-sm outline-none transition-colors hover:bg-accent-soft focus:bg-accent-soft",
        disabled && "pointer-events-none opacity-50",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

interface DropdownMenuCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}
const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
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
        "relative flex cursor-default select-none items-center rounded-xl py-2 pl-8 pr-3 text-sm outline-none transition-colors hover:bg-accent-soft focus:bg-accent-soft",
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
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

interface DropdownMenuRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}
const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, DropdownMenuRadioItemProps>(
  ({ className, children, value, disabled, onClick, ...props }, ref) => {
    const group = React.useContext(DropdownMenuRadioGroupContext);
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
          "relative flex cursor-default select-none items-center rounded-xl py-2 pl-8 pr-3 text-sm outline-none transition-colors hover:bg-accent-soft focus:bg-accent-soft",
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
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div ref={ref} className={cn("px-3 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  ),
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
