import { RemoteWorkspace } from "@openhands/typescript-client/workspace/remote-workspace";
import { getAgentServerClientOptions } from "#/api/agent-server-client-options";
import {
  resolveAbsoluteWorkspacePath,
  resolveConversationUploadWorkingDir,
} from "#/api/workspace-upload-path";
import {
  resolveConversationRuntime,
  type ConversationRuntimeContext,
} from "#/api/conversation-file-upload.api";
import { getActiveBackend } from "#/api/backend-registry/active-store";
import type { AppConversation } from "#/api/conversation-service/agent-server-conversation-service.types";

function requireCloudRuntime(
  runtime: ConversationRuntimeContext,
): ConversationRuntimeContext & {
  conversationUrl: string;
  sessionApiKey: string;
} {
  if (!runtime.conversationUrl || !runtime.sessionApiKey) {
    throw new Error(
      "Conversation sandbox is still starting. Wait for it to finish, then try again.",
    );
  }
  return {
    conversationUrl: runtime.conversationUrl,
    sessionApiKey: runtime.sessionApiKey,
  };
}

/**
 * Normalize a workspace-relative path and reject traversal segments.
 */
export function normalizeWorkspaceRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (
    parts.length === 0 ||
    parts.some((part) => part === "." || part === "..")
  ) {
    throw new Error("Invalid workspace path");
  }
  return parts.join("/");
}

/**
 * Save text content to a workspace-relative path via RemoteWorkspace.fileUpload.
 */
export async function saveWorkspaceTextFile(options: {
  conversationId: string;
  relativePath: string;
  content: string;
  currentConversation?: AppConversation | null;
}): Promise<void> {
  const { conversationId, relativePath, content, currentConversation } =
    options;
  const safeRelative = normalizeWorkspaceRelativePath(relativePath);
  const fileName = safeRelative.split("/").pop()!;

  const workingDir = await resolveConversationUploadWorkingDir(
    conversationId,
    currentConversation,
  );
  const runtime = await resolveConversationRuntime(
    conversationId,
    currentConversation,
  );
  const isCloud = getActiveBackend().backend.kind === "cloud";

  const sessionApiKey =
    currentConversation?.id === conversationId
      ? (currentConversation.session_api_key ?? runtime.sessionApiKey)
      : runtime.sessionApiKey;
  const conversationUrl =
    currentConversation?.id === conversationId
      ? (currentConversation.conversation_url ?? runtime.conversationUrl)
      : runtime.conversationUrl;

  const resolvedRuntime = isCloud
    ? requireCloudRuntime({ conversationUrl, sessionApiKey })
    : { conversationUrl, sessionApiKey };

  const absoluteDir = await resolveAbsoluteWorkspacePath(workingDir, {
    conversationUrl: resolvedRuntime.conversationUrl,
    sessionApiKey: resolvedRuntime.sessionApiKey,
  });
  const destinationPath = `${absoluteDir.replace(/[/\\]+$/, "")}/${safeRelative}`;

  const workspace = new RemoteWorkspace(
    getAgentServerClientOptions({
      conversationUrl: resolvedRuntime.conversationUrl,
      sessionApiKey: resolvedRuntime.sessionApiKey,
      workingDir,
    }),
  );

  const result = await workspace.fileUpload(content, destinationPath, fileName);
  if (!result.success) {
    throw new Error(result.error ?? "Failed to save file");
  }
}
