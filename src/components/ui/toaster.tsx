import * as React from "react";

import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

const DEFAULT_TOAST_DURATION = 5000;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  React.useEffect(() => {
    const timers = toasts.map((t) => {
      if (t.open === false) return undefined;
      const duration = t.duration ?? DEFAULT_TOAST_DURATION;
      return setTimeout(() => dismiss(t.id), duration);
    });
    return () => {
      timers.forEach((timer) => timer && clearTimeout(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts.map((t) => t.id).join(",")]);

  return (
    <ToastProvider>
      <ToastViewport aria-live="polite">
        {toasts.map(function ({ id, title, description, action, variant, open, onOpenChange, duration, ...props }) {
          if (open === false) return null;
          return (
            <li key={id} className="list-none">
              <Toast variant={variant} {...props}>
                <div className="grid gap-1">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && <ToastDescription>{description}</ToastDescription>}
                </div>
                {action}
                <ToastClose onClick={() => dismiss(id)} />
              </Toast>
            </li>
          );
        })}
      </ToastViewport>
    </ToastProvider>
  );
}
