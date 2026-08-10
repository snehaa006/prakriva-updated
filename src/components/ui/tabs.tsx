import * as React from "react";

import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idPrefix: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs components must be used within a <Tabs> root");
  }
  return ctx;
}

let tabsIdCounter = 0;

interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ value, defaultValue, onValueChange, className, children, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
    const isControlled = value !== undefined;
    const activeValue = isControlled ? value : uncontrolledValue;
    const idPrefix = React.useRef(`tabs-${++tabsIdCounter}`).current;

    const setValue = React.useCallback(
      (next: string) => {
        if (!isControlled) {
          setUncontrolledValue(next);
        }
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    return (
      <TabsContext.Provider value={{ value: activeValue, setValue, idPrefix }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, onKeyDown, ...props }, ref) => {
    const { value: activeValue, setValue, idPrefix } = useTabsContext();
    const isActive = activeValue === value;
    const triggerId = `${idPrefix}-trigger-${value}`;
    const contentId = `${idPrefix}-content-${value}`;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      setValue(value);
      onClick?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const list = event.currentTarget.closest('[role="tablist"]');
        if (!list) return;
        const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const currentIndex = triggers.indexOf(event.currentTarget);
        if (currentIndex === -1) return;
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + delta + triggers.length) % triggers.length;
        const nextTrigger = triggers[nextIndex];
        nextTrigger?.focus();
        const nextValue = nextTrigger?.getAttribute("data-value");
        if (nextValue) setValue(nextValue);
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={triggerId}
        aria-selected={isActive}
        aria-controls={contentId}
        data-state={isActive ? "active" : "inactive"}
        data-value={value}
        tabIndex={isActive ? 0 : -1}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ease-ios ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isActive ? "bg-background-elevated shadow-sm text-foreground" : "text-foreground-secondary",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue, idPrefix } = useTabsContext();
    if (activeValue !== value) return null;

    const triggerId = `${idPrefix}-trigger-${value}`;
    const contentId = `${idPrefix}-content-${value}`;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={contentId}
        aria-labelledby={triggerId}
        tabIndex={0}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
