import type { GitChangeStatus } from "#/api/open-hands.types";

export type GitStatusBadge = {
  /** Display letter shown in the file tree (Cursor-style). */
  letter: "M" | "U" | "D" | "R";
  /** Tailwind text color class. */
  className: string;
};

/**
 * Maps a git change status to the Explorer badge letter + color.
 * Added / untracked both render as green `U` per Files-tab UX.
 */
export function getGitStatusBadge(
  status: GitChangeStatus,
): GitStatusBadge | null {
  switch (status) {
    case "M":
      return {
        letter: "M",
        className: "text-[var(--oh-git-modified)]",
      };
    case "R":
      return {
        letter: "R",
        className: "text-[var(--oh-git-modified)]",
      };
    case "A":
    case "U":
      return {
        letter: "U",
        className: "text-[var(--oh-git-added)]",
      };
    case "D":
      return {
        letter: "D",
        className: "text-[var(--oh-git-deleted)]",
      };
    default:
      return null;
  }
}
