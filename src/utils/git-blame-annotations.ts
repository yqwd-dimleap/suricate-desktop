import type { GitBlameLine } from "#/api/open-hands.types";

export type BlameRelativeKind = "today" | "yesterday" | "date";

export type BlameAnnotationBlock = {
  /** Inclusive 1-based start line. */
  startLine: number;
  /** Inclusive 1-based end line. */
  endLine: number;
  sha: string;
  author: string;
  authorTime: string;
  summary: string;
  relativeKind: BlameRelativeKind;
  /** Locale short date when relativeKind === "date"; otherwise unused. */
  dateLabel: string;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Classify an ISO author timestamp relative to `now` (local calendar day).
 */
export function classifyBlameRelativeTime(
  authorTime: string,
  now: Date = new Date(),
): { kind: BlameRelativeKind; dateLabel: string } {
  const parsed = new Date(authorTime);
  if (Number.isNaN(parsed.getTime())) {
    return { kind: "date", dateLabel: authorTime };
  }

  const today = startOfLocalDay(now).getTime();
  const authorDay = startOfLocalDay(parsed).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const deltaDays = Math.round((today - authorDay) / dayMs);

  if (deltaDays === 0) {
    return { kind: "today", dateLabel: "" };
  }
  if (deltaDays === 1) {
    return { kind: "yesterday", dateLabel: "" };
  }

  return {
    kind: "date",
    dateLabel: parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
}

/**
 * Fold consecutive same-sha blame lines into JetBrains-style annotation blocks.
 * Label text is rendered only on `startLine`; the whole range gets a highlight.
 */
export function groupBlameAnnotations(
  lines: GitBlameLine[],
  now: Date = new Date(),
): BlameAnnotationBlock[] {
  if (lines.length === 0) {
    return [];
  }

  const sorted = [...lines].sort((a, b) => a.line - b.line);
  const blocks: BlameAnnotationBlock[] = [];
  let current: BlameAnnotationBlock | null = null;

  for (const line of sorted) {
    const relative = classifyBlameRelativeTime(line.authorTime, now);
    if (
      current !== null &&
      current.sha === line.sha &&
      current.endLine + 1 === line.line
    ) {
      current.endLine = line.line;
      continue;
    }

    current = {
      startLine: line.line,
      endLine: line.line,
      sha: line.sha,
      author: line.author,
      authorTime: line.authorTime,
      summary: line.summary,
      relativeKind: relative.kind,
      dateLabel: relative.dateLabel,
    };
    blocks.push(current);
  }

  return blocks;
}

/**
 * Build the visible annotate label for a block (date/relative + author).
 * Callers supply already-translated "Today" / "Yesterday" strings.
 */
export function formatBlameAnnotationLabel(
  block: BlameAnnotationBlock,
  labels: { today: string; yesterday: string },
): string {
  const when =
    block.relativeKind === "today"
      ? labels.today
      : block.relativeKind === "yesterday"
        ? labels.yesterday
        : block.dateLabel;
  return `${when}  ${block.author}`.trim();
}
