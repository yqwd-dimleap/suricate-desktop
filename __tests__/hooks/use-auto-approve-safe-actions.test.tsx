import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAutoApproveSafeActions } from "#/hooks/use-auto-approve-safe-actions";
import { useEventStore } from "#/stores/use-event-store";
import { useEventMessageStore } from "#/stores/event-message-store";
import { AgentState } from "#/types/agent-state";
import { SecurityRisk } from "#/types/agent-server/core/base/common";
import type { OHEvent } from "#/stores/use-event-store";

const respondToConfirmationMock = vi.hoisted(() => vi.fn());
const useAgentStateMock = vi.hoisted(() =>
  vi.fn(() => ({ curAgentState: AgentState.AWAITING_USER_CONFIRMATION })),
);

vi.mock("#/hooks/use-conversation-id", () => ({
  useOptionalConversationId: () => ({ conversationId: "conv-1" }),
}));

vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      id: "conv-1",
      conversation_url: "http://localhost/api/conversations/conv-1",
      session_api_key: "key",
    },
  }),
}));

vi.mock("#/hooks/use-agent-state", () => ({
  useAgentState: () => useAgentStateMock(),
}));

vi.mock("#/api/event-service/event-service.api", () => ({
  default: {
    respondToConfirmation: respondToConfirmationMock,
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

function fileViewAction(id: string): OHEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    source: "agent",
    thought: [],
    thinking_blocks: [],
    action: {
      kind: "FileEditorAction",
      command: "view",
      path: "/workspace/app.ts",
      file_text: null,
      old_str: null,
      new_str: null,
      insert_line: null,
      view_range: null,
    },
    tool_name: "file_editor",
    tool_call_id: `tool-${id}`,
    tool_call: {
      id: `tool-${id}`,
      type: "function",
      function: { name: "file_editor", arguments: "{}" },
    },
    llm_response_id: `response-${id}`,
    security_risk: SecurityRisk.LOW,
  } as unknown as OHEvent;
}

function fileEditAction(id: string): OHEvent {
  return {
    ...fileViewAction(id),
    action: {
      kind: "FileEditorAction",
      command: "str_replace",
      path: "/workspace/app.ts",
      file_text: null,
      old_str: "a",
      new_str: "b",
      insert_line: null,
      view_range: null,
    },
  } as unknown as OHEvent;
}

function browserAction(id: string): OHEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    source: "agent",
    thought: [],
    thinking_blocks: [],
    action: { kind: "BrowserGetStateAction" },
    tool_name: "browser",
    tool_call_id: `tool-${id}`,
    tool_call: {
      id: `tool-${id}`,
      type: "function",
      function: { name: "browser", arguments: "{}" },
    },
    llm_response_id: `response-${id}`,
    security_risk: SecurityRisk.LOW,
  } as unknown as OHEvent;
}

function bashAction(id: string): OHEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
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
    tool_name: "terminal",
    tool_call_id: `tool-${id}`,
    tool_call: {
      id: `tool-${id}`,
      type: "function",
      function: { name: "terminal", arguments: "{}" },
    },
    llm_response_id: `response-${id}`,
    security_risk: SecurityRisk.LOW,
  } as unknown as OHEvent;
}

describe("useAutoApproveSafeActions", () => {
  beforeEach(() => {
    respondToConfirmationMock.mockReset();
    respondToConfirmationMock.mockResolvedValue({});
    useAgentStateMock.mockReturnValue({
      curAgentState: AgentState.AWAITING_USER_CONFIRMATION,
    });
    useEventStore.setState({ events: [] });
    useEventMessageStore.setState({ submittedEventIds: [] });
  });

  it("auto-accepts a pending file_editor view confirmation", async () => {
    useEventStore.setState({ events: [fileViewAction("view-1")] });

    renderHook(() => useAutoApproveSafeActions(), { wrapper });

    await waitFor(() => {
      expect(respondToConfirmationMock).toHaveBeenCalledWith(
        "conv-1",
        "http://localhost/api/conversations/conv-1",
        { accept: true },
        "key",
      );
    });
    expect(useEventMessageStore.getState().submittedEventIds).toContain(
      "view-1",
    );
  });

  it("auto-accepts non-write tools such as browser", async () => {
    useEventStore.setState({ events: [browserAction("browser-1")] });

    renderHook(() => useAutoApproveSafeActions(), { wrapper });

    await waitFor(() => {
      expect(respondToConfirmationMock).toHaveBeenCalled();
    });
  });

  it("does not auto-accept a mutating file_editor action", async () => {
    useEventStore.setState({ events: [fileEditAction("edit-1")] });

    renderHook(() => useAutoApproveSafeActions(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(respondToConfirmationMock).not.toHaveBeenCalled();
  });

  it("does not auto-accept terminal commands", async () => {
    useEventStore.setState({ events: [bashAction("bash-1")] });

    renderHook(() => useAutoApproveSafeActions(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(respondToConfirmationMock).not.toHaveBeenCalled();
  });

  it("does nothing when the agent is not awaiting confirmation", async () => {
    useAgentStateMock.mockReturnValue({ curAgentState: AgentState.RUNNING });
    useEventStore.setState({ events: [fileViewAction("view-2")] });

    renderHook(() => useAutoApproveSafeActions(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(respondToConfirmationMock).not.toHaveBeenCalled();
  });
});
