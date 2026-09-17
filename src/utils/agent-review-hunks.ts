import { computeFullLineDiff } from "#/components/features/chat/tool-visualizers/primitives/diff-view";

export type AgentReviewHunk = {
  id: string;
  /** 1-based inclusive range in the current (new) file. Delete-only hunks
   *  use a zero-width range: startLine is the insertion index (1-based),
   *  endLine is startLine - 1. */
  startLine: number;
  endLine: number;
  oldLines: string[];
  newLines: string[];
};

/**
 * Groups consecutive add/del rows from a full-file line diff into review hunks.
 */
export function computeAgentReviewHunks(
  baseline: string,
  current: string,
): AgentReviewHunk[] {
  if (baseline === current) {
    return [];
  }
  const rows = computeFullLineDiff(baseline, current);
  const hunks: AgentReviewHunk[] = [];
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
    const oldLines = slice
      .filter((item) => item.type === "del")
      .map((item) => item.text);
    const newLines = slice
      .filter((item) => item.type === "add")
      .map((item) => item.text);
    const addRows = slice.filter((item) => item.type === "add");
    const firstAdd = addRows[0]?.newLine;
    const lastAdd = addRows[addRows.length - 1]?.newLine;
    let startLine: number;
    let endLine: number;
    if (firstAdd != null && lastAdd != null) {
      startLine = firstAdd;
      endLine = lastAdd;
    } else {
      const followingCtx = rows[index];
      startLine = followingCtx?.newLine ?? current.split("\n").length + 1;
      endLine = startLine - 1;
    }
    hunks.push({
      id: `h${hunks.length}-${startLine}-${endLine}`,
      startLine,
      endLine,
      oldLines,
      newLines,
    });
  }
  return hunks;
}

/**
 * Rebuild `current` as if `hunkId` had never been applied (restore that
 * slice from `baseline` via the hunk's old/new lines).
 */
export function rejectHunkInText(
  baseline: string,
  current: string,
  hunkId: string,
): string {
  const hunk = computeAgentReviewHunks(baseline, current).find(
    (item) => item.id === hunkId,
  );
  if (!hunk) {
    return current;
  }
  const lines = current.split("\n");
  if (hunk.newLines.length === 0) {
    lines.splice(hunk.startLine - 1, 0, ...hunk.oldLines);
  } else {
    lines.splice(hunk.startLine - 1, hunk.newLines.length, ...hunk.oldLines);
  }
  return lines.join("\n");
}
