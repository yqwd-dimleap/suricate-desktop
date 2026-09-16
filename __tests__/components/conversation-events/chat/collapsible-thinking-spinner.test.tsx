import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, act } from "@testing-library/react";
import { renderWithProviders } from "test-utils";
import { CollapsibleThinking } from "#/components/conversation-events/chat/event-message-components/collapsible-thinking";
import { ThoughtEventMessage } from "#/components/conversation-events/chat/event-message-components/thought-event-message";
import { EventMessage } from "#/components/conversation-events/chat/event-message";
import { useAgentState } from "#/hooks/use-agent-state";
import { clearThinkingElapsedCacheForTests } from "#/hooks/use-thinking-elapsed-seconds";
import { AgentState } from "#/types/agent-state";
import { ActionEvent, SecurityRisk } from "#/types/agent-server/core";
import { ExecuteBashAction } from "#/types/agent-server/core/base/action";
import { StreamingDeltaEvent } from "#/types/agent-server/core/events/streaming-delta-event";

// NOTE: vitest.setup.ts mocks react-i18next so `t(key)` returns the key itself.
// We therefore assert on the raw i18n keys rather than the translated strings.
// Elapsed duration is asserted via data-seconds because the mock drops
// interpolation args.

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
const briefLabel = "THINKING$SETTLED_BRIEF";
const durationLabel = "THINKING$SETTLED_DURATION";

describe("CollapsibleThinking — thinking label", () => {
  beforeEach(() => {
    clearThinkingElapsedCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearThinkingElapsedCacheForTests();
  });

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

  it("settles to a plain 'Thought' label when duration was never measured", () => {
    renderWithProviders(<CollapsibleThinking content={REASONING} />);

    expect(screen.queryByTestId("collapsible-thinking-elapsed")).not.toBeInTheDocument();
    expect(screen.getByText(thoughtLabel)).toBeInTheDocument();
    expect(screen.queryByText(thinkingLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(briefLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(durationLabel)).not.toBeInTheDocument();
  });

  it("shows a Cursor-style compact Thinking header with elapsed seconds", () => {
    renderWithProviders(<CollapsibleThinking content={REASONING} isThinking />);

    const toggle = screen.getByTestId("collapsible-thinking-toggle");
    expect(toggle.className).toContain("gap-1");
    expect(screen.getByTestId(shimmerLabelTestId)).toBeInTheDocument();
    expect(screen.getByTestId("collapsible-thinking-elapsed")).toBeInTheDocument();
  });

  it("shows the Thinking header at 0s before the first reasoning token", () => {
    renderWithProviders(<CollapsibleThinking content="" isThinking />);

    expect(screen.getByTestId("collapsible-thinking")).toBeInTheDocument();
    expect(screen.getByTestId(shimmerLabelTestId)).toBeInTheDocument();
    expect(screen.getByTestId("collapsible-thinking-elapsed")).toHaveAttribute(
      "data-seconds",
      "0",
    );
  });

  it("settles to Thought briefly when thinking lasted under 2s", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const { rerender } = renderWithProviders(
      <CollapsibleThinking content={REASONING} isThinking />,
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });

    rerender(<CollapsibleThinking content={REASONING} />);

    expect(screen.getByText(briefLabel)).toBeInTheDocument();
    expect(
      screen.queryByTestId("collapsible-thinking-elapsed"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(durationLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(thoughtLabel)).not.toBeInTheDocument();
  });

  it("settles to Thought Ns when thinking lasted 2s or more", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    const { rerender } = renderWithProviders(
      <CollapsibleThinking content={REASONING} isThinking />,
    );

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByTestId("collapsible-thinking-elapsed")).toHaveAttribute(
      "data-seconds",
      "3",
    );

    rerender(<CollapsibleThinking content={REASONING} />);

    const settled = screen.getByText(durationLabel);
    expect(settled).toBeInTheDocument();
    expect(settled).toHaveAttribute("data-seconds", "3");
    expect(
      screen.queryByTestId("collapsible-thinking-elapsed"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(briefLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(thoughtLabel)).not.toBeInTheDocument();
  });

  it("hides elapsed seconds for historical thoughts that never went live", () => {
    renderWithProviders(<CollapsibleThinking content={REASONING} />);

    expect(
      screen.queryByTestId("collapsible-thinking-elapsed"),
    ).not.toBeInTheDocument();
  });
});

describe("ThoughtEventMessage — Cursor-style collapsible thought", () => {
  beforeEach(() => {
    clearThinkingElapsedCacheForTests();
  });

  it("renders ActionEvent.thought via CollapsibleThinking, not a chat bubble", () => {
    const event: ActionEvent<ExecuteBashAction> = {
      id: "action-thought",
      timestamp: "2026-06-12T12:00:02Z",
      source: "agent",
      thought: [{ type: "text", text: "I need to run a command" }],
      thinking_blocks: [],
      action: {
        kind: "ExecuteBashAction",
        command: "echo hello",
        is_input: false,
        timeout: null,
        reset: false,
      },
      tool_name: "execute_bash",
      tool_call_id: "call_1",
      tool_call: {
        id: "call_1",
        type: "function",
        function: { name: "execute_bash", arguments: '{"command":"echo hello"}' },
      },
      llm_response_id: "resp-1",
      security_risk: SecurityRisk.UNKNOWN,
    };

    renderWithProviders(<ThoughtEventMessage event={event} />);

    expect(screen.getByTestId("collapsible-thinking")).toBeInTheDocument();
    expect(screen.getByText(thoughtLabel)).toBeInTheDocument();
    // Collapsed by default — body text is not visible until expanded.
    expect(screen.queryByText("I need to run a command")).not.toBeInTheDocument();
  });
});

describe("EventMessage — live reasoning shows the shimmer label, settled thoughts do not", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearThinkingElapsedCacheForTests();
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
    // Historical remounts without a live clock keep the plain Thought label.
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
    expect(screen.queryByText(thinkingLabel)).not.toBeInTheDocument();
    expect(screen.getByText(thoughtLabel)).toBeInTheDocument();
  });
});
