import React from "react";
import { useQuery } from "@tanstack/react-query";
import AgentServerGitService from "#/api/git-service/agent-server-git-service.api";
import { useConversationId } from "#/hooks/use-conversation-id";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useRuntimeIsReady } from "#/hooks/use-runtime-is-ready";
import { getGitPath } from "#/utils/get-git-path";

type UseGitBlameConfig = {
  filePath: string;
  enabled: boolean;
};

/**
 * Fetch per-line git blame for a Files-tab path. Disabled when annotate is
 * off; `null` data means the agent-server predates `/api/git/blame`.
 */
export const useGitBlame = (config: UseGitBlameConfig) => {
  const { conversationId } = useConversationId();
  const { data: conversation } = useActiveConversation();
  const runtimeIsReady = useRuntimeIsReady();

  const conversationUrl = conversation?.conversation_url;
  const sessionApiKey = conversation?.session_api_key;
  const selectedRepository = conversation?.selected_repository;
  const workingDir = conversation?.workspace?.working_dir?.trim();

  const absoluteFilePath = React.useMemo(() => {
    const gitPath = getGitPath(selectedRepository, workingDir);
    return `${gitPath}/${config.filePath}`;
  }, [selectedRepository, config.filePath, workingDir]);

  const result = useQuery({
    queryKey: [
      "git_blame",
      conversationId,
      conversationUrl,
      sessionApiKey,
      absoluteFilePath,
    ],
    queryFn: async () => {
      if (!conversationId) throw new Error("No conversation ID");

      return AgentServerGitService.getGitBlame(
        conversationUrl,
        sessionApiKey,
        absoluteFilePath,
      );
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    enabled: config.enabled && runtimeIsReady && !!conversationId,
    meta: {
      disableToast: true,
    },
  });

  return {
    lines: result.data ?? null,
    isUnsupported: result.data === null && result.isSuccess,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    isSuccess: result.isSuccess,
    isError: result.isError,
  };
};
