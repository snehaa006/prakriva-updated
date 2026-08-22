import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, className, ...props }, ref) => {
    if (!React.isValidElement(children)) {
      return null;
    }
    const child = children as React.ReactElement<any>;
    return React.cloneElement(child, {
      ...props,
      ...child.props,
      className: cn(className, child.props?.className),
      ref: ref
        ? (node: HTMLElement) => {
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
            const childRef = (child as any).ref;
            if (typeof childRef === "function") childRef(node);
            else if (childRef) childRef.current = node;
          }
        : (child as any).ref,
    });
  },
);
Slot.displayName = "Slot";

// Motion notes, since every button in the app inherits this line:
//
//   * the transition names its properties rather than using `transition-all`,
//     which on a button also animates width, padding and font colour changes
//     that should be instant;
//   * the hover lift is behind `@media (hover: hover)` — on a touch screen
//     `:hover` sticks after a tap, so the button stayed raised until the next
//     tap somewhere else;
//   * the press is a scale rather than a second translate. Tailwind composes
//     every transform utility from the same set of CSS variables, so a scale
//     and a translate stack cleanly whatever order they land in — two
//     competing `translate-y` rules would have depended on that order;
//   * it runs at 110ms against the 180ms release. Going down faster than it
//     comes back up is the whole trick: it is what makes the button feel like
//     it has weight rather than like it is playing an animation.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-[transform,box-shadow,background-color,border-color,color,opacity,filter] duration-quick ease-ios focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [@media(hover:hover)]:hover:-translate-y-0.5 active:scale-[0.97] active:duration-press disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:shadow-md",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-foreground/[0.12] bg-transparent text-foreground hover:bg-foreground/[0.04] hover:border-foreground/[0.2]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-foreground/[0.04]",
        // A link has no surface to push, so it neither lifts nor presses —
        // only the underline changes. The press cancel is `!scale-100` rather
        // than plain `scale-100` because it and the base's `scale-[0.97]` have
        // identical specificity, and Tailwind emits the arbitrary value last:
        // without the `!` the override would silently lose.
        link: "text-primary underline-offset-4 hover:underline [@media(hover:hover)]:hover:translate-y-0 active:!scale-100",
        gold: "bg-accent text-accent-foreground shadow-glow-gold hover:brightness-110",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-xl px-3.5",
        lg: "h-12 rounded-xl px-8 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref as React.Ref<HTMLElement>}
          {...props}
        />
      );
    }
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
