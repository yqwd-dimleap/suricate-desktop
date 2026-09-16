import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFileDiff } from "react-icons/lu";

import type { GitChangeStatus } from "#/api/open-hands.types";
import { FileDiffViewer } from "#/components/features/diff-viewer/file-diff-viewer";
import { FileTreeView } from "#/components/features/files-tab/file-tree-view";
import {
  FILES_TAB_TREE_DEFAULT_WIDTH_PX,
  FILES_TAB_TREE_MAX_WIDTH_PX,
  FILES_TAB_TREE_MIN_WIDTH_PX,
  FILES_TAB_TREE_RESIZE_HANDLE_TEST_ID,
} from "#/components/features/files-tab/files-tab-tree.constants";
import { ConversationTabEmptyState } from "#/components/features/conversation/conversation-tab-empty-state";
import { ResizeHandle } from "#/components/ui/resize-handle";
import { useUnifiedGetGitChanges } from "#/hooks/query/use-unified-get-git-changes";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useResizableDrawerWidth } from "#/hooks/use-resizable-drawer-width";
import { I18nKey } from "#/i18n/declaration";
import { useConversationStore } from "#/stores/conversation-store";
import { RUNTIME_INACTIVE_STATES } from "#/types/agent-state";
import { useAgentState } from "#/hooks/use-agent-state";
import { RuntimeWaitingState } from "#/components/features/conversation-panel/runtime-waiting-state";

const CHANGES_TAB_TREE_WIDTH_STORAGE_KEY = "changes-tab-tree-width";

/**
 * Cursor-style SCM pane: changed-file tree on the left, selected file diff
 * on the right. Opened via overview git-diff / `navigateToChanges()`.
 */
function ChangesTab() {
  const { t } = useTranslation("openhands");
  const { conversationId } = useConversationId();
  const { data: changes, isSuccess, isLoading } = useUnifiedGetGitChanges();
  const { curAgentState } = useAgentState();
  const runtimeIsActive = !RUNTIME_INACTIVE_STATES.includes(curAgentState);

  const autoSelectPath = useConversationStore(
    (state) => state.commitsAutoExpandPath,
  );
  const setCommitsAutoExpandPath = useConversationStore(
    (state) => state.setCommitsAutoExpandPath,
  );

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const statusByPath = useMemo(() => {
    const map = new Map<string, GitChangeStatus>();
    for (const change of changes ?? []) {
      map.set(change.path, change.status);
    }
    return map;
  }, [changes]);

  const paths = useMemo(
    () => (changes ?? []).map((change) => change.path),
    [changes],
  );

  useEffect(() => {
    if (!autoSelectPath) {
      return;
    }
    if (paths.includes(autoSelectPath)) {
      setSelectedPath(autoSelectPath);
    }
    setCommitsAutoExpandPath(null);
  }, [autoSelectPath, paths, setCommitsAutoExpandPath]);

  useEffect(() => {
    if (selectedPath && paths.includes(selectedPath)) {
      return;
    }
    setSelectedPath(paths[0] ?? null);
  }, [paths, selectedPath]);

  const treeLayoutRef = useRef<HTMLDivElement>(null);
  const { drawerWidth: treeWidth, handleMouseDown: handleTreeResizeMouseDown } =
    useResizableDrawerWidth({
      containerRef: treeLayoutRef,
      defaultWidth: FILES_TAB_TREE_DEFAULT_WIDTH_PX,
      minWidth: FILES_TAB_TREE_MIN_WIDTH_PX,
      maxWidth: FILES_TAB_TREE_MAX_WIDTH_PX,
      storageKey: CHANGES_TAB_TREE_WIDTH_STORAGE_KEY,
      enabled: true,
      edge: "left",
    });

  const handleSelectFile = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  const selectedStatus = selectedPath
    ? (statusByPath.get(selectedPath) ?? "M")
    : null;

  if (!runtimeIsActive && isLoading) {
    return <RuntimeWaitingState />;
  }

  if (isSuccess && paths.length === 0) {
    return (
      <ConversationTabEmptyState icon={<LuFileDiff className="size-8" />}>
        {t(I18nKey.DIFF_VIEWER$NO_CHANGES)}
      </ConversationTabEmptyState>
    );
  }

  return (
    <main
      className="flex h-full w-full flex-col"
      data-testid="changes-tab"
      data-conversation-id={conversationId}
    >
      <div ref={treeLayoutRef} className="flex min-h-0 flex-1">
        <aside
          className="flex shrink-0 flex-col overflow-hidden border-r border-[var(--oh-border)]"
          style={{ width: treeWidth }}
          data-testid="changes-tab-tree"
        >
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar-always">
            {isLoading && paths.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[var(--oh-muted)]">
                {t(I18nKey.HOME$LOADING)}
              </div>
            ) : (
              <FileTreeView
                paths={paths}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
              />
            )}
          </div>
        </aside>
        <ResizeHandle
          testId={FILES_TAB_TREE_RESIZE_HANDLE_TEST_ID}
          onMouseDown={handleTreeResizeMouseDown}
        />
        <section className="min-w-0 flex-1 overflow-y-auto custom-scrollbar-always">
          {selectedPath && selectedStatus ? (
            <FileDiffViewer
              path={selectedPath}
              type={selectedStatus}
              isExpanded
              onToggle={() => undefined}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-sm text-[var(--oh-muted)]">
              {t(I18nKey.FILES$NO_FILE_SELECTED)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ChangesTab;
