import { describe, expect, it } from "vitest";

import {
  computeGitLineGutters,
  GIT_GUTTER_ADDED_CLASS,
  GIT_GUTTER_MODIFIED_CLASS,
  gitGutterClassName,
} from "#/utils/git-line-gutter";

describe("computeGitLineGutters", () => {
  it("returns no decorations when texts match", () => {
    expect(computeGitLineGutters("a\nb", "a\nb")).toEqual([]);
  });

  it("marks pure additions as added (green)", () => {
    expect(computeGitLineGutters("a\nc", "a\nb\nc")).toEqual([
      { lineNumber: 2, kind: "added" },
    ]);
  });

  it("marks replacement lines as modified (orange)", () => {
    expect(computeGitLineGutters("a\nold\nc", "a\nnew\nc")).toEqual([
      { lineNumber: 2, kind: "modified" },
    ]);
  });

  it("marks an entirely new file as all added lines", () => {
    expect(computeGitLineGutters("", "one\ntwo")).toEqual([
      { lineNumber: 1, kind: "added" },
      { lineNumber: 2, kind: "added" },
    ]);
  });

  it("maps gutter kinds to Monaco CSS class names", () => {
    expect(gitGutterClassName("added")).toBe(GIT_GUTTER_ADDED_CLASS);
    expect(gitGutterClassName("modified")).toBe(GIT_GUTTER_MODIFIED_CLASS);
  });
});
