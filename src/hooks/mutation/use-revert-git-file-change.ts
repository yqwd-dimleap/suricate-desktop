import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { GitChangeStatus } from "#/api/open-hands.types";
import AgentServerRuntimeService from "#/api/runtime-service/agent-server-runtime-service";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { I18nKey } from "#/i18n/declaration";
import { useWorkspaceMutationCounter } from "#/stores/use-workspace-mutation-counter";
import { buildRevertGitFileCommand } from "#/utils/build-revert-git-file-command";
import { displayErrorToast } from "#/utils/custom-toast-handlers";

export interface RevertGitFileChangeInput {
  path: string;
  status: GitChangeStatus;
}

/**
 * Discard one uncommitted working-tree change via git restore / clean, then
 * refresh Diff + Files caches.
 */
export function useRevertGitFileChange() {
  const { t } = useTranslation("openhands");
  const queryClient = useQueryClient();
  const { data: conversation } = useActiveConversation();
  const bumpWorkspaceMutationCounter = useWorkspaceMutationCounter(
    (state) => state.bump,
  );

  return useMutation({
    mutationFn: async ({ path, status }: RevertGitFileChangeInput) => {
      const command = buildRevertGitFileCommand(status, path);
      const cwd = conversation?.workspace?.working_dir?.trim() || undefined;
      const result = await AgentServerRuntimeService.executeCommand(
        conversation?.conversation_url,
        conversation?.session_api_key,
        command,
        cwd,
      );
      if (result.exit_code !== 0) {
        const detail =
          result.stderr.trim() ||
          result.stdout.trim() ||
          `exit ${result.exit_code}`;
        throw new Error(detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["file_changes"] });
      queryClient.invalidateQueries({ queryKey: ["file_diff"] });
      queryClient.invalidateQueries({ queryKey: ["git_commits"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-files"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-files-cloud"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-file-content"] });
      bumpWorkspaceMutationCounter();
    },
    onError: (error: Error) => {
      displayErrorToast(
        t(I18nKey.DIFF_VIEWER$REVERT_FAILED, {
          detail: error.message || t(I18nKey.ERROR$GENERIC),
        }),
      );
    },
  });
}
