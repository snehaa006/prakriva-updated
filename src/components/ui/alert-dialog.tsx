import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// -----------------------------------------------------------------------
// Native <dialog>-based AlertDialog engine (Radix-free).
// Deliberately independent from dialog.tsx's engine — kept self-contained
// per redesign spec rather than cross-importing.
// -----------------------------------------------------------------------

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialogContext(component: string) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within an <AlertDialog>`);
  }
  return ctx;
}

interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const AlertDialog = ({ open, defaultOpen = false, onOpenChange, children }: AlertDialogProps) => {
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

  return <AlertDialogContext.Provider value={value}>{children}</AlertDialogContext.Provider>;
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

interface AlertDialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useAlertDialogContext("AlertDialogTrigger");
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
AlertDialogTrigger.displayName = "AlertDialogTrigger";

const AlertDialogPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const AlertDialogOverlay = () => null;

interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDialogElement> {}

const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useAlertDialogContext("AlertDialogContent");
    const dialogRef = React.useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = React.useState(false);
    const [visible, setVisible] = React.useState(false);

    React.useImperativeHandle(ref, () => dialogRef.current as unknown as HTMLDivElement);

    React.useEffect(() => {
      const node = dialogRef.current;
      if (!node) return;

      if (open) {
        setMounted(true);
        if (!node.open) node.showModal();
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
      } else {
        setVisible(false);
        if (node.open) node.close();
      }
    }, [open]);

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
    }, [onOpenChange]);

    // Alert dialogs intentionally do not close on outside click — this
    // mirrors Radix AlertDialog, which requires an explicit action.

    const handleTransitionEnd = () => {
      if (!open) setMounted(false);
    };

    if (!mounted) return null;

    return createPortal(
      <dialog
        ref={dialogRef}
        onTransitionEnd={handleTransitionEnd}
        className={cn(
          "m-auto max-w-lg w-full rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-foreground/40 backdrop:backdrop-blur-sm",
          "transition-all duration-300 ease-ios-spring",
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
          className,
        )}
        {...props}
      >
        {children}
      </dialog>,
      document.body,
    );
  },
);
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
  ),
);
AlertDialogTitle.displayName = "AlertDialogTitle";

const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-foreground-secondary", className)} {...props} />
  ),
);
AlertDialogDescription.displayName = "AlertDialogDescription";

const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = useAlertDialogContext("AlertDialogAction");
    return (
      <button
        ref={ref}
        type="button"
        className={cn(buttonVariants(), className)}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) onOpenChange(false);
        }}
        {...props}
      />
    );
  },
);
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = useAlertDialogContext("AlertDialogCancel");
    return (
      <button
        ref={ref}
        type="button"
        className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) onOpenChange(false);
        }}
        {...props}
      />
    );
  },
);
AlertDialogCancel.displayName = "AlertDialogCancel";

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
