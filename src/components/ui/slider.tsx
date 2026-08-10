import * as React from "react";

import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

/**
 * Plain, dependency-free slider (no Radix), matching the array-based
 * value/onValueChange API. Supports both a single thumb
 * (value={[x]}) and a two-thumb range (value={[min, max]}), since both
 * shapes are used across the app. Native <input type="range"> elements are
 * stacked so multi-thumb dragging still works with normal mouse/touch/kb
 * interaction — accent-color is already wired globally in index.css.
 */
const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, defaultValue, onValueChange, onValueCommit, min = 0, max = 100, step = 1, disabled, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState<number[]>(defaultValue ?? [min]);
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : uncontrolledValue;

    const isRange = currentValue.length > 1;

    const commit = (next: number[]) => {
      if (!isControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    };

    const handleThumbChange = (index: number, raw: number) => {
      const next = [...currentValue];
      next[index] = raw;
      if (isRange) {
        // Keep thumbs from crossing, mirroring typical range-slider behavior.
        if (index === 0 && next[0] > next[1]) next[0] = next[1];
        if (index === 1 && next[1] < next[0]) next[1] = next[0];
      }
      commit(next);
    };

    if (!isRange) {
      const v = currentValue[0] ?? min;
      return (
        <div ref={ref} className={cn("relative flex w-full touch-none select-none items-center", className)} {...props}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={v}
            disabled={disabled}
            onChange={(e) => handleThumbChange(0, Number(e.target.value))}
            onMouseUp={() => onValueCommit?.(currentValue)}
            onTouchEnd={() => onValueCommit?.(currentValue)}
            className="w-full h-2 rounded-full bg-secondary appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 accent-primary"
          />
        </div>
      );
    }

    // Two-thumb range: stack two native range inputs on the same track. Each
    // input is transparent except for its thumb, and pointer-events are
    // limited to the thumb area via a slim track height + thumb-only hit
    // testing that native inputs already provide reasonably well.
    const [lo, hi] = currentValue;
    const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;

    return (
      <div
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center h-5", className)}
        {...props}
      >
        <div className="relative w-full h-2 rounded-full bg-secondary">
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          disabled={disabled}
          onChange={(e) => handleThumbChange(0, Number(e.target.value))}
          onMouseUp={() => onValueCommit?.(currentValue)}
          onTouchEnd={() => onValueCommit?.(currentValue)}
          className="absolute w-full h-5 top-0 appearance-none bg-transparent pointer-events-none accent-primary [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          disabled={disabled}
          onChange={(e) => handleThumbChange(1, Number(e.target.value))}
          onMouseUp={() => onValueCommit?.(currentValue)}
          onTouchEnd={() => onValueCommit?.(currentValue)}
          className="absolute w-full h-5 top-0 appearance-none bg-transparent pointer-events-none accent-primary [&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto"
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
