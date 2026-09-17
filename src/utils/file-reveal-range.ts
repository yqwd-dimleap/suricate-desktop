/**
 * 1-based line range for Cursor-style “open file and flash these lines”.
 * `endLine` defaults to `startLine` when omitted.
 */
export type FileRevealRange = {
  startLine: number;
  endLine?: number;
};

export function normalizeFileRevealRange(range: FileRevealRange): {
  startLine: number;
  endLine: number;
} {
  const startLine = Math.max(1, Math.floor(range.startLine));
  const endRaw =
    range.endLine == null ? startLine : Math.max(1, Math.floor(range.endLine));
  return {
    startLine: Math.min(startLine, endRaw),
    endLine: Math.max(startLine, endRaw),
  };
}

/**
 * Parse a Cursor-style `path:line` / `path:start-end` suffix.
 * Returns null when there is no trailing numeric range.
 */
export function parsePathWithReveal(candidate: string): {
  path: string;
  reveal?: FileRevealRange;
} {
  const reference = /^(.*?):(\d+)(?:-(\d+))?$/.exec(candidate.trim());
  if (!reference) {
    return { path: candidate };
  }
  const startLine = Number(reference[2]);
  const endLine = reference[3] ? Number(reference[3]) : startLine;
  if (!Number.isFinite(startLine) || startLine < 1) {
    return { path: candidate };
  }
  return {
    path: reference[1],
    reveal: {
      startLine,
      endLine: Number.isFinite(endLine) && endLine >= 1 ? endLine : startLine,
    },
  };
}

/** Parse a display range string like `"12"` or `"12-20"`. */
export function parseRevealRangeString(
  range: string | undefined,
): FileRevealRange | undefined {
  if (!range) return undefined;
  const match = /^(\d+)(?:-(\d+))?$/.exec(range.trim());
  if (!match) return undefined;
  const startLine = Number(match[1]);
  const endLine = match[2] ? Number(match[2]) : startLine;
  if (!Number.isFinite(startLine) || startLine < 1) return undefined;
  return {
    startLine,
    endLine: Number.isFinite(endLine) && endLine >= 1 ? endLine : startLine,
  };
}
