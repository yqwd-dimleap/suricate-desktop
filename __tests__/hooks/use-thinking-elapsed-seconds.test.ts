import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  clearThinkingElapsedCacheForTests,
  useThinkingElapsedSeconds,
} from "#/hooks/use-thinking-elapsed-seconds";

afterEach(() => {
  vi.useRealTimers();
  clearThinkingElapsedCacheForTests();
});

beforeEach(() => {
  clearThinkingElapsedCacheForTests();
});

describe("useThinkingElapsedSeconds", () => {
  it("returns null for historical thoughts that never went live", () => {
    const { result } = renderHook(() =>
      useThinkingElapsedSeconds(false, "already finished reasoning"),
    );
    expect(result.current).toBeNull();
  });

  it("counts whole seconds while thinking and freezes on settle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const { result, rerender } = renderHook(
      ({ isThinking }: { isThinking: boolean }) =>
        useThinkingElapsedSeconds(isThinking, "live reasoning"),
      { initialProps: { isThinking: true } },
    );

    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current).toBe(2);

    rerender({ isThinking: false });
    expect(result.current).toBe(2);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(2);
  });

  it("restores a settled duration after remount with the same content", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const content = "reasoning that remounts as Thought";
    const first = renderHook(
      ({ isThinking }: { isThinking: boolean }) =>
        useThinkingElapsedSeconds(isThinking, content),
      { initialProps: { isThinking: true } },
    );

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    first.rerender({ isThinking: false });
    expect(first.result.current).toBe(4);
    first.unmount();

    const second = renderHook(() =>
      useThinkingElapsedSeconds(false, content),
    );
    expect(second.result.current).toBe(4);
  });

  it("does not reset the start clock when content grows during thinking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const { result, rerender } = renderHook(
      ({ content }: { content: string }) =>
        useThinkingElapsedSeconds(true, content),
      { initialProps: { content: "partial" } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender({ content: "partial more tokens" });
    expect(result.current).toBe(3);
  });

  it("keeps the same clock across a quiet settle → resume on the same mount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const { result, rerender } = renderHook(
      ({ isThinking }: { isThinking: boolean }) =>
        useThinkingElapsedSeconds(isThinking, "live reasoning"),
      { initialProps: { isThinking: true } },
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(3);

    // Quiet window: stream-active flips off, then new tokens arrive.
    rerender({ isThinking: false });
    expect(result.current).toBe(3);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ isThinking: true });
    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(6);
  });

  it("restores duration after remount when final content extends the streamed text", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const streamed = "Let me reason about the request";
    const finalized = `${streamed}\n\nExtra trailing note from the action`;

    const first = renderHook(
      ({ isThinking }: { isThinking: boolean }) =>
        useThinkingElapsedSeconds(isThinking, streamed),
      { initialProps: { isThinking: true } },
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    first.rerender({ isThinking: false });
    expect(first.result.current).toBe(5);
    first.unmount();

    const second = renderHook(() =>
      useThinkingElapsedSeconds(false, finalized),
    );
    expect(second.result.current).toBe(5);
  });

  it("starts a new Thinking turn at 0s even when content prefixes a prior Thought", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const prior =
      "Let me reason about the request in detail before answering";
    const priorHook = renderHook(
      ({ isThinking }: { isThinking: boolean }) =>
        useThinkingElapsedSeconds(isThinking, prior),
      { initialProps: { isThinking: true } },
    );

    act(() => {
      vi.advanceTimersByTime(28000);
    });
    priorHook.rerender({ isThinking: false });
    expect(priorHook.result.current).toBe(28);
    priorHook.unmount();

    // New turn opens with overlapping wording — must not inherit 28s.
    const next = renderHook(() =>
      useThinkingElapsedSeconds(
        true,
        "Let me reason about the request from a new angle",
      ),
    );
    expect(next.result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(next.result.current).toBe(2);
  });

  it("continues the clock across an in-flight remount handoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const content = "Streaming reasoning that remounts mid-flight";
    const first = renderHook(() => useThinkingElapsedSeconds(true, content));

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(first.result.current).toBe(7);
    first.unmount();

    const second = renderHook(() => useThinkingElapsedSeconds(true, content));
    expect(second.result.current).toBe(7);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(second.result.current).toBe(8);
  });
});
