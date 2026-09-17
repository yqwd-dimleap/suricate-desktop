import { describe, expect, it } from "vitest";

import { getGitStatusBadge } from "#/utils/git-status-badge";

describe("getGitStatusBadge", () => {
  it.each([
    ["M", "M", "text-[var(--oh-git-modified)]"],
    ["R", "R", "text-[var(--oh-git-modified)]"],
    ["A", "U", "text-[var(--oh-git-added)]"],
    ["U", "U", "text-[var(--oh-git-added)]"],
    ["D", "D", "text-[var(--oh-git-deleted)]"],
  ] as const)(
    "maps %s to letter %s with matching color class",
    (status, letter, className) => {
      expect(getGitStatusBadge(status)).toEqual({ letter, className });
    },
  );
});
