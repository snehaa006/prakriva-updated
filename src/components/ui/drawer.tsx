import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------
// Native <dialog>-based Drawer engine (vaul-free). Always a bottom sheet,
// iOS-style. Self-contained — duplicates the Context/ref engine locally.
// Full drag-to-dismiss gesture support is out of scope; tap-outside,
// Escape, and the close button all dismiss via the native dialog engine.
// -----------------------------------------------------------------------

/** Matches the `duration-300` exit transition on the panel below. */
const EXIT_DURATION_MS = 300;

interface DrawerContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

function useDrawerContext(component: string) {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within a <Drawer>`);
  }
  return ctx;
}

interface DrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  shouldScaleBackground?: boolean;
  children?: React.ReactNode;
}

// `shouldScaleBackground` is accepted for backwards compatibility with the
// vaul-based API but is a no-op here — the native <dialog> top-layer scrim
// makes the background-scale effect unnecessary.
const Drawer = ({ open, defaultOpen = false, onOpenChange, shouldScaleBackground, children }: DrawerProps) => {
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

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};
Drawer.displayName = "Drawer";

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

interface DrawerTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DrawerTrigger = React.forwardRef<HTMLButtonElement, DrawerTriggerProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useDrawerContext("DrawerTrigger");
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
DrawerTrigger.displayName = "DrawerTrigger";

interface DrawerCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DrawerClose = React.forwardRef<HTMLButtonElement, DrawerCloseProps>(
  ({ asChild = false, children, onClick, ...props }, ref) => {
    const { onOpenChange } = useDrawerContext("DrawerClose");
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
DrawerClose.displayName = "DrawerClose";

// Backwards-compat passthroughs.
const DrawerPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
const DrawerOverlay = () => null;

const DrawerContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDialogElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = useDrawerContext("DrawerContent");
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
      // `display: none`, so the slide-down has to finish before close() —
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
        className={cn(
          "m-0 max-w-none w-full inset-x-0 bottom-0 top-auto h-auto max-h-[85vh] flex flex-col rounded-t-2xl border border-border bg-card",
          "backdrop:bg-foreground/40 backdrop:backdrop-blur-sm",
          "transition-transform duration-300 ease-ios-spring translate-y-full",
          visible && "translate-y-0",
          className,
        )}
        {...props}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-border mt-2" />
        {children}
      </dialog>,
      document.body,
    );
  },
);
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-foreground-secondary", className)} {...props} />
  ),
);
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
