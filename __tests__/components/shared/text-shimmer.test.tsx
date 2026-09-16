import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextShimmer } from "#/components/shared/text-shimmer";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>(
    "framer-motion",
  );
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

describe("TextShimmer", () => {
  it("renders a soft single-sweep clipped gradient (Cursor-style)", () => {
    render(
      <TextShimmer data-testid="shimmer" duration={3} spread={2}>
        Sending...
      </TextShimmer>,
    );

    const shimmer = screen.getByTestId("shimmer");
    // One soft band, not a dense repeating stripe train.
    expect(shimmer.style.backgroundImage).toContain("linear-gradient");
    expect(shimmer.style.backgroundImage).not.toContain(
      "repeating-linear-gradient",
    );
    expect(shimmer.style.backgroundImage).toContain("var(--oh-foreground)");
    expect(shimmer.style.backgroundImage).toContain("var(--oh-muted)");
    // Near-horizontal L→R (90°) plus Cursor tilt (~20°) → 110deg.
    expect(shimmer.style.backgroundImage).toContain("110deg");
    // Feathered mid-stops, not a hard base→highlight cut.
    expect(shimmer.style.backgroundImage).toContain("color-mix");
    expect(shimmer.style.backgroundSize).toBe("200% 100%");
    expect(shimmer.style.animation).toContain("oh-text-shimmer-");
    expect(shimmer.style.animation).toContain("3s");
    // Keyframe travel must stay in [0%,100%] so dark-theme glyphs never
    // uncover (transparent) while the band sweeps.
    const keyframes = document.querySelector("style")?.textContent ?? "";
    expect(keyframes).toContain("background-position:100% center");
    expect(keyframes).toContain("background-position:0% center");
    expect(keyframes).not.toContain("-150%");
  });

  it("defaults to Cursor timing and tilt when props are omitted", () => {
    render(<TextShimmer data-testid="shimmer-defaults">Thinking</TextShimmer>);

    const shimmer = screen.getByTestId("shimmer-defaults");
    expect(shimmer.style.animation).toContain("2s");
    expect(shimmer.style.backgroundImage).toContain("110deg");
  });
});
