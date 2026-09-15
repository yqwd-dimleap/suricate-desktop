import { describe, expect, it } from "vitest";
import type {
  ActionEvent,
  MessageEvent,
  ObservationEvent,
  OpenHandsEvent,
} from "#/types/agent-server/core";
import type { ExecuteBashAction } from "#/types/agent-server/core/base/action";
import type { ExecuteBashObservation } from "#/types/agent-server/core/base/observation";
import type { ACPToolCallEvent } from "#/types/agent-server/core/events/acp-tool-call-event";
import { SecurityRisk } from "#/types/agent-server/core/base/common";
import {
  findAwaitingConfirmationEvent,
  projectTimeline,
} from "./project-timeline";

const timestamp = "2026-07-10T12:34:56.000Z";

const message = (id: string, source: "user" | "agent", text: string) =>
  ({
    id,
    timestamp,
    source,
    llm_message: {
      role: source === "user" ? "user" : "assistant",
      content: [{ type: "text", text }],
    },
    activated_skills: [],
    extended_content: [],
  }) satisfies MessageEvent;

const bashAction = (id: string, command: string) =>
  ({
    id,
    timestamp,
    source: "agent",
    thought: [],
    thinking_blocks: [],
    action: {
      kind: "ExecuteBashAction",
      command,
      is_input: false,
      timeout: null,
      reset: false,
    },
    tool_name: "terminal",
    tool_call_id: `tool-${id}`,
    tool_call: {
      id: `tool-${id}`,
      type: "function",
      function: { name: "terminal", arguments: "{}" },
    },
    llm_response_id: `response-${id}`,
    security_risk: SecurityRisk.LOW,
    summary: command,
  }) satisfies ActionEvent<ExecuteBashAction>;

const bashObservation = (id: string, actionId: string, output: string) =>
  ({
    id,
    timestamp,
    source: "environment",
    tool_name: "terminal",
    tool_call_id: `tool-${actionId}`,
    action_id: actionId,
    observation: {
      kind: "ExecuteBashObservation",
      command: "npm test",
      content: [{ type: "text", text: output }],
      exit_code: 0,
      error: false,
      timeout: false,
      metadata: {
        exit_code: 0,
        pid: 123,
        username: "openhands",
        hostname: "sandbox",
        working_dir: "/workspace/project",
        py_interpreter_path: null,
        prefix: "",
        suffix: "",
      },
    },
  }) satisfies ObservationEvent<ExecuteBashObservation>;

const acpToolCall = (id: string) =>
  ({
    id,
    timestamp,
    source: "agent",
    kind: "ACPToolCallEvent",
    tool_call_id: `acp-${id}`,
    title: "Read README.md",
    status: "completed",
    tool_kind: "read",
    raw_input: { path: "README.md" },
    raw_output: "# README",
    content: null,
    is_error: false,
  }) satisfies ACPToolCallEvent;

const project = (
  events: OpenHandsEvent[],
  overrides: Partial<{
    allEvents: OpenHandsEvent[];
    awaitingConfirmation: boolean;
    submittedEventIds: Array<string | number>;
  }> = {},
) =>
  projectTimeline({
    events,
    allEvents: overrides.allEvents ?? events,
    awaitingConfirmation: overrides.awaitingConfirmation ?? false,
    submittedEventIds: overrides.submittedEventIds ?? [],
  });

const kindsOf = (items: ReturnType<typeof project>) =>
  items.map((item) => item.kind);

describe("projectTimeline", () => {
  it("passes grouped rows through untouched when no confirmation is pending", () => {
    const events = [
      message("user-1", "user", "run the tests"),
      bashAction("action-1", "npm test"),
      bashObservation("obs-1", "action-1", "ok"),
    ];

    const items = project(events);

    expect(kindsOf(items)).toEqual(["single", "group"]);
  });

  it("keeps ACP tool call events as plain timeline rows", () => {
    const events = [
      message("user-1", "user", "read the readme"),
      acpToolCall("acp-1"),
    ];

    const items = project(events);

    expect(kindsOf(items)).toEqual(["single", "single"]);
    expect(items[1]).toMatchObject({ kind: "single", event: { id: "acp-1" } });
  });

  it("anchors the confirmation right after the row holding the pending action", () => {
    const pending = bashAction("action-2", "rm -rf build");
    const events = [
      message("user-1", "user", "clean up"),
      pending,
      message("user-2", "user", "be careful"),
    ];

    const items = project(events, { awaitingConfirmation: true });

    expect(kindsOf(items)).toEqual([
      "single",
      "single",
      "confirmation",
      "single",
    ]);
    expect(items[2]).toMatchObject({
      kind: "confirmation",
      event: { id: "action-2" },
    });
  });

  it("anchors the confirmation after the group containing the pending action", () => {
    const events = [
      bashAction("action-1", "ls"),
      bashObservation("obs-1", "action-1", "ok"),
      bashAction("action-2", "rm -rf build"),
    ];

    const items = project(events, { awaitingConfirmation: true });

    expect(kindsOf(items)).toEqual(["group", "confirmation"]);
  });

  it("appends the confirmation at the end when the pending action is not rendered", () => {
    const pending = bashAction("action-1", "rm -rf build");
    const events = [message("user-1", "user", "clean up")];

    const items = project(events, {
      allEvents: [...events, pending],
      awaitingConfirmation: true,
    });

    expect(kindsOf(items)).toEqual(["single", "confirmation"]);
    expect(items[1]).toMatchObject({ event: { id: "action-1" } });
  });

  it("emits no confirmation once the response was submitted", () => {
    const pending = bashAction("action-1", "rm -rf build");
    const events = [message("user-1", "user", "clean up"), pending];

    const items = project(events, {
      awaitingConfirmation: true,
      submittedEventIds: ["action-1"],
    });

    expect(kindsOf(items)).toEqual(["single", "single"]);
  });

  it("emits no confirmation when the history has no agent event", () => {
    const events = [message("user-1", "user", "hello")];

    const items = project(events, { awaitingConfirmation: true });

    expect(kindsOf(items)).toEqual(["single"]);
  });
});

describe("findAwaitingConfirmationEvent", () => {
  it("picks the latest action without an observation", () => {
    const events = [
      bashAction("action-1", "ls"),
      bashObservation("obs-1", "action-1", "ok"),
      bashAction("action-2", "rm -rf build"),
    ];

    expect(findAwaitingConfirmationEvent(events)?.id).toBe("action-2");
  });

  it("falls back to the last agent-sourced event when every action is observed", () => {
    const events = [
      bashAction("action-1", "ls"),
      bashObservation("obs-1", "action-1", "ok"),
      message("assistant-1", "agent", "done"),
    ];

    expect(findAwaitingConfirmationEvent(events)?.id).toBe("assistant-1");
  });

  it("returns null when no agent event exists", () => {
    expect(
      findAwaitingConfirmationEvent([message("user-1", "user", "hello")]),
    ).toBeNull();
  });
});
