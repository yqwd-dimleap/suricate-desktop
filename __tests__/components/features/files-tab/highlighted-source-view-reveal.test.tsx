import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HighlightedSourceView } from "#/components/features/files-tab/highlighted-source-view";

describe("HighlightedSourceView reveal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the requested lines highlighted while reveal is sticky", () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { rerender } = render(
      <HighlightedSourceView
        path="notes.txt"
        text={"one\ntwo\nthree\nfour\n"}
        reveal={{
          path: "notes.txt",
          startLine: 2,
          endLine: 3,
          nonce: 1,
        }}
      />,
    );

    expect(screen.getAllByTestId("file-reveal-line-active")).toHaveLength(2);

    act(() => {
      vi.runAllTimers();
    });
    expect(scrollIntoView).toHaveBeenCalled();
    // Sticky: still highlighted after the scroll frame — no auto-dismiss.
    expect(screen.getAllByTestId("file-reveal-line-active")).toHaveLength(2);

    rerender(
      <HighlightedSourceView
        path="notes.txt"
        text={"one\ntwo\nthree\nfour\n"}
        reveal={null}
      />,
    );
    expect(screen.queryByTestId("file-reveal-line-active")).not.toBeInTheDocument();
  });
});
