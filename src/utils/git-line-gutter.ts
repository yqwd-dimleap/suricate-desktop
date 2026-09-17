import { computeFullLineDiff } from "#/components/features/chat/tool-visualizers/primitives/diff-view";

export type GitGutterKind = "added" | "modified";

export type GitGutterDecoration = {
  /** 1-based line number in the modified (current) file. */
  lineNumber: number;
  kind: GitGutterKind;
};

export const GIT_GUTTER_ADDED_CLASS = "git-gutter-added";
export const GIT_GUTTER_MODIFIED_CLASS = "git-gutter-modified";

/**
 * Derive Cursor-style editor gutter kinds from a working-tree vs base diff.
 * Pure-add hunks → green; add lines paired with deletes in the same hunk → orange.
 */
export function computeGitLineGutters(
  original: string,
  modified: string,
): GitGutterDecoration[] {
  if (original === modified) {
    return [];
  }

  // Empty original is an untracked / added file. `"".split("\n")` yields
  // `[""]`, which would otherwise look like a delete+add (modified) hunk.
  if (original === "") {
    if (modified === "") {
      return [];
    }
    return modified.split("\n").map((_, index) => ({
      lineNumber: index + 1,
      kind: "added" as const,
    }));
  }

  const rows = computeFullLineDiff(original, modified);
  const decorations: GitGutterDecoration[] = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    if (!row || row.type === "ctx") {
      index += 1;
      continue;
    }

    const start = index;
    while (index < rows.length && rows[index]?.type !== "ctx") {
      index += 1;
    }
    const slice = rows.slice(start, index);
    const hasDeletes = slice.some((item) => item.type === "del");
    const kind: GitGutterKind = hasDeletes ? "modified" : "added";

    for (const item of slice) {
      if (item.type === "add" && item.newLine != null) {
        decorations.push({ lineNumber: item.newLine, kind });
      }
    }
  }

  return decorations;
}

export function gitGutterClassName(kind: GitGutterKind): string {
  return kind === "added" ? GIT_GUTTER_ADDED_CLASS : GIT_GUTTER_MODIFIED_CLASS;
}
