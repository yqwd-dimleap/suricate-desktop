import { describe, expect, it } from "vitest";
import {
  computeAgentReviewHunks,
  rejectHunkInText,
} from "#/utils/agent-review-hunks";

describe("computeAgentReviewHunks", () => {
  it("returns no hunks when texts are identical", () => {
    expect(computeAgentReviewHunks("a\nb", "a\nb")).toEqual([]);
  });

  it("groups a contiguous replacement as one hunk", () => {
    const hunks = computeAgentReviewHunks("a\nOLD\nc", "a\nNEW\nc");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.oldLines).toEqual(["OLD"]);
    expect(hunks[0]?.newLines).toEqual(["NEW"]);
    expect(hunks[0]?.startLine).toBe(2);
    expect(hunks[0]?.endLine).toBe(2);
  });

  it("splits two disjoint edits into two hunks", () => {
    const hunks = computeAgentReviewHunks("a\nb\nc\nd", "A\nb\nc\nD");
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.newLines).toEqual(["A"]);
    expect(hunks[1]?.newLines).toEqual(["D"]);
  });
});

describe("rejectHunkInText", () => {
  it("restores a replacement hunk to the baseline slice", () => {
    const baseline = "a\nOLD\nc";
    const current = "a\nNEW\nc";
    const [hunk] = computeAgentReviewHunks(baseline, current);
    expect(hunk).toBeDefined();
    expect(rejectHunkInText(baseline, current, hunk!.id)).toBe(baseline);
  });

  it("rejects only the targeted hunk when two exist", () => {
    const baseline = "a\nb\nc\nd";
    const current = "A\nb\nc\nD";
    const hunks = computeAgentReviewHunks(baseline, current);
    expect(hunks).toHaveLength(2);
    const next = rejectHunkInText(baseline, current, hunks[0]!.id);
    expect(next).toBe("a\nb\nc\nD");
  });

  it("returns current when hunk id is unknown", () => {
    expect(rejectHunkInText("a", "b", "missing")).toBe("b");
  });
});
