import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReasoningStreamActive } from "#/hooks/use-reasoning-stream-active";

// The hook settles after REASONING_STREAM_QUIET_MS (800) of no new tokens.
const QUIET_MS = 800;

afterEach(() => {
  vi.useRealTimers();
});

describe("useReasoningStreamActive", () => {
  it("is active while the stream is enabled", () => {
    const { result } = renderHook(() =>
      useReasoningStreamActive("token-1", true),
    );
    expect(result.current).toBe(true);
  });

  it("is inactive when disabled, regardless of fingerprint", () => {
    const { result } = renderHook(() =>
      useReasoningStreamActive("token-1", false),
    );
    expect(result.current).toBe(false);
  });

  it("settles after the stream goes quiet, and re-activates on new tokens", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ fingerprint }: { fingerprint: string }) =>
        useReasoningStreamActive(fingerprint, true),
      { initialProps: { fingerprint: "token-1" } },
    );

    // New tokens keep it active even across the quiet window.
    act(() => {
      vi.advanceTimersByTime(QUIET_MS - 100);
    });
    rerender({ fingerprint: "token-1 token-2" });
    act(() => {
      vi.advanceTimersByTime(QUIET_MS - 100);
    });
    expect(result.current).toBe(true);

    // Going quiet for the full window settles it.
    act(() => {
      vi.advanceTimersByTime(QUIET_MS);
    });
    expect(result.current).toBe(false);

    // A new token re-activates it.
    rerender({ fingerprint: "token-1 token-2 token-3" });
    expect(result.current).toBe(true);
  });

  it("stays settled once disabled, even if it was active", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useReasoningStreamActive("token-1", enabled),
      { initialProps: { enabled: true } },
    );

    expect(result.current).toBe(true);
    rerender({ enabled: false });
    expect(result.current).toBe(false);

    // Re-enabling restarts the stream as active.
    rerender({ enabled: true });
    expect(result.current).toBe(true);
  });
});