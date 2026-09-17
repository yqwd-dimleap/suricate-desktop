import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { I18nKey } from "#/i18n/declaration";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useSaveWorkspaceTextFile } from "#/hooks/mutation/use-save-workspace-text-file";
import { useRevertGitFileChange } from "#/hooks/mutation/use-revert-git-file-change";
import { useAgentReviewStore } from "#/stores/agent-review-store";
import { rejectHunkInText } from "#/utils/agent-review-hunks";
import { displayErrorToast } from "#/utils/custom-toast-handlers";
import { useFilesTabStore } from "#/stores/files-tab-store";

export function useAgentReviewActions() {
  const { t } = useTranslation("openhands");
  const { conversationId } = useOptionalConversationId();
  const saveMutation = useSaveWorkspaceTextFile();
  const revertMutation = useRevertGitFileChange();

  const guardUnsaved = useCallback(
    (hasUnsavedEdits: boolean) => {
      if (!hasUnsavedEdits) {
        return true;
      }
      displayErrorToast(t(I18nKey.FILES$REVIEW_SAVE_FIRST));
      return false;
    },
    [t],
  );

  const rejectHunk = useCallback(
    async (path: string, hunkId: string, hasUnsavedEdits = false) => {
      if (!conversationId || !guardUnsaved(hasUnsavedEdits)) {
        return;
      }
      const file = useAgentReviewStore
        .getState()
        .getPendingFile(conversationId, path);
      if (!file) {
        return;
      }
      const next = rejectHunkInText(file.baseline, file.current, hunkId);
      await saveMutation.mutateAsync({ relativePath: path, content: next });
      useAgentReviewStore.getState().setFileCurrent(conversationId, path, next);
      if (
        !useAgentReviewStore.getState().getPendingFile(conversationId, path)
      ) {
        useFilesTabStore.getState().clearStickyReveal(path);
      }
    },
    [conversationId, guardUnsaved, saveMutation],
  );

  const rejectFile = useCallback(
    async (path: string, hasUnsavedEdits = false) => {
      if (!conversationId || !guardUnsaved(hasUnsavedEdits)) {
        return;
      }
      const file = useAgentReviewStore
        .getState()
        .getPendingFile(conversationId, path);
      if (!file) {
        return;
      }
      if (!file.prevExist) {
        await revertMutation.mutateAsync({ path, status: "U" });
      } else {
        await saveMutation.mutateAsync({
          relativePath: path,
          content: file.baseline,
        });
      }
      useAgentReviewStore.getState().clearFile(conversationId, path);
      useFilesTabStore.getState().clearStickyReveal(path);
    },
    [conversationId, guardUnsaved, revertMutation, saveMutation],
  );

  const acceptHunk = useCallback(
    (path: string, hunkId: string) => {
      if (!conversationId) {
        return;
      }
      useAgentReviewStore.getState().acceptHunk(conversationId, path, hunkId);
      if (
        !useAgentReviewStore.getState().getPendingFile(conversationId, path)
      ) {
        useFilesTabStore.getState().clearStickyReveal(path);
      }
    },
    [conversationId],
  );

  const acceptAllInFile = useCallback(
    (path: string) => {
      if (!conversationId) {
        return;
      }
      useAgentReviewStore.getState().acceptAllInFile(conversationId, path);
      useFilesTabStore.getState().clearStickyReveal(path);
    },
    [conversationId],
  );

  const acceptAll = useCallback(() => {
    if (!conversationId) {
      return;
    }
    const files = useAgentReviewStore
      .getState()
      .getPendingFiles(conversationId);
    useAgentReviewStore.getState().acceptAll(conversationId);
    for (const file of files) {
      useFilesTabStore.getState().clearStickyReveal(file.path);
    }
  }, [conversationId]);

  const rejectAll = useCallback(
    async (hasUnsavedEdits = false) => {
      if (!conversationId || !guardUnsaved(hasUnsavedEdits)) {
        return;
      }
      const files = useAgentReviewStore
        .getState()
        .getPendingFiles(conversationId);
      for (const file of files) {
        await rejectFile(file.path, false);
      }
    },
    [conversationId, guardUnsaved, rejectFile],
  );

  const restoreCheckpoint = useCallback(
    async (checkpointId: string, hasUnsavedEdits = false) => {
      if (!conversationId || !guardUnsaved(hasUnsavedEdits)) {
        return;
      }
      const checkpoint = useAgentReviewStore
        .getState()
        .getCheckpoint(conversationId, checkpointId);
      if (!checkpoint) {
        return;
      }
      for (const [path, snapshot] of Object.entries(checkpoint.files)) {
        if (!snapshot.prevExist) {
          await revertMutation.mutateAsync({ path, status: "U" });
        } else {
          await saveMutation.mutateAsync({
            relativePath: path,
            content: snapshot.baseline,
          });
        }
        useAgentReviewStore.getState().clearFile(conversationId, path);
        useFilesTabStore.getState().clearStickyReveal(path);
      }
    },
    [conversationId, guardUnsaved, revertMutation, saveMutation],
  );

  return {
    rejectHunk,
    rejectFile,
    acceptHunk,
    acceptAllInFile,
    acceptAll,
    rejectAll,
    restoreCheckpoint,
    isPending: saveMutation.isPending || revertMutation.isPending,
  };
}
