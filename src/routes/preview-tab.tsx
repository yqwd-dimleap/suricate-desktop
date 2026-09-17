import { Frame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConversationTabEmptyState } from "#/components/features/conversation/conversation-tab-empty-state";
import { FileContentViewer } from "#/components/features/files-tab/file-content-viewer";
import { I18nKey } from "#/i18n/declaration";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { usePreviewTabStore } from "#/stores/preview-tab-store";

function PreviewTab() {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const selectedPath = usePreviewTabStore((state) => state.selectedPath);
  const selectedConversationId = usePreviewTabStore(
    (state) => state.selectedConversationId,
  );

  // Ignore a path owned by another conversation (same isolation as Files).
  const path =
    selectedPath &&
    (selectedConversationId == null ||
      selectedConversationId === conversationId)
      ? selectedPath
      : null;

  if (!path) {
    return (
      <ConversationTabEmptyState
        className="h-full"
        icon={<Frame aria-hidden strokeWidth={2} className="size-full" />}
      >
        {t(I18nKey.PREVIEW$EMPTY)}
      </ConversationTabEmptyState>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col"
      data-testid="preview-tab"
    >
      <div className="shrink-0 truncate border-b border-[var(--oh-border)] px-3 py-2 font-mono text-xs text-[var(--oh-text-secondary)]">
        {path}
      </div>
      <div className="min-h-0 flex-1">
        <FileContentViewer path={path} viewMode="rich" editable={false} />
      </div>
    </div>
  );
}

export default PreviewTab;
