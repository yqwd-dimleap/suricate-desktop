import React, { useId, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "#/utils/utils";

/**
 * Cursor-style text shimmer: a soft, narrow bright band sweeps L→R across
 * muted glyphs. Gradient direction is near-horizontal (`90deg + angle`),
 * with feathered mid-stops so the highlight reads as a light sweep rather
 * than a hard stripe. Position stays in [0%, 100%] so letters never flash
 * transparent on dark backgrounds.
 *
 * `spread` widens the bright mid-band (1–8). `duration` is seconds per pass.
 * `angle` is tilt in degrees from a horizontal L→R sweep (Cursor ≈ 20).
 */
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
  /** Tilt from horizontal L→R sweep in degrees; Cursor-like default is 20. */
  angle?: number;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className">;

function TextShimmerComponent({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
  highlight = "var(--oh-foreground)",
  base = "var(--oh-muted)",
  angle = 20,
  style,
  ...rest
}: TextShimmerProps) {
  const reduceMotion = useReducedMotion();
  const reactId = useId();
  const animationName = `oh-text-shimmer-${reactId.replace(/:/g, "")}`;

  // Half-width of the bright region on the gradient (%). spread 2 → ±9%
  // core so one soft band is visible without washing the whole label.
  const bandHalf = useMemo(() => {
    const clamped = Math.min(8, Math.max(1, spread));
    return 5 + clamped * 2;
  }, [spread]);

  const shimmerStyle = useMemo(() => {
    const lo = Math.max(0, 50 - bandHalf);
    const hi = Math.min(100, 50 + bandHalf);
    // Feathered mid-stops (Cursor / shadcn-style), not a hard base→white cut.
    const loMid = Math.max(0, 50 - bandHalf * 0.5);
    const hiMid = Math.min(100, 50 + bandHalf * 0.5);
    const mid = `color-mix(in srgb, ${highlight} 55%, ${base})`;
    // 90deg = horizontal L→R; `angle` adds Cursor’s slight tilt (~20°).
    const direction = `${90 + angle}deg`;
    return {
      ...style,
      backgroundImage: `linear-gradient(${direction}, ${base} 0%, ${base} ${lo}%, ${mid} ${loMid}%, ${highlight} 50%, ${mid} ${hiMid}%, ${base} ${hi}%, ${base} 100%)`,
      // 200% wide + position in [0,100] ⇒ glyphs always painted.
      backgroundSize: "200% 100%",
      backgroundRepeat: "no-repeat",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      // Fallback if clip fails; fill is cleared so the gradient shows.
      color: base,
      WebkitTextFillColor: "transparent",
      animation: `${animationName} ${duration}s linear infinite`,
    } as React.CSSProperties;
  }, [animationName, angle, bandHalf, duration, highlight, base, style]);

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
          __html: `@keyframes ${animationName}{from{background-position:100% center}to{background-position:0% center}}`,
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
