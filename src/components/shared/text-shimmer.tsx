import React, { useId, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "#/utils/utils";

/**
 * The gradient is an oversized repeating pattern; animating background-position
 * by exactly one period loops with no visible jump and no muted gap between
 * sweeps (the pattern is periodic, so a highlight is always near the text).
 */
const SHIMMER_BACKGROUND_SIZE = "200%";
/** Gradient period as a percentage of the (oversized) background image. */
const SHIMMER_PERIOD = 8;
/** Shifting background-position by one period == 2 * period (image is 2x wide). */
const SHIMMER_TRAVEL = SHIMMER_PERIOD * 2;

export type TextShimmerProps = {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
  /** CSS color of the bright sweep band (defaults to --oh-foreground). */
  highlight?: string;
  /** CSS color of the base (non-swept) text (defaults to --oh-muted). */
  base?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className">;

function TextShimmerComponent({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
  highlight = "var(--oh-foreground)",
  base = "var(--oh-muted)",
  style,
  ...rest
}: TextShimmerProps) {
  const reduceMotion = useReducedMotion();
  const reactId = useId();
  const animationName = `oh-text-shimmer-${reactId.replace(/:/g, "")}`;

  // Wider spread => wider bright band within each repeating period.
  const bandHalfWidth = useMemo(
    () => Math.min(SHIMMER_PERIOD / 2 - 1, 1 + spread / 2),
    [spread],
  );

  const shimmerStyle = useMemo(() => {
    const center = SHIMMER_PERIOD / 2;
    return {
      ...style,
      backgroundImage: `repeating-linear-gradient(90deg, ${base} 0%, ${base} ${center - bandHalfWidth}%, ${highlight} ${center}%, ${base} ${center + bandHalfWidth}%, ${base} ${SHIMMER_PERIOD}%)`,
      backgroundSize: `${SHIMMER_BACKGROUND_SIZE} 100%`,
      backgroundRepeat: "no-repeat",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
      animation: `${animationName} ${duration}s linear infinite`,
    } as React.CSSProperties;
  }, [animationName, bandHalfWidth, duration, highlight, base, style]);

  if (reduceMotion) {
    return (
      <Component
        className={cn("text-[var(--oh-muted)]", className)}
        style={{ ...style, color: base }}
        {...rest}
      >
        {children}
      </Component>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes ${animationName}{from{background-position:${SHIMMER_TRAVEL}% center}to{background-position:0% center}}`,
        }}
      />
      <Component
        className={cn("relative inline-block", className)}
        style={shimmerStyle}
        {...rest}
      >
        {children}
      </Component>
    </>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
