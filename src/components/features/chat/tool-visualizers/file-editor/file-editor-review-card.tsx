import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GitChangeStatus } from "#/api/open-hands.types";
import { ConfirmationModal } from "#/components/shared/modals/confirmation-modal";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useRevertGitFileChange } from "#/hooks/mutation/use-revert-git-file-change";
import { useAgentReviewActions } from "#/hooks/mutation/use-agent-review-actions";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { I18nKey } from "#/i18n/declaration";
import { openWorkspaceFile } from "#/services/canvas-ui";
import { useFilesTabStore } from "#/stores/files-tab-store";
import { useAgentReviewStore } from "#/stores/agent-review-store";
import { getLanguageFromPath } from "#/utils/get-language-from-path";
import { toFilesTabPath } from "#/utils/path-utils";
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
  /** Show Keep/Revert when the observation has landed on disk. */
  showReviewActions?: boolean;
}

/**
 * Cursor-style file edit row: collapsed summary by default
 * ("Edited filename +N -M >"), left click jumps to the file, right chevron
 * expands the unified diff. Keep/Revert stay on the summary row when offered.
 */
export function FileEditorReviewCard({
  path,
  oldText,
  newText,
  prevExist = true,
  showReviewActions = false,
}: FileEditorReviewCardProps) {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const revertMutation = useRevertGitFileChange();
  const reviewActions = useAgentReviewActions();
  const clearStickyReveal = useFilesTabStore(
    (state) => state.clearStickyReveal,
  );
  const [kept, setKept] = React.useState(false);
  const [isRevertConfirmOpen, setIsRevertConfirmOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const expandId = React.useId();

  const stats = computeDiffStats(oldText, newText);
  const reveal = computeDiffRevealRange(oldText, newText);
  const filename = basename(path);
  const language = getLanguageFromPath(path);
  const workingDir = conversation?.workspace?.working_dir;
  const gitPath = toFilesTabPath(path, workingDir) || path;
  const status: GitChangeStatus = prevExist ? "M" : "U";
  const labelKey = showReviewActions
    ? I18nKey.FILE_EDITOR$EDITED
    : I18nKey.FILE_EDITOR$EDITING;

  const markReviewed = React.useCallback(() => {
    clearStickyReveal(gitPath);
    setKept(true);
  }, [clearStickyReveal, gitPath]);

  const keepChanges = React.useCallback(() => {
    reviewActions.acceptAllInFile(gitPath);
    markReviewed();
  }, [gitPath, markReviewed, reviewActions]);

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
      <div className="flex items-center gap-2 py-0.5">
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
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {showReviewActions && !kept && (
            <>
              <button
                type="button"
                data-testid="file-editor-keep-button"
                className="rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
                onClick={keepChanges}
              >
                {t(I18nKey.DIFF_VIEWER$KEEP)}
              </button>
              <button
                type="button"
                data-testid="file-editor-revert-button"
                className="rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
                onClick={() => setIsRevertConfirmOpen(true)}
              >
                {t(I18nKey.DIFF_VIEWER$REVERT)}
              </button>
            </>
          )}
          <button
            type="button"
            id={expandId}
            data-testid="file-editor-review-expand"
            className="rounded p-0.5 text-[var(--oh-muted)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
            aria-expanded={expanded}
            aria-label={
              expanded ? t(I18nKey.BUTTON$COLLAPSE) : t(I18nKey.BUTTON$EXPAND)
            }
            onClick={() => setExpanded((prev) => !prev)}
          >
            <Chevron className="h-4 w-4" aria-hidden />
          </button>
        </div>
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

      {isRevertConfirmOpen && (
        <ConfirmationModal
          text={t(I18nKey.DIFF_VIEWER$REVERT_CONFIRM, { path: gitPath })}
          confirmText={t(I18nKey.DIFF_VIEWER$REVERT)}
          isConfirming={revertMutation.isPending}
          onCancel={() => setIsRevertConfirmOpen(false)}
          onConfirm={() => {
            revertMutation.mutate(
              { path: gitPath, status },
              {
                onSuccess: () => {
                  setIsRevertConfirmOpen(false);
                  if (conversationId) {
                    useAgentReviewStore
                      .getState()
                      .clearFile(conversationId, gitPath);
                  }
                  markReviewed();
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}
