import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { SyntaxHighlighter } from "../../../markdown/syntax-highlighter";
import { I18nKey } from "#/i18n/declaration";
import { cn } from "#/utils/utils";

export type DiffRow = {
  type: "add" | "del" | "ctx";
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

export type DiffSkipRow = {
  type: "skip";
  skipped: number;
  fromIndex: number;
};

export type FoldedDiffRow = DiffRow | DiffSkipRow;

/** Lines of unchanged context kept on each side of a change. */
const CONTEXT = 3;
/** Visible rows in the collapsed chat card (Cursor-style compact hunk). */
export const COLLAPSED_VISIBLE_ROWS = 4;
/** Max rendered rows before the view is truncated. */
const MAX_ROWS = 300;
/** Above this `old x new` line product we skip the O(n*m) LCS and show a
 *  wholesale replacement instead, so a full-file rewrite can't blow up. */
const LCS_CELL_BUDGET = 250_000;

const lcsDiff = (
  a: string[],
  b: string[],
  startOldLine: number,
  startNewLine: number,
): DiffRow[] => {
  if (a.length * b.length > LCS_CELL_BUDGET) {
    return [
      ...a.map(
        (text, index): DiffRow => ({
          type: "del",
          text,
          oldLine: startOldLine + index,
          newLine: null,
        }),
      ),
      ...b.map(
        (text, index): DiffRow => ({
          type: "add",
          text,
          oldLine: null,
          newLine: startNewLine + index,
        }),
      ),
    ];
  }
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let oldLine = startOldLine;
  let newLine = startNewLine;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "ctx", text: a[i], oldLine, newLine });
      i += 1;
      j += 1;
      oldLine += 1;
      newLine += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: "del", text: a[i], oldLine, newLine: null });
      i += 1;
      oldLine += 1;
    } else {
      rows.push({ type: "add", text: b[j], oldLine: null, newLine });
      j += 1;
      newLine += 1;
    }
  }
  while (i < n) {
    rows.push({ type: "del", text: a[i], oldLine, newLine: null });
    i += 1;
    oldLine += 1;
  }
  while (j < m) {
    rows.push({ type: "add", text: b[j], oldLine: null, newLine });
    j += 1;
    newLine += 1;
  }
  return rows;
};

/**
 * Computes a unified line diff. Common leading/trailing lines are trimmed (with
 * a few kept as context) so a localized edit inside a large file stays small
 * and cheap to diff.
 */
export const computeLineDiff = (
  oldText: string,
  newText: string,
): DiffRow[] => {
  const a = oldText.split("\n");
  const b = newText.split("\n");

  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo += 1;
  let hiA = a.length;
  let hiB = b.length;
  while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) {
    hiA -= 1;
    hiB -= 1;
  }

  const leadStart = Math.max(0, lo - CONTEXT);
  const trailEnd = Math.min(a.length, hiA + CONTEXT);

  const lead: DiffRow[] = [];
  for (let index = leadStart; index < lo; index += 1) {
    lead.push({
      type: "ctx",
      text: a[index],
      oldLine: index + 1,
      newLine: index + 1,
    });
  }

  const middle = lcsDiff(a.slice(lo, hiA), b.slice(lo, hiB), lo + 1, lo + 1);

  const trail: DiffRow[] = [];
  for (let index = hiA; index < trailEnd; index += 1) {
    const offset = index - hiA;
    trail.push({
      type: "ctx",
      text: a[index],
      oldLine: index + 1,
      newLine: hiB + offset + 1,
    });
  }

  return [...lead, ...middle, ...trail];
};

/**
 * Full-file line diff with no context trimming. Used to group review hunks
 * without collapsing distant edits into the chat snippet view.
 */
export const computeFullLineDiff = (
  oldText: string,
  newText: string,
): DiffRow[] => {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  return lcsDiff(a, b, 1, 1);
};

/**
 * Collapses long unchanged runs so the chat card shows a few lines around
 * each hunk (Cursor / GitHub unified-diff folding).
 */
export const foldDiffRows = (
  rows: DiffRow[],
  context = CONTEXT,
): FoldedDiffRow[] => {
  const folded: FoldedDiffRow[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    if (row?.type !== "ctx") {
      if (row) folded.push(row);
      index += 1;
      continue;
    }

    const start = index;
    while (index < rows.length && rows[index]?.type === "ctx") {
      index += 1;
    }
    const run = rows.slice(start, index);
    const isLeading = start === 0;
    const isTrailing = index === rows.length;

    if (isLeading && run.length > context) {
      folded.push({
        type: "skip",
        skipped: run.length - context,
        fromIndex: start,
      });
      folded.push(...run.slice(-context));
    } else if (isTrailing && run.length > context) {
      folded.push(...run.slice(0, context));
      folded.push({
        type: "skip",
        skipped: run.length - context,
        fromIndex: start + context,
      });
    } else if (!isLeading && !isTrailing && run.length > context * 2) {
      folded.push(...run.slice(0, context));
      folded.push({
        type: "skip",
        skipped: run.length - context * 2,
        fromIndex: start + context,
      });
      folded.push(...run.slice(-context));
    } else {
      folded.push(...run);
    }
  }
  return folded;
};

/**
 * Collapsed chat cards prioritize the first add/del hunk (Cursor-style),
 * keeping at most one leading context line instead of burning the budget on
 * unchanged lead-in.
 */
export const sliceCollapsedDiffRows = (
  rows: FoldedDiffRow[],
  limit: number,
): FoldedDiffRow[] => {
  if (rows.length <= limit) {
    return rows;
  }
  const firstChange = rows.findIndex(
    (row) => row.type === "add" || row.type === "del",
  );
  if (firstChange < 0) {
    return rows.slice(0, limit);
  }
  let start = firstChange;
  if (firstChange > 0 && rows[firstChange - 1]?.type === "ctx") {
    start = firstChange - 1;
  }
  return rows.slice(start, start + limit);
};

export function computeDiffStats(
  oldText: string,
  newText: string,
): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const row of computeLineDiff(oldText, newText)) {
    if (row.type === "add") additions += 1;
    if (row.type === "del") deletions += 1;
  }
  return { additions, deletions };
}

/**
 * 1-based line range in the *new* file covering the changed hunks, for
 * Files-tab reveal/scroll. Prefer addition lines; fall back to the deletion
 * anchor when the edit only removed content.
 */
export function computeDiffRevealRange(
  oldText: string,
  newText: string,
): { startLine: number; endLine: number } | null {
  const rows = computeLineDiff(oldText, newText);
  let startLine: number | null = null;
  let endLine: number | null = null;

  for (const row of rows) {
    if (row.type === "add" && row.newLine != null) {
      startLine =
        startLine == null ? row.newLine : Math.min(startLine, row.newLine);
      endLine = endLine == null ? row.newLine : Math.max(endLine, row.newLine);
    }
  }

  if (startLine != null && endLine != null) {
    return { startLine, endLine };
  }

  for (const row of rows) {
    if (row.type === "del" && row.oldLine != null) {
      // Deletion-only: land near where the lines used to be in the new file.
      const line = row.oldLine;
      startLine = startLine == null ? line : Math.min(startLine, line);
      endLine = endLine == null ? line : Math.max(endLine, line);
    }
  }

  if (startLine != null && endLine != null) {
    return { startLine, endLine };
  }

  return null;
}

const ROW_STYLE: Record<DiffRow["type"], string> = {
  // Background only — keep syntax-highlight colors on the code itself
  // (Cursor-style). Prefix markers carry the add/del hue.
  add: "bg-[var(--oh-status-success)]/20",
  del: "bg-[var(--oh-status-error)]/20",
  ctx: "",
};

const PREFIX_STYLE: Record<DiffRow["type"], string> = {
  add: "text-[var(--oh-status-success)]",
  del: "text-[var(--oh-status-error)]",
  ctx: "text-[var(--oh-muted)]",
};

const ROW_PREFIX: Record<DiffRow["type"], string> = {
  add: "+",
  del: "-",
  ctx: " ",
};

function DiffCodeLine({ text, language }: { text: string; language?: string }) {
  if (!language || language === "text") {
    return (
      <span className="min-w-0 flex-1 px-1 text-[var(--oh-foreground)]">
        {text}
      </span>
    );
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      PreTag="span"
      CodeTag="span"
      className="min-w-0 flex-1 px-1"
      customStyle={{
        background: "transparent",
        padding: 0,
        margin: 0,
        display: "block",
        overflow: "visible",
        whiteSpace: "pre-wrap",
      }}
      codeTagProps={{
        style: {
          background: "transparent",
          fontFamily: "inherit",
          fontSize: "inherit",
          whiteSpace: "pre-wrap",
        },
      }}
    >
      {text || " "}
    </SyntaxHighlighter>
  );
}

function DiffLineRow({ row, language }: { row: DiffRow; language?: string }) {
  return (
    <div
      className={cn("flex whitespace-pre-wrap leading-5", ROW_STYLE[row.type])}
      data-diff-type={row.type}
    >
      <span
        className="w-10 shrink-0 select-none border-r border-[var(--oh-border-subtle)] px-1 text-right text-[var(--oh-muted)] tabular-nums"
        aria-hidden
      >
        {row.oldLine ?? ""}
      </span>
      <span
        className="w-10 shrink-0 select-none border-r border-[var(--oh-border-subtle)] px-1 text-right text-[var(--oh-muted)] tabular-nums"
        aria-hidden
      >
        {row.newLine ?? ""}
      </span>
      <span
        className={cn(
          "w-4 shrink-0 select-none text-center",
          PREFIX_STYLE[row.type],
        )}
        aria-hidden
      >
        {ROW_PREFIX[row.type]}
      </span>
      <DiffCodeLine text={row.text} language={language} />
    </div>
  );
}

/**
 * Unified before/after line diff for file edits (Cursor-like gutter).
 */
export function DiffView({
  oldText,
  newText,
  language,
  embedded = false,
}: {
  oldText: string;
  newText: string;
  /** Prism language for syntax highlighting (e.g. "tsx", "json"). */
  language?: string;
  /** When true, skip the outer border (parent card already provides chrome). */
  embedded?: boolean;
}) {
  const { t } = useTranslation("openhands");
  const rows = React.useMemo(
    () => computeLineDiff(oldText, newText),
    [oldText, newText],
  );
  const folded = React.useMemo(() => foldDiffRows(rows), [rows]);
  const [expanded, setExpanded] = React.useState(false);
  const [expandedSkips, setExpandedSkips] = React.useState<Set<number>>(
    () => new Set(),
  );

  React.useEffect(() => {
    setExpanded(false);
    setExpandedSkips(new Set());
  }, [oldText, newText]);

  const displayRows = React.useMemo(() => {
    const out: FoldedDiffRow[] = [];
    for (const row of folded) {
      if (row.type === "skip" && expandedSkips.has(row.fromIndex)) {
        out.push(...rows.slice(row.fromIndex, row.fromIndex + row.skipped));
      } else {
        out.push(row);
      }
    }
    return out;
  }, [expandedSkips, folded, rows]);

  const truncated = displayRows.length > MAX_ROWS;
  const uncapped = truncated ? displayRows.slice(0, MAX_ROWS) : displayRows;
  const needsCollapse = uncapped.length > COLLAPSED_VISIBLE_ROWS;
  const shown =
    expanded || !needsCollapse
      ? uncapped
      : sliceCollapsedDiffRows(uncapped, COLLAPSED_VISIBLE_ROWS);

  const expandSkip = (fromIndex: number) => {
    setExpanded(true);
    setExpandedSkips((current) => {
      const next = new Set(current);
      next.add(fromIndex);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "relative flex flex-col font-mono text-xs",
          !embedded && "rounded-lg border border-[var(--oh-border)]",
          expanded ? "max-h-80" : "overflow-hidden",
        )}
        data-testid="diff-view"
      >
        <div
          className={cn(
            "min-h-0",
            expanded ? "flex-1 overflow-auto" : "overflow-hidden",
          )}
          data-testid="diff-view-scroll"
        >
          {shown.map((row, index) =>
            row.type === "skip" ? (
              <button
                key={`skip-${row.fromIndex}`}
                type="button"
                className="flex w-full items-center gap-2 border-y border-[var(--oh-border-subtle)] bg-[var(--oh-surface-raised)] px-3 py-1 text-left text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
                data-testid="diff-skip-row"
                onClick={() => expandSkip(row.fromIndex)}
              >
                <span aria-hidden>···</span>
                {t(I18nKey.DIFF_VIEWER$HIDDEN_LINES, { n: row.skipped })}
              </button>
            ) : (
              <DiffLineRow
                key={`${index}-${row.type}-${row.oldLine}-${row.newLine}`}
                row={row}
                language={language}
              />
            ),
          )}
        </div>
        {needsCollapse && (
          <button
            type="button"
            className={cn(
              "z-10 flex w-full shrink-0 items-center justify-center py-1 text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]",
              expanded
                ? "border-t border-[var(--oh-border-subtle)] bg-[var(--oh-surface)]"
                : "absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--oh-surface)] from-40% to-transparent pt-6",
            )}
            data-testid="diff-view-expand"
            aria-label={t(
              expanded ? I18nKey.BUTTON$COLLAPSE : I18nKey.BUTTON$EXPAND,
            )}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {truncated && (
        <span className="text-xs text-muted">
          {t(I18nKey.COMMON$TRUNCATED)}
        </span>
      )}
    </div>
  );
}
