import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { CollapsibleThinking } from "#/components/conversation-events/chat/event-message-components/collapsible-thinking";
import { EventMessage } from "#/components/conversation-events/chat/event-message";
import { useAgentState } from "#/hooks/use-agent-state";
import { AgentState } from "#/types/agent-state";
import { ActionEvent, SecurityRisk } from "#/types/agent-server/core";
import { ExecuteBashAction } from "#/types/agent-server/core/base/action";
import { StreamingDeltaEvent } from "#/types/agent-server/core/events/streaming-delta-event";

// NOTE: vitest.setup.ts mocks react-i18next so `t(key)` returns the key itself.
// We therefore assert on the raw i18n keys ("THINKING$TITLE" for in-progress,
// "OBSERVATION_MESSAGE$THINK" for settled) rather than the translated strings.

vi.mock("#/hooks/query/use-config", () => ({
  useConfig: () => ({
    data: {},
  }),
}));

vi.mock("#/hooks/use-agent-state");

vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: "test-conversation-id" }),
  useConversationId: () => ({ conversationId: "test-conversation-id" }),
}));

const REASONING = "Let me work through the requirements first.";

const shimmerLabelTestId = "collapsible-thinking-label";
const thinkingLabel = "THINKING$TITLE";
const thoughtLabel = "OBSERVATION_MESSAGE$THINK";

describe("CollapsibleThinking — thinking label", () => {
  it("shows the shimmer 'Thinking' label while thinking (no spinner)", () => {
    renderWithProviders(<CollapsibleThinking content={REASONING} isThinking />);

    expect(screen.getByTestId(shimmerLabelTestId)).toBeInTheDocument();
    expect(screen.getByText(thinkingLabel)).toBeInTheDocument();
    expect(screen.queryByText(thoughtLabel)).not.toBeInTheDocument();
    // The old progress spinner must be gone.
    expect(
      document.querySelector(
        '[data-testid="collapsible-thinking"] .animate-spin',
      ),
    ).not.toBeInTheDocument();
  });

  it("settles to a static 'Thought' label when not thinking", () => {
    renderWithProviders(<CollapsibleThinking content={REASONING} />);

    expect(screen.queryByTestId(shimmerLabelTestId)).not.toBeInTheDocument();
    expect(screen.getByText(thoughtLabel)).toBeInTheDocument();
    expect(screen.queryByText(thinkingLabel)).not.toBeInTheDocument();
  });
});

describe("EventMessage — live reasoning shows the shimmer label, settled thoughts do not", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const streamingDelta: StreamingDeltaEvent = {
    id: "delta-reasoning",
    kind: "StreamingDeltaEvent",
    timestamp: "2026-06-12T12:00:01Z",
    source: "agent",
    content: null,
    reasoning_content: REASONING,
  };

  const actionWithReasoning: ActionEvent<ExecuteBashAction> = {
    id: "action-1",
    timestamp: "2026-06-12T12:00:02Z",
    source: "agent",
    thought: [],
    thinking_blocks: [],
    action: {
      kind: "ExecuteBashAction",
      command: "ls",
      is_input: false,
      timeout: null,
      reset: false,
    },
    tool_name: "execute_bash",
    tool_call_id: "call_1",
    tool_call: {
      id: "call_1",
      type: "function",
      function: { name: "execute_bash", arguments: '{"command":"ls"}' },
    },
    llm_response_id: "resp-1",
    security_risk: SecurityRisk.UNKNOWN,
    reasoning_content: REASONING,
  };

  it("shows the shimmer 'Thinking' label on a trailing reasoning delta while the agent is running", () => {
    vi.mocked(useAgentState).mockReturnValue({
      curAgentState: AgentState.RUNNING,
    });

    renderWithProviders(
      <EventMessage
        event={streamingDelta}
        messages={[streamingDelta]}
        isLastMessage
        isInLast10Actions
      />,
    );

    expect(screen.getByTestId("collapsible-thinking")).toBeInTheDocument();
    expect(screen.getByTestId(shimmerLabelTestId)).toBeInTheDocument();
    expect(screen.getByText(thinkingLabel)).toBeInTheDocument();
  });

  it("settles to a static 'Thought' label once the reasoning lands on an action", () => {
    // The agent is still running (executing the tool), but the reasoning is
    // finalized on the action — it must read as a completed "Thought", not shimmer.
    vi.mocked(useAgentState).mockReturnValue({
      curAgentState: AgentState.RUNNING,
    });

    renderWithProviders(
      <EventMessage
        event={actionWithReasoning}
        messages={[actionWithReasoning]}
        isLastMessage
        isInLast10Actions
      />,
    );

    expect(screen.getByTestId("collapsible-thinking")).toBeInTheDocument();
    expect(screen.queryByTestId(shimmerLabelTestId)).not.toBeInTheDocument();
    expect(screen.getByText(thoughtLabel)).toBeInTheDocument();
  });
});