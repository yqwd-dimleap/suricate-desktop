import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { I18nKey } from "#/i18n/declaration";
import { openWorkspaceFile } from "#/services/canvas-ui";
import { getLanguageFromPath } from "#/utils/get-language-from-path";
import {
  computeDiffRevealRange,
  computeDiffStats,
  DiffView,
} from "../primitives/diff-view";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export interface FileEditorReviewCardProps {
  path: string;
  oldText: string;
  newText: string;
  /** Whether the file existed before the edit (false ⇒ treat as untracked add). */
  prevExist?: boolean;
  /**
   * Observation has landed on disk → show "Edited"; in-flight action → "Editing".
   * Kept for callers; no Keep/Revert actions are rendered on this row.
   */
  showReviewActions?: boolean;
}

/**
 * Cursor-style file edit row: collapsed summary by default
 * ("Edited filename +N -M >"), left click jumps to the file, chevron sits
 * immediately after the +/- stats and expands the unified diff.
 */
export function FileEditorReviewCard({
  path,
  oldText,
  newText,
  showReviewActions = false,
}: FileEditorReviewCardProps) {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const [expanded, setExpanded] = React.useState(false);
  const expandId = React.useId();

  const stats = computeDiffStats(oldText, newText);
  const reveal = computeDiffRevealRange(oldText, newText);
  const filename = basename(path);
  const language = getLanguageFromPath(path);
  const labelKey = showReviewActions
    ? I18nKey.FILE_EDITOR$EDITED
    : I18nKey.FILE_EDITOR$EDITING;

  const openFile = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (conversationId) {
      openWorkspaceFile(path, conversationId, {
        reveal: reveal ?? undefined,
      });
    }
  };

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="w-full text-sm" data-testid="file-editor-review-card">
      <div className="flex items-center gap-1.5 py-0.5">
        <span
          className="shrink-0 text-[var(--oh-muted)]"
          data-testid="file-editor-review-label"
        >
          {t(labelKey)}
        </span>
        <button
          type="button"
          className="min-w-0 truncate font-mono text-xs text-[var(--oh-foreground)] underline decoration-[var(--oh-muted)] underline-offset-2 hover:decoration-[var(--oh-foreground)]"
          title={path}
          onClick={openFile}
          data-testid="file-editor-review-filename"
        >
          {filename}
        </button>
        <span
          className="shrink-0 font-mono text-xs tabular-nums"
          data-testid="file-editor-review-stats"
        >
          {stats.additions > 0 && (
            <span className="text-[var(--oh-status-success)]">
              {`+${stats.additions}`}
            </span>
          )}
          {stats.additions > 0 && stats.deletions > 0 ? " " : null}
          {stats.deletions > 0 && (
            <span className="text-[var(--oh-status-error)]">
              {`-${stats.deletions}`}
            </span>
          )}
        </span>
        <button
          type="button"
          id={expandId}
          data-testid="file-editor-review-expand"
          className="shrink-0 rounded p-0.5 text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
          aria-expanded={expanded}
          aria-label={
            expanded ? t(I18nKey.BUTTON$COLLAPSE) : t(I18nKey.BUTTON$EXPAND)
          }
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Chevron className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {expanded && (
        <div
          role="region"
          aria-labelledby={expandId}
          className="mt-1 overflow-hidden rounded-lg border border-[var(--oh-border)] bg-[var(--oh-surface)]"
        >
          <DiffView
            oldText={oldText}
            newText={newText}
            language={language}
            embedded
          />
        </div>
      )}
    </div>
  );
}
