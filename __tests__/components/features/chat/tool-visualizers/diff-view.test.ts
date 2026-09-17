import { describe, expect, it } from "vitest";
import {
  computeDiffRevealRange,
  computeDiffStats,
  computeLineDiff,
  foldDiffRows,
  sliceCollapsedDiffRows,
  COLLAPSED_VISIBLE_ROWS,
} from "#/components/features/chat/tool-visualizers/primitives/diff-view";

describe("computeLineDiff", () => {
  it("assigns old/new line numbers for a localized edit", () => {
    const rows = computeLineDiff("a\nb\nc\n", "a\nB\nc\n");

    expect(rows).toEqual([
      { type: "ctx", text: "a", oldLine: 1, newLine: 1 },
      { type: "del", text: "b", oldLine: 2, newLine: null },
      { type: "add", text: "B", oldLine: null, newLine: 2 },
      { type: "ctx", text: "c", oldLine: 3, newLine: 3 },
      { type: "ctx", text: "", oldLine: 4, newLine: 4 },
    ]);
  });
});

describe("computeDiffStats", () => {
  it("counts additions and deletions", () => {
    expect(computeDiffStats("a\nb\n", "a\nB\nC\n")).toEqual({
      additions: 2,
      deletions: 1,
    });
  });
});

describe("foldDiffRows", () => {
  it("keeps a few context lines around distant hunks and skips the rest", () => {
    const unchanged = Array.from({ length: 20 }, (_, index) => `keep-${index}`);
    const oldText = ["head", ...unchanged, "tail"].join("\n");
    const newText = ["HEAD", ...unchanged, "TAIL"].join("\n");
    const folded = foldDiffRows(computeLineDiff(oldText, newText));

    expect(folded.some((row) => row.type === "skip")).toBe(true);
    const skip = folded.find((row) => row.type === "skip");
    expect(skip && skip.type === "skip" ? skip.skipped : 0).toBeGreaterThan(3);
    expect(
      folded
        .filter((row) => row.type === "add")
        .map((row) => (row.type === "add" ? row.text : "")),
    ).toEqual(["HEAD", "TAIL"]);
  });

  it("does not fold a short local edit", () => {
    const folded = foldDiffRows(computeLineDiff("a\nb\nc\n", "a\nB\nc\n"));
    expect(folded.every((row) => row.type !== "skip")).toBe(true);
  });
});

describe("sliceCollapsedDiffRows", () => {
  it("starts near the first change instead of leading context", () => {
    const lead = Array.from({ length: 8 }, (_, index) => `ctx-${index}`);
    const oldText = [...lead, "OLD", "tail"].join("\n");
    const newText = [...lead, "NEW", "tail"].join("\n");
    const folded = foldDiffRows(computeLineDiff(oldText, newText));
    const shown = sliceCollapsedDiffRows(folded, COLLAPSED_VISIBLE_ROWS);

    expect(shown.some((row) => row.type === "del" || row.type === "add")).toBe(
      true,
    );
    expect(shown[0]?.type === "ctx" ? shown[0].text : null).not.toBe("ctx-0");
    expect(
      shown.filter((row) => row.type === "add" || row.type === "del").length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("computeDiffRevealRange", () => {
  it("covers added lines in the new file", () => {
    expect(computeDiffRevealRange("a\nb\nc\n", "a\nB\nC\nc\n")).toEqual({
      startLine: 2,
      endLine: 3,
    });
  });

  it("falls back to the deletion anchor when nothing was added", () => {
    expect(computeDiffRevealRange("a\nb\nc\n", "a\nc\n")).toEqual({
      startLine: 2,
      endLine: 2,
    });
  });
});
