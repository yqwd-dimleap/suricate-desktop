import React from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useAgentReviewStore } from "#/stores/agent-review-store";
import { useAgentReviewActions } from "#/hooks/mutation/use-agent-review-actions";

interface HunkReviewOverlayProps {
  path: string;
  dirty: boolean;
}

export function HunkReviewOverlay({ path, dirty }: HunkReviewOverlayProps) {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const pendingFile = useAgentReviewStore((state) =>
    conversationId
      ? state.byConversation[conversationId]?.pending[path]
      : undefined,
  );
  const pendingHunks = React.useMemo(
    () => pendingFile?.hunks.filter((hunk) => hunk.status === "pending") ?? [],
    [pendingFile],
  );
  const actions = useAgentReviewActions();

  if (pendingHunks.length === 0) {
    return null;
  }

  return (
    <div
      className="flex shrink-0 flex-col gap-1 border-b border-[var(--oh-border)] px-3 py-1.5"
      data-testid="hunk-review-overlay"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="review-accept-file"
          className="rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
          onClick={() => actions.acceptAllInFile(path)}
        >
          {t(I18nKey.REVIEW$ACCEPT_FILE)}
        </button>
        <button
          type="button"
          data-testid="review-reject-file"
          className="rounded px-2 py-0.5 text-xs text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
          disabled={actions.isPending}
          onClick={() => {
            void actions.rejectFile(path, dirty);
          }}
        >
          {t(I18nKey.REVIEW$REJECT_FILE)}
        </button>
      </div>
      {pendingHunks.map((hunk) => (
        <div
          key={hunk.id}
          className="flex items-center gap-2 text-xs"
          data-testid="hunk-review-row"
        >
          <span className="font-mono text-[var(--oh-muted)]">
            {hunk.newLines.length === 0
              ? t(I18nKey.REVIEW$HUNK_LINES, {
                  start: hunk.startLine,
                  end: hunk.startLine,
                })
              : t(I18nKey.REVIEW$HUNK_LINES, {
                  start: hunk.startLine,
                  end: hunk.endLine,
                })}
          </span>
          <button
            type="button"
            data-testid="hunk-accept"
            className="rounded px-2 py-0.5 text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
            onClick={() => actions.acceptHunk(path, hunk.id)}
          >
            {t(I18nKey.REVIEW$ACCEPT)}
          </button>
          <button
            type="button"
            data-testid="hunk-reject"
            className="rounded px-2 py-0.5 text-[var(--oh-text-secondary)] hover:bg-[var(--oh-interactive-hover)] hover:text-[var(--oh-foreground)]"
            disabled={actions.isPending}
            onClick={() => {
              void actions.rejectHunk(path, hunk.id, dirty);
            }}
          >
            {t(I18nKey.REVIEW$REJECT)}
          </button>
        </div>
      ))}
    </div>
  );
}
