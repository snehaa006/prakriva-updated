import * as React from "react";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-auto scroll-area", className)} {...props}>
      {children}
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

// Native scrolling doesn't need a separate thumb component. Kept as a no-op
// export so existing imports/usages of `<ScrollBar />` don't break.
const ScrollBar = () => null;

export { ScrollArea, ScrollBar };
