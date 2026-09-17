import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveWorkspaceTextFile } from "#/api/workspace-file-save.api";
import { useOptionalConversationId } from "#/hooks/use-conversation-id";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useWorkspaceMutationCounter } from "#/stores/use-workspace-mutation-counter";
import { useWorkspaceDocumentStore } from "#/stores/workspace-document-store";

export function useSaveWorkspaceTextFile() {
  const { conversationId } = useOptionalConversationId();
  const { data: conversation } = useActiveConversation();
  const queryClient = useQueryClient();
  const bumpMutationCounter = useWorkspaceMutationCounter((s) => s.bump);

  return useMutation({
    mutationKey: ["save-workspace-text-file", conversationId],
    mutationFn: async ({
      relativePath,
      content,
    }: {
      relativePath: string;
      content: string;
    }) => {
      if (!conversationId) {
        throw new Error("No conversation ID");
      }
      await saveWorkspaceTextFile({
        conversationId,
        relativePath,
        content,
        currentConversation: conversation,
      });
    },
    onSuccess: async (_data, variables) => {
      if (conversationId) {
        useWorkspaceDocumentStore
          .getState()
          .markSynced(
            conversationId,
            variables.relativePath,
            variables.content,
          );
      }
      bumpMutationCounter();
      await Promise.all([
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "workspace-file-content" &&
            query.queryKey.includes(conversationId) &&
            query.queryKey.includes(variables.relativePath),
        }),
        queryClient.invalidateQueries({
          queryKey: ["file_changes", conversationId],
        }),
        // Keep Files gutters / Changes DiffEditor in sync with the just-written
        // working tree (status list alone is not enough for cached diffs).
        queryClient.invalidateQueries({
          queryKey: ["file_diff", conversationId],
        }),
      ]);
    },
  });
}
