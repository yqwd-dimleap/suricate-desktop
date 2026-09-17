import React from "react";
import { useUnifiedGetGitChanges } from "#/hooks/query/use-unified-get-git-changes";
import { useFilesTabStore } from "#/stores/files-tab-store";

/**
 * Drop sticky Files-tab highlights once a path is no longer dirty vs HEAD
 * (committed, restored, or otherwise clean — including after a push that
 * followed a commit). Keep / Revert clear highlights explicitly; this covers
 * the "already on the remote / working tree clean" case.
 */
export function useClearStickyRevealsWhenClean() {
  const { data: changes, isSuccess } = useUnifiedGetGitChanges();
  const stickyReveals = useFilesTabStore((state) => state.stickyReveals);
  const clearStickyReveal = useFilesTabStore(
    (state) => state.clearStickyReveal,
  );

  React.useEffect(() => {
    if (!isSuccess || !changes) {
      return;
    }
    const dirtyPaths = new Set(changes.map((change) => change.path));
    for (const path of Object.keys(stickyReveals)) {
      if (!dirtyPaths.has(path)) {
        clearStickyReveal(path);
      }
    }
  }, [changes, isSuccess, stickyReveals, clearStickyReveal]);
}
