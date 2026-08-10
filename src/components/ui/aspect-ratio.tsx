import * as React from "react";

export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(({ ratio = 1, style, ...props }, ref) => (
  <div ref={ref} style={{ aspectRatio: ratio, ...style }} {...props} />
));
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
