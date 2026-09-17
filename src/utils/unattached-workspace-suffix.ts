/**
 * System-prompt appendix when a conversation was started without an attached
 * project workspace (empty per-conversation sandbox).
 */
export const UNATTACHED_WORKSPACE_SYSTEM_SUFFIX = `<WORKSPACE_STATUS>
No project workspace is attached to this conversation. The current working directory is a fresh per-conversation sandbox (often an empty git repo with no commits) — not the user's real project.

Before exploring git history, editing application code, or assuming a project path:
1. Ask which local project/folder to use, OR
2. Wait for the user to attach a workspace in the UI.

Do NOT run \`git log\` / \`git status\` archaeology in the empty sandbox and treat failures like "no commits yet" as the real project state.
</WORKSPACE_STATUS>`;

/**
 * Append (or set) a system_message_suffix on a start-conversation payload that
 * carries inline `agent_settings.agent_context`. Profile-id launches omit
 * agent_settings and cannot receive this client enrichment.
 */
export function appendSystemMessageSuffixToStartPayload(
  payload: Record<string, unknown>,
  suffix: string,
): Record<string, unknown> {
  const agentSettings = payload.agent_settings;
  if (!agentSettings || typeof agentSettings !== "object") {
    return payload;
  }

  const settings = agentSettings as Record<string, unknown>;
  const existingContext =
    settings.agent_context && typeof settings.agent_context === "object"
      ? (settings.agent_context as Record<string, unknown>)
      : {};
  const existingSuffix =
    typeof existingContext.system_message_suffix === "string"
      ? existingContext.system_message_suffix
      : null;

  return {
    ...payload,
    agent_settings: {
      ...settings,
      agent_context: {
        ...existingContext,
        system_message_suffix: existingSuffix
          ? `${existingSuffix}\n\n${suffix}`
          : suffix,
      },
    },
  };
}
