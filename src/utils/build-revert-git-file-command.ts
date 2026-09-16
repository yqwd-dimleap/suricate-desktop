import * as shellQuote from "shell-quote";
import type { GitChangeStatus } from "#/api/open-hands.types";

const { quote } = shellQuote;

/**
 * Build a workspace-cwd git command that discards one uncommitted change.
 *
 * - Tracked (`M`/`A`/`D`/`R`): restore index + worktree from HEAD.
 * - Untracked (`U`): delete the path (`git clean -f`, file only — no `-d`).
 */
export function buildRevertGitFileCommand(
  status: GitChangeStatus,
  path: string,
): string {
  const quotedPath = quote([path]);
  if (status === "U") {
    return `git clean -f -- ${quotedPath}`;
  }
  return `git restore --source=HEAD --staged --worktree -- ${quotedPath}`;
}
