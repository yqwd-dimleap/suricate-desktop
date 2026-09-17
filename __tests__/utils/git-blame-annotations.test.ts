import { describe, expect, it } from "vitest";
import type { GitBlameLine } from "#/api/open-hands.types";
import {
  classifyBlameRelativeTime,
  formatBlameAnnotationLabel,
  groupBlameAnnotations,
} from "#/utils/git-blame-annotations";

const NOW = new Date("2026-09-17T15:00:00+08:00");

function line(
  overrides: Partial<GitBlameLine> & Pick<GitBlameLine, "line" | "sha">,
): GitBlameLine {
  return {
    author: "alice",
    authorTime: "2026-09-17T10:00:00+08:00",
    summary: "work",
    ...overrides,
  };
}

describe("classifyBlameRelativeTime", () => {
  it("marks same local calendar day as today", () => {
    expect(
      classifyBlameRelativeTime("2026-09-17T01:00:00+08:00", NOW),
    ).toEqual({ kind: "today", dateLabel: "" });
  });

  it("marks previous local calendar day as yesterday", () => {
    expect(
      classifyBlameRelativeTime("2026-09-16T23:00:00+08:00", NOW),
    ).toEqual({ kind: "yesterday", dateLabel: "" });
  });

  it("falls back to a short date for older commits", () => {
    const result = classifyBlameRelativeTime(
      "2026-01-05T12:00:00+08:00",
      NOW,
    );
    expect(result.kind).toBe("date");
    expect(result.dateLabel.length).toBeGreaterThan(0);
  });
});

describe("groupBlameAnnotations", () => {
  it("folds consecutive same-sha lines into one block", () => {
    const blocks = groupBlameAnnotations(
      [
        line({ line: 1, sha: "aaa", author: "alice" }),
        line({ line: 2, sha: "aaa", author: "alice" }),
        line({ line: 3, sha: "bbb", author: "bob" }),
        line({ line: 4, sha: "bbb", author: "bob" }),
        line({ line: 5, sha: "aaa", author: "alice" }),
      ],
      NOW,
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      startLine: 1,
      endLine: 2,
      sha: "aaa",
      author: "alice",
      relativeKind: "today",
    });
    expect(blocks[1]).toMatchObject({
      startLine: 3,
      endLine: 4,
      sha: "bbb",
      author: "bob",
    });
    expect(blocks[2]).toMatchObject({
      startLine: 5,
      endLine: 5,
      sha: "aaa",
    });
  });

  it("returns empty for empty input", () => {
    expect(groupBlameAnnotations([])).toEqual([]);
  });
});

describe("formatBlameAnnotationLabel", () => {
  it("renders Today + author for today's blocks", () => {
    const [block] = groupBlameAnnotations(
      [line({ line: 1, sha: "aaa" })],
      NOW,
    );
    expect(block).toBeDefined();
    expect(
      formatBlameAnnotationLabel(block!, {
        today: "Today",
        yesterday: "Yesterday",
      }),
    ).toBe("Today  alice");
  });
});
