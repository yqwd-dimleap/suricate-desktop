import { describe, expect, it } from "vitest";
import { buildRevertGitFileCommand } from "#/utils/build-revert-git-file-command";

describe("buildRevertGitFileCommand", () => {
  it("restores tracked modifications from HEAD", () => {
    expect(buildRevertGitFileCommand("M", "src/app.ts")).toBe(
      "git restore --source=HEAD --staged --worktree -- src/app.ts",
    );
  });

  it("restores deleted tracked files from HEAD", () => {
    expect(buildRevertGitFileCommand("D", "src/gone.ts")).toBe(
      "git restore --source=HEAD --staged --worktree -- src/gone.ts",
    );
  });

  it("removes untracked files with git clean", () => {
    expect(buildRevertGitFileCommand("U", "scratch.tmp")).toBe(
      "git clean -f -- scratch.tmp",
    );
  });

  it("shell-quotes paths with spaces", () => {
    expect(buildRevertGitFileCommand("M", "my file.ts")).toBe(
      "git restore --source=HEAD --staged --worktree -- 'my file.ts'",
    );
  });
});
