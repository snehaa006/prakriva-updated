import * as React from "react";
import { createPortal } from "react-dom";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import { Check, ChevronRight, Circle } from "lucide-react";

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
 * Root context: tracks which top-level menu (by id) is currently open, so
 * opening one closes the others and hovering across triggers switches.
 * ---------------------------------------------------------------------- */
interface MenubarRootContextValue {
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
}
const MenubarRootContext = React.createContext<MenubarRootContextValue | null>(null);

interface MenubarMenuContextValue {
  id: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const MenubarMenuContext = React.createContext<MenubarMenuContextValue | null>(null);

interface SubContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
}
const MenubarSubContext = React.createContext<SubContextValue | null>(null);

interface RadioGroupContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}
const MenubarRadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

/* -------------------------------------------------------------------------
 * Root
 * ---------------------------------------------------------------------- */
const Menubar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const [activeMenu, setActiveMenu] = React.useState<string | null>(null);
    return (
      <MenubarRootContext.Provider value={{ activeMenu, setActiveMenu }}>
        <div
          ref={ref}
          role="menubar"
          className={cn("flex h-10 items-center space-x-1 rounded-xl border border-border bg-background p-1", className)}
          {...props}
        >
          {children}
        </div>
      </MenubarRootContext.Provider>
    );
  },
);
Menubar.displayName = "Menubar";

let menuIdCounter = 0;

interface MenubarMenuProps {
  value?: string;
  children?: React.ReactNode;
}
const MenubarMenu = ({ value, children }: MenubarMenuProps) => {
  const idRef = React.useRef(value ?? `menubar-menu-${menuIdCounter++}`);
  const root = React.useContext(MenubarRootContext);
  if (!root) throw new Error("MenubarMenu must be used within a Menubar");
  const { activeMenu, setActiveMenu } = root;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const open = activeMenu === idRef.current;
  const setOpen = React.useCallback(
    (next: boolean) => {
      setActiveMenu(next ? idRef.current : null);
    },
    [setActiveMenu],
  );

  return (
    <MenubarMenuContext.Provider value={{ id: idRef.current, open, setOpen, triggerRef, contentRef }}>
      {children}
    </MenubarMenuContext.Provider>
  );
};

const MenubarGroup = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="group" {...props}>
    {children}
  </div>
);
MenubarGroup.displayName = "MenubarGroup";

const MenubarPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
MenubarPortal.displayName = "MenubarPortal";

const MenubarRadioGroup = ({
  value,
  onValueChange,
  children,
  ...props
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => (
  <MenubarRadioGroupContext.Provider value={{ value, onValueChange }}>
    <div {...props}>{children}</div>
  </MenubarRadioGroupContext.Provider>
);
MenubarRadioGroup.displayName = "MenubarRadioGroup";

/* -------------------------------------------------------------------------
 * Trigger
 * ---------------------------------------------------------------------- */
const MenubarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, onMouseEnter, onKeyDown, ...props }, forwardedRef) => {
    const menu = React.useContext(MenubarMenuContext);
    const root = React.useContext(MenubarRootContext);
    if (!menu || !root) throw new Error("MenubarTrigger must be used within a MenubarMenu");
    const { open, setOpen, triggerRef } = menu;
    const { activeMenu } = root;

    const setRefs = (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    };

    return (
      <button
        ref={setRefs}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={(e) => {
          onClick?.(e);
          setOpen(!open);
        }}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          // Native menubar behavior: if another menu is already open, hovering
          // this trigger switches which one is shown.
          if (activeMenu !== null && activeMenu !== menu.id) {
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex cursor-default select-none items-center rounded-xl px-3 py-1.5 text-sm font-medium outline-none hover:bg-accent-soft focus:bg-accent-soft data-[state=open]:bg-accent-soft",
          className,
        )}
        {...props}
      />
    );
  },
);
MenubarTrigger.displayName = "MenubarTrigger";

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
 * Content
 * ---------------------------------------------------------------------- */
interface MenubarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  alignOffset?: number;
  sideOffset?: number;
}
const MenubarContent = React.forwardRef<HTMLDivElement, MenubarContentProps>(
  ({ className, align = "start", alignOffset = -4, sideOffset = 8, children, ...props }, forwardedRef) => {
    const menu = React.useContext(MenubarMenuContext);
    const root = React.useContext(MenubarRootContext);
    if (!menu || !root) throw new Error("MenubarContent must be used within a MenubarMenu");
    const { open, setOpen, triggerRef, contentRef } = menu;
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

    // ArrowLeft/ArrowRight moves between top-level menus while one is open.
    React.useEffect(() => {
      if (!open) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const menubar = triggerRef.current?.closest('[role="menubar"]');
          if (!menubar) return;
          const triggers = Array.from(menubar.querySelectorAll<HTMLElement>('[role="menuitem"][aria-haspopup="menu"]'));
          const idx = triggers.indexOf(triggerRef.current as HTMLElement);
          if (idx === -1) return;
          e.preventDefault();
          const nextIdx =
            e.key === "ArrowRight" ? (idx + 1) % triggers.length : (idx - 1 + triggers.length) % triggers.length;
          triggers[nextIdx]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          triggers[nextIdx]?.focus();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, triggerRef]);

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
          "glass z-50 min-w-[12rem] overflow-hidden rounded-2xl p-1 shadow-lg text-popover-foreground",
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
MenubarContent.displayName = "MenubarContent";

/* -------------------------------------------------------------------------
 * Items
 * ---------------------------------------------------------------------- */
interface MenubarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  disabled?: boolean;
}
const MenubarItem = React.forwardRef<HTMLDivElement, MenubarItemProps>(
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
MenubarItem.displayName = "MenubarItem";

interface MenubarCheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}
const MenubarCheckboxItem = React.forwardRef<HTMLDivElement, MenubarCheckboxItemProps>(
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
MenubarCheckboxItem.displayName = "MenubarCheckboxItem";

interface MenubarRadioItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}
const MenubarRadioItem = React.forwardRef<HTMLDivElement, MenubarRadioItemProps>(
  ({ className, children, value, disabled, onClick, ...props }, ref) => {
    const group = React.useContext(MenubarRadioGroupContext);
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
MenubarRadioItem.displayName = "MenubarRadioItem";

const MenubarLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div ref={ref} className={cn("px-3 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
));
MenubarLabel.displayName = "MenubarLabel";

const MenubarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  ),
);
MenubarSeparator.displayName = "MenubarSeparator";

const MenubarShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-foreground-secondary", className)} {...props} />;
};
MenubarShortcut.displayName = "MenubarShortcut";

/* -------------------------------------------------------------------------
 * Sub (nested submenu)
 * ---------------------------------------------------------------------- */
interface MenubarSubProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}
const MenubarSub = ({ open: openProp, onOpenChange, children }: MenubarSubProps) => {
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
    <MenubarSubContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </MenubarSubContext.Provider>
  );
};

const MenubarSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, children, onClick, onMouseEnter, onMouseLeave, onKeyDown, ...props }, forwardedRef) => {
  const sub = React.useContext(MenubarSubContext);
  if (!sub) throw new Error("MenubarSubTrigger must be used within a MenubarSub");
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
MenubarSubTrigger.displayName = "MenubarSubTrigger";

const MenubarSubContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => {
    const sub = React.useContext(MenubarSubContext);
    if (!sub) throw new Error("MenubarSubContent must be used within a MenubarSub");
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
MenubarSubContent.displayName = "MenubarSubContent";

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};
