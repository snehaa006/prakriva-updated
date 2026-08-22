import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type AccordionType = "single" | "multiple";

interface AccordionContextValue {
  type: AccordionType;
  value: string | string[];
  toggle: (itemValue: string) => void;
  isOpen: (itemValue: string) => boolean;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error("Accordion components must be used within an <Accordion> root");
  }
  return ctx;
}

const AccordionItemContext = React.createContext<string | null>(null);

function useAccordionItemContext() {
  const ctx = React.useContext(AccordionItemContext);
  if (ctx === null) {
    throw new Error("AccordionTrigger/AccordionContent must be used within an <AccordionItem>");
  }
  return ctx;
}

type AccordionSingleProps = {
  type: "single";
  collapsible?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

type AccordionMultipleProps = {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

type AccordionProps = (AccordionSingleProps | AccordionMultipleProps) &
  Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue">;

const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>((props, ref) => {
  const { type, className, children, ...rest } = props as AccordionProps & Record<string, unknown>;

  const isSingle = type === "single";
  const defaultUncontrolled = isSingle ? "" : [];

  const controlledValue = (rest as { value?: string | string[] }).value;
  const defaultValue = (rest as { defaultValue?: string | string[] }).defaultValue;
  const onValueChange = (rest as { onValueChange?: (value: string | string[]) => void }).onValueChange;
  const collapsible = isSingle ? Boolean((rest as { collapsible?: boolean }).collapsible) : true;

  // The control props are read off `rest` above but were still in it, so they
  // rode the spread below onto the `<div>` — React then warns
  // ("Received `true` for a non-boolean attribute `collapsible`") and emits
  // invalid `collapsible`/`value`/`onvaluechange` attributes into the DOM.
  // Strip them here, once, rather than at every call site.
  const {
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    collapsible: _collapsible,
    ...domProps
  } = rest as Record<string, unknown>;

  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | string[]>(
    defaultValue ?? defaultUncontrolled,
  );

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : uncontrolledValue;

  const setValue = React.useCallback(
    (next: string | string[]) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const toggle = React.useCallback(
    (itemValue: string) => {
      if (isSingle) {
        const current = activeValue as string;
        if (current === itemValue) {
          setValue(collapsible ? "" : itemValue);
        } else {
          setValue(itemValue);
        }
      } else {
        const current = (activeValue as string[]) ?? [];
        if (current.includes(itemValue)) {
          setValue(current.filter((v) => v !== itemValue));
        } else {
          setValue([...current, itemValue]);
        }
      }
    },
    [isSingle, activeValue, collapsible, setValue],
  );

  const isOpen = React.useCallback(
    (itemValue: string) => {
      if (isSingle) {
        return activeValue === itemValue;
      }
      return ((activeValue as string[]) ?? []).includes(itemValue);
    },
    [isSingle, activeValue],
  );

  return (
    <AccordionContext.Provider value={{ type, value: activeValue, toggle, isOpen }}>
      <div ref={ref} className={className} {...(domProps as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
});
Accordion.displayName = "Accordion";

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, ...props }, ref) => (
    <AccordionItemContext.Provider value={value}>
      <div ref={ref} className={cn("border-b", className)} {...props} />
    </AccordionItemContext.Provider>
  ),
);
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, onClick, ...props }, ref) => {
    const itemValue = useAccordionItemContext();
    const { toggle, isOpen } = useAccordionContext();
    const open = isOpen(itemValue);

    return (
      <div className="flex">
        <button
          ref={ref}
          type="button"
          aria-expanded={open}
          data-state={open ? "open" : "closed"}
          onClick={(event) => {
            toggle(itemValue);
            onClick?.(event);
          }}
          className={cn(
            "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline",
            className,
          )}
          {...props}
        >
          {children}
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      </div>
    );
  },
);
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const itemValue = useAccordionItemContext();
    const { isOpen } = useAccordionContext();
    const open = isOpen(itemValue);

    const innerRef = React.useRef<HTMLDivElement>(null);
    const [maxHeight, setMaxHeight] = React.useState<string>(open ? "none" : "0px");

    React.useEffect(() => {
      const el = innerRef.current;
      if (!el) return;

      if (open) {
        const height = el.scrollHeight;
        setMaxHeight(`${height}px`);
        const timeout = setTimeout(() => setMaxHeight("none"), 300);
        return () => clearTimeout(timeout);
      } else {
        const height = el.scrollHeight;
        setMaxHeight(`${height}px`);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setMaxHeight("0px"));
        });
      }
    }, [open]);

    return (
      <div
        ref={ref}
        data-state={open ? "open" : "closed"}
        className="overflow-hidden text-sm transition-[max-height] duration-300 ease-ios"
        style={{ maxHeight }}
        {...props}
      >
        <div ref={innerRef} className={cn("pb-4 pt-0", className)}>
          {children}
        </div>
      </div>
    );
  },
);
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
