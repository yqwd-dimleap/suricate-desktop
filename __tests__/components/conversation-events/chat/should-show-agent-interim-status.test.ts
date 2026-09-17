import { describe, expect, it } from "vitest";
import { AgentState } from "#/types/agent-state";
import type { OpenHandsEvent } from "#/types/agent-server/core";
import { shouldShowAgentInterimStatus } from "#/components/conversation-events/chat/should-show-agent-interim-status";

const observation = {
  id: "obs-1",
  source: "agent",
  timestamp: "2026-01-01T00:00:00Z",
  kind: "ObservationEvent",
  observation: { kind: "ExecuteBashObservation" },
} as unknown as OpenHandsEvent;

const action = {
  id: "act-1",
  source: "agent",
  timestamp: "2026-01-01T00:00:00Z",
  kind: "ActionEvent",
  action: { kind: "ExecuteBashAction" },
  tool_name: "terminal",
  tool_call_id: "call-1",
} as unknown as OpenHandsEvent;

const delta = {
  id: "delta-1",
  source: "agent",
  timestamp: "2026-01-01T00:00:00Z",
  kind: "StreamingDeltaEvent",
  content: "thinking…",
} as unknown as OpenHandsEvent;

describe("shouldShowAgentInterimStatus", () => {
  it("shows while running after a settled observation", () => {
    expect(
      shouldShowAgentInterimStatus(AgentState.RUNNING, observation),
    ).toBe(true);
  });

  it("hides while a text stream is actively receiving tokens", () => {
    expect(
      shouldShowAgentInterimStatus(AgentState.RUNNING, delta, {
        isTextStreamActive: true,
      }),
    ).toBe(false);
  });

  it("keeps showing after a streaming delta settles (gap before next action)", () => {
    expect(
      shouldShowAgentInterimStatus(AgentState.RUNNING, delta, {
        isTextStreamActive: false,
      }),
    ).toBe(true);
  });

  it("hides while a pending action card is the live tail", () => {
    expect(shouldShowAgentInterimStatus(AgentState.RUNNING, action)).toBe(
      false,
    );
  });

  it("hides when the agent is idle", () => {
    expect(
      shouldShowAgentInterimStatus(AgentState.AWAITING_USER_INPUT, observation),
    ).toBe(false);
  });

  it("shows while loading before any events", () => {
    expect(shouldShowAgentInterimStatus(AgentState.LOADING, undefined)).toBe(
      true,
    );
  });
});
