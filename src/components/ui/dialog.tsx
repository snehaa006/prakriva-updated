import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------
// Native <dialog>-based Dialog engine (Radix-free).
// -----------------------------------------------------------------------

/** Matches the `duration-300` exit transition on the overlay below. */
const EXIT_DURATION_MS = 300;

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within a <Dialog>`);
  }
  return ctx;
}

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const Dialog = ({ open, defaultOpen = false, onOpenChange, children }: DialogProps) => {
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

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

// Tiny asChild helper (same pattern used across the redesigned primitives).
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

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useDialogContext("DialogTrigger");
    const open = (e: React.MouseEvent) => onOpenChange(true);

    if (asChild && React.isValidElement(children)) {
      return cloneWithHandler(children, open);
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) open(e);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DialogTrigger.displayName = "DialogTrigger";

// Backwards-compat passthroughs — native <dialog> needs neither a portal
// wrapper nor a separate overlay element (::backdrop handles the scrim).
const DialogPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const DialogOverlay = () => null;

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useDialogContext("DialogClose");
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
DialogClose.displayName = "DialogClose";

interface DialogContentProps extends React.HTMLAttributes<HTMLDialogElement> {
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  onPointerDownOutside?: (e: Event) => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext("DialogContent");
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
        // Trigger entrance transition on next frame.
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
      }

      // Play the exit transition, then close and unmount. A closed <dialog> is
      // `display: none`, so the fade has to finish before close() — waiting on
      // transitionend after closing would wait forever.
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
      const handleCancel = (e: Event) => {
        // Let Escape close normally via the native `close` event.
      };

      node.addEventListener("close", handleClose);
      node.addEventListener("cancel", handleCancel);
      return () => {
        node.removeEventListener("close", handleClose);
        node.removeEventListener("cancel", handleCancel);
      };
    }, [onOpenChange, mounted]);

    // Click-outside (on the ::backdrop, i.e. the dialog element itself).
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
        className={cn(
          "m-auto max-w-lg w-full rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm",
          "transition-all duration-300 ease-ios-spring",
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
          className,
        )}
        {...props}
      >
        <div className="relative">
          {children}
          <DialogClose className="absolute right-0 top-0 -mt-2 -mr-2 rounded-full p-1.5 opacity-70 transition-opacity hover:opacity-100 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </dialog>,
      document.body,
    );
  },
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-foreground-secondary", className)} {...props} />
  ),
);
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
