import { describe, expect, it } from "vitest";
import {
  computeDiffRevealRange,
  computeDiffStats,
  computeLineDiff,
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
