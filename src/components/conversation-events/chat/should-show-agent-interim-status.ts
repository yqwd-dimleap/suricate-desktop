import type { OpenHandsEvent } from "#/types/agent-server/core";
import { AgentState } from "#/types/agent-state";
import {
  isActionEvent,
  isStreamingDeltaEvent,
} from "#/types/agent-server/type-guards";

export type AgentInterimStatusOptions = {
  /**
   * True while a trailing StreamingDeltaEvent is still receiving tokens
   * (live Thinking / answer stream). Settled deltas should NOT hide the
   * interim — that gap before the next tool call is exactly when users
   * want "Planning next moves".
   */
  isTextStreamActive?: boolean;
};

/**
 * Show a chat-tail interim status while the agent is busy, until the next
 * concrete turn starts: a live text stream, or a pending tool ActionEvent
 * (read / edit / run). Settled thoughts and observations keep the interim
 * visible so the chat never goes blank between rounds.
 */
export function shouldShowAgentInterimStatus(
  agentState: AgentState,
  lastMessage: OpenHandsEvent | undefined,
  options: AgentInterimStatusOptions = {},
): boolean {
  if (agentState !== AgentState.RUNNING && agentState !== AgentState.LOADING) {
    return false;
  }

  if (!lastMessage) {
    return true;
  }

  // Live token stream is the status surface — hide interim while it flows.
  if (isStreamingDeltaEvent(lastMessage) && options.isTextStreamActive) {
    return false;
  }

  // Pending ActionEvent (observation not yet merged into the UI list) is
  // already shown as an in-progress tool card / EventGroup.
  if (isActionEvent(lastMessage)) {
    return false;
  }

  return true;
}
