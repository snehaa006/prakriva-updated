import * as React from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------
// Native <dialog>-based Sheet engine (Radix/vaul-free). Slide-in panel.
// Self-contained — duplicates the Context/ref engine locally per spec.
// -----------------------------------------------------------------------

/** Matches the `duration-300` exit transition on the panel below. */
const EXIT_DURATION_MS = 300;

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext(component: string) {
  const ctx = React.useContext(SheetContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within a <Sheet>`);
  }
  return ctx;
}

interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Sheet = ({ open, defaultOpen = false, onOpenChange, children }: SheetProps) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = React.useMemo(
    () => ({ open: !!resolvedOpen, onOpenChange: handleOpenChange }),
    [resolvedOpen, handleOpenChange],
  );

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
};

function cloneWithHandler(
  child: React.ReactElement,
  handler: (e: React.MouseEvent) => void,
): React.ReactElement {
  const childProps = child.props as { onClick?: (e: React.MouseEvent) => void };
  return React.cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      childProps.onClick?.(e);
      if (!e.defaultPrevented) handler(e);
    },
  } as React.HTMLAttributes<HTMLElement>);
}

interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useSheetContext("SheetTrigger");
    const open = () => onOpenChange(true);

    if (asChild && React.isValidElement(children)) {
      return cloneWithHandler(children, open);
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) open();
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SheetTrigger.displayName = "SheetTrigger";

interface SheetCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const SheetClose = React.forwardRef<HTMLButtonElement, SheetCloseProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useSheetContext("SheetClose");
    const close = () => onOpenChange(false);

    if (asChild && React.isValidElement(children)) {
      return cloneWithHandler(children, close);
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) close();
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SheetClose.displayName = "SheetClose";

// Backwards-compat passthroughs.
const SheetPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const SheetOverlay = () => null;

const sheetVariants = cva(
  "fixed z-50 max-w-none gap-4 p-6 transition-transform duration-300 ease-ios-spring m-0",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 h-auto max-h-[85vh] w-full border-b -translate-y-full data-[state=open]:translate-y-0",
        bottom:
          "inset-x-0 bottom-0 h-auto max-h-[85vh] w-full border-t translate-y-full data-[state=open]:translate-y-0",
        left: "inset-y-0 left-0 h-full w-3/4 border-r -translate-x-full data-[state=open]:translate-x-0 sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l translate-x-full data-[state=open]:translate-x-0 sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps extends React.HTMLAttributes<HTMLDialogElement>, VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => {
    const { open, onOpenChange } = useSheetContext("SheetContent");
    const dialogRef = React.useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = React.useState(false);
    const [visible, setVisible] = React.useState(false);

    React.useImperativeHandle(ref, () => dialogRef.current as unknown as HTMLDivElement);

    // Mounting has to happen before the <dialog> can be opened: the element is
    // only rendered once `mounted` is true, so `dialogRef` is still null here on
    // the render that first asks for `open`.
    React.useEffect(() => {
      if (open) setMounted(true);
    }, [open]);

    React.useEffect(() => {
      const node = dialogRef.current;
      if (!node) return;

      if (open) {
        if (!node.open) node.showModal();
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
      }

      // Play the exit transition, then close and unmount. A closed <dialog> is
      // `display: none`, so the slide-out has to finish before close() —
      // waiting on transitionend after closing would wait forever.
      setVisible(false);
      const id = setTimeout(() => {
        if (node.open) node.close();
        setMounted(false);
      }, EXIT_DURATION_MS);
      return () => clearTimeout(id);
    }, [open, mounted]);

    React.useEffect(() => {
      const node = dialogRef.current;
      if (!node) return;

      const handleClose = () => {
        setVisible(false);
        onOpenChange(false);
      };

      node.addEventListener("close", handleClose);
      return () => {
        node.removeEventListener("close", handleClose);
      };
    }, [onOpenChange, mounted]);

    const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onOpenChange(false);
      }
    };

    if (!mounted) return null;

    return createPortal(
      <dialog
        ref={dialogRef}
        onClick={handleDialogClick}
        data-state={visible ? "open" : "closed"}
        className={cn(
          "glass shadow-glass backdrop:bg-foreground/40 backdrop:backdrop-blur-sm",
          sheetVariants({ side }),
          className,
        )}
        {...props}
      >
        <div className="relative h-full">
          {children}
          <SheetClose className="absolute right-0 top-0 -mt-2 -mr-2 rounded-full p-1.5 opacity-70 transition-opacity hover:opacity-100 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
      </dialog>,
      document.body,
    );
  },
);
SheetContent.displayName = "SheetContent";

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
  ),
);
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-foreground-secondary", className)} {...props} />
  ),
);
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
